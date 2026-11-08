/**
 * 로드 복구 보고 — 프로젝트를 불러오면서 조용히 고친 것을 종류별로 센 기록.
 *
 * 로드 복구(loadRepair.ts, io/references.ts repairProjectReferences)는 깨진 참조를 지우거나 바꾸고 빠진 기본값을 채워
 * 프로젝트가 열리게 한다. 예전에는 그 사실이 console.warn 한 줄로만 남아, 조수가 만든 참조가 사라져도 사람도 조수도 몰랐다.
 * 수집은 begin/finish 사이에서만 켜진다 — lint 왕복·삭제 미리보기처럼 같은 검증을 다시 도는 경로는 보고하지 않는다.
 * 보고는 프로젝트 문서 밖(스토어)에 둔다. 문서에 넣으면 그 자체가 «로드가 프로젝트를 바꿨다»가 된다.
 */
export type LoadRepairKind = "removed" | "replaced" | "added";

export interface LoadRepairEntry {
  readonly kind: LoadRepairKind;
  /** 기계가 읽는 분류 코드(예: "transfer-missing-map"). */
  readonly code: string;
  readonly count: number;
  /** 고친 자리(이벤트·레코드 id 등) 앞쪽 몇 개. */
  readonly where: readonly string[];
  /** 사람에게 보이는 한 줄(한국어 정본). */
  readonly label: string;
}

export interface LoadRepairReport {
  readonly total: number;
  readonly entries: readonly LoadRepairEntry[];
}

const WHERE_LIMIT = 5;

type Bucket = { kind: LoadRepairKind; label: string; count: number; where: string[] };
let active: Map<string, Bucket> | null = null;

export function beginLoadRepairReport(): void {
  active = new Map();
}

export function noteLoadRepair(kind: LoadRepairKind, code: string, label: string, where?: string, count = 1): void {
  if (!active || count <= 0) return;
  const bucket = active.get(code) ?? { kind, label, count: 0, where: [] };
  bucket.count += count;
  if (where && bucket.where.length < WHERE_LIMIT && !bucket.where.includes(where)) bucket.where.push(where);
  active.set(code, bucket);
}

/** 같은 검증을 안에서 한 번 더 도는 계산(복구 전 참조 수집 등)은 세지 않는다. */
export function withoutLoadRepairReport<T>(run: () => T): T {
  const paused = active;
  active = null;
  try {
    return run();
  } finally {
    active = paused;
  }
}

let latest: LoadRepairReport | null = null;

/** 프로젝트를 여는 동기 구간 하나를 감싸 그동안의 수리를 센다. 결과는 takeLatestLoadRepairReport 로 스토어가 가져간다. */
export function collectLoadRepairs<T>(open: () => T): T {
  beginLoadRepairReport();
  try {
    const value = open();
    latest = finishLoadRepairReport();
    return value;
  } catch (error) {
    finishLoadRepairReport();
    throw error;
  }
}

let opened: LoadRepairReport | null = null;

/** 스토어가 프로젝트를 채택한 순간 부른다 — 직전 로드의 보고가 «지금 열린 프로젝트»의 보고가 된다. */
export function adoptLatestLoadRepairReport(): LoadRepairReport | null {
  opened = latest;
  latest = null;
  return opened;
}

/** 지금 열린 프로젝트를 불러오면서 고친 것. 로드 전이면 null. 도구·편집기 알림이 같은 값을 읽는다. */
export function openedLoadRepairReport(): LoadRepairReport | null {
  return opened;
}

export function finishLoadRepairReport(): LoadRepairReport {
  const buckets = active ?? new Map<string, Bucket>();
  active = null;
  const order: Record<LoadRepairKind, number> = { removed: 0, replaced: 1, added: 2 };
  const entries = [...buckets.entries()]
    .map(([code, bucket]) => ({ kind: bucket.kind, code, count: bucket.count, where: [...bucket.where], label: bucket.label }))
    .sort((a, b) => order[a.kind] - order[b.kind] || b.count - a.count);
  return { total: entries.reduce((sum, entry) => sum + entry.count, 0), entries };
}

export const LOAD_REPAIR_KIND_LABEL: Readonly<Record<LoadRepairKind, string>> = { removed: "지움", replaced: "바꿈", added: "채움" };

export function loadRepairSummary(report: LoadRepairReport): string {
  const parts = report.entries.slice(0, 3).map((entry) => `${entry.label} ${entry.count}`);
  const rest = report.entries.length > 3 ? ` 외 ${report.entries.length - 3}종` : "";
  return `불러오면서 ${report.total}건을 고쳤습니다 — ${parts.join(", ")}${rest}`;
}
