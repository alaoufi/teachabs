# Registration agent demo — stage 031

Based on live 01ee620. No whiteboard source, bundle, catalog or lesson synchronization files changed. Numbered backup 031 was bundle-cloned and git-fsck verified before editing.

Each NEW administrative demo creates one separate registration_agent, mapped explicitly in admin_demo_agents to that synthetic scope. The administrative demo role selector includes the agent, and its page offers return to the same demo supervisor. Existing demos do not silently gain agents: start a new administrative demo. No fixed password, real identity, outgoing email or privileged production account is created.

The mapped synthetic agent may switch back to demo administrative roles for testing; ordinary registered parents, students and unmapped/real agents cannot. Admin roles retain existing scope checks. Supervisor alone grants registration capabilities. Revoking all capabilities hides family records/actions but preserves a safe return control for the mapped demo agent. Server writes continue to deny revoked capabilities, cross-scope targets and forged origins.

End-to-end browser test: choose agent, create synthetic parent, set password through one-use link, activate parent, create/suspend/reactivate child profile, suspend parent and verify old session denial, return to supervisor, revoke manage_status, verify missing action and direct HTTP403. Widths 320/768/1280; Chrome emulation, not physical devices. Full suite: 68 tests passed before final cosmetic adjustment; focused tests and UI repeated afterwards.

Trial storage remains ephemeral SQLite. This does not create a standalone student login, production agent invitation/provisioning workflow, email delivery or durable backups. Activation and password setup are separate: both are required for parent login. Synthetic example.invalid addresses only were used in testing. Code rollback base 01ee620 / deploy dep-dbma8pei0phs73dqjck0; live database backup was not obtained.

## Supervisor invitation workflow — stage 032
The supervisor can now invite a separate registration_agent from /admin/registration-agents, choose its three capabilities explicitly, and renew an unused invitation. The original administrative `registration` department remains read-only and is not silently converted. Invites are hashed in storage, expire after 24 hours and are one-use; renewing invalidates the prior link. Activated agents cannot receive renewed activation links. No email is sent automatically. Synthetic demos require @example.invalid. Production-scope provisioning is supported by the same supervisor-only path but was not exercised with real accounts.

Invited agents are NOT mapped as demo agents and cannot switch to supervisor even when created inside a synthetic demo. New tests cover wrong-role invitations, cross-scope renewal, old/reused-token rejection, login, family/child operations, revocation and audit-token exclusion. UI verifies invitation form → password setup → agent page → parent registration, plus admin denial. All testing used synthetic data. The earlier sentence saying production invitation/provisioning is absent is superseded by this section; independent student login and durable hosting remain absent.

Before this extension, backup 032 was created/restored/fsck-checked at b278427. b278427 was saved to GitHub but not deployed; the live rollback remains 01ee620. No board files changed.
