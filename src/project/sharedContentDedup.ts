/**
 * 공용 자료 응답의 전송 전용 중복 제거(`?dedup=1`).
 *
 * 왜(2026-10-15 실측, 첫 방문): defaults 범위 28.4MB 중 15.2MB 가 같은 긴 글의 되풀이였다 — charset-actor-kept 라이브러리의
 * 캐릭터 256명이 같은 참고 시트(dataUrl 39~83KB)와 같은 라이선스 글(19~42KB)을 각자 품고 있다. gzip 은 창이 32KB 라 그 되풀이를
 * 보지 못해 13.1MB 를 보냈다(brotli 는 3.1MB — 하지만 브라우저는 http 에서 br 을 받지 않는다). 같은 글을 한 번만 싣고 자리에는
 * 표식을 두면 gzip 으로 3.7MB, 파싱할 글도 28.4MB → 11.3MB 다.
 *
 * 전송 형식일 뿐이다: 받는 쪽이 표식을 같은 글(같은 문자열)로 되돌리면 원래 스냅숏과 값이 같다. 되돌린 값이 기기 캐시(IndexedDB)와
 * 설치 경로로 가므로 그 아래는 이 형식을 모른다. 요청에 `dedup=1` 이 없으면 서버는 예전 형식을 그대로 준다.
 */
import type { SharedContentSnapshot } from "./sharedContentSchema";

/** 이 길이 이상이고 두 번 이상 나오는 글만 표로 뺀다. */
export const DEDUP_MIN_CHARS = 1024;
/** 표식 = NUL + "S" + 번호. 원본에 NUL 로 시작하는 글이 하나라도 있으면 중복 제거를 하지 않는다(표식과 겹칠 수 없게). */
const MARKER_PREFIX = "\u0000S";

export interface DedupedSharedContent {
  readonly oprnDedup: 1;
  readonly strings: readonly string[];
  readonly snapshot: unknown;
}

export function dedupeSharedContent(snapshot: SharedContentSnapshot): DedupedSharedContent | null {
  const counts = new Map<string, number>();
  let unsafe = false;
  const count = (value: unknown): void => {
    if (typeof value === "string") {
      if (value.charCodeAt(0) === 0) unsafe = true;
      else if (value.length >= DEDUP_MIN_CHARS) counts.set(value, (counts.get(value) ?? 0) + 1);
    } else if (Array.isArray(value)) {
      for (const item of value) count(item);
    } else if (value !== null && typeof value === "object") {
      for (const key of Object.keys(value)) count((value as Record<string, unknown>)[key]);
    }
  };
  count(snapshot);
  if (unsafe) return null;
  const strings: string[] = [];
  const ids = new Map<string, number>();
  const swap = (value: unknown): unknown => {
    if (typeof value === "string") {
      if (value.length < DEDUP_MIN_CHARS || (counts.get(value) ?? 0) < 2) return value;
      let id = ids.get(value);
      if (id === undefined) { id = strings.length; strings.push(value); ids.set(value, id); }
      return `${MARKER_PREFIX}${id}`;
    }
    if (Array.isArray(value)) return value.map(swap);
    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(value)) out[key] = swap((value as Record<string, unknown>)[key]);
      return out;
    }
    return value;
  };
  if (counts.size === 0 || ![...counts.values()].some((n) => n > 1)) return null;
  return { oprnDedup: 1, strings, snapshot: swap(snapshot) };
}

export function isDedupedSharedContent(value: unknown): value is DedupedSharedContent {
  return typeof value === "object" && value !== null && (value as { oprnDedup?: unknown }).oprnDedup === 1
    && Array.isArray((value as { strings?: unknown }).strings);
}

/** 표식을 같은 글로 되돌린다. 받은 트리를 제자리에서 고친다(파싱해 막 만든 사적 트리다). */
export function inflateDedupedSharedContent(value: DedupedSharedContent): SharedContentSnapshot {
  const strings = value.strings;
  const fix = (node: unknown): unknown => {
    if (typeof node === "string") {
      if (node.charCodeAt(0) !== 0 || !node.startsWith(MARKER_PREFIX)) return node;
      const text = strings[Number(node.slice(MARKER_PREFIX.length))];
      if (typeof text !== "string") throw new Error("공용 자료 응답의 중복 표식이 올바르지 않습니다");
      return text;
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        const item = node[i];
        if (typeof item === "string" ? item.charCodeAt(0) === 0 : item !== null && typeof item === "object") node[i] = fix(item);
      }
      return node;
    }
    if (node !== null && typeof node === "object") {
      const record = node as Record<string, unknown>;
      for (const key in record) {
        const item = record[key];
        if (typeof item === "string" ? item.charCodeAt(0) === 0 : item !== null && typeof item === "object") record[key] = fix(item);
      }
    }
    return node;
  };
  return fix(value.snapshot) as SharedContentSnapshot;
}

/** fetch 응답 본문이 중복 제거 형식이면 되돌려 돌려준다. 아니면 그대로. */
export function inflateSharedContentResponse(parsed: unknown): SharedContentSnapshot {
  return isDedupedSharedContent(parsed) ? inflateDedupedSharedContent(parsed) : (parsed as SharedContentSnapshot);
}
