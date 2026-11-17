// 도구 호출이 고치려는 «이미 있는» 자료집 레코드를 찾고, 인자 경로의 저장값을 돌려준다.
// 왜(2026-11-16 db-review A F3 · B #6): 인자 검사(v2 argGuard pruneDefaults)와 실행기(pruneEmptyOptionalArgs)는 빈 목록·0·false·빈 글을
// «모델이 스키마를 기본값으로 채운 것» 으로 보고 걷었다. 그래서 「드랍 빼 줘」(drops:[])·「자동 전투 꺼」(false)·「경험치 0」이 조용히 사라지고
// 도구는 성공이라 했다. 채움과 진짜 비우기는 저장값을 보면 갈린다: 저장값도 비어 있으면 아무것도 안 바뀌는 채움이고, 저장값이 있으면 바꾸라는 말이다.
import type { Project } from "@/project/types";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** 인자에서 레코드 id 를 든 객체(upsert_x{x:{id}}) 또는 맨 위 id(upsert_common_event{id}) — 그 id 의 기존 레코드와 인자 속 자리. */
export interface StoredTarget { readonly argKey?: string; readonly record: Obj; readonly collection: string }

export function storedRecordFor(project: Project, args: Obj): StoredTarget | undefined {
  const find = (id: string): { record: Obj; collection: string } | undefined => {
    const hits: { record: Obj; collection: string }[] = [];
    for (const [collection, list] of Object.entries(project.database ?? {})) {
      if (!Array.isArray(list)) continue;
      for (const r of list) if (isObj(r) && r.id === id) hits.push({ record: r, collection });
    }
    for (const r of project.commonEvents ?? []) if ((r as unknown as Obj).id === id) hits.push({ record: r as unknown as Obj, collection: "commonEvents" });
    return hits.length === 1 ? hits[0] : undefined;
  };
  const nested = Object.entries(args).filter(([, v]) => isObj(v) && typeof (v as Obj).id === "string");
  if (nested.length === 1) {
    const [argKey, value] = nested[0]!;
    const hit = find(String((value as Obj).id));
    return hit ? { argKey, ...hit } : undefined;
  }
  if (typeof args.id === "string") { const hit = find(args.id); return hit ? hit : undefined; }
  return undefined;
}

/** 인자 경로(«enemy.rewards» · «restriction») → 그 레코드의 저장값. 레코드 밖 칸·목록 안 자리는 undefined 와 구별해 NOT_IN_RECORD. */
export const NOT_IN_RECORD = Symbol("not-in-record");
export function storedAt(target: StoredTarget, argPath: string): unknown {
  const parts = argPath.split(".");
  if (target.argKey) { if (parts[0] !== target.argKey) return NOT_IN_RECORD; parts.shift(); }
  if (parts.some((p) => /\[\d+\]/u.test(p))) return NOT_IN_RECORD;
  let cur: unknown = target.record;
  for (const p of parts) { if (!isObj(cur)) return undefined; cur = cur[p]; }
  return cur;
}

/** 값이 «아무것도 안 정한» 것인가 — undefined·null·빈 글·빈 목록·잎이 모두 0/false/빈 것인 객체. */
export function blankish(v: unknown): boolean {
  if (v === undefined || v === null || v === "" || v === 0 || v === false) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (isObj(v)) return Object.values(v).every(blankish);
  return false;
}

/** 보낸 기본값 v 가 저장값 stored 를 바꾸나 — 객체면 보낸 잎마다 저장 잎과 견준다(저장에 없는 잎은 기본값으로 본다). */
export function changesStored(v: unknown, stored: unknown): boolean {
  if (isObj(v)) return Object.entries(v).some(([k, x]) => changesStored(x, isObj(stored) ? stored[k] : undefined));
  if (blankish(stored)) return !blankish(v) || (typeof v === "number" && typeof stored === "number" && v !== stored);
  return JSON.stringify(v) !== JSON.stringify(stored);
}
