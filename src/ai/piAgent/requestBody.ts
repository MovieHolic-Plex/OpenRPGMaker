/**
 * Preserve reference images while keeping large project requests below the wire limit.
 *
 * 큰 몸통은 gzip 으로 보낸다. 압축 입력은 몸통 전체를 한 번에 만들지 않고 256KB 조각으로 흘리며, 쉬지 않고 12ms 를 넘게 일했으면
 * 이벤트 루프에 양보한다. 결과 바이트는 JSON.stringify(value) 를 gzip 한 것과 같은 글이다(단일 gzip 멤버).
 * 조각마다 양보하면 149MB 첫 전송이 양보 약 600번(각 4ms 이상)으로 벽시계 약 5s 가 늘었다 — 시간으로 묶는다.
 *
 * 왜(2026-09-28 실측, 실제 프로젝트 12맵 · 첫 전송 9MB): JSON.stringify(몸통 전체) → new Blob → CompressionStream 을
 * 한 번에 하던 것이 전송 직후 메인 스레드를 약 2.9s 세웠다. 몸통의 대부분은 heavyBlobs 의 타일셋·DB 글(7.4MB)이고,
 * 그 글을 JSON 문자열로 이스케이프한 사본을 통째로 만든 것이 컸다 — 이제 조각마다 이스케이프한다.
 * 이어 붙인 gzip 멤버는 쓰지 않는다: node 는 풀지만 브라우저 DecompressionStream 은 뒤따르는 멤버를 거부한다.
 */
export async function piRequestBody(value: unknown, signal?: AbortSignal): Promise<{ body: string | ArrayBuffer; headers: Record<string, string> }> {
  signal?.throwIfAborted();
  const headers = { "Content-Type": "application/json" };
  const pieces = streamablePieces(value);
  if (pieces && canCompress()) {
    const body = await gzipPieces(pieces, signal);
    signal?.throwIfAborted();
    return { body, headers: { ...headers, "Content-Encoding": "gzip" } };
  }
  const json = JSON.stringify(value);
  if (json.length < 1024 * 1024 || !canCompress()) {
    return { body: json, headers };
  }
  const body = await gzipPieces([{ text: json, asJsonString: false }], signal);
  signal?.throwIfAborted();
  return { body, headers: { ...headers, "Content-Encoding": "gzip" } };
}

type Piece = { readonly text: string; readonly asJsonString: boolean };

/**
 * heavyBlobs 가 있는 몸통을 JSON.stringify 와 같은 순서·같은 글의 조각으로 나눈다. heavyBlobs 의 글은 이스케이프 전 원문으로
 * 두고(asJsonString) 압축 직전에 조각별로 이스케이프한다. 최상위가 평범한 객체가 아니면 null — 통째 경로를 쓴다.
 */
function streamablePieces(value: unknown): Piece[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.toJSON === "function") return null;
  const blobs = record.heavyBlobs;
  if (!blobs || typeof blobs !== "object" || Array.isArray(blobs) || typeof (blobs as { toJSON?: unknown }).toJSON === "function") return null;
  const blobEntries = Object.entries(blobs as Record<string, unknown>);
  if (blobEntries.length === 0 || !blobEntries.every(([, entry]) => typeof entry === "string")) return null;
  const pieces: Piece[] = [];
  let pending = "{";
  let firstKey = true;
  for (const key of Object.keys(record)) {
    if (key === "heavyBlobs") {
      pending += (firstKey ? "" : ",") + JSON.stringify(key) + ":{";
      firstKey = false;
      blobEntries.forEach(([hash, json], index) => {
        pending += (index === 0 ? "" : ",") + JSON.stringify(hash) + ":\"";
        pieces.push({ text: pending, asJsonString: false });
        pieces.push({ text: json as string, asJsonString: true });
        pending = "\"";
      });
      pending += "}";
      continue;
    }
    const encoded = JSON.stringify(record[key]);
    if (encoded === undefined) continue;
    pending += (firstKey ? "" : ",") + JSON.stringify(key) + ":" + encoded;
    firstKey = false;
  }
  pieces.push({ text: pending + "}", asJsonString: false });
  return pieces;
}

function canCompress(): boolean {
  return typeof CompressionStream !== "undefined" && typeof ReadableStream !== "undefined" && typeof Response !== "undefined";
}

const CHUNK_CHARS = 256 * 1024;
/** 이만큼 쉬지 않고 일했으면 양보한다. 한 프레임(16ms) 안에 들게. */
const YIELD_AFTER_MS = 12;

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** 조각을 UTF-8 로 바꿔 한 gzip 스트림에 흘린다. 조각 경계에서 서로게이트 쌍을 가르지 않는다. */
async function gzipPieces(pieces: readonly Piece[], signal?: AbortSignal): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  let pieceIndex = 0;
  let offset = 0;
  let sliceStart = nowMs();
  // CompressionStream 의 쓰기 쪽은 BufferSource 를 받는다 — 조각 타입을 그에 맞춘다(TextEncoder 결과는 BufferSource 다).
  const source = new ReadableStream<BufferSource>({
    async pull(controller) {
      for (;;) {
        const piece = pieces[pieceIndex];
        if (!piece) { controller.close(); return; }
        if (offset >= piece.text.length) { pieceIndex += 1; offset = 0; continue; }
        if (nowMs() - sliceStart >= YIELD_AFTER_MS) {
          await yieldToEventLoop();
          sliceStart = nowMs();
        }
        if (signal?.aborted) { controller.error(signal.reason); return; }
        let end = Math.min(piece.text.length, offset + CHUNK_CHARS);
        if (end < piece.text.length) {
          const code = piece.text.charCodeAt(end - 1);
          if (code >= 0xd800 && code <= 0xdbff) end -= 1;
        }
        const slice = piece.text.slice(offset, end);
        offset = end;
        controller.enqueue(encoder.encode(piece.asJsonString ? JSON.stringify(slice).slice(1, -1) : slice));
        return;
      }
    },
  });
  return new Response(source.pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
