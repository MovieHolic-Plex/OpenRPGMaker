/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { clearCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { resetEventViewSession } from "@/editor/panels/eventEditor/storyboardView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const EVENT_ID = "ev_page_preview";
let pageSequence = 0;

function seedProject(): string {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const pageId = `preview-${++pageSequence}`;
  project.maps[mapId]!.events = [
    {
      id: EVENT_ID,
      x: 3,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: pageId,
          name: "안내인",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [
            { kind: "text", body: "어서 오세요." },
            { kind: "setSwitch", switchId: "sw_met", value: true },
          ],
        },
      ],
    },
  ];
  store.replace(project);
  editorState.set({ currentMapId: mapId, selectedEventId: EVENT_ID, selectedEventPageId: pageId });
  return mapId;
}

function click(host: HTMLElement, testId: string): void {
  const button = host.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!button) throw new Error(`missing control ${testId}`);
  button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

// 「미리보기」 보기 방식(명령 컬럼 안 `event-page-preview-host`)은 PR #3211 이후 없다. 같은 무대는
// 인스펙터 컬럼(`event-editor-inspector`)이 항상 먼저 보여 준다(content.ts setCommandInspectorHost).
// 아래 케이스는 그 새 상태를 단언한다 — 토글은 목록/스토리/플로우 셋뿐이다.
describe("이 페이지가 하는 일 — 인스펙터의 미리보기", () => {
  let host: HTMLElement;

  beforeEach(() => {
    clearCommandInspector();
    localStorage.clear();
    // 보기 모드는 세션에도 있다 — localStorage.clear() 만으로는 안 지워진다.
    resetEventViewSession();
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    clearCommandInspector();
    host.remove();
  });

  it("보기 토글에는 미리보기가 없고, 무대는 인스펙터 컬럼이 그린다", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);

    const canvas = host.querySelector<HTMLElement>('[data-testid="event-script-canvas"]');
    const inspector = host.querySelector<HTMLElement>('[data-testid="event-editor-inspector"]');
    expect(canvas?.querySelector('[data-testid="event-view-toggle-preview"]')).toBeNull();
    expect(canvas?.querySelector('[data-testid="event-page-preview-host"]')).toBeNull();
    expect(inspector?.hidden).toBe(false);
    expect(inspector?.querySelector('[data-testid="event-page-preview"]')).toBeTruthy();
    expect(inspector?.querySelector('[data-testid="event-script-live-stage"]')?.textContent).toContain("어서 오세요.");
  });

  it("이전/다음이 무대와 단계 위치를 옮긴다", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);

    const caption = () => host.querySelector<HTMLElement>('[data-testid="event-script-live-caption"]')?.textContent ?? "";
    const position = () => host.querySelector<HTMLElement>(".event-script-live-position")?.textContent ?? "";
    expect(position()).toBe("1/2");
    const first = caption();

    click(host, "event-script-live-next");
    expect(position()).toBe("2/2");
    expect(caption()).not.toBe(first);

    click(host, "event-script-live-prev");
    expect(position()).toBe("1/2");
    expect(caption()).toBe(first);
  });

  it("keeps the selected tab focused through actual parent view replacement", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    host.querySelector<HTMLElement>('[data-testid="event-view-toggle-list"]')!.focus();
    for (const [key, mode] of [
      ["ArrowRight", "storyboard"], ["ArrowRight", "flow"], ["ArrowRight", "list"],
      ["End", "flow"], ["Home", "list"], ["ArrowLeft", "flow"], ["ArrowLeft", "storyboard"],
    ]) {
      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      const selected = host.querySelector<HTMLElement>(`[data-testid="event-view-toggle-${mode}"]`)!;
      expect(document.activeElement).toBe(selected);
      expect(selected.isConnected).toBe(true);
      expect(selected.getAttribute("aria-selected")).toBe("true");
      expect(host.querySelectorAll('[data-testid="event-view-toggle"] [role="tab"][tabindex="0"]')).toHaveLength(1);
    }
  });

  it("does not steal outside focus when a view refresh is not keyboard activation", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    const input = host.querySelector<HTMLInputElement>(".event-editor-command-search")!;
    input.focus();
    click(host, "event-view-toggle-storyboard");
    expect(document.activeElement).toBe(input);
    click(host, "event-view-toggle-flow");
    expect(document.activeElement).toBe(input);
  });

  it("보기 방식을 바꿔도 인스펙터의 미리보기는 그대로 남는다", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);

    click(host, "event-view-toggle-flow");

    expect(host.querySelector('[data-testid="event-editor-inspector"] [data-testid="event-page-preview"]')).toBeTruthy();
    const toggle = host.querySelector<HTMLElement>('[data-testid="event-view-toggle-flow"]');
    expect(toggle?.getAttribute("aria-selected")).toBe("true");
  });

  it("보기 토글의 저작 보기는 저장되고 미리보기는 보기로 존재하지 않는다", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);

    // 기본 보기가 이미 목록이라 현재 보기를 다시 누르면 아무것도 저장하지 않는다(renderViewToggle 의 mode !== current) —
    // 저장을 보려면 다른 저작 보기로 갔다가 돌아와야 한다.
    click(host, "event-view-toggle-storyboard");
    expect(localStorage.getItem("oprn:storyboard-mode")).toBe("storyboard");
    click(host, "event-view-toggle-list");
    expect(localStorage.getItem("oprn:storyboard-mode")).toBe("list");
    expect(host.querySelector('[data-testid="event-view-toggle-preview"]')).toBeNull();
  });
});
