/** Recognize the machine-consumed wiki payload, without pinning prompt prose. */
export function isWikiExtraction(messages: readonly { readonly content?: unknown }[] | undefined): boolean {
  const last = messages?.at(-1)?.content;
  if (typeof last !== "string" || !last.trimStart().startsWith("{")) return false;
  try {
    const payload: unknown = JSON.parse(last);
    return typeof payload === "object" && payload !== null
      && "sources" in payload && Array.isArray(payload.sources)
      && "currentDocuments" in payload && Array.isArray(payload.currentDocuments);
  } catch {
    return false;
  }
}

/** An unrelated UI/authoring test has no new enduring project facts to extract. */
export function emptyWikiResponse(): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { role: "assistant", content: '{"upserts":[]}' }, finish_reason: "stop" }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}
