/** @vitest-environment happy-dom */
// 레일 그룹 소속은 위치가 아니라 명시 claim 으로 결정된다는 계약을 고정한다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import type { EventPage } from "@/project/types";

function seed(pageOverrides: Partial<EventPage> = {}): string {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId]!;
  map.events = [
    {
      id: "ev_rail",
      x: 2,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "p1",
          name: "레일",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          overlapForbidden: true,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
          ...pageOverrides,
        } as EventPage,
      ],
    },
  ];
  store.replace(project);
  editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
  return mapId;
}

describe("이벤트 편집기 좌측 레일 그룹 소속", () => {
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

  it("겹침 체크박스는 memory 그룹이 소유한다", () => {
    const mapId = seed();
    renderEventEditorDynamic(host, mapId, "ev_rail");
    const overlap = host.querySelector<HTMLElement>("[data-testid='event-classic-overlap']");
    expect(overlap).toBeTruthy();
    expect(overlap!.closest("[data-testid='evt-rail-group-memory']")).toBeTruthy();
    expect(overlap!.closest("[data-testid='evt-rail-group-when']")).toBeNull();
  });

  it("memory 그룹 body 에 편집 가능한 컨트롤이 있다", () => {
    const mapId = seed();
    renderEventEditorDynamic(host, mapId, "ev_rail");
    const body = host.querySelector<HTMLElement>(
      "[data-testid='evt-rail-group-memory'] .event-editor-settings-accordion-body",
    );
    expect(body).toBeTruthy();
    expect(body!.querySelectorAll("input, select, textarea").length).toBeGreaterThan(0);
  });

  it("미분류 자식이 없어 기타 그룹이 만들어지지 않는다", () => {
    const mapId = seed();
    renderEventEditorDynamic(host, mapId, "ev_rail");
    expect(host.querySelector("[data-testid='evt-rail-group-other']")).toBeNull();
    const rail = host.querySelector<HTMLElement>("[data-testid='event-editor-settings-accordion']");
    const slugs = [...rail!.children].map((node) => (node as HTMLElement).dataset.railGroup);
    expect(slugs).toEqual(["look-talk", "when", "move", "memory", "npc"]);
  });

  it("overlapForbidden 미지정 시 헤더 요약과 체크박스 상태가 일치한다", () => {
    const mapId = seed({ overlapForbidden: undefined });
    renderEventEditorDynamic(host, mapId, "ev_rail");
    const meta = host.querySelector<HTMLElement>("[data-testid='evt-rail-meta-memory']");
    const checkbox = host.querySelector<HTMLInputElement>("[data-testid='event-page-overlap-forbidden']");
    expect(checkbox!.checked).toBe(true);
    expect(meta!.textContent).toBe("겹침 금지");
  });
});
