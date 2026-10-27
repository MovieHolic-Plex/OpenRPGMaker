# Adversarial check (r64): are the wasteland objects now at Beodeul scale?

The user said that after r63 the wasteland objects were "still a bit small". We measured Beodeul objects next to the
same hero (Actor1, visible figure 24 px, 1x on 16 px maps) and redrew the wasteland objects to those ratios.
You are an independent adversarial reviewer. Judge only scale against the hero and Beodeul. Do not be kind; do not invent.

Files in /home/main/z-project/rpg-zzu-village-art/tiledata/wasteland-ruins/_review/r64:
- pairs-1x.png / pairs-3x.png: one row per category. Left of the gold line: hero + the Beodeul object (label BD, height, ratio).
  Right: hero + the wasteland objects of that category (label WL). pairs.json has the numbers.
- scale-wasteland-*.png: hero beside every wasteland object. scale-beodeul-*.png: Beodeul references.
- map-settlement4-hero-*.png, map-shanty3-hero-*.png: composed wasteland maps with the hero. map-beodeul-vineyard3-hero-*.png: a Beodeul town.
lean-doors still has its old small art (its redraw failed the style gate); list it but do not let it alone fail the verdict.

Output exactly:
VERDICT: PASS or FAIL   (PASS = in every category the wasteland objects read at least as big as the Beodeul one, within about 10%, and the maps read at the same scale as the Beodeul town)
## Per category
- <category>: PASS|FAIL — BD ratio vs WL ratios, what still reads small
## Still small
one line listing any wasteland ids that still read small
