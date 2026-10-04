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
