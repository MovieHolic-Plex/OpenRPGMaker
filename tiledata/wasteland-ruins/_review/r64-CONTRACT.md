# wasteland_ruins r64 — scale up again, measured from Beodeul (worker brief)

The user looked at r63 and said the wasteland objects are still a bit small. The target is now measured from Beodeul
kits standing next to the same hero (Actor1 24x32, visible figure 24 px, drawn 1x on 16 px maps).
Measured Beodeul heights (opaque px, ratio = height / 24):

| Beodeul object | px | ratio |
|---|---|---|
| small hut / cabin (snowfield-hut, pierhut, cabin-small, storehouse) | 62-66 | 2.6-2.75 |
| shed / barn (snowfield-shed, farm-barn, winery) | 82-93 | 3.4-3.9 |
| houses (h101_2, h102_1, mining d1/d2/s2) | 65-108 | 2.7-4.5 |
| tent (goblin-tent, oasis tent) | 35-39 | 1.5-1.6 |
| stall (cloth stall, oasis stall, fish stall) | 44-46 | 1.8-1.9 |
| cart / wagon (veg cart, flour cart, covered wagon) | 25-42 | 1.0-1.75 |
| survivor tarp lean-to | 31 | 1.3 |
| lamp post / lantern | 40-42 | 1.7 |
| boulder | 24 | 1.0 |
| dead tree (swamp snag) | 45 | 1.9 |
| fence | 15-16 | 0.65 |
| barrel / crate | 14 / 13 | 0.6 |
Doors 10-12 x 24-26 px, storeys 30-34 px, windows 8-10 px framed (unchanged from r63).

When unsure, size UP, not down. Every dwelling must be at least as tall as a Beodeul small hut (>= 64 px = 4 cells tall).

## Gate (you run it yourself; this is a hard requirement)
Every redrawn piece must pass the 3/4 object-gate, which also judges STYLE against Beodeul:
at least 4 shading steps per material (light top plane, mid, shadow, dark), no large flat single-colour fills,
texture on every surface (plank lines, corrugation, rust streaks, rivets, cloth folds), no black outline.
Last round several redraws failed only on style ("판정자 fail", "평면 채움", "명암 3단 < 4"). Read the old receipt's
styleAnswer.evidence for your piece if you want the judge's words:
    python3 - <<'X'
    import json,glob; [print(f, json.load(open(f))['runs'][0].get('styleAnswer',{}).get('evidence','')[:600]) for f in glob.glob('harness-data/object-gate/receipts/*/<sha-prefix>*.json')]
    X
How to run the gate for your ids (from the repo root, with the PYTHONPATH below):
    GATE_ITEMS=/tmp/r64-<you>.jsonl python3 scripts/content/wasteland-ruins/wl_all.py gate id1 id2 ...
    timeout 3000 npm run -s harness -- object-gate review --batch /tmp/r64-<you>.jsonl 2>&1 | grep -E '^(PASS|FAIL|REFER)'
It takes 10-20 minutes. You may run it at most 3 times. Aim for PASS; REFER is acceptable; FAIL is not.
Do not edit receipts, profiles, approvals or anything under harness-data. Do not change the gate.

## Style and file rules (hard)
- Code hand pixels only, locked palette (K(...)), no generated images, no people. 3/4 top-down: top plane + front face.
- Keep each piece id and its look/materials; change w,h in @piece and update solid/door cells (door cell on the bottom row).
- Edit only your own pieces' functions with the Edit tool. Other workers edit other pieces in the same files concurrently.
- If a helper is shared with pieces that are not yours, copy it instead of changing it.
- Do not run tests, vitest, gates (other than object-gate review above), git stash/commit, or the bake. Do not touch src/ or legacy_r62/.

## Check
    cd /home/main/z-project/rpg-zzu-village-art
    export PYTHONPATH=src/harnesses/_core:src/harnesses/modern-chipset
    python3 scripts/content/wasteland-ruins/wl_scale_sheet.py /tmp/r64w-<you> --only id1,id2     # prints heights + ratio
    python3 scripts/content/wasteland-ruins/wl_all.py palette | grep -E 'id1|id2' || true          # must print nothing

## Report
Per piece: old -> new cells, drawn height and ratio to hero, the Beodeul object you matched, and the final gate line (PASS/REFER/FAIL with sha prefix).
