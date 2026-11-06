# School path, stage and grade selector 018

The requested administration flow is: choose an existing path or create a new one; select one of the fixed primary/middle/secondary stages; select a fixed grade in that stage; add classes; assign teachers by subject while retaining student-subject conflict protections.

Implementation stays server-rendered and administration-only. Selecting a path/stage reloads the fixed grade choices; selecting a grade displays its classes. Creation uses the selected context and the existing server catalog/capacity checks. New paths return to their own selector. The existing class, student and direct teacher assignment boundaries remain unchanged. New stages/path structures still require shared registration integration before assignments can become operational.

The fixed source of truth remains school-catalog.mjs: primary grades 1–6, middle 1–3 and secondary 1–3. No stage/grade editor or arbitrary value is introduced. The route validates scope and selector values; creation rejects ambiguous old/new context fields and invalid fixed combinations. Permission-specific create/assign controls remain hidden and independently enforced by existing model APIs.

Verification plan: red/green tests for all three fixed stage lists, stage-specific grade lists, path creation redirects, selected-class filtering, scoped invalid selectors, forged/ambiguous create requests, permissions and unchanged unsupported assignment guards. Re-run existing tests and update only administration browser workflow selectors to match the new sequence. No browser/Android pass is claimed unless separately run.

Branch 018 starts from verified 016 SHA6671f61bc13eba5e842904227d08ea7faf4cb810 in a separate worktree. Preparation 017 is independent and not mixed into this UI checkpoint. Source bundles are not live database backups; no shared classroom/server/store/registration files or production data will change.

## Verified checkpoint
- 187/187 Node tests passed on final source, including six new selector/navigation tests and all prior assignment, permission, migration and race coverage.
- Independent source review found no blocking defect; 41 targeted tests and extra invalid/duplicate-create probes passed.
- Class rename/capacity/assignment returns and the individual-assignment back link retain the exact path, stage and grade. Read-only navigation does not create school rows.
- Existing combined levelKey/gradeId API clients remain supported; mixing them with new stage/grade fields is rejected. The class-teacher dropdown still relies on server specialty/grade validation, while individual assignment filters eligible teachers.
- Administration browser scripts were updated and syntax-checked, not executed. Browser/native Android review remains required before release. No screenshot, Android pass, deployment, PR or production migration is claimed.
