import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  betweenTurnActionLabel,
  betweenTurnClock,
  betweenTurnDetailText,
  betweenTurnLogText,
  betweenTurnSurfaceLabel,
  buildBetweenTurnRows,
} from "@/editor/panels/aiBetweenTurnLogRows";
import { AI_UI_ACTIONS } from "@/ai/uiEventTypes";
import { listAiUiEvents, recordAiUiEvent, resetAiUiEventLogForTest } from "@/ai/uiEventLog";
import { createBetweenTurnLogSection } from "@/editor/panels/aiBetweenTurnLog";

const AT = "2026-10-05T05:00:00.000Z";

beforeEach(() => {
  const window = new Window();
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("localStorage", window.localStorage);
  vi.stubGlobal("Event", window.Event);
  vi.stubGlobal("Node", window.Node);
  resetAiUiEventLogForTest();
});
afterEach(() => {
  resetAiUiEventLogForTest();
  vi.unstubAllGlobals();
});

describe("턴 사이 기록 문장", () => {
  it("표면·동작을 사람이 읽는 이름으로 옮기고 모르는 값은 원문을 남긴다", () => {
    expect(betweenTurnSurfaceLabel("panel")).toBe("조수 패널");
    expect(betweenTurnSurfaceLabel("composer")).toBe("입력창");
    expect(betweenTurnSurfaceLabel("새-표면")).toBe("새-표면");
    expect(betweenTurnActionLabel("click:ai-more-menu-toggle")).toBe("클릭");
    expect(betweenTurnActionLabel("change:ai-box")).toBe("값 변경");
    expect(betweenTurnActionLabel(AI_UI_ACTIONS.turnRewind)).toBe("턴 되감기");
    expect(betweenTurnActionLabel("낯선 동작")).toBe("낯선 동작");
  });

  it("시각을 못 읽는 값은 지어내지 않고 원문을 그대로 보여 준다", () => {
    expect(betweenTurnClock(AT)).toHaveLength(8);
    expect(betweenTurnClock("어제")).toBe("어제");
  });

  it("상세는 자르되 자른 사실을 밝히고, 빈 상세는 만들지 않는다", () => {
    expect(betweenTurnDetailText(undefined)).toBeUndefined();
    expect(betweenTurnDetailText({})).toBeUndefined();
    expect(betweenTurnDetailText({ restored: 3 })).toBe('{"restored":3}');
    const clipped = betweenTurnDetailText({ text: "가".repeat(400) }) as string;
    expect(clipped.endsWith("자 생략]")).toBe(true);
  });
});

describe("턴 사이 기록 행", () => {
  function seed(): void {
    recordAiUiEvent({ surface: "panel", action: "click:ai-more-menu-toggle", testid: "ai-more-menu-toggle", label: "더보기", at: AT });
    recordAiUiEvent({
      surface: "panel", action: AI_UI_ACTIONS.turnRewind, testid: "ai-rewind",
      detail: { restored: 3 }, reason: "직전 지시로 되돌리기", at: AT, disabled: true,
    });
  }

  it("최신이 앞이고 같은 seq 는 한 번만 담는다", () => {
    seed();
    const events = listAiUiEvents();
    const rows = buildBetweenTurnRows([...events, events[0]!]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.actionLabel).toBe("턴 되감기");
    expect(rows[1]!.actionLabel).toBe("클릭");
  });

  it("이름·testid·이유·상세로 검색하고 limit 을 지킨다", () => {
    seed();
    const events = listAiUiEvents();
    expect(buildBetweenTurnRows(events, { query: "되감기" })).toHaveLength(1);
    expect(buildBetweenTurnRows(events, { query: "ai-more-menu-toggle" })).toHaveLength(1);
    expect(buildBetweenTurnRows(events, { query: "직전 지시" })).toHaveLength(1);
    expect(buildBetweenTurnRows(events, { query: "없는말" })).toHaveLength(0);
    expect(buildBetweenTurnRows(events, { limit: 1 })).toHaveLength(1);
  });

  it("행에는 대상·이유·상세·비활성 표시가 실린다", () => {
    seed();
    const rows = buildBetweenTurnRows(listAiUiEvents());
    expect(rows[0]).toMatchObject({ target: "ai-rewind", reason: "직전 지시로 되돌리기", detail: '{"restored":3}', disabled: true });
    expect(rows[1]!.target).toBe("더보기");
  });

  it("내보내기 글은 헤더와 행 문장을 담고 빈 목록도 밝힌다", () => {
    seed();
    const text = betweenTurnLogText(buildBetweenTurnRows(listAiUiEvents()), AT);
    expect(text.split("\n")[0]).toContain("조수 턴 사이 기록 · 2건");
    expect(text).toContain("턴 되감기");
    expect(text).toContain("이유: 직전 지시로 되돌리기");
    expect(text).toContain("비활성 상태");
    expect(betweenTurnLogText([], AT)).toContain("(기록 없음)");
  });
});

describe("턴 사이 기록 표면", () => {
  function open(): HTMLDetailsElement {
    const section = createBetweenTurnLogSection() as HTMLDetailsElement;
    document.body.append(section);
    recordAiUiEvent({ surface: "panel", action: "click:ai-more-menu-toggle", testid: "ai-more-menu-toggle", label: "더보기", at: AT });
    recordAiUiEvent({ surface: "composer", action: AI_UI_ACTIONS.instructionsSave, testid: "ai-instructions-save", reason: "지시문 저장", at: AT });
    section.open = true;
    section.dispatchEvent(new Event("toggle"));
    return section;
  }

  it("열면 이 브라우저에 남은 기록을 최신 순으로 보여 준다", () => {
    const section = open();
    const rows = section.querySelectorAll('[data-testid="ai-between-turns-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("지시문 저장");
    expect(rows[1]!.textContent).toContain("더보기");
    expect(section.querySelector('[data-testid="ai-between-turns-meta"]')?.textContent).toContain("2건");
    expect(section.querySelector<HTMLElement>('[data-testid="ai-between-turns-more"]')?.hidden).toBe(true);
  });

  it("검색은 행을 좁히고 결과 없음도 말한다", () => {
    const section = open();
    const search = section.querySelector('[data-testid="ai-between-turns-search"]') as HTMLInputElement;
    search.value = "더보기";
    search.dispatchEvent(new Event("input"));
    expect(section.querySelectorAll('[data-testid="ai-between-turns-row"]')).toHaveLength(1);
    search.value = "없는말";
    search.dispatchEvent(new Event("input"));
    expect(section.querySelector('[data-testid="ai-between-turns-list"]')?.textContent).toContain("검색 결과가 없어요.");
  });

  it("복사는 클립보드로 보이고 실패도 알린다", async () => {
    const section = open();
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    (section.querySelector('[data-testid="ai-between-turns-copy"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(String(writeText.mock.calls[0]?.[0])).toContain("조수 턴 사이 기록 · 2건");
    await vi.waitFor(() => expect(section.querySelector('[data-testid="ai-between-turns-status"]')?.textContent).toContain("복사했어요"));
    vi.stubGlobal("navigator", {});
    (section.querySelector('[data-testid="ai-between-turns-copy"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(section.querySelector('[data-testid="ai-between-turns-status"]')?.textContent).toContain("복사하지 못했어요"));
  });

  it("지우기는 이 브라우저의 기록만 비운다", () => {
    const section = open();
    (section.querySelector('[data-testid="ai-between-turns-clear"]') as HTMLButtonElement).click();
    expect(listAiUiEvents()).toHaveLength(0);
    expect(section.querySelectorAll('[data-testid="ai-between-turns-row"]')).toHaveLength(0);
    expect(section.querySelector('[data-testid="ai-between-turns-list"]')?.textContent).toContain("아직 턴 사이 기록이 없어요.");
  });
});
