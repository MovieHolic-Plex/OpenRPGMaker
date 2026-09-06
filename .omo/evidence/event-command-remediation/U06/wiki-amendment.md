# Proposed amendment for openwiki/editor-event-command-fixes.md

## Follower removal and graphic intent (2026-09-06, U06)

- `removeFollowerBody` emits `all:true` only from the explicit all mode. Empty/whitespace individual names remain incomplete; its `data-command-form-validity` / `event-command-validate` listener uses the U02 Confirm host contract to reject and focus the name input. Typing or changing mode clears native validity feedback. Names are trimmed on commit; explicit all retains the existing actor-only removal contract and preserves monster followers/party/instances.
- `addFollowerBody` uses the live custom-graphic checkbox as the sole enable authority. Off removes the saved `graphic` property; mounted inactive controls survive off/name edit/on. Editing graphic fields retains unrelated authored graphic fields such as `scale`; clearing the sprite ID still removes that sprite reference. Cancel never persists the draft.
- Runtime appearance remains deliberately unchanged: an actor ID resolves its actor-default graphic; a graphic-only follower executes the saved custom graphic. U06 does not claim or implement actor custom override.
- Regression evidence: `test/eventCommandRemediation/U06.test.ts`, `test/e2e/event-command-remediation-U06.spec.ts`, `scripts/qa/runtime/event-command-remediation-u06.scenario.mjs`. Real Firefox map Confirm/Apply/reopen/Cancel, downloaded `.oprn` export/import, standalone player seven-beat exact follower proof. Geometry1024x768/1280x800/1440x900. Images were omitted by the available reader; no pixel verdict claimed.
- Shared wiki integration belongs to the lead. Final merge order remains U05 then U06; U06 production changes touch only addFollowerBody/removeFollowerBody, not imports or shared helpers.
