# Old hero — hostile baseline review

Verdict: **REJECT**. A structural pass is credible but does not make this finished character art.

Evidence: decoded `source/hero/walk.gif` in full: 68x32, 4 frames, 90ms each, infinite loop, four directions displayed together. Inspected all four frames in native and nearest-neighbor 4x contacts, and all twelve poses in `charset.png` at native/4x. Contact artifacts are in this directory. No claim of having watched a browser animation is made.

## Concrete defects

- **Silhouette:** the 8px-wide helmet-like head narrows into a 2px neck, the torso becomes a rigid rectangle, and 1px skin columns form the legs. At native size it resembles a pole-and-box puppet rather than a compact, weight-bearing adventurer. The profile is especially reed thin. The shoulders/hips have no persuasive shape transition.
- **Face and cap:** the front cap is mostly a large navy slab with a red band and red tips, so the brim, hair and cap mass compete instead of defining a clean cap. The two face dots sit in a tiny skin triangle below it. The profile has a forward red/blue nub without a strong forehead/nose separation. The back reads as a dark helmet narrowing to a pointed neck.
- **Vest/body:** the front vest is a flat dark blue square under a cream stripe, then a conspicuous red/gold horizontal belt; shoulder construction and waist/shorts separation are weak. Profiles alternate small dark/cream angular bars, so swinging arms look like bending pieces of a diagram rather than sleeves and hands attached to a torso.
- **Legs/feet:** stepA/B do change opposing leg/shoe positions, so this is not literally a static-leg fake. But the bare legs are thin stalks with extra dark stair pixels, and huge horizontal brown soles look pasted on their ends. Profile idle fuses shoes into one long dark base; stride poses suddenly produce long soles and kneed zigzags. Contact reads as a scissor shuffle, with little convincing weight transfer.
- **Backpack:** up view has a dark square containing tiny gold and red blocks, without convincing rounded pack mass, straps, or shoulder attachment. Profile gold is a 1px vertical column: it reads as a stripe, not the same gold-red bag. Front red/gold pixels read as an unrelated belt. The nominal palette identity survives, but the accessory itself does not.
- **Pixel craft:** repeated dark outline ladders and 1px skin sticks occupy more of the anatomy than useful interior clusters. The navy shades are nearly indistinguishable at native size; isolated highlight pixels add detail without improving volume. All head frames are exact copies, amplifying the hinged-puppet body action.
- **Loop:** all four decoded frames and 90ms timings are consistent and final idle equals the earlier idle. No file-level seam or random recolor is evident. This earns limited loop credit; it cannot redeem the weak anatomy or stiff motion.

## Fixed rubric result

| Axis | Score/max |
|---|---:|
| Silhouette | 7/20 |
| Anatomy | 6/20 |
| Walking | 9/20 |
| Pixel craft | 6/15 |
| Hero identity | 5/15 |
| Direction continuity | 4/5 |
| Loop | 4/5 |
| **Total** | **41/100** |

Critical failures: CF1 (pole/box human silhouette) and CF4 (backpack loses its shape and gold-red identity in profile). CF3 is **not** assigned: limbs do alternate, although execution is poor. No automatic pixel-change gate can distinguish this from good walking without semantic review.

The immutable candidate rubric is `rubric.json`: minimum85/100, every axis minimum, no critical failures, complete evidence and native structural contract. Do not lower criteria to make the next drawing pass. Prioritize compact anatomy and a volumetric, attached backpack before adding decorative pixels.
