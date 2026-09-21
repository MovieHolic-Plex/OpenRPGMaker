# Independent review and applied corrections

Three existing GPT-6 Astra xhigh subagents worked in isolated worktrees; only the root
agent authors LegacyDb content. The final gates are run by the root directly.

- House review A found that a shuffled round-robin catalog repeated tall houses too
  often. Root changed automatic selection to unique-first, then favor small footprints
  with a per-design repetition limit. A checked 768 count/seed/fixed-plan combinations;
  root's integration test checks the actual registered tool at explicit/automatic sizes.
- A reproduced a log-wall tile 133 placed on the upper layer escaping the initial filter.
  Root now checks all raster layers; the focused contract test covers that case.
- Vegetation review C opened the integrated preview and detail images. Its pre-final
  88×80 review found no tree adjacency defects, no house-roof tree intrusions, zero grass
  autotile mismatches, and all 26 doors reachable. Those counts describe that preview;
  use the final build/render/remote proofs for the saved map's actual dimensions and counts.
- Lake review B found the initial avoided-road fallback too round despite its asymmetric
  bays. Its follow-up increases horizontal aspect ratio and lowers the minimum area so
  a long lake can fit beside the boulevard. Canonical water rendering uses the shared
  renderer's depth appearance; this task does not patch that renderer.

The first sparse 128×128 draft is retained in the project, but is superseded visually.
The reference art remains a target, not a claimed pixel-for-pixel reconstruction.

## Final saved 80×80 review

C opened the final overview and both detail images and matched the reloaded project SHA
with the renderer proof. No new visual defect was found. Independent checks confirmed:
26 houses with a minimum two-cell bbox gap; zero hard tree adjacency errors, water-canopy
overlaps or house-protection intrusions; 661 grass cells with zero isolated anchor chips
or autotile-variant mismatches; all 31 exact public/door targets reachable. The single
249-cell lake has 26×13 bounds and the south bench entry (66,78) remains open.
This review made no file, code or remote DB changes.

## Whole-repository regression found and corrected

The completed root full gate found two new `villageHouseSigns` failures. The full gate
caught a real legacy-path regression: role assignment replaces house-array entries, while
an earlier filtered list retained the old entries without shop/inn programs. Root moved
role assignment before filtering; no test expectation was relaxed. The compact saved-object
path has no legacy entries, so this correction does not change its saved map.
The other new failing file, `spatialGeographyDatabaseMount`, passed a focused rerun unchanged.
Final targeted and app typecheck results are recorded in `gates-proof.json`; the full suite
is not represented as an all-green or post-correction full rerun.
