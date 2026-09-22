/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AI 미연결 잠금 막의 계약.
 *
 * 실측 배경(2026-09-22): placeholder 문구와 톱바 칩만으로는 부족했다. 그건 **읽어야 아는**
 * 신호라, 사용자는 지시를 쓰고 보낸 뒤에야 막힌다는 걸 알았다. 이 앱에서 AI 는 핵심
 * 시스템이므로 없으면 그 자리가 비어 보여야 한다.
 */
const state = { ready: false };

vi.mock("@/ai/llmClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai/llmClient")>();
  return { ...actual, loadAiConfig: () => actual.defaultAiConfig() };
});
vi.mock("@/editor/panels/aiChatPanelHelpers", () => ({ isAiConfigReady: () => state.ready }));
vi.mock("@/editor/panels/aiConnectionStatus", () => ({
  getAiConnectionStatus: () => ({ kind: state.ready ? "ready" : "disconnected" }),
  // revalidate 가 캐시를 새로 읽는 경로 — mock 에서는 동기적으로 콜백만 부른다.
  refreshAiConnectionStatus: async (onChange?: () => void) => { onChange?.(); },
}));

const { createAiLockScrim, AI_LOCK_SCRIM_TESTIDS } = await import("@/editor/panels/aiLockScrim");

beforeEach(() => {
  state.ready = false;
});

describe("AI 미연결 잠금 막", () => {
  it("미연결이면 덮고, 다음 행동을 버튼으로 준다", () => {
    const scrim = createAiLockScrim({ onOpenSettings: () => undefined });
    expect(scrim.sync()).toBe(true);
    expect(scrim.element.hidden).toBe(false);
    expect(scrim.element.textContent).toContain("AI 연결이 필요합니다");
    // "필요합니다" 만으로는 어디를 눌러야 하는지 모른다 — 버튼이 있어야 한다.
    expect(scrim.element.querySelector(`[data-testid='${AI_LOCK_SCRIM_TESTIDS.action}']`)?.textContent)
      .toContain("AI 연결하기");
  });

  it("연결되면 걷는다 — 멀쩡한 사용자를 가두면 안 된다", () => {
    const scrim = createAiLockScrim({ onOpenSettings: () => undefined });
    state.ready = true;
    expect(scrim.sync()).toBe(false);
    expect(scrim.element.hidden).toBe(true);
  });

  it("버튼이 설정 열기를 부른다", () => {
    const opened: string[] = [];
    const scrim = createAiLockScrim({ onOpenSettings: () => opened.push("settings") });
    scrim.sync();
    scrim.element.querySelector<HTMLButtonElement>(`[data-testid='${AI_LOCK_SCRIM_TESTIDS.action}']`)!.click();
    expect(opened).toEqual(["settings"]);
  });

  it("잠금이 풀리면 바깥 표면에도 알린다 — 패널 클래스가 갈라지면 안 된다", () => {
    const seen: boolean[] = [];
    const scrim = createAiLockScrim({ onOpenSettings: () => undefined, onLockChange: (l) => seen.push(l) });
    scrim.sync();
    state.ready = true;
    scrim.sync();
    expect(seen).toEqual([true, false]);
  });

  it("설정 모달이 닫히면 스스로 다시 판정한다 — 로그인 후 한 단계를 없앤다", async () => {
    const { AI_SETTINGS_CLOSED_EVENT } = await import("@/editor/panels/aiSettingsModal");
    const scrim = createAiLockScrim({ onOpenSettings: () => undefined });
    document.body.append(scrim.element);
    expect(scrim.sync()).toBe(true);
    expect(scrim.element.hidden).toBe(false);

    // 로그인을 마치고 모달이 닫힌 순간 — 사용자가 막을 다시 누르지 않아도 걷혀야 한다.
    state.ready = true;
    window.dispatchEvent(new CustomEvent(AI_SETTINGS_CLOSED_EVENT));
    expect(scrim.element.hidden).toBe(true);
  });

  it("dispose 뒤에는 닫힘 이벤트에 반응하지 않는다", async () => {
    const { AI_SETTINGS_CLOSED_EVENT } = await import("@/editor/panels/aiSettingsModal");
    const scrim = createAiLockScrim({ onOpenSettings: () => undefined });
    scrim.sync();
    scrim.dispose();
    state.ready = true;
    window.dispatchEvent(new CustomEvent(AI_SETTINGS_CLOSED_EVENT));
    // 리스너가 남아 있으면 걷혔을 것이다 — dispose 가 실제로 떼어냈는지 본다.
    expect(scrim.element.hidden).toBe(false);
  });
});
