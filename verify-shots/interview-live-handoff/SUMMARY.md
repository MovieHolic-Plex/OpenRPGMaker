# Actual interview → AI → canonical project QA — 2026-10-03

The packaged renderer was built from this branch. A dedicated loopback project host (9896) and QA folders under ignored `output/qa/interview-e2e/` kept all writes separate from user projects. Actual Electron launcher coverage is in `../interview-desktop/`; the dialog matrix is in `../interview-adversarial/`.

## Initial generation

`node scripts/qa/interview-live-handoff.mjs` exercised the real project menu → New Game → romance interview → authored protagonist and summary → new SQLite folder → automatic team request.

`report.json` passed: the actual model request carried the internal P03 execution tasks, authored protagonist and scope, while the user bubble contained the short direction only. The connected model applied `set_project_settings` and `set_title_screen`; canonical commits and a same-project/brief reload confirmed persistence. The initial run was deliberately stopped after those checkpoints. This is not a whole-game completion receipt. `assistant.png` precedes the final cosmetic genre-label correction; the selected-genre prefix is covered by the final serializer/display test.

The first attempt rejected every checkpoint as `stale-base`. `before-stale-base.json/png` records that failure. Boot's delayed shared-reference refresh changed four tilesets after the proposal base was captured. The new boot barrier waits for those references and their canonical flush before capture. No stale-base or user-edit protection was disabled.

## Actual composer content write

`node scripts/qa/interview-followup.mjs` uses the **real input and send button** with `interview-content-prompt.txt`; it does not write fixture content directly into SQLite. `followup.json` passed: actual Pi requests → native NPC event at (11,8) → canonical save → same event after a new load. The first dialogue and both requested choices match exactly; the saved interview/protagonist remains identical. No page errors.

Canonical project id: `d4eeda26-ba1b-435a-87af-30543e5f541a`. Folder: `output/qa/interview-e2e/project/.oprn-projects/438f9721-2df4-4b5e-a9e4-a41041dcc60b`. Revision 8 contains `ev_interview_qa_neighbor`, the first line “지우, 이웃에 오신 걸 환영해요.” and two different response branches. `content-assistant.png` shows the actual applied result (the run is stopped after persistence); the NPC's default sprite is explicitly a QA placeholder, not a protagonist decision.

An earlier harness incorrectly used `window.__oprnAiBridge.send`: that registered entry dispatches external/DB requests through AssistantSession, whereas the composer and interview boot handoff use Pi. That attempt stayed in repeated draft verification and was stopped; `before-content-timeout.json` records it. It is not evidence of the actual composer path. The standalone public bridge route's completion behavior was not repaired or certified here.

## Player verification

`node scripts/qa/interview-export-runtime.mjs` reads the same project through its active host API, hydrates 393 canonical media references into an **ignored QA export only**, and records the project id/revision in `runtime-export.json`. It does not open a second writer against the live database.

Run the dedicated export-player harness, not editor play mode:

```bash
npm run qa:runtime -- --scenario interview-handoff --browser firefox --out verify-shots/runtime-qa/interview-handoff
```

Read that runner's SUMMARY first. The scenario checks the AI title, opening, starting field/sprite, neighbor interaction and visible choice menu. The initial result failed four of five beats; it is preserved unchanged in `player/initial-SUMMARY.md` and `player/initial-manifest.json`. Corrected-input Firefox and Chromium retries both timed out before the title appeared (120 seconds). These are failed/incomplete gameplay checks, not passing evidence of dialogue or choice execution. No entire-game completeness or all-genre live-model coverage is claimed.

## Other checks and limits

`../interview-adversarial/validation.json` records 133 distinct passing focused tests, six failures and two errors reproduced on unchanged main, passing packaged/Electron builds, app types and barrel checks. All six CSS axes fail on both main and this branch. Surface tests showed existing snapshot failures but exhausted process heaps before all ten axes reported, including constrained-worker/heap retries. No full surface pass or complete repository suite is claimed; no snapshots or gate baselines were rewritten.

The first player attempt assumed a single Enter immediately started the game. An authored title sequence intentionally consumes its first input to skip the intro; the scenario now waits for `data-seq-state=done`, then sends the actual start input. The old failure is in `player-before-sequence-skip.md`. Separate `prepareWebExport` probes on the full QA document crashed both Chromium and Firefox (`export-preparation-limit.json`); the canonical dedicated-player fixture is not a passing shipping ZIP/export-package receipt.

A final production-build player probe (`9896/player.html`, Firefox, the same canonical fixture and dedicated `runRuntimeQa` instrumentation) also timed out before title visibility at 120 seconds. `player-retries.json` and `player/retry-errors.txt` record all retries. The first run's required screenshots were inspected: later grass/actors appeared, but no NPC dialogue or choice menu was visible. Runtime playability is **not certified**, and these failures have not been compared against unchanged main. Their root cause remains unresolved.
