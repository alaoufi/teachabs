# Board aids release candidate

Based directly on live c9c84eb. Adds only original ruler/protractor lessons and vector helpers, touch controls and scoped tool layout. No registration-agent, administration, saved-page, storage migration or 3D feature is included.

Ruler units are relative, not physical centimeters. Protractor demonstrates a constructed 0–180 degree angle, not calibrated measurement of external objects. Both are synthetic grade-four math lessons, not asserted official curriculum placement. Existing server lesson/subject/grade gate and teacher/student draft permissions apply.

Validation: 29 automated tests passed. Isolated Chrome at 360px/320px verified touch-button movement/rotation, undo synchronized to student, angle change/readout, reload and lesson return/isolation. No page overflow at 320px or simulated root font size 200%. An overflowing workspace select was constrained; full selected lesson title is shown separately. Browser screenshots reviewed. No actual phone or freehand-touch-drag claim.

Backup 025 and rollback-025-before-board-aids verified. Current live SQLite data cannot be read or exported through the available Render connector or app endpoints. Current-data confirmation is pending before redeploy; do not treat earlier loss approval as indefinite. This branch is saved for review, not yet deployed.
