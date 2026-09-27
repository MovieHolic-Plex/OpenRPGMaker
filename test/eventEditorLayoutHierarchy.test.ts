/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { openEventConditions, openEventMovement } from "@/editor/panels/eventEditor/eventEditorOpenState";

describe("event editor layout hierarchy", () => {
  let host: HTMLElement;

  beforeEach(() => {
    openEventConditions.clear();
    openEventMovement.clear();
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    project.characters = { guard: { displayName: "북문 경비병" } };
    map.events = [
      {
        id: "ev_hierarchy",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        characterId: "guard",
        pages: [
          {
            id: "p1",
            name: "경비병",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            overlapForbidden: true,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [{ kind: "text", body: "안녕" }],
          },
        ],
      },
    ];
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    host.remove();
    openEventConditions.clear();
    openEventMovement.clear();
  });

  function render(): void {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_hierarchy");
  }

  it("labels every always-present workbench column so its role is readable without help text", () => {
    render();
    const settings = host.querySelector<HTMLElement>(".event-editor-settings-column");
    const commands = host.querySelector<HTMLElement>(".event-editor-commands-column");

    const settingsLabel = settings?.querySelector<HTMLElement>("[data-testid='event-editor-column-label-settings']");
    const commandsLabel = commands?.querySelector<HTMLElement>("[data-testid='event-editor-column-label-commands']");

    expect(settingsLabel?.textContent).toContain("이 페이지 설정");
    expect(commandsLabel?.textContent).toContain("이 페이지가 하는 일");
    expect(settings?.firstElementChild).toBe(settingsLabel);
    expect(commands?.firstElementChild).toBe(commandsLabel);
  });

  it("counts the page commands in the command column label", () => {
    render();
    const count = host.querySelector<HTMLElement>("[data-testid='event-editor-command-count']");
    expect(count?.textContent).toContain("1");
  });

  it("keeps the accordion title and its summary in separate elements", () => {
    render();
    const groups = host.querySelectorAll<HTMLElement>(".event-editor-settings-accordion-group");
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      const title = group.querySelector<HTMLElement>(".event-editor-settings-accordion-title");
      const meta = group.querySelector<HTMLElement>(".event-editor-settings-accordion-meta");
      expect(title).toBeTruthy();
      expect(meta).toBeTruthy();
      expect(title!.textContent?.trim()).not.toBe("");
      expect(title!.contains(meta!)).toBe(false);
      expect(meta!.getAttribute("data-testid")).toBe(`evt-rail-meta-${group.dataset.railGroup}`);
    }
  });

  it("demotes NPC identity and schedule into their own rail group", () => {
    render();
    const npcGroup = host.querySelector<HTMLElement>("[data-testid='evt-rail-group-npc']");
    expect(npcGroup).toBeTruthy();
    // 레일 그룹은 <details>/<summary> 였다가 <div>/<button> 이 됐다 (2026-08-28).
    // 열림 상태를 `open` 속성이 아니라 `is-open` 클래스가 들고 있어야 CSS 가 헤더는 좌측
    // 레일에, 본문은 우측 넓은 면에 놓을 수 있다(`display: contents`). 태그가 아니라
    // "접힌 상태로 시작한다"는 동작을 고정한다.
    const npcHeader = npcGroup!.querySelector<HTMLElement>(".event-editor-settings-accordion-header");
    expect(npcHeader).toBeTruthy();
    expect(npcHeader!.tagName).toBe("BUTTON");
    expect(npcGroup!.classList.contains("is-open")).toBe(false);
    expect(npcHeader!.getAttribute("aria-expanded")).toBe("false");
    expect(npcGroup!.querySelector("[data-testid='event-character-social-extras']")).toBeTruthy();
    expect(npcGroup!.querySelector("[data-testid='event-schedule-editor']")).toBeTruthy();

    const settingsMain = host.querySelector<HTMLElement>(".event-editor-settings-main");
    const looseChildren = [...(settingsMain?.children ?? [])] as HTMLElement[];
    expect(looseChildren.map((child) => child.className)).toEqual(["event-page-props"]);
    const railChildren = [...(looseChildren[0]?.children ?? [])] as HTMLElement[];
    expect(railChildren.every((child) => child.classList.contains("event-editor-settings-accordion"))).toBe(true);
  });

  it("moves the quick tools out of the command list into the toolbar", () => {
    render();
    expect(host.querySelector("[data-testid='event-command-quick-tools']")).toBeNull();
    const toolbar = host.querySelector<HTMLElement>(".event-editor-command-toolbar");
    expect(toolbar?.querySelector(".event-editor-command-aux-group")).toBeTruthy();
    expect(toolbar?.querySelector("[data-testid='event-command-quick-ai']")).toBeTruthy();
    const list = host.querySelector<HTMLElement>(".cmd-list");
    const siblings = [...(list?.parentElement?.children ?? [])] as HTMLElement[];
    expect(siblings.some((node) => node.classList.contains("event-editor-command-aux-group"))).toBe(false);
  });

  it("keeps a single home for the page selector: the pagebar, never the rail", () => {
    render();
    const pagebar = host.querySelector<HTMLElement>(".event-editor-pagebar");
    expect(pagebar).toBeTruthy();
    expect(pagebar!.querySelector(".evt-page-segments")).toBeTruthy();
    expect(pagebar!.querySelector("[data-testid='event-page-tabs']")).toBeTruthy();
    expect(host.querySelector(".event-editor-settings-column .evt-page-segments")).toBeNull();
  });
});
