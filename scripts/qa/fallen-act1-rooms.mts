// 폴른 스타 1막 지하 미궁 평면 미리보기 — 빈 프로젝트에 두 층을 짓고 PNG·통행 표를 낸다(전체 굽기 없이 4초).
//   bun scripts/qa/fallen-act1-rooms.mts <outDir> [scale]
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import type { Project } from "@/project/types";
import { build, kitTile, type RoomSpec } from "@/project/flagship/fallenStarRooms";
import { B3_ROOM, B4_ROOM } from "@/project/flagship/fallen/vaultLabyrinthRooms";
import { renderMapPng } from "../qa-game/render.mts";

const [out, scale] = process.argv.slice(2);
const exec = (project: Project, name: string, args: Record<string, unknown>): void => {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  Object.assign(project, ctx.project);
};
const project = createBlankProject();
fs.mkdirSync(out!, { recursive: true });
for (const [id, spec] of [["b3", B3_ROOM], ["b4", B4_ROOM]] as Array<[string, RoomSpec]>) {
  exec(project, "create_map", { id, name: id, width: 20, height: 15, tilesetId: "atlas_biome_interior" });
  build(project, exec, id, spec);
  const map = project.maps[id]!;
  fs.writeFileSync(path.join(out!, `${id}.png`), renderMapPng(project, map, Number(scale ?? 1)).png);
  const rows: string[] = [];
  for (let y = 0; y < map.height; y += 1) {
    let r = "";
    for (let x = 0; x < map.width; x += 1) r += isPassable(project, map, x, y) ? "." : "#";
    rows.push(`${String(y).padStart(2)} ${r}`);
  }
  fs.writeFileSync(path.join(out!, `${id}.pass.txt`), rows.join("\n"));
  console.log(id, map.width, map.height);
}
for (const name of ["iron gate", "iron gate open", "wall lever", "wall lever on", "star seal", "star seal open"]) {
  try { console.log(name, kitTile(project, name, 0, 0), name.includes("lever") ? kitTile(project, name, 0, 1) : ""); } catch (e) { console.log(name, String(e).slice(0, 80)); }
}
