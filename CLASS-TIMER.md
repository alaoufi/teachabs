# Original class timer — local stage 019

A project-authored timer accompanies the board; no third-party service/assets or student data transfer. The teacher starts a duration (UI 1–60 minutes), pauses, resumes or cancels; students see the display only. Server authorization and revision checks reject student commands and stale writes. The server stores the end timestamp/paused remainder in the booking board, so reconnect/reopen restores the state. The client uses the server timestamp to reduce device-clock offset; network latency can still cause subsecond/second discrepancies. This is a visual aid, not precision timing or attendance enforcement.

Timer belongs to the class, independent of lesson/page changes. Expiry shows zero without ending a lesson, clearing work, sending audio or changing permissions. Changing timer state increments the board revision; an overlapping stale scene command is rejected by the existing conflict mechanism, with export/reload required. No claim of conflict-free simultaneous editing.

32 automated tests passed, including bounds, teacher-only control, pause/resume/expiry and SQLite reopen. Two local Chrome windows at 360px verified start/pause/resume/cancel synchronization, student absence of controls, paused-state reload and no horizontal overflow. Screenshot inspected. No real phone or live Render change.

Backup 019 and rollback-019-before-class-timer retained and restore-checked. Ruler/protractor and 3D instructional models are not implemented by this stage. Existing provider examples were inspiration only; no copied content or assets.
