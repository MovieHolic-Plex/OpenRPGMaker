# Task 28 diagnostic coordination

Comparison supervisor PID 1051827 runs baseline then frozen current under shared lock `/tmp/rpg-zzu-life-full-qa-01a0727b.lock`; source trees are read-only.

Frozen task5 edge: `src/player/playSceneTestHooks.ts:2` adds value import `buildLifeRuntimeSnapshot` from `runtimeDom.ts`; `runtimeDom.ts:20` imports the real project store. `test/debugSession.test.ts:4-11` awaits hooks inside the first test's `Promise.all`, under the default 15s budget. Original failure duration is 15012.780637ms with only `STACK_TRACE_ERROR` in JSON. This is an import-timing candidate, not yet attributable causally; task5 owns that diagnosis. No debugSession edits or separate debug-focused tests are made by task28.

`npm run wt -- create life-full-p2-gate-{base,current} --base <pinned SHA>` from the phase2 cwd prefixes that cwd basename, producing duplicated names. `git worktree move` placed them at the requested sibling paths. Provision copied existing port9841 instead of allocating; unique verified-free runtime overrides9801/9802 are in every comparison command. Environment files are untouched after tool provisioning.
