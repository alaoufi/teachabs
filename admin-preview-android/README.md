# Administration offline design preview 013

This is a **read-only design preview**, not a connected administrative app. It has 19 synthetic screens from the administration branch, including the compact floating hub, fields, classroom-record cards, permissions and agents. Every screen states that it is a preview with no saving and no server connection. Inputs and action buttons are disabled. Navigation, scrolling, native details/help disclosures and Android Back work.

## Isolation
- Separate Android application ID: `app.teachabs.adminpreview`.
- App label: `الإدارة · معاينة`; version `0.1.3-preview` (13).
- No Android permissions, including no INTERNET permission. No account, location, storage, camera or microphone access.
- WebView disables JavaScript, file/content access, DOM storage, form storage, cookies and network loads. It serves GET requests only from a fixed exact allowlist of packaged assets at a reserved `.invalid` origin. That name is not a live service and is never fetched.
- The generator opens only `:memory:` with synthetic demo records. It removes hidden tokens/fields, replaces forms with non-submitting groups, disables action buttons and fields, and replaces non-packaged links with disabled text.
- No real database, credentials, session, activation links or deployment URLs are included.
- The existing `android/`, classroom and whiteboard sources are not modified. The existing Gradle wrapper is used only as a build launcher for this separate project.
- Release builds are disabled. Debug signing uses the standard local Android debug key, which must never be committed.

## Build on the isolated checkout
Requires Node 24+, JDK 17+ and Android SDK platform/build tools 34. Set `ANDROID_HOME` or create an untracked `admin-preview-android/local.properties` with `sdk.dir`. Do not accept new SDK agreements silently; use already available approved tools or ask when required.

From the repository root on Windows:

```
node --test test/admin-preview.test.mjs
.\android\gradlew.bat -p admin-preview-android --no-daemon assembleDebug
```

On Linux/macOS:

```
node --test test/admin-preview.test.mjs
bash android/gradlew -p admin-preview-android --no-daemon assembleDebug
```

`preBuild` generates the assets from the checked-out source before packaging. Output:
`admin-preview-android/app/build/outputs/apk/debug/app-debug.apk`.

Before delivery, verify the APK signature, application ID, version, absence of permissions, and SHA-256. Inspect the packaged `preview-manifest.json`; its `sourceRevision` must be the expected checkout, `sourceDirty` must be false, and its files' hashes must match. Test the APK on a device/emulator if one is available, in airplane mode, checking all hub sections, help, Back, scrolling, disabled saves and absence of outgoing network. If not available, report that install/runtime testing is still unverified.

## Source verification so far
- Node generation/security tests pass. The full suite is recorded in the stage 013 handoff.
- Independent review checked synthetic-only generation, allowed routes, disabled actions, network restrictions and separate app identity.
- The source author environment has no Android SDK/compiler, so no APK build or Android runtime success is claimed until the isolated desktop build verifies them.
- Browser QA passed the parent administration version 012 at 320/390/768/1280. This iteration additionally balances the last four mobile tiles into two rows of two and clarifies “التعليم” in the guide; recheck those changes visually.

## Numbered recovery
Base: `23b68b198e37c33170dc066f04920f70a943ca9b` (administration 012). Changes are confined to this standalone preview directory, a preview test, and a small administration view/CSS refinement. No PR, merge, Render operation or production deployment is part of this package. Preview assets/builds are generated and ignored by Git; the complete generator and build source are retained on the administration branch.
