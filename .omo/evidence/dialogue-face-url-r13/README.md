# R13: exported dialogue portrait URLs

Base: `fe3a6d88a91b8f2600b8992f198cf0eb0604adac`.
Scope: dialogue URL validation only; resolver, export boot, assets and game content unchanged.
Read the exact R13-R16 review and round3 REPORT, chief receipts and saved project before repair.

## Red-green

- RED: `npm test -- test/dialogueImageUrls.test.ts --maxWorkers=2` exited 1:
  **3 failed / 15 passed**. HTTP root, HTTPS nested and encoded-subpath exports
  rendered `.missing` instead of `.dialogue-face-image`. Editor-root, inline and
  all invalid-URL cases passed. Full assertion output: `red.log`.
- GREEN: `npm test -- test/dialogueImageUrls.test.ts test/dialogue.test.ts test/exportBattleAssetUrls.test.ts --maxWorkers=2`
  exited 0: **43 passed, 3 files**, in a single run. `green.log`.
- `npm run typecheck:app`: exit 0 (`typecheck.log`). LSP diagnostics: none for
  `src/player/dialogue.ts`, `test/dialogueImageUrls.test.ts`, and `browser.mjs`.
  Markdown has no configured LSP server. `git diff --cached --check`: exit 0.
  Command logs have only their trailing blank lines removed for diff hygiene.
- No new type/non-null assertions, any types, sleeps, polling, prose pins or gate changes.
  Tests finish typing with real keyboard dispatch, not elapsed time.

The ten-line production addition accepts parsed HTTP(S) PNG/JPEG paths, preserving
resolver-provided subpaths and encoded directories. Quotes, backslashes and control
characters cannot escape the quoted CSS value. Existing root and PNG/JPEG base64
handling is unchanged; JavaScript, VBScript, file, FTP, blob, SVG and audio inputs
remain rejected. Malformed absolute URLs fail closed.

## Dedicated-player evidence

Replay from this worktree (requires the archived snapshot and installed Firefox/Xvfb):

```sh
xvfb-run -a node .omo/evidence/dialogue-face-url-r13/browser.mjs \
  /home/main/z-project/rpg-zzu-ai-playable-adversarial-0906/output/evidence/ai-playable-final/round3/final-player-project.json
```

Verified in headed Firefox through `startPlayerQaServer` / `player.html` /
`exportProjectStoreShim`, not the editor shell. The helper owns an ephemeral port,
and closes its browser and Vite server in `finally`. No external server or `.env.local`
was changed; occupied port 9841 was not used.

`browser.json` records:
- Project HTTP 200 and exact body equality with the unchanged round3 snapshot,
  SHA256 `a3ef0e998d28d0eb22b9c79479fd4a48e4dc1bb2d7f969a5330e1f00df7db713`.
- Real title Enter, thirteen keyboard movement taps to chief approach `(4,13)`,
  existing QA `__oprnInput.face("up")`, then real Enter to execute the chief's
  existing changeFace/text commands. No teleport, seeded inventory, or authored
  replacement dialogue/game. This is narrow portrait QA, not a full journey claim.
- A MutationObserver subscribed before interaction observed `.dialogue-box.page-ready`.
  The chief face has `dialogue-face dialogue-face-image`, not `missing`; computed
  background is `http://127.0.0.1:36069/assets/easyrpg/faceset/People1/06.png`.
- Image handlers subscribed before setting `Image.src`; load and decode succeeded,
  natural size **48x48**. The actual CSS image response was **200 image/png, 4826 bytes**,
  byte-equal to the shipped PNG, SHA256
  `d50d1b3a6ae84f56508ae59fe0db6602367f7906543a2ff424ae26ff593a4f02`.
- No page errors. Screenshot: `chief-portrait.png`. The model could not inspect the
  image attachment; image readiness, geometry and equality are machine evidence,
  not a subjective visual-art approval.

Setup corrections before valid evidence: the first test fixture used unnormalized
inline table keys, corrected to the producer's actual `assets/...` contract; the
first browser attempt named the QA face hook on `__oprnDebug` rather than
`__oprnInput`. Neither required a production change or delay. Recorded RED and
GREEN use the corrected fixture; recorded browser proof is the successful run.

## Limits

Root-export image loading is browser-verified; editor-root, nested/encoded export
and inline resolution are DOM-contract tests, not additional browser deployment runs.
No DB/game content writes, remote reload, new model generation, full player journey,
full build/gates, push/PR/merge or main edits were performed. Those acceptance tracks
remain parent-owned. R13 evidence is not R6/R16 completion or ultrabrain approval;
round3 remains archived/blocked, and PR653's external merge is not approval.
