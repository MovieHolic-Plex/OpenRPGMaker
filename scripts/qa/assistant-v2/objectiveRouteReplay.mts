// 목표 길 안내 재생(모델 없음): 저장된 조수 게임의 「현재 목표」 꼬리를 지금 코드의 끝맺음 단계(refreshObjectiveRoutes)로 다시 쓰고,
// 전/후의 목표 글 · 맵마다 런타임 목표 표시가 짚는 대상 · 시작 자리에서 첫 대상까지 걸어갈 수 있나 · 자동 플레이를 나란히 적는다.
// --write <폴더> 를 주면 고친 사본(project.sqlite + assets)을 <폴더>/<이름>/project 에 만든다 — qa:runtime --whole-game 으로 띄운다.
//   bun scripts/qa/assistant-v2/objectiveRouteReplay.mts <run-dir>... [--write /tmp/jrpg-fix/after]
// 2026-10-29 vm2 jrpg flash·terra 「길 못 찾음」(목표 「서쪽」 이 이미 맵 끝 · 숲에서 동굴 입구를 찾음)을 재는 자.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { openNodeSqliteDriver } from "../../../electron/local-store/driver";
import { refreshObjectiveRoutes, startObjectiveReachGap, isObjectiveCommand } from "../../../src/ai/v2/discoverability.ts";
import { objectiveTargetViews } from "../../../src/player/objectiveTarget.ts";
import { runGameCheck } from "../../../src/qa/gameCheck/index.ts";
import type { RuntimeEventView } from "../../../src/project/runtimeEventState.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const wAt = argv.indexOf("--write");
const writeTo = wAt >= 0 ? argv[wAt + 1] : undefined;
const dirs = argv.filter((a, i) => a !== "--write" && i !== wAt + 1);

const views = (map: GameMap): RuntimeEventView[] => (map.events ?? []).map((event) => {
  const page = event.pages?.[0];
  return { event, page, pageId: page?.id, x: event.x, y: event.y, trigger: page?.trigger ?? { kind: "action" } } as unknown as RuntimeEventView;
});
function objectives(project: Project): { map: string; event: string; message: string }[] {
  const out: { map: string; event: string; message: string }[] = [];
  const walk = (value: unknown, map: GameMap, event: string): void => {
    if (Array.isArray(value)) { for (const v of value) walk(v, map, event); return; }
    if (!value || typeof value !== "object") return;
    const rec = value as Record<string, unknown>;
    if (rec.kind && isObjectiveCommand(rec as never)) out.push({ map: map.name ?? map.id, event: event, message: String((rec.fields as Record<string, unknown>).message) });
    for (const v of Object.values(rec)) if (v && typeof v === "object") walk(v, map, event);
  };
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) walk(ev.pages ?? [], map, String(ev.name ?? ev.id));
  return out;
}
const marks = (project: Project, message: string): string =>
  Object.values(project.maps).map((map) => {
    const t = objectiveTargetViews(project, map, views(map), message);
    return t.length ? `${map.name}: ${t.map((v) => `${v.event.name ?? v.event.id}(${v.x},${v.y})`).join(", ")}` : "";
  }).filter(Boolean).join(" | ") || "표시 없음";
const brief = (project: Project) => {
  const r = runGameCheck(project, { autoPlayBudgetMs: 30_000 });
  const run = r.autoPlay?.runs?.[0];
  return {
    objectives: objectives(project).map((o) => ({ ...o, marks: marks(project, o.message) })),
    startGap: startObjectiveReachGap(project) ?? "없음",
    auto: run ? `${run.ok ? "성공" : "실패"} 엔딩=${run.endingReached ?? "-"}${run.failure ? ` · ${run.failure.goal}: ${run.failure.detail.slice(0, 160)}` : ""}` : (r.autoPlay?.skipped ?? "자동 플레이 없음"),
  };
};

for (const dir of dirs) {
  const name = `${path.basename(path.dirname(path.resolve(dir)))}-${path.basename(path.resolve(dir))}`;
  const project = readProjectSqlite(path.join(dir, "project"));
  const before = brief(project);
  const after = structuredClone(project);
  const changed = refreshObjectiveRoutes(after);
  const afterBrief = brief(after);
  console.log(`\n### ${name} (시작 ${project.maps[project.startMapId]?.name} ${JSON.stringify(project.startPos)}) — 고친 목표 ${changed}`);
  before.objectives.forEach((b, i) => {
    const a = afterBrief.objectives[i]!;
    console.log(`  [${b.map} · ${b.event}]\n    전: ${b.message}\n        표시 ${b.marks}\n    후: ${a.message}\n        표시 ${a.marks}`);
  });
  console.log(`  시작→첫 대상: 전 ${before.startGap} / 후 ${afterBrief.startGap}\n  자동 플레이: 전 ${before.auto} / 후 ${afterBrief.auto}`);
  if (writeTo) {
    // 사본: 저장 문서에서 바뀐 목표 글만 같은 JSON 문자열로 바꿔 쓴다(접힌 타일셋 본문·나머지는 그대로).
    const target = path.join(writeTo, name, "project");
    fs.rmSync(path.join(writeTo, name), { recursive: true, force: true });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(dir, "project"), target, { recursive: true });
    const db = openNodeSqliteDriver(path.join(target, "project.sqlite"));
    try {
      let raw = String(db.prepare("SELECT current_json FROM project WHERE id = 1").get([])!.current_json);
      before.objectives.forEach((b, i) => {
        const a = afterBrief.objectives[i]!;
        if (a.message !== b.message) raw = raw.split(JSON.stringify(b.message)).join(JSON.stringify(a.message));
      });
      const sha = createHash("sha256").update(raw).digest("hex");
      db.prepare("UPDATE project SET current_json = ?, current_sha256 = ? WHERE id = 1").run([raw, sha]);
    } finally { db.close(); }
    const reread = objectives(readProjectSqlite(target)).map((o) => o.message);
    const ok = afterBrief.objectives.every((o, i) => reread[i] === o.message);
    console.log(`  사본 ${target} — 다시 읽기 ${ok ? "일치" : "불일치"}`);
  }
}
