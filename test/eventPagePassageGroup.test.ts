/** @vitest-environment happy-dom */
// 우선순위와 겹침은 런타임 통행 판정식(`priority === "same" && overlapForbidden`)의 두 반쪽이다.
// 한 그룹에서 함께 보이고, 판정에 안 쓰이는 상태를 살아있는 것처럼 보이지 않게 하는 계약.
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
      id: "ev_passage",
      x: 2,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "p1",
          name: "통행",
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

describe("겹침과 통행 그룹", () => {
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

  it("우선순위 select 가 겹침과 같은 memory 그룹에 있다", () => {
    renderEventEditorDynamic(host, seed(), "ev_passage");
    const priority = host.querySelector<HTMLElement>("[data-testid='event-page-priority-select']");
    expect(priority).toBeTruthy();
    expect(priority!.closest("[data-testid='evt-rail-group-memory']")).toBeTruthy();
    expect(priority!.closest("[data-testid='evt-rail-group-when']")).toBeNull();
  });

  it("같은 층이면 겹침 체크가 살아 있고 안내문이 판정에 쓰인다고 말한다", () => {
    renderEventEditorDynamic(host, seed({ priority: "same" }), "ev_passage");
    const overlap = host.querySelector<HTMLInputElement>("[data-testid='event-page-overlap-forbidden']");
    expect(overlap!.disabled).toBe(false);
    expect(host.querySelector("[data-testid='event-page-overlap-priority-hint']")!.textContent).toContain(
      "통행 판정에 쓰입니다",
    );
  });

  it("맵 아래/맵 위면 겹침 체크를 잠그고 왜 안 막히는지 알려 준다", () => {
    for (const priority of ["below", "above"] as const) {
      host.replaceChildren();
      renderEventEditorDynamic(host, seed({ priority }), "ev_passage");
      const overlap = host.querySelector<HTMLInputElement>("[data-testid='event-page-overlap-forbidden']");
      expect(overlap!.disabled, priority).toBe(true);
      const hint = host.querySelector("[data-testid='event-page-overlap-priority-hint']")!.textContent ?? "";
      expect(hint, priority).toContain("통행을 막지 않습니다");
      expect(hint, priority).toContain(priority === "below" ? "맵 아래" : "맵 위");
      // 헤더 요약도 «겹침 금지» 라고 거짓말하지 않는다.
      expect(host.querySelector("[data-testid='evt-rail-meta-memory']")!.textContent, priority).toContain("통행 허용");
    }
  });

  it("층을 옮겼으면 그룹에 손댄 표시(점)가 뜬다", () => {
    renderEventEditorDynamic(host, seed({ priority: "below", overlapForbidden: true }), "ev_passage");
    expect(host.querySelector("[data-testid='evt-rail-dot-memory']")).toBeTruthy();
  });

  it("기타 그룹이 생기지 않고 레일 순서는 그대로다", () => {
    renderEventEditorDynamic(host, seed(), "ev_passage");
    expect(host.querySelector("[data-testid='evt-rail-group-other']")).toBeNull();
    const rail = host.querySelector<HTMLElement>("[data-testid='event-editor-settings-accordion']");
    expect([...rail!.children].map((node) => (node as HTMLElement).dataset.railGroup)).toEqual([
      "look-talk",
      "when",
      "move",
      "memory",
      "npc",
    ]);
  });
});
