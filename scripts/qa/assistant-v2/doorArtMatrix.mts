// 문 그림 읽기 × 테마 표(모델 없음): 「이 칸이 문·계단 그림인가」를 묻는 도구·검사를 테마 맵마다 같은 상황에 놓고,
// 칩셋이 적어 둔 입구(place/entrances.ts entranceArtCells)와 이름표 낱말로만 입구인 그림(가문비·얼음 구멍·무너진 아치…)을 갈라 잰다.
//   줄 transfer-pair: create_transfer_pair 의 트리거 올리기 · 줄 scene-lint: 쓰기 도구 뒤에 모델에게 가는 장면 경고 scene-transfer-off-door(「문 칸으로 옮겨라」)
//   줄 gate-art: 바깥 → 던전 출입구의 「굴 입구·문 그림이 없다」(placementRules door-bare)가 소품 그림의 낱말을 입구로 치는가
//   ok 적힌 입구에서만 움직였다 · wrong 낱말로만 입구인 그림을 입구로 다뤘다 · none 적힌 입구를 못 알아봤다 · n/a 그 맵에 놓을 상황이 없다
//   bun scripts/qa/assistant-v2/doorArtMatrix.mts <outDir> [테마,테마…]     문서 openwiki/assistant-v2.md 「문 그림 읽기도 적힌 입구로」
import fs from "node:fs";
import { isPassable } from "../../../src/project/collision.ts";
import { newScenePolishIssues } from "../../../src/project/lint/scenePolishLint.ts";
import { isDoorArtCell } from "../../../src/project/staging/doorCells.ts";
import { tileLabel } from "../../../src/ai/v2/place/cells.ts";
import { reachableCells } from "../../../src/ai/v2/judge/eventReach.ts";
import { entranceArtCells, isEntranceArt } from "../../../src/ai/v2/place/entrances.ts";
import { placementProblems } from "../../../src/ai/v2/place/placementRules.ts";
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

  // ── scene-lint: 그림 바로 밑 걷는 칸에 선 출구(밟으면 다른 맵) — 경고가 «문 칸 (x,y) 으로 옮겨라» 고 그 그림 칸을 가리키는가.
  //    낱말 읽기(SCENE_READER=word, 옛 동작)와 적힌 입구 읽기(기본 — 도구 실행기가 주는 것)를 같은 심기로 잰다.
  try {
    const reader = process.env.SCENE_READER === "word" ? undefined : isEntranceArt;
    const exitAt = (id: string, x: number, y: number): any => ({ id, name: "나가는 곳", x, y, trigger: { kind: "playerTouch" }, commands: [],
      pages: [{ id: `${id}_p0`, name: "", conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "transfer", mapId: "map_t_elsewhere", x: 1, y: 1, direction: "down" }] }] });
    const under = (pred: (x: number, y: number) => boolean) => {
      const cells: { x: number; y: number }[] = [];
      for (let y = 2; y < M0.height - 2; y++) for (let x = 2; x < w - 2; x++) if (free(x, y) && !art.has(y * w + x) && !word(x, y) && !evAt(x, y - 1) && pred(x, y - 1)) cells.push({ x, y });
      return cells;
    };
    const pointed = (cells: { x: number; y: number }[], tag: string) => {
      if (!cells.length) return { n: 0, hits: [] as { x: number; y: number; label: string }[], bare: 0 };
      const map1 = { ...M0, events: [...M0.events, ...cells.map((c, k) => exitAt(`ev_t_${tag}_${k}`, c.x, c.y))] };
      const p1 = { ...P0, maps: { ...P0.maps, [s.mapId]: map1, map_t_elsewhere: { ...M0, id: "map_t_elsewhere", name: "다른 곳", events: [] } } };
      const issues = newScenePolishIssues(P0, p1, reader ? { doorArt: reader } : {}).filter((i) => i.code === "scene-transfer-off-door" && i.mapId === s.mapId && String(i.eventId).startsWith(`ev_t_${tag}_`));
      const hits = issues.map((i) => /옆\((\d+),(\d+)\)/u.exec(i.message)).filter(Boolean).map((m) => ({ x: Number(m![1]), y: Number(m![2]), label: topLabel(P0, M0, Number(m![1]), Number(m![2])) }));
      return { n: cells.length, hits, bare: issues.length - hits.length };
    };
    const fake = pointed(spread(under((x, y) => !art.has(y * w + x) && word(x, y)), 4), "w"), real = pointed(spread(under((x, y) => art.has(y * w + x)), 4), "d");
    const fakeToArt = fake.hits.filter((h) => !art.has(h.y * w + h.x)), realToDoor = real.hits.filter((h) => art.has(h.y * w + h.x));
    const named = [...new Set(fakeToArt.map((h) => `«${h.label}»`))].slice(0, 3).join(" ");
    const detail = `exit under word-only art: told to move onto that picture ${fakeToArt.length}/${fake.n}${named ? ` ${named}` : ""} (called bare ground ${fake.bare}) · exit under a declared entrance: told to move onto the door ${realToDoor.length}/${real.n}`;
    const v: V = !fake.n && !real.n ? "n/a" : fakeToArt.length ? "wrong" : realToDoor.length < real.n ? "none" : "ok";
    rows.push({ stage: "scene-lint", theme: s.theme, kind: s.kind, v, detail, cases: [...fakeToArt.map((h) => ({ ...h, by: "word" })), ...realToDoor.map((h) => ({ ...h, by: "declared" }))] });
  } catch (e) { rows.push({ stage: "scene-lint", theme: s.theme, kind: s.kind, v: "wrong", detail: `threw ${(e as Error).message.slice(0, 160)}`, cases: [] }); }

  // ── gate-art: 바깥 맵에서 던전으로 가는 출입구 — 「굴 입구·문·계단 그림이 없다」(place/placementRules.ts door-bare)가 무엇을 입구 그림으로 치는가.
  //    세 자리에 심는다: 맨땅(위·아래 칸에 아무 그림 없음) · 적힌 입구 바로 밑 · 굽기가 소품·바닥이라 적은 그림(역할)인데 이름표 낱말이 문·굴·다리인 것 바로 밑(「가문비」「세운 보일러(화실 문)」).
  //    맨땅과 소품 밑은 짚어야 하고 적힌 입구 밑은 짚지 않아야 한다. 역할이 건물이거나 없는 낱말 그림(성문·거목 굴 문)은 판정하지 않고 수만 적는다.
  try {
    const outdoor = M0.mapRole !== "dungeon" && M0.climate?.mode !== "indoor";
    const meta: any[] = P0.tilesets[M0.tilesetId]?.tileMeta ?? [];
    const WORD = /계단|사다리|문|입구|출구|갱구|굴|아치|통로|길|다리|발판|매트|깔개|그림자|stair|ladder|door|gate|adit|mouth|arch|exit|path|road|bridge|mat|rug|shadow/iu, ROAD = /길|path|road|모랫길|흙길/iu; // 옛 읽기(재는 쪽의 사본)
    const ENTRANCE_ROLES = new Set(["building", "wall", "door", "stairs"]);
    const tilesAt = (x: number, y: number): number[] => (x < 0 || y < 0 || x >= w || y >= M0.height ? [] : LAYERS.map((k) => M0[k]?.[y * w + x]).filter((t: any) => typeof t === "number" && t >= 0));
    const wordTiles = (x: number, y: number) => tilesAt(x, y).filter((t) => { const l = meta[t]?.label; return !!l && WORD.test(l) && !ROAD.test(l); });
    const kindAt = (x: number, y: number): "declared" | "prop-word" | "other-word" | "none" => {
      if (art.has(y * w + x)) return "declared";
      const wt = wordTiles(x, y);
      if (!wt.length && !word(x, y)) return "none";
      return wt.length && wt.every((t) => meta[t]?.role && !ENTRANCE_ROLES.has(meta[t].role)) ? "prop-word" : "other-word";
    };
    const spots: Record<string, { x: number; y: number; label?: string }[]> = { bare: [], declared: [], "prop-word": [], "other-word": [] };
    if (outdoor) for (let y = 3; y < M0.height - 3; y++) for (let x = 3; x < w - 3; x++) {
      if (!free(x, y) || evAt(x, y - 1) || evAt(x, y + 1)) continue;
      const here = kindAt(x, y), up = kindAt(x, y - 1), down = kindAt(x, y + 1);
      if (here !== "none" || down !== "none") continue;
      (up === "none" ? spots.bare : spots[up])!.push({ x, y, label: up === "none" ? undefined : topLabel(P0, M0, x, y - 1) });
    }
    const gateTo = (id: string, x: number, y: number): any => ({ id, name: "→ 굴", x, y, trigger: { kind: "playerTouch" }, commands: [],
      pages: [{ id: `${id}_p0`, name: "", conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "transfer", mapId: "map_t_dungeon", x: 1, y: 1, direction: "down" }] }] });
    const picked = Object.fromEntries(Object.entries(spots).map(([k, cells]) => [k, spread(cells, 4)]));
    const planted = Object.entries(picked).flatMap(([k, cells]) => cells.map((c, n) => ({ k, c, id: `ev_t_${k}_${n}` })));
    const map1 = { ...M0, events: [...M0.events, ...planted.map((q) => gateTo(q.id, q.c.x, q.c.y))] };
    const p1 = { ...P0, maps: { ...P0.maps, [s.mapId]: map1, map_t_dungeon: { ...M0, id: "map_t_dungeon", name: "굴", mapRole: "dungeon", events: [] } } };
    const flagged = new Set(placementProblems(p1, map1).filter((q: any) => q.kind === "door-bare").map((q: any) => q.eventId));
    const hit = (k: string) => planted.filter((q) => q.k === k && flagged.has(q.id)).length, n = (k: string) => picked[k]!.length;
    const missed = planted.filter((q) => q.k === "prop-word" && !flagged.has(q.id));
    const named = [...new Set(missed.map((q) => `«${q.c.label}»`))].slice(0, 3).join(" ");
    const detail = `cells under prop-role word art ${spots["prop-word"]!.length} · under a declared entrance ${spots.declared!.length} · called bare: bare ground ${hit("bare")}/${n("bare")} · under prop-role word art ${hit("prop-word")}/${n("prop-word")}${named ? ` (not called bare: ${named})` : ""}`
      + ` · under a declared entrance ${hit("declared")}/${n("declared")} · under other word art (building role or none — not judged) ${hit("other-word")}/${n("other-word")}`;
    const v: V = !outdoor || !planted.length ? "n/a" : missed.length ? "wrong" : hit("declared") || hit("bare") < n("bare") ? "none" : "ok";
    rows.push({ stage: "gate-art", theme: s.theme, kind: s.kind, v, detail: outdoor ? detail : "indoor or dungeon map", cases: planted.map((q) => ({ ...q.c, by: q.k, bare: flagged.has(q.id) })) });
  } catch (e) { rows.push({ stage: "gate-art", theme: s.theme, kind: s.kind, v: "wrong", detail: `threw ${(e as Error).message.slice(0, 160)}`, cases: [] }); }

  console.log(`${s.theme}/${s.kind} ${Date.now() - t0}ms ${rows.filter((r) => r.theme === s.theme && r.kind === s.kind).map((r) => `${r.stage}=${r.v}`).join(" ")}`);
}
const first = rows[0]?.theme ?? "none";
fs.writeFileSync(`${out}/door-${first}.json`, JSON.stringify(rows, null, 1));
const tally: Record<string, Record<string, number>> = {};
for (const r of rows) { (tally[r.stage] ??= {})[r.v] = (tally[r.stage]![r.v] ?? 0) + 1; }
console.log(JSON.stringify(tally));
