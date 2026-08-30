import { EDITOR_BRUSH_SIZES } from "@/editor/editorState";
import type { EditorState } from "@/editor/editorState";
import { copySelection, pasteClipboard } from "@/editor/mapClipboard";
import { mapHistoryEntryCount, renderMapHistoryPanel } from "@/editor/panels/mapHistoryPanel";
import { renderRuleAuditPanel, ruleAuditViolationCount } from "@/editor/panels/ruleAuditPanel";
import { isFavoriteTile, toggleFavoriteTile } from "@/editor/panels/tileBrushTools";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import {
  selectEyedropperTool,
  selectTileTool,
  setTileBrushSize,
} from "@/editor/panels/tileToolbarActions";
import { makeSvgIcon } from "@/editor/panels/tileToolbarIcons";
import type { SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import type { GameMap, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

type ToolbarMenuId = "inspector" | "overflow" | "ruleAudit" | "history" | null;
type OpenToolbarMenuId = Exclude<ToolbarMenuId, null>;
type SvgToolbarMenuId = Exclude<OpenToolbarMenuId, "ruleAudit" | "history">;

export type TileToolbarModel = {
  readonly state: EditorState;
  readonly map: Pick<GameMap, "id" | "tilesetId">;
  readonly tileset: TilesetDef;
  readonly rerender: () => void;
};

let openMenu: ToolbarMenuId = null;
// 열림 상태는 모듈에 남긴다(재렌더 생존). 닫는 길은 밖에서 들어오므로 재렌더 콜백과
// 문서 리스너가 필요하고, 리스너는 렌더마다 쌓이지 않게 1회만 설치한다(basicLeftRail 과 동일).
let openAnchor: { readonly menu: HTMLElement; readonly trigger: HTMLElement } | null = null;
let anchorKeepersInstalled = false;
let latestRerender: (() => void) | null = null;
let detachDocumentListeners: (() => void) | null = null;

export function resetTileToolbarMenusForTests(): void {
  openMenu = null;
  openAnchor = null;
  anchorKeepersInstalled = false;
  latestRerender = null;
  detachDocumentListeners?.();
  detachDocumentListeners = null;
}

function closeMenuFromOutside(restoreFocus: boolean): void {
  if (openMenu === null) return;
  openMenu = null;
  openAnchor = null;
  latestRerender?.();
  if (!restoreFocus || typeof document === "undefined") return;
  // 재렌더로 버튼 노드가 새로 생기므로 다시 조회해 포커스를 되돌린다.
  document.querySelector<HTMLElement>('[data-testid="oprn-tool-overflow"]')?.focus();
}

function isInsideOverflowSurface(target: EventTarget | null): boolean {
  if (typeof document === "undefined" || typeof Node === "undefined" || !(target instanceof Node)) return false;
  const surfaces = document.querySelectorAll('[data-testid="toolbar-overflow-menu"], [data-testid="toolbar-overflow-dropdown"]');
  for (const surface of surfaces) {
    if (surface.contains(target)) return true;
  }
  return false;
}

function installDocumentListeners(): void {
  if (detachDocumentListeners || typeof document === "undefined" || typeof document.addEventListener !== "function") return;
  const onPointerDown = (event: Event): void => {
    if (openMenu === null || isInsideOverflowSurface(event.target)) return;
    closeMenuFromOutside(false);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || openMenu === null) return;
    const target = event.target;
    if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) {
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
    }
    closeMenuFromOutside(true);
  };
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown);
  detachDocumentListeners = () => {
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeyDown);
  };
}

const TOOLBAR_MENU_ICONS = { inspector: "inspector", overflow: "more" } as const satisfies Record<SvgToolbarMenuId, SvgIconName>;

export function makeInspectorDropdown(model: TileToolbarModel): HTMLElement {
  const { state, tileset } = model;
  const wrapper = makeToolbarMenuWrapper("tile-inspector-menu");
  const active = openMenu === "inspector";
  wrapper.append(makeMenuToggle("inspector", "인스펙터", active, state.tool === "eyedropper", model.rerender));
  if (!active) return wrapper;

  const selectedTile = state.selectedTile;
  const tileLayer = selectedTile >= 0 ? (tileset.priority[selectedTile] ?? "lower") : "lower";
  const menu = el("div", { class: "oprn-toolbar-dropdown oprn-inspector-dropdown", attrs: { role: "menu" }, dataset: { testid: "tile-inspector-dropdown" } });
  menu.append(makeInspectorSummary(selectedTile, tileset, tileLayer));
  menu.append(makeOptionItem("즐겨찾기", isFavoriteTile(selectedTile), selectedTile < 0, () => {
    toggleFavoriteTile(selectedTile);
    model.rerender();
  }));
  menu.append(makeOptionItem("채우기", state.tool === "fill", false, () => {
    selectTileTool("fill");
    closeToolbarMenus();
    model.rerender();
  }));
  menu.append(makeOptionItem("스포이드", state.tool === "eyedropper", false, () => {
    selectEyedropperTool();
    closeToolbarMenus();
    model.rerender();
  }));
  wrapper.append(menu);
  return wrapper;
}

export function makeRuleAuditDropdown(model: TileToolbarModel): HTMLElement {
  const wrapper = makeToolbarMenuWrapper("tile-rule-audit-menu");
  const active = openMenu === "ruleAudit";
  const count = ruleAuditViolationCount();
  const toggle = makeMenuToggle("ruleAudit", "규칙 감사", active, count > 0, model.rerender);
  if (count > 0) toggle.append(makeToolbarBadge(count, "rule-audit-badge", true));
  wrapper.append(toggle);
  if (!active) return wrapper;

  const menu = el("div", {
    class: "oprn-toolbar-dropdown oprn-rule-audit-dropdown",
    attrs: { role: "menu" },
    dataset: { testid: "tile-rule-audit-dropdown" },
  });
  menu.append(renderRuleAuditPanel());
  wrapper.append(menu);
  return wrapper;
}

export function makeHistoryDropdown(model: TileToolbarModel): HTMLElement {
  const wrapper = makeToolbarMenuWrapper("tile-history-menu");
  const active = openMenu === "history";
  const count = mapHistoryEntryCount();
  const toggle = makeMenuToggle("history", "작업 기록", active, count > 0, model.rerender);
  if (count > 0) toggle.append(makeToolbarBadge(count, "history-badge", false));
  wrapper.append(toggle);
  if (!active) return wrapper;

  const menu = el("div", {
    class: "oprn-toolbar-dropdown oprn-history-dropdown",
    attrs: { role: "menu" },
    dataset: { testid: "tile-history-dropdown" },
  });
  menu.append(renderMapHistoryPanel());
  wrapper.append(menu);
  return wrapper;
}

/**
 * ⋯ 오버플로 메뉴 — 저빈도 컨트롤을 한 토글로 묶는다:
 * 복사/붙여넣기, 인스펙터/규칙/기록, 브러시 크기.
 * copy-button/paste-button/brush-size-N testid는 그대로 승계.
 */
export function makeOverflowDropdown(model: TileToolbarModel): HTMLElement {
  const { state, map, tileset } = model;
  latestRerender = model.rerender;
  installDocumentListeners();
  const wrapper = makeToolbarMenuWrapper("toolbar-overflow-menu");
  const panelOpen = openMenu === "overflow" || openMenu === "inspector" || openMenu === "ruleAudit" || openMenu === "history";
  const ruleCount = ruleAuditViolationCount();
  const historyCount = mapHistoryEntryCount();
  const highlighted = state.brushSize > 1 || ruleCount > 0;
  const label = "더 보기";
  const accessibleLabel = ruleCount > 0 ? `${label} — 규칙 위반 ${ruleCount}건` : label;
  const toggle = makeMenuToggle("overflow", label, panelOpen, highlighted, model.rerender, accessibleLabel);
  if (ruleCount > 0) toggle.append(makeToolbarBadge(ruleCount, "rule-audit-badge", true));
  wrapper.append(toggle);
  if (!panelOpen) return wrapper;

  const menu = el("div", {
    class: "oprn-toolbar-dropdown oprn-overflow-dropdown",
    attrs: { role: "menu" },
    dataset: { testid: "toolbar-overflow-dropdown" },
  });

  menu.append(makeOverflowSectionLabel("편집"));
  menu.append(makeOptionItem("복사 (선택 영역)", false, false, () => {
    void copySelection(map.id);
    closeToolbarMenus();
    model.rerender();
  }, "copy-button"));
  menu.append(makeOptionItem("붙여넣기", false, false, () => {
    const target = state.selection ?? { x: 0, y: 0 };
    void pasteClipboard(map.id, target.x, target.y);
    closeToolbarMenus();
    model.rerender();
  }, "paste-button"));

  menu.append(makeOverflowSectionLabel("검사"));
  menu.append(makeOptionItem("인스펙터", openMenu === "inspector", false, () => {
    openMenu = openMenu === "inspector" ? "overflow" : "inspector";
    model.rerender();
  }, "oprn-tool-inspector"));
  menu.append(makeOptionItem(
    ruleCount > 0 ? `규칙 감사 (${ruleCount})` : "규칙 감사",
    openMenu === "ruleAudit",
    false,
    () => {
      openMenu = openMenu === "ruleAudit" ? "overflow" : "ruleAudit";
      model.rerender();
    },
    "toolbar-toggle-ruleAudit",
  ));
  menu.append(makeOptionItem(
    historyCount > 0 ? `작업 기록 (${historyCount})` : "작업 기록",
    openMenu === "history",
    false,
    () => {
      openMenu = openMenu === "history" ? "overflow" : "history";
      model.rerender();
    },
    "toolbar-toggle-history",
  ));

  if (openMenu === "inspector") {
    const selectedTile = state.selectedTile;
    const tileLayer = selectedTile >= 0 ? (tileset.priority[selectedTile] ?? "lower") : "lower";
    menu.append(makeOverflowSectionLabel("인스펙터"));
    menu.append(makeInspectorSummary(selectedTile, tileset, tileLayer));
    menu.append(makeOptionItem("즐겨찾기", isFavoriteTile(selectedTile), selectedTile < 0, () => {
      toggleFavoriteTile(selectedTile);
      model.rerender();
    }));
    menu.append(makeOptionItem("채우기", state.tool === "fill", false, () => {
      selectTileTool("fill");
      closeToolbarMenus();
      model.rerender();
    }));
    menu.append(makeOptionItem("스포이드", state.tool === "eyedropper", false, () => {
      selectEyedropperTool();
      closeToolbarMenus();
      model.rerender();
    }));
  } else if (openMenu === "ruleAudit") {
    menu.append(makeOverflowSectionLabel("규칙 감사"));
    menu.append(renderRuleAuditPanel());
  } else if (openMenu === "history") {
    menu.append(makeOverflowSectionLabel("작업 기록"));
    menu.append(renderMapHistoryPanel());
  }

  menu.append(makeOverflowSectionLabel("브러시 크기"));
  for (const size of EDITOR_BRUSH_SIZES) {
    menu.append(makeOptionItem(`${size} x ${size}`, state.brushSize === size, false, () => {
      setTileBrushSize(size);
      closeToolbarMenus();
      model.rerender();
    }, `brush-size-${size}`));
  }

  wrapper.append(menu);
  scheduleMenuAnchor(menu, toggle);
  return wrapper;
}

/**
 * 위치 계산은 **삽입 후에** 해야 한다. makeOverflowDropdown 은 분리된 wrapper 를 만들고
 * 호출부가 나중에 도구막대에 붙이므로, 이 함수 안에서 바로 재면 트리거 rect 가 전부 0 이다
 * (그 상태로는 anchorMenuToViewport 가 아무것도 못 하고 조용히 빠져나간다 — 실제로 그렇게
 * 한 번 놓쳤다). 프레임 하나 뒤에 재고, 창 크기가 바뀌면 다시 잡는다.
 */
function scheduleMenuAnchor(menu: HTMLElement, trigger: HTMLElement): void {
  if (typeof window === "undefined") return;
  openAnchor = { menu, trigger };
  const apply = (): void => {
    if (!menu.isConnected || !trigger.isConnected) return;
    anchorMenuToViewport(menu, trigger);
  };
  if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(apply);
  else setTimeout(apply, 0);
  installAnchorKeepers();
}

/**
 * 창 크기·스크롤에 맞춰 열린 메뉴를 다시 잡는다.
 *
 * 리스너를 렌더마다 붙이면 안 된다: 좌패널은 editorState 가 바뀔 때마다 다시 그려지므로
 * 메뉴가 열려 있는 동안 resize 리스너가 무한히 쌓이고, 각각이 이미 버려진 메뉴 노드를
 * 붙잡는다. 그래서 모듈 수준에서 한 번만 달고, 지금 열린 메뉴만 다시 잡는다.
 *
 * 스크롤도 봐야 한다: 메뉴는 fixed 라 화면에 고정되지만 트리거는 세로로 스크롤되는
 * .palette-work-pane 안에 있어서, 스크롤하면 메뉴만 남고 버튼이 떠나 버린다.
 */
function installAnchorKeepers(): void {
  if (anchorKeepersInstalled || typeof window === "undefined") return;
  anchorKeepersInstalled = true;
  const reanchor = (): void => {
    const current = openAnchor;
    if (!current) return;
    if (!current.menu.isConnected || !current.trigger.isConnected) {
      openAnchor = null;
      return;
    }
    anchorMenuToViewport(current.menu, current.trigger);
  };
  window.addEventListener("resize", reanchor);
  window.addEventListener("scroll", reanchor, true);
}

/**
 * 드롭다운을 트리거 기준으로 뷰포트에 고정한다.
 *
 * 왜 absolute 가 아니라 fixed 인가: 이 메뉴의 조상 다섯(.palette-work-pane,
 * .palette-work-shell, .left-panel-stack, .left-panel, body)이 모두 overflow:hidden 이다.
 * absolute 로 두면 메뉴가 조상의 보이는 상자를 넘는 순간 그 띠가 영구히 안 보이고 클릭도
 * 되지 않는다 — 원래 F1 과 같은 실패 모양이다. 수리 전 실측:
 *   1366x768 표준: 메뉴 하단 480 vs palette-root 하단 462 → brush-size-4 가 막힘
 *   1440x900 표준에서 「작업 기록」을 펼치면 메뉴가 510px → brush-size-3·4 가 상자 밖
 * 조상 사슬에 transform/filter/contain/will-change 가 없음을 실측으로 확인했으므로 fixed 는
 * 뷰포트 기준으로 잡히고 모든 클리핑을 벗어난다.
 *
 * 높이는 트리거 아래 남은 공간으로 제한하고 부족하면 위로 뒤집는다. 뷰포트가 짧아 그래도
 * 넘칠 때만 내부 스크롤을 쓴다 — 그때는 메뉴 전체가 보이므로 스크롤바도 사용자에게 보인다.
 */
function anchorMenuToViewport(menu: HTMLElement, trigger: HTMLElement): void {
  if (typeof window === "undefined" || typeof menu.getBoundingClientRect !== "function") return;
  const rect = trigger.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return;

  const gap = 4;
  const margin = 8;
  const viewportH = window.innerHeight || 900;
  const viewportW = window.innerWidth || 1440;

  menu.style.position = "fixed";
  // CSS 는 이 메뉴를 오른쪽 기준으로 붙인다(absolute 시절 계약). fixed 로 바꾸면서 left 만
  // 주면 left+right 가 동시에 걸려 메뉴가 뷰포트 오른쪽 끝까지 늘어난다 — 실측 폭 1341px 로
  // 캔버스와 조수 카드를 덮었다. 그래서 재기 전에 right/bottom 을 풀어 shrink-to-fit 으로
  // 되돌린 뒤 자연 폭을 읽는다.
  menu.style.right = "auto";
  menu.style.bottom = "auto";
  menu.style.maxHeight = "none";
  const box = menu.getBoundingClientRect();
  const needed = Math.max(menu.scrollHeight || 0, box.height || 0);
  const width = box.width || 196;

  const spaceBelow = viewportH - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;
  const placeAbove = needed > spaceBelow && spaceAbove > spaceBelow;
  const budget = Math.max(120, Math.floor(placeAbove ? spaceAbove : spaceBelow));
  const height = Math.min(needed, budget);

  menu.style.maxHeight = `${budget}px`;
  menu.style.overflowY = needed > budget ? "auto" : "visible";
  menu.style.top = placeAbove
    ? `${Math.max(margin, rect.top - gap - height)}px`
    : `${Math.min(rect.bottom + gap, Math.max(margin, viewportH - margin - height))}px`;
  menu.style.left = `${Math.min(Math.max(margin, rect.right - width), Math.max(margin, viewportW - margin - width))}px`;
  menu.dataset.placement = placeAbove ? "above" : "below";
}

function makeOverflowSectionLabel(label: string): HTMLElement {
  return el("div", { class: "oprn-overflow-section", attrs: { "aria-hidden": "true" }, text: label });
}

function makeInspectorSummary(selectedTile: number, tileset: TilesetDef, tileLayer: "lower" | "upper"): HTMLElement {
  return el("div", {
    class: "oprn-inspector-summary",
    children: [
      el("div", { class: "oprn-inspector-preview", attrs: { style: tilePreviewStyle(selectedTile, tileset) } }),
      makeInspectorField("타일", selectedTile >= 0 ? tileDisplayLabelForIndex(selectedTile) : "없음"),
      makeInspectorField("ID", selectedTile >= 0 ? String(selectedTile).padStart(4, "0") : "----"),
      makeInspectorField("레이어", tileLayer === "upper" ? "상위" : "하위"),
      makeInspectorField("통행", selectedTile >= 0 ? "통과" : "-"),
    ],
  });
}

function makeToolbarMenuWrapper(testId: string): HTMLElement {
  return el("div", { class: "oprn-toolbar-menu", dataset: { testid: testId } });
}

function makeMenuToggle(
  menu: OpenToolbarMenuId,
  label: string,
  expanded: boolean,
  active: boolean,
  rerender: () => void,
  accessibleLabel = label,
): HTMLButtonElement {
  return el("button", {
    class: "oprn-tile-tool" + (active ? " active" : ""),
    attrs: {
      "aria-expanded": String(expanded),
      "aria-haspopup": "menu",
      "aria-label": accessibleLabel,
      title: label,
    },
    children: [makeMenuIcon(menu)],
    dataset: { testid: menuToggleTestId(menu) },
    on: {
      click: () => {
        // overflow 토글은 인스펙터/규칙/기록 패널이 열려 있어도 닫아 1줄 상태를 복구한다.
        if (menu === "overflow" && (openMenu === "inspector" || openMenu === "ruleAudit" || openMenu === "history")) {
          openMenu = null;
        } else {
          openMenu = expanded ? null : menu;
        }
        rerender();
      },
    },
  });
}

function makeMenuIcon(menu: OpenToolbarMenuId): Node {
  if (menu === "ruleAudit") return el("span", { class: "oprn-menu-glyph", attrs: { "aria-hidden": "true" }, text: "🔎" });
  if (menu === "history") return el("span", { class: "oprn-menu-glyph", attrs: { "aria-hidden": "true" }, text: "🕘" });
  return makeSvgIcon(TOOLBAR_MENU_ICONS[menu]);
}

function menuToggleTestId(menu: OpenToolbarMenuId): string {
  if (menu === "ruleAudit") return "toolbar-toggle-ruleAudit";
  if (menu === "history") return "toolbar-toggle-history";
  // inspector → oprn-tool-inspector (기존 계약), overflow → oprn-tool-overflow
  return `oprn-tool-${menu}`;
}

function makeToolbarBadge(count: number, testId: string, danger: boolean): HTMLElement {
  return el("span", {
    class: "toolbar-badge" + (danger ? " danger" : ""),
    attrs: { "aria-hidden": "true" },
    dataset: { testid: testId },
    text: String(count),
  });
}

function makeInspectorField(label: string, value: string): HTMLElement {
  return el("div", {
    class: "oprn-inspector-field",
    children: [
      el("span", { class: "oprn-inspector-field-label", text: label }),
      el("span", { class: "oprn-inspector-field-value", text: value }),
    ],
  });
}

function makeOptionItem(label: string, active: boolean, disabled: boolean, action: () => void, testId?: string): HTMLButtonElement {
  const button = el("button", {
    class: "oprn-option-item" + (active ? " active" : ""),
    attrs: { "aria-checked": String(active), "aria-disabled": String(disabled), role: "menuitemcheckbox", title: label },
    text: label,
    dataset: testId ? { testid: testId } : undefined,
    on: { click: action },
  });
  button.disabled = disabled;
  return button;
}

function closeToolbarMenus(): void {
  openMenu = null;
  openAnchor = null;
}

function tilePreviewStyle(selectedTile: number, tileset: TilesetDef): string {
  if (selectedTile < 0 || selectedTile >= tileset.count) return "";
  return tilesetTileBackgroundStyle(tileset, selectedTile, 32);
}

