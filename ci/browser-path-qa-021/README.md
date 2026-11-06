# Synthetic path/stage browser QA 021

This isolated QA commit adds only this fixture, browser test, README and its
workflow to exact application source `382c3e3ecde73bdbcf4a19fc6b683b608674ae17`.
It reuses the successful 020 workflow safeguards from
`9bb7989a283d330baa97ff99a728ed6a6aabde4e`, but does not reuse its 6671f61 pass
as evidence for this source revision.

The actual createApp server uses a synthetic :memory: SQLite database and
binds only to 127.0.0.1:4826. The fixture injects a synthetic supervisor; no
production authentication is tested. A loopback-only read endpoint exposes
synthetic state for mutation checks. Never expose this fixture publicly or
connect it to real data. The server is terminated when testing ends.

The single initial branch-creation job uses a standard public GitHub-hosted
Ubuntu 24.04 runner, contents:read, no secrets, no persisted credentials,
immutable official action pins, official Node 24, and pinned Playwright
1.62.0 in a temporary venv. Chrome must already be installed. Only run attempt
one on creation of codex/admin-browser-path-qa-021 may execute; no schedule,
automatic retries, larger paid runner, public preview or deployment exists.
QA_OUTPUT_DIR is initialized from shell RUNNER_TEMP inside a step/GITHUB_ENV.
Artifacts are retained for three days.

Chromium's sandbox remains enabled. Failure to launch stops the review;
there is no no-sandbox flag, permission/security change, KVM or replacement
browser. Browser HOME/XDG paths are temporary. Page requests outside the
loopback app are blocked. Tool installation and GitHub artifact transfer
use normal registry/service endpoints.

## Coverage

- Sequential saved path -> fixed stage -> fixed grade -> classes.
- Three stage choices; six primary and three middle/secondary grade choices.
- Read-only navigation, repeated submission and history preserve school and
  audit data, verified with a synthetic state fingerprint.
- Context-only classes; empty and waiting-registration states, no incompatible
  assignment controls; new path and selected-grade class creation.
- Class rename/capacity updates retain context; legacy individual-assignment
  link and back link retain the grade; malformed requests do not mutate data.
- Keyboard disclosures, RTL layout, viewport/full screenshots at mobile
  widths 320/393 and desktop 768/1280, and page-overflow measurements.

JSON reports distinguish passed checks, failures and stopped runs; partial
screenshots are not a pass. Screenshots require human/agent visual inspection.
This is Chromium viewport testing, not Android/WebView, full accessibility,
performance, production authentication or a security audit. App code is not
changed, and browser success does not authorize deployment.
