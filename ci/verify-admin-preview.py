#!/usr/bin/env python3
"""Check a locally built preview without installing it or contacting a service."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import zipfile


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def command(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT)


root = Path(__file__).resolve().parent.parent
os.chdir(root)
commit = command("git", "rev-parse", "HEAD").strip()
expected = os.environ.get("GITHUB_SHA", commit)
require(commit == expected, "Checkout does not match the workflow source revision")
require(not command("git", "status", "--porcelain", "--untracked-files=normal").strip(),
        "Source checkout changed during the build")

apk = root / "admin-preview-android/app/build/outputs/apk/debug/app-debug.apk"
require(apk.is_file(), "Offline preview APK was not built")
sdk = Path(os.environ["ANDROID_HOME"]) / "build-tools/34.0.0"
signature = command(str(sdk / "apksigner"), "verify", "--verbose", "--print-certs", str(apk))
permissions = command(str(sdk / "aapt"), "dump", "permissions", str(apk))
require(not re.search(r"^uses-permission", permissions, re.MULTILINE),
        "The preview must not request any Android permissions")
badging = command(str(sdk / "aapt"), "dump", "badging", str(apk))
identity = re.search(r"^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'",
                     badging, re.MULTILINE)
require(identity is not None, "Cannot read APK identity")
package, version_code, version_name = identity.groups()
require(package == "app.teachabs.adminpreview", "Unexpected app ID")
build = (root / "admin-preview-android/app/build.gradle").read_text()
require(version_code == re.search(r"versionCode\s+(\d+)", build).group(1),
        "Packaged versionCode differs from the source")
require(version_name == re.search(r"versionName\s+'([^']+)'", build).group(1),
        "Packaged versionName differs from the source")

with zipfile.ZipFile(apk) as archive:
    manifest = json.loads(archive.read("assets/preview-manifest.json"))
    for key, value in {"mode": "offline-static-preview", "sourceRevision": commit,
                       "sourceDirty": False, "network": False, "persistence": False,
                       "syntheticDataOnly": True}.items():
        require(manifest.get(key) == value, f"Unexpected packaged manifest field: {key}")
    require(sum(route.startswith("/admin") for route in manifest["routes"]) == 19,
            "Expected all 19 offline administration screens")
    for filename, digest in manifest["files"].items():
        require(not filename.startswith("/") and ".." not in Path(filename).parts,
                "Unsafe asset path")
        actual = hashlib.sha256(archive.read("assets/" + filename)).hexdigest()
        require(actual == digest, f"Packaged asset hash mismatch: {filename}")
    allowed_assets = {"assets/preview-manifest.json"} | {
        "assets/" + filename for filename in manifest["files"]}
    actual_assets = {entry.filename for entry in archive.infolist()
                     if entry.filename.startswith("assets/") and not entry.is_dir()}
    require(actual_assets == allowed_assets, "APK contains unlisted preview assets")
    require(set(manifest["routes"].values()) <= set(manifest["files"]),
            "Preview route points outside verified assets")

digest = hashlib.sha256(apk.read_bytes()).hexdigest()
delivery = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "admin-preview-delivery"
delivery.mkdir(parents=True, exist_ok=True)
filename = f"teachabs-admin-preview-{commit[:12]}.apk"
shutil.copyfile(apk, delivery / filename)
(delivery / "SHA256SUMS.txt").write_text(f"{digest}  {filename}\n")
(delivery / "preview-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
(delivery / "signature.txt").write_text(signature)
(delivery / "verification.json").write_text(json.dumps({
    "sourceCommit": commit, "package": package, "versionCode": int(version_code),
    "versionName": version_name, "sha256": digest, "sizeBytes": apk.stat().st_size,
    "androidPermissions": [], "verifiedAssetFiles": len(manifest["files"]),
    "screenCount": 19, "signing": "ephemeral runner debug key; not production",
    "deviceRuntimeTested": False,
}, indent=2) + "\n")
(delivery / "READ-ME.txt").write_text(
    "OFFLINE ADMINISTRATION DESIGN PREVIEW\n"
    "Synthetic read-only screens. No server, login, real data or saving.\n"
    "This APK is debug signed with this runner's temporary key. It is not a production update.\n"
    "If Android rejects an update, remove only the previous Administration Preview app first.\n"
    "Do not remove a different app. This preview has no saved user data.\n"
    "No device/emulator runtime test was performed in this workflow.\n"
    "Keep this APK if wanted; the Actions artifact expires after seven days.\n"
)
print(json.dumps({"verified": True, "commit": commit, "sha256": digest,
                  "package": package, "screenCount": 19, "deviceRuntimeTested": False}))
