import { el } from "@/util/dom";
import type { ConfirmOptions } from "@/editor/ui/modal";

/**
 * 카드가 어떻게 닫혔나. 버튼 말고도 입력창으로 닫힐 수 있다(아래 「열린 카드 대장」).
 * - button: 사용자가 카드 단추를 눌렀다.
 * - typed: 입력창에 카드 답으로 읽히는 짧은 말(「예」「그만」)을 보냈다.
 * - new-message: 카드에 답하지 않고 다른 요청을 보냈다 — 카드는 「그만두기」(내용 보존)로 닫힌다.
 */
export type AssistantDecisionVia = "button" | "typed" | "new-message";
export interface AssistantDecisionResult { readonly accepted: boolean; readonly via: AssistantDecisionVia }

/**
 * 열린 확인 카드 대장 — 조수 실행이 사람 답을 기다리며 멈춘 자리.
 *
 * 왜: 카드가 열린 실행은 그 맵(또는 프로젝트 전체)을 잡고 있다. 사용자가 단추 대신 입력창에 다음 말을 치면
 * 그 말은 맵별 대기열에서 카드 주인 뒤에 줄을 서고, 카드 주인은 단추를 기다리다 워커의 30분 적용 대기
 * (scripts/lib/piCheckpointBroker.ts)로 죽었다 — 둘이 서로를 기다렸다. 실측 2026-10-29 vm1 argon escape·jrpg 3→4턴:
 * 「맵 1개 삭제」 카드에 글로 답해 checkpoint 2,718,068ms, 다음 턴 45분 상한.
 * 그래서 보내기(aiChatPanel send)가 먼저 이 대장을 보고 카드를 닫는다 — 답으로 읽히면 답으로, 아니면 「그만두기」로.
 */
export interface OpenAssistantDecision {
  readonly title: string;
  /** 카드 주인 실행이 잡은 맵 키(aiMapRunQueue mapKey). "*" = 프로젝트 전체를 잡은 실행. 없으면 앞 턴(패널) 카드다. */
  readonly runKey?: string;
  /** 카드 주인 실행이 잡은 드래그 영역. 안 겹치는 영역 요청은 이 카드를 닫지 않는다. */
  readonly region?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** 카드를 연 대화(스레드) id. 없으면 옛 호출자 — 어느 스레드의 보내기든 붙잡는다. */
  readonly threadId?: string;
  readonly openedAt: number;
  answer(accepted: boolean, via: Exclude<AssistantDecisionVia, "button">): void;
}
const openDecisions = new Set<OpenAssistantDecision>();
const decisionListeners = new Set<() => void>();
function emitDecisionChange(): void {
  for (const listener of [...decisionListeners]) {
    try { listener(); } catch (error) { console.warn("[aiDecisionPrompt] listener", error); }
  }
}
export function registerAssistantDecision(decision: OpenAssistantDecision): () => void {
  openDecisions.add(decision);
  emitDecisionChange();
  return () => { if (openDecisions.delete(decision)) emitDecisionChange(); };
}
/** 카드가 열리거나 닫힐 때마다 부른다 — 왼쪽 스레드 목록의 「확인 필요」(aiThreadList). */
export function subscribeAssistantDecisions(listener: () => void): () => void {
  decisionListeners.add(listener);
  return () => { decisionListeners.delete(listener); };
}
/** 열린 카드들, 오래된 것부터. */
export function openAssistantDecisions(): readonly OpenAssistantDecision[] {
  return [...openDecisions].sort((a, b) => a.openedAt - b.openedAt);
}
/**
 * 새 요청(맵 키 mapKey, 프로젝트 전체면 exclusive)을 붙잡아 둘 카드 — 같은 맵·프로젝트 전체 실행·앞 턴 카드.
 * threadId 를 주면 그 스레드의 카드와 스레드 id 가 없는(옛) 카드만 본다 — 다른 스레드의 카드는 그 스레드가 답한다.
 */
export function blockingAssistantDecisions(
  mapKey: string,
  exclusive: boolean,
  threadId?: string,
  region?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): readonly OpenAssistantDecision[] {
  return openAssistantDecisions().filter(d => {
    if (threadId !== undefined && d.threadId !== undefined && d.threadId !== threadId) return false;
    if (exclusive || d.runKey === undefined || d.runKey === "*") return true;
    if (d.runKey !== mapKey) return false;
    if (region && d.region) {
      return region.x < d.region.x + d.region.width && d.region.x < region.x + region.width
        && region.y < d.region.y + d.region.height && d.region.y < region.y + region.height;
    }
    return true;
  });
}

const YES = ["예", "네", "넵", "넹", "응", "웅", "어", "그래", "그래요", "좋아", "좋아요", "확인", "진행", "진행해", "진행해줘",
  "지워", "지워줘", "지워도돼", "지워도좋아", "삭제", "삭제해", "삭제해줘", "비워", "비워줘", "ㅇㅇ", "ㅇㅋ", "ok", "okay", "yes", "y"];
const NO = ["아니", "아니요", "아니오", "아뇨", "아니야", "아냐", "그만", "그만둬", "그만해", "그만두기", "취소", "취소해", "하지마", "지우지마",
  "삭제하지마", "비우지마", "안돼", "안되", "놔둬", "그대로둬", "ㄴㄴ", "no", "n", "nope", "cancel"];
/**
 * 입력창 문장이 열린 카드의 답인가. 짧은 말 전체가 정해진 답 낱말과 같을 때만 답이다 — 「좋아, 그런데 성도 지어 줘」처럼
 * 다른 요청이 섞인 문장은 답이 아니라 새 요청이다(그때 카드는 그만두기로 닫힌다). null = 답 아님.
 */
export function readDecisionAnswer(text: string): boolean | null {
  const raw = text.normalize("NFC").toLowerCase().replace(/\s+/gu, "").replace(/[.!~?,…·ㅋㅎ]+$/gu, "");
  if (!raw || raw.length > 12) return null;
  // 「지워요」「그만해요」 — 끝의 「요」 하나는 떼고도 본다.
  for (const candidate of [raw, raw.replace(/요$/u, "")]) {
    if (YES.includes(candidate)) return true;
    if (NO.includes(candidate)) return false;
  }
  return null;
}

/** A decision pauses its owner, without a modal, focus grab or editor input lock. */
export function requestAssistantDecision(surface: DecisionSurface, options: ConfirmOptions): Promise<boolean> {
  return requestAssistantDecisionDetailed(surface, options).then(result => result.accepted);
}

interface DecisionSurface {
  appendCard(element: HTMLElement): void;
  appendReviewPrompt?: (element: HTMLElement) => void;
  setStatus(text: string): void;
  readonly signal?: AbortSignal;
  /** 카드 주인 실행이 잡은 맵 키 — 보내기가 이 카드가 새 요청을 붙잡는지 판단한다. */
  readonly runKey?: string;
  /** 카드 주인 실행이 잡은 드래그 영역. */
  readonly region?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** 카드를 연 대화(스레드) id. */
  readonly threadId?: string;
}

/** 어떻게 닫혔는지까지 돌려준다 — 새 메시지로 닫힌 거절은 조수에게 그렇게 알린다(aiPiPublication). */
export function requestAssistantDecisionDetailed(surface: DecisionSurface, options: ConfirmOptions): Promise<AssistantDecisionResult> {
  surface.signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    let settled = false;
    let unregister = () => {};
    const finish = (accepted: boolean, via: AssistantDecisionVia) => {
      if (settled) return;
      settled = true;
      unregister();
      surface.signal?.removeEventListener("abort", abort);
      root.remove();
      resolve({ accepted, via });
    };
    const abort = () => {
      if (settled) return;
      settled = true; unregister(); root.remove();
      surface.signal?.removeEventListener("abort", abort);
      reject(surface.signal?.reason ?? new DOMException("작업이 중단됐어요", "AbortError"));
    };
    const root = el("section", {
      class: `ai-pending-review${options.danger ? " is-danger" : ""}`, dataset: { testid: "ai-decision-prompt" },
      attrs: { "aria-label": "답변 필요" },
      children: [
        el("p", { children: [el("strong", { text: `답변 필요${options.title ? ` · ${options.title}` : ""}` })] }),
        el("p", { text: options.message }),
        el("p", { class: "ai-chat-decision-hint", text: "입력창에 「예」·「그만」으로 답해도 돼요. 다른 요청을 보내면 이 카드는 그만두기로 닫혀요." }),
        el("div", { class: "ai-pending-review-actions", children: [
          el("button", { text: options.confirmLabel ?? "확인", attrs: { type: "button" },
            dataset: { testid: "ai-decision-confirm" }, on: { click: () => finish(true, "button") } }),
          el("button", { text: options.cancelLabel ?? "취소", attrs: { type: "button" },
            dataset: { testid: "ai-decision-cancel" }, on: { click: () => finish(false, "button") } }),
        ] }),
      ],
    });
    surface.signal?.addEventListener("abort", abort, { once: true });
    surface.setStatus("답변 필요");
    try { (surface.appendReviewPrompt ?? surface.appendCard)(root); }
    catch (error) { root.remove(); surface.signal?.removeEventListener("abort", abort); settled = true; reject(error); return; }
    unregister = registerAssistantDecision({
      title: options.title ?? "확인",
      ...(surface.runKey !== undefined ? { runKey: surface.runKey } : {}),
      ...(surface.region !== undefined ? { region: surface.region } : {}),
      ...(surface.threadId !== undefined ? { threadId: surface.threadId } : {}),
      openedAt: Date.now(),
      answer: (accepted, via) => finish(accepted, via),
    });
  });
}
