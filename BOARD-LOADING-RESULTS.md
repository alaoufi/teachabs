# Board loading — local stage 018

Baseline local HEAD 0c9d742; tested Chrome headless with fresh browser context, synthetic in-memory database, localhost, then reload. Resource Timing totals below cover /board-assets/ resources, not all HTML/API requests. One run per measurement; not a statistically controlled latency benchmark.

| Metric | Before | After final |
|---|---:|---:|
| Initial encoded asset bytes | 2,936,612 | 528,759 |
| Initial decoded bytes | 2,936,612 | 1,619,187 |
| Reload reported transfer bytes | 2,941,412 | 600 |
| Script-observed board-ready interval (includes fixed 500ms settling) | 1,110ms | 1,163ms |

Initial transferred bytes reduced about 82%. Local ready time did not improve; do not claim a measured end-user latency gain. No real phone, throttled mobile network, or cold Render wake-up was tested. Current live service was not changed. These changes cannot remove free-service wake-up delays.

## Changes

- Brotli/gzip negotiation for large JS/CSS, with bounded in-process compressed-response cache and representation-specific SHA-256 ETags.
- Entry files and fixed-name assets always revalidate (public, no-cache); 304 only when current bytes and encoding match. Changed bytes produce a new ETag and 200. No five-minute caching of unversioned client JS.
- Only build-generated hashed chunks/assets receive one-year immutable cache policy. Entry JS/CSS stays revalidated and points to new chunk names after rebuild. Existing hashed artifacts were retained for in-flight old pages.
- MathLive/KaTeX/html2canvas code loads only after explicitly opening the equation tool. The rest of the board remains usable if this optional load fails. After failed module import, browser caching requires page reload; retry refuses reload while edits are pending or conflicted.
- A small board loader displays progress and a retry button before the main bundle finishes. SSE is created only after the module is loaded, avoiding loss of the initial board snapshot.

## Verification

30 automated tests passed, including compression round-trip, q=0 negotiation, encoding-specific ETags, 304, changed-content invalidation, persistence, authorization and SSE. Local Chrome at 360px verified two-seat draft/publish/hide, offline/reconnect, cancel/confirm clear. Failure injection verified initial bundle retry, optional math failure retaining the board, reload retry and equation insertion. The final mobile screenshot was inspected.

Private workspace evidence: loading-before.json, loading-after-final.json, loading-mobile-sync-results.json, loading-retry-results.json and loading-math-mobile.png. No user data in these synthetic checks. Numbered code backup 018 and rollback-018-before-board-loading retained. Do not deploy until current trial data is checked and deployment authorized; local branch includes additional unpublished storage/admin work that must not be accidentally shipped as a loading-only update.

Measurement clarification: both initial totals use Resource Timing encodedBodySize, with the same route/scenario and a fresh empty browser cache. Baseline server sent identity bytes, while the new server negotiated compression. The resource graphs intentionally differ because math tools are deferred (16 resources before, 17 after); this is the combined change to initial loading, not an isolated compression comparison or a fixed-file-set benchmark. Decoded totals are listed separately. Reload transferSize is a separate warm-cache measurement. Figures apply to loading revision 7695b26, before the later timer addition.
