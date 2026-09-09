import { analyzeTilesetSelection, type TilesetAiPatternGrammar } from "@/editor/panels/tilesetAiMappingRules";
import {
  buildTilesetAiProposalQuestion,
  createTilesetAiProposalController,
} from "@/editor/panels/tilesetAiProposalController";
import {
  parseAiMappingResult,
  type AiMappingResult,
  type AiPreviewMap,
} from "@/editor/panels/tilesetAiProposalParsing";
import { createTerrainExampleEditor, type TempMapSnapshot } from "@/editor/panels/tilesetAiTerrainExample";
import { buildSetupMappingAnswer, type AiSetupChoice } from "@/editor/panels/tilesetAiSetupMapping";
import { tileExplanation } from "@/editor/panels/tilesetAiTileText";
import { resolveTilesetTileContext } from "@/editor/panels/tilesetTileContext";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

type AiStatus = "done" | "error" | "loading" | "ready";

type AiProposalModalModel = {
  readonly tileset: TilesetDef;
  readonly selectedTiles: readonly number[];
  readonly answerInput: HTMLTextAreaElement;
  readonly question: string;
  readonly onAllow: (answer: string) => void;
  readonly onClose: () => void;
};

type ActionButtons = {
  readonly analyzeButton: HTMLButtonElement;
  readonly applyButton: HTMLButtonElement;
};

const QUICK_QUESTION_ANSWERS = new Set(["no", "unknown", "yes"]);

export function renderAiProposalModal(model: AiProposalModalModel): HTMLElement {
  const analysis = analyzeTilesetSelection({
    selectedTiles: model.selectedTiles,
    tilesPerRow: model.tileset.tilesPerRow,
  });
  const setupChoice: AiSetupChoice = {
    intent: analysis.patternBlocks[0] ? "autoTerrain" : "unsure",
    repeatability: analysis.patternBlocks[0]?.sourceRect?.width === 3 && analysis.patternBlocks[0]?.sourceRect?.height === 3 ? "edgesAndCenter" : "auto",
    structure: analysis.patternBlocks[0]?.sourceRect?.width === 3 && analysis.patternBlocks[0]?.sourceRect?.height === 3 ? "threeByThree" : "mixed",
    scope: "preview",
  };
  let snapshot: TempMapSnapshot = { imageDataUrl: "", summary: "" };
  let analyzing = false;
  const controller = createTilesetAiProposalController({
    tileset: model.tileset,
    selectedTiles: model.selectedTiles,
    setupChoice,
    readSnapshot: () => snapshot,
  });

  const status = renderAiStatus("ready", "왼쪽 예시나 아래 선택을 확인한 뒤 분석을 시작합니다.");
  const resultPanel = renderAiResultPanel(setupChoice, analysis);
  const actions = renderActions(model, {
    onAnalyze: async () => {
      await analyze();
    },
    onUseSetup: () => {
      const answer = buildSetupMappingAnswer(model.tileset, model.selectedTiles, setupChoice);
      model.answerInput.value = answer;
      model.answerInput.dispatchEvent(new Event("input", { bubbles: true }));
      buttons.applyButton.disabled = false;
      setStatus(status, "done", "선택한 오토타일/반복 설정으로 메타 초안을 만들었습니다. 확인한 뒤 적용하세요.");
      updateAiResultPanel(resultPanel, "done", answer, model.answerInput);
    },
    readAnswer: () => model.answerInput.value.trim(),
  });
  const buttons = readActionButtons(actions);

  async function analyze(): Promise<void> {
    if (analyzing) return;
    const lockedAnswer = model.answerInput.value.trim();
    analyzing = true;
    model.answerInput.readOnly = true;
    model.answerInput.value = "";
    model.answerInput.dispatchEvent(new Event("input", { bubbles: true }));
    setAnalyzingState(status, buttons, true);
    updateAiResultPanel(resultPanel, "loading");
    setStatus(status, "loading", "AI가 선택 타일, 배치 예시, 현재 맵 사용량을 함께 보고 있습니다. 보통 90초 안팎 걸립니다.");
    const result = await controller.analyze(lockedAnswer);
    const answer = result.answer;
    model.answerInput.value = answer;
    model.answerInput.dispatchEvent(new Event("input", { bubbles: true }));
    model.answerInput.readOnly = false;
    analyzing = false;
    setAnalyzingState(status, buttons, false);
    buttons.analyzeButton.textContent = "내 수정 잠그고 보완";
    const failed = result.failed;
    const invalidJson = result.invalidJson;
    buttons.applyButton.disabled = failed || invalidJson;
    setStatus(
      status,
      failed || invalidJson ? "error" : "done",
      failed
        ? "AI 분석에 실패했습니다. 다시 분석을 눌러 주세요."
        : invalidJson
          ? "AI가 JSON 형식이 아닌 응답을 반환했습니다. 다시 분석을 눌러 주세요."
          : "AI 분석이 끝났습니다. 아래 내용을 확인한 뒤 허용하면 매핑됩니다.",
    );
    updateAiResultPanel(resultPanel, failed ? "error" : "done", answer, model.answerInput);
  }

  const workspace = el("div", {
    class: "tileset-ai-modal-workspace",
    children: [
      createTerrainExampleEditor({
        tileset: model.tileset,
        selectedTiles: model.selectedTiles,
        onLayoutChange: (nextSnapshot) => {
          snapshot = nextSnapshot;
        },
      }),
      el("aside", {
        class: "tileset-ai-side-panel",
        children: [
          status,
          resultPanel,
          renderSelectedTileSummary(model.tileset, model.selectedTiles),
          fieldlessTextarea(model.answerInput),
          actions,
        ],
      }),
    ],
  });

  const modal = el("div", {
    class: "tileset-ai-modal-backdrop",
    dataset: { testid: "tileset-ai-question-modal" },
    children: [
      el("section", {
        class: "tileset-ai-modal",
        dataset: { tilesetId: model.tileset.id },
        children: [
          renderHeader(model.onClose),
          el("div", {
            class: "tileset-ai-modal-body",
            children: [workspace],
          }),
        ],
      }),
    ],
  });

  return modal;
}

export function buildProposalQuestion(tilesetId: string, tiles: readonly number[]): string {
  return buildTilesetAiProposalQuestion(tilesetId, tiles);
}

function renderHeader(onClose: () => void): HTMLElement {
  return el("header", {
    class: "tileset-ai-modal-header",
    children: [
      el("h4", { text: "AI 메타 제안" }),
      el("button", {
        class: "database-modal-close",
        text: "x",
        attrs: { type: "button", "aria-label": "닫기" },
        on: { click: onClose },
      }),
    ],
  });
}

function renderSelectedTileSummary(tileset: TilesetDef, selectedTiles: readonly number[]): HTMLElement {
  const visibleTiles = selectedTiles.slice(0, 10);
  const extra = selectedTiles.length - visibleTiles.length;
  return el("section", {
    class: "tileset-ai-selected-summary",
    children: [
      el("strong", { text: `선택 타일 ${selectedTiles.length}개` }),
      el("div", {
        class: "tileset-ai-selected-strip",
        children: [
          ...visibleTiles.map((tile) => renderSelectedTilePreview(tileset, tile)),
          ...(extra > 0 ? [el("span", { class: "tileset-ai-selected-extra", text: `+${extra}` })] : []),
        ],
      }),
    ],
  });
}

function renderSelectedTilePreview(tileset: TilesetDef, tile: number): HTMLElement {
  const description = resolveTilesetTileContext(tileset, tile);
  return el("span", {
    class: "tileset-ai-selected-swatch",
    attrs: {
      "data-ai-selected-tile": `${tile}`,
      title: `${tile}번 ${description.currentLabel}: ${tileExplanation(tile)}`,
      style: tileBackgroundStyle(tileset, tile, tileset.tileSize * 2),
    },
  });
}

function fieldlessTextarea(input: HTMLTextAreaElement): HTMLElement {
  return el("label", {
    class: "tileset-ai-modal-answer-field",
    attrs: { "aria-hidden": "true", style: "display:none" },
    children: [el("span", { text: "AI 응답 JSON" }), input],
  });
}

function renderAiStatus(status: AiStatus, text: string): HTMLElement {
  return el("div", {
    class: `tileset-ai-api-status ${status}`,
    dataset: { testid: "tileset-ai-api-status" },
    attrs: { "aria-live": "polite" },
    children: [el("span", { class: "tileset-ai-status-text", text })],
  });
}

function renderAiResultPanel(setupChoice: AiSetupChoice, analysis: ReturnType<typeof analyzeTilesetSelection>): HTMLElement {
  return el("section", {
    class: "tileset-ai-result-panel ready",
    dataset: { testid: "tileset-ai-result-panel" },
    children: [
      el("strong", { text: "분석 전 선택" }),
      el("p", { text: "AI가 바로 단정하지 않도록 타일의 용도, 구조, 제안 범위를 먼저 고릅니다." }),
      renderSetupChoiceGroup("무엇을 만들까요?", "intent", setupChoice.intent, [
        { label: "자동 연결 지형", value: "autoTerrain" },
        { label: "길 오토타일", value: "pathAutotile" },
        { label: "물 오토타일", value: "waterAutotile" },
        { label: "집/건물", value: "buildingHouse" },
        { label: "길/강/울타리", value: "linearPath" },
        { label: "벽/절벽", value: "wallCliff" },
        { label: "장식/소품", value: "objectDetail" },
        { label: "모르겠음", value: "unsure" },
      ], setupChoice),
      renderSetupChoiceGroup("선택한 타일 구조", "structure", setupChoice.structure, [
        { label: "단일 칩", value: "single" },
        { label: "3x3 지형", value: "threeByThree" },
        { label: "가로 반복", value: "horizontal" },
        { label: "세로 반복", value: "vertical" },
        { label: "모서리+중앙", value: "nineSlice" },
        { label: "애니메이션", value: "animation" },
        { label: "혼합", value: "mixed" },
      ], setupChoice),
      renderSetupChoiceGroup("AI 제안 범위", "scope", setupChoice.scope, [
        { label: "이름/설명", value: "labels" },
        { label: "묶음+규칙", value: "rules" },
        { label: "예시 맵 포함", value: "preview" },
        { label: "지형 번호 추천", value: "terrainTags" },
      ], setupChoice),
      renderSetupChoiceGroup("반복 가능성", "repeatability", setupChoice.repeatability, [
        { label: "AI가 판단", value: "auto" },
        { label: "변+중앙 반복", value: "edgesAndCenter" },
        { label: "중앙만 반복", value: "centerOnly" },
        { label: "반복 안 함", value: "noRepeat" },
        { label: "전부 반복 후보", value: "allRepeat" },
      ], setupChoice),
      el("p", {
        class: "tileset-ai-result-note",
        text: `감지: ${analysis.patternBlocks[0]?.label ?? "개별 타일 중심"} · 확신도 ${koreanConfidence(analysis.confidence)}`,
      }),
    ],
  });
}

function renderSetupChoiceGroup<Key extends keyof AiSetupChoice>(
  title: string,
  key: Key,
  activeValue: AiSetupChoice[Key],
  options: readonly { readonly label: string; readonly value: AiSetupChoice[Key] }[],
  setupChoice: AiSetupChoice,
): HTMLElement {
  return el("fieldset", {
    class: "tileset-ai-setup-group",
    children: [
      el("legend", { text: title }),
      el("div", {
        class: "tileset-ai-setup-options",
        children: options.map((option) =>
          el("label", {
            class: "tileset-ai-setup-option",
            children: [
              el("input", {
                attrs:
                  option.value === activeValue
                    ? { checked: "true", name: `tileset-ai-${key}`, type: "radio", value: option.value }
                    : { name: `tileset-ai-${key}`, type: "radio", value: option.value },
                on: {
                  change: () => {
                    setupChoice[key] = option.value;
                  },
                },
              }),
              el("span", { text: option.label }),
            ],
          }),
        ),
      }),
    ],
  });
}

function updateAiResultPanel(panel: HTMLElement, status: AiStatus, answer?: string, answerInput?: HTMLTextAreaElement): void {
  panel.classList.remove("done", "error", "loading", "ready");
  panel.classList.add(status);
  if (status === "loading") {
    panel.replaceChildren(
      el("strong", { text: "AI 분석 중" }),
      el("div", {
        class: "tileset-ai-loading-spinner",
        attrs: { "aria-hidden": "true" },
        children: Array.from({ length: 8 }, (_, index) => el("span", { class: `tileset-ai-loading-dot dot-${index + 1}` })),
      }),
      el("p", { text: "AI 응답을 기다립니다. 보통 90초 안팎 걸립니다." }),
      el("ul", {
        children: [
          el("li", { text: "선택 타일의 원본 위치와 묶음 크기 확인" }),
          el("li", { text: "예시 맵에서 사용자가 배치한 패턴 읽기" }),
          el("li", { text: "레이어, 역할, 배치 규칙 제안 생성" }),
        ],
      }),
    );
    return;
  }
  if (status === "error" || !answer) {
    panel.replaceChildren(
      el("strong", { text: "분석 실패" }),
      el("p", { text: "응답을 읽지 못했습니다. 다시 분석을 눌러 주세요." }),
    );
    return;
  }
  const result = parseAiMappingResult(answer);
  if (!result) {
    panel.replaceChildren(
      el("strong", { text: "분석 결과 확인 필요" }),
      el("p", { text: "AI 응답 형식이 맞지 않습니다. 다시 분석을 눌러 주세요." }),
    );
    return;
  }
  const firstGroup = result.groups?.[0];
  const firstBlock = result.patternBlocks?.[0];
  const grammar = firstGroup?.patternGrammar ?? firstBlock?.patternGrammar;
  const tileset = panelTileset(panel);
  panel.replaceChildren(
    el("strong", { text: "AI 메타 제안" }),
    el("dl", {
      class: "tileset-ai-result-fields",
      children: [
        renderResultField("요약", result.summary ?? firstGroup?.description ?? "선택 타일을 매핑안으로 정리했습니다."),
        renderResultField("확신도", koreanConfidence(result.confidence)),
        renderResultField("대표 묶음", firstGroup?.name ?? firstBlock?.label ?? "개별 타일"),
        renderResultField("레이어", koreanLayer(firstGroup?.defaultLayer)),
        renderResultField("배치 규칙", firstGroup?.placementRules ?? "예시 맵 기준으로 배치합니다."),
        ...(firstBlock?.sourceRect
          ? [renderResultField("원본 블록", `${firstBlock.sourceRect.width ?? "?"}x${firstBlock.sourceRect.height ?? "?"}`)]
          : []),
        ...(grammar ? [renderResultField("확장 규칙", patternGrammarText(grammar))] : []),
      ],
    }),
    renderMinimumQuestions(result, tileset, answerInput),
    renderAppliedTerrainPreview(result, tileset),
    renderActualMappingList(result, tileset, answerInput),
  );
}

function panelTileset(panel: HTMLElement): TilesetDef | null {
  const owner = panel.closest("[data-tileset-id]");
  const tilesetId = owner instanceof HTMLElement ? owner.dataset.tilesetId : undefined;
  if (!tilesetId) return null;
  return store.getCurrent().tilesets[tilesetId] ?? null;
}

function renderResultField(label: string, value: string): HTMLElement {
  return el("div", {
    class: "tileset-ai-result-field",
    children: [el("dt", { text: label }), el("dd", { text: value })],
  });
}

function patternGrammarText(grammar: TilesetAiPatternGrammar): string {
  const roles = grammar.parts.map((part) => koreanPatternRole(part.role)).join(" / ");
  if (grammar.kind === "horizontal_expandable") return `가로 확장: ${roles}`;
  if (grammar.kind === "vertical_expandable") return `세로 확장: ${roles}`;
  if (grammar.kind === "nine_slice_expandable") return `면 확장: ${roles}`;
  return `${grammar.kind}: ${roles || "원본 순서 유지"}`;
}

function koreanPatternRole(role: TilesetAiPatternGrammar["parts"][number]["role"]): string {
  if (role === "leftCap") return "왼쪽 끝";
  if (role === "rightCap") return "오른쪽 끝";
  if (role === "topCap") return "위 끝";
  if (role === "bottomCap") return "아래 끝";
  if (role === "repeatBody") return "반복 몸통";
  if (role === "topLeft") return "좌상 모서리";
  if (role === "top") return "윗변";
  if (role === "topRight") return "우상 모서리";
  if (role === "left") return "왼변";
  if (role === "center") return "중앙 반복";
  if (role === "right") return "오른변";
  if (role === "bottomLeft") return "좌하 모서리";
  if (role === "bottom") return "아랫변";
  if (role === "bottomRight") return "우하 모서리";
  return role;
}

function renderMinimumQuestions(
  result: AiMappingResult,
  tileset: TilesetDef | null,
  answerInput: HTMLTextAreaElement | undefined,
): HTMLElement {
  const questions = result.minimumQuestions;
  if (!questions || questions.length === 0) {
    return el("p", { class: "tileset-ai-result-note", text: "추가 질문 없이 바로 적용 가능한 상태입니다." });
  }
  return el("div", {
    class: "tileset-ai-result-questions",
    children: [
      el("strong", { text: "확인 질문" }),
      el("div", {
        class: "tileset-ai-question-list",
        children: questions.slice(0, 2).map((question) => renderQuestionControl(result, tileset, question, answerInput)),
      }),
    ],
  });
}

function renderQuestionControl(
  result: AiMappingResult,
  tileset: TilesetDef | null,
  question: string,
  answerInput: HTMLTextAreaElement | undefined,
): HTMLElement {
  const current = result.userQuestionAnswers?.find((item) => item.question === question)?.answer ?? "unknown";
  const quickAnswer = QUICK_QUESTION_ANSWERS.has(current) ? current : "unknown";
  const customAnswer = QUICK_QUESTION_ANSWERS.has(current) ? "" : current;
  const referencedTiles = referencedQuestionTiles(question, result, tileset).slice(0, 4);
  return el("div", {
    class: "tileset-ai-question-control",
    children: [
      el("div", {
        class: "tileset-ai-question-prompt",
        children: [
          ...(referencedTiles.length > 0
            ? [el("div", { class: "tileset-ai-question-tiles", children: referencedTiles.map((tile) => renderQuestionTile(tileset, tile)) })]
            : []),
          el("span", { text: question }),
        ],
      }),
      el("div", {
        class: "tileset-ai-question-answer-row",
        children: [
          el("select", {
            attrs: { "aria-label": `${question} 빠른 답변` },
            on: {
              change: (event) => {
                const target = event.currentTarget;
                if (!(target instanceof HTMLSelectElement)) return;
                const customInput = target.parentElement?.querySelector(".tileset-ai-question-custom-answer");
                if (customInput instanceof HTMLInputElement && customInput.value.trim().length > 0) return;
                syncQuestionAnswer(result, question, target.value, answerInput);
              },
            },
            children: [
              renderOption("unknown", "모르겠음", quickAnswer),
              renderOption("yes", "예", quickAnswer),
              renderOption("no", "아니오", quickAnswer),
            ],
          }),
          el("input", {
            class: "tileset-ai-question-custom-answer",
            attrs: {
              "aria-label": `${question} 직접 답변`,
              placeholder: "직접 답변 입력",
              type: "text",
              value: customAnswer,
            },
            on: {
              input: (event) => {
                const target = event.currentTarget;
                if (!(target instanceof HTMLInputElement)) return;
                const select = target.parentElement?.querySelector("select");
                const fallbackAnswer = select instanceof HTMLSelectElement ? select.value : "unknown";
                syncQuestionAnswer(result, question, target.value.trim() || fallbackAnswer, answerInput);
              },
            },
          }),
        ],
      }),
    ],
  });
}

function referencedQuestionTiles(question: string, result: AiMappingResult, tileset: TilesetDef | null): number[] {
  const tileIds = [...question.matchAll(/(\d+)\s*번/g)]
    .map((match) => Number(match[1]))
    .filter((tile) => Number.isInteger(tile));
  const fallbackTiles = result.tiles?.map((tile) => tile.tile).filter((tile): tile is number => typeof tile === "number") ?? [];
  const uniqueTiles = tileIds.length > 0 ? [...new Set(tileIds)] : [...new Set(fallbackTiles)];
  if (!tileset) return uniqueTiles;
  return uniqueTiles.filter((tile) => tile >= 0 && tile < tileset.count);
}

function renderQuestionTile(tileset: TilesetDef | null, tile: number): HTMLElement {
  if (!tileset) return el("span", { class: "tileset-ai-question-tile empty", text: `${tile}` });
  const description = resolveTilesetTileContext(tileset, tile);
  return el("span", {
    class: "tileset-ai-question-tile",
    attrs: {
      title: `${tile}번 ${description.currentLabel}`,
      style: tileBackgroundStyle(tileset, tile, tileset.tileSize * 2),
    },
    children: [el("span", { class: "tileset-ai-question-tile-number", text: `${tile}` })],
  });
}

function renderActualMappingList(result: AiMappingResult, tileset: TilesetDef | null, answerInput: HTMLTextAreaElement | undefined): HTMLElement {
  const tiles = result.tiles?.filter((tile) => typeof tile.tile === "number").slice(0, 12) ?? [];
  if (tiles.length === 0) {
    return el("section", {
      class: "tileset-ai-result-mapping",
      children: [
        el("strong", { text: "실제 매핑" }),
        el("p", { class: "tileset-ai-result-note", text: "타일별 매핑은 허용 후 메타데이터에 저장됩니다." }),
      ],
    });
  }
  return el("section", {
    class: "tileset-ai-result-mapping",
    children: [
      el("strong", { text: "실제 매핑" }),
      el("p", { class: "tileset-ai-result-note", text: "AI 제안을 바로 고칠 수 있습니다. 잠근 행은 다음 보완 분석에서 유지합니다." }),
      el("div", {
        class: "tileset-ai-result-tile-list",
        children: tiles.map((tile) => renderEditableMappingRow(result, tile, tileset, answerInput)),
      }),
    ],
  });
}

function renderEditableMappingRow(
  result: AiMappingResult,
  tile: NonNullable<AiMappingResult["tiles"]>[number],
  tileset: TilesetDef | null,
  answerInput: HTMLTextAreaElement | undefined,
): HTMLElement {
  const tileId = tile.tile ?? -1;
  const context = tileset ? resolveTilesetTileContext(tileset, tileId) : null;
  return el("article", {
    class: `tileset-ai-result-tile-row editable${tile.userLocked ? " locked" : ""}`,
    attrs: { tabindex: "0" },
    on: {
      click: () => highlightTilePreview(tileId),
      focus: () => highlightTilePreview(tileId),
    },
    children: [
      renderMappingTilePreview(tileset, tileId),
      el("div", {
        class: "tileset-ai-result-tile-copy",
        children: [
          el("div", {
            class: "tileset-ai-result-tile-heading",
            children: [
              el("span", { class: "tileset-ai-result-tile-id", text: `${tile.tile}` }),
              el("span", {
                class: `tileset-ai-source-pill ${context?.metadataSource ?? "ai"}`,
                text: context?.metadataSource ? sourceLabel(context.metadataSource) : "AI 제안",
              }),
              renderTileTextInput(result, tileId, "label", tile.label ?? "", "이름", answerInput),
              renderLockControl(result, tileId, answerInput),
            ],
          }),
          el("div", {
            class: "tileset-ai-row-controls",
            children: [
              renderTileSelect(result, tileId, "role", tile.role ?? "single", "역할", [
                ["body", "중앙"],
                ["edge", "변"],
                ["detail", "장식"],
                ["object", "오브젝트"],
                ["variant", "변형"],
                ["single", "단일"],
              ], answerInput),
              renderTileSelect(result, tileId, "repeatability", tile.repeatability ?? repeatabilityFromRole(tile.role), "반복", [
                ["auto", "AI 판단"],
                ["fixed", "고정"],
                ["repeat", "반복"],
                ["center", "중앙만"],
              ], answerInput),
              renderTileSelect(result, tileId, "defaultLayer", tile.defaultLayer ?? "lower", "레이어", [
                ["lower", "하위"],
                ["upper", "상위"],
                ["mixed", "혼합"],
                ["event", "이벤트"],
              ], answerInput),
            ],
          }),
          renderTileTextInput(result, tileId, "placementRules", tile.placementRules ?? tile.description ?? "", "배치 규칙", answerInput),
        ],
      }),
    ],
  });
}

function renderTileTextInput(
  result: AiMappingResult,
  tileId: number,
  field: "label" | "placementRules",
  value: string,
  label: string,
  answerInput: HTMLTextAreaElement | undefined,
): HTMLElement {
  return el("label", {
    class: `tileset-ai-inline-field ${field === "placementRules" ? "wide" : ""}`,
    children: [
      el("span", { text: label }),
      el("input", {
        attrs: { type: "text", value },
        on: {
          input: (event) => {
            const target = event.currentTarget;
            if (!(target instanceof HTMLInputElement)) return;
            updateTileDraft(result, tileId, field, target.value, answerInput);
          },
        },
      }),
    ],
  });
}

function renderTileSelect(
  result: AiMappingResult,
  tileId: number,
  field: "defaultLayer" | "repeatability" | "role",
  value: string,
  label: string,
  options: readonly (readonly [string, string])[],
  answerInput: HTMLTextAreaElement | undefined,
): HTMLElement {
  return el("label", {
    class: "tileset-ai-inline-field",
    children: [
      el("span", { text: label }),
      el("select", {
        attrs: { "aria-label": `${tileId}번 ${label}` },
        on: {
          change: (event) => {
            const target = event.currentTarget;
            if (!(target instanceof HTMLSelectElement)) return;
            updateTileDraft(result, tileId, field, target.value, answerInput);
          },
        },
        children: options.map(([optionValue, optionLabel]) => renderOption(optionValue, optionLabel, value)),
      }),
    ],
  });
}

function renderLockControl(result: AiMappingResult, tileId: number, answerInput: HTMLTextAreaElement | undefined): HTMLElement {
  const tile = result.tiles?.find((item) => item.tile === tileId);
  return el("label", {
    class: "tileset-ai-lock-field",
    children: [
      el("input", {
        attrs: tile?.userLocked ? { checked: "true", type: "checkbox" } : { type: "checkbox" },
        on: {
          change: (event) => {
            const target = event.currentTarget;
            if (!(target instanceof HTMLInputElement)) return;
            updateTileDraft(result, tileId, "userLocked", target.checked, answerInput);
          },
        },
      }),
      el("span", { text: "잠금" }),
    ],
  });
}

function renderOption(value: string, label: string, current: string): HTMLElement {
  return el("option", {
    attrs: value === current ? { selected: "true", value } : { value },
    text: label,
  });
}

function updateTileDraft(
  result: AiMappingResult,
  tileId: number,
  field: "defaultLayer" | "label" | "placementRules" | "repeatability" | "role" | "userLocked",
  value: boolean | string,
  answerInput: HTMLTextAreaElement | undefined,
): void {
  const tiles = result.tiles?.map((tile) => {
    if (tile.tile !== tileId) return tile;
    return { ...tile, [field]: value, userLocked: field === "userLocked" ? value === true : true };
  });
  Object.assign(result, { tiles });
  syncResultAnswer(result, answerInput);
}

function syncQuestionAnswer(
  result: AiMappingResult,
  question: string,
  answer: string,
  answerInput: HTMLTextAreaElement | undefined,
): void {
  const others = result.userQuestionAnswers?.filter((item) => item.question !== question) ?? [];
  Object.assign(result, { userQuestionAnswers: [...others, { answer, question }] });
  syncResultAnswer(result, answerInput);
}

function syncResultAnswer(result: AiMappingResult, answerInput: HTMLTextAreaElement | undefined): void {
  if (!answerInput) return;
  answerInput.value = JSON.stringify(result);
  answerInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function repeatabilityFromRole(role: string | undefined): string {
  if (role === "body" || role === "edge") return "repeat";
  return "fixed";
}

function highlightTilePreview(tileId: number): void {
  document.querySelectorAll(".tileset-ai-selected-swatch.active").forEach((node) => node.classList.remove("active"));
  const target = document.querySelector(`[data-ai-selected-tile="${tileId}"]`);
  if (target instanceof HTMLElement) target.classList.add("active");
}

function renderMappingTilePreview(tileset: TilesetDef | null, tile: number): HTMLElement {
  if (!tileset || tile < 0) return el("span", { class: "tileset-ai-result-tile-preview empty" });
  const description = resolveTilesetTileContext(tileset, tile);
  return el("span", {
    class: "tileset-ai-result-tile-preview",
    attrs: {
      title: `${tile}번 ${description.currentLabel}`,
      style: tileBackgroundStyle(tileset, tile, tileset.tileSize * 2),
    },
  });
}

const PREVIEW_ZOOM_OPTIONS = [
  { label: "1x", size: 10 },
  { label: "2x", size: 16 },
  { label: "3x", size: 24 },
] as const;

const DEFAULT_PREVIEW_CELL_SIZE = 16;

function renderAppliedTerrainPreview(result: AiMappingResult, tileset: TilesetDef | null): HTMLElement {
  const previewMap = firstPreviewMap(result);
  if (!previewMap || !tileset) {
    return el("section", {
      class: "tileset-ai-result-preview",
      children: [
        el("strong", { text: "응용 지형" }),
        el("p", { class: "tileset-ai-result-note", text: "AI가 응용 배치 예시를 만들면 여기에 지형으로 보여줍니다." }),
      ],
    });
  }
  const width = clampPreviewSize(previewMap.width);
  const height = clampPreviewSize(previewMap.height);
  const lowerTiles = previewMap.lowerTiles ?? [];
  const upperTiles = previewMap.upperTiles ?? [];
  const map = el("div", {
    class: "tileset-ai-result-map",
    attrs: {
      style: previewMapGridStyle(width, height, DEFAULT_PREVIEW_CELL_SIZE),
      role: "img",
      "aria-label": "AI가 매핑한 타일로 만든 응용 지형 예시",
    },
    children: Array.from({ length: width * height }, (_, index) =>
      renderPreviewCell(tileset, lowerTiles[index] ?? -1, upperTiles[index] ?? -1, DEFAULT_PREVIEW_CELL_SIZE),
    ),
  });
  const zoomButtons: HTMLButtonElement[] = [];
  const zoomControls = PREVIEW_ZOOM_OPTIONS.map((option) => {
    const button = el("button", {
      class: `tileset-ai-preview-tool${option.size === DEFAULT_PREVIEW_CELL_SIZE ? " active" : ""}`,
      text: option.label,
      attrs: {
        type: "button",
        "aria-pressed": option.size === DEFAULT_PREVIEW_CELL_SIZE ? "true" : "false",
        title: `${option.label} 보기`,
      },
      on: {
        click: () => {
          applyPreviewZoom(map, tileset, width, height, option.size);
          zoomButtons.forEach((control) => {
            const isActive = control === button;
            control.classList.toggle("active", isActive);
            control.setAttribute("aria-pressed", isActive ? "true" : "false");
          });
        },
      },
    }) as HTMLButtonElement;
    zoomButtons.push(button);
    return button;
  });
  const numberToggle = el("button", {
    class: "tileset-ai-preview-tool",
    text: "번호",
    attrs: { type: "button", "aria-pressed": "false", title: "타일 번호 표시" },
    on: {
      click: (event) => {
        const button = event.currentTarget;
        if (!(button instanceof HTMLButtonElement)) return;
        const shouldShow = !map.classList.contains("show-numbers");
        map.classList.toggle("show-numbers", shouldShow);
        button.classList.toggle("active", shouldShow);
        button.setAttribute("aria-pressed", shouldShow ? "true" : "false");
      },
    },
  });
  return el("section", {
    class: "tileset-ai-result-preview",
    children: [
      el("div", {
        class: "tileset-ai-result-preview-header",
        children: [
          el("strong", { text: `응용 지형${previewMap.name ? ` · ${previewMap.name}` : ""}` }),
          el("div", {
            class: "tileset-ai-preview-tools",
            children: [...zoomControls, numberToggle],
          }),
        ],
      }),
      el("div", { class: "tileset-ai-result-map-frame", children: [map] }),
    ],
  });
}

function firstPreviewMap(result: AiMappingResult): AiPreviewMap | null {
  const previewMap = result.previewMaps?.[0] ?? result.groups?.find((group) => group.previewMap)?.previewMap;
  return previewMap ?? null;
}

function clampPreviewSize(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return 16;
  return Math.max(1, Math.min(value, 24));
}

function previewMapGridStyle(width: number, height: number, cellSize: number): string {
  return [
    `--ai-preview-cell:${cellSize}px`,
    `grid-template-columns:repeat(${width}, ${cellSize}px)`,
    `grid-template-rows:repeat(${height}, ${cellSize}px)`,
  ].join(";");
}

function applyPreviewZoom(map: HTMLElement, tileset: TilesetDef, width: number, height: number, cellSize: number): void {
  map.setAttribute("style", previewMapGridStyle(width, height, cellSize));
  map.querySelectorAll(".tileset-ai-result-map-tile").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const tile = Number(node.dataset.tile);
    if (!Number.isInteger(tile)) return;
    node.setAttribute("style", previewTileStyle(tileset, tile, cellSize));
  });
}

function renderPreviewCell(tileset: TilesetDef, lower: number, upper: number, cellSize: number): HTMLElement {
  return el("span", {
    class: "tileset-ai-result-map-cell",
    children: [
      ...(lower >= 0 ? [renderPreviewTile(tileset, lower, "lower", cellSize)] : []),
      ...(upper >= 0 ? [renderPreviewTile(tileset, upper, "upper", cellSize)] : []),
      ...(lower >= 0 || upper >= 0 ? [renderPreviewNumberLabel(lower, upper)] : []),
    ],
  });
}

function renderPreviewTile(tileset: TilesetDef, tile: number, layer: "lower" | "upper", cellSize: number): HTMLElement {
  const description = resolveTilesetTileContext(tileset, tile);
  return el("span", {
    class: `tileset-ai-result-map-tile ${layer}`,
    dataset: { tile: `${tile}` },
    attrs: {
      title: `${tile}번 ${description.currentLabel}`,
      style: previewTileStyle(tileset, tile, cellSize),
    },
  });
}

function renderPreviewNumberLabel(lower: number, upper: number): HTMLElement {
  const label = upper >= 0 && lower >= 0 ? `${lower}/${upper}` : `${upper >= 0 ? upper : lower}`;
  return el("span", { class: "tileset-ai-result-map-number", text: label });
}

function previewTileStyle(tileset: TilesetDef, tile: number, cellSize: number): string {
  return tilesetTileBackgroundStyle(tileset, tile, cellSize);
}

function renderActions(
  model: AiProposalModalModel,
  actions: { readonly onAnalyze: () => Promise<void>; readonly onUseSetup: () => void; readonly readAnswer: () => string },
): HTMLElement {
  return el("div", {
    class: "tileset-ai-modal-actions",
    children: [
      el("button", { class: "tileset-db-small-button", text: "닫기", attrs: { type: "button" }, on: { click: model.onClose } }),
      el("button", {
        class: "tileset-db-small-button",
        text: "선택대로 초안",
        attrs: { type: "button" },
        dataset: { testid: "tileset-ai-local-draft" },
        on: { click: actions.onUseSetup },
      }),
      el("button", {
        class: "tileset-db-small-button",
        text: "분석 시작",
        attrs: { type: "button" },
        dataset: { testid: "tileset-ai-analyze" },
        on: { click: () => void actions.onAnalyze() },
      }),
      el("button", {
        class: "tileset-db-small-button primary",
        text: "메타데이터 적용",
        attrs: { type: "button", disabled: "true" },
        dataset: { testid: "tileset-ai-answer-apply" },
        on: { click: () => model.onAllow(actions.readAnswer()) },
      }),
    ],
  });
}

function readActionButtons(actions: HTMLElement): ActionButtons {
  const analyzeButton = actions.querySelector('[data-testid="tileset-ai-analyze"]');
  const applyButton = actions.querySelector('[data-testid="tileset-ai-answer-apply"]');
  if (!(analyzeButton instanceof HTMLButtonElement) || !(applyButton instanceof HTMLButtonElement)) {
    throw new Error("AI modal action buttons were not rendered.");
  }
  return { analyzeButton, applyButton };
}

function setAnalyzingState(status: HTMLElement, buttons: ActionButtons, isAnalyzing: boolean): void {
  status.classList.toggle("loading", isAnalyzing);
  buttons.analyzeButton.disabled = isAnalyzing;
  buttons.applyButton.disabled = isAnalyzing;
}

function setStatus(status: HTMLElement, nextStatus: AiStatus, text: string): void {
  status.classList.remove("done", "error", "loading", "ready");
  status.classList.add(nextStatus);
  const textNode = status.querySelector(".tileset-ai-status-text");
  if (textNode) textNode.textContent = text;
}

function tileBackgroundStyle(tileset: TilesetDef, tile: number, previewSize: number): string {
  return [
    `width:${previewSize}px`,
    `height:${previewSize}px`,
    tilesetTileBackgroundStyle(tileset, tile, previewSize),
  ].join(";");
}

function koreanConfidence(confidence: string | undefined): string {
  if (confidence === "high") return "높음";
  if (confidence === "medium") return "보통";
  if (confidence === "low") return "낮음";
  return "확인 필요";
}

function sourceLabel(source: string): string {
  if (source === "user") return "사용자";
  if (source === "ai") return "AI";
  if (source === "bundled-default") return "기본";
  if (source === "imported") return "가져옴";
  return "미분류";
}

function koreanLayer(layer: string | undefined): string {
  if (layer === "lower") return "하위 레이어";
  if (layer === "upper") return "상위 레이어";
  if (layer === "event") return "이벤트";
  if (layer === "mixed") return "혼합";
  return "AI 제안 기준";
}
