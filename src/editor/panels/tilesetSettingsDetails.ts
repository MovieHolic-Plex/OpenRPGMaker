import { renderPalettePresetEditor } from "@/editor/panels/palettePresetEditor";
import { renderTilesetCheckerSummary } from "@/editor/panels/tilesetCheckerSummary";
import { openTilesetReviewWizard } from "@/editor/panels/tilesetReviewWizard";
import { getTilesetSectionTab, renderTilesetMetadataEditor } from "@/editor/panels/tilesetMetadataEditor";
import { renderTilesetProperties } from "@/editor/panels/tilesetSettingsProperties";
import type { TilesetSectionTab } from "@/editor/panels/tilesetUsageGuide";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export function renderTilesetEditor(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const tab = getTilesetSectionTab();
  return el("section", {
    class: "tileset-db-editor simplified oprn-tileset-editor",
    children: [
      renderTilesetProperties(tileset, rerender),
      renderTilesetWorkbench(tileset, tab, rerender),
    ],
  });
}

/* 그림판이 이 탭의 주인공인데 30열 × 16px 시트는 2x 에서 960px 를 원한다. 보조 패널이
   항상 200~230px 를 물고 있으면 1680px 에서도 시트 절반이 화면 밖이었다 — 그래서 접는다.
   기본은 접힘, 상태는 localStorage 에 남긴다. 접기는 rerender 없이 클래스만 토글해서
   시트 스크롤 위치를 잃지 않는다. */

const SIDE_PANE_KEY = "oprn.tileset.sidePaneOpen";

const SIDE_PANE_NAMES: Partial<Record<TilesetSectionTab, string>> = {
  knowledge: "생성 감사",
};

/** 테스트의 가짜 DOM 처럼 `window` 는 있고 `localStorage` 는 없는 환경도 있다. */
function sidePaneStore(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readSidePaneOpen(): boolean {
  return sidePaneStore()?.getItem(SIDE_PANE_KEY) === "1";
}

function writeSidePaneOpen(open: boolean): void {
  sidePaneStore()?.setItem(SIDE_PANE_KEY, open ? "1" : "0");
}

function renderTilesetWorkbench(tileset: TilesetDef, tab: TilesetSectionTab, rerender: () => void): HTMLElement {
  const paneName = SIDE_PANE_NAMES[tab];
  const editor = renderTilesetMetadataEditor(tileset, rerender);
  if (!paneName) {
    return el("div", { class: "oprn-tileset-main no-side-pane", children: [editor] });
  }
  let open = readSidePaneOpen();
  const rail = el("button", {
    class: "tileset-side-rail",
    text: paneName,
    attrs: { type: "button" },
    dataset: { testid: "tileset-side-pane-toggle" },
  });
  // 레일은 늘 보이고 내용만 스크롤·숨김 대상이 되도록 본문을 한 겹 감싼다.
  const sidePane = renderTabSidePanel(tileset, tab, rerender);
  const paneBody = el("div", { class: "tileset-side-pane-body" });
  // 옮기기 전에 원래 부모를 비운다 — 가짜 DOM 의 append 는 이전 부모에서 빼주지 않는다.
  const paneContents = Array.from(sidePane.childNodes);
  sidePane.replaceChildren();
  paneBody.append(...paneContents);
  sidePane.append(rail, paneBody);
  const main = el("div", {
    class: "oprn-tileset-main",
    children: [editor, sidePane],
  });
  const sync = (): void => {
    main.classList.toggle("side-open", open);
    rail.classList.toggle("open", open);
    rail.setAttribute("aria-expanded", String(open));
    const label = open ? `${paneName} 접기` : `${paneName} 펼치기`;
    rail.setAttribute("aria-label", label);
    rail.title = label;
  };
  rail.addEventListener("click", () => {
    open = !open;
    writeSidePaneOpen(open);
    sync();
  });
  sync();
  return main;
}

function renderTabSidePanel(tileset: TilesetDef, tab: TilesetSectionTab, rerender: () => void): HTMLElement {
  void tab;
  return el("aside", {
    class: "oprn-tileset-terrain-pane",
    children: [
      renderTilesetCheckerSummary(tileset),
      el("button", {
        class: "database-footer-button",
        text: "AI 재감사",
        attrs: { type: "button" },
        dataset: { testid: "tileset-reaudit" },
        on: { click: () => openTilesetReviewWizard(tileset.id) },
      }),
      renderPalettePresetEditor(tileset, rerender),
    ],
  });
}
