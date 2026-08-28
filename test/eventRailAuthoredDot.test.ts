/** @vitest-environment happy-dom */
// 레일은 한 번에 한 그룹만 연다. 나머지 넷은 접혀 있으므로, 어느 그룹에 저작자가
// 손댄 내용이 있는지 열어 보지 않고도 알 수 있어야 한다. 기본값 그대로인 그룹과
// 값이 들어간 그룹을 점 하나로 가른다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import type { EventPage, GameEvent } from "@/project/types";

function seed(page: Partial<EventPage> = {}, event: Partial<GameEvent> = {}): string {
  const project = createBlankProject();
  const mapId = project.startMapId;
  project.maps[mapId]!.events = [
    {
      id: "ev_dot",
      x: 2,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
      ...event,
      pages: [
        {
          id: "p1",
          name: "점",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          overlapForbidden: true,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
          ...page,
        } as EventPage,
      ],
    } as GameEvent,
  ];
  store.replace(project);
  editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
  return mapId;
}

function hasDot(host: HTMLElement, slug: string): boolean {
  const group = host.querySelector<HTMLElement>(`[data-testid='evt-rail-group-${slug}']`);
  return Boolean(group?.querySelector(`[data-testid='evt-rail-dot-${slug}']`));
}

describe("레일 그룹 저작 표시 점", () => {
  let host: HTMLElement;

  beforeEach(() => {
    resetEditorUiModeForTests("expert");
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    host.remove();
    resetEditorUiModeForTests("standard");
  });

  it("기본값뿐인 페이지에는 점이 하나도 없다", () => {
    const mapId = seed();
    renderEventEditorDynamic(host, mapId, "ev_dot");
    for (const slug of ["look-talk", "when", "move", "memory", "npc"]) {
      expect(hasDot(host, slug), slug).toBe(false);
    }
  });

  it("조건을 넣으면 when 그룹에만 점이 붙는다", () => {
    const mapId = seed({ conditions: [{ kind: "switch", switchId: "sw_0001", value: true }] });
    renderEventEditorDynamic(host, mapId, "ev_dot");
    expect(hasDot(host, "when")).toBe(true);
    expect(hasDot(host, "move")).toBe(false);
    expect(hasDot(host, "look-talk")).toBe(false);
  });

  it("이동 유형이 정지가 아니면 move 그룹에 점이 붙는다", () => {
    const mapId = seed({ movement: { type: "random", speed: 4, frequency: 3 } });
    renderEventEditorDynamic(host, mapId, "ev_dot");
    expect(hasDot(host, "move")).toBe(true);
    expect(hasDot(host, "when")).toBe(false);
  });

  it("그래픽을 고르면 look-talk 그룹에 점이 붙는다", () => {
    const mapId = seed({ graphic: { sprite: "Actor1" } });
    renderEventEditorDynamic(host, mapId, "ev_dot");
    expect(hasDot(host, "look-talk")).toBe(true);
  });

  it("겹침 기본값(금지)에는 점이 없고, 통행 허용으로 바꾸면 붙는다", () => {
    const base = seed({ overlapForbidden: true });
    renderEventEditorDynamic(host, base, "ev_dot");
    expect(hasDot(host, "memory")).toBe(false);

    host.replaceChildren();
    const changed = seed({ overlapForbidden: false });
    renderEventEditorDynamic(host, changed, "ev_dot");
    expect(hasDot(host, "memory")).toBe(true);
  });

  it("NPC 를 연결하면 npc 그룹에 점이 붙는다", () => {
    const mapId = seed({}, { characterId: "npc_shopkeeper" });
    renderEventEditorDynamic(host, mapId, "ev_dot");
    expect(hasDot(host, "npc")).toBe(true);
  });
});
