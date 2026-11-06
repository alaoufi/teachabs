# Home guide wrapping 021

Isolated follow-up to published 020 (117f9fa0007d3a70c46aa6fd21361908c85278f9). The supplied Chrome screenshot at viewport 320 and text 160% showed the open home guide compressed into an approximately 116px column. Existing CSS overrode the earlier mobile column layout with a non-wrapping row, gave open details a shrinking 50% basis, and capped the guide at 270px.

The home header now wraps. Its title can shrink naturally; closed guide controls remain compact. Open details take a non-shrinking full-width line below the title, with ordinary word wrapping. The original native details/summary, accessible name, decorative SVG, typography, zoom support and touch-target rules remain unchanged. The fix is scoped to the administration home header. No school flow, permissions, shared Claude files, live data or APK was changed.

Verification: the new source-layout regression failed before the CSS correction and passed after it. Full Node suite: 232/232. These tests validate CSS contracts and disclosure markup, not rendered layout. A separate browser regression script covers 320/360/393/768/1280 at 100/160/200% text, full-width open content, no horizontal overflow, keyboard open/close and repeated toggles. It is provided for a permitted browser environment and was not run in this worktree. Browser confirmation of this correction and actual Android verification remain pending.

Numbered Git bundles retain pre-change, local and fetched-published rollback points. No merge, pull request, deployment or APK release is part of this checkpoint.
