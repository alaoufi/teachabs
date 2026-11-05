# Subject resources and role-specific assistance

## Implemented locally

The authenticated booking supplies the lesson subject. Existing server rules restrict booking offers to the teacher's assigned subjects, grade and language. The classroom passes that subject to the resource catalog; ordinary lessons show only matching resources. The explicitly labelled preview can browse all starter subjects. The browser filter is presentation, not an authorization boundary: board edits still use server-side lesson membership, time and teacher-granted editing permission. No paid or restricted resource endpoint exists yet.

## Proposed next step — not implemented AI

Keep two separate panels beside the board:

- Teacher assistance: approved subject/grade explanations, alternative examples, misconception prompts and lesson planning. Drafts stay private until the teacher explicitly inserts them into the shared board.
- Student assistance: age-appropriate hints, simplified wording and a request to ask the teacher. Start from a selected approved resource and hint progression, not unrestricted chat. Do not expose teacher-only notes or answer keys.

First implement this as curated local content with no AI provider. Each resource should have a stable ID, subject, grade range, language, role visibility, learning objective, license/provenance, review status and version. The server must filter these fields from authenticated booking and child grade before returning content. Do not infer age from a name or send the child's profile to a provider. Unreviewed or unavailable content must remain labelled and unavailable to students.

Questions, teacher drafts and published board content need separate storage and permissions. Default to no persistent student question history; if history becomes necessary, define purpose, parent controls, retention and deletion before enabling it. Never reuse questions for model training. Shared board publication must be an explicit teacher action for private drafts.

Any future AI requires a separate, specific approval of provider, costs, data fields, retention, region and child privacy terms. No provider, credential, billing commitment or external AI connection has been added. Use a replaceable adapter, redact identifiers, prohibit camera/audio uploads by default, and provide a teacher escalation route. Model output must be clearly labelled, reviewed for factual and age suitability, and must not assign grades or make consequential decisions automatically.

Test student/teacher isolation, subject and grade filtering, revoked enrollment, empty catalogs, RTL, keyboard accessibility, offline behavior, deletion, and unauthorized API access before enabling assistance. Synthetic examples only during development.
