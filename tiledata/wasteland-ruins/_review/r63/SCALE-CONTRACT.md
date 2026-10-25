# wasteland_ruins r63 scale contract (worker brief)

The user found wasteland objects at a different scale from Beodeul. Two independent reviewers (verdicts in
tiledata/wasteland-ruins/_review/r63/review1/verdict-A.md and verdict-S.md — read both, plus the scale sheets
scale-wasteland-3x.png and scale-beodeul-3x.png in the same folder) agree: doors, storeys, eaves and awnings are
drawn smaller than the hero. You redraw the pieces assigned to you so they match Beodeul proportions.

## The hero and the Beodeul ruler (16px tiles, 3/4 top-down, hero drawn 1x)
- Hero = Actor1, 24x32 frame; the visible figure is 24 px from feet to top of hair, about 16 px wide.
- Beodeul (measured): house doors about 10-12 px wide x 24-26 px tall; a storey (wall band) 30-34 px;
  windows about 8x8 to 10x10 plus a 1 px frame; cabin front wall about 34 px; crate 13 px; barrel 14 px;
  covered wagon 64x48 (drawn 42).
- Rules for every dwelling, shelter, stall, gate:
  - door / opening: 10-12 px wide, 24-26 px tall (a crawl-in tent opening may be 16-18 px).
  - front wall height (ground to eave) at least 28 px; a storey 30-34 px. Never squeeze more storeys into a
    height than 30-34 px each allows: either drop storeys or make the piece taller (more cells).
  - windows 8-10 px tall inside a frame. No 5-6 px windows.
  - awnings / roofs over a walk-in space: eave at least 28-30 px above the ground; counters 12-14 px high.
  - gate: at least 28-30 px clear under any crossbar, opening at least 24 px wide.
- Vehicles at the same world scale (hero 24 px = 1.7 m, about 14 px per metre): car about 64 px long, body side
  about 20 px plus the roof top plane, wheels 9-10 px (car-rust-h 4x2 cells, car-rust-v 2x4 cells);
  van about 80x48 (5 cells x 3 cells) with a ~28-30 px body side.
- Street lamp 16x48 (about 2 heroes). Dead tree 48x64 or so. Wash line posts about 24 px, clothes 10-12 px (48x32).

## Style rules (unchanged — these are hard rules)
- Code hand pixels only, in the existing wl_*.py modules, using the locked palette helpers (K(...), C.* helpers).
  No generated images, no people.
- 3/4 top-down: every object shows its top plane (roof / lid / wall tops) AND its front face. Keep the existing
  look, materials, rust, tarp colours and detail density of each piece; you are changing proportions, not the theme.
  Look at the current render first and keep what works.
- Keep the piece id. Change the cell size w,h in its @piece(...) as needed, update solid / door cells to match
  (door cell = the cell the hero walks into, on the bottom row). Pins are append-only and keyed by id + cell, so
  resizing is safe; never edit tiledata/wasteland-ruins/pins.json yourself.
- Do NOT rewrite whole files. Use the Edit tool on your own pieces' functions only — other workers are editing
  other pieces in the same module files at the same time.
- Do not run npm, tests, gates, vitest, git stash, git commit, or the bake. Do not touch src/.

## How to check your work
    cd /home/main/z-project/rpg-zzu-village-art
    export PYTHONPATH=src/harnesses/_core:src/harnesses/modern-chipset
    python3 scripts/content/wasteland-ruins/wl_scale_sheet.py /tmp/r63w-<you> --only id1,id2,...   # hero next to your pieces + Beodeul refs, prints heights
    python3 scripts/content/wasteland-ruins/wl_all.py palette | grep -E 'id1|id2' || true             # must print nothing for your ids
Open /tmp/r63w-<you>/check-3x.png with Read and measure (crop with PIL) door height, storey height, window size,
eave height. Iterate until every number meets the contract and the piece still reads as the same object.

## Report
Return: per piece, old size -> new size (cells), and measured door / storey / window / eave px. Paths of your check PNGs.
