import {
  proposalApprovalWarnings,
  type ProposedCall,
  type SessionEvent,
  type TurnResult,
} from "@/ai/assistantSession";
import { renderToolImages, type RenderedToolImage } from "@/ai/toolImageRenderer";
import { loadAiConfig } from "@/ai/llmClient";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { isAiConfigReady } from "@/editor/panels/aiChatPanelHelpers";
import {
  buildClusterEditKickoff,
  buildRangeClassifyKickoff,
  buildUnclassifiedAnalysisKickoff,
  type ClusterGroupSnapshot,
} from "@/ai/clusterAssistPrompt";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { store } from "@/project/store";
import type { BlobRef, JsonObject, JsonValue } from "@/ai/jobs/contracts";
import { requireNumber, requireRecord, requireString } from "@/project/io/guards";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { submitTilesetJob, type TilesetSubmitRequest } from "@/editor/aiJobs/submitTilesetJob";
import { getJobClient, verifiedArtifact } from "@/editor/aiJobs/jobClient";
import { bindJobView, readJobResult } from "@/editor/aiJobs/jobViewBinding";
import { jobOriginLink } from "@/editor/aiJobs/jobOriginLink";
import { jobSubmitMessage } from "@/editor/aiJobs/jobSubmitError";

export type ClusterAiModalDetail =
  | { readonly kind: "cluster-edit"; readonly tilesetId: string; readonly groupId: string }
  | { readonly kind: "range-classify"; readonly tilesetId: string; readonly rect: RangeClassifyRect; readonly tileIds: readonly number[] }
  | { readonly kind: "unclassified-analysis"; readonly tilesetId: string; readonly sampleTiles: readonly number[]; readonly total: number };

type RangeClassifyRect = {
  readonly h: number;
  readonly w: number;
  readonly x: number;
  readonly y: number;
};

function clusterSubmitRequest(detail: ClusterAiModalDetail, instruction: string, priorTranscript?: string): TilesetSubmitRequest {
  switch (detail.kind) {
    case "cluster-edit":
      return { operation: "cluster-edit", tilesetId: detail.tilesetId, groupId: detail.groupId, instruction, priorTranscript };
    case "range-classify":
      return { operation: "range-classify", tilesetId: detail.tilesetId, rect: detail.rect, tileIds: detail.tileIds, instruction, priorTranscript };
    case "unclassified-analysis":
      return { operation: "unclassified-analysis", tilesetId: detail.tilesetId, sampleTiles: detail.sampleTiles, total: detail.total, instruction, priorTranscript };
  }
}

function priorTranscriptFromLog(log: HTMLElement): string {
  return [...log.querySelectorAll(".cluster-ai-bubble")].flatMap(node => {
    const text = node.textContent?.trim() ?? "";
    if (!text) return [];
    if (node.classList.contains("user")) return [`[사용자] ${text}`];
    if (node.classList.contains("assistant")) return [`[조수] ${text}`];
    return [];
  }).join("\n");
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function turnFromPayload(payload: JsonObject): TurnResult {
  const assistantText = typeof payload.assistantText === "string" ? payload.assistantText : "";
  const raw = payload.proposedCalls;
  const proposedCalls: ProposedCall[] = Array.isArray(raw) ? raw.flatMap(value => {
    if (!isJsonObject(value) || typeof value.name !== "string" || typeof value.summary !== "string") return [];
    const result = isJsonObject(value.result) ? value.result : null;
    const args: Record<string, unknown> = {};
    if (isJsonObject(value.args)) {
      for (const [key, item] of Object.entries(value.args)) args[key] = item;
    }
    return [{
      name: value.name,
      args,
      summary: value.summary,
      destructive: value.destructive === true,
      result: { ok: result?.ok === true, summary: typeof result?.summary === "string" ? result.summary : "" },
    }];
  }) : [];
  return { assistantText, proposedCalls, stoppedReason: "final" };
}

type ModalModel = {
  readonly detail: ClusterAiModalDetail;
  readonly group: TileGroupMetadata | null;
  readonly title: string;
  readonly subtitle: string;
  readonly tileset: TilesetDef | null;
  readonly tileIds: readonly number[];
};

type ModalState = {
  busy: boolean;
  jobId: string | null;
};

const STAGE_IMAGE_TOOLS = new Set(["render_group_sample", "show_tiles", "show_tile_grid", "preview_house", "get_map_region"]);
const EMPTY_STAGE_TEXT = "AI가 곧 미리보기를 보여줍니다";
const CAPTION_MAX_LENGTH = 132;
const TOOL_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  get_map_region: "현재 영역",
  preview_house: "집 미리보기",
  render_group_sample: "조립 미리보기",
  show_tile_grid: "영역 미리보기",
  show_tiles: "타일 미리보기",
};
const IMAGE_CAPTION_LABELS: Readonly<Record<string, string>> = {
  get_map_region: "현재 영역",
  render_group_sample: "현재 모습",
  show_tile_grid: "영역 미리보기",
  show_tiles: "타일 미리보기",
  현재: "현재 모습",
};

let activeModal: { close: () => void; focus: () => void } | null = null;

export function openClusterAiModal(detail: ClusterAiModalDetail): void {
  activeModal?.close();
  const model = modalModel(detail);
  const state: ModalState = { busy: false, jobId: null };
  const root = el("div", {
    class: "cluster-ai-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "cluster-ai-modal" },
  });
  const closeButton = el("button", {
    class: "cluster-ai-modal-close",
    text: "닫기",
    attrs: { "aria-label": "클러스터 AI 모달 닫기", title: "닫기", type: "button" },
    dataset: { testid: "cluster-ai-modal-close" },
  });
  const status = el("div", {
    class: "cluster-ai-status",
    attrs: { "aria-live": "polite" },
    dataset: { testid: "cluster-ai-status" },
    text: "준비 중",
  });
  const log = el("div", { class: "cluster-ai-log", dataset: { testid: "cluster-ai-log" } });
  const quickReplies = el("div", { class: "cluster-ai-quick-replies", dataset: { testid: "cluster-ai-quick-replies" } });
  const proposals = el("div", { class: "cluster-ai-proposal-host", dataset: { testid: "cluster-ai-proposals" } });
  const stage = el("section", {
    class: "cluster-ai-stage",
    attrs: { "aria-label": "AI 이미지 미리보기", "aria-live": "polite" },
    dataset: { testid: "cluster-ai-stage" },
    children: [stagePlaceholder(EMPTY_STAGE_TEXT, "empty")],
  });
  const input = el("textarea", {
    class: "cluster-ai-input",
    attrs: { "aria-label": "AI에게 추가 요청", placeholder: "추가로 부탁할 내용을 입력하세요", rows: "3" },
    dataset: { testid: "cluster-ai-input" },
  });
  const sendButton = el("button", {
    class: "cluster-ai-send",
    text: "보내기",
    attrs: { title: "보내기", type: "button" },
    dataset: { testid: "cluster-ai-send" },
  });
  const dialog = el("section", {
    class: "cluster-ai-modal-window",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": model.title },
    dataset: { testid: "cluster-ai-dialog" },
    children: [
      el("header", {
        class: "cluster-ai-header",
        children: [
          el("div", { class: "cluster-ai-heading", children: [el("h2", { text: model.title }), el("p", { text: model.subtitle })] }),
          closeButton,
        ],
      }),
      el("div", {
        class: "cluster-ai-body",
        children: [
          stage,
          el("section", {
            class: "cluster-ai-bottom",
            children: [
              el("aside", {
                class: "cluster-ai-preview",
                children: [
                  el("h3", { text: "현재 타일" }),
                  renderTilePreview(model),
                ],
              }),
              el("section", {
                class: "cluster-ai-chat",
                children: [
                  status,
                  log,
                  quickReplies,
                  proposals,
                  el("div", { class: "cluster-ai-input-row", children: [input, sendButton] }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  const previewUrls = new Set<string>();
  let previewEpoch = 0;
  const close = (): void => {
    clearAgentGhostPreview();
    for (const url of previewUrls) URL.revokeObjectURL(url);
    previewUrls.clear();
    root.remove();
    document.removeEventListener?.("keydown", onKeyDown);
    if (activeModal?.close === close) activeModal = null;
  };
  const focus = (): void => closeButton.focus();
  const appendBubble = (kind: "assistant" | "system" | "tool" | "user", text: string): HTMLElement => {
    const bubble = el("div", { class: `cluster-ai-bubble ${kind}`, text: kind === "assistant" ? captionLine(text) : text });
    bubble.dataset.role = kind;
    if (kind === "assistant") bubble.setAttribute("title", text);
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  };
  const setBusy = (busy: boolean): void => {
    state.busy = busy;
    sendButton.disabled = busy;
    input.disabled = busy;
    if (busy && !hasStageImages(stage)) stage.replaceChildren(stagePlaceholder("미리보기 준비 중...", "loading"));
    if (!busy && !hasStageImages(stage) && stageHasLoadingPlaceholder(stage)) {
      stage.replaceChildren(stagePlaceholder(EMPTY_STAGE_TEXT, "empty"));
    }
  };
  const renderQuickReplies = (text: string): void => {
    quickReplies.replaceChildren(...choiceOptions(text).map((choice) =>
      el("button", {
        class: "cluster-ai-choice",
        text: choice,
        attrs: { title: choice, type: "button" },
        dataset: { testid: "cluster-ai-choice" },
        on: { click: () => void sendText(choice, choice) },
      })
    ));
  };
  const renderProposal = (result: TurnResult, jobId?: string, resultSha?: string): void => {
    proposals.replaceChildren();
    if (result.proposedCalls.length === 0) return;
    const destructive = result.proposedCalls.some((call) => call.destructive);
    const warnings = proposalApprovalWarnings(result.proposedCalls);
    proposals.append(el("section", {
      class: `cluster-ai-proposal${destructive ? " destructive" : ""}`,
      dataset: { testid: "cluster-ai-proposal" },
      children: [
        el("strong", { text: destructive ? "파괴적 변경 제안" : `변경 제안 ${result.proposedCalls.length}건` }),
        ...warnings.map((warning) => el("div", {
          class: "cluster-ai-proposal-warning",
          text: warning,
          dataset: { testid: "cluster-ai-proposal-warning" },
        })),
        el("div", {
          class: "cluster-ai-proposal-lines",
          children: result.proposedCalls.map((call) => el("div", { text: proposalLine(call) })),
        }),
        el("div", {
          class: "cluster-ai-proposal-actions",
          children: [
            el("button", {
              class: "cluster-ai-accept",
              text: "수락해서 적용",
              attrs: { title: "변경안을 바로 적용", type: "button" },
              dataset: { testid: "cluster-ai-accept" },
              on: { click: () => void acceptProposal(result.proposedCalls, jobId, resultSha) },
            }),
            el("button", {
              class: "cluster-ai-reject",
              text: "거부",
              attrs: { title: "제안 폐기", type: "button" },
              dataset: { testid: "cluster-ai-reject" },
              on: { click: rejectProposal },
            }),
          ],
        }),
      ],
    }));
  };
  const sendText = async (text: string, displayText = text): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (state.busy) {
      toast("진행 중인 응답이 끝난 뒤 다시 보내세요.", "error");
      return;
    }
    setBusy(true);
    status.textContent = "생각 중…";
    quickReplies.replaceChildren();
    const priorTranscript = priorTranscriptFromLog(log) || undefined;
    appendBubble("user", displayText);
    try {
      const receipt = await submitTilesetJob(clusterSubmitRequest(detail, trimmed, priorTranscript), { owner: root });
      state.jobId = receipt.job.id;
      previewEpoch += 1;
      const epoch = previewEpoch;
      if (!root.isConnected) return;
      setBusy(false);
      status.textContent = `작업함에 맡겼습니다 · ${receipt.job.id}`;
      const note = appendBubble("system", `작업함에 맡겼습니다 · ${receipt.job.id}`);
      note.append(jobOriginLink(receipt.job.id, sendButton));
      const unbind = bindJobView(receipt.job.id, job => {
        if (!root.isConnected) {
          unbind();
          return;
        }
        if (job.generation === "succeeded") {
          unbind();
          const ownedId = job.id;
          const resultSha = job.resultRef?.sha256;
          const owner = (): boolean =>
            root.isConnected && state.jobId === ownedId && epoch === previewEpoch
            && Boolean(resultSha) && getJobClient().jobs.get(ownedId)?.resultRef?.sha256 === resultSha;
          void (async () => {
            const result = await readJobResult(job);
            if (!owner() || !result) return;
            const liveSha = getJobClient().jobs.get(ownedId)?.resultRef?.sha256;
            if (liveSha !== resultSha) return;
            const turn = turnFromPayload(result.payload);
            appendBubble("assistant", turn.assistantText);
            renderQuickReplies(turn.assistantText);
            renderProposal(turn, ownedId, resultSha);
            await renderCapturedPreviews(stage, ownedId, resultSha, result.payload, previewUrls, owner);
            if (!owner()) return;
            status.textContent = "응답 완료";
          })().catch((cause: unknown) => {
            if (!owner()) return;
            status.textContent = "실패";
            appendBubble("system", `오류: ${jobSubmitMessage(cause)}`);
          });
        } else if (job.generation === "failed" || job.generation === "cancelled" || job.generation === "interrupted") {
          unbind();
          if (state.jobId === job.id) {
            status.textContent = job.generation === "cancelled" ? "취소됨" : job.generation === "interrupted" ? "중단됨" : "실패";
            setBusy(false);
          }
        }
      });
    } catch (cause) {
      if (!root.isConnected) return;
      setBusy(false);
      status.textContent = "오류";
      appendBubble("system", `오류: ${jobSubmitMessage(cause)}`);
    } finally {
      if (root.isConnected) setBusy(false);
    }
  };
  const acceptProposal = async (calls: readonly ProposedCall[], jobId?: string, resultSha?: string): Promise<void> => {
    const applyId = jobId ?? state.jobId;
    if (!applyId) return;
    if (calls.some((call) => call.destructive) && !(await confirmDestructive())) return;
    const warnings = proposalApprovalWarnings(calls);
    if (warnings.length > 0 && !(await confirmRuleApproval(warnings))) return;
    const live = getJobClient().jobs.get(applyId);
    if (resultSha && live?.resultRef?.sha256 !== resultSha) {
      toast("검토 중 결과가 바뀌었습니다. 새 보고서를 여세요.", "error");
      return;
    }
    clearAgentGhostPreview();
    try {
      await getJobClient().apply(applyId, { approved: true, excludedRowIds: [] });
      proposals.replaceChildren();
      appendBubble("system", `변경 ${calls.length}건을 작업함에서 적용했습니다.`);
      status.textContent = "적용됨";
      toast("AI 변경안을 적용했습니다.", "ok");
    } catch (error) {
      const message = `적용 실패: ${jobSubmitMessage(error)}`;
      status.textContent = "적용 실패";
      appendBubble("system", message);
      toast(message, "error");
    }
  };
  const rejectProposal = (): void => {
    proposals.replaceChildren();
    clearAgentGhostPreview();
    appendBubble("system", "제안을 거부하고 초안을 폐기했습니다. 결과는 작업함에 남아 있습니다.");
    status.textContent = "제안 거부됨";
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") trapFocus(event, dialog);
  };
  root.addEventListener("click", (event) => {
    if (event.target === root) close();
  });
  closeButton.addEventListener("click", close);
  sendButton.addEventListener("click", () => void sendText(input.value));
  input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void sendText(input.value);
  });
  root.append(dialog);
  document.body.append(root);
  document.addEventListener?.("keydown", onKeyDown);
  activeModal = { close, focus };
  focus();
  startKickoff(model, appendBubble, status, sendText);
}

function modalModel(detail: ClusterAiModalDetail): ModalModel {
  const project = store.getCurrent();
  const tileset = project.tilesets[detail.tilesetId] ?? null;
  switch (detail.kind) {
    case "cluster-edit": {
      const group = tileset?.tileGroups?.find((entry) => entry.id === detail.groupId) ?? null;
      const name = group?.name ?? detail.groupId;
      const tileIds = group?.tileIds ?? [];
      return { detail, group, tileIds, tileset, title: name, subtitle: `${roleLabel(group?.role)} · 타일 ${tileIds.length}개` };
    }
    case "range-classify":
      return {
        detail,
        group: null,
        tileIds: detail.tileIds,
        tileset,
        title: `범위 분류 — ${detail.tileIds.length}개 타일`,
        subtitle: `시트 범위 (${detail.rect.x},${detail.rect.y}) ${detail.rect.w}×${detail.rect.h}`,
      };
    case "unclassified-analysis":
      return {
        detail,
        group: null,
        tileIds: detail.sampleTiles,
        tileset,
        title: "미분류 타일 분석",
        subtitle: `${detail.total}개 · 첫 ${detail.sampleTiles.length}개 미리보기`,
      };
  }
  return assertNever(detail);
}

function startKickoff(
  model: ModalModel,
  appendBubble: (kind: "assistant" | "system" | "tool" | "user", text: string) => HTMLElement,
  status: HTMLElement,
  sendText: (text: string, displayText?: string) => Promise<void>
): void {
  const config = loadAiConfig();
  // 준비 여부는 lite 해석 전에 저장 설정과 실제 연결 캐시로 판단한다. configForLiteModel 계열은
  // 기본 lite 모델을 채우므로 해석 뒤 모델 모양을 보면 영원히 준비됨이다. cold-cache checking은
  // 첫 사용을 잠그지 않고, 조회로 확인된 미연결·오프라인·오류만 막는다.
  if (!isAiConfigReady(config, getAiConnectionStatus(config))) {
    status.textContent = "설정 필요";
    appendBubble("system", "AI 연결을 먼저 완료하세요. 오른쪽 AI 패널에서 구독 로그인을 마친 뒤 다시 열어 주세요.");
    return;
  }
  const kickoff = kickoffFor(model.detail);
  if (!kickoff.prompt.trim()) {
    status.textContent = "시작 실패";
    appendBubble("system", "AI 분석을 시작할 수 없습니다.");
    return;
  }
  void sendText(kickoff.prompt, kickoff.displayAs ?? model.title);
}

function parsePreviewBlobRef(value: JsonValue): BlobRef | null {
  try {
    const record = requireRecord("preview blob ref", value);
    const sha256 = requireString("sha256", record.sha256);
    const byteLength = requireNumber("byteLength", record.byteLength);
    const mediaType = requireString("mediaType", record.mediaType);
    if (!/^[a-f0-9]{64}$/u.test(sha256) || !Number.isSafeInteger(byteLength) || byteLength < 0 || mediaType.length === 0) return null;
    return { sha256, byteLength, mediaType };
  } catch {
    return null;
  }
}

async function renderCapturedPreviews(
  stage: HTMLElement,
  jobId: string,
  resultSha: string | undefined,
  payload: JsonObject,
  urls: Set<string>,
  owner: () => boolean,
): Promise<void> {
  const created: string[] = [];
  const drop = (): void => {
    for (const url of created) {
      URL.revokeObjectURL(url);
      urls.delete(url);
    }
    created.length = 0;
  };
  try {
    const previews = payload.previews;
    if (!Array.isArray(previews) || !resultSha || !owner()) return;
    const client = getJobClient();
    const { job, manifest } = await client.artifacts.detail(jobId);
    if (!owner() || job.resultRef?.sha256 !== resultSha) return;
    const groups: HTMLElement[] = [];
    for (const preview of previews) {
      if (!isJsonObject(preview) || !Array.isArray(preview.images)) continue;
      const images: RenderedToolImage[] = [];
      for (const image of preview.images) {
        if (!isJsonObject(image)) continue;
        const ref = parsePreviewBlobRef(image.ref);
        if (!ref) continue;
        const bytes = await verifiedArtifact(client, jobId, ref, manifest);
        if (!owner()) {
          drop();
          return;
        }
        const url = displayBytesUrl(bytes, ref.mediaType);
        if (url.startsWith("blob:")) {
          created.push(url);
          urls.add(url);
        }
        images.push({ dataUrl: url, label: typeof image.label === "string" ? image.label : "" });
      }
      if (preview.status === "missing" && images.length === 0) {
        groups.push(stagePlaceholder("미리보기를 표시할 수 없습니다.", "empty"));
        continue;
      }
      if (images.length) groups.push(stageImageGroup(images));
    }
    if (!owner()) {
      drop();
      return;
    }
    if (!groups.length) return;
    stage.replaceChildren(...groups);
  } catch (error) {
    drop();
    if (owner()) throw error;
  }
}

function displayBytesUrl(bytes: Uint8Array, mediaType: string): string {
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return URL.createObjectURL(new Blob([copy], { type: mediaType }));
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${mediaType};base64,${btoa(binary)}`;
}

function renderTilePreview(model: ModalModel): HTMLElement {
  const tileset = model.tileset;
  if (!tileset) return el("div", { class: "cluster-ai-empty", text: "타일셋을 찾을 수 없습니다." });
  if (model.tileIds.length === 0) return el("div", { class: "cluster-ai-empty", text: "표시할 타일이 없습니다." });
  return el("div", {
    class: "cluster-ai-tile-grid",
    children: model.tileIds.map((tileId) => el("div", {
      class: "cluster-ai-tile",
      attrs: {
        style: tilesetTileBackgroundStyle(tileset, tileId, 44),
        title: `타일 ${tileId}`,
      },
      dataset: { testid: `cluster-ai-tile-${tileId}` },
      children: [el("span", { text: String(tileId) })],
    })),
  });
}

export async function renderStageToolCall(stage: HTMLElement, event: Extract<SessionEvent, { type: "tool_call" }>): Promise<void> {
  if (!event.result.ok || !STAGE_IMAGE_TOOLS.has(event.name)) return;
  if (!hasStageImages(stage)) stage.replaceChildren(stagePlaceholder("미리보기 렌더링 중...", "loading"));
  try {
    const images = await renderToolImages(store.getCurrent(), event.name, event.result.data ?? event.args);
    if (images.length === 0) {
      if (!hasStageImages(stage)) stage.replaceChildren(stagePlaceholder("미리보기를 표시할 수 없습니다.", "empty"));
      return;
    }
    if (!hasStageImages(stage)) stage.replaceChildren();
    stage.append(stageImageGroup(images));
  } catch (cause) {
    if (cause instanceof Error) {
      if (!hasStageImages(stage)) stage.replaceChildren(stagePlaceholder("미리보기를 표시할 수 없습니다.", "empty"));
      return;
    }
    throw cause;
  }
}

function stageImageGroup(images: readonly RenderedToolImage[]): HTMLElement {
  if (images.length === 2) {
    return el("div", {
      class: "cluster-ai-beforeafter",
      dataset: { testid: "cluster-ai-beforeafter" },
      children: images.map(stageImageCard),
    });
  }
  return el("div", {
    class: images.length > 1 ? "cluster-ai-image-grid" : "cluster-ai-image-single",
    children: images.map(stageImageCard),
  });
}

function stageImageCard(image: RenderedToolImage): HTMLElement {
  const label = imageCaption(image.label);
  const img = el("img", {
    attrs: { alt: label, loading: "eager", src: image.dataUrl },
  });
  img.addEventListener("error", () => {
    img.parentElement?.replaceChildren(stagePlaceholder("이미지를 불러오지 못했습니다.", "empty"));
  });
  return el("figure", {
    class: "cluster-ai-stage-card",
    children: [
      el("figcaption", { text: label }),
      img,
    ],
  });
}

export function toolDisplayName(name: string): string {
  return TOOL_DISPLAY_NAMES[name] ?? "도구 실행";
}

function imageCaption(label: string): string {
  const trimmed = label.trim();
  const fallback = trimmed || "미리보기";
  return IMAGE_CAPTION_LABELS[trimmed] ?? fallback;
}

function stagePlaceholder(text: string, state: "empty" | "loading"): HTMLElement {
  return el("div", { class: `cluster-ai-stage-placeholder ${state}`, text });
}

function hasStageImages(stage: HTMLElement): boolean {
  return stage.querySelector("img") !== null;
}

function stageHasLoadingPlaceholder(stage: HTMLElement): boolean {
  const placeholder = stage.querySelector(".cluster-ai-stage-placeholder");
  return Boolean(placeholder?.className.includes("loading"));
}

function captionLine(text: string): string {
  const cleaned = text.replace(/\s+/gu, " ").trim();
  if (!cleaned) return "";
  const withoutChoices = cleaned.replace(/\s*\[선택지\]\s*[^\n]+/u, "").trim();
  const caption = withoutChoices || cleaned;
  return caption.length > CAPTION_MAX_LENGTH ? `${caption.slice(0, CAPTION_MAX_LENGTH - 3)}...` : caption;
}

/** 킥오프 프롬프트는 클러스터 보조 프롬프트 빌더가 단일 원천이다(구 스킬 레지스트리 경유 제거). */
function kickoffFor(detail: ClusterAiModalDetail): { readonly prompt: string; readonly displayAs: string } {
  switch (detail.kind) {
    case "cluster-edit":
      return {
        prompt: buildClusterEditKickoff({
          tilesetId: detail.tilesetId,
          groupId: detail.groupId,
          group: clusterGroupSnapshot(detail.tilesetId, detail.groupId),
        }),
        displayAs: `클러스터 수정 — ${detail.groupId}`,
      };
    case "range-classify":
      return {
        prompt: buildRangeClassifyKickoff({
          tilesetId: detail.tilesetId,
          rect: detail.rect,
          tileIds: detail.tileIds,
        }),
        displayAs: `범위 분류 — ${detail.tileIds.length}개`,
      };
    case "unclassified-analysis":
      return {
        prompt: buildUnclassifiedAnalysisKickoff({
          tilesetId: detail.tilesetId,
          sampleTiles: detail.sampleTiles,
          total: detail.total,
        }),
        displayAs: `미분류 분석 — ${detail.total}개`,
      };
  }
  return assertNever(detail);
}

function clusterGroupSnapshot(tilesetId: string, groupId: string): ClusterGroupSnapshot | null {
  const group = store.getCurrent().tilesets[tilesetId]?.tileGroups?.find((entry) => entry.id === groupId);
  if (!group) return null;
  return {
    id: group.id,
    name: group.name,
    role: group.role,
    defaultLayer: group.defaultLayer,
    tileIds: [...group.tileIds],
    description: group.description,
    placementRules: group.placementRules,
    patternGrammar: group.patternGrammar ? { kind: group.patternGrammar.kind } : null,
  };
}

function choiceOptions(text: string): readonly string[] {
  const match = text.match(/\[선택지\]\s*([^\n]+)/u);
  if (!match) return [];
  return match[1].split("|").map((item) => item.trim()).filter(Boolean);
}

function proposalLine(call: ProposedCall): string {
  return `${call.destructive ? "파괴적 · " : ""}${call.name}${ruleStrengthLabel(call)} — ${call.summary}`;
}

// 확인 모달 없음(2026-09: 변경 확인 팝업을 띄우지 않는 정책) — 파괴·규칙 경고가 있어도
// 바로 적용하고 복구는 되돌리기다.
function confirmDestructive(): Promise<boolean> {
  return Promise.resolve(true);
}

function confirmRuleApproval(warnings: readonly string[]): Promise<boolean> {
  void warnings;
  return Promise.resolve(true);
}

function ruleStrengthLabel(call: ProposedCall): string {
  if (call.name !== "set_cluster_rule" || !isRecord(call.args.rule)) return "";
  const strength = call.args.rule.strength;
  return typeof strength === "string" ? ` · 강도: ${strength}` : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trapFocus(event: KeyboardEvent, root: HTMLElement): void {
  const focusables = Array.from(root.querySelectorAll("button:not(:disabled), textarea:not(:disabled)"))
    .filter((node): node is HTMLElement => node instanceof HTMLElement);
  if (focusables.length === 0) return;
  const active = document.activeElement;
  const currentIndex = active instanceof HTMLElement ? focusables.indexOf(active) : -1;
  const nextIndex = event.shiftKey
    ? currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1
    : currentIndex >= focusables.length - 1 ? 0 : currentIndex + 1;
  event.preventDefault();
  focusables[nextIndex]?.focus();
}

function roleLabel(role: TileGroupMetadata["role"] | undefined): string {
  switch (role) {
    case "building": return "건물";
    case "castle": return "성";
    case "fence": return "울타리";
    case "prop": return "소품";
    case "roof": return "지붕";
    case "terrain": return "지형";
    case "wall": return "벽";
    case "water": return "물";
    case undefined: return "역할 없음";
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled cluster AI modal detail: ${JSON.stringify(value)}`);
}
