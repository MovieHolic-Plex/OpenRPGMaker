import type { Project } from "@/project/types";

export type FlagAxisId =
  | "declaration"
  | "naming"
  | "registry"
  | "scopeChoice"
  | "pageGating"
  | "variableUsage"
  | "conditionalReads"
  | "orphanFlags"
  | "integrity";

export interface FlagAxisMeta {
  readonly id: FlagAxisId;
  readonly label: string;
  readonly question: string;
  readonly weight: number;
}

export interface FlagLiteracyMetrics {
  readonly usedSwitchIds: readonly string[];
  readonly usedVariableIds: readonly string[];
  readonly danglingSwitchRefs: readonly string[];
  readonly danglingVariableRefs: readonly string[];
  readonly namedUsedSwitches: number;
  readonly namedUsedVariables: number;
  readonly registeredUsedFlags: number;
  readonly selfSwitchWrites: number;
  readonly selfSwitchReads: number;
  readonly eventLocalLatchCandidates: readonly string[];
  readonly variableArithmeticWrites: number;
  readonly variableComparisonReads: number;
  readonly totalEvents: number;
  readonly multiPageEvents: number;
  readonly flagGatedPages: number;
  readonly totalPages: number;
  readonly forkFlagConditions: number;
  readonly compoundConditions: number;
  readonly writeOnlyFlagIds: readonly string[];
  readonly readOnlyFlagIds: readonly string[];
  readonly orphanFlagIds: readonly string[];
  readonly lintErrors: number;
  readonly flagLintWarnings: number;
}

export interface AuthoredPageShape {
  readonly name: string;
  readonly conditions: readonly string[];
  readonly flagWrites: readonly string[];
  readonly commandKinds: readonly string[];
  readonly spriteId?: string;
  readonly frameIndex?: number;
}

export interface AuthoredEventShape {
  readonly mapId: string;
  readonly eventId: string;
  readonly x: number;
  readonly y: number;
  readonly spriteId?: string;
  readonly frameIndex?: number;
  readonly pages: readonly AuthoredPageShape[];
}

export interface FlagAxisScore extends FlagAxisMeta {
  readonly score: number;
  readonly detail: string;
  readonly evidence: readonly string[];
}

export type FlagGrade = "A" | "B" | "C" | "D" | "F";

export interface FlagLiteracyReportCard {
  readonly total: number;
  readonly grade: FlagGrade;
  readonly axes: readonly FlagAxisScore[];
  readonly metrics: FlagLiteracyMetrics;
}

export type FlagLiteracyScorer = (project: Project) => FlagLiteracyReportCard;
