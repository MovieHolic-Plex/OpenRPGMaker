# startup-idle

Read-only audit at `d7a3f0136e`: **two strong findings**, both **code hypothesis**; no latency measurements claimed.

1. **Electron bypasses the shared-catalog cache on every editor launch.**
   - Trigger: reopen an unchanged project in native Electron.
   - Location: [protocols.ts:64](/home/main/.codex/worktrees/e85c/rpg-zzu/electron/main/protocols.ts:64), [sharedContent.ts:92](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/sharedContent.ts:92).
   - Heavy path: handler omits `If-None-Match` and response `ETag`; defaults and rest therefore receive full bodies. Each response synchronously runs `gunzipSync` plus a byte-array copy in Electron’s main process; renderer parses the full JSON. Work is O(response bytes).
   - Safeguards: server caches compressed bodies, but native responses cannot populate/use the renderer’s ETag cache. HTTP middleware **does** handle ETags, so dev-server measurements can miss this production/Electron defect.
   - Narrow remedy: forward the request validator, return ETag, and handle 304 without constructing a body.
   - Native scenario: launch twice with the same profile and unchanged catalog; record defaults/rest status, ETag, response bytes, and main-process inflate/renderer parse stacks. Second launch should reuse cached snapshots.

2. **Startup can autoplay a skill preview inside the hidden, parked database window.**
   - Trigger: leave the database on Skills, then reopen the editor without opening the database.
   - Location: [databaseModal.ts:714](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseModal.ts:714), [databaseSkillRetroStage.ts:853](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseSkillRetroStage.ts:853).
   - Heavy path: prefetch synchronously builds the remembered tab; its connected preview starts a repeating rAF loop despite `visibility:hidden`. Each frame evaluates the timeline and updates actors/effects; each active FX instance receives eight style and three dataset assignments.
   - Safeguards: reduced-motion disables autoplay; tab changes/close stop playback; two detached ticks stop abandoned stages. Parking keeps stages connected and never stops them.
   - Narrow remedy: stop animation stages after prewarming; resume when the parked window becomes visible.
   - Native scenario: reopen with Skills remembered, confirm a running stage under `database-modal-parked`, then profile idle and map interaction before opening the database. Repeat minimized.
   - Distinction: parked playback is reachable in dev and production; Electron additionally sets `backgroundThrottling:false`, so browser background behavior is not a reliable native proxy.
