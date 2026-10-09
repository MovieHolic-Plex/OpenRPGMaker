/**
 * 브리지 요청 JSON 을 한 문자열이 아니라 조각 배열로 만든다. 이으면 `JSON.stringify(value)` 와 바이트까지 같다.
 *
 * 왜 (2026-09-28 실측, Firefox): 새 프로젝트의 첫 전체 저장 글(`serialized`)이 1억 8,700만 자였다
 * (타일셋 368개 101MB + 공용 업로드 dataURL 414개 85MB). 봉투 `{ channel, payload }` 를 통째로
 * `JSON.stringify` 하면 `InternalError: allocation size overflow` 가 났다 — 같은 브라우저에서 1.5억 자는 통과,
 * 1.8억 자는 실패. 자동 저장이 매번 이 자리에서 실패해 팀 실행 결과(맵 15개)가 SQLite 에 하나도 남지 않았다.
 * 맵 패치도 정규화 뒤 첫 저장은 타일셋·자산 객체를 거의 다 싣는다(같은 크기의 객체 트리).
 *
 * 그래서 평범한 객체·배열은 가지마다 따로 직렬화하고, 긴 문자열은 `chunkChars` 씩 끊어 처리한다.
 * 조각은 `chunkChars` 근처 크기로 모아 Blob 조각 수를 줄인다.
 */
export const BRIDGE_JSON_CHUNK_CHARS = 8 * 1024 * 1024;

const MAX_DEPTH = 64;

function hasToJson(value: object): value is { toJSON: (key: string) => unknown } {
  return typeof (value as { toJSON?: unknown }).toJSON === "function";
}

export function bridgeJsonParts(value: unknown, chunkChars = BRIDGE_JSON_CHUNK_CHARS): string[] {
  const parts: string[] = [];
  let buffer = "";
  const emit = (text: string): void => {
    buffer += text;
    if (buffer.length >= chunkChars) { parts.push(buffer); buffer = ""; }
  };
  const emitString = (text: string): void => {
    if (text.length <= chunkChars) { emit(JSON.stringify(text)); return; }
    emit('"');
    for (let start = 0; start < text.length;) {
      let end = Math.min(text.length, start + chunkChars);
      // 대리 쌍 한가운데서 자르지 않는다 — 조각 끝에 외톨이 상위 대리가 남으면 \uXXXX 로 이스케이프된다.
      const last = text.charCodeAt(end - 1);
      if (end < text.length && last >= 0xd800 && last <= 0xdbff) end += 1;
      emit(JSON.stringify(text.slice(start, end)).slice(1, -1));
      start = end;
    }
    emit('"');
  };
  const ancestors = new Set<object>();
  /** JSON.stringify 처럼 toJSON 을 먼저 부른다. 쓸 수 없는 값(undefined·함수·심벌)이면 undefined. */
  const resolve = (key: string, raw: unknown): unknown => {
    const item = raw !== null && typeof raw === "object" && hasToJson(raw) ? raw.toJSON(key) : raw;
    return item === undefined || typeof item === "function" || typeof item === "symbol" ? undefined : item;
  };
  const write = (item: unknown, depth: number): void => {
    if (typeof item === "string") { emitString(item); return; }
    if (item === null || typeof item !== "object") { emit(JSON.stringify(item) ?? "null"); return; }
    if (depth >= MAX_DEPTH || item instanceof Number || item instanceof String || item instanceof Boolean) {
      emit(JSON.stringify(item));
      return;
    }
    if (ancestors.has(item)) throw new TypeError("bridge request contains a cycle");
    ancestors.add(item);
    if (Array.isArray(item)) {
      // 원시값만 든 배열(타일 칸·통행 배열)은 한 번에 — 원소마다 부르면 수백만 번이다.
      if (item.every((element) => element === null || (typeof element !== "object" && (typeof element !== "string" || element.length <= chunkChars)))) {
        emit(JSON.stringify(item));
      } else {
        emit("[");
        item.forEach((element, index) => {
          if (index > 0) emit(",");
          const child = resolve(String(index), element);
          if (child === undefined) emit("null");
          else write(child, depth + 1);
        });
        emit("]");
      }
    } else {
      emit("{");
      let first = true;
      for (const childKey of Object.keys(item)) {
        const child = resolve(childKey, (item as Record<string, unknown>)[childKey]);
        if (child === undefined) continue;
        emit((first ? "" : ",") + JSON.stringify(childKey) + ":");
        first = false;
        write(child, depth + 1);
      }
      emit("}");
    }
    ancestors.delete(item);
  };
  const root = resolve("", value);
  if (root === undefined) throw new TypeError("bridge request is not JSON-serializable");
  write(root, 0);
  if (buffer.length > 0) parts.push(buffer);
  return parts;
}

/** Large saves include a conflict-resolution base document; compress only the wire representation. */
export async function encodeBridgeRequest(value: unknown, keepalive = false, compress = true): Promise<{ body: string | Blob; headers: Record<string, string> }> {
  const parts = bridgeJsonParts(value);
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const plain = (): string | Blob => (parts.length === 1 ? parts[0]! : new Blob(parts));
  if (!compress || keepalive || length < 1024 * 1024 || typeof CompressionStream === "undefined") {
    return { body: plain(), headers: {} };
  }
  const compressed = new Blob(parts).stream().pipeThrough(new CompressionStream("gzip"));
  return { body: await new Response(compressed).blob(), headers: { "content-encoding": "gzip" } };
}
