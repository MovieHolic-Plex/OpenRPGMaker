/** @vitest-environment happy-dom */
/**
 * ⋯ 오버플로 메뉴의 닫는 길 — Escape 와 바깥 pointerdown.
 *
 * 회귀 배경(2026-08-27 좌측 사이드바 실측): 초보 레일 플라이아웃은 두 길로 다 닫히는데
 * (basicLeftRail.ts installDocumentListeners) 도구막대 ⋯ 는 어느 쪽으로도 닫히지 않았다.
 * 실측 증거: .omo/evidence/left-sidebar-repair/before-standard-contract.json
 *   → overflow.afterEscapeOpen true / afterEscapeFocus "BODY" / afterOutsideClickOpen true
 * 열림 상태는 재렌더에도 살아남아야 하니 모듈 변수 openMenu 로 남기고, 문서 리스너는
 * 렌더마다 쌓이지 않게 1회만 설치한다.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { makeTileToolbar } from "@/editor/panels/tileToolbar";
import { resetTileToolbarMenusForTests } from "@/editor/panels/tileToolbarMenus";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

let host: HTMLElement;
let outside: HTMLElement;

function render(): void {
  host.replaceChildren();
  const project = store.getCurrent();
  const map = project.maps[project.startMapId]!;
  host.append(makeTileToolbar({
    map,
    rerender: () => { render(); },
    state: editorState.get(),
    tileset: project.tilesets[map.tilesetId]!,
  }));
}

function trigger(): HTMLElement {
  const button = host.querySelector<HTMLElement>('[data-testid="oprn-tool-overflow"]');
  if (!button) throw new Error("⋯ 트리거가 없다");
  return button;
}

function dropdown(): HTMLElement | null {
  return host.querySelector<HTMLElement>('[data-testid="toolbar-overflow-dropdown"]');
}

function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" }));
}

describe("도구막대 오버플로 닫기", () => {
  beforeEach(() => {
    resetTileToolbarMenusForTests();
    const project = createBlankProject();
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, layer: "lower", paintShape: "pen", selection: null, tool: "paint" });
    host = document.createElement("div");
    outside = document.createElement("div");
    document.body.append(host, outside);
    render();
  });

  afterEach(() => {
    resetTileToolbarMenusForTests();
    host.remove();
    outside.remove();
  });

  it("Escape 로 닫고 포커스를 ⋯ 트리거로 되돌린다", () => {
    trigger().click();
    expect(dropdown()).toBeTruthy();

    pressEscape();

    expect(dropdown()).toBeNull();
    expect((document.activeElement as HTMLElement | null)?.dataset.testid).toBe("oprn-tool-overflow");
  });

  it("입력 중 Escape 는 가로채지 않는다 (초보 레일과 동일한 가드)", () => {
    trigger().click();
    const input = document.createElement("input");
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" }));
    expect(dropdown()).toBeTruthy();
    input.remove();
  });

  it("바깥 pointerdown 은 닫고, 드롭다운·트리거 안의 pointerdown 은 유지한다", () => {
    trigger().click();
    expect(dropdown()).toBeTruthy();

    dropdown()!.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
    expect(dropdown()).toBeTruthy();

    trigger().dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
    expect(dropdown()).toBeTruthy();

    outside.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
    expect(dropdown()).toBeNull();
  });

  it("인스펙터·규칙·기록 패널이 열려 있어도 Escape 로 전부 닫는다", () => {
    trigger().click();
    host.querySelector<HTMLElement>('[data-testid="oprn-tool-inspector"]')!.click();
    expect(host.querySelector('[data-testid="toolbar-overflow-dropdown"]')).toBeTruthy();

    pressEscape();

    expect(dropdown()).toBeNull();
  });

  it("문서 리스너는 렌더마다 쌓이지 않는다", () => {
    const original = document.addEventListener.bind(document);
    const counts = new Map<string, number>();
    document.addEventListener = ((type: string, ...rest: unknown[]) => {
      counts.set(type, (counts.get(type) ?? 0) + 1);
      return (original as (t: string, ...r: unknown[]) => void)(type, ...rest);
    }) as typeof document.addEventListener;
    try {
      for (let i = 0; i < 5; i += 1) render();
    } finally {
      document.addEventListener = original as typeof document.addEventListener;
    }

    expect(counts.get("keydown") ?? 0).toBeLessThanOrEqual(1);
    expect(counts.get("pointerdown") ?? 0).toBeLessThanOrEqual(1);
  });
});
