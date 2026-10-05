import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

const context = { project: createBlankProject() } as ToolContext;
const mapId = context.project.startMapId;
const names = ["농부", "촌장 보좌", "여관 주인", "나그네", "대장장이", "마을 청년", "아이", "잡화점 주인", "북문 문지기"];
for (const [i, name] of names.entries()) {
  const id = "npc_repro_" + i;
  const r = runTool(context, "place_npc", { mapId, x: 3 + i * 2, y: 3, id, name, pages: [{ text: "…" }] });
  const ev = context.project.maps[mapId]?.events.find((e) => e.id === id);
  const mv = ev?.pages?.[0]?.movement;
  console.log(JSON.stringify({ name, ok: r.ok, x: ev?.x, y: ev?.y, movement: mv?.type, speed: mv?.speed, freq: mv?.frequency, warnings: (r.diff?.warnings ?? []).length }));
}
