# Seven AI test failures - final gate review

## Current decision - C5 delta re-review

- recommendation: **APPROVE**
- blockers: **[]**
- Resolved blocker: **B1 / C5**.
- Scope: only the requested two-line guard correction and its regression evidence; prior criteria were not reopened. This decision supersedes the historical REJECT below.
- HEAD observed during verification: `891bbbe897a65ad9ee22487e2a6c3f3f118067c5`.
- Reviewed file SHA-256: `ebcc7e0aea232559696f5d4ea02067c4db800740aff451006afa115e5bf58332` (`test/noLocalProjectDb.test.ts`).

### Correction and userOutcomeReview

At `test/noLocalProjectDb.test.ts:43`, `ts.isStringLiteralLike(node)` replaces `ts.isStringLiteral(node)`. This includes no-substitution template literals without widening the capability-check exception. Line 88 adds the exact previously escaping computed-key input to the existing negative fixture matrix. The canonical-project guard now rejects that actual IndexedDB open while still permitting the direct `typeof indexedDB` capability query. Existing direct, guarded, alias, window-property and quoted-computed prohibitions remain intact.

The delta is minimal and satisfies C5. Under the already consulted programming/remove-ai-slops criteria, the added case is a demonstrated behavioral regression, not a deletion-only or tautological assertion. The existing test-only parser uses the appropriate compiler predicate; no new production parsing, normalization, abstraction, dependency or scope change was introduced.

### Checked artifacts and independent verification

- Read the complete revised `test/noLocalProjectDb.test.ts` and inspected its exact diff against the initially reviewed candidate.
- Parsed `.omo/evidence/ai-seven/guard-template-red.json`: **1 failed / 8 passed / 0 pending**, with the sole failure at the exact template-literal computed-access case (`expected [] to include 'indexedDB'`, line 90).
- Parsed `.omo/evidence/ai-seven/guard-template-green.json`: **9 passed / 0 failed / 0 pending**, including that exact case and the retained repository scan/capability cases.
- Independently executed the actual scanner extracted from the current file in memory. All seven probes passed: direct capability query accepted; direct, guarded, aliased, window, quoted-computed and template-computed accesses rejected. No source file was injected or modified.
- Independently ran once: `npm test -- test/noLocalProjectDb.test.ts --maxWorkers=1`.

```text
PASS test/noLocalProjectDb.test.ts (9 tests)
Test Files 1 passed (1)
Tests 9 passed (9)
Duration 2.38s
exit 0
```

The previously failing probe now returns:

```text
{"probe":"globalThis[`indexedDB`].open(\"project\");","findings":["indexedDB"]}
```

### Current evidence boundaries

There is no remaining evidence gap for B1. Root reports successful strict standalone tsc, 77 scoped/preset tests, complete product build, resolved upstream merge and repeated integrated browser QA. Those newly reported broader results were not independently inspected or rerun in this blocker-only review and are not presented as reviewer-verified facts. Full gates remains root-owned and is not claimed green. Prior nonblocking evidence qualifications remain historical context, not newly reopened criteria.

Only this report artifact was edited by the reviewer. No production/test edits, commits, merges, pushes or new browser sessions were performed.

---

## Historical initial review - superseded by the APPROVE above

The remainder preserves the initial findings and evidence trail. Its B1 failure, initial recommendation and then-outstanding integration state describe the earlier candidate, not the corrected current guard.

## Initial decision

- initialRecommendation: **REJECT** (superseded)
- Reviewed branch: `fix/ai-seven-validation`.
- Reviewed immutable candidate: `9b2bf7ff9811367eaac536e4f54e551c270884b5` against `3f7b89d647b99f9c3223e90cfee0c9735664a9f6`, plus the initial uncommitted `openwiki/testing.md` additions.
- Review task: `st_01a07785`.
- Report location: explicitly requested `.omo/evidence/ai-seven/final-review.md`. `omo-agent-toolkit ulw-loop status --json` returned `ULW_LOOP_PLAN_MISSING`; no attempt directory exists for this reviewer.
- Scope: read-only code/evidence review and narrow execution. No production/test edits, mutations on disk, commits, merges, pushes, or additional reviewers were performed by this reviewer.

## originalIntent

Resolve exactly seven reported failing tests truthfully: fix the real activity-family omission, repair stale asynchronous and UI fixtures rather than change already-working behavior, and retain the canonical-project local-storage prohibition while permitting AI-history capability detection. Preserve the merged PR637 preset work. Do not equate unrelated failing tests with confirmed product defects or silently expand this into a full-repository repair.

## desiredOutcome

Users see appropriate world-authoring narration, retain both reasoning segments, receive a transient preview from a real successful write, recover from transport failure, see and clear selection scope without breaking the composer, and retain AI conversation history across reload. Validation should distinguish those behaviors from regressions without weakening the local canonical-project database guard. Final upstream integration, full-gates accounting, commit and PR publication remain root-owned.

## Initial blocker history - B1 now resolved

### B1 - computed IndexedDB access escapes the replacement guard

- violatedCriterion: **C5** - "original canonical store guard still catches forbidden fallback"; the task also explicitly requires rejection of computed IndexedDB access and allows only direct `typeof indexedDB` capability detection.
- evidencePointer: `test/noLocalProjectDb.test.ts:42-47`, especially line 43; negative fixtures at lines 82-89; `openwiki/testing.md:43-47` in the initially reviewed version. Immutable source: `9b2bf7ff9811367eaac536e4f54e551c270884b5:test/noLocalProjectDb.test.ts`.
- Observation: `globalThis[`indexedDB`].open("project");` is valid computed property access that actually opens IndexedDB. The old literal guard rejected it. The replacement returns an empty findings list because a no-substitution template literal is neither `ts.isIdentifier` nor `ts.isStringLiteral`.
- Impact: a local project database fallback written with this ordinary computed-access syntax is now accepted by the repository guard. This is a demonstrated loss of an existing prohibition within the explicitly named computed-access class, not a hypothetical request for broader hardening.
- Required correction: recognize no-substitution template-literal property keys as actual access, retain the narrowly allowed direct `typeof` case, add this input to the existing negative fixture matrix, and prove restored rejection plus green target suites. No production persistence change is needed.
- Independent executable proof: extracted the actual function and its constants from the immutable reviewed commit, transpiled them with the installed TypeScript compiler, and evaluated them in memory. No implementation was re-created and no source file was injected. The immutable probe also confirmed the guard bytes still matched the working tree during upstream integration.

Exact observed output:

```text
reviewedRevision=9b2bf7ff9811367eaac536e4f54e551c270884b5; guardMatchesWorkingTree=true
{"probe":"typeof indexedDB !== \"undefined\";","findings":[]}
{"probe":"indexedDB.open(\"project\");","findings":["indexedDB"]}
{"probe":"globalThis[\"indexedDB\"].open(\"project\");","findings":["indexedDB"]}
{"probe":"globalThis[`indexedDB`].open(\"project\");","findings":[]}
C5 FAIL confirmed against immutable reviewed commit, independent of concurrent merge
exit 1
```

Read-only reproduction from repository root:

```sh
node --input-type=module <<'JS'
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
const text = execFileSync('git', ['show',
  '9b2bf7ff9811367eaac536e4f54e551c270884b5:test/noLocalProjectDb.test.ts'],
  { encoding: 'utf8' });
const start = text.indexOf('const forbiddenRuntimePatterns =');
const end = text.indexOf('\ndescribe(', start);
const js = ts.transpileModule(text.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const context = vm.createContext({ ts, probe: 'globalThis[`indexedDB`].open("project");' });
vm.runInContext(js, context);
const findings = vm.runInContext('forbiddenLocalDbReferences(probe)', context);
console.log(findings);
if (!findings.includes('indexedDB')) process.exitCode = 1;
JS
```

## userOutcomeReview / criterion matrix

| Criterion | Direct review and referenced artifact observations | Gate assessment |
| --- | --- | --- |
| C1: explicit activity classification and human-readable panel narration | Initial production diff is exactly the world-family line at `src/editor/aiActivityNarration.ts:120`. Both bridge and mountain are real registered write tools. Existing prefix fallback incorrectly classified them as story work. Shared consumers are panel live activity and preview labels. `browser-initial.json` records bridge live text and `narration-green.json` records 7 passing tests. | Scoped fix is appropriate. Post-upstream registry verification is separately outstanding. |
| C2: reasoning retention | `test/aiChatObservability.test.ts:233-275` routes intent JSON separately, executes distinct successful query tools, awaits terminal publication, checks both sentinel items and disclosure behavior. `browser-contracts.json` records two reasoning items. Mutation evidence changes the actual renderer and fails with one item instead of two. | No scoped blocker found. |
| C2: successful-tool ghost | `test/aiChatObservability.test.ts:278-329` subscribes before sending, exercises real create_map/draft/apply, checks the input-derived map and bounds, successful tool result, and final preview cleanup. The production callback-disconnection mutation fails despite successful apply. Browser JSON records the transient event while the following response was held. | No scoped blocker found. |
| C3: transport terminal state/recovery | `test/aiChatPanelTransportError.test.ts:48-133` waits for real terminal publication after production retries, checks running and recovered controls, and actually clicks settings. HTTP refusal and 401 remain distinct cases. Both fail when settings publication is removed. Browser JSON records final error, running=false, enabled settings and visible retry. | No scoped blocker found. |
| C4: selection visibility and clearing | Real panel and assistant cascade replace fabricated historical CSS fragments. The suite verifies current-map pin, scoped sibling hiding, clickable clear control, retained editor selection, cleared AI scope, and actual region/session routing. Browser JSON records positive selected geometry and absence after clear. | No scoped blocker found. |
| C4: hint/layout | The current help surface is the input title, not the retired hint. Tests also verify positive action-row layout, controls and focus/blur state; browser JSON records 36px height in both states. Mutation logs reject restored hint text even without the retired class. | Not a deletion-only replacement. No scoped blocker found. |
| C5: local database guard/history ownership | The retained scan, SQLite/JSON patterns, direct/guarded/alias/window/string-computed fixtures and injected direct-open failure are present. Browser JSON records IndexedDB conversation ID preservation over reload. However, the replacement scan accepts template-literal computed access previously prohibited. | **Fails: B1.** |
| Scoped RED/GREEN and no suppression | Parsed original `red.json`: 7 failed / 18 passed. Parsed lead `green.json`: 31 passed / 0 failed / 0 pending in 5 files. All seven original behavioral concerns remain represented; six added guard cases explain the increased count. No new skips, deleted behavioral cases, diagnostic suppressions, or gate-baseline edits in the scoped diff. | Artifact counts corroborate the named cases but do not cover B1. |
| Preserve PR637 | `git merge-base --is-ancestor 7a24224c6 HEAD` returned 0 at the initial reviewed candidate. Parsed `preset-regression-green.json`: 46 passed / 0 failed / 0 pending in 6 files. | No scoped regression shown; no claim of an independent preset rerun. |
| Verification and cleanup | Initial `git diff --check <base>` passed. Port 43791 showed only the `ss` header. Notepad records browser closure, child worktree removal, build/typecheck and mutation restoration. | Evidence qualifications below apply. Full-gates result and upstream integration remain root-owned, not approved by this report. |

## Independent remove-ai-slops / programming review

Consulted available skills directly:

- `/home/main/.omo/agent/npm/node_modules/oh-my-openagent/dist/skills/remove-ai-slops/SKILL.md`
- `/home/main/.omo/agent/npm/node_modules/oh-my-openagent/dist/skills/programming/SKILL.md`
- `/home/main/.omo/agent/npm/node_modules/oh-my-openagent/dist/skills/programming/references/typescript/README.md`

Applied their criteria as a bounded review, not permission to implement a cleanup or widen scope.

- **Excessive/useless tests:** the six added guard inputs distinguish capability detection from five actual-access forms; useful, but the computed-access matrix is incomplete as B1 demonstrates. Other suites preserve existing cases instead of inflating counts.
- **Deletion-only/requested-removal tests:** the old removed-file guard is retained, not newly invented. The rewritten hint test does not stop at absence: it verifies remaining help, layout, controls and focus transitions. Existing absence assertions accompany positive behavior.
- **Tautological / implementation-mirroring tests:** reasoning sentinels and ghost bounds derive from fixture inputs; actual renderer/tool connections can fail. Transport settings are clicked, not only counted. Selection routing compares dismissed scope against a genuinely unselected send and separately exercises active scope. CSS constants do couple tests to current layout contracts, but real-browser geometry and independent CSS/DOM mutations support those named contracts. Tests do not extract production snippets and execute replicas to establish integration success.
- **Production extraction/parsing/normalization:** no production helper extraction or normalization was introduced. The one production edit uses the existing shared mapping. The test-only AST parser is justified by the semantic exception to the old literal guard, but its node coverage creates false confidence (B1). The newline adjustment in transport expectations accounts for textContent concatenation of rendered line breaks; it is not production normalization or pinned prose.
- **Async correctness:** changed async fixtures subscribe before action and use bounded rejection deadlines, not sleep/poll success conditions. Verified `aiTurnRunner.ts:641-683` performs terminal UI cleanup before terminal activity publication. Real production retry delays in the refusal case are not invented fixture sleeps. Selection observer handles transitions delivered in one mutation batch and disposes its observer/timer in finally.
- **Mock boundaries:** observability/transport mock fetch and activity persistence, not the real session/tool/draft/renderer behavior being asserted. Selection mocks the two backend execution alternatives to test UI routing, while mounting the real panel and processed assistant styles. These are meaningful seams.
- **Scope/maintenance:** test-local helpers remain local. No new production dependency, auth policy, database ownership change or game deliverable. Remaining fake-DOM casts and the small render wrapper are maintenance notes, not success-criterion failures. The observability suite measures 280 nonblank/non-line-comment lines versus the skill's 250-line guideline; the production narration file measures 192, transport 119, selection 198 and guard 88. Splitting suites or modernizing existing casts is not a blocker for this narrowly scoped gate.
- **Prose pins:** rewritten assertions use fixture sentinels, machine fields or shipped-copy equality, not newly pinned prompt/doc wording. Wiki additions have no prose tests.
- **Prior review coverage:** the supplied SELF REVIEW, notepad, async journal and selection README cover contract fidelity, mutation sensitivity, async timing and limited scope. No separate ai-seven code-review report explicitly enumerating both skill perspectives and every overfit/slop class was supplied or located. This is an exact review-evidence gap, not a second product blocker: no stated success criterion requires that separate artifact. This report provides the direct skill-perspective pass rather than assuming prior coverage.

## Independent execution and concurrent-integration boundary

1. Initial status was `fix/ai-seven-validation`, HEAD `9b2bf7ff9811367eaac536e4f54e551c270884b5`, only `openwiki/testing.md` uncommitted. Initial base-to-working-tree source diff contained only the narration line.
2. The in-memory guard probe reproduced B1 both from then-current source and again from the immutable reviewed commit. Both returned exit 1 for the explicit rejection assertion. The latter proof is independent of changing working-tree state.
3. Ran once:

   `npm test -- test/noLocalProjectDb.test.ts test/aiActivityNarration.test.ts --maxWorkers=1`

   Result: **14 passed / 1 failed**, exit 1. The guard suite passed all 8 tests. Narration failed with:

   ```text
   FAIL test/aiActivityNarration.test.ts > AI tool activity registry case
   AssertionError: set_audio_description tool activity family must be explicitly decided:
   expected false to be true
   test/aiActivityNarration.test.ts:124:9
   Test Files 1 failed | 1 passed (2)
   Tests 1 failed | 14 passed (15)
   ```

   The original output's assertion prefix is Korean; `set_audio_description`, assertion values and location above are exact machine identifiers/results.
4. Following that run, status showed HEAD `3b1a903d7feb4f1d0d7e539062da4b00f69c3943`, incoming staged upstream files and `UU` conflicts in narration/wiki. The narration conflict showed ours with bridge/mountain and incoming with `set_audio_description`; the incoming registry contained that tool. Therefore this run is **not** a clean reproduction of the initial candidate's narration result and must not be used to invent a second scoped regression. Root's normal upstream merge and final integrated verification remain outstanding ownership boundaries.
5. No full build, full gates, real-browser session, preset suite, or on-disk mutation was rerun by this reviewer. No passing final integration is claimed.

## Checked artifact paths

### Goal, source and docs

- `/tmp/ulw-20260907-001607.95PErB.md` - original plan, criteria, QA scenarios, execution and cleanup receipts.
- Full scoped git diff for `src/`, `test/`, `openwiki/` at initial candidate.
- `src/editor/aiActivityNarration.ts`, `test/aiActivityNarration.test.ts`, `test/noLocalProjectDb.test.ts`, `test/aiChatObservability.test.ts` - full contents.
- `test/aiChatPanelTransportError.test.ts`, `test/aiSelectionChipScope.test.ts` - complete changed diff.
- `src/editor/panels/aiTurnRunner.ts:580-749` - terminal publication ordering.
- Relevant definitions/call sites in `src/editor/tools/worldStructureTools.ts`, `src/editor/panels/aiChatPanel.ts`, `src/editor/agentPreviewRenderers.ts`.
- `src/styles/database/tabs-b-assistant-panel.css`, `src/styles/database/tabs-b-assistant-panel/12-assistant-temperature.css`.
- `openwiki/editor-ai-panel.md`, initial uncommitted `openwiki/testing.md` diff.
- `package.json`, `scripts/run-vitest.mjs`; initial portion of `vite.config.ts` consulted when investigating the changed runtime result.

### Lead results and manual QA matrix

- `.omo/evidence/ai-seven/red.json`
- `.omo/evidence/ai-seven/green.json`
- `.omo/evidence/ai-seven/narration-green.json`
- `.omo/evidence/ai-seven/guard-mutation-red.json`
- `.omo/evidence/ai-seven/guard-green.json`
- `.omo/evidence/ai-seven/async-integrated-green.json`
- `.omo/evidence/ai-seven/preset-regression-green.json`
- `.omo/evidence/ai-seven/browser-initial.json`
- `.omo/evidence/ai-seven/browser-contracts.json`
- `.omo/evidence/ai-seven/{narration,reasoning,ghost-preview,transport-error,selection-visible,hint-layout,history-reloaded}.png`

JSON reporter totals and individual failed assertions were parsed, not accepted from summary prose alone. Browser JSON records concrete texts, IDs, event data and geometry. All seven screenshots were opened through the reader and checked for PNG signature and 1440x900 dimensions, but image pixels were unavailable to this model; no independent visual-appearance verdict is claimed.

### Async lane

- `.omo/evidence/ai-seven-async/journal.md`
- `.omo/evidence/ai-seven-async/verification.json`
- `.omo/evidence/ai-seven-async/browser-qa.md`
- `.omo/evidence/ai-seven-async/mutation.patch`
- `.omo/evidence/ai-seven-async/{baseline-red,trace-red,fixture-green,assertion-format-red,mutation-red,final-green}.json`
- `.omo/evidence/ai-seven-async/typecheck-baseline-scoped.log`
- `.omo/evidence/ai-seven-async/typecheck-scoped.log`
- `.omo/evidence/ai-seven-async/typecheck-app.log`

The actual mutation patch targets reasoning item creation, successful-tool ghost publication and settings action insertion. Parsed mutation assertions show 1-vs-2 items, missing ghost event and missing settings for both error cases, followed by recorded 11/11 restoration. Scoped tsc logs show the same two timer conflicts before/after, with three obsolete getChatDock test errors removed; no claim that full test-inclusive tsc is green.

### Selection lane

- `.omo/evidence/ai-seven-selection/README.md`
- `.omo/evidence/ai-seven-selection/browser-qa.md`
- `.omo/evidence/ai-seven-selection/mutation-proof.py`
- `.omo/evidence/ai-seven-selection/mutation-results.json`
- `.omo/evidence/ai-seven-selection/mutation-{idle-map-host-hidden,scoped-host-hidden,scoped-priority-lost,map-sibling-visible-while-scoped,selection-hidden-with-siblings,clear-button-hidden,input-help-removed,retired-hint-restored,help-takes-row-space-with-new-class,action-row-block-layout,deck-action-row-height,action-lead-wraps,focus-class-missing,blur-class-sticks,send-control-detached}.log`
- `.omo/evidence/ai-seven-selection/final-scoped-green.log`
- `.omo/evidence/ai-seven-selection/diagnostics.txt`
- `.omo/evidence/ai-seven-selection/typecheck-comparison.txt`
- `.omo/evidence/ai-seven-selection/typecheck-excerpt.txt`

For every selection mutant, inspected actual patch lines and named failure/error, not only the 15/15 summary flags. The final related-run log records 21/21 passing. Baseline/full-typecheck identity is a child comparison statement with excerpt, not an independently reproduced full typecheck.

## Exact evidence gaps and nonblocking notes

- C5 lacks a negative template-literal computed-key case and currently fails it: **blocking B1**, not merely missing paperwork.
- No standalone explicit prior skill-perspective code-review report: noted above; direct review completed here.
- Browser recordings are structured lead observations, not a retained browser trace independently replayed by this reviewer. PNG pixels could not be viewed. The artifacts exist and agree with inspected source/tests, but this report does not claim a fresh browser/visual pass.
- Lead full build and standalone guard-tsc success are recorded in the notepad/task handoff; standalone raw lead command logs were not supplied under `.omo/evidence/ai-seven`. They were not independently reproduced here. The app-typecheck child log contains the command without errors, with exit status reported in its verification record.
- Full `npm run gates` result was not available for this review. No blanket statement that unrelated failures are pre-existing is supported or made. Only the paired scoped timer-error logs support that specific baseline attribution; the broader typecheck comparison remains attributed to its author.
- Original ghost/transport/selection screenshot example names differ from retained filenames, but referenced equivalents exist; this is not a missing-scenario blocker.
- The transport case title still describes running-state controls while also testing recovery. Prose nit only.
- Upstream integration changed the working tree during review. The recorded lead GREEN/build/browser evidence belongs to the pre-integration source state and is not a claim about the new integrated source. Root owns conflict resolution, relevant final checks and accurate gates accounting before publication.

The actionable scoped rejection is B1. The remaining user-facing corrections are supported by the inspected source and concrete artifacts, subject to the expressly separated upstream integration and evidence limitations.
