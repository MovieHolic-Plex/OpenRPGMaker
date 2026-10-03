// src/editor/workshop/chat.ts
/**
 * 공방의 모델 호출 = 조수와 같은 엔드포인트(llmClient.chatCompletion), 표면 정책만 workshop-draw·workshop-review.
 * dev 빌드에서는 window.__oprnWorkshopChat 가 있으면 그것을 쓴다 — 모델 없이 화면을 찍는 QA 용(scripts/qa/workshop-capture.mjs).
 */
import { isAssistantEndpointReady, resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { chatCompletion, loadAiConfig } from "@/ai/llmClient";
import type { ChatFn } from "@/harnesses/_core/workshop/types";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";

export const WORKSHOP_FAKE_CHAT_KEY = "__oprnWorkshopChat";
/** 에셋 만들기 권장 모델 안내(사용자 결정 2026-10-02). 약한 모델은 3/4 시점·격자 크기를 자주 틀린다. */
export const WORKSHOP_MODEL_ADVICE = "에셋 만들기는 GPT-6.1 Sol(medium) 또는 Claude Sonnet 5.5 이상을 권장합니다. 더 약한 모델은 3/4 시점과 격자를 자주 틀립니다.";

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
    const result = await chatCompletion(resolveSurfaceAiConfig(surface, loadAiConfig()), request);
    const content = result.message.content;
    return typeof content === "string" ? content : (content ?? []).map((part) => (part.type === "text" ? part.text : "")).join("\n");
  };
}
