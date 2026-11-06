# Administration 014: mobile readability review candidate

## Confirmed defect
The user's Android screenshot of preview 013 showed a class title split inside Arabic words into several lines. The title, icon and state badge shared one flex row. `min-width:0` plus `overflow-wrap:anywhere` let the badge squeeze the title almost to zero. Browser responsiveness and static checks did not replace Android runtime review; the 013 APK was not Android visually approved before delivery.

## Corrective scope
- Class and agent cards now give the title its own grid cell and the state badge a separate row.
- Heading wrapping uses natural word boundaries, with break-word only as fallback for an overlong unbroken token.
- Mobile account/student/schedule/financial records move amounts, state and action groups below the title.
- Task, support, library and audit cards use consistent mobile heading sizes and spacing. Nested school card padding is reduced.
- Small mobile hubs use two columns to leave enough width for Arabic labels at larger font scales.
- Inputs retain 16px text, labels remain visible, controls retain at least 44px targets, and no native textZoom/default-font/initial-scale override disables accessibility settings.
- No classroom/whiteboard, shared routing, database or existing Android project change.

## Native Android review tool
`admin-preview-android/review-emulator.ps1` uses the official Android SDK Emulator and adb against an explicitly selected disposable emulator. It refuses physical devices. It verifies the actual APK's packaged source revision, clean-state flag and every asset hash, then navigates all 19 packaged administration pages at widths 320/360/393 and font scales 100/130/160 percent. A 200-percent setting is also supported. It records API/WebView details and screenshots, then restores the emulator's original size, density and font scale in `finally`.

The app's `preview_route` test extra can only select an allowlisted packaged administration page. It cannot select a remote URL, access files or enable JavaScript/networking. App identity and offline protections are unchanged. Candidate version is `0.1.4-review` (14).

Example after building from the saved candidate commit:

```
powershell -File admin-preview-android/review-emulator.ps1 -Serial emulator-5554 -ExpectedRevision <verified-40-character-commit>
```

Use the actual connected emulator serial. For a quick reproduction, add `-Routes /admin/school`; this is not all-page approval. The full matrix produces capture evidence, not an automatic visual pass. Review the title, badge position, word wrapping, clipping, spacing and scrolling in the screenshots. Verify help/disclosure, navigation/Back and disabled saving inside the running Android app. Do not change the user's real device's font settings.

## Supporting browser checks
`test/admin-mobile-review.cjs` renders all 19 packaged pages at 320/360/393 and simulates 100/130/160-percent text stress. It checks horizontal overflow, broken class-title words, and title/badge overlap. This browser stress test is explicitly not Android approval.

## Release gate and remaining evidence
The review candidate must not be delivered as a corrected APK until the actual Android app has been run, its screenshots reviewed, and the defect plus all administration pages checked. If no Android runtime is available, report that blocker rather than substituting desktop browser checks. Any third-party emulator upload needs authorization before sharing the APK.

Before/after numbered source bundles are retained. The GitHub review source can be saved and used by the isolated desktop task without merging, opening a PR, deploying or replacing Claude's work. Code backups do not contain live hosting data.
