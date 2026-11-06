# Synthetic browser QA 020

This isolated test commit adds no application changes to
`6671f61bc13eba5e842904227d08ea7faf4cb810`. It exercises the new
teacher-to-student administration flow through the actual `createApp` server
and a fresh `:memory:` SQLite store.

The fixture injects one synthetic supervisor session into requests on
`127.0.0.1:4826`. It must never be exposed publicly or connected to real data.
It does not test production authentication. All identities use synthetic
names and `.invalid` email addresses; no credentials or production URLs are
needed. The server is stopped after the test.

The workflow uses a standard GitHub-hosted Ubuntu 24.04 runner in this public
repository, not a larger paid runner. It has read-only repository permission,
no persisted checkout credential, and no repository secrets. Official actions
are pinned to immutable commits. Node 24 is provided by the official setup
action; Playwright 1.62.0 is installed from PyPI into a temporary virtual
environment. The browser must already be installed on the runner.

Only the initial creation of `codex/admin-browser-qa-020`, at run attempt one,
can execute the single job. There are no scheduled runs or automatic retries.
The job is limited to 15 minutes. Screenshots and reports expire after three
days; this source remains in Git.

Chromium launches with `chromium_sandbox=True`. The test never uses
`--no-sandbox`, modifies OS security settings, changes permissions, accesses
KVM, or installs a replacement browser. A launch restriction is reported and
stops the test. Runtime HOME/XDG directories are temporary. Page requests
outside the loopback app are blocked. Tool installation and GitHub artifact
transfer use their normal registry/service endpoints; no public app endpoint
is created.

## Coverage

- Initial screen and keyboard-operated assignment guide.
- Path/grade, subject, and teacher selection.
- Roster screenshots at widths 320, 360, 393, and 1280 CSS pixels, plus page
  overflow measurements. These are browser viewports, not Android devices.
- Existing class assignment disabled with its teacher/source explanation.
- Individual and two-student batch assignment, explicit direct-link removal,
  preservation of other links, and selectable state after removal.
- Forged conflicting selection rejected through a loopback HTTP request.
- Subject changes clear the teacher and student selection; another subject
  remains available. Back/Forward behavior is checked.

The JSON report distinguishes completed checks from a stopped run and retains
partial screenshots. Any failed check or browser launch returns a nonzero
exit status. Layout assertions supplement visual review; screenshots still
need to be inspected by a reviewer. No successful build or browser test is
Android WebView/native validation or approval for deployment.

For a separately authorized local run with Node 24, Playwright 1.62.0 and an
already installed browser:

```sh
export QA_OUTPUT_DIR="$(mktemp -d)"
export QA_BROWSER_PATH="$(command -v google-chrome || command -v chromium)"
python ci/browser-qa-020/review_browser.py
```

## Corrected registration

The first 019 workflow registration failed validation before allocating a job
or launching a browser: job-level environment values cannot use the runner
context. This 020 attempt initializes the output directory from the shell
`$RUNNER_TEMP` inside a step and exports it with `GITHUB_ENV`. It retains the
same one-run limits and browser safety settings.
