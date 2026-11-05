# Administration layout stage 033

Presentation-only release based on 1904b56. No database, authorization, board assets or role grants changed.

- Compact shared trial header; mobile navigation opens on demand with keyboard-accessible native details.
- Timetable comes before the collapsible add-slot form and teacher cards. Existing actions and fields retained.
- Permission checkboxes grouped into seven named areas; exact permission keys and checked defaults retained.
- Removed decorative duplicate home introduction; preserved section icons and all functional entries.

Validation: inherited suite 69 passed; Chromium desktop viewport emulation at 320, 500 and 1280 px; no document horizontal overflow on home, education, account creation or technical screens. Browser tests saved one synthetic appointment at each width, verified mobile navigation targets >=44px and font >=14px, permission keys/defaults unchanged, and finance receives 403 for education. No physical phone tested.

Same local browser/data measurements: at 500 px timetable heading moved from 1829.95 to 553 px; education heading from 680 to 396 px. At 320 px timetable from 2237.75 to 619.20 px; at 1280 from 1505.45 to 449.875 px. These are layout coordinates, not load-time benchmarks.

Rollback: 1904b56c5f6b821ba2dc887752b4075108ae60c9. Local numbered backup 033 contains a pre-change Git bundle and verified restored checkout. Trial SQLite remains ephemeral; this code backup does not constitute a backup of the live database. No live data export or durable storage was configured.
