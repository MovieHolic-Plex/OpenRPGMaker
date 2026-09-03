import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDeckRail, deckStateOfTone } from "@/editor/panels/aiDeckRail";
import { installFakeDom } from "./fakeDom";

describe("aiDeckRail — 데크 상태 레일", () => {
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it("이름은 「조수」 이고 헤더·얼굴 클래스는 되살리지 않는다", () => {
    // Break: 레일이 .ai-chat-header / .ai-director-* 이름을 다시 쓰면 aiPanelChrome 계약과 충돌한다.
    const rail = createDeckRail();
    expect(rail.root.dataset.testid).toBe("ai-deck-rail");
    expect(rail.root.querySelector(".ai-deck-rail-name")?.textContent).toBe("조수");
    expect(rail.root.querySelector(".ai-chat-header")).toBeNull();
    expect(rail.root.querySelector(".ai-director-name")).toBeNull();
    expect(rail.root.querySelector(".ai-director-face")).toBeNull();
  });

  it("맵 맥락은 setContext 로 바뀌고 없으면 비운다", () => {
    // Break: 맵 이름이 갱신되지 않거나 null 에 「null」 글자가 남는다.
    const rail = createDeckRail();
    rail.setContext("시장 마을");
    expect(rail.root.querySelector(".ai-deck-rail-ctx")?.textContent).toBe("시장 마을");
    rail.setContext(null);
    expect(rail.root.querySelector(".ai-deck-rail-ctx")?.textContent).toBe("");
  });

  it("상태는 data-ai-state 하나로 점과 문장 톤이 함께 움직인다", () => {
    // Break: 점 클래스만 바뀌고 dataset 이 안 바뀌면 CSS 헤어라인·알약이 어긋난다.
    const rail = createDeckRail();
    expect(rail.root.dataset.aiState).toBe("idle");
    rail.setState("run");
    expect(rail.root.dataset.aiState).toBe("run");
    const dot = rail.root.querySelector(".ai-deck-rail-dot");
    expect(dot?.dataset.aiState).toBe("run");
    rail.setState("attention");
    expect(rail.root.dataset.aiState).toBe("attention");
    expect(dot?.dataset.aiState).toBe("attention");
  });

  it("액션 슬롯은 비어 있고 상태 슬롯은 기존 ai-status 를 받을 자리다", () => {
    // Break: 레일이 버튼을 스스로 만들면 컴포저와 두 벌이 된다 — 슬롯만 제공해야 한다.
    const rail = createDeckRail();
    expect(rail.actions.childNodes.length).toBe(0);
    const status = document.createElement("span");
    status.dataset.testid = "ai-status";
    rail.statusSlot.append(status);
    expect(rail.root.querySelector("[data-testid='ai-status']")).toBe(status);
  });

  it("상태 톤(idle/running/ok/error) → 데크 상태 사상 — 확인 필요는 톤이 아니라 패널이 직접 setState 한다", () => {
    // Break: 새 톤이 idle 로 조용히 떨어져 진행·확인 필요가 회색으로 보인다.
    expect(deckStateOfTone("idle")).toBe("idle");
    expect(deckStateOfTone("running")).toBe("run");
    expect(deckStateOfTone("ok")).toBe("done");
    expect(deckStateOfTone("error")).toBe("error");
  });
});
