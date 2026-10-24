# Acceptance protocol (from round 5 on)

Rounds 1-4 used one fresh argon judge per round on named family sheets. Its verdicts flipped between rounds (r4 failed 8 pieces r3 passed, with no
pixel change). Round-4 blind calibration (qa/blind.py, seed 11): 37 new pieces mixed with 16 Beodeul ORIGINAL kits under neutral codes.
- argon blind:  originals 6/16 pass, new 33/37 pass
- sonnet (klb-sonnet-5-5) blind: originals 8/16 pass, new 33/37 pass
Both judges are at least as strict on the originals as on the new pieces, so they are not lenient. The bar is NOT lowered:
**a piece ships only when BOTH independent judges (argon + klb-sonnet-5-5) PASS it in the same blind mixed sheet** (unanimous, not majority).
Any FAIL from either judge -> redraw -> new blind sheet (new seed, new judge processes). The originals stay in every sheet as controls.

## Round 6 note: judges are noisy on unchanged pixels

8 pieces passed both judges in r5 and then failed one judge in r6 with byte-identical pixels (log-short, log-long, log-mossy, shroom-ring,
bush-s, fern-s, fern-l, rock-pair). So a single earlier unanimous pass is not enough. The stricter rule is used: **the final bundle bake needs
every one of the 37 current pixel hashes to pass both judges in the latest blind sheet.** Any fail on current pixels -> redraw, even if an earlier
round passed the same pixels. Per-hash record: `qa/ledger.json` (`python3 qa/ledger.py status`).
