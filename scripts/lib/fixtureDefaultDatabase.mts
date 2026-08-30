type Record_ = { id: string };

// 레코드가 전부 코드 기본값에서 오는 테이붔들이다 (실측 2026-08-30: 다섯 테이붔 모든
// 레코드의 id 가 기본값 id 여서 저작 전용이 0개이다). items/equipment 만 갱신하면
// 그것들이 가리키는 skills/states/battleAnimations 가 모자라 참조 검사가 토한다.
export const DERIVED_DATABASE_TABLES = [
  "items",
  "equipment",
  "skills",
  "states",
  "battleAnimations",
] as const;

export type DerivedTable = (typeof DERIVED_DATABASE_TABLES)[number];

export type SyncReport = {
  refreshed: string[];
  added: string[];
  authoredKept: string[];
};

// 기본값 id 는 코드 값으로 통째 교체하고, 코드에 없는 id(저작 전용)는 손대지 않는다.
// 순서는 코드 기본값 순서를 따르고 저작 전용 레코드를 뒤에 붙여, 같은 입력이면 같은 출력이 나온다.
export function syncDefaultRecords<T extends Record_>(
  shipped: readonly T[],
  code: readonly T[],
): { records: T[]; report: SyncReport } {
  const shippedById = new Map(shipped.map((record) => [record.id, record]));
  const codeIds = new Set(code.map((record) => record.id));

  const refreshed: string[] = [];
  const added: string[] = [];
  const records: T[] = [];

  for (const codeRecord of code) {
    const existing = shippedById.get(codeRecord.id);
    if (existing === undefined) added.push(codeRecord.id);
    else if (JSON.stringify(existing) !== JSON.stringify(codeRecord)) refreshed.push(codeRecord.id);
    records.push(structuredClone(codeRecord));
  }

  const authoredKept: string[] = [];
  for (const shippedRecord of shipped) {
    if (codeIds.has(shippedRecord.id)) continue;
    authoredKept.push(shippedRecord.id);
    records.push(shippedRecord);
  }

  return { records, report: { refreshed, added, authoredKept } };
}
