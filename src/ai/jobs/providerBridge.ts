import { requestBody, parseNonStream, type AiConfig, type ChatRequest, type ChatResult } from "../llmClient";
import type { AiJobHost } from "../../../scripts/lib/aiJobs/scheduler.mjs";
import { jsonObject } from "./checkpointState";
import { requireRecord } from "@/project/io/guards";
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
      const response = await host.providerOperation({
        key: `assistant/provider/${cursor++}`,
        request: { kind: "text", provider: config.providerId ?? "google-antigravity", body: jsonObject(JSON.parse(requestBody(config, request, false))) },
      });
      request.signal?.throwIfAborted();
      if (!response || typeof response !== "object" || Array.isArray(response)) throw new Error("Invalid provider response");
      return parseNonStream(requireRecord("provider response", response), config.model);
    } catch (error) { failure = error; throw error; }
  };
  return Object.assign(chat, { assertHealthy });
}
