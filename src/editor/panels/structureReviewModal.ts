// editor/panels/structureReviewModal.ts
// 구조물 학습 검토 모달 — extract_terrain_template 초안을 "넓은 화면"으로 검토한다.
// 좌: 영역 타일 그리드(크게), 우: 행별 카드(타일 썸네일 + 사람 말 설명 + 의미 수정 + 포함 토글).
// 채팅에 좌표·번호를 덤프하지 않게 하는 UX의 본체 — 저장(사용자 확정)까지 여기서 끝낸다.
// 저장은 upsert_terrain_template를 store에 직접 실행한다(undo 스냅샷 포함).

import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { runTool } from "@/editor/tools";
import type { TerrainTemplateDraft, TerrainTemplateDraftRowSpan } from "@/editor/tools/terrainTemplateExtract";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export interface StructureReviewResult {
  templateId: string;
  name: string;
  savedRows: number;
}

export interface StructureReviewOptions {
  draft: TerrainTemplateDraft;
  onSaved?: (result: StructureReviewResult) => void;
  // "추측이 틀렸다 — 직접 깔아서 보여줄게" 경로: 시연 캔버스로 전환한다(같은 영역 시드).
  onDemoRequest?: (region: { mapId: string; x: number; y: number; w: number; h: number }) => void;
}

const CELL_SIZE = 34;

interface CardState {
  include: boolean;
  meaning: string;
}

export function openStructureReviewModal(options: StructureReviewOptions): HTMLElement {
  document.querySelector("[data-testid='structure-review-modal']")?.remove();
  const { draft } = options;
  const project = store.getCurrent();
  const map = project.maps[draft.sourceRegion.mapId];
  const tileset: TilesetDef | undefined = project.tilesets[map?.tilesetId ?? DEFAULT_TILESET_ID] ?? project.tilesets[DEFAULT_TILESET_ID];

  const cardStates: CardState[] = draft.rowSpans.map((span) => ({ include: true, meaning: span.meaning }));

  // ── 좌: 영역 그리드(행 강조 대응) ────────────────────────────
  const gridRowsByY = new Map<number, HTMLElement>();
  const gridRows: HTMLElement[] = [];
  if (map && tileset) {
    for (let row = 0; row < draft.sourceRegion.h; row += 1) {
      const y = draft.sourceRegion.y + row;
      const cells: HTMLElement[] = [];
      for (let col = 0; col < draft.sourceRegion.w; col += 1) {
        const x = draft.sourceRegion.x + col;
        const index = y * map.width + x;
        const lower = map.lowerTiles[index] ?? TILE.EMPTY;
        const upper = map.upperTiles[index] ?? TILE.EMPTY;
        const children: HTMLElement[] = [];
        if (upper >= 0) {
          children.push(el("div", { class: "structure-review-cell-upper", attrs: { style: tilesetTileBackgroundStyle(tileset, upper, CELL_SIZE) } }));
        }
        cells.push(
          el("div", {
            class: "structure-review-cell",
            attrs: { style: lower >= 0 ? tilesetTileBackgroundStyle(tileset, lower, CELL_SIZE) : "", title: `(${x},${y})` },
            children,
          })
        );
      }
      const rowElement = el("div", {
        class: "structure-review-grid-row",
        children: [el("span", { class: "structure-review-grid-ylabel", text: String(y) }), ...cells],
      });
      gridRowsByY.set(y, rowElement);
      gridRows.push(rowElement);
    }
  }
  const grid = el("div", { class: "structure-review-grid", dataset: { testid: "structure-review-grid" }, children: gridRows });

  const focusRows = (span: TerrainTemplateDraftRowSpan | null): void => {
    for (const [y, rowElement] of gridRowsByY) {
      if (span && y >= span.y0 && y <= span.y1) rowElement.classList.add("is-focused");
      else rowElement.classList.remove("is-focused");
    }
  };

  // ── 우: 행별 카드 ────────────────────────────────────────────
  const tileThumb = (tile: number, caption: string): HTMLElement =>
    el("figure", {
      class: "structure-review-thumb-item",
      children: [
        el("div", {
          class: "structure-review-thumb",
          attrs: { style: tileset ? tilesetTileBackgroundStyle(tileset, tile, 32) : "", title: `타일 ${tile}` },
        }),
        el("figcaption", { class: "structure-review-thumb-caption", text: caption }),
      ],
    });

  const cards = draft.rowSpans.map((span, index) => {
    const thumbs: HTMLElement[] = [];
    if (span.sparse) {
      for (const tile of span.tiles.slice(0, 8)) thumbs.push(tileThumb(tile, "산재"));
    } else {
      if (span.left !== undefined) thumbs.push(tileThumb(span.left, "왼쪽 끝"));
      if (span.middle !== undefined) thumbs.push(tileThumb(span.middle, "반복"));
      if (span.right !== undefined) thumbs.push(tileThumb(span.right, "오른쪽 끝"));
    }
    const include = el("input", {
      class: "structure-review-include",
      attrs: { type: "checkbox" },
      dataset: { testid: `structure-review-include-${index}` },
    }) as HTMLInputElement;
    include.checked = true;
    include.addEventListener("change", () => {
      cardStates[index].include = include.checked;
      // fakeDom에는 classList.toggle이 없으므로 add/remove를 쓴다.
      if (include.checked) card.classList.remove("is-excluded");
      else card.classList.add("is-excluded");
    });
    const meaningInput = el("textarea", {
      class: "structure-review-meaning",
      attrs: { rows: "2", title: "이 행의 의미(수정 가능)" },
      dataset: { testid: `structure-review-meaning-${index}` },
    }) as HTMLTextAreaElement;
    meaningInput.value = span.meaning.replace(" (초안: 인터뷰로 의미를 확정하세요)", "");
    meaningInput.addEventListener("input", () => {
      cardStates[index].meaning = meaningInput.value;
    });
    const card = el("section", {
      class: "structure-review-card",
      dataset: { testid: `structure-review-card-${index}` },
      on: {
        mouseenter: () => focusRows(span),
        mouseleave: () => focusRows(null),
      },
      children: [
        el("header", {
          class: "structure-review-card-header",
          children: [
            el("label", { class: "structure-review-include-label", children: [include, el("strong", { text: `${index + 1}. ${span.humanText.split(" — ")[0]}` })] }),
            el("span", { class: "structure-review-card-layer", text: span.layer === "upper" ? "상위" : "하위" }),
          ],
        }),
        el("div", { class: "structure-review-thumbs", children: thumbs }),
        meaningInput,
      ],
    });
    return card;
  });

  // ── 헤더/푸터 ────────────────────────────────────────────────
  const nameInput = el("input", {
    class: "structure-review-name",
    attrs: { type: "text", placeholder: "템플릿 이름" },
    dataset: { testid: "structure-review-name" },
  }) as HTMLInputElement;
  nameInput.value = draft.name;
  const tagsInput = el("input", {
    class: "structure-review-tags",
    attrs: { type: "text", placeholder: "태그(쉼표 구분, 예: 집, 회벽)" },
    dataset: { testid: "structure-review-tags" },
  }) as HTMLInputElement;

  const closeButton = el("button", {
    class: "database-modal-close",
    text: "x",
    attrs: { type: "button", "aria-label": "닫기" },
    dataset: { testid: "structure-review-close" },
  });
  const cancelButton = el("button", {
    class: "ai-assistant-action",
    text: "취소",
    attrs: { type: "button" },
    dataset: { testid: "structure-review-cancel" },
  });
  const demoButton = el("button", {
    class: "ai-assistant-action",
    text: "✍️ 직접 고쳐서 가르치기",
    attrs: { type: "button", title: "추측이 많이 틀렸다면, 이 영역 사본에 직접 타일을 깔아 보여주며 가르칩니다." },
    dataset: { testid: "structure-review-demo" },
  });
  const saveButton = el("button", {
    class: "ai-assistant-action ai-proposal-accept",
    text: "확정 저장",
    attrs: { type: "button" },
    dataset: { testid: "structure-review-save" },
  });

  const backdrop = el("div", {
    class: "database-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "structure-review-modal" },
    children: [
      el("section", {
        class: "database-modal-window structure-review-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "구조물 템플릿 검토" },
        children: [
          el("header", {
            class: "database-modal-header structure-review-header",
            children: [el("h2", { text: "📐 구조물 검토 — AI 추측을 확인하세요" }), nameInput, tagsInput, closeButton],
          }),
          el("div", {
            class: "database-modal-body structure-review-body",
            children: [
              el("div", { class: "structure-review-left", children: [grid, el("p", { class: "structure-review-hint", text: "카드에 마우스를 올리면 해당 행이 강조됩니다." })] }),
              el("div", { class: "structure-review-cards", children: cards }),
            ],
          }),
          el("footer", {
            class: "structure-review-footer",
            children: [
              el("span", { class: "structure-review-count", text: `행 패턴 ${draft.rowSpans.length}개 — 제외할 행은 체크를 해제하세요.` }),
              ...(options.onDemoRequest ? [demoButton] : []),
              cancelButton,
              saveButton,
            ],
          }),
        ],
      }),
    ],
  });

  const close = (): void => {
    backdrop.remove();
    document.removeEventListener?.("keydown", onKeyDown);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };
  closeButton.addEventListener("click", close);
  cancelButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener?.("keydown", onKeyDown);

  const save = (): void => {
    const name = nameInput.value.trim() || draft.name;
    const includedIndexes = cardStates.map((state, index) => ({ state, index })).filter(({ state }) => state.include).map(({ index }) => index);
    if (includedIndexes.length === 0) {
      toast("최소 한 행은 포함해야 합니다.", "error");
      return;
    }
    const rows = includedIndexes.map((index) => ({ ...draft.rows[index], meaning: cardStates[index].meaning }));
    const grammar = includedIndexes.map((index) => ({ ...draft.grammar[index], meaning: cardStates[index].meaning }));
    const tags = tagsInput.value.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0);
    const ctx = { project: store.getCurrent() };
    const result = runTool(ctx, "upsert_terrain_template", {
      name,
      sourceMapName: draft.sourceMapName,
      sourceRegion: draft.sourceRegion,
      rows,
      grammar,
      rules: draft.rules.filter((rule) => !rule.includes("guessSummary")),
      tags,
      confirmedByUser: true,
    });
    if (!result.ok) {
      toast(`저장 실패: ${result.summary}`, "error");
      return;
    }
    recordProjectSnapshot();
    store.replace(ctx.project);
    toast(`템플릿 '${name}' 저장됨`, "ok");
    options.onSaved?.({
      templateId: (result.data as { templateId: string }).templateId,
      name,
      savedRows: includedIndexes.length,
    });
    close();
  };
  saveButton.addEventListener("click", save);
  demoButton.addEventListener("click", () => {
    close();
    options.onDemoRequest?.({ ...draft.sourceRegion });
  });

  document.body.append(backdrop);
  return backdrop;
}
