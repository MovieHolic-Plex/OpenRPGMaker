Work at high effort. Report in Korean. You are making 버들항 v6 (city sample) from v5, fixing the user's verdicts below.

## Where
- Previous sources: /home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de/scripts/content/lib/city_v5/ (committed copy) and /tmp/j8city (the v5 agent's scratch; may vanish at any time).
- Copy city_v5 to scripts/content/lib/city_v6/ in that same worktree and work THERE (keep sources in the repo; /tmp dirs on this machine get deleted mid-session). Render outputs may go to /tmp/j8city6.
- Other agents also commit in this worktree. Commit ONLY your own paths: `git add scripts/content/lib/city_v6 && git commit -m "..." -- scripts/content/lib/city_v6`. Never git stash, never reset, never touch other dirs. No npm test / vitest / gates / typecheck. No push/PR.
- Commit messages: `feat(content): ...` ending with "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>".

## Read first
- ~/.claude/skills/pixel-object-authoring/SKILL.md + every image in refs/ (user verdicts: chipset grain, 6–7 tone ramps, darkest-tone outline, fixed front-top symmetric view, big structures = walkable kits).
- The current page http://mdc-server:18301/city-beodeul-v5.html (file ~/claude-viz/city-beodeul-v5.html) and its images, so you see what the user saw.
- Castle reference (look-only, copyrighted fan art in RPG Maker MV style — do NOT copy pixels, draw our own): ~/claude-viz/ref/cb-top.png (castle) and ~/claude-viz/ref/cb-bot.png (approach road, cliff, camp). Read both images.

## User verdicts on v5 (fix every one)
1. **Windmill too small for its scale.** A windmill is a tall tower building, much larger than a house. Make it about 3–4 cells wide × 6–7 cells tall body with big sails spanning ~6–7 cells, still rotating seamlessly. Keep it walkable at the door.
2. **Forum: building view angles don't match**, roofs don't suit. The temple front, stoa/colonnade and the forum entrance "do not fit the existing chipset at all". Redo them *squared-up* ("각잡고"): same fixed front-top view as the chipset houses (front face full height, roof/top foreshortened, same eave/roof idiom, same outline and grain), symmetric, built on the same 16px grid. The temple: podium with front stairs, columns in front of a cella wall, a pediment roof drawn in the chipset roof manner. The stoa: a roofed colonnade seen from the front, roof top foreshortened like the chipset roofs. Compare side by side with chipset houses at 4x before accepting.
3. **Royal castle must look like a real castle**, not the same brick as the town. Use the reference (cb-top): large pale ashlar blocks with clear mortar and per-block shading, thick curtain walls with crenellated wall-walks, many tall round towers with conical slate-violet roofs and windows in tiers, a keep/palace with steep hipped slate roofs, rows of arched windows, a central gatehouse with portcullis and banners/shields on the wall, a grand stair up to the palace door, a court with statues, a moat/cliff below and a paved causeway approach road flanked by guardian statues (cb-bot). A different stone palette from the town houses is mandatory. Keep it a walkable kit (terrace tops walkable, walls only as front faces) with an assembly answer array.
4. **Noble estate entrance**: if the entrance is decorated, the walls and roof must match it. Pick one coherent material set (e.g. dressed stone + slate, or stucco + tile) for walls, roof, gate and gateposts.
5. **Remove the aqueduct** entirely (user: "수도교는 그냥 빼는 게 낫겠다").
6. **Bridges don't read as connected.** Each bridge must visibly join the road on both banks: abutments on the banks, the deck continuous with the road pavement, parapets that start and end at the banks. The middle of the big stone bridge looked strange (a statue in the middle?) — remove odd mid-span objects; make the span read as a continuous arch bridge in the chipset bridge idiom (deck top + front face + arch openings + shadow/reflection on water).
7. **Harbour river looks too neat, like paving under water.** The water where the ships are must look natural: irregular shoreline, no grid pattern / tile seams visible in the water, depth variation that follows the shore, not a repeated square texture. Check at 1x and 3x that no 16px or 32px period shows.
8. **Umbrella pines look very strange.** Remove them or redraw them properly (chipset canopy idiom, tall bare trunk, flat broad canopy) — if not convincing, just remove.

## Also keep
- Everything that was fine in v5 (flowing water under arches, smoke types, café terrace, 0 unreached doors).
- Rerun the 16-quadrant adversarial visual QA at 3x after the fixes, report defect counts before → after, and re-check doors / walk reachability.
- Update the metadata JSON (city-beodeul-v6-meta.json) for new/changed pieces (id, name_ko, description, footprint, per-cell roles, placement, related, animation).

## Visualize
~/claude-viz/city-beodeul-v6.html (self-contained, data URIs or files in ~/claude-viz/<subdir>), URL http://mdc-server:18301/city-beodeul-v6.html. Show per verdict a v5 vs v6 comparison crop at 3x, the whole city at half size, the castle district large, the windmill animated, the QA table. Verify with Playwright (screenshots under /home/main/.herdr/worktrees/rpg-zzu/worktree-brave-stone-6ff0/.playwright-mcp/) and actually look at them before finishing. Leave v5 page untouched.

## Final message
Full Korean report: what changed per verdict 1–8, QA counts, files and commits, URL, honest weak points. Never end with a one-line message.
