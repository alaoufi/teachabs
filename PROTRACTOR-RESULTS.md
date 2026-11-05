# Original instructional protractor — stage 021

Project-authored vector diagram with 0–180 degree ticks, two rays and a numeric reading. Available through the server-scoped resource catalog only in the synthetic grade-four math angles lesson; not claimed as an official curriculum assignment. No imported artwork, external provider or new dependency. Existing Excalidraw MIT notices are retained.

Touch controls move the last protractor, rotate its whole group by 15 degrees, and change the constructed angle in 5-degree increments within 0–180. A reading outside the canvas improves mobile legibility; the scene also contains its angle label. Native undo history captures these changes. Teacher editing and student private-draft permission use the existing server checks; shared student editing is not enabled.

This demonstrates a constructed angle. It is not a calibrated instrument for measuring arbitrary external objects. Free-form edits or ungrouping can alter the diagram; do not claim scientific measurement accuracy. Angle units are degrees; tested geometry keeps the base and movable ray at the same vertex through the provided transforms. Group IDs and role-specific element IDs are preserved on insertion because the controls depend on them.

35 automated tests passed, including constructed angles 0, 30, 45, 90, 135 and 180 degrees, common-vertex invariance after group rotation/translation, scene validation and student denial. Local Chrome with 360px touch emulation verified touch-button movement, rotation, undo, 95-degree adjustment, teacher/student SSE synchronization, reload persistence and lesson isolation/restoration. Screenshot inspected. No physical phone, free-touch drag calibration or live Render test. This remains local and unpublished.

Backup 021 and rollback-021-before-protractor retained and restore-checked. Evidence in private workspace: protractor-ui-results.json and protractor-mobile.png. These contain synthetic work only.
