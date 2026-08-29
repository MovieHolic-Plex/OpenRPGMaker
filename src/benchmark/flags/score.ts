import type { Project } from "@/project/types";
import { analyzeFlagLiteracy } from "./analyze";
import { FLAG_AXES } from "./axes";
import type { FlagAxisId, FlagAxisScore, FlagGrade, FlagLiteracyMetrics, FlagLiteracyReportCard } from "./types";

const NEUTRAL = 0.5;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

interface AxisVerdict {
  readonly score: number;
  readonly detail: string;
  readonly evidence: readonly string[];
}

function declaration(metrics: FlagLiteracyMetrics): AxisVerdict {
  const refs = metrics.usedSwitchIds.length + metrics.usedVariableIds.length;
  const dangling = [...metrics.danglingSwitchRefs, ...metrics.danglingVariableRefs];
  if (refs === 0) return { score: 0, detail: "스위치/변수를 아예 쓰지 않았다", evidence: [] };
  return {
    score: clamp01(1 - dangling.length / refs),
    detail: `참조 ${refs}개 중 미선언 ${dangling.length}개`,
    evidence: dangling.map((id) => `미선언 참조: ${id}`),
  };
}

function naming(metrics: FlagLiteracyMetrics): AxisVerdict {
  const used = metrics.usedSwitchIds.length + metrics.usedVariableIds.length;
  if (used === 0) return { score: 0, detail: "이름 붙일 대상이 없다(플래그 미사용)", evidence: [] };
  const named = metrics.namedUsedSwitches + metrics.namedUsedVariables;
  const unnamedSwitches = metrics.usedSwitchIds.length - metrics.namedUsedSwitches;
  const unnamedVariables = metrics.usedVariableIds.length - metrics.namedUsedVariables;
  return {
    score: clamp01(named / used),
    detail: `사용한 ${used}개 중 이름 있음 ${named}개`,
    evidence: [
      ...(unnamedSwitches > 0 ? [`이름 없는 스위치 ${unnamedSwitches}개 — 편집기 목록에 빈 칸으로 남는다`] : []),
      ...(unnamedVariables > 0 ? [`이름 없는 변수 ${unnamedVariables}개`] : []),
    ],
  };
}

function registry(metrics: FlagLiteracyMetrics): AxisVerdict {
  const used = metrics.usedSwitchIds.length + metrics.usedVariableIds.length;
  if (used === 0) return { score: 0, detail: "등록할 플래그가 없다", evidence: [] };
  return {
    score: clamp01(metrics.registeredUsedFlags / used),
    detail: `사용한 ${used}개 중 storyFlags 등록 ${metrics.registeredUsedFlags}개`,
    evidence: metrics.registeredUsedFlags === 0 ? ["declare_story_flag 를 쓰지 않아 서사 의미가 기록되지 않았다"] : [],
  };
}

function scopeChoice(metrics: FlagLiteracyMetrics): AxisVerdict {
  const candidates = metrics.eventLocalLatchCandidates.length;
  const total = metrics.selfSwitchWrites + candidates;
  if (total === 0) {
    return { score: NEUTRAL, detail: "판정 불가 — 로컬 래치 후보도 self-switch 도 없다", evidence: [] };
  }
  return {
    score: clamp01(metrics.selfSwitchWrites / total),
    detail: `self-switch 쓰기 ${metrics.selfSwitchWrites}건 vs 단일 이벤트에만 갇힌 전역 스위치 ${candidates}건`,
    evidence: metrics.eventLocalLatchCandidates.map((id) => `${id}: 한 이벤트에서만 읽고 쓴다 — self-switch 자리다`),
  };
}

function pageGating(metrics: FlagLiteracyMetrics): AxisVerdict {
  const writesExist = metrics.usedSwitchIds.length + metrics.usedVariableIds.length > 0;
  const gateSlots = metrics.totalPages - metrics.totalEvents;
  if (metrics.totalEvents === 0) return { score: 0, detail: "이벤트가 없다", evidence: [] };
  if (gateSlots <= 0) {
    return {
      score: writesExist ? 0 : NEUTRAL,
      detail: `이벤트 ${metrics.totalEvents}개가 모두 단일 페이지 — 상태 변화가 화면에 반영되지 않는다`,
      evidence: writesExist ? ["플래그를 쓰지만 페이지 조건으로 분기하지 않는다"] : [],
    };
  }
  return {
    score: clamp01(metrics.flagGatedPages / gateSlots),
    detail: `게이팅 필요 페이지 ${gateSlots}개 중 플래그 조건 있는 페이지 ${metrics.flagGatedPages}개 (멀티페이지 이벤트 ${metrics.multiPageEvents}/${metrics.totalEvents})`,
    evidence: [],
  };
}

function variableUsage(metrics: FlagLiteracyMetrics): AxisVerdict {
  if (metrics.usedVariableIds.length === 0) {
    return { score: 0, detail: "변수를 전혀 쓰지 않았다 — 수량/진행도를 스위치로만 표현했다", evidence: [] };
  }
  const arithmetic = metrics.variableArithmeticWrites > 0 ? 0.3 : 0;
  const comparison = metrics.variableComparisonReads > 0 ? 0.3 : 0;
  return {
    score: clamp01(0.4 + arithmetic + comparison),
    detail: `변수 ${metrics.usedVariableIds.length}개, 산술 쓰기 ${metrics.variableArithmeticWrites}건, 비교 읽기 ${metrics.variableComparisonReads}건`,
    evidence: [
      ...(metrics.variableArithmeticWrites === 0 ? ["+= 같은 누적 연산이 없다 — 카운터로 쓰지 않았다"] : []),
      ...(metrics.variableComparisonReads === 0 ? [">= 같은 비교 조건이 없다 — 값을 읽어 분기하지 않는다"] : []),
    ],
  };
}

function conditionalReads(metrics: FlagLiteracyMetrics): AxisVerdict {
  const used = metrics.usedSwitchIds.length + metrics.usedVariableIds.length;
  if (used === 0) return { score: 0, detail: "읽을 플래그가 없다", evidence: [] };
  const writeOnly = metrics.writeOnlyFlagIds.length;
  return {
    score: clamp01(1 - writeOnly / used),
    detail: `사용한 ${used}개 중 쓰기만 하고 읽지 않는 것 ${writeOnly}개`,
    evidence: metrics.writeOnlyFlagIds.map((key) => `${key}: 켜지만 아무도 확인하지 않는다`),
  };
}

function orphanFlags(metrics: FlagLiteracyMetrics): AxisVerdict {
  const used = metrics.usedSwitchIds.length + metrics.usedVariableIds.length;
  if (used === 0) return { score: 0, detail: "판정 대상 플래그가 없다", evidence: [] };
  return {
    score: clamp01(1 - metrics.orphanFlagIds.length / used),
    detail: `고아 플래그 ${metrics.orphanFlagIds.length}/${used} (쓰기전용 ${metrics.writeOnlyFlagIds.length}, 읽기전용 ${metrics.readOnlyFlagIds.length})`,
    evidence: metrics.readOnlyFlagIds.map((key) => `${key}: 읽지만 아무도 켜지 않는다 — 영원히 false`),
  };
}

function integrity(metrics: FlagLiteracyMetrics): AxisVerdict {
  if (metrics.lintErrors > 0) {
    return { score: 0, detail: `projectLint error ${metrics.lintErrors}건`, evidence: [`lint error ${metrics.lintErrors}건이 남아 있다`] };
  }
  const used = Math.max(1, metrics.usedSwitchIds.length + metrics.usedVariableIds.length);
  return {
    score: clamp01(1 - metrics.flagLintWarnings / used),
    detail: `lint error 0, 플래그 경고 ${metrics.flagLintWarnings}건`,
    evidence: [],
  };
}

const VERDICTS: Record<FlagAxisId, (metrics: FlagLiteracyMetrics) => AxisVerdict> = {
  declaration,
  naming,
  registry,
  scopeChoice,
  pageGating,
  variableUsage,
  conditionalReads,
  orphanFlags,
  integrity,
};

export function gradeFor(total: number): FlagGrade {
  if (total >= 85) return "A";
  if (total >= 70) return "B";
  if (total >= 55) return "C";
  if (total >= 35) return "D";
  return "F";
}

export function scoreMetrics(metrics: FlagLiteracyMetrics): Omit<FlagLiteracyReportCard, "metrics"> {
  const axes: FlagAxisScore[] = FLAG_AXES.map((axis) => ({ ...axis, ...VERDICTS[axis.id](metrics) }));
  const weighted = axes.reduce((sum, axis) => sum + axis.score * axis.weight, 0);
  const total = Math.round(weighted * 1000) / 10;
  return { total, grade: gradeFor(total), axes };
}

export function scoreFlagLiteracy(project: Project): FlagLiteracyReportCard {
  const metrics = analyzeFlagLiteracy(project);
  return { ...scoreMetrics(metrics), metrics };
}
