/** @vitest-environment happy-dom */
// 설정 레일 정돈(2026-09-27 적대적 시각 QA 후속)의 동작 계약.
//  - 「시작 방식」은 「모습과 대화」가 소유한다 — 새 이벤트마다 「기타 · 분류 없음 1개」가 생기던 회귀.
//  - 「언제 보이나요」 창은 편집기가 레일을 다시 그려도 **새 본문**을 보여 준다(낡은 사본 금지).
//  - 「완료」로 닫으면 원래 열려 있던 그룹으로 돌아간다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { activeEventRailGroup } from "@/editor/panels/eventEditor/eventEditorOpenState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import type { EventPage } from "@/project/types";

function seed(): string {
  const project = createBlankProject();
  const mapId = project.startMapId;
  project.maps[mapId]!.events = [{
    id: "ev_rail",
    x: 2,
    y: 3,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: "p1",
      name: "레일",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    } as EventPage],
  }];
  store.replace(project);
  editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
  return mapId;
}

describe("이벤트 설정 레일 정돈", () => {
  let host: HTMLElement;
  let mapId: string;
  let unsubscribe: () => void = () => {};

  // 편집기 모달처럼 store 가 바뀔 때마다 편집면을 통째로 다시 그린다.
  const render = () => {
    host.replaceChildren();
    renderEventEditorDynamic(host, mapId, "ev_rail");
  };
  const flush = () => new Promise<void>((resolve) => queueMicrotask(() => resolve()));
  const header = (slug: string) =>
    host.querySelector<HTMLButtonElement>(\`[data-rail-group="\${slug}"] > .event-editor-settings-accordion-header\`)!;
  const modal = () => document.querySelector<HTMLElement>("[data-testid='event-condition-modal']");

  beforeEach(() => {
    resetEditorUiModeForTests("expert");
    resetModalStackForTest();
    activeEventRailGroup.clear();
    host = document.createElement("div");
    document.body.append(host);
    mapId = seed();
    render();
    unsubscribe = store.subscribe(render);
  });

  afterEach(() => {
    unsubscribe();
    host.remove();
    modal()?.remove();
    resetEditorUiModeForTests("standard");
  });

  it("시작 방식은 「모습과 대화」 안에 있고 「기타」 그룹은 없다", () => {
    const trigger = host.querySelector("[data-testid='event-page-trigger-select']");
    expect(trigger?.closest("[data-rail-group]")?.getAttribute("data-rail-group")).toBe("look-talk");
    expect(host.querySelector("[data-testid='evt-rail-group-other']")).toBeNull();
  });

  it("「움직임과 속도」 안에 눌러도 안 열리는 두 번째 접이식이 없다", () => {
    const move = host.querySelector("[data-rail-group='move']")!;
    expect(move.querySelector(".event-collapsible-summary")).toBeNull();
    expect(host.querySelector("[data-testid='evt-rail-meta-move'] [data-testid='event-movement-summary-chips']")?.textContent).toBe("정지");
  });

  it("조건 창은 칩을 누른 뒤 다시 그려진 레일의 본문을 보여 준다", async () => {
    header("when").click();
    const dialog = modal();
    expect(dialog).toBeTruthy();
    expect(header("when").getAttribute("aria-haspopup")).toBe("dialog");

    dialog!.querySelector<HTMLButtonElement>("[data-testid='event-condition-chip-season']")!.click();
    await flush();

    // store 갱신 → 레일 재렌더 → 창이 새 본문으로 갈아 끼움. 칩이 켜진 채여야 한다.
    const live = modal()!;
    expect(live.querySelector("[data-testid='event-condition-chip-season']")?.getAttribute("aria-pressed")).toBe("true");
    expect(live.querySelectorAll(".event-condition-row")).toHaveLength(1);
    expect(header("when").querySelector("[data-testid='evt-rail-meta-when']")?.textContent).toBe("조건 1개");
  });

  it("「완료」로 닫으면 원래 열려 있던 그룹으로 돌아가고 다시 열 수 있다", async () => {
    header("move").click();
    header("when").click();
    modal()!.querySelector<HTMLButtonElement>("[data-testid='event-condition-modal-done']")!.click();
    expect(modal()).toBeNull();
    expect(host.querySelector(".event-editor-settings-accordion-group.is-open")?.getAttribute("data-rail-group")).toBe("move");

    header("when").click();
    expect(modal()?.querySelector("[data-testid='event-condition-palette']")).toBeTruthy();
  });

  it("「조건 저장」처럼 닫기와 같은 일을 하는 가짜 저장 버튼이 없다", () => {
    header("when").click();
    const labels = [...modal()!.querySelectorAll("footer button")].map((button) => button.textContent);
    expect(labels).toEqual(["완료"]);
  });
});

