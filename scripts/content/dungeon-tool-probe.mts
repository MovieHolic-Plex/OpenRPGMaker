// author_dungeon 도구 직접 호출 프로브(2026-10-15) — 프로젝트 종류별로 도구를 돌려 맵 PNG·결과 data 를 쏟는다.
//   bun scripts/content/dungeon-tool-probe.mts <outDir> <pokemon|rpg|beodeul> '<json args>'
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../src/project/defaults/blankProject.ts";
import { applyGenrePreset } from "../../src/project/genrePresets.ts";
import { AUTHOR_DUNGEON_TOOL } from "../../src/editor/tools/dungeonTools.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { store } from "../../src/project/store.ts";

const [out = "/tmp/dg/tool", kind = "pokemon", raw = "{}"] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const project = createBlankProject();
if (kind === "pokemon") applyGenrePreset(project, "monster-collect");
else if (kind === "rpg") applyGenrePreset(project, "adventure-jrpg");
store.loadProject?.(project);
const args = JSON.parse(raw);
try {
  const res = AUTHOR_DUNGEON_TOOL.run(project, args);
  const mapId = (res.data as { mapId: string }).mapId;
  const map = project.maps[mapId]!;
  const file = path.join(out, `${kind}-${String(args.type ?? "default")}${args.variant ? "-" + args.variant : ""}-${args.seed ?? 7}.png`);
  fs.writeFileSync(file, renderMapPng(project, map).png);
  const d = res.data as Record<string, unknown>;
  console.log(res.summary);
  console.log(JSON.stringify({ ...d, rooms: (d.rooms as unknown[]).length, corridors: undefined, counts: undefined }, null, 1).slice(0, 2500));
  console.log("PNG", file, "locations", map.locations?.length, "encounterTable", map.encounterTable?.length ?? 0);
} catch (e) { console.log("ERR", (e as { code?: string }).code, (e as Error).message); }
