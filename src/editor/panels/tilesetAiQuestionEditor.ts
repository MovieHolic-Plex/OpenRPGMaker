import {
  buildProposalQuestion,
  renderAiProposalModal,
} from "@/editor/panels/tilesetAiProposalModal";
import { hasCpenTilesetApiKey } from "@/editor/panels/tilesetAiCpenClient";
import { applyAiMappingAnswer } from "@/editor/panels/tilesetAiMappingParser";
import { createAiSelectionDragController } from "@/editor/panels/tilesetAiSelectionDrag";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

let selectedAiTiles = new Set<number>();
let currentQuestion = "";
let answerDraft = "";
let proposalModalOpen = false;

const aiSelectionDrag = createAiSelectionDragController({
  addTile: addAiTile,
  markTileSelected: markAiTileSelected,
  readTileFromPoint: tileFromPoint,
  replaceSelection: replaceAiSelection,
  syncSelectionLine: syncAiSelectionLine,
  resetQuestion: () => {
    currentQuestion = "";
  },
});

export function renderAiQuestionPanel(tileset: TilesetDef, rerender: () => void, onApplyTiles: (tiles: readonly number[]) => void): HTMLElement {
  const selectedTiles = selectedAiTileIds();
  const hasApiKey = hasCpenTilesetApiKey();
  const answerInput = el("textarea", {
    class: "tileset-ai-answer",
    value: answerDraft,
    attrs: { placeholder: "AI 응답 JSON" },
    on: {
      input: (event) => {
        if (event.target instanceof HTMLTextAreaElement) answerDraft = event.target.value;
      },
    },
  });
  return el("fieldset", {
    class: "tileset-db-group tileset-ai-question",
    dataset: { testid: "tileset-ai-question-panel" },
    children: [
      el("legend", { text: "AI 메타" }),
      el("div", {
        class: "tileset-ai-question-body",
        children: [
          el("div", { class: "tileset-ai-selection-line", text: selectionLineText(selectedTiles) }),
          el("button", {
            class: "tileset-db-small-button primary",
            text: "AI 적용",
            attrs: selectedTiles.length === 0 ? { type: "button", disabled: "true" } : { type: "button" },
            dataset: { testid: "tileset-ai-selection-submit" },
            on: {
              click: () => {
                currentQuestion = buildProposalQuestion(tileset.id, selectedTiles);
                answerDraft = "";
                proposalModalOpen = true;
                rerender();
              },
            },
          }),
          el("div", {
            class: "tileset-ai-api-status",
            text: hasApiKey
              ? "외부 AI 연결됨"
              : "외부 AI 미연결: AI 설정에서 구독 로그인 또는 API 키 연결을 마쳐 주세요",
          }),
          el("button", {
            class: "tileset-db-small-button",
            text: "선택 비우기",
            attrs: { type: "button" },
            dataset: { testid: "tileset-ai-selection-clear" },
            on: {
              click: () => {
                clearAiSelection();
                rerender();
              },
            },
          }),
          ...(proposalModalOpen
            ? [
                renderAiProposalModal({
                  tileset,
                  selectedTiles,
                  answerInput,
                  question: currentQuestion || buildProposalQuestion(tileset.id, selectedTiles),
                  onClose: () => {
                    proposalModalOpen = false;
                    rerender();
                  },
                  onAllow: (answer) => {
                    applyAnswerToTiles(tileset.id, selectedTiles, answer);
                    onApplyTiles(selectedTiles);
                    proposalModalOpen = false;
                    rerender();
                  },
                }),
              ]
            : []),
        ],
      }),
    ],
  });
}

export function isAiTileSelected(tile: number): boolean {
  return selectedAiTiles.has(tile);
}

export function handleAiTileClick(tile: number, event: Event, rerender: () => void): void {
  if (aiSelectionDrag.consumeSuppressedClick()) return;
  if (event instanceof MouseEvent && (event.ctrlKey || event.metaKey)) toggleAiTile(tile);
  else replaceAiSelection(tile);
  currentQuestion = "";
  rerender();
}

export function startAiSelectionDrag(tile: number, event: Event, rerender: () => void): void {
  aiSelectionDrag.start(tile, event, rerender);
}

export function extendAiSelectionDrag(tile: number): void {
  aiSelectionDrag.extend(tile);
}

export function stopAiSelectionDrag(): void {
  aiSelectionDrag.stop();
}

function selectedAiTileIds(): readonly number[] {
  return [...selectedAiTiles].sort((a, b) => a - b);
}

function selectionLineText(selectedTiles: readonly number[]): string {
  return selectedTiles.length === 0 ? "선택한 칩 없음" : `선택한 칩 ${selectedTiles.length}개: ${selectedTiles.join(", ")}`;
}

function replaceAiSelection(tile: number): void {
  selectedAiTiles = new Set([tile]);
}

function addAiTile(tile: number): void {
  selectedAiTiles.add(tile);
}

function toggleAiTile(tile: number): void {
  if (selectedAiTiles.has(tile)) selectedAiTiles.delete(tile);
  else selectedAiTiles.add(tile);
}

function clearAiSelection(): void {
  selectedAiTiles = new Set();
  currentQuestion = "";
  answerDraft = "";
  proposalModalOpen = false;
}

function markAiTileSelected(tile: number): void {
  document.querySelector(`[data-testid="tileset-db-cell-${tile}"]`)?.classList.add("ai-selected");
}

function syncAiSelectionLine(): void {
  const line = document.querySelector(".tileset-ai-selection-line");
  if (!line) return;
  line.textContent = selectionLineText(selectedAiTileIds());
}

function tileFromPoint(x: number, y: number): number | null {
  const element = document.elementFromPoint(x, y);
  if (!(element instanceof HTMLElement)) return null;
  const cell = element.closest(".tileset-db-cell");
  if (!(cell instanceof HTMLElement)) return null;
  const testid = cell.dataset.testid;
  if (!testid?.startsWith("tileset-db-cell-")) return null;
  const tile = Number(testid.slice("tileset-db-cell-".length));
  return Number.isInteger(tile) ? tile : null;
}

function applyAnswerToTiles(tilesetId: string, tiles: readonly number[], answer: string): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    applyAiMappingAnswerForTest(tileset, tiles, answer);
  });
}

export function applyAiMappingAnswerForTest(tileset: TilesetDef, tiles: readonly number[], answer: string): void {
  applyAiMappingAnswer(tileset, tiles, answer);
}
