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
import { checkHorror } from "./horror";
import { checkMystery } from "./mystery";
import { checkMonster } from "./monster";
import { checkGallery } from "./gallery";
import { checkDream } from "./dream";
import { checkStory } from "./story";
import { projectSetterShadowedPages } from "@/project/eventPageSetterShadow";
import { whereText, type AutoPlayRun, type Finding, type FindingSeverity, type GameCheckOptions, type GameCheckReport } from "./types";

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
    ...checkHorror(project, options.briefText ?? briefTextOf(project)),
    ...checkMystery(project, options.briefText ?? briefTextOf(project)),
    ...checkMonster(project, options.briefText ?? briefTextOf(project)),
    ...checkGallery(project, options.briefText ?? briefTextOf(project)),
    ...checkDream(project, options.briefText ?? briefTextOf(project)),
    ...checkStory(project, options.briefText ?? briefTextOf(project)),
    ...[...projectSetterShadowedPages(project).values()].map((hit): Finding => ({
      severity: "warning", code: "page-setter-shadowed", message: hit.message,
      where: { mapId: hit.mapId, mapName: project.maps[hit.mapId]?.name, eventId: hit.eventId },
    })),
    ...(options.rawProject !== undefined ? diffLoadNormalization(options.rawProject, project) : []),
  ];
  let autoPlay: GameCheckReport["autoPlay"];
  if (!options.skipAutoPlay) {
    const play = (recoverBeforeRandomEncounters: boolean): GameCheckReport["autoPlay"] => {
      try {
        return runAutoPlay(project, { budgetMs: options.autoPlayBudgetMs, companionJoins: companionJoins(project), recoverBeforeRandomEncounters });
      } catch (error) {
        return { targets: [], plan: [], runs: [], skipped: `자동 플레이 중 예외: ${error instanceof Error ? error.message : String(error)}` };
      }
    };
    autoPlay = play(false)!;
    // 자동 플레이는 회복·레벨 관리를 하지 않는다 — 무작위 인카운터를 연달아 맞고 진 것은 「끝까지 못 간다」가 아니라
    // 소모전 신호다(2026-09-24 JRPG 도그푸딩: 포션·여관 없이 광산 세 층을 걷다 쓰러졌다).
    // 인카운터 직전마다 회복하며(여관·포션을 쓰는 플레이어) 다시 돌려 끝까지 가면 그 실행은 막힘 대신 경고로 낸다.
    // 인카운터를 아예 끄면 경험치를 못 얻어 보스에게 지므로 거짓 막힘이 남는다.
    // 동료를 하나도 안 데려간 기본 경로가 인카운터에 진 것도, 동료를 데려간 실행이 끝까지 가면 경고다 — 합류가 전제인 설계다.
    const downgraded = new WeakSet<AutoPlayRun>();
    const downgrade = (run: AutoPlayRun) => { downgraded.add(run); return run; };
    const encounterDefeat = (run: AutoPlayRun) => !run.ok && /random encounter [^:]+: defeat/u.test(run.failure?.detail ?? "");
    if (autoPlay.runs.some(encounterDefeat)) {
      const retry = play(true)!;
      const companionClears = [...autoPlay.runs, ...retry.runs].some((run) => run.ok && run.label === "동료 합류 후");
      const runs = autoPlay.runs.map((run) => {
        if (!encounterDefeat(run)) return run;
        const recovered = retry.runs.find((other) => other.label === run.label);
        const soloOnly = run.label.startsWith("기본 경로") && companionClears;
        if (!recovered?.ok && !soloOnly) return run;
        findings.push({
          severity: "warning", code: "autoplay-encounter-attrition",
          message: recovered?.ok
            ? `자동 플레이(${run.label})가 회복 없이 무작위 인카운터를 연달아 맞다 전멸했습니다 — 전투마다 회복하면 끝까지 갑니다. 포션·여관·회복 기술 없이 버틸 수 있는지, 인카운터율·잡몹 세기를 확인하세요: ${attritionTail(run.failure!.detail)}`
            : `자동 플레이(${run.label})는 동료 없이 무작위 인카운터에 전멸했습니다 — 동료를 데려간 실행은 끝까지 갑니다. 합류가 필수인지 플레이어가 알 수 있게 하세요: ${attritionTail(run.failure!.detail)}`,
          ...(run.failure?.where ? { where: run.failure.where } : {}),
        });
        return recovered?.ok ? { ...recovered, label: `${run.label}(전투마다 회복)` } : downgrade({ ...run, label: `${run.label}(동료 없이 — 경고로 낮춤)` });
      });
      autoPlay = { ...autoPlay, runs };
    }
    for (const run of autoPlay.runs) {
      if (run.ok || !run.failure || downgraded.has(run)) continue;
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

/** 「… — 전투 N회, 마지막: …」 꼬리만 — 앞의 걷기 문구는 자동 플레이 절에 이미 나온다. */
function attritionTail(detail: string): string {
  const at = detail.indexOf("— 전투");
  return (at >= 0 ? detail.slice(at + 2) : detail).slice(0, 240);
}
