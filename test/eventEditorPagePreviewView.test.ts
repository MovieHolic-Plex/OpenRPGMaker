/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { clearCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { resetEventViewSession } from "@/editor/panels/eventEditor/storyboardView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const EVENT_ID = "ev_page_preview";

function seedProject(): string {
  const project = createBlankProject();
  const mapId = project.startMapId;
  project.maps[mapId]!.events = [
    {
      id: EVENT_ID,
      x: 3,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "p1",
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
  editorState.set({ currentMapId: mapId, selectedEventId: EVENT_ID, selectedEventPageId: "p1" });
  return mapId;
}

function click(host: HTMLElement, testId: string): void {
  const button = host.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!button) throw new Error(`missing control ${testId}`);
  button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

describe("이 페이지가 하는 일 — 미리보기 보기", () => {
  let host: HTMLElement;

  beforeEach(() => {
    resetEditorUiModeForTests("standard");
    clearCommandInspector();
    localStorage.clear();
    // 보기 모드는 이제 세션에도 있다 — localStorage.clear() 만으로는 안 지워진다.
    // 이걸 빼면 앞 테스트가 남긴 preview 때문에 아래 「툴바의 미리보기 버튼」 테스트가
    // 버튼이 아무 일을 안 해도 통과하는 빈 테스트가 된다.
    resetEventViewSession();
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    clearCommandInspector();
    host.remove();
  });

  it("보기 토글에 미리보기가 있고, 고르면 명령 컬럼 안에서 무대를 그린다", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);

    const canvas = host.querySelector<HTMLElement>('[data-testid="event-script-canvas"]');
    expect(canvas?.querySelector('[data-testid="event-view-toggle-preview"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-page-preview"]')).toBeNull();

    click(host, "event-view-toggle-preview");

    const previewHost = canvas?.querySelector<HTMLElement>('[data-testid="event-page-preview-host"]');
    const panel = previewHost?.querySelector<HTMLElement>('[data-testid="event-page-preview"]');
    expect(previewHost?.hidden).toBe(false);
    expect(panel).toBeTruthy();
    expect(previewHost?.querySelector('[data-testid="event-script-live-stage"]')?.textContent).toContain("어서 오세요.");
  });

  it("이전/다음이 무대와 단계 위치를 옮긴다", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    click(host, "event-view-toggle-preview");

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

  it("툴바의 미리보기 버튼도 같은 보기로 넘긴다", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);

    click(host, "event-command-quick-preview");

    expect(host.querySelector('[data-testid="event-page-preview"]')).toBeTruthy();
    const toggle = host.querySelector<HTMLElement>('[data-testid="event-view-toggle-preview"]');
    expect(toggle?.getAttribute("aria-pressed")).toBe("true");
  });

  it("미리보기는 다음 열기까지 남는 저작 보기로 저장되지 않는다", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);

    click(host, "event-view-toggle-list");
    expect(localStorage.getItem("oprn:storyboard-mode")).toBe("list");

    click(host, "event-view-toggle-preview");
    expect(localStorage.getItem("oprn:storyboard-mode")).toBe("list");
  });
});
