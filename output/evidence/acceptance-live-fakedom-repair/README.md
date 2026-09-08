# Focused PR691 followup repair

Authority remains the completed e05a99b915102de113ac4634f4a06a5bb3267788 /
5bdc4630d47aa790864621b06d88eac6a3d14e43 matched comparison in
`../acceptance-live-candidate/comparison.json`. This work stays on
`feat/ai-acceptance-live-qa`; the external PR691 merge is not this session's action
or a new baseline. No push, PR, merge, full-suite run or live authoring was performed.
Production sources, canonical project/hash, live/player evidence and prior gate
packs are unchanged. Build output is in the fresh directory in `build-output.txt`.

## Causes and repair

1. `insertBefore` activated real custom selects. Fake elements lacked options,
   selectedIndex and option selection/index contracts; 95 direct new reason records
   hit customSelect.ts:407. Every fake element also passed HTMLSelectElement's
   instanceof check, so attached dialog roots could be wrapped as selects.
2. append/prepend/replaceWith did not adopt nodes; removeChild/textContent left
   stale parent links. Enhanced wrapping/disposal could duplicate ownership and
   leave modal cleanup, navigation and chrome refresh incomplete. The shared fake
   now adopts/removes consistently and models the single-select contracts used by
   the real controller. Existing insertBefore behavior and enhancement stay enabled.
3. Strict select values exposed weightedBranchUx's nonexistent `roll` option.
   Its test now creates that variable in the real test store; assertions are intact.
4. aiChatObservability answered the new coverage audit with intent JSON. The red
   trace shows unresolved acceptance, a successful create_map, then execute phase.
   A second red trace with correctly shaped coverage shows the same pending-draft
   boundary and three non-streaming requests with no fixture responses: the old
   stream=true assertion entered production transport retry backoff. Manual chat
   applies after bounded repair/settlement. The fixture now supplies a request-linked
   map-dimensions audit and non-streaming execute replies, counting 1 intent, 1 audit,
   2 streams and 3 execute requests. Ghost bounds, one actual apply and cleanup remain
   asserted; session/post-apply acceptance, run-outcome and terminal events are also
   observed before Send. No deadline, sleep, retry policy or production code changed.

## Direct execution evidence

Each `*.exit` is saved directly from the executed command, not a pipeline's tail.
The first pre-edit representative used the test's existing fake endpoint setup.
All subsequent Vitest/typecheck/build commands used
`bwrap --bind / / --unshare-net --die-with-parent -- <command>` and one Vitest worker.
Every exact Vitest argv, count and exit is also in `summary.json` (`runs`).

| Evidence prefix | Command scope | Direct result |
| --- | --- | --- |
| representative-red | eventEditorTrustLoop, `--testNamePattern='routes quick command' --maxWorkers=1` | exit 1; 33 failed (32 custom-select, 1 existing window failure), 12 filtered |
| contracts-red-actual | new fakeDomSelectContracts | exit 1; 14 failed / 2 passed, including 5 incorrect Happy DOM reference assumptions |
| focused | fakeDomSelectContracts, fakeDomInsertBefore, fakeDomImageGlobal, eventEditorCustomSelect, customSelectEscapeLayer, weightedBranchUx, agentBlueprintTurnEnd, aiStickyChecklist, switchVariableModalTrigger, recordPickerSharedControls | exit 0; 79 passed / 10 files |
| ghost-trace-red | original ghost fixture plus request/session/terminal observation | exit 1; unchanged 10-second terminal deadline |
| ghost-valid-audit-red | valid audit, original stream-only execute fixture | exit 1; trace confirms non-streaming execute requests rejected by fixture |
| coverage-observability-green | aiChatObservability and requestCoverage | exit 0; 23 passed / 2 files |
| affected-final | exact 21 files listed in summary.json/perFile and affected-final.log | exit 1; 274 passed / 7 failed / 0 skipped, 18 passing files / 3 failing files |
| native-surface | `node output/evidence/acceptance-live-fakedom-repair/native-surface.mjs` | exit 0; real production custom-select menu, optgroup selection, events, unwrapping and cleanup in Firefox |
| typecheck-app | `npm run typecheck:app` | exit 0 |
| build-app | `npm run build:app -- --outDir /tmp/st_01a07f64-build-pRrdbS` | exit 0; existing large-chunk warnings retained |

The native probe loads only the locally bundled production component into a blank
page, aborting all page network routes; no editor boot or project/DB load. Browser
launch inside bwrap failed with EACCES; native Firefox outside that namespace worked.
`native-reference.json` records Firefox's edge semantics where the installed Happy
DOM differs (duplicate values, normalized text/label, detached index, reordering,
self replacement). The final tests retain those native assertions and use Happy
DOM only for its supported grouped-selection/adoption/cleanup reference trace.

The initial `contracts-red` command ran before the patch executable was found and
collected no tests; it is retained but is not TDD proof. `contracts-first-fix`,
`affected` and `observability-uxc` retain intermediate failures. The latter exposed
the need to observe the panel's separate post-apply refresh subscriber; the final
test forwards that real callback and verifies its verified acceptance event.
LSP diagnosed and then cleared two missing `this: AssistantSession` annotations;
occasional diagnostic refresh timeouts were not counted as clean results.

## Exact affected-suite disposition

`python3 output/evidence/acceptance-live-fakedom-repair/summarize.py` regenerates
the machine summary from untouched full reports and this final affected report.
It preserves file/name/occurrence keys and raw remaining failure messages.
All **119 candidate-failed affected cases now pass**, including all 40 TrustLoop,
17 settings, 11 modal, 7 modal-close and both observability deltas. All 95 direct
custom-select reason records disappear. UXC's already-red title assertion again
receives the complete baseline chrome rather than the candidate's partial chrome.

The seven retained failures are baseline debt: four eventEditorTrustLoop cases
(window, position-focus, KeyboardEvent, missing interaction surfaces), two
aiChatPanelUxRepairs cases (abort deadline and conversation restoration), and the
UXC title assertion. **No remaining introduced failure exists in the 21-file affected
scope.** This is not an all-green repository or whole-suite claim. The independent
non-fake-DOM triage remains under the baseline worktree's
`output/evidence/acceptance-live-delta-triage/st_01a07f65/REPORT.md`; unrelated
timeout/network/timer-debt tests were not modified. Final matched whole-suite
validation, review and followup PR creation belong to the lead.
