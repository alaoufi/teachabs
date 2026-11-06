# Demo role switcher wrapping 023

Isolated follow-up to published 022 (ec4df8bf43e0367163bdb176de0d16973c497de7). Prior external Chrome QA verified the 021 guide fix, but measured root/body width 405px at viewport 393px with 200% text, both before and after opening that guide. The full-page evidence shows the demo role-switch hint protruding left. The demo summary remained a single non-wrapping flex row above 360px and its hint used white-space:nowrap; the guide itself was contained.

This patch changes only those administration banner layout rules. The summary can wrap at any width; the role description and switch hint wrap at normal word boundaries. Nothing is clipped or hidden to disguise overflow. Native details, form fields, role options, POST target, permissions, font scaling and touch targets remain unchanged. The <=360px pre-existing hint visibility rule remains unchanged. No unmeasured expanded-form layout change is introduced.

The new CSS contract regression failed before the correction and passed after it. Full Node suite: 258/258. HTTP verification confirms the original role-switch action still accepts a synthetic authorized switch and rejects a foreign origin; live/non-demo rendering still omits the banner.

A browser regression script is included for a permitted environment: 320/360/393/768/1280 at 100/130/160/200% text, with summary closed, role form open, and role form plus home guide open. It measures page/element containment, 44px target, and keyboard toggles. It enables the Chromium sandbox, uses synthetic loopback data and blocks external/mutating browser requests. No browser was launched here; rendered confirmation of 023 and actual Android QA remain pending.

No shared Claude/classroom/whiteboard/server/store files, application functionality, data, credentials, deployment, merge, PR or APK were changed. Numbered verified Git bundles preserve rollback points.

Independent static review found no blocker in the summary correction. It also noted that the pre-existing narrow one-column form rule is overridden by a later selector; the open form must be inspected for selected-role readability, not just page overflow. The browser script records select width for that follow-up. This patch intentionally does not claim or introduce an unmeasured form fix.
