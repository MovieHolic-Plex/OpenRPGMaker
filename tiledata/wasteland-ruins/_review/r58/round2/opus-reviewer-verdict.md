# r58 round 2 — fresh Opus adversarial reviewer (gate: slab-a PASS 7d73d55ac6ad, slab-b PASS 595ad1c0eb5f, slab-c REFER b581c2c9ecbb 2/4)

VERDICT: FAIL
1: FAIL — 128px layout shows ~1.75x inside 14x10; tone blotches, thin double slabs, light slabs and T-joint ticks sit at the same offsets; 36x24 reads as wallpaper.
2: FAIL — potholes at same y one period apart in the sample; dark brown ticks at almost every T-joint in slab-a; slab-a cracks recur in most periods.
3: PASS — lighter / mid slabs, a few weeds in joints (tone is layout-locked).
4: FAIL — reads as weathered granite/flagstone: crisp even teal joints, no legible spalled/missing corners, lifted/sunk slabs not legible, salt speckle reads as granite grain.
5: FAIL — pepper speckle + camo blobs (noise soup); pothole still a small brown oval on top of the surface; joint-end chips read as rivets/ticks.
OLD vs NEW: better (period 32-48px -> 128px, no chip at every joint, organic cracks), but repeat still visible on plazas > 8 cells.
FIXES: decouple tone from layout / more variants / weights 4:3:3 (composer); remove T-joint ticks, use 1-2 broken corners with lit broken edge; kill pepper speckle, 2-3 soft tone steps per slab; pothole larger (6-10px) recessed with dark north rim, lit south rim, pebble; vary joint width, one lifted/sunk slab legible, one split slab with offset; joints warm dark grey; larger plain panels, fewer subdivisions.
