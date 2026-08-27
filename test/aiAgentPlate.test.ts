import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import {
  AGENT_DISPLAY_NAME,
  agentPresenceFromStatus,
  agentPresenceLabel,
  renderAgentCollapsedRestore,
  renderAgentPlate,
} from "@/editor/panels/aiAgentPlate";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  store.replace(createBlankProject());
  editorState.set({
    currentMapId: store.getCurrent().startMapId,
    selection: null,
  });
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

describe("agentPresenceFromStatus", () => {
  it("대기/새 대화는 보고 있음으로 읽는다", () => {
    expect(agentPresenceFromStatus("대기")).toBe("watching");
    expect(agentPresenceFromStatus("새 대화")).toBe("watching");
    expect(agentPresenceLabel("watching")).toBe("보고 있음");
  });

  it("실행·계획 문구는 작업 중으로 읽는다", () => {
    expect(agentPresenceFromStatus("실행 중")).toBe("working");
    expect(agentPresenceFromStatus("계획 중")).toBe("working");
    expect(agentPresenceFromStatus("영역 작업 중…")).toBe("working");
    expect(agentPresenceLabel("working")).toBe("작업 중");
  });

  it("검토/제안 대기는 수락 대기로 읽는다", () => {
    expect(agentPresenceFromStatus("검토 대기")).toBe("awaiting");
    expect(agentPresenceFromStatus("변경 제안 1건 대기")).toBe("awaiting");
    expect(agentPresenceLabel("awaiting")).toBe("수락 대기");
  });

  it("오류 문구는 오류로 읽는다", () => {
    expect(agentPresenceFromStatus("오류")).toBe("error");
    expect(agentPresenceFromStatus("API 키 오류")).toBe("error");
    expect(agentPresenceLabel("error")).toBe("오류");
  });
});

describe("renderAgentPlate", () => {
  it("얼굴·이름·상태 플레이트를 그린다", () => {
    const plate = renderAgentPlate({ statusText: "대기" });
    expect(plate.element.dataset.testid).toBe("ai-agent-plate");
    expect(plate.titleEl.tagName).toBe("H2");
    expect(plate.titleEl.textContent).toBe(AGENT_DISPLAY_NAME);
    expect(plate.face.dataset.testid).toBe("ai-agent-face");
    expect(findByTestId(plate.element as unknown as FakeElement, "ai-agent-status")?.textContent).toBe("보고 있음");
  });

  it("상태 문구를 바꾸면 플레이트 한 줄이 따라간다", () => {
    const plate = renderAgentPlate({ statusText: "대기" });
    plate.setStatus("실행 중");
    expect(findByTestId(plate.element as unknown as FakeElement, "ai-agent-status")?.textContent).toBe("작업 중");
  });

  it("브리프 한 줄을 플레이트에 붙인다", () => {
    const plate = renderAgentPlate({ statusText: "대기" });
    expect(findByTestId(plate.element as unknown as FakeElement, "ai-agent-brief")?.textContent).toBe("");
    plate.setBrief("빈 맵 20×15 · 하위 · 펜");
    expect(findByTestId(plate.element as unknown as FakeElement, "ai-agent-brief")?.textContent).toBe("빈 맵 20×15 · 하위 · 펜");
  });
});

describe("renderAgentCollapsedRestore", () => {
  it("접힌 복귀는 AI 워드마크 대신 얼굴을 둔다", () => {
    const restore = renderAgentCollapsedRestore();
    expect(restore.getAttribute("aria-label")).toBe("AI 어시스턴트");
    expect(restore.querySelector(".ai-collapsed-restore-wordmark")).toBeNull();
    expect(restore.querySelector("[data-testid='ai-agent-face']")).toBeTruthy();
    expect(restore.querySelectorAll("[data-testid='ai-agent-face']")).toHaveLength(1);
    expect(restore.querySelector(".ai-collapsed-restore-dot")).toBeTruthy();
  });
});

describe("AI 패널에 심은 플레이트", () => {
  it("펼친 헤더가 감독 플레이트이고 제목 클릭으로 접히지 않는다", () => {
    const panel = renderWithFakeDom(() => renderAiChatPanel());
    const plate = findByTestId(panel, "ai-agent-plate");
    const title = findByTestId(panel, "ai-agent-name");
    expect(plate).toBeTruthy();
    expect(title?.textContent).toBe(AGENT_DISPLAY_NAME);
    title?.click();
    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(findByTestId(panel, "ai-agent-brief")?.textContent).toMatch(/빈 맵/);
    expect(findByTestId(panel, "ai-start-looking-at")?.textContent).toMatch(/지금 빈 맵/);
    expect(findByTestId(panel, "ai-input")?.getAttribute("placeholder")).toMatch(/이 맵에 지시/);
  });
});
