// 문 그림 읽기 × 테마 표(모델 없음): 「이 칸이 문·계단 그림인가」를 묻는 도구·검사를 테마 맵마다 같은 상황에 놓고,
// 칩셋이 적어 둔 입구(place/entrances.ts entranceArtCells)와 이름표 낱말로만 입구인 그림(가문비·얼음 구멍·무너진 아치…)을 갈라 잰다.
//   ok 적힌 입구에서만 움직였다 · wrong 낱말로만 입구인 그림을 입구로 다뤘다 · none 적힌 입구를 못 알아봤다 · n/a 그 맵에 놓을 상황이 없다
//   bun scripts/qa/assistant-v2/doorArtMatrix.mts <outDir> [테마,테마…]     문서 openwiki/assistant-v2.md 「문 그림 읽기도 적힌 입구로」
import fs from "node:fs";
import { isPassable } from "../../../src/project/collision.ts";
import { isDoorArtCell } from "../../../src/project/staging/doorCells.ts";
import { tileLabel } from "../../../src/ai/v2/place/cells.ts";
import { reachableCells } from "../../../src/ai/v2/judge/eventReach.ts";
import { entranceArtCells } from "../../../src/ai/v2/place/entrances.ts";
import { mkRun, sources } from "./themeSources.mts";

/* eslint-disable @typescript-eslint/no-explicit-any */

const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;
const out = process.argv[2]!;
const onlyTheme = process.argv[3];
fs.mkdirSync(out, { recursive: true });
type V = "ok" | "none" | "wrong" | "n/a";
interface Row { stage: string; theme: string; kind: string; v: V; detail: string; cases: any[] }
const rows: Row[] = [];
const topLabel = (project: any, map: any, x: number, y: number): string =>
  LAYERS.map((k) => tileLabel(project, map, map[k]?.[y * map.width + x])).filter(Boolean).at(-1)?.replace(/\s*\([^)]*\)\s*$/u, "") ?? "?";
/** 서로 여섯 칸 넘게 떨어진 것만 max 개. */
const spread = <T extends { x: number; y: number }>(cells: T[], max: number): T[] => {
  const picks: T[] = [];
  for (const c of cells) { if (picks.length >= max) break; if (!picks.some((p) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) < 6)) picks.push(c); }
  return picks;
};

const only = onlyTheme ? new Set(onlyTheme.split(",")) : undefined;
for await (const s of sources(only ? (t) => only.has(t) : undefined)) {
  if ("error" in s) { console.log(`${s.theme}/${s.kind} build failed: ${s.error}`); continue; }
  const t0 = Date.now();
  const P0 = s.project, M0 = P0.maps[s.mapId], w = M0.width;
  const reach = reachableCells(P0, M0);
  const art = entranceArtCells(P0, M0);
  const word = (x: number, y: number) => isDoorArtCell(P0, M0, x, y);
  const evAt = (x: number, y: number) => M0.events.some((e: any) => e.x === x && e.y === y);
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < M0.height && !!reach?.[y * w + x] && isPassable(P0, M0, x, y) && !evAt(x, y);

  // ── transfer-pair: 문 그림 바로 아래의 걷는 칸을 주면 트리거가 그 그림 칸으로 올라간다 — 적힌 입구 밑에서만 그래야 한다.
  try {
    const under = (pred: (x: number, y: number) => boolean) => {
      const cells: { x: number; y: number }[] = [];
      for (let y = 2; y < M0.height - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (!free(x, y) || art.has(y * w + x) || word(x, y) || evAt(x, y - 1) || !pred(x, y - 1)) continue;
        cells.push({ x, y });
      }
      return cells;
    };
    const fakeAll = under((x, y) => !art.has(y * w + x) && word(x, y));
    const realAll = under((x, y) => art.has(y * w + x));
    const far = (c: { x: number; y: number }) => {
      let best: { x: number; y: number } | undefined, bd = -1;
      for (let y = 1; y < M0.height - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (!free(x, y) || art.has(y * w + x) || word(x, y) || word(x, y - 1) || art.has((y - 1) * w + x)) continue;
        const d = Math.abs(x - c.x) + Math.abs(y - c.y);
        if (d > bd) { bd = d; best = { x, y }; }
      }
      return best;
    };
    const link = (c: { x: number; y: number }) => {
      const b = far(c);
      if (!b) return { c, refused: "no far cell" };
      const run = mkRun(P0, s.mapId);
      const r = run.call("create_transfer_pair", { a: { mapId: s.mapId, x: c.x, y: c.y }, b: { mapId: s.mapId, x: b.x, y: b.y } });
      if (!r.ok) return { c, refused: String(r.summary).slice(0, 100) };
      const before = new Set(M0.events.map((e: any) => e.id));
      const added = run.ctx.project.maps[s.mapId].events.filter((e: any) => !before.has(e.id));
      const gate = added.sort((p: any, q: any) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) - Math.abs(q.x - c.x) - Math.abs(q.y - c.y))[0];
      // 올라간 칸이 막힌 그림이면 플레이어는 그 그림에 부딪혀야 넘어간다. 걸을 수 있는 칸(성문 통로 밑)으로 한 칸 옮긴 것은 끝점 풀이가 문·착지를 가른 것이다.
      const up = !!gate && gate.x === c.x && gate.y === c.y - 1;
      return { c, gate: gate ? { x: gate.x, y: gate.y } : undefined, moved: up && !isPassable(P0, M0, c.x, c.y - 1), through: up && isPassable(P0, M0, c.x, c.y - 1), label: topLabel(P0, M0, c.x, c.y - 1) };
    };
    const fake = spread(fakeAll, 4).map(link), real = spread(realAll, 4).map(link);
    const fakeMoved = fake.filter((r) => r.moved), realMoved = real.filter((r) => r.moved || r.through), realTried = real.filter((r) => !r.refused);
    const through = fake.filter((r) => r.through).length;
    const named = [...new Set(fakeMoved.map((r) => `«${r.label}»`))].slice(0, 3).join(" ");
    const detail = `walkable cells under word-only art ${fakeAll.length} · under a declared entrance ${realAll.length} · trigger moved onto word-only art ${fakeMoved.length}/${fake.length}${named ? ` ${named}` : ""}${through ? ` (+${through} onto a walkable passage cell)` : ""} · onto a declared entrance ${realMoved.length}/${realTried.length}`
      + `${real.length - realTried.length ? ` (refused ${real.length - realTried.length})` : ""}`;
    const v: V = !fake.length && !real.length ? "n/a" : fakeMoved.length ? "wrong" : realMoved.length < realTried.length ? "none" : "ok";
    rows.push({ stage: "transfer-pair", theme: s.theme, kind: s.kind, v, detail, cases: [...fake.map((r) => ({ ...r, by: "word" })), ...real.map((r) => ({ ...r, by: "declared" }))] });
  } catch (e) { rows.push({ stage: "transfer-pair", theme: s.theme, kind: s.kind, v: "wrong", detail: `threw ${(e as Error).message.slice(0, 160)}`, cases: [] }); }

  console.log(`${s.theme}/${s.kind} ${Date.now() - t0}ms ${rows.filter((r) => r.theme === s.theme && r.kind === s.kind).map((r) => `${r.stage}=${r.v}`).join(" ")}`);
}
const first = rows[0]?.theme ?? "none";
fs.writeFileSync(`${out}/door-${first}.json`, JSON.stringify(rows, null, 1));
const tally: Record<string, Record<string, number>> = {};
for (const r of rows) { (tally[r.stage] ??= {})[r.v] = (tally[r.stage]![r.v] ?? 0) + 1; }
console.log(JSON.stringify(tally));
