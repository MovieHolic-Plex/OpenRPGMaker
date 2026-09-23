import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActivityTrace, recordActivityEvent } from "@/ai/activityTrace";
import { createActivityView } from "@/editor/panels/aiActivityView";
import { isAiLiveCanvasEnabled, setAiLiveCanvasEnabled } from "@/editor/aiLiveCanvas";
import { createActivityLevelControl, getActivityLevel, setActivityLevel } from "@/editor/panels/aiActivityPreference";

beforeEach(() => {
  const window = new Window();
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("localStorage", window.localStorage);
  vi.stubGlobal("Event", window.Event);
  // el() 은 `child instanceof Node` 로 자식을 가른다 — document 만 바꾸면 Node 가 없어 전부 터졌다.
  vi.stubGlobal("Node", window.Node);
  setActivityLevel("brief");
  setAiLiveCanvasEnabled(true);
});
afterEach(() => {
  setAiLiveCanvasEnabled(true);
  vi.unstubAllGlobals();
});
const visibleText = (root: HTMLElement): string => {
  const notice = root.querySelector<HTMLElement>("p[role='status']");
  return `${root.querySelector(".ai-activity-entries")?.textContent ?? ""}\n${notice && !notice.hidden ? notice.textContent : ""}`;
};
describe("AI activity display levels", () => {
  it("defaults to brief and synchronizes existing main/member views without executing work", () => {
    expect(getActivityLevel()).toBe("brief");
    const main = createActivityView({ archive: false });
    const member = createActivityView({ archive: false });
    const control = createActivityLevelControl();
    document.body.append(main.root, member.root, control);
    let trace = createActivityTrace("조회");
    for (let i = 0; i < 12; i++) trace = recordActivityEvent(trace, { type: "tool_end", id: String(i), name: "get_map_region", ok: true, summary: "영역 확인" });
    main.update(trace); member.update(trace);
    expect(main.root.querySelectorAll(".ai-activity-entry").length).toBeLessThanOrEqual(4);
    setActivityLevel("trace");
    expect(main.root.querySelectorAll(".ai-activity-entry")).toHaveLength(12);
    expect(member.root.dataset.level).toBe("trace");
    expect(control.querySelector('[aria-pressed="true"]')?.getAttribute("data-activity-level")).toBe("trace");
    setActivityLevel("none");
    expect(main.root.hidden).toBe(true);
    setActivityLevel("detail");
    expect(main.root.hidden).toBe(false);
    expect(main.root.querySelectorAll(".ai-activity-entry")).toHaveLength(12);
  });

  it("toggles map construction visuals without changing the work log", () => {
    const control = createActivityLevelControl();
    document.body.append(control);
    const button = control.querySelector("[data-testid='ai-live-canvas']");
    expect(button?.getAttribute("aria-pressed")).toBe("true");
    expect(isAiLiveCanvasEnabled()).toBe(true);
    (button as HTMLButtonElement).click();
    expect(isAiLiveCanvasEnabled()).toBe(false);
    expect(button?.getAttribute("aria-pressed")).toBe("false");
    expect(getActivityLevel()).toBe("brief");
    (button as HTMLButtonElement).click();
    expect(isAiLiveCanvasEnabled()).toBe(true);
  });
  it("간단히 보기는 개발 용어·단계 번호·소요 시간 없이 하는 일만 말한다", () => {
    // 2026-09-23 실측 줄: `Ultrabrain · 계획`, `consult writer · 실행 중`, `시공 · 8.7초`,
    // `모델 응답 대기 · 6번째 단계`, `도구 찾기 · 2건 확인·처리`, `DB 읽기`, `타일셋 참고 읽기`.
    const view = createActivityView({ archive: false }); document.body.append(view.root);
    let trace = createActivityTrace("숲속 마을");
    trace = recordActivityEvent(trace, { type: "agent_spawn", agentId: "ultrabrain-plan", role: "orchestrator", mapId: null, mapName: null, task: "t", label: "Ultrabrain · 계획" });
    trace = recordActivityEvent(trace, { type: "agent_spawn", agentId: "map_a", role: "builder", mapId: "map_a", mapName: null, task: "t" });
    trace = recordActivityEvent(trace, { type: "tool_end", id: "f1", name: "find_tools", ok: true, summary: "도구 2개", durationMs: 8700 }, "map_a");
    trace = recordActivityEvent(trace, { type: "tool_end", id: "f2", name: "find_tools", ok: true, summary: "도구 1개", durationMs: 8700 }, "map_a");
    trace = recordActivityEvent(trace, { type: "tool_end", id: "d1", name: "get_database_records", ok: true, summary: "items 1건 / 1건" }, "map_a");
    trace = recordActivityEvent(trace, { type: "tool_start", id: "w1", name: "consult_writer", args: {} }, "map_a");
    trace = recordActivityEvent(trace, { type: "turn", index: 6 }, "map_a");
    view.update(trace);
    // 숨긴 필터·메타 줄(전체 기록 전용)은 빼고, 보이는 행과 안내 줄만 읽는다.
    const text = visibleText(view.root);
    expect(text).toContain("대사 쓰는 중");
    expect(text).toContain("생각하는 중");
    for (const jargon of ["Ultrabrain", "consult", "시공", "초", "번째 단계", "확인·처리", "DB", "items", "모델 응답 대기"]) expect(text).not.toContain(jargon);

    // 자세히 보기는 그대로 — 원래 이름·건수가 남는다.
    setActivityLevel("detail");
    const detail = visibleText(view.root);
    expect(detail).toContain("consult writer · 실행 중");
    expect(detail).toContain("DB 읽기");
  });

  it("간단히 보기는 조수가 회복한 도구 실패를 「실패」 로 적지 않고, 자세히 보기에는 남긴다", () => {
    const view = createActivityView({ archive: false }); document.body.append(view.root);
    let trace = createActivityTrace("스위치");
    trace = recordActivityEvent(trace, { type: "tool_end", id: "s1", name: "rename_switch", ok: false, summary: "번호 충돌" });
    view.update(trace);
    // 가장 최근 실패는 «다른 방법을 찾는 중» 으로, 빨간 표시 없이.
    expect(view.root.textContent).toContain("다른 방법을 찾는 중");
    expect(view.root.textContent).not.toContain("실패");
    expect(view.root.querySelector(".ai-activity-entry.is-error")).toBeNull();
    trace = recordActivityEvent(trace, { type: "tool_end", id: "s2", name: "rename_switch", ok: true, summary: "바꿈" });
    view.update(trace);
    expect(view.root.textContent).not.toContain("실패");
    expect(view.root.textContent).not.toContain("다른 방법을 찾는 중");
    expect(view.root.textContent).toContain("스위치 번호 바꾸기 · 완료");
    setActivityLevel("detail");
    expect(view.root.textContent).toContain("스위치 번호 바꾸기 · 실패");
  });

  it("keeps unchanged rows and open payloads while another tool completes", () => {
    setActivityLevel("trace");
    const view = createActivityView({ archive: false }); document.body.append(view.root);
    let trace = createActivityTrace("작업");
    trace = recordActivityEvent(trace, { type: "tool_end", id: "first", name: "get_event", ok: true, summary: "확인", result: { pages: 2 } });
    view.update(trace);
    const first = view.root.querySelector(".ai-activity-entry") as HTMLDetailsElement;
    first.open = true;
    trace = recordActivityEvent(trace, { type: "tool_end", id: "second", name: "find_events", ok: false, summary: "대상 없음" });
    view.update(trace);
    expect(view.root.querySelector(".ai-activity-entry")).toBe(first);
    expect(first.open).toBe(true);
  });
});
