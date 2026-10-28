// 다일 반복(날마다 다른 페이지·출입문이 날을 넘김) 자동 플레이 재생 — 모델 없음.
// 저장된 조수 게임 project.json 들을 지금 코드의 qa:game check 자동 플레이에 통과시키고, 엔딩마다 결과와 단계 흔적을 적는다.
//   bun scripts/qa/assistant-v2/dayCycleReplay.mts <project.json>... [--out <log.txt>] [--negatives]
// --negatives: 각 프로젝트에서 ① 날을 올리는 setVariable += 를 지운 사본 ② 호감 +를 모두 지운 사본 ③ 「오늘 대화 끝」 스위치를 끄는 명령을 지운 사본도
// 돌린다 — 다일 반복을 모델링한 뒤에도 정말 못 가는 게임은 여전히 막혀야 한다.
// --as-variable: 호감(changeFriendship·friendshipAtLeast)을 변수 하나(일과 점수 += 1, ≥ 문턱/10)로 바꾼 사본도 돌린다 — 일상물의
// 「날마다 다른 일과가 점수를 쌓고 출입문이 날을 넘긴다」 같은 변수형 다일 반복이 같은 틀로 풀리는지 본다.
import fs from "node:fs";
import path from "node:path";
import { runGameCheck } from "../../../src/qa/gameCheck/index.ts";
import type { Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const negatives = argv.includes("--negatives");
const asVariable = argv.includes("--as-variable");
const outAt = argv.indexOf("--out");
const out = outAt >= 0 ? argv[outAt + 1]! : undefined;
const files = argv.filter((a, i) => a !== "--negatives" && a !== "--as-variable" && (outAt < 0 || (i !== outAt && i !== outAt + 1)));
type Cmd = { kind?: string; op?: string; value?: unknown; delta?: unknown; [key: string]: unknown };
/** 명령 트리에서 drop 이 참인 명령을 지운 사본. */
const strip = (project: Project, drop: (c: Cmd) => boolean): Project => {
  const clone = structuredClone(project) as Project;
  const walk = (list: Cmd[]): Cmd[] => list.filter((c) => !drop(c)).map((c) => {
    for (const [key, value] of Object.entries(c)) {
      if (Array.isArray(value) && value.every((v) => v && typeof v === "object")) {
        c[key] = key === "options" ? (value as Cmd[]).map((o) => ({ ...o, branch: Array.isArray(o.branch) ? walk(o.branch as Cmd[]) : o.branch })) : walk(value as Cmd[]);
      }
    }
    return c;
  });
  for (const map of Object.values(clone.maps)) for (const event of map.events ?? []) for (const page of event.pages ?? []) (page as { commands: Cmd[] }).commands = walk(page.commands as unknown as Cmd[]);
  return clone;
};
const lines: string[] = [];
const say = (line: string) => { lines.push(line); console.log(line); };
const cases: { name: string; project: Project }[] = [];
for (const file of files) {
  const project = JSON.parse(fs.readFileSync(file, "utf8")) as Project;
  cases.push({ name: path.basename(file), project });
  if (asVariable) {
    const clone = structuredClone(project) as Project;
    const id = "var_day_routine_score";
    (clone.variables as { id: string; name: string }[]).push({ id, name: "일과 점수(대용)" });
    const conv = (list: Cmd[]): Cmd[] => list.map((c) => {
      if (c.kind === "changeFriendship" && typeof c.delta === "number") return { kind: "setVariable", variableId: id, op: "+=", value: c.delta > 0 ? 1 : 0 };
      for (const [key, value] of Object.entries(c)) {
        if (Array.isArray(value) && value.every((v) => v && typeof v === "object")) {
          c[key] = key === "options" ? (value as Cmd[]).map((o) => ({ ...o, branch: Array.isArray(o.branch) ? conv(o.branch as Cmd[]) : o.branch })) : conv(value as Cmd[]);
        }
      }
      return c;
    });
    const condConv = (c: Cmd): Cmd => c.kind === "friendshipAtLeast" && typeof c.value === "number" ? { kind: "variable", variableId: id, op: ">=", value: Math.ceil(c.value / 10) } : c;
    for (const map of Object.values(clone.maps)) for (const event of map.events ?? []) for (const page of event.pages ?? []) {
      (page as { commands: Cmd[] }).commands = conv(page.commands as unknown as Cmd[]);
      (page as { conditions: Cmd[] }).conditions = (page.conditions as unknown as Cmd[]).map(condConv);
    }
    // 엔딩 조건은 호감 종류만 받는다 — 변수형 사본에서는 문턱을 페이지 조건에만 둔다.
    for (const ending of clone.endings ?? []) (ending as { conditions: unknown[] }).conditions = [];
    cases.push({ name: `${path.basename(file)} [변수형 일과 사본]`, project: clone });
  }
  if (!negatives) continue;
  cases.push({ name: `${path.basename(file)} [반례① 날 올리기 += 지움]`, project: strip(project, (c) => c.kind === "setVariable" && c.op === "+=") });
  cases.push({ name: `${path.basename(file)} [반례② 호감 + 지움]`, project: strip(project, (c) => c.kind === "changeFriendship" && typeof c.delta === "number" && c.delta > 0) });
  cases.push({ name: `${path.basename(file)} [반례③ 스위치 끄기 지움]`, project: strip(project, (c) => c.kind === "setSwitch" && c.value === false) });
}
for (const { name, project } of cases) {
  const started = Date.now();
  const report = runGameCheck(project, { autoPlayBudgetMs: 60_000 });
  const blockers = report.findings.filter((f) => f.severity === "blocker");
  say(`### ${name} — 막힘 ${blockers.length} (${Date.now() - started}ms)`);
  for (const b of blockers) say(`  [${b.code}] ${b.message.slice(0, 260)}`);
  for (const run of report.autoPlay?.runs ?? []) {
    say(`  run ${run.label ?? ""}: ${run.ok ? "성공" : "실패"} 엔딩=${run.endingReached ?? "-"}`);
    for (const step of run.steps ?? []) say(`    ${step.ok ? "✓" : "✗"} ${step.goal} — ${String(step.detail).slice(0, 200)} @${step.mapId}(${step.x},${step.y})`);
  }
}
if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, lines.join("\n") + "\n"); }
