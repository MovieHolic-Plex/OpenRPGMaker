// 아스트라 호라이즌 타이틀 키아트 후보 — MDC 이미지 API(god-tibo-imagen). 글자 없이, 왼쪽 위(로고)와 가운데 하늘(PRESS START)을 비운다.
//   node scripts/asset-gen/gen-astra-title.mjs r1          # 후보 전부
// 결과: .omo/asset-gen-tmp/astra-title/<판>/<후보>.png + .prompt.txt (후처리 없음)
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const [ver = "r1", ...only] = process.argv.slice(2);
const BASE = process.env.MDC_IMAGE_API || "http://100.73.251.77:8091";
const OUT = resolve(`.omo/asset-gen-tmp/astra-title/${ver}`);
mkdirSync(OUT, { recursive: true });

const WORLD = [
  "Title-screen key art for an original monster-collecting adventure game called Astra Horizon.",
  "Bright cheerful morning, wide landscape: a vivid blue sky with soft white clouds, a far range of blue mountains, rolling green meadow hills,",
  "a small village with red roofs in the distance, a dirt path winding toward the horizon, a faint pale crescent of a rising sun-star glow at the horizon line.",
  "Three small original starter creatures stand together on a grassy rise in the lower right: a green leaf-eared fox-like grass creature with a curled striped tail,",
  "a cream woolly lamb with orange curled horns and a flame tuft, and a dark-blue dolphin-like water creature with a wave-shaped fin; next to them a young trainer seen from behind,",
  "red cap, backpack, looking toward the horizon.",
].join(" ");
const LAYOUT = "Composition: the upper-left third and the upper centre are open sky with only light clouds (space reserved for a logo and a 'press start' line), all characters in the lower-right third, the bottom edge is plain grass. 3:2 landscape.";
const NO = "No text, no letters, no logo, no watermark, no frame, no UI, no existing game or anime character, no Poke-ball or ball of any kind.";

const CANDIDATES = {
  T1: `${WORLD} 16-bit GBA-era pixel art, chunky hand-placed pixels, limited 32-colour palette, clean dark outlines on characters, no anti-aliasing, no gradients, no blur. ${LAYOUT} ${NO}`,
  T2: `${WORLD} Pixel art in the style of a late-GBA creature-collection game title screen: very chunky pixels as if the whole image were about 320 pixels wide, flat 3-tone shading, dithered sky bands, no anti-aliasing. ${LAYOUT} ${NO}`,
  T3: `${WORLD} Clean cel-shaded official game key art, crisp dark-brown outlines, flat bright colours with one shade tone, early-2000s creature-collection game box-art feel. ${LAYOUT} ${NO}`,
  T4: `${WORLD} Soft gouache storybook painting with a crisp silhouette, bright saturated summer colours, early-2000s creature-collection game official artwork feel. ${LAYOUT} ${NO}`,
};

const names = only.length ? only : Object.keys(CANDIDATES);
async function one(name) {
  const prompt = CANDIDATES[name];
  if (!prompt) throw new Error(`unknown candidate ${name}`);
  writeFileSync(`${OUT}/${name}.prompt.txt`, prompt);
  if (existsSync(`${OUT}/${name}.png`)) return console.log(name, "exists");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(`${BASE}/v1/generate/json`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, slug: `astra-title-${ver}-${name}`, size: process.env.SIZE || "1536x1024", return_base64: true, fallback: false, priority: 10 }),
      signal: AbortSignal.timeout(20 * 60 * 1000),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok && json.image_b64) {
      writeFileSync(`${OUT}/${name}.png`, Buffer.from(json.image_b64, "base64"));
      return console.log(name, "ok", json.engine, json.duration_sec);
    }
    console.error(name, "attempt", attempt + 1, res.status, JSON.stringify(json)?.slice(0, 200));
  }
}
await Promise.all(names.map(one));
