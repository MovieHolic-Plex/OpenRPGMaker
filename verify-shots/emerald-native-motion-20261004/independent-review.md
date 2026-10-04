# Independent native character visual review

**Verdict: specific art revisions required; no approval granted.**

## What was actually observed

- All 16 original 48×128 walking atlases, all 192 native 16×32 poses: up/right/down/left × stepA/idle/stepB. The original gallery 1×/3× phases and private whole-atlas integer zoom captures were inspected.
- All 17 original trainer portraits at native 1× and integer3× in gallery. Revised hero back was opened directly and captured at1×/3×.
- Old professor six-frame native strip, newly generated professor-r2 six-frame strip, and resident-r2 native portrait directly plus1×/3× display captures.
- Exact source paths and SHA256 are in `independent-review.json`; diagnostic professor windows and deltas are in separate metrics JSONs. No source PNG was resized, edited, composited, or rewritten during this review.

## Walking directions and gait

All 16 roles face correct directions in all three poses: up is rear, right right-profile, down frontal, left left-profile. No row swap observed. The orange mark in hero up is the backpack. Heads, hats, broad outfits and major props remain coherent across directions. Most poses read as wide stepA → closed idle → wide stepB.

Hero, student, and resident **right and left stepA/stepB** retain very similar wide foot silhouettes; changing depth colors is difficult to read as alternating lead legs at1×. They animate, but the gait remains weak. Merchant/mother apron/dress hides some feet. Company agent dark trousers have weak1×leg contrast and need an actual-map background check. No claim that equal alpha silhouettes alone are a bad gait, and no assertion that A/B drawings are identical.

## Field/trainer identity

- **Old resident: high priority mismatch.** Field is dark-haired/orange dress; old battle trainer mint top/yellow skirt. Native extraction preserves a preexisting mismatch in the original64×96 source. **New resident-r2** dark ponytail/orange one-piece dress resolves this visible mismatch; native1× outfit silhouette remains readable.
- **Old nurse: high priority mismatch.** Field nurse has broad pink side locks and cap/uniform; old trainer has a different long ponytail/hair silhouette and dress. New nurse remains unreviewed at report time.
- **New hero_back: improved and coherent.** Waist-up view, navy/red cap, orange backpack, ball raised; fixes old full-body composition.
- Other roles preserve broad identifiable outfit/head/prop cues: mother cream/purple, merchant moustache/apron, captain white cap/navy, worker yellow helmet/orange vest, explorer safari hat/red backpack, ranger green uniform/cap, hiker red cap/backpack, gym green hair/outfit, company pale hair/dark suit, student navy/white/purple bag, moon leader pale hair/purple, hero navy/red/white/teal, rival brown/navy. Native1× role readability does not establish original Emerald-level art quality; elongated anatomy from old full-body source often remains.

## Professor old versus revised

**Old six poses:** actual blink, talk and three distinct gestures are present. Frame3 head/glasses/hem redraw is visible; bottom rises1px. Frame5 bottom boundary extendsleft1px. Old diagnostics: head window includes neck and can overlaporb; y55..63window includes shoes/hem. Pixel differences are descriptive, not an automatic expression failure.

**Professor-r2 requires another anchor correction.** Native1× and3× inspection shows pose0/1/2 shoes ending at exclusivey59, pose3/5 at62, pose4 at61. The gesture poses drop/lengthen legs2–3px, visibly altering stance despite the intended fixed camera/feet. Head diagnostic bbox stays `[20,2,44,21]` in all frames; redraws of glasses/hair are still noticeable. Blink1/talk2 have actual different pixels and gestures3/4/5 are readable, but fixed stance is not achieved. See `independent-professor-r2-metrics.json`.

## Review limits and pending final checks

This is a read-only visual review, not a runtime pass or an approval ledger. No canonical writes or asset changes were made. Gallery140ms cycling is not the final authored scene timing. Enter/BGM/controller cleanup/player walking playback belongs to the separate runtime probe. Root is regenerating nurse and selecting final candidates; root must inspect the exact final PNG/SHA before recording approval. Old-pack findings must not silently carry over as a pass for new bytes.
