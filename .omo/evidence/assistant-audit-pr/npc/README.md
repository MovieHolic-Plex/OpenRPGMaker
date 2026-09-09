# NPC audit repair: RED -> GREEN

Task: st_01a07699. Worktree: `/home/main/.herdr/worktrees/rpg-zzu/worktree-rapid-harbor-7ca6-audit-npc` only.
Audit: `/tmp/ai-session-audit-20260906-113805.json`, entries 170, 174, 196.

## Delivered

- Schema-error repairs keep required pages required. The input-specific callback emits the original sole dialogue.text as a pages example, not invented text or an object-only hint.
- Missing-kind Show Text wrappers stay rejected, including the audited unknown `m2-101-show-text`. Guidance suggests native text with all lines joined by an actual newline. This adds no command aliases.
- Sole self-switch shorthand stays rejected with a canonical condition example; explicit false survives. Singleton repair paths address the actual conditions field, while array repairs replace only one element.
- Reject ambiguous extra conditions, including `kind:none` with extra fields instead of silently dropping them. Bare none and existing canonical pages/arrays remain unchanged.
- One OpenWiki subsection updated. No AssistantSession, database, browser, build, full-suite, commit, merge, or child-agent work.

## RED

`red.log`: exit 1, 6 failed / 20 passed (26 tests).
Five failures prove missing usable parsed corrections: three audit cases plus explicit true/false with sibling conditions.
The sixth shows `{kind:"none",selfSwitch:"A"}` previously succeeded and discarded the extra condition.
All other malformed/ambiguous controls passed before the implementation.

## GREEN

`green.log`: exit 0, 3 files / 62 tests passed on one run.
- npcAuditRepair: 26 tests, copied audit arguments (not dependent on the /tmp audit file at test time).
- npcCommandContract: 22 tests, including existing reward repairs and canonical command/condition schema compatibility.
- placeNpcMalformedPage: 14 tests, including existing normalization contracts.

Each rejection asserts project identity and full project/input equality. Parsed examples are retried through runTool(place_npc); stored pages are compared with compileSimplePages and validated by the actual command/condition shape validators. Assertions concern parsed paths/examples and authored data, not prose wording. No mocks or sleeps.

`corrections.json` records the three example values asserted against the actual error payloads (not a separate runtime capture). Those same parsed examples passed the real runner.
`typecheck-app.log`: exit 0. `lsp.json`: all five changed TypeScript files returned no diagnostics. `git diff --check`: exit 0.

## Exact commands

All shell commands ran after:

```sh
cd /home/main/.herdr/worktrees/rpg-zzu/worktree-rapid-harbor-7ca6-audit-npc
```

RED (before production edits):

```sh
npm test -- test/npcAuditRepair.test.ts > .omo/evidence/assistant-audit-pr/npc/red.log 2>&1
result=$?
printf '\nEXIT_STATUS=%s\n' "$result" >> .omo/evidence/assistant-audit-pr/npc/red.log
tail -65 .omo/evidence/assistant-audit-pr/npc/red.log
exit "$result"
```

GREEN:

```sh
npm test -- test/npcAuditRepair.test.ts test/npcCommandContract.test.ts test/placeNpcMalformedPage.test.ts > .omo/evidence/assistant-audit-pr/npc/green.log 2>&1
result=$?
printf '\nEXIT_STATUS=%s\n' "$result" >> .omo/evidence/assistant-audit-pr/npc/green.log
tail -70 .omo/evidence/assistant-audit-pr/npc/green.log
exit "$result"
```

App typecheck (independent parallel command):

```sh
npm run typecheck:app > .omo/evidence/assistant-audit-pr/npc/typecheck-app.log 2>&1
result=$?
printf '\nEXIT_STATUS=%s\n' "$result" >> .omo/evidence/assistant-audit-pr/npc/typecheck-app.log
tail -50 .omo/evidence/assistant-audit-pr/npc/typecheck-app.log
exit "$result"
```

LSP tool: `functions.lsp_diagnostics({filePath:<absolute changed file>,severity:"all"})`, exact files in lsp.json. toolRunner was checked again after its formatting-only correction.
Edits used `/tmp/apply_patch` (the available `patch -p1 --forward` wrapper), fed unified diffs. No other worktree was edited.

## Assumptions / limits

- Omitted shorthand self-switch value means true, matching the existing make_villager dialogue.when contract. Explicit booleans are preserved; invalid keys/values or extra fields are not guessed away.
- The exact audited Show Text typo has unambiguous text-only guidance, never acceptance. Other unknown IDs receive no guessed repair.
- The repo ignores `.omo/evidence/*`; evidence is present on disk here, not staged. `npc.patch` includes source, test, and wiki changes for transfer; preserve this evidence directory separately.
- Local compiler/runner evidence does not establish a live-model retry or gameplay/browser acceptance. Those validations were outside the requested scope.
