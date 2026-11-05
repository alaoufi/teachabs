# Registration agent demo — stage 031

Based on live 01ee620. No whiteboard source, bundle, catalog or lesson synchronization files changed. Numbered backup 031 was bundle-cloned and git-fsck verified before editing.

Each NEW administrative demo creates one separate registration_agent, mapped explicitly in admin_demo_agents to that synthetic scope. The administrative demo role selector includes the agent, and its page offers return to the same demo supervisor. Existing demos do not silently gain agents: start a new administrative demo. No fixed password, real identity, outgoing email or privileged production account is created.

The mapped synthetic agent may switch back to demo administrative roles for testing; ordinary registered parents, students and unmapped/real agents cannot. Admin roles retain existing scope checks. Supervisor alone grants registration capabilities. Revoking all capabilities hides family records/actions but preserves a safe return control for the mapped demo agent. Server writes continue to deny revoked capabilities, cross-scope targets and forged origins.

End-to-end browser test: choose agent, create synthetic parent, set password through one-use link, activate parent, create/suspend/reactivate child profile, suspend parent and verify old session denial, return to supervisor, revoke manage_status, verify missing action and direct HTTP403. Widths 320/768/1280; Chrome emulation, not physical devices. Full suite: 68 tests passed before final cosmetic adjustment; focused tests and UI repeated afterwards.

Trial storage remains ephemeral SQLite. This does not create a standalone student login, production agent invitation/provisioning workflow, email delivery or durable backups. Activation and password setup are separate: both are required for parent login. Synthetic example.invalid addresses only were used in testing. Code rollback base 01ee620 / deploy dep-dbma8pei0phs73dqjck0; live database backup was not obtained.
