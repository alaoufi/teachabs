# Administration 012: compact floating hub

## Implemented
- One raised compact container replaces the repeated sidebar and section menu on the administration home page. Content pages keep their navigation.
- Short section titles sit under floating circular or rounded-square marks, with stable blue, green and amber identities. The full accessible name starts with the visible title.
- Five columns on wide screens, four on tablet, three on mobile. All navigation cards remain larger than touch targets.
- Smaller masthead and a collapsed demo role selector put the sections closer to the top. The temporary/synthetic-data notice remains visible.
- Addition fields have smaller gaps, clear labels, 44-pixel minimum controls and 16-pixel input text. School setup uses the same raised section workspace, with compact form cards.
- Stage 011 already prevents unavailable class assignment forms from appearing.

## Verification
- Automated Node suite: 114/114 passing.
- Independent source review found an outdated layout assertion and accessible names missing abbreviated visible labels. Both were corrected and covered by tests.
- `test/admin-compact-browser.cjs` is ready to check widths 320/390/768/1280, early first-card position, floating marks, keyboard guide, touch sizes, form saves and screenshots.
- Browser visual approval is pending the isolated desktop task. No visual pass is claimed here.

## Scope and recovery
Only administration view/style files, tests and this document changed from 011 (133de0a70eccb14e5fd1fc3b506f0f6872ca63d9). No shared routing, classroom/whiteboard, Android, credentials or real data changed. The numbered 012 code backup includes a verified before bundle and will include the published after bundle. Code backups do not back up live Render data.

No PR, merge or deployment was performed. Main/Claude integration and Render data protection remain separate preconditions for deployment. The class lifecycle rollback caveat in ADMIN-LIFECYCLE-011.md still applies.

## APK inspection
The existing Android app is a WebView for a server origin; it does not embed Node or SQLite. Its default debug URL is localhost:4817 and does not work on a disconnected phone without a separately running server and USB forwarding. Pointing it at the current live site would not deliver this branch. A separate offline design-preview APK can show synthetic static administration pages, explicitly without real saves or network access. It must use a separate application ID and must not replace the shared Android project. A functional connected APK needs a verified safe deployment of the server first.
