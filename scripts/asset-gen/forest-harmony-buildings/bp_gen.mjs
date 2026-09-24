// 설계도 기준 이미지 → 그림 생성(god-tibo-imagen). N 장씩. node bp_gen.mjs [id ...]
import { readFileSync, writeFileSync } from "node:fs";
const OUT = process.env.OUT_DIR || "../../../.omo/asset-gen-tmp/fh-bld";
const BP = JSON.parse(readFileSync("../../../tiledata/forest-harmony-buildings/blueprints.json", "utf8"));
// 구역(zones)에서 부분별 칸 수를 뽑아 문장으로: 같은 세로 구성의 열을 한 부분으로 묶고, 위에서부터 지붕·앞벽 칸 수를 센다.
const geometry = (bp) => {
  const W = bp.map[0].length, col = (x) => bp.map.map((r, y) => ("XDGA".includes(r[x]) ? bp.zones[y][x] : ".")).join("");
  const parts = [];
  for (let x = 0; x < W; x++) {
    const p = col(x);
    if (parts.length && parts.at(-1).profile === p) parts.at(-1).w++;
    else parts.push({ profile: p, x, w: 1 });
  }
  const say = (p) => {
    const body = p.profile.replace(/^\.+/, "");
    const top = p.profile.search(/[RWr-]/), runs = [];
    for (const m of body.replace(/\.+$/, "").matchAll(/R+|W+|-+/g)) runs.push(m[0][0] === "R" ? `${m[0].length} squares of roof` : m[0][0] === "W" ? `${m[0].length} squares of front wall` : `${m[0].length} squares of tower, gable or trim (not roof shingles, not front wall)`);
    return `${p.w} grid square${p.w > 1 ? "s" : ""} wide, starting ${top} square${top === 1 ? "" : "s"} below the top of the grid: ${runs.join(", then ")}`;
  };
  const named = parts.filter((p) => /[RW-]/.test(p.profile));
  if (named.length === 1) return `Exact size, counted in grid squares from top to bottom: the building is ${say(named[0])}.`;
  return `Exact size of each part from left to right, counted in grid squares from top to bottom: ${named.map((p, i) => `part ${i + 1} is ${say(p)}`).join("; ")}.`;
};
// 소품(kind=prop): 칸을 다 칠하지 않는 작은 물건. 건물 규칙(칸 채움·문·처마)은 빼고 같은 화풍·같은 카메라만 요구한다.
const propRules = (bp) => [
  `EDIT TASK on a pixel art game tileset image, enlarged exactly ${BP.scale}x (every art pixel is one clean ${BP.scale}x${BP.scale} block).`,
  "RIGHT: a small finished house from this 16x16-tile top-down JRPG village tileset. It is the STYLE GUIDE: copy exactly its pixel size, palette,",
  "dark outlines, flat 2-4 tone shading and its top-down 3/4 camera (objects seen slightly from above, front faces toward the viewer, no perspective). Leave the right house unchanged.",
  "LEFT: a DOTTED OUTLINE on a faint grid; each grid square is one 16x16 map tile. Draw ONE small object inside the dotted outline, as big as the outline allows, touching the bottom of the outline, drawn at the same pixel scale as the style guide (the house door is exactly one grid square wide).",
  "Everything that is not the object, inside and outside the outline, stays flat pure magenta #FF00FF. No ground, no grass, no cast shadow, no text.",
  "Remove the grid and the dotted lines. Crisp pixel art, no anti-aliasing, no gradients, no painterly noise.",
].join(" ");
const rules = (bp) => bp.kind === "prop" ? propRules(bp) : [
  `EDIT TASK on a pixel art game tileset image, enlarged exactly ${BP.scale}x (every art pixel is one clean ${BP.scale}x${BP.scale} block).`,
  "RIGHT: a small finished house from this 16x16-tile top-down JRPG village tileset. It is the STYLE GUIDE: copy exactly its pixel size, palette,",
  "dark outlines, flat 2-4 tone shading, clay-tile shingle pattern, plaster and timber framing, stone plinth, window style and its top-down 3/4 camera",
  "(roofs seen from above, front walls facing the viewer, vertical sides, no perspective). Leave the right house unchanged.",
  "LEFT: a DOTTED OUTLINE on a faint grid; each grid square is one 16x16 map tile. Draw ONE building that fills EVERY grid square inside the dotted",
  "outline and nothing outside it; areas outside the outline (including any notch or yard inside the bounding box) stay flat pure magenta #FF00FF.",
  "Fill EVERY part of the outline edge to edge: each wing is exactly as wide and as deep as its dotted part, the roof covers the full rectangle of its part (no hipped, rounded or cut-off roof corners, no gaps), and nothing sticks out of the outline (no wider porch, eaves or steps).",
  "Align the building to the grid: roof edges, floor beams, the stone plinth and wall bands start and end exactly on grid lines.",
  ...(bp.zones ? [`Scale: this building has ${bp.stories} ${bp.stories > 1 ? "stories" : "story"}, all of them in the front wall between the blue eave line and the bottom of the outline. A ground floor is 3 grid squares tall (timber beam, wall, stone plinth) like the style guide; upper stories share the rest of the wall evenly; a one-story wall taller than 3 squares is one tall hall. Windows are the same size as the style guide's.`, geometry(bp)]
    : [`Scale: this building has ${bp.stories} stories. The ground-floor wall is exactly 3 grid squares tall (timber beam, wall, stone plinth) like the`,
      "style guide; every upper story adds exactly 2 grid squares of wall; the roofs take the rows above. Windows are the same size as the style guide's."]),
  "The small BLACK doorway rectangles already drawn inside the outline are the ONLY building entrances: keep them exactly as they are, same place and size, plain black",
  "empty doorway openings (no door leaves). Do not draw any other door, gate or dark opening anywhere, especially not on upper stories.",
  "Never widen or heighten a doorway: no black, frame shadow or recess outside its black rectangle; wall pixels touch its edges directly, like the style guide's door (a single doorway is exactly 1 grid square wide, the column right of it is wall).",
  ...(bp.zones ? ["BLUE dashed lines are EAVE LINES. Inside the outline, the area above a blue line is ROOF: the top surface of the roof seen from above, orange clay-tile shingles covering that whole area (small dormers and chimneys may sit inside it). The area below a blue line is the FRONT WALL facing the viewer. The roof eave sits exactly on the blue line, straight across; walls never rise above it and the roof never hangs below it.",
    ...(bp.zoneTint ? ["The pale orange squares are exactly the roof area: paint clay-tile roof over every pale orange square and nowhere else."] : []),
    "This is the top-down 3/4 JRPG camera of the style guide, NOT a front elevation: the roofs are a large top surface, at least as tall as the walls, like the style guide."] : []),
  ...(bp.map.some((r) => r.includes("*")) ? [bp.headroom ?? "The band outlined with LIGHT GRAY dots above the building is optional headroom: only chimneys, spires, tower tips or flags may rise into it from the building below; leave the rest of it magenta. Chimneys must stand on the roof and may rise into this band."] : []),
  ...(bp.map.some((r) => r.includes("G")) ? ["The BLACK cells in the middle of the front wall are an open GATE PASSAGE that people walk through into the courtyard: draw an open dark gateway there (no door leaves, no bars), and the wall top above it continues across the gate as the walkway."] : []),
  ...(bp.map.some((r, y) => y > 0 && /X\.+X/.test(r)) ? ["Magenta areas enclosed by the outline are open yards or courtyards seen from above: keep them magenta (they are filled with ground later)."] : []),
  "Remove the grid, the dotted lines and the blue lines. No text, no people, no ground, no shadow outside the building.",
  "Crisp pixel art on the grid, no anti-aliasing, no gradients, no painterly noise.",
].join(" ");
const ids = process.argv.slice(2).length ? process.argv.slice(2) : BP.blueprints.map((b) => b.id);
// 기본 = god-tibo-imagen 라이브러리(~/.codex/auth.json 로그인, GTI_MODULE 로 경로 지정 가능). BACKEND=tibo 면 옛 Tibo HTTP 서버
const GTI_MOD = process.env.BACKEND !== "tibo" ? await import(process.env.GTI_MODULE || "god-tibo-imagen") : null;
const GTI_CFG = GTI_MOD?.resolveConfig({ provider: "private-codex" }), GTI = GTI_MOD?.createProvider(GTI_CFG);
const N = Number(process.env.N || 3), START = Number(process.env.START || 1);
if (process.env.DRY) { for (const id of ids) { const bp = BP.blueprints.find((b) => b.id === id); console.log(id, (rules(bp) + bp.subject).length, "|", bp.zones ? geometry(bp) : "-"); } process.exit(0); }
await Promise.all(ids.flatMap((id) => Array.from({ length: N }, (_, i) => i + START).map(async (c) => {
  const bp = BP.blueprints.find((b) => b.id === id);
  const t0 = Date.now();
  const prompt = `${rules(bp)} LEFT building: ${bp.subject}`, raw = `${OUT}/${id}-c${c}-raw.png`;
  if (GTI) {   // god-tibo-imagen: ~/.codex/auth.json 으로 chatgpt.com codex /responses 의 image_generation 도구를 직접 부른다. 기준 이미지는 data URL.
    try {
      const r = await GTI.generateImage({ prompt, model: GTI_CFG.defaultModel, outputPath: raw, size: process.env.GTI_SIZE || "1024x1024",
        images: [`data:image/png;base64,${readFileSync(`${OUT}/${id}-ref.png`).toString("base64")}`] });
      return console.log(id, c, "ok(gti)", ((Date.now() - t0) / 1000) | 0, "s", r.revisedPrompt ? "revised" : "");
    } catch (e) { return console.error(id, c, "실패(gti)", e.code || "", e.status || "", String(e.message).slice(0, 200), String(e.body || "").slice(0, 300)); }
  }
  const res = await fetch("http://mdc-server:8091/v1/generate/json", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, slug: `${id}-${c}`, return_base64: true, fallback: false, priority: 10,
      reference_b64: readFileSync(`${OUT}/${id}-ref.png`).toString("base64") }), signal: AbortSignal.timeout(900000) });
  const j = await res.json().catch(() => null);
  if (!j?.image_b64) return console.error(id, c, "실패", res.status, JSON.stringify(j)?.slice(0, 300));
  writeFileSync(raw, Buffer.from(j.image_b64, "base64"));
  console.log(id, c, "ok", ((Date.now() - t0) / 1000) | 0, "s");
})));
