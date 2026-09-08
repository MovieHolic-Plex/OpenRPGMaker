# Exact 43f integration into approved d86f

Task: st_01a082e2. Parent/root session: 01a07680-34ac-7f79-8729-1c06bf78b736.
Worktree: /home/main/z-project/rpg-zzu-integration-43f-st01a082e2
Branch: agent/integration-43f-st01a082e2. Sole editor: this task.

## Boundary and attribution

- First parent: d86f4485b3c00b2497cd321d73f17245f34c42a7.
- Second parent: 43fd9355f9d2b5266d2aa18550edf9dd7a869a78 (exact supplied upstream, no fetch or newer-tip substitution).
- Actual merge base: 72f1f179b39972c3838922746c7641a57e95fce8.
- Used `git -c gc.auto=0 merge --no-ff --no-commit <exact upstream>`.
- Four actual conflicts: openwiki/INDEX.md, src/ai/agentVerification.ts, src/ai/assistantAcceptanceTools.ts, src/ai/assistantSession.ts.
- Product/test result before adding this evidence: tree a9dbe16d8c50143693283e45ab25a9fc2da76e98. The final merge tree also includes this evidence directory; the post-commit receipt is `.omo/integration-st01a082e2/handoff.json`.
- Exact automatic-tree comparison permits only those four conflicts and two explicit fixture migrations. `manual-resolution.diff` records every deviation from Git's automatic merge. No other source fix/refactor was made.
- Parent checkout was read-only and remained clean d86f at final pre-commit check. No main-root source edit, server, browser, provider request, remote DB access, game authoring, live history operation, extra agent, rebase, reset, ours/theirs strategy, prune, gc, deletion, push, PR operation, or build was performed.
- Provisioning itself assigned protected DEV_SERVER_PORT=9841. This task did NOT bind/contact that port or manually alter env. The worktree's default server command MUST NOT be used. A later authorized server owner must supply a distinct approved isolated port. This provisioning-policy mismatch does not affect offline tests, but is not claimed resolved.

The parent run-state, d86f-history-review and 51c9-integration-review contracts were read. The current user's d86f direction supersedes run-state's older active-51c9 entries; actual parent HEAD independently confirmed d86f. Historical P7/P8 stay blocked/incomplete/persisted. Actual AI artifact 5a6f is immutable. Final ultrabrain approval and remote PR merge remain pending.

## Resolutions and preservation

1. `agentVerification.ts`: combine equivalent explanatory comments, keeping upstream's error-history detail and our explicit distinction from subjective quality/playthrough proof. Keep upstream inspection terminology/fallback labels. No branch, gate, verdict, or canonical ID was changed to resolve this comment conflict. Our existing authored-ending/final quality selection remains intact.
2. `assistantAcceptanceTools.ts`: retain immutable request/baseline/new-map/approach-cell guidance and replace only obsolete 24x24 whole-map advice with upstream's complete-coverage single-render advice. Schemas, tool names, immutable args, and requirements were not relaxed.
3. `assistantSession.ts`, recap seam: keep async `Promise<TurnResult>` and awaited completion assessment; add upstream's once-per-run notice at the existing finishRunRecap boundary. Retain upstream removal of notices from intermediate turn exits.
4. `assistantSession.ts`, review seam: retain deterministic blockers and completionWarnings, and combine with upstream's map-scoped, byte-deduplicated reviewer images. Full changed-map evidence and before/after context remain required. Original writer delivery receipts, separate reviewer acknowledgment, post-callback approval/ownership/cancellation/budget admission and apply/persistence sequencing remain intact.
5. INDEX was regenerated using the unchanged `scripts/openwiki-index.mjs`; normal freshness check passed. No hand-edited index or generator change.
6. `assistantReviewImageBudget.test.ts` and `wholeMapCoverageRender.test.ts` use existing `imageDeliveryForRequest` to acknowledge the actual image part positions received by their scripted writer transport. The former helper now receives the request, and final writer responses acknowledge it too. No assertion, render, count, bound, or timeout was weakened. Reviewer acknowledgment still comes separately from approvedReviewResponse. These are disclosed deterministic transport fixtures, not live image/model proof.

Shared automerges inspected: independentReview retains completionWarnings while adopting pixel admission and explicit request-body ceiling; mapTools retains immutable native effectiveLayer/touched-cell receipts alongside upstream map limits/labels; generateMapTool retains candidate palette/layer authority alongside upstream limit helpers; aiAssistantSession tests retain the candidate's transport/approval fixtures and upstream b-3 notice test. These files are otherwise exact automatic merge products.

`source-audit.json` records blob equality: 1,976 old source files, 1,992 resulting source files; 1,928 old blobs unchanged, 48 old files changed, 16 added. Acceptance ledger/evaluator, image evidence, tool verification/approach ownership, proposal/no-op accounting, history startup guard, local-only Open/admission/baseline/ownership, and persistence-lineage store blobs remain exact d86f where enumerated. AssistantSession is composed, NOT byte-identical. Changed dependencies are not silently claimed covered by old full-suite runs.

## Verification and precise failure comparison

Authoritative raw commands, logs, JSON and exit files are retained in `.omo/integration-st01a082e2/`. `test-selection.json` enumerates all selected files, counts, and the failure comparison. Three final-source commands cover 42 unique files, 769 selected assertions: **768 passed, 1 retained baseline failure**. The 63 unselected aiAssistantSession assertions are not counted as coverage or newly skipped tests.

| Final-source selection | Passed | Failed | Exit |
|---|---:|---:|---:|
| Seam run: aiAssistantSession b-3; all assistantReviewImageBudget and wholeMapCoverageRender cases | 14 | 0 | 0 |
| 17 upstream files: inspection/terminology, Through, image admission, map limits, picker/history/camera/escape/toolbar, lint/surface support | 288 | 0 | 0 |
| 22 impacted core files: acceptance/canonical/approach/encounter, image transport/event render, independent review, native/no-op accounting, persistence lineage, startup guard, map generation, movement | 466 | 1 | 1 |

Exact retained red:

```
test/assistantImageTransport.test.ts
session to companion image delivery keeps aborted delivery blocked on later turns and retries
line 120: AssertionError: expected 0 to be greater than 0
```

An isolated offline `git archive` projection of exact d86f src/test/scripts/config ran ONLY that aborted case with unchanged test/hook limits. It failed with the same ID and assertion body at the same source line (checkout-root portion of stack differs). Baseline exit1, 0 passed / 1 failed, six other cases unselected. Thus no new final-source failure was established; the core run is still red. No fix, skip, timeout increase, or repeated completed-suite run followed.

Red-first seam history is retained, not overwritten:
- `seams-red`: 0 pass / 3 fail, 66 unselected. Initial provisional candidate-side session conflict bodies omitted final notice; upstream image fixtures also lacked writer ack.
- `image-seams-red`: after only the two image-budget writer fixture migrations, 10 pass / 3 fail. Dedup sent two copies instead of one; oversized review never reached reviewer; still-unmigrated whole-map writer ack produced zero delivered reviewer images. This proves the image composition failures independently of missing acknowledgments.
- Final source then adopted the two upstream session seam bodies while retaining candidate async assessment/completion warnings, and migrated the whole-map writer ack. Final seams passed 14/14.

Other validators:
- `npm run typecheck:app`: exit0, no source diagnostics. This checks all resulting app source including every changed source file.
- LSP no diagnostics: three manually resolved TS sources, independentReview, mapTools, four changed player TS files, and both migrated fixtures (11 files total).
- LSP generateMapTool timed out awaiting fresh diagnostics at 3000ms; do not label it clean. App tsc covers it successfully. Directory LSP attempted the absent Biome server; no dependency was installed or repo config changed. This LSP limitation is disclosed, not suppressed.
- INDEX generation and `npm run openwiki:index -- --check`: exit0; generator blob equal across parents/result.
- `git diff --cached --check`: exit0 for the full incoming/resolved staged diff BEFORE raw evidence was added. The final all-path check reports whitespace in preserved raw patch context lines and the tsc log's terminal blank line; these are retained unchanged, not source whitespace defects. Final source/test/wiki/package diff remains clean. No all-path whitespace-green claim.
- Generator ran as its real CLI entry point. Source behavior was exercised through native session/tool/interpreter/update/transport functions in the selected tests; no browser evidence is claimed.

Inherited broader reds remain authoritative: the four documented 51c9 stall/navigation assertions, the separate supervisor capacity 16015ms timeout (unchanged isolated pass was only historical evidence), and the complete 107-pass/8-fail surface comparison. None was rewritten or rerun by this task. Earlier broad full-suite coverage is not relabeled as a fresh combined-head run. Build and final UI/source/player QA remain parent-owned, not completed by this increment.

## Affected player and minimum supplemental real-player check

Exactly four player source files change versus d86f, each an EXACT 43f blob:
- playSceneMovement.ts: route state is passed into command/step processing; setThrough mutates only that route; a through step checks bounds but bypasses terrain/solid-event collision.
- playerRouteState.ts: existing start creates a fresh route with no through flag; new clear function sets false only if a route exists.
- playSceneMapCommands.ts: transfer calls clearPlayerRouteThrough after landing and before camera/fade/autosave/auto-trigger continuation.
- playSceneTypes.ts: optional route-local through flag, not a PlaySession field.

The AST function-text comparison in source-audit finds 38 of 41 movement functions exact d86f, including updatePlayScene, tickPlayerMovement, tryStartMove, playerCanStep, beginPlayerStep, completed-step effects/touch/encounter handling, and action handling. Only advancePlayerRoute, applyPlayerRouteCommand, and startPlayerRouteStep differ. Keyboard input.ts and saveSlots.ts/saveSlotValidation.ts/session.ts are exact blobs. createSaveSnapshot accepts PlaySession and explicitly copies its fields, not scene.playerRoute. Through is not saved state; the new transfer clear cannot change a codec field. With no authored Through command, an ordinary route uses the old collision path (undefined/false); with no route at all, the new transfer clear is a no-op. This is specific behavioral mapping, NOT a claim that all old player source is identical.

Read-only scan of the genuine final-player-51c9/project-export.json:
- Byte SHA256 f48f7120be899e00d3036d22a9f4c6d8920f34867bf99380520f19c15fb0aff1, matching the recorded stored P8 artifact associated with canonical 5a6fdc0a1337368c1aea725fb95bb617fcf8dbb7e97d841610cab282d63f467a.
- Two maps, 20x15 with four events and 12x10 with two events; recursively zero setThrough and zero moveEvent commands. No game content was loaded into a running app or modified.
- Upstream Through's 12 tests passed with real command serialization/deserialization, interpreter dispatch and deterministic updatePlayScene frames, covering on/off, terrain/events/bounds, cancellation/replacement/repeat, transfer clearing, normal-input return and NPC controls. These are offline fixture tests, not physical keyboard evidence. Existing runtimeMovementStability also passed in the core selection.

**Minimum parent-owned supplemental real-player check:** on the final built merge source and the unchanged saved 5a6f artifact, use the shipping player (not editor play) with genuine keyboard inputs. Establish a processed blocked step at a known wall/locked event and one completed ordinary walking step; walk the village-to-cellar transfer, verify normal movement/collision after landing, walk the ladder return, then verify another normal step/collision after return. Record loaded source/build identity, map/coordinates and exact movement/transfer completion signals. No teleport, private session/route injection, game modification, provider call, or fixed sleep. This targets the shared changed movement module and both actual transfer surfaces with playerRoute absent.

The already-recorded d86f/51c9 story/reward/key/title/audio/terminal native save-codec/page-selection evidence may be reused under its ORIGINAL source labels with the enumerated blob/function equality and unchanged artifact hash. No full story or duration replay is required merely for this Through increment, and no new authored-Through live game is necessary. Final-head binding should explicitly disclose the four changed player blobs plus this supplemental check. Native terminal codec proof remains separately labeled; it is not normal terminal Save or post-ending keyboard interaction. Final game, ultrabrain and remote merge approval are still pending.
