// 모델 없는 게임 검사기 입구. `scripts/qa-game/check.mts` 와 테스트가 부른다.
//
// 오프라인 QA 도구다 — 조수 실행 경로에 끼우는 게이트가 아니다(memory: 조수 게이트는 더 붙이지 않는다).

import type { Project } from "@/project/types";
import { runAutoPlay } from "./autoPlay";
import { briefTextOf, checkBriefConformance } from "./brief";
import { checkCommands } from "./commands";
import { diffLoadNormalization } from "./loadDiff";
import { buildMapGraph, checkMapGraph, summarizeMaps } from "./mapGraph";
import { checkProgression, companionJoins } from "./progression";
import { checkJrpg } from "./jrpg";
import { whereText, type Finding, type FindingSeverity, type GameCheckOptions, type GameCheckReport } from "./types";

export * from "./types";

const SEVERITY_ORDER: Record<FindingSeverity, number> = { blocker: 0, warning: 1, info: 2 };

function dedupe(findings: readonly Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.code}|${finding.message}|${whereText(finding.where)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function runGameCheck(project: Project, options: GameCheckOptions = {}): GameCheckReport {
  const started = Date.now();
  const graph = buildMapGraph(project);
  const findings: Finding[] = [
    ...checkMapGraph(project, graph),
    ...checkCommands(project),
    ...checkProgression(project),
    ...checkBriefConformance(project, options.briefText ?? briefTextOf(project), graph),
    ...checkJrpg(project),
    ...(options.rawProject !== undefined ? diffLoadNormalization(options.rawProject, project) : []),
  ];
  let autoPlay: GameCheckReport["autoPlay"];
  if (!options.skipAutoPlay) {
    try {
      autoPlay = runAutoPlay(project, { budgetMs: options.autoPlayBudgetMs, companionJoins: companionJoins(project) });
    } catch (error) {
      autoPlay = { targets: [], plan: [], runs: [], skipped: `자동 플레이 중 예외: ${error instanceof Error ? error.message : String(error)}` };
    }
    for (const run of autoPlay.runs) {
      if (run.ok || !run.failure) continue;
      const later = run.steps.filter((step) => !step.ok && step !== run.failure && step.goal !== "계획").at(-1);
      findings.push({
        severity: "blocker", code: "autoplay-failed",
        message: `자동 플레이(${run.label})가 「${run.failure.goal}」에서 실패했습니다: ${run.failure.detail}${later ? ` — 이어서 「${later.goal}」: ${later.detail}` : ""}`,
        ...(run.failure.where ? { where: run.failure.where } : {}),
      });
    }
  }
  const sorted = dedupe(findings).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const counts = { blocker: 0, warning: 0, info: 0 } as Record<FindingSeverity, number>;
  for (const finding of sorted) counts[finding.severity] += 1;
  return {
    version: 1,
    title: project.meta?.title ?? "",
    startMapId: project.startMapId,
    generatedAt: new Date().toISOString(),
    ms: Date.now() - started,
    counts,
    findings: sorted,
    maps: summarizeMaps(project, graph),
    ...(autoPlay ? { autoPlay } : {}),
  };
}

const LABEL: Record<FindingSeverity, string> = { blocker: "막힘", warning: "경고", info: "참고" };

/** 사람이 읽는 한국어 요약(터미널·README 예시용). */
export function formatGameCheckSummary(report: GameCheckReport, options: { readonly maxPerSeverity?: number } = {}): string {
  const max = options.maxPerSeverity ?? 40;
  const lines: string[] = [];
  lines.push(`# 게임 검사 — ${report.title || "(제목 없음)"}`);
  lines.push(`막힘 ${report.counts.blocker} · 경고 ${report.counts.warning} · 참고 ${report.counts.info} · 맵 ${report.maps.length}개 · ${report.ms}ms`);
  lines.push(report.counts.blocker > 0 ? "판정: 끝까지 플레이할 수 없는 결함이 있습니다." : "판정: 막힘 없음.");
  for (const severity of ["blocker", "warning", "info"] as const) {
    const list = report.findings.filter((finding) => finding.severity === severity);
    if (list.length === 0) continue;
    lines.push("", `## ${LABEL[severity]} ${list.length}건`);
    for (const finding of list.slice(0, max)) {
      const where = whereText(finding.where);
      lines.push(`- [${finding.code}] ${finding.message}${where ? `\n    ↳ ${where}` : ""}`);
    }
    if (list.length > max) lines.push(`- … ${list.length - max}건 더 (check.json 참고)`);
  }
  const auto = report.autoPlay;
  if (auto) {
    lines.push("", "## 자동 플레이");
    if (auto.skipped) lines.push(`- 건너뜀: ${auto.skipped}`);
    if (auto.plan.length) lines.push(`- 경로: ${auto.plan.join(" → ")}`);
    for (const run of auto.runs) {
      lines.push(`- ${run.label}: ${run.ok ? `성공${run.endingReached ? ` (엔딩 ${run.endingReached})` : ""}` : "실패"} · 목표 ${run.steps.length}개 · 러너 ${run.runs}회 · ${run.ms}ms`);
      for (const step of run.steps.filter((entry) => !entry.ok)) {
        lines.push(`    ↳ 「${step.goal}」: ${step.detail}${step.where ? ` [${whereText(step.where)}]` : ""}`);
      }
    }
  }
  const unreachable = report.maps.filter((map) => !map.reachable);
  if (unreachable.length) lines.push("", `못 가는 맵: ${unreachable.map((map) => `${map.name}(${map.id})`).join(", ")}`);
  return lines.join("\n");
}
