/** 설계도 → 그림 모델 지시문(bp_gen.mjs 이식). 문장은 bp_gen.mjs 와 같아야 통과율이 유지된다. */
import type { BuildingBlueprint } from "./blueprintTypes.ts";

/** 구역(zones)에서 부분별 칸 수를 뽑아 문장으로: 같은 세로 구성의 열을 한 부분으로 묶고, 위에서부터 지붕·앞벽 칸 수를 센다. */
export function blueprintGeometry(bp: BuildingBlueprint): string {
  const zones = bp.zones!;
  const W = bp.map[0]!.length;
  const col = (x: number): string => bp.map.map((r, y) => ("XDGA".includes(r[x]!) ? zones[y]![x]! : ".")).join("");
  const parts: { profile: string; x: number; w: number }[] = [];
  for (let x = 0; x < W; x++) {
    const p = col(x), last = parts[parts.length - 1];
    if (last && last.profile === p) last.w++;
    else parts.push({ profile: p, x, w: 1 });
  }
  const say = (p: { profile: string; w: number }): string => {
    const body = p.profile.replace(/^\.+/, "");
    const top = p.profile.search(/[RWr-]/);
    const runs: string[] = [];
    for (const m of body.replace(/\.+$/, "").matchAll(/R+|W+|-+/g)) {
      const n = m[0].length;
      runs.push(m[0][0] === "R" ? `${n} squares of roof` : m[0][0] === "W" ? `${n} squares of front wall` : `${n} squares of tower, gable or trim (not roof shingles, not front wall)`);
    }
    return `${p.w} grid square${p.w > 1 ? "s" : ""} wide, starting ${top} square${top === 1 ? "" : "s"} below the top of the grid: ${runs.join(", then ")}`;
  };
  const named = parts.filter((p) => /[RW-]/.test(p.profile));
  if (named.length === 1) return `Exact size, counted in grid squares from top to bottom: the building is ${say(named[0]!)}.`;
  return `Exact size of each part from left to right, counted in grid squares from top to bottom: ${named.map((p, i) => `part ${i + 1} is ${say(p)}`).join("; ")}.`;
}

export function buildBlueprintPrompt(bp: BuildingBlueprint, scale: number): string {
  const has = (c: string): boolean => bp.map.some((r) => r.includes(c));
  const rules = [
    `EDIT TASK on a pixel art game tileset image, enlarged exactly ${scale}x (every art pixel is one clean ${scale}x${scale} block).`,
    "RIGHT: a small finished house from this 16x16-tile top-down JRPG village tileset. It is the STYLE GUIDE: copy exactly its pixel size, palette,",
    "dark outlines, flat 2-4 tone shading, clay-tile shingle pattern, plaster and timber framing, stone plinth, window style and its top-down 3/4 camera",
    "(roofs seen from above, front walls facing the viewer, vertical sides, no perspective). Leave the right house unchanged.",
    "LEFT: a DOTTED OUTLINE on a faint grid; each grid square is one 16x16 map tile. Draw ONE building that fills EVERY grid square inside the dotted",
    "outline and nothing outside it; areas outside the outline (including any notch or yard inside the bounding box) stay flat pure magenta #FF00FF.",
    "Fill EVERY part of the outline edge to edge: each wing is exactly as wide and as deep as its dotted part, the roof covers the full rectangle of its part (no hipped, rounded or cut-off roof corners, no gaps), and nothing sticks out of the outline (no wider porch, eaves or steps).",
    "Align the building to the grid: roof edges, floor beams, the stone plinth and wall bands start and end exactly on grid lines.",
    ...(bp.zones
      ? [`Scale: this building has ${bp.stories} ${bp.stories > 1 ? "stories" : "story"}, all of them in the front wall between the blue eave line and the bottom of the outline. A ground floor is 3 grid squares tall (timber beam, wall, stone plinth) like the style guide; upper stories share the rest of the wall evenly; a one-story wall taller than 3 squares is one tall hall. Windows are the same size as the style guide's.`, blueprintGeometry(bp)]
      : [`Scale: this building has ${bp.stories} stories. The ground-floor wall is exactly 3 grid squares tall (timber beam, wall, stone plinth) like the`,
        "style guide; every upper story adds exactly 2 grid squares of wall; the roofs take the rows above. Windows are the same size as the style guide's."]),
    "The small BLACK doorway rectangles already drawn inside the outline are the ONLY building entrances: keep them exactly as they are, same place and size, plain black",
    "empty doorway openings (no door leaves). Do not draw any other door, gate or dark opening anywhere, especially not on upper stories.",
    "Never widen or heighten a doorway: no black, frame shadow or recess outside its black rectangle; wall pixels touch its edges directly, like the style guide's door (a single doorway is exactly 1 grid square wide, the column right of it is wall).",
    ...(bp.zones
      ? ["BLUE dashed lines are EAVE LINES. Inside the outline, the area above a blue line is ROOF: the top surface of the roof seen from above, orange clay-tile shingles covering that whole area (small dormers and chimneys may sit inside it). The area below a blue line is the FRONT WALL facing the viewer. The roof eave sits exactly on the blue line, straight across; walls never rise above it and the roof never hangs below it.",
        ...(bp.zoneTint ? ["The pale orange squares are exactly the roof area: paint clay-tile roof over every pale orange square and nowhere else."] : []),
        "This is the top-down 3/4 JRPG camera of the style guide, NOT a front elevation: the roofs are a large top surface, at least as tall as the walls, like the style guide."]
      : []),
    ...(has("*") ? ["The band outlined with LIGHT GRAY dots above the building is optional headroom: only chimneys, spires, tower tips or flags may rise into it from the building below; leave the rest of it magenta. Chimneys must stand on the roof and may rise into this band."] : []),
    ...(has("G") ? ["The BLACK cells in the middle of the front wall are an open GATE PASSAGE that people walk through into the courtyard: draw an open dark gateway there (no door leaves, no bars), and the wall top above it continues across the gate as the walkway."] : []),
    ...(bp.map.some((r, y) => y > 0 && /X\.+X/.test(r)) ? ["Magenta areas enclosed by the outline are open yards or courtyards seen from above: keep them magenta (they are filled with ground later)."] : []),
    "Remove the grid, the dotted lines and the blue lines. No text, no people, no ground, no shadow outside the building.",
    "Crisp pixel art on the grid, no anti-aliasing, no gradients, no painterly noise.",
  ].join(" ");
  return `${rules} LEFT building: ${bp.subject}`;
}
