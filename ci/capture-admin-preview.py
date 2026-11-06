#!/usr/bin/env python3
"""Collect native evidence from a disposable emulator, never visual approval.

Requires Python 3, adb and SDK aapt. No network, WebView debug or JavaScript
instrumentation is used. The output directory must be new or empty.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import html
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import time
import traceback
import xml.etree.ElementTree as ET
import zipfile

PACKAGE = "app.teachabs.adminpreview"
WIDTHS = (320, 360, 393)
SCALES = ("1.0", "1.3", "1.6")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def run(*args, binary=False, timeout=90):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            timeout=timeout, check=False)
    if result.returncode:
        raise RuntimeError(f"Command failed ({result.returncode}): {args!r}: "
                           + result.stderr.decode("utf-8", "replace")
                           + result.stdout.decode("utf-8", "replace"))
    return result.stdout if binary else result.stdout.decode("utf-8", "replace").strip()


def sdk_tool(name):
    found = shutil.which(name)
    if found:
        return found
    for env in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        root = Path(os.environ.get(env, "/nonexistent"))
        matches = sorted((root / "build-tools").glob("*/" + name), reverse=True)
        stable = root / "build-tools/34.0.0" / name
        if stable in matches:
            matches.remove(stable)
            matches.insert(0, stable)
        if name == "adb":
            matches = [root / "platform-tools/adb"]
        for candidate in matches:
            if candidate.is_file() and os.access(candidate, os.X_OK):
                return str(candidate)
    raise RuntimeError(f"Required Android SDK tool is missing: {name}")


def validate_apk(apk, revision, report):
    report["apkSha256"] = hashlib.sha256(apk.read_bytes()).hexdigest()
    aapt = sdk_tool("aapt")
    badging = run(aapt, "dump", "badging", str(apk))
    permissions = run(aapt, "dump", "permissions", str(apk))
    report.update(apkBadging=badging, apkPermissions=permissions)
    require(re.search(r"^package: name='app\.teachabs\.adminpreview' versionCode='14' versionName='0\.1\.4-review'", badging, re.M),
            "Unexpected APK package or version (expected app.teachabs.adminpreview 14 / 0.1.4-review)")
    require(not re.search(r"^uses-permission", permissions + "\n" + badging, re.M),
            "APK requests Android permissions")
    with zipfile.ZipFile(apk) as archive:
        names = archive.namelist()
        require(len(names) == len(set(names)), "Duplicate ZIP entries")
        manifest = json.loads(archive.read("assets/preview-manifest.json"))
        report["source"] = manifest
        for key, value in {"sourceRevision": revision, "sourceDirty": False,
                           "mode": "offline-static-preview", "network": False,
                           "persistence": False, "syntheticDataOnly": True}.items():
            require(manifest.get(key) == value and type(manifest.get(key)) is type(value),
                    f"Unexpected packaged manifest field: {key}")
        files, routes = manifest["files"], manifest["routes"]
        require(isinstance(files, dict) and isinstance(routes, dict), "Invalid manifest maps")
        titles = {}
        for filename, digest in files.items():
            require(re.fullmatch(r"[a-zA-Z0-9/_-]+\.(html|css)", filename)
                    and ".." not in PurePosixPath(filename).parts and not filename.startswith("/"),
                    f"Unsafe asset path: {filename}")
            content = archive.read("assets/" + filename)
            require(hashlib.sha256(content).hexdigest() == digest, f"Asset hash mismatch: {filename}")
            if filename.endswith(".html"):
                heading = re.search(r"<h1>([^<]+)</h1>", content.decode("utf-8"))
                require(heading is not None, f"Missing h1: {filename}")
                titles[filename] = html.unescape(heading.group(1))
        assets = {i.filename for i in archive.infolist() if i.filename.startswith("assets/") and not i.is_dir()}
        require(assets == {"assets/preview-manifest.json"} | {"assets/" + f for f in files},
                "Unlisted APK assets")
        require(set(routes.values()) <= set(files), "Unverified route asset")
        screens = {r: f for r, f in routes.items() if r.startswith("/admin")}
        require(len(screens) == 19, "Expected exactly 19 administration routes")
        require(all(re.fullmatch(r"/admin(?:/[a-zA-Z0-9_-]+)*", r) and f in titles for r, f in screens.items()),
                "Invalid screen route or title")
    report["apkValidated"] = True
    return screens, titles


def text_geometry(xml_path, width, height):
    tree = ET.parse(xml_path)
    nodes, observations = [], []
    for node in tree.iter("node"):
        attrs = node.attrib
        if not (attrs.get("text") or attrs.get("content-desc")):
            continue
        item = {key: attrs.get(key, "") for key in
                ("text", "content-desc", "class", "package", "bounds", "enabled", "clickable", "scrollable")}
        match = re.fullmatch(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]", item["bounds"])
        if match:
            x1, y1, x2, y2 = map(int, match.groups())
            item["rectanglePx"] = [x1, y1, x2, y2]
            if x1 < 0 or y1 < 0 or x2 > width or y2 > height or x2 <= x1 or y2 <= y1:
                observations.append({"nodeIndex": len(nodes), "kind": "offscreen-or-empty-accessibility-bounds",
                                     "rectanglePx": item["rectanglePx"]})
        nodes.append(item)
    return {"textNodes": nodes, "observations": observations,
            "limitation": "Accessibility rectangles are not glyph bounds; no finding is proof of no text clipping."}


def effective(raw, kind):
    pattern = r"(\d+x\d+)" if kind == "size" else r"(\d+)"
    matches = re.findall(r"(?:Physical|Override) " + kind + r":\s*" + pattern, raw)
    require(matches, f"Cannot read actual display {kind}: {raw}")
    return matches[-1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", required=True)
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--expected-revision", "--expected-revision40hex", dest="revision", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    require(not any(args.output.iterdir()), "Output directory must be empty (do not overwrite evidence)")
    report = {"status": "in-progress", "visualApproval": False, "serial": args.serial,
              "startedUtc": datetime.now(timezone.utc).isoformat(), "apk": str(args.apk.resolve()),
              "expectedRevision": args.revision, "completedCases": [], "cases": [], "restoration": {},
              "restored": False, "api": None, "webViewProvider": None,
              "requiredCaseCount": 19 * len(WIDTHS) * len(SCALES),
              "functionalChecks": {"help": "not tested: no safe coordinate-independent flow established",
                                   "back": "not tested: no confirmed link navigation history",
                                   "disabledSaving": "not tested: capture is not an interaction assertion"},
              "limitations": ["Screenshots require human visual review and are not release approval.",
                              "Android font_scale settings do not establish WebView text enlargement.",
                              "No JavaScript, remote WebView debugging, permissions, accounts or external service is used."]}
    original = {}
    mutated = False
    remote_created = False
    remote = "/data/local/tmp/teachabs-review-" + str(os.getpid()) + "-" + str(time.time_ns())

    def save():
        temp = args.output / "capture-report.json.tmp"
        temp.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temp.replace(args.output / "capture-report.json")

    def device(*parts, **kwargs):
        return run(adb, "-s", args.serial, *parts, **kwargs)

    def settings():
        return {"size": device("shell", "wm", "size"),
                "density": device("shell", "wm", "density"),
                "fontScale": device("shell", "settings", "get", "system", "font_scale")}

    def dump(name, case):
        try:
            device("shell", "uiautomator", "dump", remote + "/tree.xml")
            path = args.output / (name + ".xml")
            device("pull", remote + "/tree.xml", str(path))
            ET.parse(path)  # Malformed XML also leaves this position unconfirmed.
            return path
        except BaseException as xml_error:
            # One bounded diagnostic attempt only. It cannot confirm a route or
            # complete a case, and its failure must not replace the XML failure.
            diagnostic = {"kind": "unconfirmed-diagnostic-only", "routeConfirmed": False,
                          "visualApproval": False, "position": name,
                          "xmlFailure": str(xml_error), "timeoutSeconds": 20,
                          "status": "attempted"}
            case.setdefault("diagnostics", []).append(diagnostic)
            case["routeConfirmed"] = False
            case["status"] = "failed-unconfirmed"
            try:
                png = device("exec-out", "screencap", "-p", binary=True, timeout=20)
                require(png[:8] == b"\x89PNG\r\n\x1a\n", "Invalid diagnostic screenshot PNG")
                path = args.output / (name + "-unconfirmed.png")
                path.write_bytes(png)
                diagnostic.update(status="saved", screenshot=path.name,
                                  screenshotSha256=hashlib.sha256(png).hexdigest())
            except BaseException as diagnostic_error:
                diagnostic.update(status="failed", error=str(diagnostic_error))
            raise

    def snapshot(name, xml, width):
        path = args.output / (name + ".png")
        png = device("exec-out", "screencap", "-p", binary=True)
        require(png[:8] == b"\x89PNG\r\n\x1a\n", "Invalid screenshot PNG")
        path.write_bytes(png)
        return {"screenshot": path.name, "xml": xml.name,
                "screenshotSha256": hashlib.sha256(png).hexdigest(),
                "xmlSha256": hashlib.sha256(xml.read_bytes()).hexdigest(),
                **text_geometry(xml, width, 2400)}

    save()
    try:
        require(re.fullmatch(r"emulator-[0-9]+", args.serial), "Only an explicitly selected emulator serial is allowed")
        require(re.fullmatch(r"[a-f0-9]{40}", args.revision), "Expected revision must be 40 lowercase hexadecimal characters")
        routes, titles = validate_apk(args.apk.resolve(), args.revision, report)
        adb = sdk_tool("adb")
        require(device("get-state") == "device", "Selected emulator is not ready")
        require(device("shell", "getprop", "ro.kernel.qemu") == "1", "Refusing to modify a non-emulator")
        report["api"] = device("shell", "getprop", "ro.build.version.sdk")
        report["webViewProvider"] = device("shell", "dumpsys", "webviewupdate")
        original = settings()
        report["originalSettings"] = original
        # Capture all originals before any mutation, including installation.
        save()
        install = device("install", "-r", str(args.apk.resolve()), timeout=180)
        require("Success" in install, "APK installation did not report Success")
        report["installResult"] = install
        device("shell", "mkdir", "-p", remote)
        remote_created = True
        mutated = True
        device("shell", "wm", "density", "480")
        for width in WIDTHS:
            physical = width * 3
            device("shell", "wm", "size", f"{physical}x2400")
            for scale in SCALES:
                device("shell", "settings", "put", "system", "font_scale", scale)
                time.sleep(0.6)
                actual = settings()
                require(effective(actual["size"], "size") == f"{physical}x2400"
                        and effective(actual["density"], "density") == "480"
                        and float(actual["fontScale"]) == float(scale), "Display settings read-back mismatch")
                for index, (route, asset) in enumerate(routes.items(), 1):
                    name = f"w{width}-f{scale.replace('.', '_')}-p{index:02d}"
                    case = {"id": name, "route": route, "expectedH1": titles[asset],
                            "widthDp": width, "fontScale": scale, "actualSettings": actual,
                            "status": "started", "positions": {}}
                    report["cases"].append(case)
                    save()
                    device("shell", "am", "force-stop", PACKAGE)
                    device("shell", "am", "start", "-W", "-n", PACKAGE + "/.PreviewActivity", "--es", "preview_route", route)
                    confirmed = False
                    for attempt in range(4):
                        time.sleep(0.5)
                        xml = dump(name + "-top", case)
                        geometry = text_geometry(xml, physical, 2400)
                        activity = device("shell", "dumpsys", "activity", "activities")
                        foreground = re.search(r"(?:mResumedActivity|topResumedActivity)[^\n]*app\.teachabs\.adminpreview", activity)
                        if foreground and any(titles[asset] in (n["text"], n["content-desc"]) for n in geometry["textNodes"]):
                            confirmed = True
                            break
                    case["positions"]["top"] = snapshot(name + "-top", xml, physical)
                    case["routeConfirmed"] = confirmed
                    save()
                    require(confirmed, f"Required route was not confirmed by UIAutomator h1: {route}")
                    device("shell", "input", "swipe", str(physical // 2), "1900", str(physical // 2), "600", "450")
                    time.sleep(0.4)
                    xml = dump(name + "-scroll", case)
                    case["positions"]["scroll"] = snapshot(name + "-scroll", xml, physical)
                    case["status"] = "completed"
                    report["completedCases"].append(name)
                    save()
        report["status"] = "capture-only-not-visual-approval"
    except BaseException as error:
        report["status"] = "failed"
        report["failure"] = {"type": type(error).__name__, "message": str(error), "traceback": traceback.format_exc()}
    finally:
        if mutated:
            for key in ("size", "density", "fontScale"):
                try:
                    if key == "fontScale":
                        if original[key] == "null":
                            device("shell", "settings", "delete", "system", "font_scale")
                        else:
                            device("shell", "settings", "put", "system", "font_scale", original[key])
                        value = device("shell", "settings", "get", "system", "font_scale")
                    else:
                        match = re.search(r"Override " + key + r":\s*(\S+)", original[key])
                        device("shell", "wm", key, match.group(1) if match else "reset")
                        value = device("shell", "wm", key)
                    report["restoration"][key] = {"success": value == original[key], "actual": value}
                except BaseException as error:
                    report["restoration"][key] = {"success": False, "error": str(error)}
            report["restored"] = all(report["restoration"][k]["success"] for k in ("size", "density", "fontScale"))
        else:
            report["restoration"] = {"status": "not-needed-no-display-settings-changed"}
            report["restored"] = True
        if remote_created:
            try:
                device("shell", "rm", "-rf", remote)
                report["temporaryDeviceFilesRemoved"] = True
            except BaseException as error:
                report["temporaryDeviceFilesRemoved"] = False
                report["temporaryDeviceFilesError"] = str(error)
        # Compare native rectangles only, never infer glyph clipping or font size.
        grouped = {}
        for case in report["cases"]:
            if case["status"] == "completed":
                signature = [(n["text"], n["content-desc"], n["bounds"]) for n in case["positions"]["top"]["textNodes"]
                             if n["package"] == PACKAGE]
                grouped.setdefault((case["widthDp"], case["route"]), {})[case["fontScale"]] = signature
        report["geometryComparisons"] = [
            {"widthDp": width, "route": route, "scale": scale,
             "textNodeGeometryDiffersFrom1_0": scales[scale] != scales["1.0"],
             "webViewTextEnlargement": "not established by accessibility rectangle comparison"}
            for (width, route), scales in grouped.items() if "1.0" in scales
            for scale in ("1.3", "1.6") if scale in scales]
        if not report["restored"]:
            report["status"] = "failed"
            report["restorationFailure"] = "Display settings could not be fully restored"
        report["finishedUtc"] = datetime.now(timezone.utc).isoformat()
        save()
    print(f"{report['status']}: {args.output / 'capture-report.json'}")
    return 0 if report["status"] == "capture-only-not-visual-approval" else 1


if __name__ == "__main__":
    sys.exit(main())
