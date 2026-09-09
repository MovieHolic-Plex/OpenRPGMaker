# GROK R1 evidence — stale-approval application protection

Model: xai/grok-4.6 (native task metadata; ambient PI_PROVIDER/PI_MODEL are inherited process values, not cited as identity).
Branch: agent/ai-full-context @ 398ef9708 + R1 work. Scope: R1 only (ultrabrain-review-1.md); R2 untouched.

## Fix (preserved Astra R1 work, reconciled)
- New `/home/main/z-project/rpg-zzu-ai-full-context/src/project/authoredProjectBaseline.ts`: immutable authored-baseline authority (wiki/guideline docs excluded).
- `/home/main/z-project/rpg-zzu-ai-full-context/src/editor/tools/applyChangesetToStore.ts`: `baseline` required at shared boundary; mismatch returns `stale-baseline` before undo/history/store mutation.
- `/home/main/z-project/rpg-zzu-ai-full-context/src/ai/assistantSession.ts`: draft-current latch in `refreshAcceptance`/`rebase`, pre-review + post-chat stale checks, stale milestone handling, direct/cluster baseline threading.
- Reconciled `test/aiRunEndProof.test.ts` + `test/aiAutonomousRunSmoke.test.ts` with migration d683e52a8 (reviewer stub, intent-cache reset, barrier bounds) while keeping R1 `baseline:` args. Old proof-null failures were the missing reviewer stub, failing identically on pristine HEAD.

## Verification (all run in /home/main/z-project/rpg-zzu-ai-full-context)
- New suites: authoredProjectBaseline (8) + assistantAuthoredBaseline (4) + aiAuthoredBaselineSurfaces (3) = 15/15 pass.
- aiRunEndProof 30/30, aiAutonomousRunSmoke 6/6, apply/commit/gate/reset/audio/wiki 5 files 20/20 pass.
- `tsc --noEmit -p tsconfig.app.json`: exit 0.
- Pre-existing, not R1: 3 `applyProposedProjectHouseProtection` "checks the live store" cases fail with `independent-review-window-exceeded` on pristine review worktree 4696fa93f too.
- Old /tmp red/green/typecheck/final logs: only st_01a078a2-red.log exists (pre-fix repro, price 50 overwrote 9876); others unavailable, labeled unverified, reran focused regressions instead.

## Real browser UI proof (GROK, faithful clicks, scripted model only)
- Script: `/home/main/z-project/rpg-zzu-ai-full-context/scripts/qa/grok-r1-stale-approval.mjs`; artifacts: `.omo/evidence/ai-full-context/grok-r1/` (r1-00..03 PNG, r1-actions.json).
- Real composer send → writer `set_title_screen` → reviewer HELD at revision 1 → real DB clicks (toolbar-database → db-tab-items → db-record-row-item_potion → db-field-price 9876) → approval released.
- Result: price 9876 survives, title unchanged, no new undo entry (history stays 1, the human edit's own), appliedCalls [], approval false, chat shows "무결성 검사에 막혀 적용하지 않았습니다: 초안을 만든 뒤 프로젝트가 수정되었습니다…" — PASS.
