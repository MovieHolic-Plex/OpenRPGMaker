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
