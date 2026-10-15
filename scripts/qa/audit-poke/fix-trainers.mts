import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
const t0 = Date.now();
const res: any = createMonsterExpedition({});
const project: any = res.project;
let sight = 0, action = 0; const byMap: Record<string, number> = {};
for (const m of Object.values(project.maps) as any[]) for (const e of m.events) {
  const p = e.pages?.[0];
  if (p?.detectionEncounter) { sight++; byMap[m.id] = (byMap[m.id] ?? 0) + 1; }
  else if (p?.commands?.some((c: any) => c.kind === "fork" ? JSON.stringify(c).includes("battleProcessing") : c.kind === "battleProcessing")) action++;
}
console.log("ms", Date.now() - t0, "sight trainers", sight, "talk-only battles", action);
console.log(JSON.stringify(byMap));
const gyms = Object.values(project.maps).filter((m: any) => /_gym$/.test(m.id)).map((m: any) => [m.id, m.events.filter((e: any) => /_grunt_/.test(e.id)).length]);
console.log("gym grunts", JSON.stringify(gyms));
const ex: any = (Object.values(project.maps) as any[]).flatMap(m => m.events).find(e => /meadow_trainer_0/.test(e.id));
console.log(JSON.stringify(ex.pages.map((p: any) => ({ id: p.id, cond: p.conditions, det: p.detectionEncounter, dir: p.graphic.direction, n: p.commands.length }))));
