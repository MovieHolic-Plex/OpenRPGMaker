import { editorState } from "@/editor/editorState";
import { requestCpenTilesetMapping } from "@/editor/panels/tilesetAiCpenClient";
import { normalizeAiTileMetadata } from "@/editor/panels/tilesetAiMetadataNormalizer";
import { analyzeTilesetSelection, type TilesetAiPatternGrammar } from "@/editor/panels/tilesetAiMappingRules";
import { createTerrainExampleEditor, type TempMapSnapshot } from "@/editor/panels/tilesetAiTerrainExample";
import { buildSetupMappingAnswer, type AiSetupChoice } from "@/editor/panels/tilesetAiSetupMapping";
import { tileExplanation } from "@/editor/panels/tilesetAiTileText";
import { resolveTilesetTileContext } from "@/editor/panels/tilesetTileContext";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { store } from "@/project/store";
import { recordAiAnalysisRun } from "@/project/tileMetadataDb";
import { combinedTownHarnessPrompt } from "@/project/tilesetHarness";
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

type AiMappingResult = {
  readonly confidence?: string;
  readonly groups?: readonly {
    readonly defaultLayer?: string;
    readonly description?: string;
    readonly name?: string;
    readonly patternGrammar?: TilesetAiPatternGrammar;
    readonly placementRules?: string;
    readonly previewMap?: AiPreviewMap;
    readonly role?: string;
    readonly tileIds?: readonly number[];
  }[];
  readonly minimumQuestions?: readonly string[];
  readonly patternBlocks?: readonly {
    readonly confidence?: string;
    readonly label?: string;
    readonly patternGrammar?: TilesetAiPatternGrammar;
    readonly sourceRect?: { readonly height?: number; readonly width?: number; readonly x?: number; readonly y?: number };
    readonly tileIds?: readonly number[];
  }[];
  readonly previewMaps?: readonly AiPreviewMap[];
  readonly summary?: string;
  readonly tiles?: readonly {
    readonly defaultLayer?: string;
    readonly description?: string;
    readonly label?: string;
    readonly placementRules?: string;
    readonly repeatability?: string;
    readonly role?: string;
    readonly tile?: number;
    readonly userLocked?: boolean;
  }[];
  readonly userQuestionAnswers?: readonly {
    readonly answer: string;
    readonly question: string;
  }[];
};

type AiPreviewMap = {
  readonly height?: number;
  readonly lowerTiles?: readonly number[];
  readonly name?: string;
  readonly upperTiles?: readonly number[];
  readonly width?: number;
};

const QUICK_QUESTION_ANSWERS = new Set(["no", "unknown", "yes"]);

export function renderAiProposalModal(model: AiProposalModalModel): HTMLElement {
  const mapContext = currentMapContext(model.tileset.id, model.selectedTiles);
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
    await waitForSnapshot(() => snapshot);
    setStatus(status, "loading", "AI가 선택 타일, 배치 예시, 현재 맵 사용량을 함께 보고 있습니다. 보통 90초 안팎 걸립니다.");
    const prompt = cpenPrompt(model, mapContext, snapshot.summary, setupChoice, lockedAnswer);
    const result = await requestCpenTilesetMapping({
      imageDataUrl: snapshot.imageDataUrl,
      prompt,
    });
    await recordAiAnalysisRun({
      tilesetId: model.tileset.id,
      selectedTiles: model.selectedTiles,
      promptContext: JSON.parse(prompt),
      result,
    });
    const answer = normalizeAiTileMetadata(mergeLockedEdits(result, lockedAnswer));
    model.answerInput.value = answer;
    model.answerInput.dispatchEvent(new Event("input", { bubbles: true }));
    model.answerInput.readOnly = false;
    analyzing = false;
    setAnalyzingState(status, buttons, false);
    buttons.analyzeButton.textContent = "내 수정 잠그고 보완";
    const failed = isAiFailureText(answer);
    const invalidJson = !failed && parseAiMappingResult(answer) === null;
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
  const analysis = analyzeTilesetSelection({ selectedTiles: tiles, tilesPerRow: 30 });
  const question = analysis.minimumQuestions[0] ? ` 최소 확인: ${analysis.minimumQuestions[0]}` : "";
  return `${currentMapContext(tilesetId, tiles)} 선택 타일 ${tiles.length}개를 AI가 블록/레이어/배치 규칙으로 매핑합니다.${question}`;
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
        dataset: { testid: "tileset-ai-cpen-analyze" },
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
  const analyzeButton = actions.querySelector('[data-testid="tileset-ai-cpen-analyze"]');
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

async function waitForSnapshot(readSnapshot: () => TempMapSnapshot): Promise<void> {
  for (let count = 0; count < 20; count += 1) {
    const snapshot = readSnapshot();
    if (snapshot.summary && snapshot.imageDataUrl) return;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

function cpenPrompt(
  model: AiProposalModalModel,
  mapContext: string,
  tempMapSummary: string,
  setupChoice: AiSetupChoice,
  lockedAnswer: string,
): string {
  const selectionAnalysis = analyzeTilesetSelection({
    selectedTiles: model.selectedTiles,
    tilesPerRow: model.tileset.tilesPerRow,
  });
  return JSON.stringify({
    task: "tileset_mapping_json",
    outputContract:
      "Return exactly one valid JSON object. No markdown, prose, code fences, comments, or schema quotes. Include summary, confidence, minimumQuestions, tiles, groups, patternBlocks, and previewMaps as needed. Each tiles entry must include tile, label, description, terrainTag, defaultLayer, role, repeatability, and placementRules. Each previewMap lowerTiles and upperTiles array must contain exactly width*height numbers.",
    rules: [
      "tiles must contain one entry for every selected tile.",
      "For a 3x3 terrain block, individual tile labels must be position-specific. Use 좌상단, 상단, 우상단, 좌측, 중앙, 우측, 좌하단, 하단, 우하단 in source order. Do not repeat the group name as every tile label.",
      "For a 3x3 terrain block in source order, set role/repeatability by position: corners 좌상단/우상단/좌하단/우하단 use role=edge and repeatability=fixed; sides 상단/좌측/우측/하단 use role=edge and repeatability=repeat; center 중앙 uses role=body and repeatability=repeat.",
      "minimumQuestions must contain at most two short Korean questions. If confidence is low, ask before final mapping. If the selection is a 3x3 outer/body terrain block, ask whether it is an auto-connecting bordered terrain.",
      "If selectionAnalysis has patternBlocks, preserve each sourceRect and relative source tile order. Never freely shuffle a source_rect block.",
      "patternBlocks must describe source-preserving blocks before individual tile labels. Use neutral visual names from the selected image and metadata; never infer castle, wall, road, house, or object meaning from tile numbers alone.",
      "If selectionAnalysis.patternBlocks contains patternGrammar, copy that patternGrammar into the matching patternBlock and group. Valid terrain grammar kinds include animated_terrain, autotile_3x3, horizontal_expandable, vertical_expandable, and nine_slice_expandable.",
      "patternGrammar.parts must explain which tiles are caps, repeated body, corners, edges, and center. Do not hide this inside prose.",
      "previewMaps may be omitted when patternGrammar is enough. If you include previewMaps, use one compact complete 8x8-12x12 example using tile ids, not prose. lowerTiles and upperTiles must each contain exactly width*height numbers and must not be truncated.",
      "label must be short Korean text, 18 characters or less. group.name may be generic, but tiles[].label must distinguish the tile's exact position or purpose.",
      "description must be Korean and must not include JSON, markdown, or chatty follow-up text.",
      "placementRules must be concise Korean rules for editor metadata.",
      "terrainTag must be a number. Prefer the provided terrainTag unless the map example proves otherwise.",
      "defaultLayer must be lower, upper, event, or mixed.",
      "role must be one of body, edge, detail, object, variant, single.",
      "repeatability must be one of auto, fixed, repeat, or center. Use fixed for non-repeatable caps/corners, repeat for stretchable side/body tiles, center only when only the center tile may repeat.",
      "metadataSource=unknown means there is no trusted semantic knowledge. For unknown tilesets, rely on tile images, user setup, and userQuestionAnswers instead of tile numbers.",
      "If lockedUserEdits contains tiles with userLocked true, preserve those labels, roles, layers, repeatability, and placementRules unless they conflict with the selected tile ids.",
      "Use userQuestionAnswers as direct human answers to your prior questions. Answers may be free-form Korean text, not only yes/no/unknown; treat a specific free-form answer as stronger than a quick select answer.",
      "If userQuestionAnswers mentions 물, 수면, 강, 오토타일, 자동 연결, 자유롭게 칠하기, or 주변 타일과 이어짐, treat the selected tiles as auto-connecting water terrain unless the image clearly contradicts it.",
      "For auto-connecting water terrain, prefer defaultLayer=lower and placementRules that say free painting should choose edge/center variants so adjacent water tiles merge visually. Use patternGrammar kind autotile_3x3 for a bordered block or animated_terrain when frames/animation are evident.",
      "Do not ask the user to write JSON.",
    ],
    selectionAnalysis,
    userSetup: {
      intent: setupIntentText(setupChoice.intent),
      repeatability: setupRepeatabilityText(setupChoice.repeatability),
      structure: setupStructureText(setupChoice.structure),
      scope: setupScopeText(setupChoice.scope),
    },
    tilesetHarness: combinedTownHarnessPrompt(model.tileset),
    mapContext,
    knownGroups: model.tileset.tileGroups
      ?.filter((group) => group.tileIds.some((tile) => model.selectedTiles.includes(tile)))
      .map((group) => ({
        name: group.name,
        role: group.role,
        defaultLayer: group.defaultLayer,
        tileIds: group.tileIds,
        placementRules: group.placementRules,
        source: group.source ?? "user",
      })) ?? [],
    selectedTiles: model.selectedTiles.map((tile) => {
      const description = resolveTilesetTileContext(model.tileset, tile);
      return {
        tile,
        currentLabel: description.currentLabel,
        currentAiLabel: description.currentAiLabel,
        layer: description.layer,
        repeatRole: description.repeatRole,
        terrainTag: description.terrainTag,
        tags: description.tags,
        metadataSource: description.metadataSource,
        userLocked: description.userLocked,
      };
    }),
    lockedUserEdits: readLockedEdits(lockedAnswer),
    tempMap: tempMapSummary,
  });
}

function readLockedEdits(answer: string): unknown {
  if (!answer) return null;
  const result = parseAiMappingResult(answer);
  if (!result) return null;
  return {
    tiles: result.tiles?.filter((tile) => tile.userLocked),
    userQuestionAnswers: result.userQuestionAnswers ?? [],
  };
}

function mergeLockedEdits(answer: string, lockedAnswer: string): string {
  const result = parseAiMappingResult(answer);
  const lockedResult = parseAiMappingResult(lockedAnswer);
  if (!result || !lockedResult) return answer;
  const lockedTiles = new Map((lockedResult.tiles ?? []).filter((tile) => tile.userLocked).map((tile) => [tile.tile, tile]));
  if (lockedTiles.size === 0 && !lockedResult.userQuestionAnswers?.length) return answer;
  const tiles = result.tiles?.map((tile) => {
    const lockedTile = lockedTiles.get(tile.tile);
    return lockedTile ? { ...tile, ...lockedTile, userLocked: true } : tile;
  });
  return JSON.stringify({
    ...result,
    tiles,
    userQuestionAnswers: lockedResult.userQuestionAnswers ?? result.userQuestionAnswers,
  });
}

function setupIntentText(intent: AiSetupChoice["intent"]): string {
  if (intent === "autoTerrain") return "자동 연결 지형";
  if (intent === "pathAutotile") return "길 오토타일";
  if (intent === "waterAutotile") return "물 오토타일";
  if (intent === "buildingHouse") return "집/건물";
  if (intent === "linearPath") return "길/강/울타리";
  if (intent === "wallCliff") return "벽/절벽";
  if (intent === "objectDetail") return "장식/소품";
  return "모르겠음";
}

function setupRepeatabilityText(repeatability: AiSetupChoice["repeatability"]): string {
  if (repeatability === "edgesAndCenter") return "모서리는 고정, 변과 중앙은 반복 가능";
  if (repeatability === "centerOnly") return "중앙만 반복 가능";
  if (repeatability === "noRepeat") return "반복 배치하지 않음";
  if (repeatability === "allRepeat") return "모든 타일을 반복 후보로 검토";
  return "AI가 반복 가능성을 판단";
}

function setupStructureText(structure: AiSetupChoice["structure"]): string {
  if (structure === "single") return "단일 칩";
  if (structure === "threeByThree") return "3x3 지형";
  if (structure === "horizontal") return "가로 반복";
  if (structure === "vertical") return "세로 반복";
  if (structure === "nineSlice") return "모서리+중앙";
  if (structure === "animation") return "애니메이션";
  return "혼합";
}

function setupScopeText(scope: AiSetupChoice["scope"]): string {
  if (scope === "labels") return "이름/설명만";
  if (scope === "rules") return "묶음+배치 규칙";
  if (scope === "preview") return "예시 맵 포함";
  return "지형 번호 추천";
}

function parseAiMappingResult(answer: string): AiMappingResult | null {
  try {
    const parsed: unknown = JSON.parse(answer);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as AiMappingResult;
  } catch {
    return null;
  }
}

function isAiFailureText(text: string): boolean {
  return text.startsWith("AI 호출 실패") || text.startsWith("AI 응답 시간") || text.startsWith("AI 설정");
}

function currentMapContext(tilesetId: string, tiles: readonly number[]): string {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  if (!map) return "현재 맵 없음.";
  const lowerCount = countTileUses(map.lowerTiles, tiles);
  const upperCount = countTileUses(map.upperTiles, tiles);
  const tilesetMatch = map.tilesetId === tilesetId ? "현재 타일셋" : `맵 타일셋 ${map.tilesetId}`;
  return `${map.name} ${map.width}x${map.height}, ${tilesetMatch}, 맵 사용량 하위 ${lowerCount} / 상위 ${upperCount}.`;
}

function countTileUses(layerTiles: readonly number[], tiles: readonly number[]): number {
  const selected = new Set(tiles);
  return layerTiles.reduce((count, tile) => count + (selected.has(tile) ? 1 : 0), 0);
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
