// 조수 v2 콘텐츠 빌더(people / events / drawObject) 증명 스크립트.
// 실행: bun scripts/qa/assistant-v2/content.mts
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/buildRun.ts";
import { buildPeople, PEOPLE_CARD } from "../../../src/ai/v2/people.ts";
import { buildEvent, EVENT_CARD } from "../../../src/ai/v2/events.ts";
import { drawObject, DRAW_OBJECT_CARD } from "../../../src/ai/v2/drawObject.ts";

const OUT = "qa-runs/v2scratch/content";
mkdirSync(OUT, { recursive: true });
console.log("card lengths", PEOPLE_CARD.length, EVENT_CARD.length, DRAW_OBJECT_CARD.length);

const project: any = createBlankProject();
const ctx: any = { project, currentMapId: project.startMapId, assistantRun: true };
const run = createBuildRun(ctx);
const mapId = project.startMapId as string;

const town = run.call("author_beodeul_town", { mapId, houseCount: 4, theme: "river", seed: 11, name: "버들 마을" });
console.log("town:", town.ok, String(town.summary).slice(0, 200));

const people = buildPeople(run, [
  { role: "문지기", name: "문지기", where: "입구", looks: "경비병", firstTalk: ["해가 지면 성문을 닫는다네."], laterTalk: ["조심해서 다녀오게."] },
]);
console.log("people:", people.ok, people.summary, people.warnings, people.eventIds);

const ev = buildEvent(run, {
  kind: "cutscene", when: "game-start",
  beats: [
    { do: "walk", who: "주인공", to: "길" },
    { do: "appear", who: "촌장", where: "광장", looks: "노인" },
    { do: "walk", who: "촌장", to: "주인공" },
    { do: "say", who: "촌장", text: "드디어 왔구나, 기다리고 있었네" },
  ],
});
console.log("event:", ev.ok, ev.summary, ev.warnings, ev.eventIds);

const dr = drawObject(run, { what: "사과 수레", description: "사과가 가득 담긴 작은 나무 손수레", where: "광장" });
const dr1b = drawObject(run, { what: "증기 기관 모형", description: "황동 보일러와 작은 굴뚝이 달린 전시용 증기 기관 모형", where: "광장" });
console.log("draw(new):", dr1b.ok, dr1b.summary);
console.log("draw:", dr.ok, dr.summary, dr.warnings, dr.missingArt);
const dr2 = drawObject(run, { what: "마을 사람", description: "사람" });
console.log("draw(person):", dr2.ok, dr2.summary);

const p = run.ctx.project;
const maps = p.maps as any;
const map = Array.isArray(maps) ? maps.find((m: any) => m.id === mapId) : maps[mapId];
for (const e of Object.values(map.events ?? {}) as any[]) {
  console.log(`event ${e.id} "${e.name}" (${e.x},${e.y})`);
  for (const pg of e.pages ?? []) {
    console.log("  page", pg.name, "trigger", pg.trigger, "cond", JSON.stringify(pg.conditions ?? pg.condition ?? null),
      "cmds", (pg.commands ?? []).map((c: any) => c.kind).join(","));
  }
}
const r = await renderMapPng(p, map, 2);
writeFileSync(`${OUT}/map.png`, r.png);
console.log("png", `${OUT}/map.png`, r.note ?? "");
