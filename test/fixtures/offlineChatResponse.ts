import { once } from "node:events";
import { MessageChannel } from "node:worker_threads";
import type { ChatResult } from "@/ai/llmClient";

/** Model transport turn without network or timer-based scheduling luck. */
export async function offlineChatResponse(response: ChatResult): Promise<ChatResult> {
  const { port1, port2 } = new MessageChannel();
  const received = once(port2, "message", { signal: AbortSignal.timeout(5000) });
  try {
    port1.postMessage(response);
    const [delivered] = await received;
    return delivered as ChatResult;
  } finally {
    port1.close();
    port2.close();
  }
}
