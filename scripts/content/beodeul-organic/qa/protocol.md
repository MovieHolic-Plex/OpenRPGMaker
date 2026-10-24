# Acceptance protocol (from round 5 on)

Rounds 1-4 used one fresh argon judge per round on named family sheets. Its verdicts flipped between rounds (r4 failed 8 pieces r3 passed, with no
pixel change). Round-4 blind calibration (qa/blind.py, seed 11): 37 new pieces mixed with 16 Beodeul ORIGINAL kits under neutral codes.
- argon blind:  originals 6/16 pass, new 33/37 pass
- sonnet (klb-sonnet-5-5) blind: originals 8/16 pass, new 33/37 pass
Both judges are at least as strict on the originals as on the new pieces, so they are not lenient. The bar is NOT lowered:
**a piece ships only when BOTH independent judges (argon + klb-sonnet-5-5) PASS it in the same blind mixed sheet** (unanimous, not majority).
Any FAIL from either judge -> redraw -> new blind sheet (new seed, new judge processes). The originals stay in every sheet as controls.
