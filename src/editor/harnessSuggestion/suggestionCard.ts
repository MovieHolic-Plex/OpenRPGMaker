// harnessSuggestion/suggestionCard.ts
// §③ 조용한 제안 카드 — 그림이 주인공. 왼쪽 = 방금 찍은 패턴의 실렌더 크롭,
// 가운데 = 등록하면 얻을 스탬프의 조립 렌더, 오른쪽 = 캡션 한 줄 + [등록][무시].
// 예절: 렌더 없는 제안 금지(§④) — 캔버스를 만들 수 없으면 표출하지 않는다.

import { assembledKitCells, cellsFromMapRect, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import type { DetectedSectionPattern } from "@/editor/harnessSuggestion/patternDetect";
import { structureKitFromPattern } from "@/editor/harnessSuggestion/structureKitModel";
import type { GameMap, StructureKitDef, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export type SuggestionCardInput = {
  readonly map: Pick<GameMap, "width" | "height" | "lowerTiles" | "upperTiles">;
  readonly tileset: TilesetDef;
  readonly pattern: DetectedSectionPattern;
  readonly onRegister: (kit: StructureKitDef) => void;
  readonly onIgnore: () => void;
};

/** 조립 미리보기 폭(타일) — 설계 목업의 "12×6쯤" 규약. */
const PREVIEW_COLUMNS = 12;
/** 크롭 최대 폭(타일) — 카드가 무한정 넓어지지 않게. */
const CROP_MAX_COLUMNS = 12;

let activeCard: HTMLElement | null = null;

export function isSuggestionCardVisible(): boolean {
  return activeCard !== null && activeCard.isConnected;
}

/** 카드를 소리 없이 치운다(붓질 재개·맵 전환 시). 톰스톤 아님 — 다음 휴지기에 다시 뜰 수 있다. */
export function dismissSuggestionCard(): void {
  activeCard?.remove();
  activeCard = null;
}

/** 제안 카드 1장을 표출한다. 렌더 실패(캔버스 불가) 시 아무것도 띄우지 않고 false. */
export function showSuggestionCard(input: SuggestionCardInput): boolean {
  dismissSuggestionCard();
  const { pattern } = input;

  const cropRect = {
    x: pattern.x,
    y: pattern.y,
    width: Math.min(pattern.width, CROP_MAX_COLUMNS),
    height: pattern.height,
  };
  const cropCanvas = renderTileCellsToCanvas({
    tileset: input.tileset,
    widthTiles: cropRect.width,
    heightTiles: cropRect.height,
    cells: cellsFromMapRect(input.map, cropRect),
    scale: 2,
    backgroundTile: null,
  });
  const kit = structureKitFromPattern(pattern);
  const previewCanvas = renderTileCellsToCanvas({
    tileset: input.tileset,
    widthTiles: PREVIEW_COLUMNS,
    heightTiles: pattern.height,
    cells: assembledKitCells(kit, PREVIEW_COLUMNS),
    scale: 2,
  });
  // §④ 그림 없는 제안 금지 — 2D 컨텍스트를 못 얻은 캔버스(0×0 등)는 표출 자격이 없다.
  if (cropCanvas.width <= 1 || previewCanvas.width <= 1) return false;

  cropCanvas.className = "harness-suggestion-canvas";
  cropCanvas.dataset.testid = "harness-suggestion-crop";
  previewCanvas.className = "harness-suggestion-canvas";
  previewCanvas.dataset.testid = "harness-suggestion-preview";

  const card = el("div", {
    class: "harness-suggestion-card",
    dataset: { testid: "harness-suggestion-card" },
    attrs: { role: "status", "aria-label": "패턴 스탬프 제안" },
  });
  card.append(
    makeFigure(cropCanvas, "방금 찍은 패턴"),
    el("div", { class: "harness-suggestion-arrow", text: "→", attrs: { "aria-hidden": "true" } }),
    makeFigure(previewCanvas, "스탬프로 찍으면"),
    makeActions(input, kit),
  );
  document.body.append(card);
  activeCard = card;
  return true;
}

function makeFigure(canvas: HTMLCanvasElement, caption: string): HTMLElement {
  return el("figure", {
    class: "harness-suggestion-figure",
    children: [
      el("div", { class: "harness-suggestion-figure-body", children: [canvas] }),
      el("figcaption", { class: "harness-suggestion-figure-caption", text: caption }),
    ],
  });
}

function makeActions(input: SuggestionCardInput, kit: StructureKitDef): HTMLElement {
  const { pattern } = input;
  const box = el("div", { class: "harness-suggestion-actions" });
  box.append(
    el("div", { class: "harness-suggestion-title", text: "이 패턴, 스탬프로 기억할까요?" }),
    el("div", {
      class: "harness-suggestion-sub",
      text: `${kit.name ?? "패턴"} · ${pattern.height}줄 단면 × ${pattern.repeats}회 반복 감지`,
      dataset: { testid: "harness-suggestion-sub" },
    }),
    el("div", {
      class: "harness-suggestion-buttons",
      children: [
        el("button", {
          class: "btn harness-suggestion-register",
          text: "등록",
          attrs: { type: "button", title: "팔레트 '내 스탬프'에 추가" },
          dataset: { testid: "harness-suggestion-register" },
          on: {
            click: () => {
              dismissSuggestionCard();
              input.onRegister(kit);
            },
          },
        }),
        el("button", {
          class: "btn harness-suggestion-ignore",
          text: "무시",
          attrs: { type: "button", title: "이 세션에서 같은 패턴을 다시 제안하지 않음" },
          dataset: { testid: "harness-suggestion-ignore" },
          on: {
            click: () => {
              dismissSuggestionCard();
              input.onIgnore();
            },
          },
        }),
      ],
    }),
  );
  return box;
}
