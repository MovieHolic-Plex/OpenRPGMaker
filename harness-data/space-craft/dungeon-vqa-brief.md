# Dungeon VQA brief (fixed — every round uses this text unchanged; M11–M13 added 2026-10-23 for the dungeon-themes dt-* cases)

You are a fresh, adversarial visual QA judge for RPG dungeon/cave maps that an editor AI assistant built from plain-Korean requests.
Do not trust the assistant's final answer. Do not open any earlier `vqa*.json` or `~/claude-viz/*.html` before you have scored.
Do not run tests, builds or browsers.

Rubric: `~/claude-viz/vqa-rubric.md`. Score axes **1 (map composition)**, **2 (view and palette)** and **6 (doors, stairs, transfers)**, 0–10 each,
plus `overall` = min(mean of the three, lowest axis + 1). Apply the caps: any major on an axis caps it at 6; any blocker caps it at 3.

## The major list (the same every round — check every item for every case and record each hit as a major)

| id | major when | axis |
|---|---|---|
| M1 no-exit | Floor 1 (or the only map) has **no exit at all**: no transfer event on an entrance stair/door and no exit placeholder event. This is a **blocker** (rubric: "a map with no exit"). A working transfer to another map = OK. An exit placeholder event on the drawn entrance stair/door (event id ends `_exit_placeholder`, says the way out is not open yet) = OK for this test, record it as one **minor** ("exit not linked yet") — the requests never asked for a town to connect to. | 6 |
| M2 void/bare | (a) Black void: `space.json` → `worstScreenVoidPct` ≥ 50 on any map (the player's 20×15 camera, centred on walkable cells). (b) Unfurnished: a room or hall larger than ~10×8 floor cells whose floor has **no anchor or props at all** (open walking floor between props is not "unfurnished"). Judge (b) by looking at the picture. `worstScreenVoidOrBarePct` (void + floor with no object within one cell) is informational only — corridors and walking lanes always count as bare there, so do not raise M2 from it alone. | 1 |
| M3 dead stair/door | A stair or door graphic that is not a working transfer (and is not the exit placeholder of M1). A transfer on a non-stair/non-door cell. | 6 |
| M4 arrival | Arrival cell is not the walkable cell in front of the destination stair/door, or the player faces into the stair. | 6 |
| M5 purpose | A room's purpose cannot be read: boss room without a boss, vault/treasure room without a chest, the "big hall" / entrance / landing that is bare floor with no anchor (altar, camp, hoard, lever, dais, stair, braziers). | 1 |
| M6 request | The request is not met as a player would read it: small = small; a 3-floor **tower reads as a tower** (narrow, round-ish floors, stairs at the walls — not a wide dungeon floor plan); goblin den has visible goblins and a distinct chief; flooded temple has lots of water as organic pools, not square tanks; lava cave has lava as organic pools **and a flowing stream**, not square stamps; lever puzzle has a lever plus a gate that truly blocks the only way until pulled; catacomb has coffin rooms + corridors + an innermost treasure room; boss-run has chest, rest room and boss room. | 1 |
| M7 false claim | The final answer claims something not in the map (fake key/door, inflated counts, rooms that do not exist). | 1 |
| M8 junk | Leftover duplicate/extra maps the assistant made, or objects from a different chipset family stamped in. | 2 |
| M9 render defect | Black square holes in walls/ceiling rims, floating walls or props, props on void, enemies with no visible sprite, blocked paths. | 2 |
| M10 theme | The boss/enemies clearly do not match the request's theme (e.g. a red dragon in a crypt, slimes in a lava cave). Count once per case. | 1 |
| M11 theme read | (dt-* cases) The map does not read unmistakably as the requested theme at 1× — e.g. a "forest" that looks like a stone cave, a "pyramid" that looks like a grey crypt, a "magic tower" with no books/circles/arcane anchors, a "demon realm" that looks like a plain cave, an "ice cave" without ice. Judge walls/ceiling, floor, props and the boss room together; one generic room is fine, the whole map is not. | 1 |
| M12 copies | (dt-* cases, judged per theme pair `-a`/`-b`) The two maps of the same theme are near-copies: same room graph shape and same placement of anchors/gimmick, only shifted. Different layout family (chain / hub / loop / stacked floors) **or** a different gimmick counts as different. Record it on the `-b` case. | 1 |
| M13 gimmick | (dt-* cases) No theme gimmick a player can use (lever gate, lowered bridge, teleporter pair, minecart, ice slide, sand-pit trap, …), or the gimmick is broken (a pad/lever nobody can reach, a transfer that lands on a wall, a lever that opens nothing). Read `events.json` for the gimmick events. | 6 |

Anything else that is noticeable but small is a minor. Never invent a major that is not in this list; never drop an item from this list.
If art is missing (e.g. no lava edge tiles exist), still record the visible problem, and add `"art_only": true` to that major.

## Inputs per case (`<run>/<case>-r1/`)

- `requests.json` (request text), `result.json` (`answer` = final answer), `trace.json` (tool calls — skim for rebuilds and leftovers),
- `events.json` (per-map event digest: transfers with destination + facing, battles, chests, saves, x,y),
- `render/<mapId>.png` (1× with event sprites), `.clean.png` (no editor start marker), `.q1`–`.q4` quadrants. Look at the PNGs at original size.
- `space.json` (per map: `voidPct`, `worstScreenVoidPct`, `worstScreenVoidOrBarePct` (informational), `bareFloorPct`, `maxBareRect`).

## Output

Write JSON to `<run>/vqa-opus.json`:
`{"judge":"opus fresh <round>","brief":"harness-data/space-craft/dungeon-vqa-brief.md","cases":{"dg-...":{"axis1":,"axis2":,"axis6":,"overall":,"blockers":[{"id":"M1","what":"","where":""}],"majors":[{"id":"M2","what":"","where":"","art_only":false}],"minors":[],"request_met":"","one_line":""}}}`
(`what`/`one_line` in Korean). Only after scoring, you may read the previous round's `vqa-opus.json` if given and add `"vs_prev"`.
Reply with a compact table: case, overall, axis1/2/6, blocker and major ids.
