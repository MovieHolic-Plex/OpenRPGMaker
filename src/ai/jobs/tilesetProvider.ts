import { requestBody, parseNonStream, type AiConfig, type ChatRequest } from "@/ai/llmClient";
import { requireRecord } from "@/project/io/guards";
import { jsonObject, jsonValue } from "./checkpointState";
import type { JsonValue } from "./contracts";
import type { AiJobHost } from "../../../scripts/lib/aiJobs/scheduler.mjs";

/** All text and vision share the host ledger; no direct client transport or retry. */
export function createTilesetJobChat(host: AiJobHost, stage: string, beforeRequest: () => Promise<void>) {
  let cursor = 0;
  let failure: unknown;
  const assertHealthy = () => { if (failure !== undefined) throw failure; };
  const chat = async (config: AiConfig, request: ChatRequest) => {
    assertHealthy();
    try {
      request.signal?.throwIfAborted();
      await beforeRequest();
      // Checkpoint validation reconstructs ToolResult fields. JSON embedded in a tool
      // message must not change with object insertion order on replay.
      const wireRequest: ChatRequest = { ...request, messages: request.messages.map(message =>
        message.role === "tool" && typeof message.content === "string"
          ? { ...message, content: JSON.stringify(canonicalJson(jsonValue(JSON.parse(message.content)))) }
          : message) };
      const response = await host.providerOperation({ key: `tileset/${stage}/provider/${cursor++}`, request: {
        kind: "text", provider: config.providerId ?? "google-antigravity", body: jsonObject(JSON.parse(requestBody(config, wireRequest, false))),
      } });
      request.signal?.throwIfAborted();
      return parseNonStream(requireRecord("provider response", response), config.model);
    } catch (error) { failure = error; throw error; }
  };
  return Object.assign(chat, { assertHealthy });
}

function canonicalJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, canonicalJson(value)]));
  return value;
}
