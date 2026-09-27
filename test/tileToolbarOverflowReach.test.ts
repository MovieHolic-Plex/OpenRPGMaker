/** @vitest-environment happy-dom */
/**
 * ⋯ 오버플로 도달성 계약 — 트리거는 좌패널 안에 남고, 드롭다운은 잘리는 스크롤 띠 밖에 뜬다.
 *
 * 회귀 배경(2026-08-27 좌측 사이드바 실측): 도구막대 행 자체가 `overflow-x: auto` 인
 * 30px 띠였다. 도구 폭 합이 344px 인데 clientWidth 는 표준 261px / 전문가 281px 이라
 * ⋯ 트리거가 x=328 로 밀려 좌패널(x 0~300) 밖에서 렌더됐고(triggerInsideLeftPanel false),
 * 드롭다운은 그 30px 띠의 자손이라 열려도 중심 히트테스트가 BUTTON.chipset-tile 로 갔다
 * (insideDropdown=false → 복사·붙여넣기·인스펙터·규칙 감사·작업 기록·브러시 1~4 도달 불가).
 * 실측 증거: .omo/evidence/left-sidebar-repair/before-standard-contract.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { resetTileToolbarMenusForTests } from "@/editor/panels/tileToolbarMenus";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const CSS_PATH = resolve(__dirname, "..", "src", "styles", "shell", "figma-editor", "08-rm-palette-tools.css");
const css = readFileSync(CSS_PATH, "utf8");

/** 선택자가 주어진 클래스로 정확히 끝나는 잎 규칙의 선언 블록을 돌려준다(없으면 null). */
function declarationBlock(selectorSuffix: string): string | null {
  const leafRule = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = leafRule.exec(css)) !== null) {
    const selectors = match[1]!.split(",").map((part) => part.trim());
    if (selectors.some((selector) => selector.endsWith(selectorSuffix))) return match[2]!;
  }
  return null;
}

let host: HTMLElement;

function render(): HTMLElement {
  renderTilePalette(host);
  return toolbarRow();
}

function toolbarRow(): HTMLElement {
  const row = host.querySelector<HTMLElement>('[data-testid="oprn-tile-toolbar"]');
  if (!row) throw new Error("도구막대 행이 없다");
  return row;
}

describe("도구막대 오버플로 도달성", () => {
  beforeEach(() => {
    resetTileToolbarMenusForTests();
    const project = createBlankProject();
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, layer: "lower", paintShape: "pen", selection: null, tool: "paint" });
    host = document.createElement("div");
    host.dataset.testid = "left-palette-root";
    document.body.append(host);
    render();
  });

  afterEach(() => {
    resetTileToolbarMenusForTests();
    host.remove();
  });

  it("스크롤되는 도구들은 내부 컨테이너에, ⋯ 는 그 형제로 남는다", () => {
    const row = toolbarRow();
    expect(row.getAttribute("role")).toBe("toolbar");
    const scroll = row.querySelector<HTMLElement>(".oprn-tile-toolbar-scroll");
    expect(scroll).toBeTruthy();
    expect(scroll!.parentElement).toBe(row);
    for (const testid of ["tool-select", "tool-paint", "tool-erase", "tool-fill", "oprn-tool-undo"]) {
      expect(scroll!.querySelector(`[data-testid="${testid}"]`), testid).toBeTruthy();
    }
    // 「도구」 메뉴는 삭제됐다 — 복사·붙여넣기는 Ctrl+C/V 와 선택 칩이 맡는다.
    expect(row.querySelector('[data-testid="sidebar-tools-menu"]')).toBeNull();
  });

  it("열린 드롭다운은 잘리는 스크롤 컨테이너의 자손이 아니다", () => {
    const expectDirectSizes = () => {
        const controls = host.querySelectorAll<HTMLSelectElement>('[data-testid="brush-size-select"]');
        expect(controls).toHaveLength(1);
        const control = controls[0];
        if (!control) throw new Error('Missing brush selector');
        expect(Array.from(control.options, option => option.value)).toEqual(['1', '2', '3', '4']);
        expect(control.closest('[data-testid="toolbar-overflow-dropdown"]')).toBeNull();
        expect(control.closest('[hidden], .hidden')).toBeNull();
        expect(control.disabled).toBe(false);
    };
    expectDirectSizes();
    host.querySelector<HTMLElement>('[data-testid="oprn-tool-overflow"]')!.click();
    const row = toolbarRow();
    const dropdown = host.querySelector<HTMLElement>('[data-testid="toolbar-overflow-dropdown"]');
    expect(dropdown).toBeTruthy();
    const scroll = row.querySelector<HTMLElement>(".oprn-tile-toolbar-scroll")!;
    expect(scroll.contains(dropdown!)).toBe(false);
    for (const testid of ["oprn-tool-inspector", "toolbar-toggle-ruleAudit", "toolbar-toggle-history"]) {
      expect(dropdown!.querySelector(`[data-testid="${testid}"]`), testid).toBeTruthy();
    }
    expectDirectSizes();
  });

  it("도구막대 행은 더 이상 가로 스크롤 띠가 아니고, 내부 컨테이너가 스크롤을 맡는다", () => {
    const rowBlock = declarationBlock(".oprn-tile-toolbar");
    expect(rowBlock).toBeTruthy();
    expect(rowBlock).not.toMatch(/overflow-x:\s*auto/);
    expect(rowBlock).toMatch(/overflow:\s*visible/);

    const scrollBlock = declarationBlock(".oprn-tile-toolbar-scroll");
    expect(scrollBlock).toBeTruthy();
    expect(scrollBlock).toMatch(/overflow-x:\s*auto/);
    expect(scrollBlock).toMatch(/flex:\s*1 1 auto/);
    expect(scrollBlock).toMatch(/min-width:\s*0/);

    const menuBlock = declarationBlock(".oprn-toolbar-menu");
    expect(menuBlock).toMatch(/flex:\s*0 0 auto/);
  });
});
