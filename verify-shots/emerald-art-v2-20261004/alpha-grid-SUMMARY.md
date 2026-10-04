# Shared alpha/background and fixed import grid — 2026-10-04

Focused verifier completed, exit0. No gates, Vitest or full typecheck.

Inspect first: alpha-white-baseline-grid.png, alpha-white-grid.png; sample-original.png and sample-fixed-grid.png.

- Majority alpha<128 corner samples establish an explicit transparent background; hidden corner RGB is then excluded from RGB flood inference.
- Transparent-white connected foreground fixture: old mask erased1216 opaque foreground pixels, fixed mask preserves all1408 foreground pixels. Random hidden RGB and alpha0..127 give the same mask. Alpha128 remains foreground.
- Opaque flat, magenta and exterior-white background cleanup remains active. Opaque flat background with one internal alpha0 hole also cleans correctly.
- Actual CLI import in private sandbox: fixedBlock and candidates[0].block both equal2/8/40;7 invalid values rejected; no-block import infers8 and omits fixedBlock. Static imports executed; action override wiring was reviewed but not executed because this verification makes no picks.

## Actual sample and cause limits

Actual glaciermane-front-raw.png512×580 corners are [24,29,37,0], [25,26,27,0], [33,34,37,0], [24,25,27,0]. The hidden RGB is dark gray, not white. At fixed block8, old mask erases0 pixels of the131475 foreground pixels. The variant changing ONLY alpha<128 hidden RGB to white also loses0 foreground pixels: its opaque white interior is separated from the outside RGB flood by outlines. Do not attribute this sample's existing size/fragment damage to white-background flooding. The connected-white fixture independently proves the general alpha/RGB bug; wrong auto-grid sizes remain a separate concrete cause handled by reviewed --block.

Current original, hidden-white-alpha variant, and opaque-magenta-background variant all produce byte-identical grids at block8. Variant preparation retains every source foreground pixel unchanged; magenta variant changes only the background pixels. No new art was generated or approved. The historical baseline-grid.ts was extracted read-only from worktree base7dd901994ac6 and uses the same shared image/Lab helpers. Preview actual baseline is raw grid cells while fixed preview additionally includes existing palette cleanup; mask erosion counts, not preview color differences, are the causal comparison.

## Command / sandbox

```
node_modules/.bin/vite-node --script src/harnesses/monster-collect-species/node/verifyAlphaGrid.ts -- /tmp/oprn-emerald-art-v2-20261004/alpha-grid-fix/verification /tmp/oprn-emerald-art-v2-20261004/monster-candidates/glaciermane-front-raw.png /tmp/oprn-emerald-art-v2-20261004/alpha-grid-fix/baseline-grid.ts
```

Only a private sandbox seed copy and fixture candidate run outputs were written. No generation, pick, build, ledger or canonical project changes. Earlier two attempts failed in verification setup: optional historical TS import outside Vite allowlist, then an invalid assumption that this particular actual sample must lose white foreground. Baseline loading now uses Node24 TS support and actual loss is reported without assuming it. Final fixture result includes the later internal-hole guard.
