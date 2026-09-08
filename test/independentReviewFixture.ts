import type { ChatRequest, ChatResult } from "@/ai/llmClient";
import type { ReviewInput } from "@/ai/independentReview";

/** Deterministic protocol fixture. Production validation still overrides failed checks. */
export function independentReviewPayload(request: ChatRequest): ReviewInput | null {
  const content = request.messages[1]?.content;
  const first = Array.isArray(content) ? content.find(part => part.type === "text") : null;
  if (first?.type !== "text") return null;
  const value = JSON.parse(first.text) as ReviewInput & { kind?: string };
  return value.kind === "independent-review" ? value : null;
}
/** Wire positions acknowledged by this scripted transport, never inferred by production. */
export function imageDeliveryForRequest(request: ChatRequest) {
  return request.messages.flatMap((message, messageIndex) => Array.isArray(message.content)
    ? message.content.flatMap((part, partIndex) => part.type === "image_url" ? [{ messageIndex, partIndex }] : []) : []);
}
export function approvedReviewResponse(request: ChatRequest): ChatResult | null {
  const input = independentReviewPayload(request);
  return input ? { imageDelivery: imageDeliveryForRequest(request), message: { role: "assistant", content: JSON.stringify({ revision: input.revision,
    verdict: "approved", summary: "Fixture review", findings: [] }) }, finishReason: "stop" } : null;
}
export const approvedReview = { status: "approved", revision: 1, summary: "Fixture review", findings: [] } as const;
