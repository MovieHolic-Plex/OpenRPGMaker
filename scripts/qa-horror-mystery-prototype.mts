import fs from "node:fs";
import path from "node:path";
import {
  HORROR_MYSTERY_PROJECT_ID,
  createHorrorMysteryPrototypeProject,
} from "../src/project/examples/horrorMysteryPrototype.ts";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import {
  evaluateHorrorExperienceQa,
  type HorrorExperienceQaReport,
} from "../src/testing/horrorExperienceQa.ts";
import { createHorrorMysteryQaScenarios } from "../src/testing/horrorMysteryQaPlan.ts";
import { loadSupabaseEnvironment } from "./lib/supabase-database-ops.mjs";
import { readHorrorBrowserEvidence, browserEvidenceOutputPath } from "./lib/horror-browser-evidence.mjs";
import { canonicalProjectDigest } from "./lib/canonical-project-digest.mjs";
import { runCapture } from "./capture-horror-browser-evidence.mts";

const EVIDENCE_DIR = path.join("output", "evidence", "horror-mystery-prototype");
const BROWSER_EVIDENCE_PATH = browserEvidenceOutputPath();
const JSON_REPORT_PATH = path.join(EVIDENCE_DIR, "automated-qa.json");
const MARKDOWN_REPORT_PATH = path.join(EVIDENCE_DIR, "automated-qa.md");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function renderMarkdown(
  report: HorrorExperienceQaReport,
  input: { readonly projectId: string; readonly title: string; readonly verifiedAt: string },
): string {
  const blockerRows = report.blockers.length > 0
    ? report.blockers.map((blocker) => `- \`${blocker.id}\`: ${blocker.message}`).join("\n")
    : "- 없음";
  return `# 공포 추리 프로토타입 자동 QA

- 프로젝트: **${input.title}** (\`${input.projectId}\`)
- 정본: Supabase에서 새로 로드한 프로젝트 행
- 실행 시각: ${input.verifiedAt}
- 판정: **${report.verdict}**
- 총점: **${report.totalScore}/${report.maxScore}**

## 축별 점수

| 축 | 점수 | 자동 관찰 근거 |
|---|---:|---|
${report.axes.map((axis) => `| ${axis.label} | ${axis.score}/${axis.maxScore} | ${axis.evidence.join(" · ")} |`).join("\n")}

## 실제 런타임 시나리오

| 역할 | 시나리오 | 결과 | 실행 단계 | 최종 상태 |
|---|---|---:|---:|---|
${report.scenarios.map((scenario) => `| ${scenario.role} | ${scenario.label} | ${scenario.ok ? "PASS" : "FAIL"} | ${scenario.stepsRun}/${scenario.totalSteps} | map=${scenario.finalState.mapId}, gameOver=${scenario.finalState.gameOver}, endings=${scenario.finalState.endingsReached.join(",") || "-"} |`).join("\n")}

## 차단 사유

${blockerRows}

## 해석 범위

이 점수는 사람의 감정을 가장하지 않는다. 실제 엔진에서 진행 불가, 오답 복구, 함정/추격 사망과 체크포인트 재시도, 분기 엔딩을 실행하고, 조사 밀도·사망 전 효과음·안전구역·타이틀/BGM·데스크톱 조작 UI를 재미의 관찰 가능한 대리 지표로 평가한다. 강한 통과는 "프로토타입으로 검증할 가치가 높다"는 뜻이며, 장시간 플레이에서의 공포감과 서사 취향까지 증명하는 것은 아니다.

## 재실행

브라우저 관찰을 \`${BROWSER_EVIDENCE_PATH.replaceAll("\\", "/")}\`에 갱신한 뒤 \`npm run qa:horror\`를 실행한다.
`;
}

const env = loadSupabaseEnvironment();
const config = {
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: HORROR_MYSTERY_PROJECT_ID,
};
assert(config.url && config.anonKey, "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 필요합니다.");

const project = await loadProjectFromSupabase(config);
assert(project, `Supabase 프로젝트를 로드하지 못했습니다: ${HORROR_MYSTERY_PROJECT_ID}`);
const { manifest } = createHorrorMysteryPrototypeProject();

// Slice A: generate FRESH browser evidence automatically before evaluation. This closes
// the stale/manual-JSON gap — evidence is re-captured from a real headless browser
// against the real Supabase-backed project on every run. The expected content digest comes from
// the Supabase-reloaded project and is bound to the in-browser observed digest.
await runCapture({ expectedDigest: canonicalProjectDigest(project) });

const browserEvidence = readHorrorBrowserEvidence(BROWSER_EVIDENCE_PATH, {
  targetProjectId: HORROR_MYSTERY_PROJECT_ID,
});
const scenarios = createHorrorMysteryQaScenarios(project, manifest);
const qa = evaluateHorrorExperienceQa(project, scenarios, browserEvidence);
const verifiedAt = new Date().toISOString();
const report = {
  ...qa,
  kind: "horror-mystery-automated-qa",
  verifiedAt,
  source: {
    kind: "supabase-reload",
    projectId: HORROR_MYSTERY_PROJECT_ID,
  },
  title: project.meta.title,
};

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
fs.writeFileSync(JSON_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(MARKDOWN_REPORT_PATH, renderMarkdown(qa, {
  projectId: HORROR_MYSTERY_PROJECT_ID,
  title: project.meta.title,
  verifiedAt,
}), "utf8");

console.log(JSON.stringify({
  ok: qa.verdict !== "fail",
  verdict: qa.verdict,
  score: `${qa.totalScore}/${qa.maxScore}`,
  projectId: HORROR_MYSTERY_PROJECT_ID,
  supabaseReloaded: true,
  scenarios: qa.scenarios.map((scenario) => ({ id: scenario.id, ok: scenario.ok })),
  blockers: qa.blockers,
  reports: [JSON_REPORT_PATH, MARKDOWN_REPORT_PATH],
}, null, 2));

if (qa.verdict === "fail") process.exitCode = 1;
