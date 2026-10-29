// 지형 먼저 마을(2026-10-29) 게임 화면 픽스처 — A/B 요청 몇 개를 author_beodeul_town 으로 LLM 없이 짓고,
// 마을 단에서 위 단(두 단 차이 절벽)을 올려다보는 자리·계단 발치·낮은 단에서 마을 단을 올려다보는 자리를 옆 JSON 에 적는다.
// 시나리오는 relief-village 를 그대로 쓴다(좌표 파일만 바꾼다):
//   bun scripts/qa/runtime/village-terrain-first-fixture.mts --out .omo/runtime-qa/village-terrain-first.json
//   RELIEF_VILLAGE_POINTS=.omo/runtime-qa/village-terrain-first.json.points.json npm run qa:runtime -- --scenario relief-village --project .omo/runtime-qa/village-terrain-first.json --out verify-shots/village-terrain-first
import fs from "node:fs";
import { runTool } from "../../../src/editor/tools/index.ts";
import { ensureBundledTilesets } from "../../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../../src/project/defaults.ts";
import { serializePretty } from "../../../src/project/io.ts";
import { villageArgs } from "../../../src/ai/v2/builders/village.ts";
import type { PlaceSpec } from "../../../src/ai/v2/types.ts";
import type { Project } from "../../../src/project/types.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", ".omo/runtime-qa/village-terrain-first.json");
const VILLAGES: { key: string; spec: Partial<PlaceSpec>; extra: Record<string, unknown>; seed: number }[] = [
  { key: "hill", spec: { name: "언덕 마을", theme: "river", size: "medium" }, extra: { landform: "hill" }, seed: 11 },
  { key: "slope", spec: { name: "산골 마을", theme: "river", features: ["highland"], size: "small" }, extra: { landform: "slope" }, seed: 23 },
  { key: "snow", spec: { name: "설산 마을", theme: "snow", size: "medium" }, extra: { landform: "slope" }, seed: 13 },
  { key: "plateau", spec: { name: "모래 우물", theme: "desert", size: "medium" }, extra: { landform: "plateau" }, seed: 17 },
];
const ctx = { project: createBlankProject() as Project }; ensureBundledTilesets(ctx.project);
type Pt = { mapId: string; x: number; y: number; note: string };
const points: Record<string, Pt> = {};
for (const v of VILLAGES) {
  const { args } = villageArgs({ type: "village", ...v.spec } as PlaceSpec);
  const id = `tf_${v.key}`;
  const r = runTool(ctx, "author_beodeul_town", { ...args, ...v.extra, seed: v.seed, id, name: v.spec.name } as never);
  if (!r.ok) throw new Error(`${id}: ${r.summary}`);
  const map = ctx.project.maps[id]!; const rel = map.relief; if (!rel) throw new Error(`${id}: relief 없음`);
  const W = map.width, H = map.height, lv = (x: number, y: number) => rel.levels[y * W + x] ?? 0, rc = (x: number, y: number) => rel.ramps?.[y * W + x] ?? 0;
  const free = (x: number, y: number) => rc(x, y) === 0 && !map.events?.some((e) => e.x === x && e.y === y);
  // 계단(5~8) 발치: 북쪽 오르막 계단(5) 중 오르는 높이가 가장 큰 것 — 발치 아래 두 칸에서 위를 본다
  let best: { x: number; y: number; d: number } | null = null;
  for (let y = 1; y < H - 3; y++) for (let x = 0; x < W; x++) if (rc(x, y) === 5 && rc(x, y + 1) !== 5) {
    let t = y; while (t > 0 && rc(x, t) === 5) t -= 1; const d = lv(x, t) - lv(x, y + 1);
    if (!best || d > best.d) best = { x, y: y + 1, d };
  }
  if (best && free(best.x, Math.min(H - 1, best.y + 1))) points[`${v.key}-stairs`] = { mapId: id, x: best.x, y: Math.min(H - 1, best.y + 1), note: `${id} 계단 발치 (${best.x},${best.y}) — ${best.d}단 오르막` };
  // 낮은 단(0)에서 마을 단 절벽을 올려다보는 자리: 가운데 열에서 0단이고 바로 북쪽 3칸 안에 들린 칸이 있는 곳
  for (let y = H - 2; y > 0 && !points[`${v.key}-below`]; y--) { const x = Math.round(W / 2); if (lv(x, y) === 0 && free(x, y) && [1, 2, 3].some((k) => y - k >= 0 && lv(x, y - k) > 0)) points[`${v.key}-below`] = { mapId: id, x, y: Math.min(H - 1, y + 2), note: `${id} 낮은 단에서 마을 단 절벽을 본다` }; }
  console.log(id, `${W}x${H}`, (r.data as { relief?: { note?: string } }).relief?.note ?? "", Object.keys(points).filter((k) => k.startsWith(v.key)).join(" "));
}
const first = Object.values(points)[0]!;
const project = ctx.project;
if (project.system.opening) project.system.opening.enabled = false;
project.startMapId = first.mapId; project.startPos = { x: first.x, y: first.y };
const used = new Set(Object.values(project.maps).map((m) => m.tilesetId));
for (const id of Object.keys(project.tilesets)) if (!used.has(id)) delete project.tilesets[id];
for (const t of Object.values(project.tilesets)) { delete (t as { referenceDocuments?: unknown }).referenceDocuments; }
fs.mkdirSync(OUT.replace(/\/[^/]+$/u, ""), { recursive: true });
fs.writeFileSync(OUT, serializePretty(project));
fs.writeFileSync(`${OUT}.points.json`, JSON.stringify(points, null, 1));
console.log("->", OUT, Object.keys(points).join(" "));
