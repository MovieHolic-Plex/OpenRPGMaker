import { renderPalettePresetEditor } from "@/editor/panels/palettePresetEditor";
import { renderTilesetCheckerSummary } from "@/editor/panels/tilesetCheckerSummary";
import { openTilesetReviewWizard } from "@/editor/panels/tilesetReviewWizard";
import { openTilesetAiWorkspace } from "@/editor/panels/tilesetAiWorkspaceModal";
import { getTilesetSectionTab, renderTilesetMetadataEditor } from "@/editor/panels/tilesetMetadataEditor";
import { openTilesetSettingsModal } from "@/editor/panels/tilesetPassageModal";
import { renderTilesetProperties } from "@/editor/panels/tilesetSettingsProperties";
import type { TilesetSectionTab } from "@/editor/panels/tilesetUsageGuide";
import { passageMarkForTile } from "@/project/tilesetPassage";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export function renderTilesetEditor(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const tab = getTilesetSectionTab();
  return el("section", {
    class: "tileset-db-editor simplified oprn-tileset-editor",
    children: [
      renderTilesetProperties(tileset, rerender),
      renderTilesetWorkbench(tileset, tab, rerender),
      renderTilesetAiLauncher(tileset, rerender),
    ],
  });
}

function renderTilesetAiLauncher(tileset: TilesetDef, rerender: () => void): HTMLElement {
  return el("div", {
    class: "tileset-ai-launcher",
    children: [
      el("div", {
        children: [
          el("strong", { text: "AI에게 타일셋을 보여주기" }),
          el("span", { text: "전체를 먼저 분석한 뒤, 모르는 부분만 대화로 확인합니다." }),
        ],
      }),
      el("button", {
        class: "database-footer-button primary tileset-ai-launch-button",
        text: "AI 타일셋",
        attrs: { type: "button" },
        dataset: { testid: "tileset-ai-workspace-open" },
        on: { click: () => openTilesetAiWorkspace(tileset.id, rerender) },
      }),
    ],
  });
}

/* 그림판이 이 탭의 주인공인데 30열 × 16px 시트는 2x 에서 960px 를 원한다. 보조 패널이
   항상 200~230px 를 물고 있으면 1680px 에서도 시트 절반이 화면 밖이었다 — 그래서 접는다.
   기본은 접힘, 상태는 localStorage 에 남긴다. 접기는 rerender 없이 클래스만 토글해서
   시트 스크롤 위치를 잃지 않는다. */

const SIDE_PANE_KEY = "oprn.tileset.sidePaneOpen";

const SIDE_PANE_NAMES: Record<TilesetSectionTab, string> = {
  compose: "자동타일",
  knowledge: "생성 감사",
  rules: "그림판 범례",
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
    children: [renderTilesetMetadataEditor(tileset, rerender), sidePane],
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
  if (tab === "rules") {
    const rows = Math.ceil(tileset.count / tileset.tilesPerRow);
    return el("aside", {
      class: "oprn-tileset-terrain-pane tileset-rules-legend-pane",
      children: [
        el("fieldset", {
          class: "oprn-db-fieldset",
          dataset: { testid: "tileset-rules-side" },
          children: [
            el("legend", { text: "그림판 범례" }),
            el("div", {
              class: "tileset-legend-sheet-info",
              dataset: { testid: "tileset-sheet-info" },
              text: `${tileset.count}칸 · ${tileset.tilesPerRow}열 × ${rows}행 · ${tileset.tileSize}px`,
            }),
            el("ul", {
              class: "tileset-layer-legend",
              dataset: { testid: "tileset-layer-legend" },
              children: [
                el("li", {
                  class: "tileset-legend-item layer-lower",
                  children: [
                    el("span", { class: "tileset-legend-swatch layer-lower", attrs: { "aria-hidden": "true" } }),
                    el("span", { text: "하위 — 지면·벽·몸통 (초록 테)" }),
                  ],
                }),
                el("li", {
                  class: "tileset-legend-item layer-upper",
                  children: [
                    el("span", { class: "tileset-legend-swatch layer-upper", attrs: { "aria-hidden": "true" } }),
                    el("span", { text: "상위 — 수관·지붕·오버레이 (파란 테)" }),
                  ],
                }),
                el("li", {
                  class: "tileset-legend-item layer-both",
                  children: [
                    el("span", { class: "tileset-legend-swatch layer-both", attrs: { "aria-hidden": "true" } }),
                    el("span", { text: "양쪽 — 어느 레이어에도 사용 가능" }),
                  ],
                }),
              ],
            }),
            el("ul", {
              class: "tileset-passage-legend",
              children: [
                el("li", { text: "O 통행 · X 차단 · ★ 상위 표시(하층 통행 따름)" }),
              ],
            }),
            el("button", {
              class: "database-footer-button oprn-global-terrain-button",
              text: "그림판 전체 창 · 통행 (O/X/★)",
              attrs: { type: "button", title: "타일 그림판 전체 시트를 별도 창에서 보고 통행을 편집" },
              dataset: { testid: "tileset-settings-open" },
              on: { click: () => openTilesetSettingsModal(tileset.id, rerender) },
            }),
            el("div", {
              class: "tileset-rule-note",
              text: "가운데 시트가 그림판 전체입니다(스크롤로 하단 행까지). 우클릭 → 의미/통행/레이어. 필터 전체|하위|상위, 배율 2x(기본)·3x·4x, 휠·←→↑↓·중클릭 드래그. ‘하위’ 필터면 상위 타일이 어두워져 안 보이는 것처럼 느껴질 수 있으니 전체를 쓰세요.",
            }),
          ],
        }),
      ],
    });
  }
  if (tab === "knowledge") {
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
  return el("aside", {
    class: "oprn-tileset-terrain-pane",
    children: [
      el("fieldset", {
        class: "oprn-db-fieldset oprn-tileset-autotile",
        children: [
          el("legend", { text: "자동타일 애니메이션" }),
          el("div", { class: "tileset-db-autotile-swatch" }),
          el("div", { class: "tileset-db-resource", text: passageSummary(tileset) }),
        ],
      }),
    ],
  });
}

function passageSummary(tileset: TilesetDef): string {
  const marks = Array.from({ length: tileset.count }, (_unused, index) => passageMarkForTile(tileset, index));
  const open = marks.filter((mark) => mark === "o").length;
  const blocked = marks.filter((mark) => mark === "x").length;
  const upper = marks.filter((mark) => mark === "star").length;
  return `O ${open} / X ${blocked} / * ${upper}`;
}
