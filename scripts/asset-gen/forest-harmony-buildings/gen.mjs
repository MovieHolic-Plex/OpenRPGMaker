// 제작 틀 기준 이미지(<OUT>/<id>-ref.png)를 Tibo 에 주고 칠만 시킨다. 결과 <OUT>/<id>-c<N>-raw.png
//   N=3 node scripts/asset-gen/forest-harmony-buildings/gen.mjs fh-smithy fh-inn
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.MDC_IMAGE_API || "http://mdc-server:8091";
const OUT = resolve(process.env.OUT_DIR || ".omo/asset-gen-tmp/fh-bld");
const spec = JSON.parse(readFileSync(resolve("tiledata/forest-harmony-buildings/frames.json"), "utf8"));

const RULES = (k) => [
  "EDIT TASK on a pixel art game tileset image. The reference has two things on a flat magenta background,",
  `both enlarged exactly ${k}x (every art pixel is one clean ${k}x${k} block).`,
  "RIGHT: a finished house from this 16x16-tile top-down JRPG village tileset. It is the STYLE GUIDE: copy its pixel size,",
  "dark outlines, flat 2-4 tone shading, shingle pattern, timber framing and level of detail. Leave the right house unchanged.",
  "LEFT: a flat gray TEMPLATE of a new building. Paint ONLY inside the gray template, as the building described below.",
  "HARD RULES for the LEFT building: keep EXACTLY the same silhouette, size and position — every magenta pixel stays magenta,",
  "including the notches beside front wings and the corners beside sloped roofs. Zones of the template: mid gray = ROOF seen",
  "from above (top-down 3/4 view like the style guide), triangles inside the roof are front gables; darkest gray thin bands and",
  "lines = timber beams, posts and gable edges; light gray = front WALL; slightly darker light gray bottom band = plinth.",
  "The door, the windows and the chimney pipe are already drawn in color: keep them exactly as they are, same place and size,",
  "and do not add any other door or window. No perspective, vertical sides, no side walls.",
  "No text, no letters, no signs, no people, no ground, no shadow outside the building. Everything outside the two houses stays",
  "flat pure magenta #FF00FF. Crisp pixel art at the same grid, no anti-aliasing, no gradients, no painterly noise.",
].join(" ");
const frameScale = (id) => JSON.parse(readFileSync(`${OUT}/${id}-frame.json`, "utf8")).layout.scale;

const ids = process.argv.slice(2).length ? process.argv.slice(2) : spec.buildings.map((b) => b.id);
const N = Number(process.env.N || 3), START = Number(process.env.START || 1);
const runs = ids.flatMap((id) => Array.from({ length: N }, (_, i) => ({ id, name: `${id}-c${i + START}` })));
await Promise.all(runs.map(async ({ id, name }) => {
  const b = spec.buildings.find((x) => x.id === id);
  const prompt = process.env.NO_FRAME ? `Pixel art top-down JRPG village building, 16x16 tile style, magenta background. Subject: ${b.subject}` : `${RULES(frameScale(id))} LEFT building: ${b.subject}`;
  const t0 = Date.now();
  const res = await fetch(`${BASE}/v1/generate/json`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, slug: `fh-${name}`, return_base64: true, fallback: false, priority: 10,
      ...(process.env.NO_FRAME ? {} : { reference_b64: readFileSync(`${OUT}/${id}-ref.png`).toString("base64") }) }),
    signal: AbortSignal.timeout(20 * 60 * 1000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.image_b64) { console.error(name, "실패", res.status, JSON.stringify(json)?.slice(0, 300)); return; }
  writeFileSync(`${OUT}/${name}-raw.png`, Buffer.from(json.image_b64, "base64"));
  console.log(name, "ok", ((Date.now() - t0) / 1000).toFixed(0) + "s", json.model_echo ?? "");
}));
