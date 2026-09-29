import { gunzipSync } from "node:zlib";

/**
 * 받은(압축된) 몸통 상한. 풀어낸 상한(maxOutputLength)·워커 상한(oh-my-pi-worker maxRequestBodySize)과 같다.
 * 예전 64MiB 는 풀어낸 상한보다 낮아 의미가 없었다 — 2026-09-28 실측: 새 빈 프로젝트의 첫 Pi 요청이 해시 전송에도
 * gzip 69MB(풀면 203MB, 공용 업로드 아틀라스 dataURL 414개 85MB + 타일셋 101MB)라 호스트가 매번 「Request body is
 * too large」로 끊었고, 팀·단독 모두 새 프로젝트에서 첫 요청이 한 번도 돌지 못했다.
 */
export const MAX_REQUEST_BYTES = 256 * 1024 * 1024;

export async function readRequestJson(req) {
  if (req.method === "GET" || req.method === "OPTIONS") return {};
  const encoding = req.headers?.["content-encoding"] ?? "identity";
  if (encoding !== "identity" && encoding !== "gzip") throw new Error("Unsupported request content encoding");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw Object.assign(new Error("Request body is too large"), { status: 413 });
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const wire = Buffer.concat(chunks);
  // Bound decompression independently of the compressed cap.
  const decoded = encoding === "gzip" ? gunzipSync(wire, { maxOutputLength: MAX_REQUEST_BYTES }) : wire;
  const raw = decoded.toString("utf8") || "{}";
  return JSON.parse(raw);
}

export function writeCompanionResult(res, result, extraHeaders = {}) {
  if (result.stream && result.ndjson) {
    // Pi 에이전트 진행 스트림 — 워커 본문을 줄 단위로 그대로 흘린다(모아서 보내면 진행 표시가 죽는다).
    res.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...(result.headers ?? {}),
      ...extraHeaders,
    });
    pipeWebStream(result.ndjson, res);
    return;
  }
  if (result.stream) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...extraHeaders,
    });
    for (const chunk of result.chunks ?? []) res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    res.end("data: [DONE]\n\n");
    return;
  }
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  };
  if (result.status === 204) {
    res.writeHead(204, extraHeaders);
    res.end();
    return;
  }
  if (result.status === 302 && result.headers?.Location) {
    res.writeHead(302, { Location: result.headers.Location, ...extraHeaders });
    res.end();
    return;
  }
  res.writeHead(result.status ?? 200, headers);
  res.end(JSON.stringify(result.body ?? {}));
}

async function pipeWebStream(readable, res) {
  const reader = readable.getReader();
  // 브라우저가 끊으면 이 리더만 취소한다. 실행 기록 스트림(piRunRelay)이면 실행 자체는 계속되고, 브라우저가 이어 받는다.
  res.on("close", () => { if (!res.writableFinished) void reader.cancel().catch(() => undefined); });
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value && !res.destroyed) res.write(Buffer.from(value));
    }
  } catch (error) {
    if (!res.destroyed) res.write(`${JSON.stringify({ type: "error", message: error instanceof Error ? error.message : String(error) })}\n`);
  } finally {
    res.end();
  }
}
