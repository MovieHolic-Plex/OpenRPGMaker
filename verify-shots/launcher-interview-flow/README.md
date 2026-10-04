# Direct first-question launcher — 2026-10-04

This implements the approved `maker-first-question` flow in the actual game maker.

- Production component browser QA: PASS, eight checks. The first genre question appears inline, without a preliminary form, modal focus trap, movie playback, project folder or editor/store imports. Genre/answer buttons advance directly. All four genres fit 1024×768; keyboard focus and reduced motion work.
- Creation failure, storage failure and declined connection preserve the same confirmation screen. A successful **synthetic** creation transfers all five full answers, the original concept, protagonist and notes to session storage before navigating to a synthetic editor destination. This is not a real assistant request.
- Renderer and Electron builds completed. No local gates, Vitest or full typecheck were run under the session restriction.
- Correctly launched native app (0.117.0 base): fullscreen and launcher planning PASS; zero folders before confirmation, five direct answer clicks, cancellation creates no folder. The final request reached editor navigation. The renderer later crashed, before any `/v1/agent/run` was observed. Native art was still generating when the interview was cancelled; neither accepted art nor assistant execution is certified.
- The native QA launcher now uses the package root, matching `electron .`. Earlier runs opened `dist-electron/main.cjs` directly: that changes `app.getAppPath()`, hides the worker/catalog paths, and produces immediate `Invalid URL` image errors. Those earlier backend failures do not represent normal package startup.
- `package-root-native-proof.json` records the corrected native attempt, including canonical SQLite reload. `early-composer-native.png` shows the concise saved plan in the actual editor composer from the earlier file-entry attempt; it proves visible prefill only. It does not certify normal package startup or model execution.

The current native folder is under `output/qa/launcher-direct-interview/package-root/`. Use `scripts/qa/launcher-interview-native.mjs` after both builds; it launches the package root and records real requests, with no mocked services.

Do not describe this PR as end-to-end AI success. `component-proof.json`, `component-handoff.json`, and the native receipts deliberately separate synthetic boundary checks from actual backend execution.

---

# Launcher interview before project creation — 2026-10-04

This evidence concerns the game maker workflow, not a manually authored game.

## Observed results

- Production-component browser check: PASS. The interview mounts on the launcher without project/store/runtime imports, initial image generation, or folder creation. Choices pause/hide the movie. A synthetic image-provider failure retains a pixel still. Cancelling creates no folder. Final confirmation alone calls folder creation; a failed creation retains the confirmed draft for retry.
- Actual native build (0.115.0, this branch): planning PASS. The app starts fullscreen. The interview appeared on `app://oprn/start-screen.html` at 4.604 seconds. All five answers stayed on that page with zero project folders. Cancellation created no folder.
- Native art: FAIL. Three actual `/v1/images/generations` responses returned HTTP 500. The observed pixel background was the holding poster, not a newly generated answer-specific image.
- Canonical persistence: PASS. After final confirmation, the real SQLite project was opened again with `openLocalProjectStore().loadSnapshot()`: project `97f10a48-51a6-43aa-b71b-3f6a0243b062`, revision 3, romance genre, five answers, `generationPending: true`.
- Actual assistant execution: NOT VERIFIED / FAIL. No `/v1/agent/run` request or stored AI conversation was observed during the native attempt. The final desktop capture was blank. No crash/OOM cause has been established.

Do not describe this evidence as end-to-end success. Component auth/provider responses are synthetic; native requests are real. Screenshots in this folder are from the component check. Native output remains under `output/qa/launcher-interview-flow/native-2/`; the first 21 seconds of its actual recording are published as `maker-interview-before-project.mp4` in the conversation artifacts. Video timing after confirmation may differ from wall-clock time because the native capture dropped frames under load.

## Reproduction

Use the repository worktree launcher (`npm run dev:worktree`) and its allocated port:

```sh
MAKER_UI_URL=http://127.0.0.1:9812 node scripts/qa/launcher-interview-flow.mjs
npm run build:fast
npm run build:electron
LAUNCHER_NATIVE_OUT=output/qa/launcher-interview-flow/native-2 xvfb-run -a -s '-screen 0 1440x900x24' node scripts/qa/launcher-interview-native.mjs
```

Both builds completed successfully. Gates, Vitest and full typecheck were not run, in accordance with the session test restriction. `component-proof.json` and `native-proof.json` preserve the separate outcomes.
