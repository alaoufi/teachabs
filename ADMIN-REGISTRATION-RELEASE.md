# Scoped administration and registration release — stage 030

Based on 9626a6c, directly descending from live 64282c1. Ports the tested administration/registration behavior from integration ee0f1fc without its unpublished whiteboard ancestry. Board source, catalog and generated entry bundle match 64282c1 exactly. Recovery, saved pages, 3D, library samples 57abe92 and new preparation behavior are NOT included.

Includes scoped administrative hub and technical support, supervisor permission control, registration-agent family registration/activation/suspension and server-side role restrictions. Agent account provisioning remains a controlled setup gap: no production registration-agent identity is created, and no default passwords exist. The agent permission page is available to supervisors but can be empty until an agent is provisioned. Library catalog is metadata only.

67 automated tests passed including registration, admin scope, suspended accounts, stale grants, HTTP origin checks, classroom permissions and existing board tools. Scoped UI browser tests cover 360/768/1280 widths. No physical phone or cross-network calling claim.

Backup 030 retains the integrated source before release preparation; live rollback commit 64282c1 and deployment dep-dbm913l6e07s73bh0vag. A fresh release bundle is retained separately. Database migrations are additive and preserve existing rows in synthetic migration tests. Render remains free/ephemeral: no live database export could be obtained through current access, and code rollback cannot recover data lost on redeploy. Deployment authorization relies on the current delegated user instruction to publish tested stages and previously stated absence of user-entered trial data, not a claim of live backup.
