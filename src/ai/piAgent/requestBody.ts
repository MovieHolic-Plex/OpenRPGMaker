/** Preserve reference images while keeping large project requests below the wire limit. */
export async function piRequestBody(value: unknown, signal?: AbortSignal): Promise<{ body: string | ArrayBuffer; headers: Record<string, string> }> {
  signal?.throwIfAborted();
  const json = JSON.stringify(value);
  const headers = { "Content-Type": "application/json" };
  if (json.length < 1024 * 1024 || typeof CompressionStream === "undefined") {
    return { body: json, headers };
  }
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  const body = await new Response(stream).arrayBuffer();
  signal?.throwIfAborted();
  return { body, headers: { ...headers, "Content-Encoding": "gzip" } };
}
