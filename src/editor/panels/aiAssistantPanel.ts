import { loadAiConfig } from "@/ai/llmClient";
import { focusAcceptedAgentChanges } from "@/editor/agentFocus";
import { editorState } from "@/editor/editorState";
import { createAiPreviewProject, type AiPreviewResult } from "@/project/aiPreviewGenerator";
import { describeChipsetTile } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

type DragState = {
  readonly dragId: number | "mouse";
  readonly pointerStartX: number;
  readonly pointerStartY: number;
  readonly panelStartX: number;
  readonly panelStartY: number;
};
type PendingAiPreview = Extract<AiPreviewResult, { ok: true }> & {
  readonly sourceFingerprint: string;
};

type PreviewReportOptions = {
  readonly beforeDetails: readonly string[];
  readonly detailLines?: readonly string[];
  readonly afterDetails?: readonly string[];
};

const PANEL_MARGIN = 8;
const PANEL_POSITION_KEY = "oprn:aiAssistant.position";

export function renderAiAssistantPanel(): HTMLElement {
  let dragState: DragState | null = null;
  let pendingPreview: PendingAiPreview | null = null;
  const status = el("span", { class: "ai-assistant-status", text: "대기" });
  const previewStatus = el("div", {
    class: "ai-preview-status",
    text: "AI 프리뷰를 생성하면 변경 요약과 승인 버튼이 여기에 표시됩니다.",
    dataset: { testid: "ai-preview-status" },
  });
  const approveButton = el("button", {
    class: "ai-assistant-action ai-preview-approve",
    text: "프리뷰 승인해서 프로젝트에 적용",
    attrs: { type: "button", disabled: "true" },
    dataset: { testid: "ai-preview-approve" },
    on: {
      click: () => {
        if (!pendingPreview) return;
        if (!aiPreviewSourceMatches(store.getCurrent(), pendingPreview.sourceFingerprint)) {
          pendingPreview = null;
          approveButton.setAttribute("disabled", "true");
          status.textContent = "다시 생성 필요";
          renderPreviewLines(previewStatus, ["프로젝트가 프리뷰 생성 이후 변경되었습니다. 현재 프로젝트 기준으로 프리뷰를 다시 생성해 주세요."]);
          return;
        }
        const before = store.getCurrent();
        store.replace(pendingPreview.project);
        focusAcceptedAgentChanges(before, pendingPreview.project);
        status.textContent = "승인됨";
        approveButton.setAttribute("disabled", "true");
        renderPreviewLines(previewStatus, [`승인 완료: ${pendingPreview.map.name}`, "원본 프로젝트는 승인 전까지 변경되지 않았고, 승인 후 프리뷰 프로젝트가 현재 프로젝트가 되었습니다."]);
        pendingPreview = null;
        toast("AI 프리뷰를 프로젝트에 적용했습니다.", "ok");
      },
    },
  });
  const promptInput = el("textarea", {
    class: "ai-assistant-input",
    text: "",
    attrs: {
      placeholder: "AI 요청 초안",
    },
  }) as HTMLTextAreaElement;
  const header = el("div", {
    class: "ai-assistant-header",
    attrs: { draggable: "true", title: "드래그로 이동" },
    dataset: { testid: "ai-assistant-drag-handle" },
    children: [
      el("div", {
        children: [
          el("h2", { text: "AI 어시스턴트" }),
          el("p", { text: "타일 세트와 맵 제작 보조" }),
        ],
      }),
      status,
    ],
  });
  const panel = el("aside", {
    class: "ai-assistant-panel",
    attrs: { "aria-label": "AI 어시스턴트" },
    dataset: { testid: "ai-assistant-panel" },
    children: [
      header,
      el("div", {
        class: "ai-assistant-body",
        children: [
          el("button", {
            class: "ai-assistant-action",
            text: "선택 타일 설명 읽기",
            attrs: { type: "button" },
            on: {
              click: () => {
                writeAssistantDraft(promptInput, status, selectedTileDraft(), "타일");
              },
            },
          }),
          el("button", {
            class: "ai-assistant-action",
            text: "현재 맵 개선안 보기",
            attrs: { type: "button" },
            on: {
              click: () => {
                writeAssistantDraft(promptInput, status, currentMapDraft(), "맵");
              },
            },
          }),
          promptInput,
          el("button", {
            class: "ai-assistant-action",
            text: "AI 프리뷰 생성",
            attrs: { type: "button" },
            dataset: { testid: "ai-preview-generate" },
            on: {
              click: () => {
                const goal = promptInput.value.trim();
                pendingPreview = null;
                approveButton.setAttribute("disabled", "true");
                if (!goal) {
                  status.textContent = "목표 필요";
                  renderPreviewLines(previewStatus, ["프리뷰 목표를 먼저 입력하세요. 예: 작은 항구 마을"]);
                  return;
                }
                const project = store.getCurrent();
                const mapId = editorState.get().currentMapId ?? project.startMapId;
                const sourceMap = project.maps[mapId];
                const result = createAiPreviewProject({
                  goal,
                  sourceProject: project,
                  tilesetId: sourceMap?.tilesetId,
                  mapName: `AI Preview - ${goal}`.slice(0, 80),
                });
                if (!result.ok) {
                  status.textContent = "검증 필요";
                  renderPreviewReport(previewStatus, {
                    beforeDetails: ["프리뷰 생성 실패: 고신뢰 검증 정보가 부족합니다."],
                    detailLines: aiPreviewEvidenceLines(result),
                  });
                  return;
                }
                pendingPreview = { ...result, sourceFingerprint: aiPreviewSourceFingerprint(project) };
                approveButton.removeAttribute("disabled");
                status.textContent = "검토 대기";
                renderPreviewReport(previewStatus, {
                  beforeDetails: aiPreviewDiffLines(project, result),
                  detailLines: aiPreviewEvidenceLines(result),
                  afterDetails: ["승인 전까지 원본 프로젝트는 변경되지 않습니다."],
                });
              },
            },
          }),
          previewStatus,
          approveButton,
        ],
      }),
    ],
  });
  requestAnimationFrame(() => restorePanelPosition(panel));

  const beginDrag = (clientX: number, clientY: number, dragId: number | "mouse"): void => {
    const rect = panel.getBoundingClientRect();
    dragState = {
      dragId,
      pointerStartX: clientX,
      pointerStartY: clientY,
      panelStartX: rect.left,
      panelStartY: rect.top,
    };
    panel.classList.add("is-dragging");
  };
  const moveDrag = (clientX: number, clientY: number): void => {
    if (!dragState) return;
    const rect = panel.getBoundingClientRect();
    const nextX = dragState.panelStartX + clientX - dragState.pointerStartX;
    const nextY = dragState.panelStartY + clientY - dragState.pointerStartY;
    const position = clampedPanelPosition(
      { x: nextX, y: nextY },
      { width: rect.width, height: rect.height }
    );
    panel.style.left = `${position.x}px`;
    panel.style.top = `${position.y}px`;
    panel.style.right = "auto";
  };
  const finishDrag = (): void => {
    savePanelPosition(panel);
    dragState = null;
    panel.classList.remove("is-dragging");
  };
  const onMouseMove = (event: MouseEvent): void => {
    if (dragState?.dragId !== "mouse") return;
    moveDrag(event.clientX, event.clientY);
  };
  const onMouseUp = (): void => {
    if (dragState?.dragId !== "mouse") return;
    finishDrag();
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  header.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || dragState) return;
    beginDrag(event.clientX, event.clientY, event.pointerId);
    header.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  header.addEventListener("pointermove", (event) => {
    if (dragState?.dragId !== event.pointerId) return;
    moveDrag(event.clientX, event.clientY);
  });

  const finishPointerDrag = (event: PointerEvent): void => {
    if (dragState?.dragId !== event.pointerId) return;
    finishDrag();
    if (header.hasPointerCapture(event.pointerId)) {
      header.releasePointerCapture(event.pointerId);
    }
  };
  header.addEventListener("pointerup", finishPointerDrag);
  header.addEventListener("pointercancel", finishPointerDrag);

  header.addEventListener("mousedown", (event) => {
    if (event.button !== 0 || dragState) return;
    beginDrag(event.clientX, event.clientY, "mouse");
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    event.preventDefault();
  });

  header.addEventListener("dragstart", (event) => {
    beginDrag(event.clientX, event.clientY, "mouse");
    event.dataTransfer?.setData("text/plain", "");
  });

  header.addEventListener("drag", (event) => {
    if (dragState?.dragId !== "mouse") return;
    if (event.clientX === 0 && event.clientY === 0) return;
    moveDrag(event.clientX, event.clientY);
  });

  header.addEventListener("dragend", (event) => {
    if (dragState?.dragId !== "mouse") return;
    if (event.clientX !== 0 || event.clientY !== 0) {
      moveDrag(event.clientX, event.clientY);
    }
    finishDrag();
  });

  return panel;
}

/**
 * 드래프트에 적을 모델 ID. **문자열을 여기 박지 않는다.**
 *
 * 예전에는 모델 ID 문자열이 직접 박혀 있었는데, 그 ID 는 제공자 레지스트리
 * (`src/ai/ohMyPiProviders.ts` — Antigravity·Codex 둘뿐)에 **아예 없는 값**이었다. 즉 설정
 * 화면이 보여 주는 모델과 이 드래프트가 보여 주는 모델이 서로 달랐고, 기본 모델이 두 번
 * 바뀌는 동안(glm → gemini) 이 자리만 그대로 남아 사용자에게 거짓을 보여 줬다.
 *
 * `loadAiConfig()` 를 출처로 쓰면 그 드리프트가 구조적으로 불가능해진다 — loadAiConfig 는
 * 저장값을 `isModelValidForAuthMode` 로 검증하고, 레지스트리 밖 ID 는
 * `defaultModelForAuthMode(authMode, providerId)`(= 그 제공자 카탈로그 첫 항목,
 * 곧 `provider.defaultModel`. 계약은 test/modelCatalog.test.ts 가 고정) 로 교정한다.
 * 그래서 여기서 나오는 값은 항상 "지금 실제로 요청에 실릴 모델" 이다.
 */
function draftModelId(): string {
  return loadAiConfig().model;
}

function selectedTileDraft(): string {
  const selected = editorState.get().selectedTile;
  const tile = describeChipsetTile(selected);
  return JSON.stringify(
    {
      model: draftModelId(),
      response_format: { type: "json_object" },
      task: "tileset_tile_metadata",
      tile,
    },
    null,
    2
  );
}

function currentMapDraft(): string {
  const project = store.getCurrent();
  const state = editorState.get();
  const mapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  const sampleTiles = Array.from({ length: Math.min(12, tileset?.count ?? 0) }, (_, index) =>
    describeChipsetTile(index)
  );
  return JSON.stringify(
    {
      model: draftModelId(),
      response_format: { type: "json_object" },
      task: "map_improvement_draft",
      map: map
        ? {
            id: map.id,
            name: map.name,
            width: map.width,
            height: map.height,
            tilesetId: map.tilesetId,
          }
        : null,
      selectedTile: describeChipsetTile(state.selectedTile),
      sampleTiles,
    },
    null,
    2
  );
}

function writeAssistantDraft(input: HTMLTextAreaElement, status: HTMLElement, draft: string, label: string): void {
  input.value = draft;
  status.textContent = label;
}
function renderPreviewLines(container: HTMLElement, lines: readonly string[]): void {
  renderPreviewReport(container, { beforeDetails: lines });
}

export function renderPreviewReport(container: HTMLElement, options: PreviewReportOptions): void {
  const children: HTMLElement[] = [
    ...previewParagraphs(options.beforeDetails),
  ];
  if (options.detailLines && options.detailLines.length > 0) {
    children.push(
      el("details", {
        class: "ai-preview-validation-details",
        dataset: { testid: "ai-preview-validation-details" },
        children: [
          el("summary", {
            text: "생성 검증 상세",
            dataset: { testid: "ai-preview-validation-summary" },
          }),
          ...previewParagraphs(options.detailLines),
        ],
      })
    );
  }
  children.push(...previewParagraphs(options.afterDetails ?? []));
  container.replaceChildren(...children);
}

function previewParagraphs(lines: readonly string[]): HTMLElement[] {
  return lines.map((line) => el("p", { text: line }));
}

export function aiPreviewDiffLines(sourceProject: Project, result: AiPreviewResult): string[] {
  if (!result.ok) return ["적용될 프로젝트 변경 없음."];
  return [
    `프리뷰 맵: ${result.map.name} (${result.map.width}×${result.map.height})`,
    `맵 수: ${Object.keys(sourceProject.maps).length} → ${Object.keys(result.project.maps).length}`,
    `시작 맵: ${sourceProject.startMapId} → ${result.project.startMapId}`,
    `NPC: ${result.evidence.npcMetadata.map((npc) => `${npc.displayName}/${npc.role}`).join(", ")}`,
  ];
}

export function aiPreviewEvidenceLines(result: AiPreviewResult): string[] {
  if (!result.ok) {
    return [
      `질문: ${result.clarificationQuestion}`,
      ...result.missingEvidence.map((evidence) => `부족한 증거: ${evidence.code} — ${evidence.detail}`),
    ];
  }
  const validation = Object.entries(result.evidence.validation)
    .map(([key, passed]) => `${key}=${passed ? "통과" : "실패"}`)
    .join(", ");
  return [
    `ChipSet 증거: ${result.evidence.chipsetCandidate.tilesetId} / ${result.evidence.chipsetCandidate.confidence}`,
    `CharSet 증거: ${result.evidence.charsetCandidates.map((candidate) => candidate.assetId).join(", ")}`,
    `타일 그룹: ${result.evidence.tileGroups.map((group) => `${group.role}(${group.tileIds.length})`).join(", ")}`,
    `검증: ${validation}`,
  ];
}
export function aiPreviewSourceFingerprint(project: Project): string {
  return JSON.stringify(project);
}

export function aiPreviewSourceMatches(project: Project, fingerprint: string): boolean {
  return aiPreviewSourceFingerprint(project) === fingerprint;
}

function restorePanelPosition(panel: HTMLElement): void {
  const position = readStoredPanelPosition();
  if (!position) return;
  const rect = panel.getBoundingClientRect();
  const clamped = clampedPanelPosition(position, { width: rect.width, height: rect.height });
  panel.style.left = `${clamped.x}px`;
  panel.style.top = `${clamped.y}px`;
  panel.style.right = "auto";
}

function savePanelPosition(panel: HTMLElement): void {
  if (typeof window === "undefined") return;
  const rect = panel.getBoundingClientRect();
  const position = clampedPanelPosition({ x: rect.left, y: rect.top }, { width: rect.width, height: rect.height });
  window.localStorage.setItem(PANEL_POSITION_KEY, `${position.x},${position.y}`);
}

function readStoredPanelPosition(): { readonly x: number; readonly y: number } | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PANEL_POSITION_KEY);
  if (!raw) return null;
  const [xText, yText] = raw.split(",");
  const x = Number(xText);
  const y = Number(yText);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function clampedPanelPosition(
  position: { readonly x: number; readonly y: number },
  size: { readonly width: number; readonly height: number }
): { readonly x: number; readonly y: number } {
  const maxX = Math.max(PANEL_MARGIN, window.innerWidth - size.width - PANEL_MARGIN);
  const maxY = Math.max(PANEL_MARGIN, window.innerHeight - size.height - PANEL_MARGIN);
  return {
    x: Math.min(Math.max(PANEL_MARGIN, position.x), maxX),
    y: Math.min(Math.max(PANEL_MARGIN, position.y), maxY),
  };
}
