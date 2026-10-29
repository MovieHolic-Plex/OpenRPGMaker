import { writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { execTool } from "@/project/flagship/isekaiGoddingKit";
const p = createBlankProject();
const log: Record<string, unknown> = {};
const t = (label: string, name: string, args: Record<string, unknown>) => {
  try { const r = execTool(p, name, args); log[label] = { summary: r.summary, data: r.data }; console.log("OK", label, (r.summary ?? "").slice(0, 200)); return r; }
  catch (e) { log[label] = String(e).slice(0, 900); console.log("ERR", label, String(e).slice(0, 500)); return null; }
};
t("city", "author_beodeul_town", { id: "map_ig_capital", name: "왕도 루멘", width: 60, height: 40, seed: 11, theme: "city", roofs: "medieval", church: true, form: "plaza", terrain: "flat" });
for (const side of ["east", "west", "south", "north"]) {
  const r = t(`route-${side}`, "author_forest_route", { fromMapId: "map_ig_capital", side, count: 1, moods: ["normal"], seed: 4 });
  if (r) break;
}
t("village-flat", "author_beodeul_town", { id: "map_ig_goblin", name: "고블린 마을", seed: 5, houseCount: 3, form: "scatter", woods: "dense", roofs: "log", water: "none", terrain: "flat" });
t("dungeon", "author_beodeul_dungeon", { id: "map_ig_castle", name: "마왕성", type: "castle", floors: 2, size: "medium", seed: 3, entrance: { fromMapId: "map_ig_goblin", place: "north" } });
writeFileSync("/tmp/ig-probe2.log.json", JSON.stringify(log, null, 1));
writeFileSync("/tmp/ig-probe2.project.json", serialize(p));
console.log(Object.keys(p.maps).map((id) => `${id} ${p.maps[id]!.width}x${p.maps[id]!.height}`).join("\n"));
