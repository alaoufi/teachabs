# Administration and registration integration — stage 028

Isolated merge of admin hub 9626a6c69d109cac251c7828d42293d198cf9e8a and registration c61188164c2f15564ed4db5d40f9593040978d44. Neither source working directory nor the live service was changed. Backup 028 was restored and git-fsck checked before merging.

Preserved registration, saved lessons, replay grants, storage backup, timer, ruler, protractor and 3D source from the existing development branch. Added the admin hub, technical support, licensed-resource metadata catalog, scoped administrative accounts and existing administrative tests. This is a development integration, NOT a release candidate to merge wholesale into main.

Registration overview remains /admin/registration; agent permission management is /admin/registration-agents (GET and POST). Only an active administrative supervisor may list agents or grant permissions. Registration agents remain a separate role and can access only their assigned families. Login, activation and existing sessions honor both account suspension and administrative membership suspension. No real accounts or credentials were created. Existing agent provisioning remains a separate controlled operation; the hub does not yet create registration_agent identities.

Validation: 73 inherited tests passed; new HTTP integration test passed (supervisor grant, finance denial, agent admin denial, stale revisions, suspended admin session). Browser: six pages at 360/768/1280 widths (18 checks), no document overflow; Chrome emulation only, no physical device. Existing saved lesson and registration tests also passed. Generated whiteboard assets were kept from registration development; this merge does not include recovery 8857ed4 and does not solve its reconnect release gate.

No deployment performed. A scoped release must select approved changes and recheck live-data backup/authorization. The free Render filesystem is not durable. Public resource catalog records do not import library assets automatically.
