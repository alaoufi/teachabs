# Classroom lab 001 — verification

Baseline: `e7a7e320569f0bc3309a31176ffb6a1f913ceaa2` (main and live Render deployment checked 2026-11-05).

- Full regression suite on Node 26.7.0: **88 passed, 0 failed**, including 2 new lab tests. Local HTTP tests require loopback access outside the restricted sandbox; the first sandbox run failed with EACCES, not application errors.
- Headless Chrome: drawing, shapes, literal Arabic text, undo/redo, read-only student UI preview, local save/reload, JSON export/import, invalid import preservation, simulated touch and widths 320/500/1280.
- No browser JavaScript errors or external requests observed in the passing browser run.
- Imported text is rendered with textContent; unknown fields are removed and geometry/size are bounded. These checks do not constitute a full security audit.
- Backup 001 restored successfully and baseline HEAD matched; details in CLASSROOM-LAB.md.
- Existing editor bundles, dependency manifests, database schema and classroom implementation unchanged.
- Not tested: physical stylus pressure/palm rejection, physical Android/iOS, audio/video, recording, multi-user scale. These are not features of the lab.

Browser evidence is generated in `task-10/verification/` (JSON and responsive screenshots), outside the published repository. Repeat using `test/classroom-lab-browser.cjs`.

Deployment status will be recorded separately after GitHub publication and live verification; this file alone is not evidence of a live deployment.
