/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 톱바 AI 연결 칩의 계약.
 *
 * 실측 배경(2026-09-22): 연결 상태를 계산하는 코드는 있었지만 **상시 보여주는 자리가 없었다.**
 * 하단 상태바 폐지로 호스트를 잃었고, 편집기 첫 화면 어디에도 "연결됨"·"확인 중"·"ChatGPT"
 * 문자열이 0건이었다. 사용자는 첫 문장을 보내고 나서야 — "의도 읽는 중…" 에서 멈춘 뒤에야 — 알았다.
 */
const refreshMock = vi.fn(async () => undefined);

vi.mock("@/editor/panels/aiConnectionStatus", () => ({
  getAiConnectionStatus: () => currentStatus,
  refreshAiConnectionStatus: (onChange?: () => void) => refreshMock(onChange),
}));

let currentStatus: { kind: string; label: string; title: string; authMode: string; providerId: string; providerLabel: string } = {
  kind: "disconnected",
  label: "Google 로그인 필요",
  title: "AI 기능을 쓰려면 로그인이 필요해요.",
  authMode: "chatgpt",
  providerId: "antigravity",
  providerLabel: "Google",
};

const { renderAiConnectionChip, AI_CONNECTION_CHIP_TESTIDS } = await import("@/editor/panels/aiConnectionChip");

function mount(openSettings = () => undefined) {
  const chip = renderAiConnectionChip(openSettings);
  document.body.append(chip.element);
  return chip;
}

beforeEach(() => {
  document.body.innerHTML = "";
  refreshMock.mockClear();
});

describe("AI 연결 칩", () => {
  it("마운트되면 즉시 상태를 칠한다", () => {
    const chip = mount();
    const label = chip.element.querySelector(`[data-testid='${AI_CONNECTION_CHIP_TESTIDS.label}']`);
    // refreshAiConnectionStatus 는 chatgpt 가 아니면 콜백을 안 부른다 — 초기 칠을 그 콜백에
    // 기대면 칩이 빈 채로 남는다(실측: text:"").
    expect(label?.textContent).toBe("Google 로그인 필요");
    expect(chip.element.dataset.kind).toBe("disconnected");
  });

  it("ready 가 아니면 누를 수 있고 설정을 연다", () => {
    const opened: string[] = [];
    const chip = mount(() => opened.push("settings"));
    expect(chip.element.classList.contains("is-actionable")).toBe(true);
    (chip.element as HTMLButtonElement).click();
    expect(opened).toEqual(["settings"]);
  });

  it("ready 면 눌러도 설정을 열지 않는다 — 열어도 할 게 없다", () => {
    currentStatus = { ...currentStatus, kind: "ready", label: "Google 연결됨", title: "연결됨" };
    const opened: string[] = [];
    const chip = mount(() => opened.push("settings"));
    expect(chip.element.classList.contains("is-actionable")).toBe(false);
    (chip.element as HTMLButtonElement).click();
    expect(opened).toEqual([]);
    currentStatus = { ...currentStatus, kind: "disconnected", label: "Google 로그인 필요" };
  });

  it("상태별로 다음 행동을 title 에 담는다", () => {
    const chip = mount();
    const title = chip.element.getAttribute("title") ?? "";
    // "로그인이 필요해요" 만으로는 어디를 눌러야 하는지 모른다 — 다음 행동을 말해야 한다.
    expect(title).toContain("AI 설정에서 로그인하세요");
    expect(chip.element.getAttribute("aria-label")).toContain("AI 설정에서 로그인하세요");
  });

  it("확인 중과 ready 를 다른 kind 로 구분한다", () => {
    currentStatus = { ...currentStatus, kind: "checking", label: "Google 확인 중…" };
    const chip = mount();
    expect(chip.element.dataset.kind).toBe("checking");
    // 확인 중에도 할 일이 있다 — 기다리라고 말해야 "영영 멈춘 것" 과 구분된다.
    expect(chip.element.getAttribute("title")).toContain("확인하는 중");
    currentStatus = { ...currentStatus, kind: "disconnected" };
  });
});

