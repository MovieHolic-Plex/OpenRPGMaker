import type { ConstructionAuditRecord } from "./constructionAudit";

export const CONSTRUCTION_ACTIVITY_STATUSES = [
  "applied",
  "pending",
  "blocked",
  "failed",
  "no-change",
] as const;

export type ConstructionActivityStatus = (typeof CONSTRUCTION_ACTIVITY_STATUSES)[number];
export type ConstructionActivityDisposition = "applied" | "pending" | "no-change";

export type ActivityAuditEntryLike = {
  readonly kind: string;
  readonly name?: string;
  readonly args?: Readonly<Record<string, unknown>>;
  readonly ok?: boolean;
  readonly summary?: string;
  readonly construction?: ConstructionAuditRecord;
};

export type ConstructionActivityToolCall = {
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly ok: boolean;
  readonly summary: string;
  readonly construction?: ConstructionAuditRecord;
};

export function activityToolCallsFromAudit(
  entries: readonly ActivityAuditEntryLike[],
  disposition: ConstructionActivityDisposition,
): readonly ConstructionActivityToolCall[] {
  return entries.flatMap((entry) => {
    if (
      entry.kind !== "tool"
      || typeof entry.name !== "string"
      || entry.args === undefined
      || typeof entry.ok !== "boolean"
      || typeof entry.summary !== "string"
    ) {
      return [];
    }
    const construction = entry.construction === undefined
      ? undefined
      : constructionAuditForDisposition(entry.construction, disposition);
    return [{
      name: entry.name,
      args: { ...entry.args },
      ok: entry.ok,
      summary: construction === undefined ? entry.summary : summarizeConstructionActivity(construction),
      ...(construction === undefined ? {} : { construction }),
    }];
  });
}

export function constructionActivityStatusFromAudit(
  entries: readonly ActivityAuditEntryLike[],
  disposition: ConstructionActivityDisposition,
): ConstructionActivityStatus | null {
  const statuses = activityToolCallsFromAudit(entries, disposition)
    .flatMap((call) => call.construction === undefined ? [] : [statusOf(call.construction)]);
  return statuses.reduce<ConstructionActivityStatus | null>((selected, status) => {
    if (selected === null || STATUS_PRIORITY[status] > STATUS_PRIORITY[selected]) return status;
    return selected;
  }, null);
}

export function constructionAuditForDisposition(
  record: ConstructionAuditRecord,
  disposition: ConstructionActivityDisposition,
): ConstructionAuditRecord {
  if (record.outcome !== "exact" && record.outcome !== "partial") return record;
  switch (disposition) {
    case "applied":
      return record;
    case "pending":
      return { ...record, applied: false, outcome: "pending" };
    case "no-change":
      return { ...record, applied: false, outcome: "no-change" };
    default:
      return assertNever(disposition);
  }
}

export function summarizeConstructionActivity(record: ConstructionAuditRecord): string {
  const status = statusOf(record);
  const count = `${record.counts.actual}/${record.counts.requested}`;
  return `${status} · ${record.canonicalRoute} · ${record.target.mapId} · ${count}`
    + ` · 활동 로그: ${activityPersistenceText(record.activityPersistence)}`
    + ` · 프로젝트: ${projectPersistenceText(record.projectPersistence)}`;
}

function statusOf(record: ConstructionAuditRecord): ConstructionActivityStatus {
  switch (record.outcome) {
    case "exact":
    case "partial":
      return "applied";
    case "pending":
      return "pending";
    case "blocked":
      return "blocked";
    case "failed":
      return "failed";
    case "no-change":
      return "no-change";
    default:
      return assertNever(record.outcome);
  }
}

function activityPersistenceText(value: ConstructionAuditRecord["activityPersistence"]): string {
  switch (value) {
    case "not-recorded":
      return "기록 안 됨";
    case "local":
      return "로컬 기록";
    case "supabase":
      return "Supabase 활동 기록";
    case "both":
      return "로컬+Supabase 활동 기록";
    case "failed-remote":
      return "로컬 기록, 원격 활동 기록 실패";
    default:
      return assertNever(value);
  }
}

function projectPersistenceText(value: ConstructionAuditRecord["projectPersistence"]): string {
  switch (value) {
    case "not-requested":
      return "저장 요청 안 함";
    case "pending":
      return "저장 대기";
    case "local":
      return "로컬 저장";
    case "supabase":
      return "Supabase 프로젝트 저장";
    case "both":
      return "로컬+Supabase 프로젝트 저장";
    case "failed":
      return "프로젝트 저장 실패";
    default:
      return assertNever(value);
  }
}

const STATUS_PRIORITY = {
  applied: 1,
  "no-change": 2,
  pending: 3,
  blocked: 4,
  failed: 5,
} as const satisfies Readonly<Record<ConstructionActivityStatus, number>>;

function assertNever(value: never): never {
  throw new TypeError(`Unknown construction activity value: ${String(value)}`);
}
