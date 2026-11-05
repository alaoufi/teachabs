# Local 3D foundation — stage 022

A real WebGL 3D panel is available alongside the whiteboard in one synthetic mathematics solids lesson. It contains an original cube and square-based pyramid, not a skull/brain or an anatomy lesson. No model files, textures, third-party library, external CDN or telemetry were added. Browser WebGL is used directly. The renderer is lazy-loaded, draws only when state/size changes (no continuous animation loop), caps backing resolution at 960px and pixel ratio at 1.5, and disposes GPU resources on unmount.

The teacher controls rotation, zoom and selected part; students view the synchronized result but cannot change the shared model, even when draft drawing is allowed. Arabic part buttons highlight/dim model components. Selection is via buttons, not geometric ray-picking. Pointer drag offers local preview and sends its final state on release; explicit touch buttons are the tested path. Server commands whitelist the model/parts, bound rotations/zoom, enforce teacher/lesson access and board revisions, and discard extra input. Arbitrary model URLs/uploads are not accepted.

Model state is stored with the booking board and archived/restored per lesson. Inactive lesson archives are not broadcast. Entering saved template pages hides the 3D state and closing restores it; 3D changes during saved-page presentation are denied. Current teacher template/PNG exports do NOT include the 3D viewer, as disclosed in the UI. Database backups include the state. Render remains temporary storage; no durability is implied.

When WebGL is unavailable or the context is lost, a text alternative describes the two solids and preserves the selected state. Context restoration attempts renderer reinitialization. The fallback was tested by disabling WebGL; actual device GPU loss/recovery was not tested. No real phone or network performance/load benchmark was run.

36 automated tests passed, including authorization, invalid model URLs/values, lesson/page isolation and database reopen. Local Chrome with software WebGL and a 360px touch viewport verified part selection, rotation/zoom SSE delivery, disabled student controls, reload, lesson return, fallback and zero external requests. Screenshots inspected; depth ordering was corrected following visual inspection. Free touch drag was not independently validated. Evidence: model3d-ui-results.json, model3d-mobile.png.

## Extending to licensed scientific models

The current renderer supports only its built-in procedural demo, not general glTF imports. Before adding a real model: verify authoritative source, exact asset/version license and attribution, scientific/educational review, separate part identifiers, Arabic labels and age suitability. Record these in a versioned catalog (demo contract: model3d-catalog.json). A future renderer adapter should support only reviewed local assets, bounded geometry/texture budgets, no remote dependencies and safe loading. Preserve versioned per-lesson state and migration/export behavior before replacing an adapter. Do not describe a generic geometric demo as anatomy or promise lossless portability without tests.

Backup 022 and rollback-022-before-3d-viewer retained and restore-checked. No deployment, new hosted resource, credential, payment or real student data transfer occurred.
