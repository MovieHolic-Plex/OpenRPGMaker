// 첫 판 초안 데이터 리플레이 — 저장된 첫 판 프로젝트(after.json.gz)에 끝맺음 draft-cast 단계를 다시 돌려 전후 수를 센다. 모델을 부르지 않는다.
// 쓰는 법: npx vite-node --script scripts/qa/draft-cast-replay.mts -- <out.json> <name=after.json.gz|blank:<blueprint.json>|count:<after.json.gz>> ...
// count: 는 다시 돌리지 않고 그 저장본의 수만 센다(실제 조수 실행 결과를 재는 데 쓴다).
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { applyDraftCast, draftCastCounts } from "@/ai/v2/story/draftCast";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

const args = process.argv.slice(2).filter((a) => a !== "--");
const [out, ...jobs] = args;
if (!out || !jobs.length) throw new Error("usage: <out.json> <name=path> ...");

const rows = jobs.map((job) => {
  const [name, src] = job.split("=") as [string, string];
  let project: Project;
  let request = "";
  if (src.startsWith("blank:")) {
    const fixture = JSON.parse(readFileSync(src.slice(6), "utf8")) as { request: string; blueprint: unknown };
    project = createBlankProject() as Project;
    project.gameBlueprint = normalizeGameBlueprint(fixture.blueprint);
    request = fixture.request;
  } else {
    project = JSON.parse(gunzipSync(readFileSync(src.replace(/^count:/u, ""))).toString("utf8")) as Project;
    request = project.gameBlueprint?.request ?? "";
  }
  const before = draftCastCounts(project);
  const countOnly = src.startsWith("count:");
  const made = countOnly ? [] : applyDraftCast(project, request);
  const after = draftCastCounts(project);
  const again = countOnly ? [] : applyDraftCast(project, request);
  if (process.env.DRAFT_OUT_DIR) writeFileSync(`${process.env.DRAFT_OUT_DIR}/${name}.project.json`, JSON.stringify(project));
  const party = (project.system.startActorIds ?? []).map((id) => {
    const actor = project.database.actors.find((a) => a.id === id);
    const cls = project.database.classes.find((c) => c.id === actor?.classId);
    return actor ? `${actor.name}(${cls?.name ?? actor.classId})` : id;
  });
  return { name, request: request.slice(0, 80), genre: project.gameBlueprint?.genre, hasCast: !!project.gameBlueprint?.cast, battles: project.gameBlueprint?.battles !== false,
    maps: Object.keys(project.maps).length, before, after, idempotent: again.length === 0, party,
    world: project.worldCanon ? { name: project.worldCanon.name, premise: project.worldCanon.premise } : null,
    profiles: Object.entries(project.characters ?? {}).map(([k, v]) => `${k}: ${v.displayName ?? ""} — ${v.note ?? ""}`),
    made };
});
writeFileSync(out, JSON.stringify(rows, null, 2));
for (const r of rows) console.log(`${r.name}\tmaps ${r.maps}\tworld ${r.before.world}→${r.after.world}\tpeople ${r.before.people}→${r.after.people}\tparty ${r.before.party}→${r.after.party}\tclasses ${r.before.classes}→${r.after.classes}\tskills ${r.before.skills}→${r.after.skills}\titems ${r.before.items}→${r.after.items}\tenemies ${r.before.enemies}→${r.after.enemies}\tidempotent ${r.idempotent}`);
