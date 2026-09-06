# Task14 initial Phase4 independent verification

## Verdict: confirmed for scoped task14 behavior

The actual committed task14 implementation satisfies the audited birthday/weather/skill/name/display and pure-render contracts in the required tests, related seams and independent native editor/player executions. No mandatory task14 product correction was found. The producer-disclosed stale OpenWiki index is independently reproduced and remains a **parent integration fix**, not a passing index gate.

This is initial Phase4 verification by `st_01a07843`, not task34 approval, final visual approval, full authoring/player journey completion, or overall life-system completion. Task11 separately needs a product fix; task14 confirmation does not approve the combined phase.

## Exact source identity and isolation

| Field | Value |
| --- | --- |
| Producer | `/home/main/z-project/rpg-zzu-life-full-authoring-bounds` |
| Actual producer HEAD | `e486e536954d69c59c7bcc82602646cc6712c445` |
| Git tree | `7a6a7b107ab05b34991440eccb559db3e1a81969` |
| Verification tree | `/home/main/z-project/rpg-zzu-life-full-p4-bounds-verify` |
| Base | `966f414c07729e7d9474c568cbaf19a94d2bc740` |
| Phase3 reviewed ancestor, read from its verdict | `bd81a933cbecfeb8b25ef15bf57bc24911011aa8` |
| Required test SHA256 | `1133a8c47e56606ee67fb994db00d96ae1e8eaa3d303d248febd233987cc7c86` |
| Weather editor SHA256 | `ff1a98cb8e21238bb2edd45a03ca5757b85a36436d5989e84bbd123dfbf1d074` |

`identity.json` records SHA256 for all8 changed product files, the test and focused wiki. Both exact ancestor checks returned0. The destination was absent before creation; the tree was added detached/locked at the actual producer HEAD and canonically adopted with `npm run wt -- adopt life-full-p4-bounds-verify --path <verification-tree>`. `adoption.log` retains that result. The source remains unchanged at cleanup, and the producer HEAD/summary still match. No product/test/dependency, WISH, or producer-tree edit was made. The parent owns archival/removal.

I read the complete canonical plan, AGENTS, quickstart/INDEX/PROJECT_WIKI, focused worktree/testing/editor/schema/session material, both actual producer summaries, the source diff/callers, required test and producer editor/player probes. CLAUDE.md was ignored. The actual reviewed ancestor is from the committed Phase3 verdict, not an inferred short prefix.

## Re-executed commands

Every receipt contains actual argv, cwd, source HEAD/tree, timestamps, raw stdout/stderr and direct exit. All validation runs used the shared lock:

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock \
  timeout --signal=TERM --kill-after=15s <recorded-seconds>s <command>
```

`E` means `.omo/evidence/life-full-20260906/phase4-initial-verification`. Its Vitest config spreads the unchanged repository config and overrides only cacheDir. An empty `E/node_modules` contained config-loader temporary output locally; recreate it before replay because cleanup removed it. No timeout, assertion, include/exclude or product config was changed.

| Command | Receipt | Actual result |
| --- | --- | --- |
| `npm test -- test/lifeAuthoringBounds.test.ts --config E/vitest.config.ts` | `required.json` | **exit0;14/14, one execution** |
| `npm test -- test/databaseCharacterView.test.ts test/databaseCropView.test.ts test/databaseLifeCraftingView.test.ts test/p1LifeEditorAuthoring.test.ts test/toolActionAuthoringParity.test.ts test/p1WeatherCalendar.test.ts test/p0LifeSkillProgress.test.ts test/relationshipAuthoring.test.ts test/playSceneInterpreterCutsceneSkip.test.ts --config E/vitest.config.ts` | `related.json` | **exit0;103/103 across9 files, one execution** |
| `node E/diagnostics.mjs` | `diagnostics.json`, `diagnostic-results.json` | **exit0; zero syntactic/semantic diagnostics on all8 product files and1 test** |
| `npm run typecheck:app` | `typecheck.json` | **exit0** |
| `node E/editor.mjs` | `native-editor.json`, `editor-state.json` | **exit0; pass:true, two native viewport runs** |
| `node E/player.mjs` | `native-player.json`, `player-state.json` | **exit0; pass:true** |
| `npm run openwiki:index -- --check` | `wiki-index-check.json` | **exit1; known producer-disclosed stale index** |
| `git diff --check 966f414c07729e7d9474c568cbaf19a94d2bc740 HEAD -- src test openwiki package.json package-lock.json` | `source-diff-check.json` | **exit0** |

The exact index stderr is retained:

```text
openwiki/INDEX.md 가 낡았다. `npm run openwiki:index` 를 돌려라.
```

The producer explicitly left generated INDEX outside its assigned write scope. The parent must regenerate/check it during integration. This verifier did not edit it, absorb its exit1 or call all gates green. Required/related selections contain no failures/skips. No full build or whole-repository gate was rerun.

## Canonical task14 acceptance audit

| Criterion | Independent observation |
| --- | --- |
| Birthday follows authored calendar;40/40 accepted | Required test passes. Native1024x768 and1440x900 controls report max40; keyboard sets40; Ctrl+Z returns39; Ctrl+Y restores40. |
| Existing28/29 diagnosed without backfill | Required test passes. Native value29, aria-invalid and visible warning; serialization before/after rendering is byte-identical. |
| Profile-preferred automatic speaker/shared identity | Source helper/callers use linked profile; public runEvent/runCommands/playGiftSelection tests pass. Separate real player menu/dialogue/gift/talk display Linked resident and preserve one shared relationship owner. |
| Explicit command speaker retained | Native explicit text shows Explicit command, subsequent omitted text shows Linked resident. Unit also preserves explicit empty speaker rather than replacing it. |
| Omitted forecast1/intensity0.5 | Unit public forecast and render-purity cases pass. Native field1/range0.5 reflects true Firefox sanitization; no optional value is created just by rendering. |
| Explicit forecast3/intensity0.65 distinguished from omission | Native keyboard edit; undo restores omission and redo restores explicit values. LocalStorage/public Project4 codec roundtrip preserves all parsed values. |
|128 weather rules,129th refusal | Both native sizes add127->128 and undo/redo. Both add controls at128 produce zero store mutations and byte-identical serialization. Unit separately verifies no undo entry. |
| Skill max10; new rewards2..max | Unit exercises clamp11->10 and reward15->10, new reward2, max1 refusal. Native max11->10 and reward2 add/undo/redo/switch binding pass. |
| Legacy reward1 not silently changed | Unit/native display and roundtrip retain1. Source normalization/XP model remains unchanged; render does not convert it to2 or invent a grant. |
| Crop frames/labels/fallback truthful and no render backfill | Source change is prose describing actual rectangle/graphics-array/label consumers. Three crop-purity unit cases (omitted/empty/authored graphics) pass; real mounted crop card captured at both sizes. This is preserved baseline behavior, not a claimed crop behavioral fix. |
| Form render does not mutate/normalize project | Exact serialization checks in required test and real character/weather/invalid native rendering pass. Initial fixture normalization occurs before the measured render, not inside it. |
| Legacy/tool/scope isolation |103 related cases include Phase3 tool authoring and existing character/crop/skill/weather/interpreter seams. Diff contains only assigned8 product modules,1 test and editor wiki; no housing/save/recovery/dependency/schema version or tool resolver changes. |

The producer's `14/crop-baseline/REPORT.md` was read. It correctly separates original import/setup failures from8 actual baseline bounds/speaker failures and6 passing characterizations. Its three corrected crop-purity cases pass on baseline. This verifier reran the current14-case suite, not that historical baseline overlay; it does not rebrand crop prose as a behavioral fix or claim fresh independent TDD.

## Actual surfaces and authority

The inspected producer scripts were copied into this verification evidence directory. Adaptations are own output/cache paths, unused strict ports39912/39913, and runner config loading to avoid shared node_modules config-temp writes. `probe-provenance.json` retains original hashes. All mutation/DOM completion signals are armed before triggering input, with bounded event deadlines. Vite warmup awaits request-completion promises; there is no fixed sleep, timing retry or polling loop.

**Native editor:** Firefox at1024x768 and1440x900,16 successful subscribed edits per viewport, plus both zero-mutation over-limit refusals. Controls, keyboard input, Ctrl+Z/Y and store/history are real. Existing Life-group navigation uses its pointer-only group header; this is not falsely labeled an all-keyboard navigation journey. Engine-only fixture setup and invalid-data setup are explicit. Remote persistence is false before/after. Native roundtrip uses actual serialize/deserialize and localStorage, not production remote-save/import dialogs.

First roundtrip preserves complete parsed project equality but changes weather object key order from enabled/seasons/forecastDays to enabled/forecastDays/seasons. Therefore `stable:false` is retained, and the subsequent canonical byte-roundtrip is true. This does not weaken render byte-equality or discard any field.

**Native player:** Separate **player.html** with exportProjectStoreShim, not the editor shell. Only the project GET is substituted. Real keyboard talk/gift/interpreter paths show explicit and automatic names, friendship0->10, then a birthday-loved gift consumes one of2 potions and yields friendship170. The second event sharing the profile refuses another gift and another talk bonus, retaining potion1/friendship170. QA face setup changes direction only. No ownership/readiness/success outcome injection.10 recorded dialogue/menu observations; page errors0, attempted writes0.

**Network observations are not hidden:** the editor recorded local POSTs to its own `/__oprn/edit-activity` and existing loopback bridge `/v1/browser/hello`. Each viewport records5 bridge request failures (`NS_ERROR_DOM_BAD_URI`),10 total. These optional bridge failures are not successful integration and are retained in editor-state.json; all assigned native interactions still completed. They are not a claim of working bridge/remote integration. Nonlocal writes0, page errors0. Local audit files were archived under `local-edit-audit/` and removed from the task-owned output directory after browser/server shutdown.

**Images:**14 new PNGs, dimensions and SHA256 retained in `screenshots.json`. Reads of warning/weather images returned `Current model does not support images`; no visual-model readability/aesthetic approval is provided. These14 files are this execution's captures, not the producer's reported16-image collection.

## Compatibility and inherited limits

- Source diff leaves Project4/Save5/key families/raw preservation and proved-resource-only recovery unchanged. This lane does not independently re-certify every Save5 scenario; the separately verified housing source's lifeSaveVersion/public save checks provide scoped evidence, not an integrated merge test.
- The producer reports a successful task14 build; this verifier did not rerun it or claim its own build receipt. Diagnostics/app typecheck are fresh. Task11's latest additional build timeout remains separately disclosed.
- Phase3's whole wrapper exit124 at1200s, completed Vitest exit1 (13910 total/13676 pass/219 fail/15 pending), separate surface exit1,162 matching controlled failures and57 unexplained both-pass non-reproductions remain explicit. Not every original failure is proven inherited; audit-queue nondeterminism is unfixed. None of these gates was rerun or converted to green.
- Full task18 editor CRUD/remote-save/player journeys, image approval, task19 isolated remote save/reload and final F1-F4 remain open. No final task34 or overall completion decision is made here.

## Cleanup and handoff

`cleanup.json` confirms browser/context/server close receipts, removed owned editor/player/test/config-temp caches, successful bind to released ports39912/39913, archived genuine local audit output, unchanged tracked source and unchanged producer HEAD. No build/dist was created, no dependency bytes were installed/edited, no remote content was written, and no root-session state, main checkout, commit, merge, push or PR was changed. Canonical adoption link/env remain; the worktree stays locked for parent archival/removal.

**Evidence is gitignored and uncommitted. Preserve this complete directory explicitly before removing the tree.** `artifact-manifest.json` hashes retained artifacts. Scoped task14 behavior is confirmed with the known parent-owned stale-index correction and all limits above; combined Phase4 readiness remains unapproved because task11 needs a fix.
