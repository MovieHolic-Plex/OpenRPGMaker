# R10: native upsert page contract (2026-09-06)

Base: `affaa027e3847eb78640c6330b4cf437f51394d4`.
Worktree: `/home/main/z-project/rpg-zzu-ai-native-pages-0906`.
Task: `st_01a076e9`.

## Cause and scope

The successful round2 `upsert_event` stored the exit effects in SimplePage-only
`page.choices`; only `page.commands` executes. Native commands already execute the
recorded valid epilogue. No interpreter or SimplePage compiler change is needed.

- Advertise native EventPage fields and finite, JSON-serializable native choices
  `options[].branch`, including cancellation fields.
- Reject submitted SimplePage-only behavior/graphic selectors before merge with
  `invalid-args`, the page index/field names, and a runnable canonical repair JSON.
- Normalize only supplied top-level command/page fields on existing events.
  Existing command validation, default filling on submitted pages, and high-level
  `place_npc`/`make_villager` compilation remain intact.
- This is not a migration. Omitted existing pages (even old inert properties) are
  preserved. The parent must repair the saved exit explicitly through native input.

## Captured seam

Source evidence (read-only):
`/home/main/z-project/rpg-zzu-ai-playable-adversarial-0906/output/evidence/ai-playable-final/round2/`

- `first-audit.json:2037-2133`: last successful exit update.
- `first-project.json:612-714,1419-1441`: inert choices and valid ending.
- `REPORT.md`: parent keyboard walkthrough from spawn/chief/chest to locked exit.
- `11-no-choice-no-ending.png`, `runtime-receipts.json`: parent runtime evidence.
- Review: sibling `.omo/evidence/ai-playable/review-round2.md`, R10.

`test/fixtures/ai-native-page-round2.json` contains the exact call and ending,
not synthesized prose. Python JSON equality against both source records passed.
Only surrounding map/database setup is reduced in the test. No live project,
server, browser, DB or `.env.local` was written.

## Red

Before production edits:

```sh
npm test -- test/aiNativePageContract.test.ts --maxWorkers=2 --minWorkers=1
```

Exit 1: 12 failed / 2 passed. Eleven failures demonstrate the bug: recorded exit
accepted, eight uncompiled input cases accepted, omitted graphic rewritten, and
SimplePage schema still advertised. One additional assertion incorrectly expected
`interpreter.isDone()` immediately after the terminal step. The actual interpreter
returns `pause("returnToTitle", ...)`; terminal delivery, not stack exhaustion, is
the correct completion assertion. That test assertion was removed; runtime was
not changed. An earlier patch-format error caused a no-test-files invocation;
it was corrected before the actual red reproduction.

## Green and related checks

Same focused command after implementation: exit 0, **20/20 passed**.

The real `runTool -> serialize -> deserialize -> resolveEventPage -> interpreter`
path presents choices, removes exactly one key from inventories of one and two,
executes all three recorded epilogue lines, and emits the recorded terminal
`returnToTitle`. Parsed canonical repair JSON also executes and its cancel option
leaves inventory/ending state unchanged. High-level tools still compile choices.
Tests use no sleeps, polling, provider mocks or prose pins.

Related command (one run):

```sh
npm test -- test/aiNativePageContract.test.ts test/aiCommandSchemaContract.test.ts test/aiEndingCompletionRegression.test.ts test/eventPageRequiredFields.test.ts test/toolsMapManagement.test.ts test/aiGraphicAutofill.test.ts test/toolSchemaProviderCompat.test.ts --maxWorkers=2 --minWorkers=1
```

Exit 1: **93 passed, 2 failed**, six files passed / one failed. Both failures are
the already reported round2 provider-schema failures at
`test/toolSchemaProviderCompat.test.ts:76,88`, outside this diff. Output lists:

```text
set_work_plan.acceptance[].criteria[]: oneOf/anyOf forbidden
set_work_plan.acceptance[].criteria[].oneOf[0].target: oneOf/anyOf forbidden
set_work_plan.acceptance[].criteria[].oneOf[1].targets[]: oneOf/anyOf forbidden
set_work_plan.acceptance[].criteria[].oneOf[2].target: oneOf/anyOf forbidden
set_work_plan.acceptance[].criteria[].oneOf[3].target: oneOf/anyOf forbidden
set_work_plan.acceptance[].criteria[].oneOf[4].target: oneOf/anyOf forbidden
```

These failures were not suppressed or changed. Acceptance/provider repair is R7,
not R10. A separate base checkout was not executed.

- `npm run typecheck:app`: final exit 0.
- Changed TS diagnostics: no diagnostics on eventTools, schemaShapes or new test.
- JSON LSP unavailable (`biome` not installed); fixture parsed and exact-source
  equality passed. Markdown has no configured LSP. No dependency installed.
- `git diff --check`: passed before commit.

Session logs: `/tmp/r10-red.log`, `/tmp/r10-green.log`,
`/tmp/r10-focused-green.log`, `/tmp/r10-typecheck-final.log`.

## Limits / handoff

Parent owns build, broad gates, real AI generation/correction, browser completion,
remote persistence/reload, repeated ultrabrain approval and any merge. This code
commit is not an R6 game-completion claim. No push, PR or merge performed.
