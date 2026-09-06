import { requestBody, parseNonStream, type AiConfig, type ChatRequest, type ChatResult } from "../llmClient";
import type { AiJobHost } from "../../../scripts/lib/aiJobs/scheduler.mjs";
import { jsonObject } from "./checkpointState";
import type { JsonValue } from "./contracts";
import { requireRecord } from "@/project/io/guards";
function orderedJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(orderedJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, orderedJson(item)]));
  }
  return value;
}
function canonicalToolContent(content: string): string {
  let parsed: unknown;
  try { parsed = JSON.parse(content); }
  catch (error) {
    // Tool messages can also be plain text. Preserve that supported format exactly;
    // only JSON containers have property-order drift across canonical blob storage.
    if (error instanceof SyntaxError) return content;
    throw error;
  }
  if (parsed === null || typeof parsed !== "object") return content;
  return JSON.stringify(orderedJson(jsonObject({ value: parsed }).value));
}
/** Same wire encoder/parser as foreground; no fetch, credentials or client retry. */
export function createJobChat(host: AiJobHost, beforeRequest: () => Promise<void>) {
  let cursor = 0;
  let failure: unknown;
  const assertHealthy = () => { if (failure) throw failure; };
  const chat = async (config: AiConfig, request: ChatRequest): Promise<ChatResult> => {
    assertHealthy();
    try {
      request.signal?.throwIfAborted();
      await beforeRequest();
      // Canonical storage sorts journal objects, but cannot sort JSON embedded in
      // message strings. Normalize tool containers on BOTH first dispatch and replay.
      // Never normalize user prose, assistant text, tool arguments, or array order.
      const messages = request.messages.map(message => message.role === "tool" && typeof message.content === "string"
        ? { ...message, content: canonicalToolContent(message.content) } : message);
      const response = await host.providerOperation({
        key: `assistant/provider/${cursor++}`,
        request: { kind: "text", provider: config.providerId ?? "google-antigravity", body: jsonObject(JSON.parse(requestBody(config, { ...request, messages }, false))) },
      });
      request.signal?.throwIfAborted();
      if (!response || typeof response !== "object" || Array.isArray(response)) throw new Error("Invalid provider response");
      return parseNonStream(requireRecord("provider response", response), config.model);
    } catch (error) { failure = error; throw error; }
  };
  return Object.assign(chat, { assertHealthy });
}
