# 청운 검희 — original native pixel candidate

- 64×64 literal ASCII grids: 9 base poses and 9 action/status poses. Shared palette has 18 exact RGB colors; `.` is transparent. All ink stays within x1…62/y1…60; idle soles touch y60.
- Original identity: high black ponytail with a navy tie, clear forehead, short turquoise crossover jacket, slim rose-red sash, long split side panels, slate trousers and two separate small dark shoes. The rear hip scabbard stays compact.
- References were observed for adult SD proportions, restrained eyes, layered cloth and weapon vocabulary. No reference pixels were extracted. Only `source/` was written.
- Face clusters were chosen per pose: two separate brows, small rightward pupils, warm nose/chin planes. Hit/poison narrow the lids; stun opens the mouth; sleeping/fallen eyelids are closed.
- Light comes from upper left. Teal cloth uses broad shoulder/sleeve planes and directional folds; trousers have broad lighter thigh planes; hair has connected slate highlights; steel has a narrow bright edge.
- Idle breathing changes sleeve, shoulder and side-panel clusters. Windup draws the blade from the waist. Move/attack widen the stance, trail the ponytail and pull the panels behind the hip. Recover bends the front knee and lowers the blade. Hit opens the chest and recoils. Dead has an independently drawn horizontal body, bent knee and resting sword.
- Skill preparation gathers at the shoulder-held sword tip; contact releases two unequal thin branches from the real tip; recovery lowers the blade and leaves individually drawn separated remnants.
- Poison alternates an abdomen clutch with a mouth-covering cough and moved bubbles. Stun has slack arms, open mouth and two separately placed stars. Sleep alternates a deeper nod, shoulder breath and changed knee/panel clusters, with closed eyes and a lowered sword.
- Inspection corrections: redrew the move/attack/recover cheek and jaw rows to remove excessive tilt; joined the move grip to the blade; assigned every lowered blade row its own position to remove unintended bends; replaced heavy blade borders with three-tone steel clusters.
- `author_pixels.py` records chosen literal runs/row replacements. Helpers only write those pixels or decode them. `inspect_pixels.py` creates inspection images and checks file dimensions/palette/margins; no project tests/gates were run.
- Saved evidence: `progress/idle.png` native checkpoint, `progress/face.png` nearest 8× face checkpoint, per-frame native PNGs and `progress/contact-sheet.png` with native + nearest 4× views.

## Remaining visual limits

The compact sleeve/grip reads most clearly when enlarged. The contact gust approaches x62 and has little room for a longer forward trail. Animation continuity and in-game contrast still need the independent reviewer and harness GIF review; this candidate has no user approval or installation.


## Bounded quality repair — 2026-10-06

The original draft record above is retained, including its original limitations. The pre-repair versions of this note, TIMING.md, and the three revised grids are preserved under `history/quality-repair-before/`. This is a candidate repair following QUALITY_REPAIR.md, not a human choice or approval.

### Exact scope and authored clusters

- Only `poses/windup.pxgrid`, `actions/sleep_a.pxgrid`, and `actions/sleep_b.pxgrid` changed. All other 15 grids and palette.json are byte-for-byte identical to the starting source, recorded with SHA-256 in `progress/repair-preservation.json`. Both original artist helpers remain unchanged and were not used to regenerate art. `author_pixels.py` describes the original draft; rerunning it would overwrite the bounded repair. The current full literal grids are authoritative.
- All four provided reference images were inspected. The current-v1 suite supplied the repair context; the other references supplied observations about compact adult SD anatomy, layered cloth, restrained eyes, and connected grips. No image supplied any source pixels.
- `windup`: hand-authored the rear elbow at x20–27/y34–37 and its turquoise forearm plane; the skin fingers at x30–34/y34–36 wrap the diagonal dark hilt. The guard at x33–36/y37 leads directly into short silver steel at x36–40/y38–40. The waist sheath mouth is at x39–41/y41, with the other hand bracing it at x37–39/y41–42. The scabbard continues down-right through x40–46/y42–46. Removed the old long floating horizontal blade. The face, head, neck, lower garment, and feet remain in their original positions. There are 141 changed native pixels, confined to x20–61/y32–46; x61 is removal of the old blade.
- `sleep_a`: kept all head/face rows y0–30 unchanged, including both closed-eye clusters and their spacing. Re-authored the shaded neck and lower collar at y31–34, relaxed the shoulder and sleeve planes, let the spare hand hang at y41–43, and brought the sword hand to x43–46/y45–46 beside the upper thigh. Its hilt and guard connect to steep downward steel beginning at x48–50/y48 and ending at (54,60). The former long outward blade was removed. There are 217 changed pixels, confined to x24–60/y31–60.
- `sleep_b`: kept all head/face rows y0–31 unchanged. Authored its own tucked neck and fuller breathing shoulder at y32–38, with a separate relaxed cuff and skin hand at x44–47/y46–47. Steel begins at x49–51/y49 and tapers to (53,60), with a different manually chosen sequence of edge steps from sleep_a. There are 233 changed pixels, confined to x23–60/y32–60. The original deeper nod, lower garment, knees, and grounded soles remain.
- No complete frame was shifted, rotated, interpolated, or resampled to author a pose. Every edited cluster was explicitly chosen in native palette symbols, and the saved files remain 64 full literal ASCII rows of 64 symbols each. Original colors, clear forehead, ponytail, red belt, split teal panels, trousers, and small shoes remain consistent throughout all 18 poses.

### Inspection evidence and limits

`inspect_pixels.py` decoded all 18 grids to their own native PNGs in `progress/`, with `contact-sheet.png` presenting the entire suite. `repair-comparison.png` shows the three archived originals above the current repairs, each at native size and an integer nearest-neighbor enlargement for viewing only. Images were decoded from grids; no pixels were derived from PNGs. Source readback confirmed the 18-color palette, 64×64 rows, transparent border, y≤60 ink, and idle_a soles at y60. The repaired feet remain unchanged. No tests/gates, GIF playback, game playback, store writes, ledger edits, or user approval occurred.

Remaining visual problems: the compact hand–hilt overlap and partly drawn blade in windup are still subtle at 1×. The downward sleep blade is visibly shorter than the raised idle blade so a thigh-level grip and its point both fit above the y60 cutoff. The preserved active stances and wider original trousers limit how slack the sleeping body can read. Static PNG inspection does not establish the final motion continuity, background contrast, or runtime timing. Independent harness review and a human choice remain outstanding.
