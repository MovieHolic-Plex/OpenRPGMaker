import {
  buildProposalQuestion,
  renderAiProposalModal,
} from "@/editor/panels/tilesetAiProposalModal";
import { hasCpenTilesetApiKey } from "@/editor/panels/tilesetAiCpenClient";
import type {
  TilesetAiConfidence,
  TilesetAiPatternGrammar,
  TilesetAiPatternGrammarKind,
  TilesetAiPatternPartRole,
  TilesetAiPreviewMap,
  TilesetAiSourceRect,
} from "@/editor/panels/tilesetAiMappingRules";
import { resolveTilesetTileContext } from "@/editor/panels/tilesetTileContext";
import { store } from "@/project/store";
import { harnessLayerForTile } from "@/project/tilesetHarness";
import type { TileAiMetadata, TileGroupLayer, TileGroupRole, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

type AiDragState = {
  readonly mode: "add" | "replace";
  readonly startTile: number;
  moved: boolean;
};

type AiTileMapping = {
  readonly tile: number;
  readonly label: string;
  readonly description: string;
  readonly terrainTag: number;
  readonly defaultLayer: TileGroupLayer;
  readonly role: string;
  readonly placementRules: string;
  readonly repeatability: "auto" | "center" | "fixed" | "repeat";
};

type AiGroupMapping = {
  readonly name: string;
  readonly tileIds: readonly number[];
  readonly role: TileGroupRole;
  readonly defaultLayer: TileGroupLayer;
  readonly description: string;
  readonly placementRules: string;
  readonly confidence: TilesetAiConfidence;
  readonly sourceRect: TilesetAiSourceRect | null;
  readonly previewMap: TilesetAiPreviewMap | null;
  readonly patternGrammar: TilesetAiPatternGrammar | null;
};

type AiPatternBlockMapping = {
  readonly confidence: TilesetAiConfidence;
  readonly defaultLayer: TileGroupLayer;
  readonly label: string;
  readonly placementRules: string;
  readonly role: TileGroupRole;
  readonly sourceRect: TilesetAiSourceRect;
  readonly tileIds: readonly number[];
  readonly patternGrammar: TilesetAiPatternGrammar | null;
};

type AiMappingResult = {
  readonly confidence: TilesetAiConfidence;
  readonly minimumQuestions: readonly string[];
  readonly summary: string;
  readonly tiles: readonly AiTileMapping[];
  readonly groups: readonly AiGroupMapping[];
  readonly patternBlocks: readonly AiPatternBlockMapping[];
  readonly previewMaps: readonly TilesetAiPreviewMap[];
};

const VALID_GROUP_ROLES = new Set<TileGroupRole>(["building", "castle", "fence", "roof", "terrain", "water", "wall", "prop"]);
const VALID_GROUP_LAYERS = new Set<TileGroupLayer>(["event", "lower", "mixed", "upper"]);

let selectedAiTiles = new Set<number>();
let aiDragState: AiDragState | null = null;
let activeDragRerender: (() => void) | null = null;
let suppressNextAiClick = false;
let currentQuestion = "";
let answerDraft = "";
let proposalModalOpen = false;

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
            class: "tileset-ai-question-text",
            text:
              selectedTiles.length === 0
                ? "칩을 고르면 AI가 라벨, 설명, 묶음, 배치 규칙을 제안합니다. 지형 번호는 지형 탭에서 확인합니다."
                : "라벨, 설명, 묶음, 배치 규칙만 제안합니다. 지형 번호는 지형 탭에서 확인합니다.",
          }),
          el("div", {
            class: "tileset-ai-api-status",
            text: hasApiKey
              ? "외부 AI 연결됨"
              : "외부 AI 미연결: VITE_LLM_API_KEY 또는 rpg-zzu.llmApiKey 필요",
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
  if (suppressNextAiClick) {
    suppressNextAiClick = false;
    return;
  }
  if (event instanceof MouseEvent && (event.ctrlKey || event.metaKey)) toggleAiTile(tile);
  else replaceAiSelection(tile);
  currentQuestion = "";
  rerender();
}

export function startAiSelectionDrag(tile: number, event: Event, rerender: () => void): void {
  if (!(event instanceof PointerEvent || event instanceof MouseEvent) || event.button !== 0 || aiDragState) return;
  const mode = event.ctrlKey || event.metaKey ? "add" : "replace";
  aiDragState = { mode, startTile: tile, moved: false };
  activeDragRerender = rerender;
  currentQuestion = "";
  window.addEventListener("pointermove", handleDocumentAiDragMove);
  window.addEventListener("mousemove", handleDocumentAiDragMove);
  window.addEventListener("pointerup", stopAiSelectionDrag);
  window.addEventListener("mouseup", stopAiSelectionDrag);
}

export function extendAiSelectionDrag(tile: number): void {
  if (!aiDragState) return;
  if (!aiDragState.moved) {
    if (aiDragState.mode === "replace") replaceAiSelection(aiDragState.startTile);
    else addAiTile(aiDragState.startTile);
    markAiTileSelected(aiDragState.startTile);
  }
  aiDragState.moved = true;
  addAiTile(tile);
  markAiTileSelected(tile);
  syncAiSelectionLine();
  currentQuestion = "";
}

export function stopAiSelectionDrag(): void {
  const shouldRerender = aiDragState?.moved === true;
  const rerender = activeDragRerender;
  if (shouldRerender) suppressNextAiClick = true;
  aiDragState = null;
  activeDragRerender = null;
  window.removeEventListener("pointermove", handleDocumentAiDragMove);
  window.removeEventListener("mousemove", handleDocumentAiDragMove);
  window.removeEventListener("pointerup", stopAiSelectionDrag);
  window.removeEventListener("mouseup", stopAiSelectionDrag);
  if (shouldRerender && rerender) rerender();
}

function handleDocumentAiDragMove(event: PointerEvent | MouseEvent): void {
  const rerender = activeDragRerender;
  if (!rerender) return;
  const tile = tileFromPoint(event.clientX, event.clientY);
  if (tile === null) return;
  extendAiSelectionDrag(tile);
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
  const selectedTiles = new Set(tiles);
  const mapping = parseAiMappingResult(answer, selectedTiles, tileset);
  if (mapping) applyStructuredMapping(tileset, mapping, selectedTiles);
  else applyFallbackMapping(tileset, tiles, answer);
}

function applyStructuredMapping(tileset: TilesetDef, mapping: AiMappingResult, selectedTiles: ReadonlySet<number>): void {
  for (const block of mapping.tiles) {
    if (!selectedTiles.has(block.tile)) continue;
    const fallback = resolveTilesetTileContext(tileset, block.tile);
    const meta = ensureTileMeta(tileset, block.tile);
    if (meta.userLocked) continue;
    const defaultLayer = harnessLayerForTile(tileset, block.tile) ?? block.defaultLayer;
    meta.label = block.label || fallback.currentLabel;
    meta.description = [
      block.description || fallback.currentAiLabel,
      `배치: ${block.placementRules || "기본 배치 규칙 없음"}`,
      `레이어: ${defaultLayer} / 역할: ${block.role}`,
    ].join("\n");
    meta.role = block.role;
    meta.repeatability = readRepeatability(block.repeatability);
    meta.defaultLayer = defaultLayer;
    meta.terrainTag = Number.isInteger(block.terrainTag) ? block.terrainTag : fallback.terrainTag;
    meta.confidence = mapping.confidence;
    meta.source = "ai";
    tileset.terrain[block.tile] = Number.isInteger(block.terrainTag) ? block.terrainTag : fallback.terrainTag;
    tileset.priority[block.tile] = defaultLayer === "upper" ? "upper" : "lower";
  }
  const groups = uniqueAiGroups([...mapping.groups, ...patternBlocksToGroups(mapping.patternBlocks, mapping.previewMaps)]);
  if (groups.length > 0) {
    tileset.tileGroups = [
      ...(tileset.tileGroups ?? []).filter((group) => !group.id.startsWith("ai-")),
      ...groups.map((group, index) => ({
        id: `ai-${Date.now()}-${index}`,
        name: group.name,
        role: group.role,
        defaultLayer: constrainedGroupLayer(tileset, group),
        tileIds: group.tileIds.filter((tile) => selectedTiles.has(tile)),
        description: group.description,
        placementRules: group.placementRules,
        confidence: group.confidence,
        source: "ai" as const,
        ...(group.sourceRect ? { sourceRect: group.sourceRect } : {}),
        ...(group.previewMap ? { previewMap: {
          width: group.previewMap.width,
          height: group.previewMap.height,
          lowerTiles: [...group.previewMap.lowerTiles],
          upperTiles: [...group.previewMap.upperTiles],
        } } : {}),
        ...(group.patternGrammar ? { patternGrammar: {
          ...group.patternGrammar,
          parts: group.patternGrammar.parts.map((part) => ({ role: part.role, tileIds: [...part.tileIds] })),
        } } : {}),
      })),
    ];
  }
}

function constrainedGroupLayer(tileset: TilesetDef, group: AiGroupMapping): TileGroupLayer {
  const harnessLayers = group.tileIds.map((tile) => harnessLayerForTile(tileset, tile)).filter((layer): layer is "lower" | "upper" => layer !== null);
  const uniqueLayers = new Set(harnessLayers);
  if (uniqueLayers.size === 1) return harnessLayers[0] ?? group.defaultLayer;
  return group.defaultLayer;
}

function applyFallbackMapping(tileset: TilesetDef, tiles: readonly number[], answer: string): void {
  const normalizedAnswer = answer.trim();
  for (const tile of tiles) {
    const description = resolveTilesetTileContext(tileset, tile);
    const meta = ensureTileMeta(tileset, tile);
    if (meta.userLocked) continue;
    meta.label = description.currentLabel;
    meta.description = normalizedAnswer
      ? `${description.currentAiLabel}\nAI 원문 분석: ${shortAnswer(normalizedAnswer, 240)}`
      : description.currentAiLabel;
    meta.source = "ai";
    tileset.terrain[tile] = description.terrainTag;
  }
}

function parseAiMappingResult(answer: string, selectedTiles: ReadonlySet<number>, tileset: TilesetDef): AiMappingResult | null {
  try {
    const parsed: unknown = JSON.parse(answer);
    if (!parsed || typeof parsed !== "object") return null;
    const source = parsed as Record<string, unknown>;
    const tiles = parseTileBlocks(source.tiles, selectedTiles, tileset);
    if (tiles.length === 0) return null;
    return {
      confidence: readConfidence(source.confidence),
      minimumQuestions: parseStringArray(source.minimumQuestions, 2, 120),
      summary: readString(source.summary),
      tiles,
      groups: parseGroupBlocks(source.groups, selectedTiles),
      patternBlocks: parsePatternBlocks(source.patternBlocks, selectedTiles),
      previewMaps: parsePreviewMaps(source.previewMaps),
    };
  } catch {
    return null;
  }
}

function patternBlocksToGroups(
  patternBlocks: readonly AiPatternBlockMapping[],
  previewMaps: readonly TilesetAiPreviewMap[],
): readonly AiGroupMapping[] {
  return patternBlocks.map((block, index) => ({
    name: block.label,
    tileIds: block.tileIds,
    role: block.role,
    defaultLayer: block.defaultLayer,
    description: `${block.label} 원본 블록`,
    placementRules: block.placementRules || "원본 sourceRect 상대 배열을 유지해서 배치",
    confidence: block.confidence,
    sourceRect: block.sourceRect,
    previewMap: previewMaps[index] ?? null,
    patternGrammar: block.patternGrammar,
  }));
}

function uniqueAiGroups(groups: readonly AiGroupMapping[]): readonly AiGroupMapping[] {
  const seen = new Set<string>();
  return groups.filter((group) => {
    const key = [
      group.name,
      group.role,
      group.defaultLayer,
      [...group.tileIds].sort((a, b) => a - b).join(","),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseTileBlocks(value: unknown, selectedTiles: ReadonlySet<number>, tileset: TilesetDef): readonly AiTileMapping[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const tile = Number(source.tile);
    if (!Number.isInteger(tile) || !selectedTiles.has(tile)) return [];
    const fallback = resolveTilesetTileContext(tileset, tile);
    return [{
      tile,
      label: shortAnswer(readString(source.label) || fallback.currentLabel, 36),
      description: shortAnswer(readString(source.description) || fallback.currentAiLabel, 220),
      terrainTag: Number.isInteger(Number(source.terrainTag)) ? Number(source.terrainTag) : fallback.terrainTag,
      defaultLayer: readLayer(source.defaultLayer, fallback.layer),
      role: shortAnswer(readString(source.role) || fallback.repeatRole, 24),
      placementRules: shortAnswer(readString(source.placementRules), 220),
      repeatability: readRepeatability(source.repeatability),
    }];
  });
}

function parseGroupBlocks(value: unknown, selectedTiles: ReadonlySet<number>): readonly AiGroupMapping[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const tileIds = Array.isArray(source.tileIds)
      ? source.tileIds.map(Number).filter((tile) => Number.isInteger(tile) && selectedTiles.has(tile))
      : [];
    if (tileIds.length === 0) return [];
    return [{
      name: shortAnswer(readString(source.name) || "AI 타일 묶음", 32),
      tileIds,
      role: readGroupRole(source.role),
      defaultLayer: readLayer(source.defaultLayer, "lower"),
      description: shortAnswer(readString(source.description), 220),
      placementRules: shortAnswer(readString(source.placementRules), 220),
      confidence: readConfidence(source.confidence),
      sourceRect: parseSourceRect(source.sourceRect),
      previewMap: parsePreviewMap(source.previewMap),
      patternGrammar: parsePatternGrammar(source.patternGrammar, selectedTiles),
    }];
  });
}

function parsePatternBlocks(value: unknown, selectedTiles: ReadonlySet<number>): readonly AiPatternBlockMapping[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const tileIds = Array.isArray(source.tileIds)
      ? source.tileIds.map(Number).filter((tile) => Number.isInteger(tile) && selectedTiles.has(tile))
      : [];
    const sourceRect = parseSourceRect(source.sourceRect);
    if (tileIds.length === 0 || !sourceRect) return [];
    const label = shortAnswer(readString(source.label) || "AI 원본 블록", 32);
    return [{
      confidence: readConfidence(source.confidence),
      defaultLayer: readLayer(source.defaultLayer, "lower"),
      label,
      placementRules: shortAnswer(readString(source.placementRules), 220),
      role: inferPatternRole(label),
      sourceRect,
      tileIds,
      patternGrammar: parsePatternGrammar(source.patternGrammar, selectedTiles),
    }];
  });
}

function parsePatternGrammar(value: unknown, selectedTiles: ReadonlySet<number>): TilesetAiPatternGrammar | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const kind = readPatternGrammarKind(source.kind);
  if (!kind) return null;
  const axis = readPatternAxis(source.axis);
  const repeat = readPatternRepeat(source.repeat);
  const parts = parsePatternParts(source.parts, selectedTiles);
  if (parts.length === 0) return null;
  const minWidth = readOptionalPositiveInteger(source.minWidth);
  const minHeight = readOptionalPositiveInteger(source.minHeight);
  return {
    ...(axis ? { axis } : {}),
    kind,
    ...(minHeight ? { minHeight } : {}),
    ...(minWidth ? { minWidth } : {}),
    parts,
    preserveCaps: source.preserveCaps === true,
    repeat,
  };
}

function parsePatternParts(value: unknown, selectedTiles: ReadonlySet<number>): readonly TilesetAiPatternGrammar["parts"][number][] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const role = readPatternPartRole(source.role);
    if (!role) return [];
    const tileIds = Array.isArray(source.tileIds)
      ? source.tileIds.map(Number).filter((tile) => Number.isInteger(tile) && selectedTiles.has(tile))
      : [];
    if (tileIds.length === 0) return [];
    return [{ role, tileIds }];
  });
}

function readPatternGrammarKind(value: unknown): TilesetAiPatternGrammarKind | null {
  const kind = readString(value);
  if (
    kind === "animated_terrain" ||
    kind === "autotile_3x3" ||
    kind === "event_required_object" ||
    kind === "horizontal_expandable" ||
    kind === "nine_slice_expandable" ||
    kind === "overlay_detail" ||
    kind === "single" ||
    kind === "source_rect" ||
    kind === "vertical_expandable"
  ) {
    return kind;
  }
  return null;
}

function readPatternPartRole(value: unknown): TilesetAiPatternPartRole | null {
  const role = readString(value);
  if (
    role === "bottom" ||
    role === "bottomCap" ||
    role === "bottomLeft" ||
    role === "bottomRight" ||
    role === "center" ||
    role === "left" ||
    role === "leftCap" ||
    role === "repeatBody" ||
    role === "right" ||
    role === "rightCap" ||
    role === "top" ||
    role === "topCap" ||
    role === "topLeft" ||
    role === "topRight"
  ) {
    return role;
  }
  return null;
}

function readPatternAxis(value: unknown): TilesetAiPatternGrammar["axis"] | null {
  const axis = readString(value);
  return axis === "horizontal" || axis === "vertical" || axis === "both" ? axis : null;
}

function readPatternRepeat(value: unknown): TilesetAiPatternGrammar["repeat"] {
  const repeat = readString(value);
  return repeat === "body" || repeat === "center" || repeat === "source_order" ? repeat : "source_order";
}

function readOptionalPositiveInteger(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function inferPatternRole(label: string): TileGroupRole {
  return label.includes("성벽") || label.includes("성곽") ? "castle" : "terrain";
}

function parseStringArray(value: unknown, maxItems: number, maxLength: number): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(readString)
    .filter((item) => item.length > 0)
    .slice(0, maxItems)
    .map((item) => shortAnswer(item, maxLength));
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readLayer(value: unknown, fallback: TileGroupLayer): TileGroupLayer {
  const layer = readString(value);
  return VALID_GROUP_LAYERS.has(layer as TileGroupLayer) ? (layer as TileGroupLayer) : fallback;
}

function readRepeatability(value: unknown): AiTileMapping["repeatability"] {
  const repeatability = readString(value);
  return repeatability === "center" || repeatability === "fixed" || repeatability === "repeat" ? repeatability : "auto";
}

function readConfidence(value: unknown): TilesetAiConfidence {
  const confidence = readString(value);
  return confidence === "high" || confidence === "medium" || confidence === "low" ? confidence : "medium";
}

function readGroupRole(value: unknown): TileGroupRole {
  const role = readString(value);
  return VALID_GROUP_ROLES.has(role as TileGroupRole) ? (role as TileGroupRole) : "terrain";
}

function parseSourceRect(value: unknown): TilesetAiSourceRect | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const x = Number(source.x);
  const y = Number(source.y);
  const width = Number(source.width);
  const height = Number(source.height);
  if (![x, y, width, height].every((item) => Number.isInteger(item))) return null;
  if (x < 0 || y < 0 || width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function parsePreviewMaps(value: unknown): readonly TilesetAiPreviewMap[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const previewMap = parsePreviewMap(item);
    return previewMap ? [previewMap] : [];
  });
}

function parsePreviewMap(value: unknown): TilesetAiPreviewMap | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const width = Number(source.width);
  const height = Number(source.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;
  const cellCount = width * height;
  const lowerTiles = parseTileArray(source.lowerTiles, cellCount);
  const upperTiles = parseTileArray(source.upperTiles, cellCount);
  if (!lowerTiles || !upperTiles) return null;
  return {
    height,
    lowerTiles,
    name: shortAnswer(readString(source.name) || "16x16 AI 예시", 40),
    upperTiles,
    width,
  };
}

function parseTileArray(value: unknown, expectedLength: number): readonly number[] | null {
  if (!Array.isArray(value) || value.length !== expectedLength) return null;
  const tiles = value.map(Number);
  return tiles.every((tile) => Number.isInteger(tile)) ? tiles : null;
}

function ensureTileMeta(tileset: TilesetDef, tile: number): TileAiMetadata {
  tileset.tileMeta ??= Array.from({ length: tileset.count }, () => ({ label: "", description: "" }));
  while (tileset.tileMeta.length < tileset.count) {
    tileset.tileMeta.push({ label: "", description: "" });
  }
  const existing = tileset.tileMeta[tile];
  if (existing) return existing;
  const created: TileAiMetadata = { label: "", description: "" };
  tileset.tileMeta[tile] = created;
  return created;
}

function shortAnswer(answer: string, maxLength = 24): string {
  return answer.length <= maxLength ? answer : `${answer.slice(0, maxLength)}...`;
}
