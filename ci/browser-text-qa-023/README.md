# Browser text review 023

Exact application source: 25e11ce2e33aef92fbeb20eb3c6b6933278f90ac.

This isolated QA branch adds only its workflow, fixture, runner, and this document. It does not change the application, Android app, classroom, main branch, production data, security permissions, or signing credentials.

The workflow runs once on initial creation, on a standard public-repository Ubuntu runner. Chrome keeps its sandbox enabled. Playwright is pinned, uses the preinstalled browser, and blocks external page requests. The real application renders synthetic in-memory records through loopback only. No public preview URL or KVM is used.

The school and individual-assignment pages are reviewed at widths 320, 360, and 393 pixels, with 100%, 130%, and 160% text. Text enlargement snapshots computed font sizes and numeric line heights for HTML elements and multiplies those values. Layout dimensions are not zoomed. This is a browser-only text stress test, not Android OS font scaling, WebView, production login, or complete accessibility validation.

Native single-line select values can still be clipped. The intended repair is a numbered, keyboard-expandable reference containing each full name. Tests verify option/reference correspondence, labels, text wrapping, layout overflow, guide SVG icons, keyboard interaction, unchanged form IDs, and no mutations during reading. Original full-page and detail screenshots and computed font sizes are saved for manual visual review. A scripted pass is not by itself a visual pass.

Artifacts are retained for three days. Read browser-report.json for actual coverage. Any planned case absent after an error was not run. Screenshots and APKs are not committed to this public repository by this workflow.

The preceding QA022 run stopped before browser launch because a synthetic student name exceeded the application limit. QA023 shortens only that fixture name and adds a complete fixture-model preflight. HTML root font size remains unchanged so rem-based non-text layout is not enlarged.
