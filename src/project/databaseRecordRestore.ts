// project/databaseRecordRestore.ts — AI 검토 카드 한 장(= 레코드 하나)을 한쪽 상태로 맞춘다.
//
// 브리지 초안은 도구 호출 묶음이라 「8건 중 7건만」 커밋할 길이 없다. 그래서 검토 오버레이는 초안을
// 통째로 커밋한 뒤 뺀 카드만 그 레코드의 AI 전 상태로 되돌리고, 적용 뒤의 카드별 「되돌리기」도
// 같은 함수로 그 레코드 하나만 되돌린다. 레코드 신원은 diffDatabaseRecords 의 (컬렉션, id) 다.
import type { DatabaseRecordChange } from "./databaseRecordDiff";
import type { Project } from "./types";

function recordId(record: unknown): unknown {
  return typeof record === "object" && record !== null ? (record as { readonly id?: unknown }).id : undefined;
}

/**
 * `changes` 의 레코드마다 `side` 쪽(before = AI 전, after = AI 초안) 값으로 맞춘 새 프로젝트.
 * 그쪽에 레코드가 없으면(추가를 빼거나 삭제를 적용) 목록에서 뺀다. 원본 프로젝트는 건드리지 않는다.
 */
export function projectWithRecordStates(
  project: Project,
  changes: readonly DatabaseRecordChange[],
  side: "before" | "after",
): Project {
  if (changes.length === 0) return project;
  const database: Record<string, unknown> = { ...(project.database as unknown as Record<string, unknown>) };
  for (const change of changes) {
    const current = database[change.collection];
    const list = Array.isArray(current) ? [...(current as unknown[])] : [];
    const target = side === "before" ? change.before : change.after;
    const index = list.findIndex((record) => recordId(record) === change.id);
    if (target === null) {
      if (index >= 0) list.splice(index, 1);
    } else if (index >= 0) {
      list[index] = structuredClone(target);
    } else {
      list.push(structuredClone(target));
    }
    database[change.collection] = list;
  }
  return { ...project, database: database as unknown as Project["database"] };
}
