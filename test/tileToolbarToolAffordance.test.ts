/** @vitest-environment happy-dom */
/**
 * 도구막대 도구 버튼의 상태·표기 계약.
 *
 * 회귀 배경(2026-08-27 좌측 사이드바 실측): (1) `:hover:not(:disabled)` 와 `.active` 가
 * 08-rm-palette-tools.css 에서 한 선언 블록을 공유해, 마우스가 도구 줄 위에 있는 동안에는
 * 어떤 도구가 골라져 있는지 구별할 수 없었다. (2) 도구막대는 단축키를 어디에도 알려주지
 * 않아 좁은 폭에서 잘린 도구를 키보드로 부를 방법을 감췄다(단축키는 hotkeys.ts 에 있다).
 * (3) 「칠하기」는 초보 레일(brush)과 도구막대(pen)가 서로 다른 글리프를 써서 같은 행위가
 * 두 그림으로 보였다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { makeTileToolbar } from "@/editor/panels/tileToolbar";
import { makeSvgIcon } from "@/editor/panels/tileToolbarIcons";
import { resetTileToolbarMenusForTests } from "@/editor/panels/tileToolbarMenus";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const CSS_PATH = resolve(__dirname, "..", "src", "styles", "shell", "figma-editor", "08-rm-palette-tools.css");
const css = readFileSync(CSS_PATH, "utf8");

type LeafRule = { readonly selector: string; readonly body: string };

function leafRules(): readonly LeafRule[] {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  const rules: LeafRule[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) rules.push({ selector: match[1]!, body: match[2]! });
  return rules;
}

let host: HTMLElement;

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

function button(testid: string): HTMLElement {
  const node = host.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  if (!node) throw new Error(`testid 없음: ${testid}`);
  return node;
}

describe("도구막대 선택 상태 표시", () => {
  it(".active 는 hover 와 다른, 더 강한 자기 선언 블록을 갖는다", () => {
    const rules = leafRules().filter((rule) => rule.selector.includes(".oprn-tile-tool"));
    const shared = rules.filter((rule) => rule.selector.includes(".oprn-tile-tool.active") && rule.selector.includes(":hover"));
    expect(shared, "hover 와 active 가 한 블록을 공유하면 안 된다").toEqual([]);

    const activeRule = rules.find((rule) => rule.selector.includes(".oprn-tile-tool.active") && !rule.selector.includes(":hover"));
    expect(activeRule, ".oprn-tile-tool.active 전용 규칙이 필요하다").toBeTruthy();
    expect(activeRule!.body).toMatch(/background:\s*var\(--editor-blue\)/);
    expect(activeRule!.body).toMatch(/border-color:\s*var\(--editor-blue\)/);
    expect(activeRule!.body).toMatch(/color:\s*var\(--on-accent\)/);

    const hoverRule = rules.find((rule) => rule.selector.includes(".oprn-tile-tool:hover"));
    expect(hoverRule).toBeTruthy();
    expect(hoverRule!.body).not.toMatch(/background:\s*var\(--editor-blue\)/);
  });
});

describe("도구막대 표기", () => {
  beforeEach(() => {
    resetTileToolbarMenusForTests();
    const project = createBlankProject();
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, layer: "lower", paintShape: "pen", selection: null, tool: "paint" });
    host = document.createElement("div");
    document.body.append(host);
    render();
  });

  afterEach(() => {
    resetTileToolbarMenusForTests();
    host.remove();
  });

  it("도구마다 hotkeys.ts 의 단축키를 툴팁에 적는다", () => {
    const expected: ReadonlyArray<readonly [string, string]> = [
      ["tool-paint", "칠하기 (B)"],
      ["tool-select", "영역 선택 (V)"],
      ["tool-erase", "지우기 (E)"],
      ["tool-fill", "이어진 영역 채우기 (G)"],
      ["tool-eyedropper", "타일 집기 (I)"],
      ["tool-pan", "화면 밀기 (4)"],
      ["tool-collision", "통행 표시 (6)"],
      ["tool-event", "장면 놓기 (7)"],
    ];
    for (const [testid, prefix] of expected) {
      expect(button(testid).getAttribute("title") ?? "", testid).toContain(prefix);
    }
  });

  it("「칠하기」는 초보 레일과 같은 brush 글리프를 쓴다", () => {
    const icon = button("tool-paint").querySelector("svg");
    expect(icon).toBeTruthy();
    expect(icon!.outerHTML).toBe(makeSvgIcon("brush").outerHTML);
    expect(icon!.outerHTML).not.toBe(makeSvgIcon("pen").outerHTML);
  });
});
