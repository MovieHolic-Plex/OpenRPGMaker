// ai/session/recordReference.ts
// DB 레코드를 여러 건 쓰는 턴에서 "실패한 레코드를 참조하는 후속 쓰기" 를 찾는다.
// 명시된 ID 계약만 본다(ToolReadEvidence 와 같은 기준) — 산문에서 의존을 추론하지 않는다.

import { isRecord } from "./unknownValue";

const BATCH_RECORD_COLLECTIONS = [
  ["item", "items"], ["enemy", "enemies"], ["troop", "troops"],
  ["actor", "actors"], ["skill", "skills"], ["equipment", "equipment"],
] as const;

type BatchRecordKind = typeof BATCH_RECORD_COLLECTIONS[number][0];

export interface BatchRecordTarget {
  key: string;
  kind: BatchRecordKind;
  collection: typeof BATCH_RECORD_COLLECTIONS[number][1];
  id: string;
}

export function batchRecordTarget(name: string, args: Record<string, unknown>): BatchRecordTarget | null {
  for (const [kind, collection] of BATCH_RECORD_COLLECTIONS) {
    const value = args[kind];
    if (name === `upsert_${kind}` && isRecord(value) && typeof value.id === "string") {
      return { key: `${kind}:${value.id}`, kind, collection, id: value.id };
    }
  }
  return null;
}

export function failedRecordReference(value: unknown, failed: ReadonlyMap<string, BatchRecordTarget>): BatchRecordTarget | undefined {
  if (failed.size === 0) return undefined;
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = failedRecordReference(child, failed);
      if (found) return found;
    }
  } else if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      for (const target of failed.values()) {
        const idField = key === `${target.kind}Id` || key === `${target.kind}Ids`
          || (target.kind === "actor" && (key === "partyActorIds" || key === "startActorIds"));
        if (idField && (Array.isArray(child) ? child : [child]).includes(target.id)) return target;
        if (target.kind === "item" && key === "inventory" && isRecord(child) && Object.hasOwn(child, target.id)) return target;
      }
      const found = failedRecordReference(child, failed);
      if (found) return found;
    }
  }
  return undefined;
}
