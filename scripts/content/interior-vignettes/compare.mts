// 기물 묶음(vignette) 배치 전/후 비교 — 조수 v2 가 청사진 장소를 자동으로 지을 때와 같은 길(guessPlaceSpec → builderFor → build)로
// 방 몇 개를 옛 길(견본 한 벌 + 빈 바닥 메우기)과 새 길(묶음 배치기)로 지어 1배 PNG 로 그린다.
//   bun scripts/content/interior-vignettes/compare.mts --out <dir> [--salt 7] [--names 서재,여관,…]
// 새 길은 hints.furnish:"vignette", 옛 길은 hints.furnish:"template".
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { createBuildRun } from "../../../src/ai/v2/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/builders/index.ts";
import { guessPlaceSpec } from "../../../src/ai/v2/placeGuess.ts";
import { measureInteriorBareFloor } from "../../../src/editor/handInterior/bareFloor.ts";
import { isPassable } from "../../../src/project/collision.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import type { GameMap, Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const out = path.resolve(opt("out") ?? "/tmp/vignette-compare");
const salt = Number(opt("salt") ?? 7);
const names = (opt("names") ?? "잠긴 서재,서재,여관,대장간,교실,가게").split(",");
const modes = (opt("modes") ?? "template,vignette").split(",");
fs.mkdirSync(out, { recursive: true });

/** 걷는 바닥이 시작(남쪽 출구 위)에서 몇 칸 닿는가 · 막힌 바닥 칸 수 — 「가구에 갇힘」 확인용. */
function walk(project: Project, map: GameMap) {
  const w = map.width, h = map.height;
  const pass = (x: number, y: number) => isPassable(project, map, x, y);
  let floor = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (pass(x, y)) floor++;
  let sx = -1, sy = -1;
  for (let y = h - 1; y >= 0 && sx < 0; y--) for (let x = 0; x < w; x++) if (pass(x, y)) { sx = x; sy = y; break; }
  const seen = new Set<string>(); const q = sx >= 0 ? [[sx, sy]] : [];
  if (q.length) seen.add(`${sx},${sy}`);
  while (q.length) { const [x, y] = q.shift()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x! + dx!, ny = y! + dy!; const k = `${nx},${ny}`; if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(k) || !pass(nx, ny)) continue; seen.add(k); q.push([nx, ny]); } }
  return { floor, reached: seen.size };
}

const rows: string[] = [];
for (const mode of modes) for (const name of names) {
  const project = createBlankProject() as Project;
  const spec0 = guessPlaceSpec(name, project, "RPG", `${name} 하나를 지어 줘`);
  const spec = { ...spec0, salt, mapId: undefined, hints: { ...(spec0.hints ?? {}), furnish: mode, newMap: true } };
  const builder = builderFor(spec);
  if (!builder) { rows.push(`${mode}\t${name}\t빌더 없음`); continue; }
  const run = createBuildRun({ project, currentMapId: project.startMapId });
  const res = builder.build(run, spec);
  const p = run.ctx.project;
  const id = res.mapIds[0];
  const map = id ? p.maps[id] : undefined;
  if (!res.ok || !map) { rows.push(`${mode}\t${name}\t실패 ${res.summary.slice(0, 160)}`); continue; }
  const file = path.join(out, `${name.replace(/\s+/gu, "_")}-${mode}.png`);
  fs.writeFileSync(file, renderMapPng(p, map, 1).png);
  const bare = measureInteriorBareFloor(p, map);
  const wk = walk(p, map);
  const furn = (map.upperTiles.filter((t) => t >= 0).length);
  rows.push(`${mode}\t${name}\t${spec.type}/${spec.zones?.map((z) => z.kind).join("+")}\t${map.width}x${map.height}\t맨바닥 ${bare?.pct}%\t닿음 ${wk.reached}/${wk.floor}\t위층칸 ${furn}\t${file}`);
  fs.writeFileSync(path.join(out, `${name.replace(/\s+/gu, "_")}-${mode}.txt`), `${res.summary}\n${res.warnings.join("\n")}\n`);
}
console.log(rows.join("\n"));
fs.writeFileSync(path.join(out, "summary.tsv"), rows.join("\n") + "\n");
