// editor/panels/aiTurnRunner.ts
// 채팅 **한 턴**의 실행부. 스트리밍 이벤트 배선 → 툴 활동 → 청사진/고스트 정산 →
// 제안 적용/변경 카드 → 상태·진행·접힘 복귀까지. aiChatPanel(3,422줄)에서 분리했다.
//
// 상태는 소유하지 않는다 — 공통 실행 표면은 `deps.surface`(AiRunSurface), 턴에만 필요한
// 것은 `deps` 의 나머지다. 그래서 "한 턴이 패널의 무엇을 흔드는가"가 인터페이스로 다 드러난다.
// 되돌리기 주의: 아래 이벤트 분기 순서와 정산(settleBlueprintForTurnEnd) 호출 지점은 실측
// 결함의 회귀 지점이다(주석 참조) — 순서를 바꾸지 말 것.
import { turnErrorNotice } from "@/ai/aiGateNotice";
import type { ComposerMode } from "@/ai/composerMode";
import { showAiGateNotice } from "@/editor/ui/aiGateModal";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { loadAiConfig } from "@/ai/llmClient";
import { recordAiActivity, type AiActivityToolCall } from "@/ai/activityLog";
import { isUsableToolReason, toolCallsFromAudit } from "@/ai/toolReason";
import { resolveProposalApplyMode } from "@/ai/approvalPolicy";
import { proposalCompletenessWarnings } from "@/ai/proposalCompleteness";
import type { AssistantSession, ProposedCall, SessionEvent, TurnResult } from "@/ai/assistantSession";
import type { ProposalApplyOutcome } from "@/editor/panels/aiProposalCard";
import type { WorkPlan } from "@/ai/workPlan";
import type { BuildSpec } from "@/ai/buildSpec";
import type { AiDocument } from "@/project/types";
import {
  beginAgentBlueprintTurn,
  commitAgentBlueprintProgress,
  markAgentBlueprintProgress,
  retireAgentBlueprint,
  setAgentBlueprintFromSpec,
  settleAgentBlueprintTurn,
  syncAgentBlueprintWithSpec,
} from "@/editor/agentBlueprint";
import { getPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { appliedBlueprintRegions } from "@/editor/agentBlueprintRegions";
import { focusEditorRegion, type EditorFocusRegion } from "@/editor/editorReferenceNavigation";
import { shouldClearAiHighlightSelection } from "@/editor/transientEditorChrome";
import {
  clearAgentGhostPreview,
  replaceAgentGhostPreviewFromProjectDiff,
  createThrottledAgentGhostPreviewUpdater,
  setAgentGhostDraftMapProvider,
  setAgentGhostRunningTool,
} from "@/editor/agentGhostPreview";
import {
  attachCompletenessWarnings,
  completenessSpecForProposal,
  isWriteTool,
  phaseStatusText,
  shouldShowStatusInChat,
  type TileGridData,
} from "./aiChatPanelHelpers";
import { parseAutonomousRunBudget, type AutonomousRunBudget } from "./aiChatRenderers";
import { toolLabel } from "./aiToolLabels";
import { formatRunRecapPlayerLine } from "@/ai/runRecap";
import { renderStreamedMarkdown } from "./aiConversationLog";
import { decorateAssistantMentions, foldWorkLogs } from "./aiBubbleDecorations";
import type { AiRunSurface } from "./aiRunSurface";
import { randomUuid } from "@/util/id";
import { distillPreferences } from "@/ai/preferenceDistiller";
import { observeTurn, shouldDistillPreferences } from "@/ai/preferenceSignals";
import { aiUiEventMarker, recordAiUiEvent, takeAiUiEventsSince } from "@/ai/uiEventLog";
import { AI_UI_ACTIONS } from "@/ai/uiEventTypes";

export interface AiTurnRunnerDeps {
  /** 채팅 턴과 영역 작업이 공유하는 실행 표면(상태 줄·진행·중단·로그·접힘). */
  readonly surface: AiRunSurface;

  // ── 턴 전용 가변 상태(소유자는 패널) ─────────────────────
  applyingProposal: boolean;
  projectIdentityId: string;
  /** 할 일 목록(작업 계획 체크리스트) 상태 — 소유자는 패널. 턴이 시작되면 존재하고, 대화 경계에서만 null 이 된다. */
  readonly workPlanSurfaceState: {
    active: boolean;
    stoppedReason?: string;
    plan: WorkPlan | null;
    budget: AutonomousRunBudget | null;
  } | null;

  // ── 제안 · 변경 카드 ─────────────────────────────────────
  readonly applyProposal: (calls: readonly ProposedCall[], assistantBubble?: HTMLElement | null) => Promise<ProposalApplyOutcome>;
  readonly noteNoChanges: (result: TurnResult, extraWarnings?: readonly string[]) => void;

  // ── 할 일 목록 표면 ──────────────────────────────────────
  /** Every accepted turn, including manual retry, owns fresh live plan chrome. */
  readonly beginWorkPlanTurn: (opts: { readonly autonomous: boolean; readonly carriedPlan: WorkPlan | null }) => void;
  /** 턴 종료 — 계획 데이터는 남기고 라이브 표면은 걷는다. */
  readonly settleWorkPlanTurn: () => void;
  readonly refreshWorkPlanSurface: () => void;
  /** work_plan 이벤트 — 항목 체크가 바뀔 때마다 목록을 다시 그린다. */
  readonly showWorkPlan: (plan: WorkPlan) => void;
  /** tool_started — 진행 중 항목 아래 「지금 하는 일」 한 줄. */
  readonly noteWorkPlanActivity: (label: string) => void;
  readonly appendMilestoneFeedLine: (kind: "applied" | "apply-failed", title: string, detail: string) => void;

  // ── 로그 첨부 ────────────────────────────────────────────
  readonly appendTileThumbs: (tilesetId: string, tiles: readonly number[]) => void;
  readonly appendTileGrid: (data: TileGridData) => void;
  readonly appendAiDocument: (documentData: AiDocument) => void;

  // ── 그 밖의 패널 동작 ────────────────────────────────────
  readonly hasPendingQuestion: () => boolean;
  readonly openAiSettings: (focusTarget?: "first" | "apiKey") => void;
  readonly renderQuickReplies: (assistantText: string) => void;
  /** 컨텍스트 게이지 갱신 — 턴이 끝나면 남은 토큰을 다시 그린다(상류 #302 이후 추가). */
  readonly refreshContextMeter: () => void;
}

export interface AiTurnRunner {
  /** 최초 전송과 수동 재시도가 공유하는 한 턴 실행. */
  readonly executeTurn: (
    session: AssistantSession,
    requestText: string,
    exec: (onEvent: (event: SessionEvent) => void, signal: AbortSignal) => Promise<TurnResult>,
    runOpts?: { readonly autonomous?: boolean; readonly composerMode?: ComposerMode },
  ) => Promise<void>;
  /** LLM 오류 버블 + [설정 열기]/[재시도] 행. */
  readonly appendErrorWithRetry: (message: string, session: AssistantSession, requestText: string, runOpts?: { readonly autonomous?: boolean; readonly composerMode?: ComposerMode }) => void;
}

export function createAiTurnRunner(deps: AiTurnRunnerDeps): AiTurnRunner {
  const executeTurn = async (
    session: AssistantSession,
    requestText: string,
    exec: (onEvent: (event: SessionEvent) => void, signal: AbortSignal) => Promise<TurnResult>,
    runOpts?: { readonly autonomous?: boolean; readonly composerMode?: ComposerMode }
  ): Promise<void> => {
    if (deps.surface.turnBusy) {
      toast("진행 중인 응답이 끝난 뒤 다시 시도하세요", "info");
      return;
    }
    deps.surface.turnBusy = true;
    deps.beginWorkPlanTurn({
      autonomous: runOpts?.autonomous === true,
      carriedPlan: session.getWorkPlan(),
    });
    const turnConversationId = deps.surface.conversationId;
    const turnConversationScope = deps.surface.conversationScope;
    const auditHistoryAtTurnStart = [...deps.surface.controller.auditHistory];
    // 이 턴의 활동 로그 식별자. 시작·종료가 같은 id 로 upsert 되므로 행이 늘지 않는다.
    const turnLogId = randomUuid();
    // 턴 구간에 눌린 프론트 액션만 이 턴 행에 싣기 위한 표식(src/ai/uiEventLog.ts).
    const uiEventMarkerAtTurnStart = aiUiEventMarker();
    // 세션 audit 은 턴을 넘어 누적된다 — 이 지점부터가 «이번 턴» 이다. 세션 전체를 넣고 뒤에서
    // 자르면 긴 턴의 머리(사람 발언·플래너 결정)가 날아간다(2026-08-30 실측).
    const sessionAuditCountAtTurnStart = session.getAuditEntries().length;
    // 시작 시점에 먼저 남긴다. 새로고침·크래시·강제 종료로 종료 기록이 못 남아도 «무슨 지시였고
    // 언제 시작했는지» 는 남는다 — 예전에는 완료만 기록해서 죽은 턴은 흔적이 없었다.
    {
      const startCfg = loadAiConfig();
      void recordAiActivity({
        id: turnLogId,
        channel: "chat",
        instruction: requestText,
        projectContextKey: turnConversationScope,
        model: startCfg.model,
        liteModel: startCfg.liteModel,
        result: { ok: false, pending: true },
      }).catch(() => {
        /* 기록 실패가 턴을 막지 않는다 */
      });
    }
    const abortController = new AbortController();
    deps.surface.activeAbortController = abortController;
    deps.surface.abortNoticeShown = false;
    const ownsTurn = (allowAborted = false): boolean =>
      !deps.surface.disposed
      && deps.surface.activeAbortController === abortController
      && (allowAborted || !abortController.signal.aborted);
    // 접혀 시작한 턴만 종료 후 재접기. 이미 열린 첫 방문/펼침은 열린 채 유지.
    deps.surface.collapseAfterAiWork = deps.surface.collapsed;
    deps.surface.expandForAiWork();
    deps.surface.beginTurnProgress();
    deps.surface.refreshAbortButton();
    deps.refreshContextMeter(); // 진행 중에는 압축 버튼이 잠긴다(busy) — 그 상태를 즉시 반영한다.
    deps.surface.sendButton.disabled = true;
    const activeSpecAtTurnStart = session.getActiveSpec();
    // 지난 턴의 "이번 턴에 올린 칸" 기록을 끊는다 — 아래 두 곳의 `!ownsTurn(true)` 반환은 정산을
    // 지나지 않으므로(소유권을 잃은 턴) 그 기록이 이번 턴 정산까지 살아남아 손대지도 않은 칸을
    // planned 로 되돌릴 수 있다. 지금은 dropSession/dispose 가 청사진을 함께 지워서 드러나지
    // 않지만 그건 결합에 의한 안전이다.
    beginAgentBlueprintTurn();
    // 청사진을 세션 스펙에 다시 맞춘다 — set_build_spec 은 계획을 세운 턴에만 오므로(스펙은
    // 턴 간 유지된다) 이 재동기화가 없으면 두 번째 턴부터 맵에 밑그림이 사라진다.
    syncAgentBlueprintWithSpec(activeSpecAtTurnStart);
    const ghostPreviewUpdater = createThrottledAgentGhostPreviewUpdater({
      getBaseProject: () => store.getCurrent(),
      getDraftProject: () => session.getProposedProject(),
      isWriteTool,
    });
    // 고스트 렌더러가 승인 전 초안 맵을 에디터 컴포지터 경로로 합성해 찍도록 공급한다.
    setAgentGhostDraftMapProvider((mapId) => session.getProposedProject().maps[mapId]);
    let confirmedBuildSpecThisTurn: BuildSpec | null = null;
    let highlightedRegionThisTurn = false;
    let turnFailed = false; // 접힘 레일 알림 점의 색(완료=초록/오류=빨강) 결정용.
    let turnResult: TurnResult | null = null;
    // 마일스톤 이벤트와 반환 원장은 같은 적용분이다. 합산하지 않고 최대값으로 맞춘다.
    let appliedWriteCount = 0;
    let turnCatchError: string | undefined;
    let assistantBubble: HTMLElement | null = null;
    let reasoningBox: { box: HTMLElement; body: HTMLElement } | null = null;
    const streamedBubbles: HTMLElement[] = [];
    let currentStreamNodes: HTMLElement[] = [];
    const trackCurrentStreamNode = (node: HTMLElement): void => {
      if (!currentStreamNodes.includes(node)) currentStreamNodes.push(node);
    };
    const clearCurrentStreamAttempt = (): void => {
      const discarded = new Set(currentStreamNodes);
      currentStreamNodes.forEach((node) => node.remove());
      for (let index = streamedBubbles.length - 1; index >= 0; index -= 1) {
        if (discarded.has(streamedBubbles[index])) streamedBubbles.splice(index, 1);
      }
      for (const node of discarded) { if (deps.surface.isLastReasoningBox(node)) deps.surface.clearLastReasoning(); }
      currentStreamNodes = [];
      assistantBubble = null;
      reasoningBox = null;
    };
    const liveToolCalls: AiActivityToolCall[] = [];
    const persistTurnSnapshot = (pending: boolean): void => {
      const startCfg = loadAiConfig();
      const turnAudit =
        session.getAuditEntries().length >= sessionAuditCountAtTurnStart
          ? session.getAuditEntries().slice(sessionAuditCountAtTurnStart)
          : session.getAuditEntries();
      void recordAiActivity({
        id: turnLogId,
        channel: "chat",
        instruction: requestText,
        projectContextKey: turnConversationScope,
        model: startCfg.model,
        liteModel: startCfg.liteModel,
        mapId: editorState.get().currentMapId ?? undefined,
        result: { ok: false, pending },
        toolCalls: liveToolCalls.length > 0 ? liveToolCalls : toolCallsFromAudit(turnAudit),
        audit: turnAudit,
        uiActions: takeAiUiEventsSince(uiEventMarkerAtTurnStart),
      }).catch(() => {
        /* 기록 실패가 턴을 막지 않는다 */
      });
    };
    const onEvent = (event: SessionEvent): void => {
      if (!ownsTurn()) return;
      if (event.type === "phase") {
        deps.surface.runningPhaseStatus = phaseStatusText(event.value);
        if (deps.surface.runningProgress) deps.surface.refreshRunningStatus(true);
        else deps.surface.setStatus(deps.surface.runningPhaseStatus);
        return;
      }
      if (event.type === "assistant_stream_reset") {
        clearCurrentStreamAttempt();
        return;
      }
      if (event.type === "reasoning_token") {
        if (!reasoningBox) {
          reasoningBox = deps.surface.appendReasoning();
          trackCurrentStreamNode(reasoningBox.box);
        }
        reasoningBox.body.textContent = (reasoningBox.body.textContent ?? "") + event.delta;
        deps.surface.log.scrollTop = deps.surface.log.scrollHeight;
        return;
      }
      if (event.type === "assistant_token") {
        reasoningBox = null; // 답변이 시작되면 다음 추론은 새 상자.
        if (!assistantBubble) {
          assistantBubble = deps.surface.appendBubble("assistant", "");
          streamedBubbles.push(assistantBubble);
          trackCurrentStreamNode(assistantBubble);
          deps.surface.closeToolActivity(); // 응답이 시작되면 다음 툴은 새 그룹으로.
        }
        assistantBubble.textContent = (assistantBubble.textContent ?? "") + event.delta;
        deps.surface.log.scrollTop = deps.surface.log.scrollHeight;
      } else if (event.type === "assistant_message") {
        if (!event.content.trim()) return;
        if (!assistantBubble) {
          assistantBubble = deps.surface.appendBubble("assistant", event.content);
        } else {
          assistantBubble.textContent = event.content;
        }
        currentStreamNodes = [];
      } else if (event.type === "tool_started") {
        // 채팅과 상태 배지 모두 실행 직전에 구체적인 현재 작업을 반영한다.
        setAgentGhostRunningTool(event.name);
        deps.surface.startLiveActivity(event.name, event.index);
        deps.noteWorkPlanActivity(toolLabel(event.name));
      } else if (event.type === "tool_call") {
        liveToolCalls.push({
          name: event.name,
          args: event.args,
          ok: event.result.ok,
          summary: event.result.summary,
          ...(isUsableToolReason(event.reason) ? { reason: event.reason } : {}),
        });
        persistTurnSnapshot(true);
        deps.surface.persistConversation({
          id: turnConversationId,
          scope: turnConversationScope,
          entries: [...auditHistoryAtTurnStart, ...session.getAuditEntries()],
        });
        deps.surface.completeLiveActivity(event.name, event.result, event.args);
        ghostPreviewUpdater.handleToolCall(event);
        // 청사진 진행 — 이번 호출이 어느 칸을 짓고 있는지로 planned/building/done 을 옮긴다.
        // 쓰기 여부를 같이 넘긴다: 이 훅은 성공한 **모든** 툴콜에서 발화하므로 읽기 툴
        // (show_map_region 등)이 그대로 통과하면 확인 호출이 진행을 앞당긴다.
        if (event.result.ok) markAgentBlueprintProgress(event.name, event.args, { write: isWriteTool(event.name) });
        assistantBubble = null; // 툴 이후 새 assistant 응답은 새 버블.
        reasoningBox = null; // 툴 이후 새 추론은 새 상자.
        currentStreamNodes = [];
        // 밑그림(스펙) 확정: 짧은 요약 + 접힌 상세(채팅 노이즈 감소).
        if (event.name === "set_build_spec" && event.result.ok && event.result.data) {
          const spec = event.result.data as BuildSpec;
          confirmedBuildSpecThisTurn = spec;
          // 밑그림을 맵에도 깐다 — 지금까지는 이 접힌 텍스트가 계획을 볼 수 있는 유일한 창이었다.
          setAgentBlueprintFromSpec(spec);
          const title = spec.title ?? spec.mapId;
          const detailLines = [
            ...(spec.buildOrder && spec.buildOrder.length > 0 ? [`건설 순서: ${spec.buildOrder.join(" → ")}`] : []),
            ...spec.assets.map(
              (asset) =>
                `· ${asset.id} (${asset.kind}) (${asset.x},${asset.y}) ${asset.w}×${asset.h}${asset.style ? ` — ${asset.style}` : ""}`
            ),
          ];
          const details = el("details", {
            class: "ai-chat-bubble ai-chat-system ai-build-spec-summary",
            dataset: { testid: "ai-build-spec-summary" },
            children: [
              el("summary", { text: `📐 밑그림 확정 — ${title} · 에셋 ${spec.assets.length}개` }),
              el("pre", {
                class: "ai-build-spec-detail",
                text: detailLines.length > 0 ? detailLines.join("\n") : "(영역 상세 없음)",
              }),
            ],
          });
          deps.surface.log.append(details);
          deps.surface.log.scrollTop = deps.surface.log.scrollHeight;
          deps.surface.setStatus(`밑그림 확정 — 에셋 ${spec.assets.length}개`);
        }
        // 인터뷰 하이라이트: 강조 툴콜을 에디터 selection으로 반영해 맵 위에 사각형을 그린다.
        // 맵 전환·카메라까지 함께 옮긴다 — 선택만 세우면 강조 대상이 **다른 맵**이거나 화면 밖일 때
        // 사용자에게는 아무 일도 일어나지 않는다(툴은 성공했는데 "어디를 묻는지" 가 안 보였다).
        if (event.name === "highlight_map_region" && event.result.ok) {
          const region = event.result.data as EditorFocusRegion;
          highlightedRegionThisTurn = true;
          editorState.set({ selection: { mapId: region.mapId, x: region.x, y: region.y, width: region.w, height: region.h } });
          focusEditorRegion(region, { onlyIfOffscreen: true });
        }
        // 조수의 화면 이동 요청: 맵을 열고 카메라를 보내고 잠깐 강조한다(선택 상태는 건드리지 않는다).
        if (event.name === "focus_editor_view" && event.result.ok) {
          focusEditorRegion(event.result.data as EditorFocusRegion, { highlight: true });
        }
        // 타일 이미지 표시 요청: 채팅 버블에 썸네일로 렌더.
        if (event.name === "show_tiles" && event.result.ok) {
          const data = event.result.data as { tilesetId: string; tiles: number[] };
          deps.appendTileThumbs(data.tilesetId, data.tiles);
        }
        // 맵 영역 그리드 표시: 하위+상위 합성 이미지로 렌더(구조물 학습의 시각 자료).
        if (event.name === "show_tile_grid" && event.result.ok) {
          deps.appendTileGrid(event.result.data as TileGridData);
        }
        // AI 리치 문서(present_doc): 구조화 블록/샌드박스 HTML을 채팅에 렌더.
        if (event.name === "present_doc" && event.result.ok) {
          const data = event.result.data as { document?: AiDocument };
          if (data?.document) deps.appendAiDocument(data.document);
        }
        // 인터뷰 진행률: 분석 결과의 커버리지를 상태줄에 표시.
        if (event.name === "analyze_map_tile_usage" && event.result.ok) {
          const data = event.result.data as { coverage?: { used: number; described: number } };
          if (data.coverage) deps.surface.setStatus(`타일 설명 ${data.coverage.described}/${data.coverage.used}`);
        }
      } else if (event.type === "status") {
        // 대부분은 상태줄만. 재시도·오류 등 행동 신호만 말풍선.
        deps.surface.setStatus(event.text);
        // 자율 런 예산(used/48) 표시 갱신 — 드라이버의 계속/소진 status 이벤트에서 파싱.
        // 다이얼 명시 시 표시 total 은 레벨 cap 으로 클램프한다(표시 전용 — 세션 상한은 그대로).
        const parsedBudget = parseAutonomousRunBudget(event.text);
        const budget = parsedBudget && deps.workPlanSurfaceState?.budget
          ? { ...parsedBudget, total: Math.min(parsedBudget.total, deps.workPlanSurfaceState.budget.total) }
          : parsedBudget;
        if (budget && deps.workPlanSurfaceState) {
          deps.workPlanSurfaceState.budget = budget;
          deps.refreshWorkPlanSurface();
        }
        if (event.text.includes("예산 소진") || event.text.includes("agent_run_budget_exhausted")) {
          if (!deps.surface.log.querySelector("[data-testid=ai-continue-run]")) {
            const continueRow = el("div", { class: "ai-retry-row" });
            const continueBtn = el("button", {
              class: "ai-assistant-action",
              text: "계속",
              attrs: { type: "button" },
              dataset: { testid: "ai-continue-run" },
              on: { click: () => { void deps.surface.sendText("계속"); } },
            });
            continueRow.append(continueBtn);
            deps.surface.log.append(continueRow);
            deps.surface.log.scrollTop = deps.surface.log.scrollHeight;
          }
        }
        if (shouldShowStatusInChat(event.text)) deps.surface.appendBubble("system", event.text);
      } else if (event.type === "work_plan") {
        const s = event.plan;
        const items = Array.isArray(s.layers)
          ? s.layers.flatMap((layer) => (Array.isArray(layer.items) ? layer.items : []))
          : [];
        const done = items.filter((i) => i.status === "done" || i.status === "skipped").length;
        deps.surface.setStatus(`작업 계획 ${done}/${items.length}`);
        // 할 일 목록: emitWorkPlan 이벤트마다 항목 체크/현재 레이어를 갱신한다 — 자율 런뿐 아니라 모든 턴.
        deps.showWorkPlan(s);
      } else if (event.type === "milestone_applied") {
        appliedWriteCount += event.toolCount;
        deps.appendMilestoneFeedLine("applied", event.title, `도구 ${event.toolCount}건${event.commitId ? ` · 커밋 ${event.commitId}` : ""}`);
        // 자율 런은 턴 도중에 저장소로 커밋한다 — 여기까지의 진행은 실제로 들어갔으므로 확정한다.
        // 확정하지 않으면 뒤이은 중단이 이미 들어간 시공까지 planned 로 되돌린다(마일스톤 적용은
        // turnProposals 를 비우므로 턴 끝의 정산은 그 호출들을 볼 수 없다).
        commitAgentBlueprintProgress();
      } else if (event.type === "run_recap") {
        const line = formatRunRecapPlayerLine(event.recap);
        deps.surface.setStatus(line);
        const body = deps.surface.appendBubble("system", line);
        body.classList.add("ai-run-recap");
        body.dataset.testid = "ai-run-recap";
      } else if (event.type === "proposal_paused") {
        if (deps.workPlanSurfaceState) deps.workPlanSurfaceState.stoppedReason = "apply-failed";
        deps.appendMilestoneFeedLine("apply-failed", event.reason, "프로젝트 저장소 변경 없음");
      }
    };

    /**
     * 턴이 끝났다 — 이번 턴에 올린 칸을 **적용이 실제로 들어갔는지**로 정산한다.
     *
     * **모든** 종료 경로(정상·중단·오류·throw·변경 없음)에서 부르되, 넘기는 것은 종료 분기가
     * 아니라 저장소에 들어간 호출이다(`null` = 아무것도 안 들어갔다). 다섯 경로 중 셋 —
     * 중단 return 과 catch 두 개 — 은 deps.applyProposal **앞에서** 끝나므로 초안이 그대로 버려진다.
     * 종전처럼 그 자리에서 building 을 done 으로 올리면 손도 안 댄 타일 위에 회색 ✓ "완료" 가
     * 박히고, markAgentBlueprintProgress 는 planned 가 아닌 칸을 다시 올리지 않으므로 세션이
     * 죽을 때까지 풀리지 않는다(실측: 같은 툴콜을 정상 종료/중단으로 각각 돌려 store 변경
     * true/false, 청사진은 양쪽 다 done · 로그에는 "적용됨" 이 없었다).
     *
     * 판정 근거는 완성도 린트(⚠ 미이행)가 쓰는 함수 그대로다 — 채팅이 "미이행" 이라고 말하는
     * 에셋에 맵이 "완료 ✓" 를 그리면 사용자는 어느 쪽도 믿을 수 없다.
     */
    const settleBlueprintForTurnEnd = (appliedCalls: readonly ProposedCall[] | null): void => {
      settleAgentBlueprintTurn(
        appliedCalls === null ? { regions: [], wholeTargetMapIds: [] } : appliedBlueprintRegions(appliedCalls)
      );
    };

    try {
      const result = await exec(onEvent, abortController.signal);
      if (!ownsTurn(true)) {
        ghostPreviewUpdater.cancel();
        return;
      }
      turnResult = result;
      appliedWriteCount = Math.max(appliedWriteCount, result.appliedCalls?.length ?? 0);
      deps.surface.endTurnProgress();
      if (abortController.signal.aborted || result.stoppedReason === "aborted") {
        ghostPreviewUpdater.cancel();
        clearAgentGhostPreview();
        // 중단은 초안을 버린다(적용 경로에 닿지 못한다) — 이번 턴에 올린 칸을 되돌린다.
        // 자율 런에서 턴 도중 커밋된 마일스톤 몫은 milestone_applied 에서 이미 확정됐다.
        settleBlueprintForTurnEnd(null);
        deps.surface.setStatus("대기");
        streamedBubbles.forEach(renderStreamedMarkdown);
        return;
      }
      if (result.stoppedReason === "error") {
        turnFailed = true;
        ghostPreviewUpdater.cancel();
        clearAgentGhostPreview();
        // 오류로 끝나고 제안도 0건이면 이 턴은 통째로 사라진 것이다 — 오류 버무 하나로는
        // 스크롤에 묻히므로 모달로 올린다(PR #317). 제안이 있었던 턴은 적용 경로가 이및
        // 자기 게이트를 보고하므로(배치·배열 무결성) 여기서 다시 띄우지 않는다.
        //
        // main 이 executeTurn 을 이 러너로 추출하는 사이 #317 이 열려 있어 병합 시 여기로
        // 이사했다. 원래 자리는 aiChatPanel 의 executeTurn 이었다.
        if (result.proposedCalls.length === 0 && appliedWriteCount === 0) {
          showAiGateNotice(turnErrorNotice({ message: result.error ?? "AI 작업이 오류로 끝났습니다." }));
        }
      } else {
        ghostPreviewUpdater.flush();
      }
      // 정산은 아래 적용 분기가 끝난 뒤에 한다 — 오류로 끝난 턴도 제안이 남아 있으면 적용된다.
      // Count applied milestones for accounting; only proposedCalls may be replayed.
      const changeExpectedByMode = (runOpts?.composerMode ?? "do") === "do";
      const turnWrites = [...(result.appliedCalls ?? []), ...result.proposedCalls];
      const completenessWarnings = result.stoppedReason === "error" || !changeExpectedByMode
        ? []
        : proposalCompletenessWarnings({
            requestText,
            assistantText: result.assistantText,
            buildSpec: completenessSpecForProposal(confirmedBuildSpecThisTurn, activeSpecAtTurnStart, turnWrites, requestText),
            calls: turnWrites,
      });
      attachCompletenessWarnings(result.proposedCalls, completenessWarnings);
      streamedBubbles.forEach((bubble) => {
        renderStreamedMarkdown(bubble);
        foldWorkLogs(bubble);
      }); // 스트리밍 원문을 마크다운으로 다시 렌더.
      if (result.assistantText && !assistantBubble) {
        assistantBubble = deps.surface.appendBubble("assistant", result.assistantText);
        foldWorkLogs(assistantBubble);
      }
      const beforeProject = store.getCurrent();
      const currentMapId = editorState.get().currentMapId ?? beforeProject.startMapId ?? null;
      // 승인 카드는 없다 — 쓰기가 있으면 그대로 적용하고, 복구는 되돌리기다(approvalPolicy 머리말).
      const applyMode = resolveProposalApplyMode({ callCount: result.proposedCalls.length });
      if (applyMode === "apply-now") {
        // 적용을 먼저 하고 그 결과를 기다린 다음에 로그를 붙인다 — 배치 검증·커밋 게이트가 적용을
        // 거부하면 store 는 그대로이므로 "적용됨 N건" 은 거짓이 된다(사유는 deps.applyProposal 이
        // 이미 ❌ 버블로 남긴다).
        const appliedSummary = result.proposedCalls.map((call) => call.summary || call.name).join(" · ");
        // 게이트에서 내린 경고는 정보로 남긴다 — 적용을 막지는 않되 삼키지도 않는다.
        if (completenessWarnings.length > 0) deps.surface.appendBubble("system", completenessWarnings.join("\n"));
        deps.applyingProposal = true;
        let outcome: ProposalApplyOutcome;
        try {
          outcome = await deps.applyProposal(result.proposedCalls, assistantBubble);
        } finally {
          deps.applyingProposal = false;
          deps.projectIdentityId = store.getProjectIdentity().id;
        }
        const applied = outcome === "applied";
        if (!applied && deps.workPlanSurfaceState) deps.workPlanSurfaceState.stoppedReason = "apply-failed";
        if (applied) appliedWriteCount += result.proposedCalls.length;
        // 적용 결과가 나온 다음에 청사진을 정산한다 — 배치 검증·커밋 게이트가 거부하면
        // (applied === false) 저장소는 그대로이므로 done 은 거짓이다.
        settleBlueprintForTurnEnd(applied ? result.proposedCalls : null);
        deps.surface.setStatus(applied ? "대기" : "적용 실패");
        // 변경 카드는 proposalApi.onApplied 가 한 장만 남긴다. 여기서 또 emitChangeCard 를 부르면
        // 한 턴에 카드가 두 장 붙는다(e2e 로 잡혔다).
        if (applied && !currentMapId) {
          deps.surface.appendBubble("system", `적용됨 ${result.proposedCalls.length}건 — ${appliedSummary}`);
        }
      } else {
        // 쓰기 제안이 0건이면 적용할 것이 없다 — 진행 표시만 남으면 거짓이 된다.
        settleBlueprintForTurnEnd(null);
        // 단, 마일스톤으로 이미 들어간 쓰기가 있으면 이 턴은 "변경 없음" 이 아니다.
        // 그 턴에 되묻기 배너를 띄우면 사용자가 방금 지어진 마을을 보면서 "변경 없음" 을 읽는다.
        if (turnWrites.length > 0) {
          if (completenessWarnings.length > 0) deps.surface.appendBubble("system", completenessWarnings.join("\n"));
          deps.surface.setStatus(result.stoppedReason === "error" ? "오류" : "대기");
        } else {
          deps.noteNoChanges(result, completenessWarnings);
          if (result.stoppedReason !== "error") {
            const silenced = result.assistantText ? ` — ${result.assistantText.slice(0, 80)}` : "";
            const emptyLabel = completenessWarnings.length > 0 ? `변경 없음(린트 경고 ${completenessWarnings.length}건)` : `변경 없음(0건)${silenced ? " · 되묻기/재시도 필요" : ""}`;
            deps.surface.setStatus(emptyLabel);
          } else {
            deps.surface.setStatus("오류");
          }
        }
      }
      if (result.assistantText) {
        deps.renderQuickReplies(result.assistantText);
        // 마킹어 재렌더(위 streamedBubbles.forEach) 뒤에서 붙여야 쓸려나가지 않는다.
        decorateAssistantMentions(assistantBubble, result.assistantText, store.getCurrent());
      }
      if (result.error) appendErrorWithRetry(result.error, session, requestText, runOpts);
    } catch (cause) {
      if (!ownsTurn(true)) return;
      if (abortController.signal.aborted) {
        settleBlueprintForTurnEnd(null);
        deps.surface.setStatus("대기");
        return;
      }
      turnFailed = true;
      turnCatchError = cause instanceof Error ? cause.message : String(cause);
      deps.surface.endTurnProgress();
      ghostPreviewUpdater.cancel();
      clearAgentGhostPreview();
      // throw 로 끝난 턴은 적용 경로에 닿지 못했다 — 초안과 함께 진행 표시도 되돌린다.
      settleBlueprintForTurnEnd(null);
      deps.surface.setStatus("오류");
      const errorBubble = deps.surface.appendBubble("system", `오류: ${turnCatchError}`);
      // Any transport throw mounts settings opener — covers connection refused / 401 / network throw
      {
        const settingsBtn = el("button", {
          class: "ai-assistant-action ai-error-open-settings",
          text: "설정 열기",
          attrs: { type: "button", title: "어시스턴트 설정을 엽니다" },
          dataset: { testid: "ai-error-open-settings" },
          on: { click: () => deps.openAiSettings("first") },
        });
        errorBubble.append(el("div", { class: "ai-retry-row", children: [settingsBtn] }));
      }
    } finally {
      ghostPreviewUpdater.cancel();
      const turnEntries = [...auditHistoryAtTurnStart, ...session.getAuditEntries()];
      const sessionAudit = session.getAuditEntries();
      // 세션이 턴 중간에 교체되면(dropSession) 시작 인덱스가 현재 길이를 넘는다 — 그때는 있는 걸 다 쓴다.
      const turnAudit =
        sessionAudit.length >= sessionAuditCountAtTurnStart
          ? sessionAudit.slice(sessionAuditCountAtTurnStart)
          : sessionAudit;
      const turnUiActions = takeAiUiEventsSince(uiEventMarkerAtTurnStart);
      if (!ownsTurn(true)) {
        // 프로젝트 전환이 ownership을 먼저 끊어도 늦게 정착한 결과는 시작 당시 대화에만 저장한다.
        if (!deps.surface.disposed) deps.surface.persistConversation({ id: turnConversationId, scope: turnConversationScope, entries: turnEntries });
        // 예전에는 여기서 그냥 return 해서 «늦게 정착한 턴» 이 활동 로그에 아예 안 남았다.
        // 소유권이 끊겼다는 사실 자체가 진단이므로 orphaned 로 표시해 남긴다.
        void recordAiActivity({
          id: turnLogId,
          channel: "chat",
          instruction: requestText,
          projectContextKey: turnConversationScope,
          result: {
            ok: false,
            orphaned: true,
            error: turnCatchError ?? turnResult?.error,
            stoppedReason: turnResult?.stoppedReason ?? "ownership-lost",
            proposedCalls: turnResult?.proposedCalls.length,
            appliedCalls: appliedWriteCount,
            assistantText: turnResult?.assistantText,
          },
          toolCalls: liveToolCalls.length > 0 ? liveToolCalls : toolCallsFromAudit(turnAudit),
          audit: turnAudit,
          uiActions: turnUiActions,
        }).catch(() => {
          /* ignore */
        });
        return;
      }
      // Presentation belongs to the finished owner turn, not the retained BuildSpec.
      // Settlement above still follows actual writes; retirement must not claim completion.
      // Include shapes added internally by automatic spec expansion, not only emitted specs.
      syncAgentBlueprintWithSpec(session.getActiveSpec());
      retireAgentBlueprint();
      clearAgentGhostPreview();
      const pendingRegion = getPendingRegionApply();
      if (pendingRegion) {
        // Region approval owns its own draft. Return the shared preview surface to it.
        setAgentGhostDraftMapProvider((mapId) => pendingRegion.clippedProject.maps[mapId]);
        replaceAgentGhostPreviewFromProjectDiff(pendingRegion.baseProject, pendingRegion.clippedProject);
      } else {
        setAgentGhostDraftMapProvider(null);
      }
      // highlight_map_region 은 질문용 강조라 사용자 선택이 아니다. 턴이 끝나면 사각형을 걷는다.
      if (shouldClearAiHighlightSelection(highlightedRegionThisTurn) && editorState.get().selection) {
        editorState.set({ selection: null });
      }
      deps.surface.endTurnProgress();
      if (deps.surface.activeAbortController === abortController) deps.surface.activeAbortController = null;
      deps.surface.turnBusy = false;
      deps.surface.refreshAbortButton();
      // 턴이 끝나면 맥락/사용량이 움직였다 — 게이지는 여기서만 갱신하면 항상 최신이다.
      deps.refreshContextMeter();
      // End live planning chrome without deleting the session plan or its audit history.
      if (deps.workPlanSurfaceState) {
        deps.workPlanSurfaceState.stoppedReason ??= abortController.signal.aborted
          ? "aborted"
          : turnCatchError || turnFailed ? "error" : turnResult?.stoppedReason ?? "error";
      }
      deps.settleWorkPlanTurn();
      // 접힌 채로 턴이 끝나면 레일 점으로 알린다(초록=완료, 빨강=오류 — 펼치는 순간 소거).
      if (deps.surface.collapsed) deps.surface.panel.classList.add(turnFailed ? "is-turn-error" : "is-turn-attention");
      deps.surface.persistConversation({ id: turnConversationId, scope: turnConversationScope, entries: turnEntries }); // 시작 당시 대화 범위로 저장한다.
      // 채팅 턴마다 활동 로그(로컬 + Supabase best-effort). 영역 작업은 runRegionTask 쪽에서 별도 기록.
      const cfg = loadAiConfig();
      const audit = turnAudit;
      const toolFromAudit = toolCallsFromAudit(audit);
      const toolFromWrites = [...(turnResult?.appliedCalls ?? []), ...(turnResult?.proposedCalls ?? [])].map((call) => ({
        name: call.name,
        args: call.args,
        ok: call.result.ok,
        summary: call.summary,
        ...(isUsableToolReason(call.reason) ? { reason: call.reason } : {}),
      }));
      void recordAiActivity({
        id: turnLogId, // 시작 시점 pending 행과 같은 id — upsert 로 «완료» 로 덮인다.
        channel: "chat",
        instruction: requestText,
        projectContextKey: turnConversationScope,
        model: cfg.model,
        liteModel: cfg.liteModel,
        mapId: editorState.get().currentMapId ?? undefined,
        result: {
          ok: !turnFailed && turnResult?.stoppedReason !== "error" && !turnCatchError,
          error: turnCatchError ?? turnResult?.error,
          stoppedReason: turnResult?.stoppedReason,
          proposedCalls: turnResult?.proposedCalls.length,
          appliedCalls: appliedWriteCount,
          assistantText: turnResult?.assistantText,
          ...(turnResult?.recap
            ? {
                recap: {
                  elapsedMs: turnResult.recap.elapsedMs,
                  promptTokens: turnResult.recap.usage.promptTokens,
                  completionTokens: turnResult.recap.usage.completionTokens,
                  llmCalls: turnResult.recap.usage.calls,
                  toolCalls: turnResult.recap.toolCalls,
                  ralphContinues: turnResult.recap.ralphContinues,
                  volumeContinues: turnResult.recap.volumeContinues,
                  process: turnResult.recap.process.map((step) => step.text),
                },
              }
            : {}),
        },
        toolCalls: toolFromAudit.length > 0 ? toolFromAudit : toolFromWrites,
        audit,
        uiActions: turnUiActions,
      }).catch(() => {
        /* ignore */
      });
      // 성향 관측 + 증류. 활동 로그와 같은 자리에서 돈다 — 이 지점이 "지시문·툴 호출·성패"가
      // 한꺼번에 확정되는 유일한 곳이다. 증류는 조건이 찼을 때만 lite 모델을 1회 부르고,
      // 실패는 조용히 넘긴다(결정론 집계는 이미 저장돼 있어 손실이 없다).
      const turnToolNames = (toolFromAudit.length > 0 ? toolFromAudit : toolFromWrites).map((call) => call.name);
      const signalState = observeTurn({
        instruction: requestText,
        toolNames: turnToolNames,
        changed: appliedWriteCount > 0,
      });
      if (shouldDistillPreferences(signalState)) {
        void distillPreferences({ projectScopeKey: turnConversationScope })
          .then((distilled) => {
            // 조용히 학습하면 사용자가 통제 불가로 느낀다 — 반영된 건수만 한 줄로 알린다.
            if (distilled.ok && distilled.upserted > 0) {
              deps.surface.appendBubble("system", `성향 ${distilled.upserted}건을 기억했습니다. (아래 ⌾ 버튼에서 확인·삭제 가능)`);
            }
          })
          .catch(() => {
            /* ignore — 증류 실패는 preferenceSignals 가 자체 카운터로 처리한다. */
          });
      }
      deps.surface.notifyIfObscuredByTestPlay(); // 결함 ④: 테스트 플레이 창이 패널을 가린 채 턴이 끝나면 알림.
      deps.surface.drainPendingSends(); // 결함 ⑨: 대기 큐의 다음 메시지를 순서대로 전송.
      // 유리 도크 본문 접힘 예약 — 시작 시 접혀 있었는지와 무관하다(fold 는 입력줄을 남기므로
      // 답이 사라지지 않는다). 실패한 턴은 읽을 수 있게 열어 둔다.
      // 접혀 시작한 턴만 종료 후 재접기. 이미 열린 패널은 그대로 둔다.
      if (deps.surface.collapseAfterAiWork) {
        if (turnFailed) {
          deps.surface.collapseAfterAiWork = false;
        } else if (deps.hasPendingQuestion()) {
          /* AI가 답을 기다리는 중 — 사용자가 답하거나 직접 접을 때까지 열어 둔다
             (2026-08-18 UX 리뷰 P1-4: 질문이 자동 접힘으로 증발하던 결함) */
        } else {
          deps.surface.scheduleCollapseAfterAiWork();
        }
      }
    }
  };


  // LLM 오류 버블 + 수동 [재시도] 버튼(도그푸딩 결함 ⑥). 오류 메시지에는 llmClient가
  // 만든 원인(네트워크/429/5xx/인증 등)이 그대로 담긴다. 자동 재시도 1회(지수 백오프)는
  // llmClient.chatCompletion이 이미 수행했고, 여기의 버튼은 그 이후의 수동 재개다.
  const appendErrorWithRetry: AiTurnRunner["appendErrorWithRetry"] = (message, session, requestText, runOpts): void => {
    const bubble = deps.surface.appendBubble("system", `오류: ${message}`);
    const actions: HTMLElement[] = [];
    // Any transport failure mounts settings opener — do not threshold on message content.
    {
      const chatGptMode = loadAiConfig().authMode === "chatgpt";
      const settingsAction = el("button", {
        class: "ai-assistant-action ai-error-open-settings",
        text: "설정 열기",
        attrs: { type: "button", title: chatGptMode ? "ChatGPT 연결 설정을 엽니다" : "어시스턴트 설정을 열고 API 키 입력으로 이동합니다" },
        dataset: { testid: "ai-error-open-settings" },
        on: { click: () => deps.openAiSettings(chatGptMode ? "first" : "apiKey") },
      });
      actions.push(settingsAction);
    }
    if (!session.canRetryLastTurn()) {
      if (actions.length > 0) bubble.append(el("div", { class: "ai-retry-row", children: actions }));
      deps.surface.log.scrollTop = deps.surface.log.scrollHeight;
      return;
    }
    const retry = el("button", {
      class: "ai-assistant-action ai-retry-turn",
      text: "재시도 — 같은 문맥에서 1회 재시도",
      attrs: { type: "button", title: "끊긴 턴을 같은 문맥에서 다시 시도합니다 (429/5xx는 자동 재시도 1회 후 수동 재시도로 이어짐)" },
      dataset: { testid: "ai-retry-turn" },
      on: {
        click: () => {
          retry.disabled = true;
          // 무엇을 재시도했는지(원 오류)와 어느 지시였는지를 함께 남긴다 — 같은 오류의 반복
          // 재시도는 이 행들이 없으면 서로 구분되지 않는다.
          recordAiUiEvent({
            surface: "panel",
            action: AI_UI_ACTIONS.turnRetry,
            testid: "ai-retry-turn",
            detail: { error: message.slice(0, 200), instruction: requestText.slice(0, 120) },
          });
          void executeTurn(session, requestText, (onEvent, signal) => session.retryLastTurn(onEvent, signal), runOpts);
        },
      },
    }) as HTMLButtonElement;
    actions.unshift(retry);
    bubble.append(el("div", { class: "ai-retry-row", children: actions }));
    // 오류·복구 버튼이 로그 하단 잘림으로 반쯤 가려지던 결함(적대 평가 P1) — 끝까지 스크롤.
    deps.surface.log.scrollTop = deps.surface.log.scrollHeight;
  };

  return { executeTurn, appendErrorWithRetry };
}
