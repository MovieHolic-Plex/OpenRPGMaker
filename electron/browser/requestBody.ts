/** Large saves include a conflict-resolution base document; compress only the wire representation. */
export async function encodeBridgeRequest(value: unknown, keepalive = false): Promise<{ body: string | Blob; headers: Record<string, string> }> {
  const text = JSON.stringify(value);
  if (keepalive || text.length < 1024 * 1024 || typeof CompressionStream === "undefined") {
    return { body: text, headers: {} };
  }
  const compressed = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return { body: await new Response(compressed).blob(), headers: { "content-encoding": "gzip" } };
}
