// 같은 마을 요청을 게임 여섯으로 짓는다(모델 없음) — 2차: 바닥·길·광장 재질, 나무 수종, 숲 생김새(게임마다 한 가지 겉모습).
//
//   bun scripts/content/beodeul-variety/sixGames.mts <결과 폴더> [--tag before|after] [--theme river|coast] [--same-salt] [--no-look] [--alone]
//
// 실제 게임처럼 장소 씨앗(salt)은 게임마다 다르다(여섯 씨앗 고정). --same-salt 는 여섯 모두 같은 씨앗 — 배치는 같고 겉모습만 다른 그림을 낸다
// («같은 씨앗으로 지은 두 게임에서 그림이 다른 칸» 을 재는 용도). --no-look 은 게임 열쇠를 넘기지 않는다(겉모습 고르기 전과 같은 그림).
// 남기는 것: <tag>-<theme>-<n>.png(1배) · <tag>-<theme>.json — 게임마다 겉모습 · 통행 격자 해시 · 걷는 칸 · 닿는 칸 · 바닥 칸 해시 · 숲 칸 수.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/shared/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { isPassable } from "../../../src/project/collision.ts";
import { computeReachableCells } from "../../../src/project/lint/reachability.ts";
import { describeTilesetLook, tilesetLookTableFor } from "../../../src/assets/tilesetLooks.ts";
import { chooseTilesetLook } from "../../../src/project/tilesetLook.ts";
import type { PlaceSpec } from "../../../src/ai/v2/shared/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const argv = process.argv.slice(2);
const opt = (name: string, d: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1]! : d; };
const out = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1]!.startsWith("--") && !["--same-salt", "--no-look", "--alone"].includes(argv[i - 1]!)));
if (!out) throw new Error("sixGames.mts <결과 폴더> [--tag before|after] [--theme river|coast] [--same-salt] [--no-look]");
const tag = opt("tag", "now"), theme = opt("theme", "river");
fs.mkdirSync(out, { recursive: true });
export const GAMES = ["ashvale", "moonharbor", "thornkeep", "reedwater", "saltmere", "oakhollow"].map((name) => JSON.stringify(["project", `variety-${name}`]));
const SALTS = [4242, 91357, 250118, 604811, 733202, 918466];
const REQUEST: Record<string, { name: string; task: string; hints: Record<string, unknown> }> = {
  river: { name: "버들 마을", task: "강가에 작은 마을을 만들어 줘", hints: {} },
  coast: { name: "갈매기 포구", task: "바닷가에 포구 마을을 만들어 줘", hints: { theme: "coast" } },
};
const hash = (values: Iterable<number | string>): string => { let h = 0x811c9dc5; for (const v of values) for (const ch of String(v) + ",") { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
const req = REQUEST[theme]!;
const rows: Record<string, unknown>[] = [];
// 여섯 게임은 «한 사람이 차례로 만든 게임» — 뒤 게임은 앞 게임들이 쓴 겉모습을 안다(조수 요청의 lookTaken). --alone 이면 서로 모른다(4차 가 이전 표본과 같다).
const TAKEN: NonNullable<ToolContext["lookTaken"]>[number][][] = [];
{
  const table = tilesetLookTableFor("beodeul_city");
  const looks: NonNullable<ToolContext["lookTaken"]>[number][] = [];
  for (const key of GAMES) { TAKEN.push([...looks]); if (table) looks.push(chooseTilesetLook(table, key, looks)); }
}
for (const [n, key] of GAMES.entries()) {
  const project = createBlankProject();
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true, ...(argv.includes("--no-look") ? {} : { lookKey: key, ...(argv.includes("--alone") ? {} : { lookTaken: TAKEN[n] }) }) } as ToolContext;
  const run = createBuildRun(ctx);
  const salt = argv.includes("--same-salt") ? SALTS[0]! : SALTS[n]!;
  const spec = { type: "village", name: req.name, salt, variety: `${key}|${req.task}`, ...(Object.keys(req.hints).length ? { hints: req.hints } : {}) } as PlaceSpec;
  const res = builderFor(spec)!.build(run, spec);
  const map = res.mapIds[0] ? ctx.project.maps[res.mapIds[0]] : undefined;
  if (!res.ok || !map) { console.log(`${n} ${key}: 짓기 실패 — ${res.summary.slice(0, 200)}`); rows.push({ n, key, ok: false, summary: res.summary }); continue; }
  const tileset = ctx.project.tilesets[map.tilesetId]!;
  const file = `${tag}-${theme}-${n}.png`;
  fs.writeFileSync(path.join(out, file), renderMapPng(ctx.project, map).png);
  const pass: number[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) pass.push(isPassable(ctx.project, map, x, y) ? 1 : 0);
  const start = res.entrance && res.entrance.mapId === map.id ? res.entrance : ctx.project.startMapId === map.id ? { x: ctx.project.startPos.x, y: ctx.project.startPos.y } : undefined;
  const reach = start ? computeReachableCells(ctx.project, map, start.x, start.y).size : -1;
  const look = tileset.look;
  const row = { n, key, ok: true, file, salt, size: `${map.width}x${map.height}`, look: look ?? null, lookLabel: describeTilesetLook(tileset.id, look) || "원래 모습",
    lower: hash(map.lowerTiles), upper: hash(map.upperTiles), pass: hash(pass), walkable: pass.reduce((a, b) => a + b, 0), reach, cells: map.width * map.height };
  rows.push(row);
  console.log(`${n} ${key} 씨앗 ${salt} ${row.size} 겉모습 [${row.lookLabel}] 바닥 ${row.lower} 통행 ${row.pass}(걷는 칸 ${row.walkable}) 닿는 칸 ${reach}`);
}
fs.writeFileSync(path.join(out, `${tag}-${theme}.json`), JSON.stringify({ tag, theme, sameSalt: argv.includes("--same-salt"), request: req, rows }, null, 1));
