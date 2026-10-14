// 던전 키트 어댑터별 표본 렌더(2026-10-15) — 몬스터 키트 어댑터를 실제 맵으로 만들어 원본 해상도 PNG 로 쏟는다.
//   bun scripts/content/dungeon-kit-samples.mts <outDir> [type:seed ...]   (기본: 몬스터 어댑터 cave·volcano·ice·labyrinth × 시드 3·7·12)
import fs from "node:fs";
import path from "node:path";
import { createExpeditionSeed } from "../../src/project/examples/monsterExpedition/seed.ts";
import { composeMonsterDungeon, monsterKitFor } from "../../src/editor/dungeonKit/monster/monsterAdapter.ts";
import { MAP_TOOLS } from "../../src/editor/tools/mapTools.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { store } from "../../src/project/store.ts";
import type { DungeonSpec } from "../../src/editor/dungeonKit/types.ts";

const out = process.argv[2] ?? "/tmp/dg/monster-new";
fs.mkdirSync(out, { recursive: true });
const project = createExpeditionSeed();
store.loadProject?.(project);
const sheets = { dungeon: project.tilesets["monster_dungeon"]!, overworld: project.tilesets["monster_overworld"]! };
const createMap = MAP_TOOLS.find((t) => t.name === "create_map")!;
const want = process.argv.slice(3);
const list: { type: DungeonSpec["type"]; seed: number; variant?: string }[] = [];
if (want.length) for (const w of want) { const [t, s, v] = w.split(":"); list.push({ type: t as DungeonSpec["type"], seed: Number(s), variant: v }); }
else for (const [type, variant] of [["cave", undefined], ["cave", "wet"], ["volcano", undefined], ["ice", undefined], ["labyrinth", undefined], ["temple", undefined]] as const) for (const seed of [3, 7, 12]) list.push({ type, seed, variant });
for (const { type, seed, variant } of list) {
  const name = `m-${type}${variant ? "-" + variant : ""}-${seed}`;
  try {
    const t0 = performance.now();
    const ts = sheets[monsterKitFor(type!, variant)!.sheet];
    const c = composeMonsterDungeon(ts, { type, seed, variant, size: seed === 12 ? "large" : seed === 3 ? "small" : "medium" });
    const ms = Math.round(performance.now() - t0);
    const created = createMap.run(project, { id: name, name, width: c.width, height: c.height, tilesetId: ts.id, border: "none" });
    const id = (created.data as { mapId?: string; id?: string }).mapId ?? name;
    const map = project.maps[id]!;
    map.lowerTiles = c.lower.slice(); map.upperTiles = c.upper.slice();
    fs.writeFileSync(path.join(out, `${name}.png`), renderMapPng(project, map).png);
    fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ name, ms, ...c, lower: undefined, upper: undefined }));
    console.log(name, `${c.width}x${c.height}`, `${ms}ms`, "rooms", c.rooms.length, "counts", JSON.stringify(c.counts), "warn", c.warnings.length);
  } catch (e) { console.log(name, "ERROR", (e as Error).message); }
}
