// 실내 빈 바닥 측정 보정 — 조수 판(space-craft 실행 폴더 after.json)과 폴른 스타 r28 세 방(FALLEN_ROOM_SPECS)을 같은 자로 잰다.
// bun scripts/qa/interior-bare-floor-calibrate.mts [<space-craft 실행 폴더> ...]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { FALLEN_ROOM_SPECS } from "@/project/flagship/fallenStarRooms";
import { measureLayoutQuality } from "@/ai/piAgent/layoutQuality";
import { measureInteriorBareFloor } from "@/editor/handInterior/bareFloor";
import type { Project } from "@/project/types";

const exec = (project: Project, name: string, args: Record<string, unknown>) => {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`${name}: ${res.summary}`);
  Object.assign(project, ctx.project);
};
const KIT = (n: string) => `kit:atlas_biome_interior/hand-interior:${n}`;

const rows: { label: string; project: Project; mapId: string }[] = [];
const reference = createBlankProject();
{
  const project = reference;
  for (const [key, spec] of Object.entries(FALLEN_ROOM_SPECS)) {
    exec(project, "build_hand_interior_room", { ...spec, plan: [...spec.plan], mapId: `fs_${key}`, name: key, tileset: "atlas_biome_interior" });
  }
  exec(project, "stamp_object", { objectId: KIT("dome slit tall"), mapId: "fs_observatory", x: 15, y: 3 });
  exec(project, "stamp_object", { objectId: KIT("dome vault"), mapId: "fs_observatory", x: 1, y: 0 });
  exec(project, "stamp_object", { objectId: KIT("magic circle"), mapId: "fs_gate", x: 15, y: 10 });
  exec(project, "stamp_object", { objectId: KIT("magic circle"), mapId: "fs_vault", x: 26, y: 7 });
  for (const key of Object.keys(FALLEN_ROOM_SPECS)) rows.push({ label: `fallen-r28/${key}`, project, mapId: `fs_${key}` });
}
for (const dir of process.argv.slice(2)) {
  for (const attempt of readdirSync(dir)) {
    const file = join(dir, attempt, "after.json");
    if (!existsSync(file)) continue;
    const project = JSON.parse(readFileSync(file, "utf8")) as Project;
    // after.json 은 무거운 타일셋 정의를 뺀 사본이다 — 같은 번들 정의(통행)를 붙여 잰다.
    project.tilesets = { ...project.tilesets, atlas_biome_interior: reference.tilesets.atlas_biome_interior! };
    for (const map of Object.values(project.maps)) {
      if (map.tilesetId !== "atlas_biome_interior") continue;
      rows.push({ label: `${dir.split("/").pop()}/${attempt}/${map.id}`, project, mapId: map.id });
    }
  }
}
for (const row of rows) {
  const map = row.project.maps[row.mapId]!;
  const old = measureLayoutQuality(row.project, map);
  const now = measureInteriorBareFloor(row.project, map);
  const top = now?.regions.map((r) => `(${r.x},${r.y}) ${r.w}×${r.h}:${r.cells}`).join(" ") ?? "";
  console.log(`${row.label.padEnd(66)} ${map.width}x${map.height} 옛 자 ${String(old?.empty).padStart(3)}% | 새 자 ${String(now?.pct).padStart(3)}%  ${top}`);
}
