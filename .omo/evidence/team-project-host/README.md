# Team host visual evidence — 2026-09-18

Captured with `node scripts/qa/team-host-shots.mjs` against a temporary empty project folder. No live content or access secrets are captured.

- 01-sign-in.png: anonymous team entry.
- 02-team-management.png: owner membership and invite management at 1280×800.
- 04-team-mobile.png: responsive team management at 390px.

App TypeScript check, Electron bundle and packaged renderer build passed before integrating main; app check and packaged build repeated after integration. Existing circular-chunk/large-bundle and Electron import.meta warnings remain.

Team service and HTTP tests were authored but not run: AGENTS.md forbids test runners without an explicit request. Native Electron menu hosting was inspected/built, not exercised in a live desktop session. This provides project-host collaboration with map leases and optimistic record merging, not concurrent editing within one map or offline merging.
