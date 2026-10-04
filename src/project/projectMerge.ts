// 3-way 프로젝트 병합 — 같은 출발점(base)에서 갈라진 두 결과(ours = AI 실행, theirs = 지금 스토어)를 합친다(2026-10-03).
//
// 왜: 조수 실행의 실시간 적용은 「출발점 이후 아무것도 안 바뀌었다」를 요구했다(applyProposedProject 의 stale-base).
// 실행이 도는 동안 사람이 다른 맵을 고치거나 다른 맵의 AI 실행이 먼저 반영되면, 서로 다른 맵인데도 다음 체크포인트가
// 통째로 거절됐다. 맵마다 AI 를 따로 돌리려면(사용자 2026-10-03: 「맵당 AI 하나, 맵당 대기열, 충돌은 merge」)
// 서로 안 겹치는 변경은 둘 다 살리고, 정말 겹친 곳만 골라 알려야 한다.
//
// 규칙:
//  - 한쪽만 바꾼 값은 그쪽을 쓴다. 둘이 같게 바꿨으면 그 값.
//  - 객체는 키마다, 같은 길이의 숫자 배열(타일 층·그림자)은 칸마다, `id` 를 가진 객체 배열(이벤트·항목)은 id 마다 내려가 합친다.
//  - 둘이 같은 자리를 다르게 바꿨으면 **theirs(이미 스토어에 있는 값)** 를 남기고 충돌로 적는다 — 이미 화면에 반영된
//    사람의 편집·다른 실행의 결과를 뒤에 온 실행이 조용히 덮지 않는다.
//  - `spatialAuthoring`(계층 문서)은 쪼개지 않는다. 둘 다 바뀌었으면 theirs — 계층 편집은 검증된 도구 증거가 있어야 하고
//    병합 결과에는 그 증거가 없다(spatialToolState.authorMergedSpatialProposal).
//
// 순수 모듈이다(스토어·DOM 없음). 같은 객체 참조는 비교 없이 같다고 본다 — 체크포인트는 무거운 키를 참조째 되붙인다.

import type { Project } from "./types";

export interface ProjectMergeConflict {
  /** 점으로 이은 경로(`maps.map_a.lowerTiles[812]`, `database.items#potion.name`). */
  readonly path: string;
}

export interface ProjectMergeResult {
  readonly project: Project;
  /** theirs 를 남긴 자리. 칸 충돌은 맵·층마다 묶어 개수만 센다. */
  readonly conflicts: readonly ProjectMergeConflict[];
  /** 칸 단위 충돌 수(타일 층). */
  readonly cellConflicts: number;
}

const ATOMIC_KEYS = new Set(["spatialAuthoring"]);
/** 칸 충돌을 경로 하나로 묶을 상한 — 같은 층에서 수백 칸이 부딪혀도 목록이 터지지 않게. */
const CELL_CONFLICT_SAMPLE = 3;

type Json = unknown;

function isPlainObject(value: Json): value is Record<string, Json> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function equal(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!equal(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const ka = Object.keys(a as object), kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const key of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!equal((a as Record<string, Json>)[key], (b as Record<string, Json>)[key])) return false;
  }
  return true;
}

function isNumberGrid(value: Json): value is readonly number[] {
  if (!Array.isArray(value)) return false;
  for (let i = 0; i < value.length; i++) if (typeof value[i] !== "number") return false;
  return true;
}

function idOf(value: Json): string | null {
  return isPlainObject(value) && (typeof value.id === "string" || typeof value.id === "number") ? String(value.id) : null;
}

function isKeyedList(value: Json): value is readonly Json[] {
  if (!Array.isArray(value) || value.length === 0) return Array.isArray(value);
  const seen = new Set<string>();
  for (const item of value) {
    const id = idOf(item);
    if (id === null || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

interface Ctx {
  readonly conflicts: ProjectMergeConflict[];
  cellConflicts: number;
}

function conflict(ctx: Ctx, path: string): void {
  ctx.conflicts.push({ path });
}

function mergeValue(base: Json, ours: Json, theirs: Json, path: string, ctx: Ctx): Json {
  if (ours === theirs) return ours;
  if (equal(ours, base)) return theirs;
  if (equal(theirs, base)) return ours;
  if (equal(ours, theirs)) return ours;
  const key = path.slice(path.lastIndexOf(".") + 1);
  if (ATOMIC_KEYS.has(key)) { conflict(ctx, path); return theirs; }
  if (isPlainObject(base) && isPlainObject(ours) && isPlainObject(theirs)) return mergeObject(base, ours, theirs, path, ctx);
  if (isNumberGrid(base) && isNumberGrid(ours) && isNumberGrid(theirs) && base.length === ours.length && base.length === theirs.length) {
    return mergeGrid(base, ours, theirs, path, ctx);
  }
  if (isKeyedList(base) && isKeyedList(ours) && isKeyedList(theirs)) return mergeKeyedList(base, ours, theirs, path, ctx);
  // 새로 생긴 객체 둘(한쪽만 base 에 없던 키)도 객체면 키마다 합친다.
  if (base === undefined && isPlainObject(ours) && isPlainObject(theirs)) return mergeObject({}, ours, theirs, path, ctx);
  conflict(ctx, path);
  return theirs;
}

function mergeObject(base: Record<string, Json>, ours: Record<string, Json>, theirs: Record<string, Json>, path: string, ctx: Ctx): Record<string, Json> {
  const out: Record<string, Json> = {};
  const keys = new Set([...Object.keys(theirs), ...Object.keys(ours), ...Object.keys(base)]);
  for (const key of keys) {
    const has = (o: Record<string, Json>) => Object.prototype.hasOwnProperty.call(o, key);
    const value = mergeValue(has(base) ? base[key] : undefined, has(ours) ? ours[key] : undefined, has(theirs) ? theirs[key] : undefined, path ? `${path}.${key}` : key, ctx);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function mergeGrid(base: readonly number[], ours: readonly number[], theirs: readonly number[], path: string, ctx: Ctx): number[] {
  const out = theirs.slice();
  let clashes = 0;
  const sample: number[] = [];
  for (let i = 0; i < base.length; i++) {
    const o = ours[i]!, t = theirs[i]!;
    if (o === t || o === base[i]) continue;
    if (t === base[i]) { out[i] = o; continue; }
    clashes++;
    if (sample.length < CELL_CONFLICT_SAMPLE) sample.push(i);
  }
  if (clashes) {
    ctx.cellConflicts += clashes;
    conflict(ctx, `${path}[${sample.join(",")}${clashes > sample.length ? ` 외 ${clashes - sample.length}칸` : ""}]`);
  }
  return out;
}

function mergeKeyedList(base: readonly Json[], ours: readonly Json[], theirs: readonly Json[], path: string, ctx: Ctx): Json[] {
  const byId = (list: readonly Json[]) => new Map(list.map((item) => [idOf(item)!, item] as const));
  const b = byId(base), o = byId(ours), t = byId(theirs);
  const out: Json[] = [];
  const emit = (id: string): void => {
    const value = mergeValue(b.get(id), o.get(id), t.get(id), `${path}#${id}`, ctx);
    if (value !== undefined) out.push(value);
  };
  const done = new Set<string>();
  // theirs 순서를 기준으로 두고, ours 에만 새로 생긴 항목은 ours 순서대로 뒤에 붙인다.
  for (const item of theirs) { const id = idOf(item)!; done.add(id); emit(id); }
  for (const item of ours) { const id = idOf(item)!; if (done.has(id)) continue; done.add(id); emit(id); }
  // base 에만 있던 항목: 둘 다 지웠거나 한쪽이 지웠다 — mergeValue 가 판정한다.
  for (const item of base) { const id = idOf(item)!; if (done.has(id)) continue; done.add(id); emit(id); }
  return out;
}

/**
 * base 에서 갈라진 ours(실행 결과)와 theirs(지금 스토어)를 합친다.
 * theirs 가 base 와 같으면 ours 그대로(병합 비용 없음), ours 가 base 와 같으면 theirs 그대로.
 */
export function mergeProjectThreeWay(base: Project, ours: Project, theirs: Project): ProjectMergeResult {
  if (theirs === base) return { project: ours, conflicts: [], cellConflicts: 0 };
  if (ours === base) return { project: theirs, conflicts: [], cellConflicts: 0 };
  const ctx: Ctx = { conflicts: [], cellConflicts: 0 };
  const project = mergeObject(base as unknown as Record<string, Json>, ours as unknown as Record<string, Json>, theirs as unknown as Record<string, Json>, "", ctx) as unknown as Project;
  return { project, conflicts: ctx.conflicts, cellConflicts: ctx.cellConflicts };
}

/** 사람이 읽는 충돌 한 줄(최대 몇 개만). */
export function describeMergeConflicts(result: Pick<ProjectMergeResult, "conflicts" | "cellConflicts">, limit = 4): string {
  if (!result.conflicts.length) return "";
  const shown = result.conflicts.slice(0, limit).map((c) => c.path).join(", ");
  const more = result.conflicts.length > limit ? ` 외 ${result.conflicts.length - limit}곳` : "";
  return `${shown}${more}${result.cellConflicts ? ` (칸 ${result.cellConflicts}개)` : ""}`;
}
