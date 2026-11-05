# Original measurement ruler — stage 020

Implemented an original grouped vector ruler (24 native Excalidraw elements, 0–10 relative divisions) in the synthetic grade-four math measurement lesson only. This is not an official Saudi curriculum assignment and the markings are NOT physical centimeters. No external assets, providers or dependencies were added; existing Excalidraw MIT notices remain.

Server-provided catalog resources expose the ruler only for the assigned measurement lesson. Other subject/grade contexts cannot select that lesson. Free-form drawing/import remains a general board capability; this does not attempt to classify or censor user-drawn geometry. Teacher edits the shared board; an authorized student uses the private draft under existing server-enforced permissions and teacher publication control.

Native grouping preserves editability. Explicit touch-friendly buttons move the last ruler right/left and rotate it 15 degrees around its body center; other scene elements remain unchanged. Changes and insertion are captured in native undo history. These controls act on the last ruler in the current editable scene, not a different user's shared view. The full scene/angle/group data is saved through the existing versioned board protocol.

Verification: 34 automated tests passed. Local Chrome emulating 360px touch input verified insertion, teacher/student SSE synchronization, touch-button movement and rotation, undo reflected at the student, reload persistence, lesson switching without mixing work and restoration. Mobile screenshot inspected. A free touch-drag attempt opened a context menu rather than moving the ruler; therefore free touch dragging/rotation handles are NOT reported as verified. Touch buttons are the verified fallback. No physical phone tested.

Private workspace evidence: ruler-ui-results.json and ruler-mobile.png. Backup 020 and rollback-020-before-ruler restored/checked. No deployment occurred. This branch contains earlier unpublished changes and must not be pushed wholesale as a ruler-only update without release review and current data authorization.
