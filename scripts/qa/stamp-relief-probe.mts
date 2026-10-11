// stamp_object 높이 단 규칙 프로브 — LLM 없이 높이 있는 버들항 마을을 짓고 자리마다 찍어 거절/허용을 확인한다.
//   bun scripts/qa/stamp-relief-probe.mts [--theme river] [--terrain terraces] [--seed 7]
// 확인: (1) 두 단 걸침·경사로 위·남쪽 가림 → 거절, 한 단 위 → 허용 (2) relief 없는 맵은 예전대로 (3) 예외(풀꽃 1칸·다리·바닥 칠)
//       (4) 같은 맵에 마을을 다시 지어도(옛 relief 가 남은 채 찍기) 찍기 실패 0
import { runTool } from "../../src/editor/tools/index.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import { reliefLevel, rampAt } from "../../src/project/relief/walk.ts";
import type { GameMap, Project, StructureKitDef } from "../../src/project/types.ts";
import { checkReliefPlacement } from "../../src/project/kitPlacementRules.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const theme = arg("theme", "river"), terrain = arg("terrain", "terraces"), seed = Number(arg("seed", "7"));
const base = createBlankProject() as Project; ensureBundledTilesets(base);
const baseJson = JSON.stringify(base);
const ts = base.tilesets.beodeul_city!;
const kit = (id: string): StructureKitDef => ts.structureKits!.find((k) => k.id === id)!;
let failures = 0;
const expect = (label: string, ok: boolean, detail: string) => { console.log(`${ok ? "PASS" : "FAIL"} ${label} — ${detail.slice(0, 400)}`); if (!ok) failures += 1; };

const ctx = { project: JSON.parse(baseJson) as Project };
const built = runTool(ctx, "author_beodeul_town", { theme, terrain, seed, id: "v" } as never);
if (!built.ok) throw new Error(built.summary);
const d = built.data as any;
const map = ctx.project.maps[d.mapId] as GameMap;
const r = map.relief!;
console.log(`village ${theme}/${terrain}/${seed}: stampFailed=${d.stampFailed} levels=${JSON.stringify(d.relief?.levels)} ramps=${d.relief?.ramps}`);
const snapshot = JSON.stringify(ctx.project);
const tryStamp = (objectId: string, x: number, y: number) => { const c = { project: JSON.parse(snapshot) as Project }; return runTool(c, "stamp_object", { objectId, mapId: map.id, x, y } as never); };

const mat = "bd-pick-desert-oasis-datemat"; const K = kit(mat); // 3×2, 2층 통행 o — 실측 문제의 돗자리
const drawnCells = (k: StructureKitDef) => { const out: [number, number][] = []; k.rows.forEach((row, dy) => row.tiles.forEach((t, dx) => { if (t >= 0 || (row.upperTiles?.[dx] ?? -1) >= 0) out.push([dx, dy]); })); return out; };
const foot = drawnCells(K);
const classify = (x: number, y: number) => {
  const cells = foot.map(([dx, dy]) => [x + dx, y + dy] as const);
  if (cells.some(([X, Y]) => X >= map.width || Y >= map.height)) return "out";
  if (cells.some(([X, Y]) => rampAt(r, X, Y))) return "ramp";
  const lv = new Set(cells.map(([X, Y]) => reliefLevel(r, X, Y)));
  if (lv.size > 1) return "straddle";
  const L = [...lv][0]!; const bottom = y + K.height - 1;
  for (const [dx] of foot) for (let k = 1; k <= 3; k += 1) if (bottom + k < map.height && reliefLevel(r, x + dx, bottom + k) > L + k - 1) return "occluded";
  return "flat";
};
const find = (kind: string, accept: (x: number, y: number) => boolean = () => true): [number, number] | null => {
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (classify(x, y) === kind && accept(x, y)) return [x, y];
  return null;
};
// 한 단 위 자리 중 다른 놓기 규칙(물·길 막기)에 안 걸리는 곳을 찾기 위해 시도해 본다
const at = (kind: string) => { for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (classify(x, y) === kind) { if (kind !== "flat") return [x, y] as [number, number]; const res = tryStamp(`kit:beodeul_city/${mat}`, x, y); if (res.ok) return [x, y] as [number, number]; } return null; };

for (const kind of ["straddle", "ramp", "occluded", "flat"]) {
  const pos = at(kind);
  if (!pos) { console.log(`SKIP ${kind}: 자리 없음`); continue; }
  const res = tryStamp(`kit:beodeul_city/${mat}`, pos[0], pos[1]);
  if (kind === "flat") expect(`한 단 위 (${pos})`, res.ok, res.summary);
  else expect(`${kind} (${pos}) 거절`, !res.ok && /높이 규칙/.test(res.summary), res.summary);
}
// 두 단 걸침 자리는 하나도 허용되지 않는다(돗자리·집) — 전수는 규칙 함수로 직접(도구 실행은 위 표본)
const patternOf = (k: StructureKitDef) => ({ width: k.width, height: k.height, lower: k.rows.flatMap((row) => [...row.tiles]), upper: k.rows.flatMap((row) => [...(row.upperTiles ?? new Array(k.width).fill(-1))]) });
{
  const house = (ts.structureKits ?? []).find((k) => k.id === "bd-house-h104_1")!;
  for (const k of [K, house]) {
    const f = drawnCells(k); let tried = 0, accepted = 0; const bad: string[] = [];
    for (let y = 0; y <= map.height - k.height; y += 1) for (let x = 0; x <= map.width - k.width; x += 1) {
      const lv = new Set(f.map(([dx, dy]) => reliefLevel(r, x + dx, y + dy))); if (lv.size < 2) continue;
      tried += 1; if (!checkReliefPlacement(map, ts, `kit:beodeul_city/${k.id}`, k.name ?? k.id, patternOf(k), x, y)) { accepted += 1; if (bad.length < 3) bad.push(`(${x},${y})`); }
    }
    expect(`${k.id} 두 단 걸침 자리 전부 거절`, tried > 0 && accepted === 0, `시도 ${tried} · 허용 ${accepted} ${bad.join(" ")}`);
  }
  // 다리·바닥 칠·그림자는 높이와 무관 — 걸침 자리라도 규칙 함수가 통과시킨다
  for (const id of ["bd-bridge-arch", "bd-pick-desert-oasis-ground-sand", "bd-rv-shadow-r2-10"]) {
    const k = kit(id); if (!k) continue; const f = drawnCells(k); let pos: [number, number] | null = null;
    for (let y = 0; y <= map.height - k.height && !pos; y += 1) for (let x = 0; x <= map.width - k.width && !pos; x += 1) if (new Set(f.map(([dx, dy]) => reliefLevel(r, x + dx, y + dy))).size > 1) pos = [x, y];
    if (pos) { const why = checkReliefPlacement(map, ts, `kit:beodeul_city/${id}`, k.name ?? id, patternOf(k), pos[0], pos[1]); expect(`${id} 예외 (${pos})`, why === null, why ?? "통과"); }
  }
}
// 예외: 풀꽃 1칸은 남쪽이 높은 자리(가림)라도 허용, 경사로 위는 거절. 같은 자리의 돗자리는 가림으로 거절
{
  const flower = "bd-pick-deep-forest-path-wild-a"; const F = kit(flower);
  let occl: [number, number] | null = null, ramp: [number, number] | null = null;
  for (let y = 0; y < map.height - 1; y += 1) for (let x = 0; x < map.width; x += 1) {
    if (!ramp && rampAt(r, x, y)) ramp = [x, y];
    if (!occl && !rampAt(r, x, y) && !rampAt(r, x, y + 1) && reliefLevel(r, x, y + 1) > reliefLevel(r, x, y)) occl = [x, y];
  }
  if (occl) {
    const why = checkReliefPlacement(map, ts, `kit:beodeul_city/${flower}`, F.name ?? flower, patternOf(F), occl[0], occl[1]);
    expect(`풀꽃 1칸 가림 자리 (${occl}) 허용(바닥 장식 예외)`, why === null, why ?? "통과");
    const barrel = kit("bd-prop-fish_barrel") ?? kit("bd-pick-desert-oasis-jars");
    const whyB = checkReliefPlacement(map, ts, `kit:beodeul_city/${barrel.id}`, barrel.name ?? barrel.id, patternOf(barrel), occl[0], occl[1] - barrel.height + 1);
    expect(`${barrel.id} 가림 자리 거절`, !!whyB && /덮인다/.test(whyB), whyB ?? "통과(잘못)");
  } else console.log("SKIP 가림 자리 없음");
  if (ramp) { const res = tryStamp(`kit:beodeul_city/${flower}`, ramp[0], ramp[1]); expect(`풀꽃 경사로 (${ramp}) 거절`, !res.ok && /경사로/.test(res.summary), res.summary); }
}
// (2) relief 없는 맵: 같은 자리 걸침 찍기가 그대로 된다
{
  const c = { project: JSON.parse(snapshot) as Project }; delete c.project.maps[map.id]!.relief;
  const pos = find("straddle");
  if (pos) { const res = runTool(c, "stamp_object", { objectId: `kit:beodeul_city/${mat}`, mapId: map.id, x: pos[0], y: pos[1] } as never); expect(`relief 없는 맵 (${pos}) 허용`, res.ok, res.summary); }
  const flat = { project: JSON.parse(baseJson) as Project };
  const made = runTool(flat, "create_map", { id: "flat", name: "flat", width: 30, height: 20, tilesetId: "beodeul_city" } as never);
  const res = runTool(flat, "stamp_object", { objectId: `kit:beodeul_city/${mat}`, mapId: "flat", x: 4, y: 4 } as never);
  expect("새 평지 맵 찍기", made.ok && res.ok && !flat.project.maps.flat!.relief, res.summary);
}
// (5) 가림 — 합성 지형: 평지 맵 30×20 의 y ≥ 10 을 1단, y ≥ 15 를 2단으로 올리고 그 바로 북쪽에 찍는다
{
  const c = { project: JSON.parse(baseJson) as Project };
  runTool(c, "create_map", { id: "syn", name: "syn", width: 30, height: 20, tilesetId: "beodeul_city" } as never);
  const W = 30, H = 20; const levels = Array.from({ length: W * H }, (_, i) => { const y = Math.floor(i / W); return y >= 15 ? 2 : y >= 10 ? 1 : 0; });
  c.project.maps.syn!.relief = { width: W, height: H, levels, ramps: new Array(W * H).fill(0) };
  const synSnap = JSON.stringify(c.project);
  const stamp = (id: string, x: number, y: number) => runTool({ project: JSON.parse(synSnap) as Project }, "stamp_object", { objectId: `kit:beodeul_city/${id}`, mapId: "syn", x, y } as never);
  const a = stamp(mat, 4, 8); expect("0단, 바로 남쪽 1단 → 가림 거절", !a.ok && /덮인다/.test(a.summary), a.summary);
  const b = stamp(mat, 4, 7); expect("0단, 남쪽 2줄째 1단 → 허용(L+k−1=1)", b.ok, b.summary);
  const c2 = stamp(mat, 4, 12); expect("1단, 남쪽 2줄째 2단 → 허용", c2.ok, c2.summary);
  const d2 = stamp(mat, 4, 13); expect("1단, 바로 남쪽 2단 → 가림 거절", !d2.ok && /덮인다/.test(d2.summary), d2.summary);
  const e = stamp(mat, 4, 9); expect("0·1단 걸침 거절", !e.ok && /두 단에 걸친다/.test(e.summary), e.summary);
  const f = stamp("bd-pick-deep-forest-path-wild-a", 4, 9); expect("풀꽃 1칸 가림 자리 허용", f.ok, f.summary);
}
// (4) 옛 relief 가 남은 빈 맵에 마을 짓기 — 마을 도구는 찍기를 다 끝낸 뒤 relief 를 싣는데, 찍는 동안 옛 relief 가 남아 있어도 실패가 없어야 한다
{
  const c = { project: JSON.parse(baseJson) as Project };
  runTool(c, "create_map", { id: "again", name: "again", width: map.width, height: map.height, tilesetId: "beodeul_city" } as never);
  c.project.maps.again!.relief = JSON.parse(JSON.stringify(r));
  const again = runTool(c, "author_beodeul_town", { theme, terrain, seed: seed + 1, mapId: "again" } as never);
  const dd = again.data as any;
  expect("옛 relief 가 남은 맵에 다시 짓기", again.ok && dd?.stampFailed === 0, `${again.summary.slice(0, 160)} stampFailed=${dd?.stampFailed} warnings=${JSON.stringify(((again as any).diff?.warnings ?? again.warnings ?? [])).slice(0, 400)}`);
}
console.log(failures ? `FAILURES ${failures}` : "ALL PASS");
process.exit(failures ? 1 : 0);
