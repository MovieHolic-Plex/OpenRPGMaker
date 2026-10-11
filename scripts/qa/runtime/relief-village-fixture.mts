// relief-village.scenario.mjs 가 쓰는 픽스처 — 높이 지형이 있는 버들항 마을 네 장(강 계단식·설원 비탈·사막 골·늪 둔덕)을
// author_beodeul_town 으로 LLM 없이 짓고, 비트 좌표(북쪽 끝 · 길이 오르는 경사로 발치)를 지형에서 찾아 옆 JSON 에 적는다.
//
//   bun scripts/qa/runtime/relief-village-fixture.mts --out .omo/runtime-qa/relief-village.json
//   npm run qa:runtime -- --scenario relief-village --project .omo/runtime-qa/relief-village.json
//
// 좌표 파일: <out>.points.json (시나리오가 RELIEF_VILLAGE_POINTS 또는 이 기본 경로에서 읽는다).
// 북쪽 끝 비트: 0번 줄이 들린 열 바로 옆의 낮은 열(맵 위 여백 띠가 보이던 자리). 경사로 비트: 매끈한 경사로(코드 1~4) 발치 한 칸 아래.
import fs from "node:fs";
import { runTool } from "../../../src/editor/tools/index.ts";
import { ensureBundledTilesets } from "../../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../../src/project/defaults.ts";
import { serializePretty } from "../../../src/project/io.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", ".omo/runtime-qa/relief-village.json");
const VILLAGES = [
  { theme: "river", form: "street", terrain: "terraces", seed: 7 },
  { theme: "snow", form: "plaza", terrain: "hillside", seed: 3 },
  { theme: "desert", form: "plaza", terrain: "basin", seed: 7 },
  { theme: "swamp", form: "plaza", terrain: "ridge", seed: 3 },
] as const;

const ctx = { project: createBlankProject() as Project }; ensureBundledTilesets(ctx.project);
type Pt = { mapId: string; x: number; y: number; note: string; dir?: string };
const points: Record<string, Pt> = {};
const blocked = (map: GameMap, x: number, y: number) => {
  const r = map.relief!; const k = y * map.width + x;
  return (r.levels[k] ?? 0) !== 0 || (r.ramps?.[k] ?? 0) !== 0;
};
for (const v of VILLAGES) {
  const id = `rv_${v.theme}_${v.terrain}_${v.seed}`;
  const r = runTool(ctx, "author_beodeul_town", { ...v, id } as never);
  if (!r.ok) throw new Error(`${id}: ${r.summary}`);
  const map = ctx.project.maps[(r.data as { mapId: string }).mapId]!; const rel = map.relief;
  if (!rel) throw new Error(`${id}: relief 없음`);
  const W = map.width, lv = (x: number, y: number) => rel.levels[y * W + x] ?? 0, rc = (x: number, y: number) => rel.ramps?.[y * W + x] ?? 0;
  // 북쪽 끝: 0번 줄에서 들린 칸 옆 0단 칸(띠가 보이던 자리) — 없으면 들린 칸 아무 데나
  let top: Pt | null = null;
  for (let x = 1; x < W - 1 && !top; x++) if (lv(x, 0) === 0 && (lv(x - 1, 0) > 0 || lv(x + 1, 0) > 0)) top = { mapId: map.id, x, y: 1, note: `${id} 북쪽 끝 (${x},0) 옆이 들린 칸` };
  for (let x = 0; x < W && !top; x++) if (lv(x, 0) > 0) top = { mapId: map.id, x, y: 2, note: `${id} 북쪽 끝 들린 칸 (${x},0)` };
  // 매끈한 경사로: 길 위 북쪽 오르막(코드 1)을 우선 — 발치(경사로 남쪽 끝 바로 아래)에서 위를 본다
  let ramp: Pt | null = null;
  const cands: { x: number; y: number; code: number }[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < W; x++) { const c = rc(x, y); if (c >= 1 && c <= 4) cands.push({ x, y, code: c }); }
  const north = cands.filter((c) => c.code === 1 && rc(c.x, c.y + 1) === 0 && c.y + 1 < map.height && !blocked(map, c.x, c.y + 1));
  const pick = north.sort((a, b) => Math.abs(a.x - W / 2) - Math.abs(b.x - W / 2))[0];
  if (pick) ramp = { mapId: map.id, x: pick.x, y: Math.min(map.height - 1, pick.y + 1), note: `${id} 경사로 발치 (${pick.x},${pick.y + 1}) — 북쪽 오르막` };
  else if (cands[0]) ramp = { mapId: map.id, x: cands[0].x, y: cands[0].y, note: `${id} 경사로 위 (${cands[0].x},${cands[0].y}) 코드 ${cands[0].code}` };
  if (top) points[`${v.theme}-top`] = top;
  if (ramp) points[`${v.theme}-ramp`] = ramp;
  const stairs = (rel.ramps ?? []).filter((c) => c >= 5 && c <= 8).length;
  console.log(id, `${W}x${map.height}`, "smooth ramps", cands.length, "stairs", stairs, "top", top && `${top.x},${top.y}`, "ramp", ramp && `${ramp.x},${ramp.y}`);
}
const first = Object.values(points)[0]!;
const project = ctx.project;
// 오프닝 컷신을 끈다 — 켜 두면 순간이동 비트가 컷신 위에서 찍힌다
if (project.system.opening) project.system.opening.enabled = false;
project.startMapId = first.mapId; project.startPos = { x: first.x, y: first.y };
// 번들 타일셋 전부를 실으면 100MB 라 플레이어 탭이 죽는다 — 맵이 쓰는 타일셋만, 게임 화면과 무관한 참고문서는 뺀다(조립 키트는 편집기 불러오기가 요구한다)
const used = new Set(Object.values(project.maps).map((m) => m.tilesetId));
for (const id of Object.keys(project.tilesets)) if (!used.has(id)) delete project.tilesets[id];
for (const t of Object.values(project.tilesets)) { delete (t as { referenceDocuments?: unknown }).referenceDocuments; }
fs.mkdirSync(OUT.replace(/\/[^/]+$/u, ""), { recursive: true });
fs.writeFileSync(OUT, serializePretty(project));
fs.writeFileSync(`${OUT}.points.json`, JSON.stringify(points, null, 1));
console.log("->", OUT, Object.keys(points).join(" "));
