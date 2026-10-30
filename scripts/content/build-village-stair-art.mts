// 마을 지형 계단 도트(2026-10-30 사용자 「경사로를 전부 계단으로 — 버들항 칩셋의 괜찮은 계단 조각을 쓰거나 약간 변형」).
//
// 새 손 도트를 그리지 않는다. 버들항 칩셋 키트 bd-mpart-stairs(5×2 돌계단, 양옆 기둥)의 가운데 열(디딤판 줄 2칸 = 16×32)을 화소 그대로 떼어
// relief 경사로 도트(rampArt.json)로 쓴다 — 칩셋 칸 수는 바뀌지 않는다(렌더러가 계단 칸 위에 이 도트를 반복해 칠한다).
//   lit   = 원본 그대로(북·동으로 오르는 계단 — 챌면이 보는 쪽을 향한다). 동서 계단은 렌더러가 90° 돌려(가로↔세로) 칠한다.
//   shade = 원본을 0.82 배 어둡게(남·서로 오르는 계단 — 그늘 쪽).
//   테마 변형: 돌색 그대로(풀밭·설원), 밝기 순위를 그 바이옴 벽 램프 6색에 옮김(사막 사암·늪 이탄 나무) — 결정적 재색칠.
//   side  = 계단 아래·위 끝 1px 선(0열 = 발치, 1열 = 머리). 그 바이옴 윗면 램프의 어두운·밝은 색.
// 결과: tiledata/relief-art/<style>.png(사람이 보는 원본, 40×32: lit 0, shade 18, side 36 — build-relief-ramp-art.mjs 도 *-steps.png 를 같은 키로 다시 싣는다) + src/project/relief/rampArt.json 의 같은 키.
// 사용: bun scripts/content/build-village-stair-art.mts
import fs from "node:fs";
import { PNG } from "pngjs";
import { renderMapPng } from "../qa-game/render.mts";
import { runTool } from "../../src/editor/tools/index.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";

const KIT = "bd-mpart-stairs";
const OUT_JSON = "src/project/relief/rampArt.json", DIR = "tiledata/relief-art";
type Rgb = [number, number, number];
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// 양식: 이름 → 재색칠 램프(없으면 돌색 그대로)·발치/머리 선 색
const STYLES: Record<string, { ramp?: string[]; foot: string; crest: string }> = {
  "grass-steps": { foot: "#276d2d", crest: "#87c464" },
  "snow-steps": { foot: "#93a9c6", crest: "#ffffff" },
  "sand-steps": { ramp: ["#5a3e22", "#7a5630", "#98703f", "#b58a50", "#cfa566", "#e8c282"], foot: "#826e4c", crest: "#f5d090" },
  "cave-steps": { foot: "#604e48", crest: "#8d7766" },
  "peat-steps": { ramp: ["#2e1a0a", "#4a2c12", "#6e4520", "#94632f", "#b98648", "#d8a866"], foot: "#4e542c", crest: "#939e54" },
};

const p: any = createBlankProject(); ensureBundledTilesets(p); const ctx: any = { project: p };
const kit = p.tilesets.beodeul_city.structureKits.find((k: any) => k.id === KIT);
if (!kit) throw new Error(`키트 없음: ${KIT}`);
let r: any = runTool(ctx, "create_map", { id: "st", name: "st", width: kit.width + 2, height: kit.height + 2, tilesetId: "beodeul_city" } as any);
if (!r.ok) throw new Error(r.summary);
r = runTool(ctx, "stamp_object", { objectId: `kit:beodeul_city/${KIT}`, mapId: "st", x: 1, y: 1 } as any);
if (!r.ok) throw new Error(r.summary);
const png = PNG.sync.read(renderMapPng(ctx.project, ctx.project.maps.st, 1).png);
// 가운데 열(키트 x 2), 두 칸(키트 y 0~1) = 16×32
const cx = (1 + Math.floor(kit.width / 2)) * 16, cy = 16 + (png.height - (kit.height + 2) * 16);
const lit: number[] = [];
for (let y = 0; y < 32; y += 1) for (let x = 0; x < 16; x += 1) { const o = ((cy + y) * png.width + cx + x) * 4; lit.push(png.data[o]!, png.data[o + 1]!, png.data[o + 2]!, 255); }

const lum = (a: number[], i: number) => 0.299 * a[i]! + 0.587 * a[i + 1]! + 0.114 * a[i + 2]!;
const recolor = (src: number[], ramp?: string[]): number[] => {
  if (!ramp) return [...src];
  const ls = [...new Set(Array.from({ length: src.length / 4 }, (_, k) => Math.round(lum(src, k * 4))))].sort((a, b) => a - b);
  const R = ramp.map(hex);
  const out = [...src];
  for (let k = 0; k < src.length; k += 4) { const rank = ls.indexOf(Math.round(lum(src, k))); const c = R[Math.min(5, Math.floor((rank / Math.max(1, ls.length - 1)) * 5.999))]!; out[k] = c[0]; out[k + 1] = c[1]; out[k + 2] = c[2]; }
  return out;
};
const darken = (a: number[], f: number) => a.map((v, i) => (i % 4 === 3 ? v : Math.round(v * f)));

const json = JSON.parse(fs.readFileSync(OUT_JSON, "utf8"));
for (const [name, st] of Object.entries(STYLES)) {
  const L = recolor(lit, st.ramp), S = darken(L, 0.82);
  const side: number[] = [];
  for (let y = 0; y < 16; y += 1) for (const c of [hex(st.foot), hex(st.crest), hex(st.crest)]) side.push(c[0], c[1], c[2], 255);
  json[name] = { lit: { w: 16, h: 32, rgba: L }, shade: { w: 16, h: 32, rgba: S }, side: { w: 3, h: 16, rgba: side } };
  const sheet = new PNG({ width: 40, height: 32 });
  const put = (a: number[], w: number, h: number, x0: number) => { for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) { const s = (y * w + x) * 4, d = (y * 40 + x0 + x) * 4; for (let c = 0; c < 4; c += 1) sheet.data[d + c] = a[s + c]!; } };
  put(L, 16, 32, 0); put(S, 16, 32, 18); put(side, 3, 16, 36);
  fs.writeFileSync(`${DIR}/${name}.png`, PNG.sync.write(sheet));
  console.log(name, "→", `${DIR}/${name}.png`);
}
fs.writeFileSync(OUT_JSON, JSON.stringify(json) + "\n");
console.log("rampArt.json 갱신:", Object.keys(STYLES).join(" "));
