// src/editor/workshop/chat.ts
/**
 * 공방의 모델 호출 = 조수와 같은 엔드포인트(llmClient.chatCompletion), 표면 정책만 workshop-draw·workshop-review.
 * dev 빌드에서는 window.__oprnWorkshopChat 가 있으면 그것을 쓴다 — 모델 없이 화면을 찍는 QA 용(scripts/qa/workshop-capture.mjs).
 */
import { isAssistantEndpointReady, resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { chatCompletion, loadAiConfig } from "@/ai/llmClient";
import type { ChatFn } from "@/harnesses/_core/workshop/types";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";

/** 공방 도트 그리기 한 번의 상한 — 일반 요청 180초의 세 배. */
export const WORKSHOP_DRAW_TIMEOUT_MS = 540_000;

export const WORKSHOP_FAKE_CHAT_KEY = "__oprnWorkshopChat";

function fakeChat(): ChatFn | null {
  if (!import.meta.env.DEV) return null;
  const candidate = (window as unknown as Record<string, unknown>)[WORKSHOP_FAKE_CHAT_KEY];
  return typeof candidate === "function" ? (candidate as ChatFn) : null;
}

export function workshopAiReady(): boolean {
  if (fakeChat()) return true;
  const config = loadAiConfig();
  return isAssistantEndpointReady(config, getAiConnectionStatus(config));
}

export function createWorkshopChat(): ChatFn {
  return async (surface, request) => {
    const fake = fakeChat();
    if (fake) return fake(surface, request);
    // 도트 그리기 응답은 격자 전체를 한 번에 써서 수 분 걸린다 — 일반 상한 180초에 끊기지 않게(G10).
    const timed = surface === "workshop-draw" && request.timeoutMs === undefined ? { ...request, timeoutMs: WORKSHOP_DRAW_TIMEOUT_MS } : request;
    const result = await chatCompletion(resolveSurfaceAiConfig(surface, loadAiConfig()), timed);
    const content = result.message.content;
    return typeof content === "string" ? content : (content ?? []).map((part) => (part.type === "text" ? part.text : "")).join("\n");
  };
}
