# Progressive administration browser review 025

Exact application source: 117f9fa0007d3a70c46aa6fd21361908c85278f9 (020).

This QA-only branch adds a workflow, synthetic fixture, browser runner and this document. It changes no application, main, Android, classroom, database schema, credentials, repository settings, hosting or paid resource. No PR is created.

The workflow runs only on initial branch creation, first attempt, on a standard public GitHub Ubuntu runner with contents:read and no persisted checkout credentials. Chrome remains sandbox-enabled and uses the runner's preinstalled browser. Playwright is pinned to 1.62.0. Runtime records are synthetic and in-memory, served only at loopback; browser requests to other origins are blocked. No public preview URL or KVM is used. Complete fixture model validation runs before the browser; all synthetic records must fit the source's model limits.

Coverage includes progressive path/stage/grade/class selection, descendant reset, class-only membership, active same-grade unassigned candidates, appropriate destination choices, teacher options and server checks, explicit grade/class context, empty/full/archived/unsupported states, Back/Forward/reload/repeated navigation, cancel/close, both enrollment methods, stale and repeated writes, invalid/unauthorized/foreign/origin requests, atomic capacity rejection, and concurrent last-seat HTTP submissions. The full exact-source suite separately includes independent-process race tests.

A 3-page x 3-width (320/360/393) x 2-text-size (100%/160%) matrix captures original screenshots. Increased text multiplies computed HTML fonts and line heights, not CSS zoom or layout dimensions. This browser-only stress test does not validate Android OS font scaling, WebView, native selects, real devices, production login or complete accessibility conformance.

Screenshots must be downloaded from the normal workflow artifact and inspected at their original pixels before any visual pass. A script pass is not visual approval. Artifacts retain for three days; PNG/APK files are not committed as Git blobs. Partial failures report completed and unexecuted coverage honestly. A completed-with-findings report returns a failing workflow exit status deliberately.

QA024 stopped before Chrome because npm ci rejected the pre-existing lockfile (missing optional cross-platform packages). QA025 leaves application and lockfile unchanged and runs the 178 dependency-free administration/school tests. The complete 230-test suite passed locally with the existing dependency installation whose package-lock matched this source. No cloud full-suite pass is claimed.
