// 겉모습 선택지를 한 장씩: 같은 마을 한 판에 바닥·길 겉모습과 나무 수종을 차례로 걸어 그리고(칸은 그대로, 그림만), 숲 생김새는 같은 씨앗으로 넷을 짓는다(모델 없음).
//   bun scripts/content/beodeul-variety/lookGallery.mts <결과 폴더> [--salt N]
// 남기는 것: surface-<이름>.png · trees-<이름>.png · woods-<이름>.png(1배, "classic" = 원래 모습) · gallery.json(선택지 이름·라벨·숲 칸 수)
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/shared/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { tilesetLookTableFor } from "../../../src/assets/tilesetLooks.ts";
import type { PlaceSpec } from "../../../src/ai/v2/shared/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import type { Project, TilesetLook } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const out = argv[0]; if (!out) throw new Error("lookGallery.mts <결과 폴더> [--salt N]");
const salt = Number(argv.includes("--salt") ? argv[argv.indexOf("--salt") + 1] : 4242);
fs.mkdirSync(out, { recursive: true });
const TS = "beodeul_city"; const table = tilesetLookTableFor(TS)!;
function village(look: TilesetLook | undefined, hints: Record<string, unknown>): { project: Project; mapId: string } {
  const project = createBlankProject();
  if (look) project.tilesets[TS]!.look = look; // 이미 고른 게임처럼 — 시공기가 그 숲 생김새를 읽는다
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true } as ToolContext;
  const spec = { type: "village", name: "버들 마을", salt, hints } as PlaceSpec;
  const res = builderFor(spec)!.build(createBuildRun(ctx), spec);
  if (!res.ok) throw new Error(res.summary);
  return { project: ctx.project, mapId: res.mapIds[0]! };
}
const shot = (name: string, v: { project: Project; mapId: string }, look: TilesetLook | undefined) => {
  const tileset = v.project.tilesets[TS]!;
  if (look) tileset.look = look; else delete tileset.look;
  fs.writeFileSync(path.join(out, `${name}.png`), renderMapPng(v.project, v.project.maps[v.mapId]!).png);
};
const rows: Record<string, unknown>[] = [];
const base = village(undefined, { forestType: "broadleaf" });
shot("surface-classic", base, undefined); rows.push({ part: "surface", id: "classic", label: "원래 모습 — 풀밭 · 회색 포석 길 · 옅은 판석 광장" });
for (const [id, option] of Object.entries(table.parts.surface.options)) { shot(`surface-${id}`, base, { textureKey: table.texture, surface: id }); rows.push({ part: "surface", id, label: option.label }); }
shot("trees-classic", base, undefined); rows.push({ part: "trees", id: "classic", label: "원래 모습 — 둥근 활엽수" });
for (const [id, option] of Object.entries(table.parts.trees.options)) { shot(`trees-${id}`, base, { textureKey: table.texture, trees: id }); rows.push({ part: "trees", id, label: option.label }); }
for (const id of ["classic", ...Object.keys(table.parts.woods.options)]) {
  const v = village(id === "classic" ? undefined : { textureKey: table.texture, woods: id }, { forestType: "broadleaf" });
  const map = v.project.maps[v.mapId]!;
  fs.writeFileSync(path.join(out, `woods-${id}.png`), renderMapPng(v.project, map).png);
  rows.push({ part: "woods", id, label: id === "classic" ? "원래 모습 — 둥근 숲 덩이 몇" : table.parts.woods.options[id]!.label, size: `${map.width}x${map.height}` });
}
fs.writeFileSync(path.join(out, "gallery.json"), JSON.stringify({ salt, rows }, null, 1));
console.log(rows.map((r) => `${r.part}:${r.id}`).join(" "));
