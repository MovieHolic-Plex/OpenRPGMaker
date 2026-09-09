export async function readRequestJson(req) {
  if (req.method === "GET" || req.method === "OPTIONS") return {};
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024 * 1024) throw new Error("Request body is too large");
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  return JSON.parse(raw);
}

export function writeCompanionResult(res, result, extraHeaders = {}) {
  if (result.stream && result.ndjson) {
    // Pi 에이전트 진행 스트림 — 워커 본문을 줄 단위로 그대로 흘린다(모아서 보내면 진행 표시가 죽는다).
    res.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
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
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
  } catch (error) {
    res.write(`${JSON.stringify({ type: "error", message: error instanceof Error ? error.message : String(error) })}\n`);
  } finally {
    res.end();
  }
}
