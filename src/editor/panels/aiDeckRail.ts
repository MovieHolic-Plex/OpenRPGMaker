// editor/panels/aiDeckRail.ts
// 데크 상단 상태 레일 — 점 · 「조수」 · 현재 맵 · 상태 문장 · 아이콘 슬롯.
//
// 왜 레일을 다시 두는가(2026-09-03 제안서 D1, 감독 승인): 2026-08-28 에 걷어낸 것은 73px 헤더
// 안의 48px 얼굴판이었다. 이 레일은 38px 이고 담는 것은 **상태**(점·문장·진행 헤어라인)와
// 진입점 아이콘뿐이다. 턴 진행·확인 필요·완료·오류가 같은 12px 회색 글자였던 결함을 여기서 푼다.
//
// 이 모듈은 상태를 소유하지 않는다. 패널이 `setState`/`setContext` 로 밀어넣고, 버튼은
// 컴포저가 만든 것을 `actions` 슬롯에 옮겨 넣는다(두 벌 생성 금지). 기존 `ai-status` 엘리먼트는
// `statusSlot` 에 그대로 들어가므로 testid 계약과 setStatus 배선이 바뀌지 않는다.

import { el } from "@/util/dom";
import type { AiStatusTone } from "./aiChatPanelHelpers";

export const DECK_STATES = ["idle", "run", "attention", "done", "error"] as const;
export type DeckState = (typeof DECK_STATES)[number];

export interface DeckRail {
  /** `div.ai-deck-rail[data-testid=ai-deck-rail][data-ai-state]` */
  readonly root: HTMLElement;
  /** 아이콘 버튼 슬롯 — 패널이 새 대화·이전 대화·성향·더보기·접기 버튼을 옮겨 넣는다. */
  readonly actions: HTMLElement;
  /** 상태 문장 슬롯 — 기존 `ai-status` 엘리먼트를 append 한다. */
  readonly statusSlot: HTMLElement;
  setContext(mapName: string | null): void;
  setState(state: DeckState): void;
}

const NAME = "AI";

/** 상태 배지 톤 → 데크 상태. 「확인 필요」 는 톤이 아니라 승인 대기 사실이므로 패널이 직접 setState 한다. */
export function deckStateOfTone(tone: AiStatusTone): DeckState {
  switch (tone) {
    case "idle":
      return "idle";
    case "running":
      return "run";
    case "ok":
      return "done";
    case "error":
      return "error";
    default:
      return assertNever(tone);
  }
}

function assertNever(value: never): never {
  throw new Error(`unknown status tone: ${String(value)}`);
}

export function createDeckRail(): DeckRail {
  const dot = el("span", { class: "ai-deck-rail-dot", attrs: { "aria-hidden": "true" }, dataset: { aiState: "idle" } });
  const ctx = el("span", { class: "ai-deck-rail-ctx", dataset: { testid: "ai-deck-rail-ctx" } });
  const statusSlot = el("span", { class: "ai-deck-rail-state" });
  const actions = el("div", { class: "ai-deck-rail-actions", attrs: { role: "toolbar", "aria-label": "AI 도구" } });
  const root = el("div", {
    class: "ai-deck-rail",
    dataset: { testid: "ai-deck-rail", aiState: "idle" },
    children: [
      el("div", {
        class: "ai-deck-rail-who",
        children: [dot, el("span", { class: "ai-deck-rail-name", text: NAME }), ctx],
      }),
      statusSlot,
      el("span", { class: "ai-deck-rail-spacer", attrs: { "aria-hidden": "true" } }),
      actions,
    ],
  });
  return {
    root,
    actions,
    statusSlot,
    setContext: (mapName) => {
      ctx.textContent = mapName ?? "";
    },
    setState: (state) => {
      root.dataset.aiState = state;
      dot.dataset.aiState = state;
    },
  };
}
