// src/editor/workshop/queue/chatHooks.ts
/**
 * 공방 모델 호출의 앞뒤 고리 — 세션(workshopSession)이 채팅 함수를 이것으로 감싸고, 작업 줄(workshopQueue)이 채운다.
 * 둘이 서로를 import 하지 않게 하는 작은 판(순환 import 방지).
 * - before: 호출 직전. 던지면 호출하지 않는다 — 계정 한도로 멈춘 동안 다른 작업이 공급자를 두드리지 않게(로컬 대기),
 *   dev 에서는 한도 막힘 흉내(__oprnWorkshopQueue.fault429)도 여기서 던진다.
 * - after: 호출이 끝난 뒤(작업별 호출 수·시간표).
 */
import type { ChatCallMeta, ChatFn, WorkshopSurface } from "@/harnesses/_core/workshop/types";

export type ChatHooks = {
  before?: (surface: WorkshopSurface, meta: ChatCallMeta | undefined) => void | Promise<void>;
  after?: (surface: WorkshopSurface, meta: ChatCallMeta | undefined, outcome: { ok: boolean; status?: number; ms: number }) => void;
};

export const workshopChatHooks: ChatHooks = {};

/** 오류를 status 와 함께 만든다(엔진의 429·401 판정이 읽는다). */
export function statusError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

export function withChatHooks(base: ChatFn): ChatFn {
  return async (surface, request, meta) => {
    // 기다려야 한다 — 안 기다리면 계정 대기가 호출을 막지 못하고, 던진 고장은 처리되지 않은 거부로 샌다(2026-10-21 실측).
    await workshopChatHooks.before?.(surface, meta);
    const started = Date.now();
    try {
      const text = await base(surface, request, meta);
      workshopChatHooks.after?.(surface, meta, { ok: true, ms: Date.now() - started });
      return text;
    } catch (error) {
      const status = (error as { status?: unknown } | null)?.status;
      workshopChatHooks.after?.(surface, meta, { ok: false, status: typeof status === "number" ? status : undefined, ms: Date.now() - started });
      throw error;
    }
  };
}
