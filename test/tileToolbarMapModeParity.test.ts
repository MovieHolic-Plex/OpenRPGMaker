// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { makeLeftLayerSwitcher } from "@/editor/panels/leftLayerSwitcher";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetTileToolbarMenusForTests, makeInspectionControls } from "@/editor/panels/tileToolbarMenus";
import { selectEyedropperTool, selectMapModeTool } from "@/editor/panels/tileToolbarActions";
import { handleEditorKey } from "@/editor/hotkeys";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resetBrushSettingsForTests, setBrushSettingsOpen } from "@/editor/panels/brushSettingsDisclosure";
import { makeTileToolbar } from "@/editor/panels/tileToolbar";
import { makeSvgIcon } from "@/editor/panels/tileToolbarIcons";
import { isolateTimers } from "./mergedTeardown";

/**
 * 렌더된 표준 도구막대의 맵 모드 버튼 → `selectMapModeTool` 배선 계약.
 *
 * 회귀 배경(2026-08-27 좌측 사이드바 적대적 리뷰 B4): 맵 모드 상태 계약은
 * `test/tileToolbarMapModeParity.test.ts` 가 헬퍼(`selectMapModeTool`)를 직접 불러서만
 * 재고 있었다. 그래서 도구막대의 옛 클릭 핸들러
 * (`if (item.id === "eyedropper") selectEyedropperTool(); else editorState.set({ tool: item.id })`)
 * 를 되살려도 여섯 스위트 21/21 이 전부 초록이었다 — 버튼과 헬퍼 사이의 배선만 무검증이었다.
 * 이 파일은 실제 표준 좌패널을 렌더해서 testid 로 버튼을 찾아 클릭하고, 그 결과 상태를 잰다.
 */
describe("tileToolbarMapModeClickWiring", () => {
  isolateTimers();
  const STAMP = {
    cells: [{ dx: 0, dy: 0, layer: "lower", tile: 7 }],
    height: 1,
    source: { endTile: 7, startTile: 7 },
    width: 1,
  } as const;
  const SELECTION = { height: 2, mapId: "map-1", width: 2, x: 1, y: 1 } as const;
  describe("렌더된 표준 도구막대의 맵 모드 클릭 배선", () => {
    let restore: () => void;
    let container: HTMLElement;

    beforeEach(() => {
      vi.useFakeTimers();
      resetTileToolbarMenusForTests();
      store.replace(createBlankProject());
      container = document.createElement("div");
      container.dataset.testid = 'left-palette-root';
      document.body.append(container);
      restore = editorState.subscribe(() => renderTilePalette(container));
    });

    afterEach(() => {
      restore();
      container.remove();
      resetTileToolbarMenusForTests();
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    function clickTool(testid: string): void {
      renderTilePalette(container);
      // 레이어 줄(높이·바닥·상위·이벤트)은 머리줄(menu.ts)이 소유한다 — 같은 부품을 붙여 누른다.
      // bce1173bc0: 부품은 [지형 붓 단추, 레이어 radiogroup] 둘을 돌려준다 — 머리줄(menu.ts)처럼 둘 다 붙인다.
      if (testid.startsWith("layer-")) container.append(...makeLeftLayerSwitcher(editorState.get()));
      const button = container.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
      if (!button) throw new Error(`도구막대에 testid 없음: ${testid}`);
      button.click();
    }

    it("장면 놓기 버튼 클릭은 tool 과 layer 를 함께 이벤트로 바꾼다", () => {
      editorState.set({
        activePaletteStamp: null,
        currentMapId: store.getCurrent().startMapId,
        layer: "lower",
        paintShape: "pen",
        selection: null,
        tool: "paint",
      });

      clickTool("layer-event");

      expect(editorState.get().tool).toBe("event");
      expect(editorState.get().layer).toBe("event");
    });

    it("「높이」 버튼 클릭은 이벤트 레이어에서 바닥으로 탈출시킨다", () => {
      editorState.set({
        activePaletteStamp: null,
        currentMapId: store.getCurrent().startMapId,
        layer: "event",
        paintShape: "pen",
        selection: null,
        tool: "event",
      });

      clickTool("layer-relief");

      expect(editorState.get().tool).toBe("relief");
      expect(editorState.get().layer).toBe("lower");
    });

    it("버튼 클릭이 무장된 팔레트 스탬프와 선택 영역까지 정리한다", () => {
      editorState.set({
        activePaletteStamp: STAMP,
        currentMapId: store.getCurrent().startMapId,
        layer: "lower",
        paintShape: "pen",
        selection: SELECTION,
        tool: "paint",
      });

      clickTool("layer-relief");

      expect(editorState.get().tool).toBe("relief");
      expect(editorState.get().activePaletteStamp).toBeNull();
      expect(editorState.get().selection).toBeNull();
    });
  });
});

/**
 * 맵 모드 도구(집기·밀기·통행·장면)를 고르는 네 경로가 같은 상태 계약을 지켜야 한다.
 *
 * 회귀 배경(2026-08-27 좌측 사이드바 적대적 리뷰 §5, 브라우저 실측):
 * 표준/전문가 도구막대의 「장면 놓기」는 `editorState.set({ tool })` 만 해서 레이어를 바꾸지
 * 않았다. 같은 이름의 버튼이 초보 레일(basicLeftRail)과 단축키 N 에서는 레이어까지 이벤트로
 * 바꾸므로, 사용자는 같은 버튼을 눌러도 모드에 따라 다른 결과를 얻었다.
 * 실측 증거: .omo/evidence/left-sidebar-repair/before-standard-contract.json
 *   → parity.layerBeforeEventTool "바닥" / toolAfterEventClick "event" / layerAfterEventToolClick "바닥"
 * 또한 도구막대 경로만 activePaletteStamp 와 selection 을 남겨 두어, 사이드바가 보여 주는
 * 타일과 실제로 찍히는 타일이 갈렸다.
 */
describe("tileToolbarMapModeParity", () => {
  isolateTimers();
  beforeEach(() => {
    editorState.set({
      activePaletteStamp: null,
      layer: "lower",
      paintShape: "pen",
      selection: null,
      tool: "paint",
    });
  });
  const STAMP = {
    cells: [{ dx: 0, dy: 0, layer: "lower", tile: 7 }],
    height: 1,
    source: { endTile: 7, startTile: 7 },
    width: 1,
  } as const;
  const SELECTION = { height: 2, mapId: "map-1", width: 2, x: 1, y: 1 } as const;
  describe("selectMapModeTool", () => {
    it("장면 놓기는 레이어까지 이벤트로 바꾼다 (레일·단축키 N 과 동일 계약)", () => {
      selectMapModeTool("event");
      expect(editorState.get().tool).toBe("event");
      expect(editorState.get().layer).toBe("event");
    });

    it("장면 외 맵 모드 도구는 이벤트 레이어에서 바닥으로 탈출한다", () => {
      editorState.set({ layer: "event", tool: "event" });
      selectMapModeTool("collision");
      expect(editorState.get().tool).toBe("collision");
      expect(editorState.get().layer).toBe("lower");
    });

    it("이벤트 레이어가 아니면 레이어를 건드리지 않는다", () => {
      editorState.set({ layer: "upper" });
      selectMapModeTool("pan");
      expect(editorState.get().layer).toBe("upper");
    });

    it("무장된 팔레트 스탬프와 선택 영역을 정리한다 (사이드바 표시와 실제 결과의 괴리 차단)", () => {
      editorState.set({ activePaletteStamp: STAMP, selection: SELECTION });
      selectMapModeTool("collision");
      expect(editorState.get().activePaletteStamp).toBeNull();
      expect(editorState.get().selection).toBeNull();
    });

    it("집기 진입점은 맵 모드 계약을 그대로 재사용한다", () => {
      editorState.set({ activePaletteStamp: STAMP, layer: "event" });
      selectEyedropperTool();
      expect(editorState.get().tool).toBe("eyedropper");
      expect(editorState.get().layer).toBe("lower");
      expect(editorState.get().activePaletteStamp).toBeNull();
    });
  });
  describe("경로 간 패리티", () => {
    function press(key: string): void {
      handleEditorKey(new KeyboardEvent("keydown", { key, cancelable: true }));
    }

    it("단축키 N 과 도구막대 장면 놓기가 같은 tool·layer 를 만든다", () => {
      press("n");
      const viaHotkey = { layer: editorState.get().layer, tool: editorState.get().tool };
      editorState.set({ layer: "lower", tool: "paint" });
      selectMapModeTool("event");
      expect({ layer: editorState.get().layer, tool: editorState.get().tool }).toEqual(viaHotkey);
    });

    it("단축키 6(통행)과 도구막대 통행 표시가 같은 tool·layer 를 만든다", () => {
      editorState.set({ layer: "event", tool: "event" });
      press("6");
      const viaHotkey = { layer: editorState.get().layer, tool: editorState.get().tool };
      editorState.set({ layer: "event", tool: "event" });
      selectMapModeTool("collision");
      expect({ layer: editorState.get().layer, tool: editorState.get().tool }).toEqual(viaHotkey);
    });
  });
});

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
describe("tileToolbarOverflowDismiss", () => {
  isolateTimers();
  let host: HTMLElement;
  let outside: HTMLElement;
  function render(): void {
    host.replaceChildren();
    const project = store.getCurrent();
    const map = project.maps[project.startMapId]!;
    host.append(makeInspectionControls({
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
});

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
describe("tileToolbarOverflowReach", () => {
  isolateTimers();
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
      // 도구 줄·붓 크기는 왼쪽 열의 접힌 「붓 설정」 안에 있다 — 펼친 상태에서 도달성을 본다.
      setBrushSettingsOpen(true);
      render();
    });

    afterEach(() => {
      resetTileToolbarMenusForTests();
      resetBrushSettingsForTests();
      host.remove();
    });

    it("스크롤되는 도구들은 내부 컨테이너에, ⋯ 는 그 형제로 남는다", () => {
      const row = toolbarRow();
      expect(row.getAttribute("role")).toBe("toolbar");
      const scroll = row.querySelector<HTMLElement>(".oprn-tile-toolbar-scroll");
      expect(scroll).toBeTruthy();
      expect(scroll!.parentElement).toBe(row);
      for (const testid of ["palette-tool-select", "palette-tool-paint", "tool-erase", "palette-tool-fill", "oprn-tool-undo"]) {
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
});

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
describe("tileToolbarToolAffordance", () => {
  isolateTimers();
  const CSS_PATH = resolve(__dirname, "..", "src", "styles", "shell", "figma-editor", "08-rm-palette-tools.css");
  const rawCss = readFileSync(CSS_PATH, "utf8");
  type LeafRule = { readonly selector: string; readonly body: string };
  function leafRules(): readonly LeafRule[] {
    // 주석을 먼저 걷어낸다: 주석 안의 쉼표·`:hover`·`.active` 가 선택자로 오인되면
    // 설명을 자세히 쓸수록 테스트가 거짓 실패한다(실제로 그렇게 한 번 깨졌다).
    const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");
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
      // 원래 결함은 "한 선언 블록을 쉼표로 공유"였다. `.active:hover` 처럼 하나의 선택자에
      // 둘이 같이 오는 것은 오히려 필요한 수정이다(명시도에서 hover 가 .active 를 이기므로).
      // 그래서 금지 대상은 쉼표로 나뉜 목록에 hover 전용과 active 전용이 함께 있는 경우다.
      const shared = rules.filter((rule) => {
        const parts = rule.selector.split(",").map((part) => part.trim());
        const plainHover = parts.some((part) => part.includes(":hover") && !part.includes(".active"));
        const plainActive = parts.some((part) => part.includes(".active") && !part.includes(":hover"));
        return plainHover && plainActive;
      });
      expect(shared, "hover 전용과 active 전용이 한 선언 블록을 공유하면 안 된다").toEqual([]);

      // 명시도 싸움의 결과까지 못박는다: 고른 도구에 마우스를 올렸을 때도 채운 배경이 남아야 한다.
      const activeHoverRule = rules.find((rule) => rule.selector.includes(".oprn-tile-tool.active") && rule.selector.includes(":hover"));
      expect(activeHoverRule, ".active:hover 전용 규칙이 없으면 hover 가 .active 를 덮어쓴다").toBeTruthy();
      expect(activeHoverRule!.body).toMatch(/background:\s*var\(--editor-blue\)/);

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
        ["palette-tool-paint", "칠하기 (B)"],
        ["palette-tool-select", "영역 선택 (V)"],
        ["tool-erase", "지우기 (E)"],
        ["palette-tool-fill", "이어진 영역 채우기 (G)"],
      ];
      for (const [testid, prefix] of expected) {
        expect(button(testid).getAttribute("title") ?? "", testid).toContain(prefix);
      }
    });

    it("「칠하기」는 초보 레일과 같은 brush 글리프를 쓴다", () => {
      const icon = button("palette-tool-paint").querySelector("svg");
      expect(icon).toBeTruthy();
      expect(icon!.outerHTML).toBe(makeSvgIcon("brush").outerHTML);
      expect(icon!.outerHTML).not.toBe(makeSvgIcon("pen").outerHTML);
    });
  });
});
