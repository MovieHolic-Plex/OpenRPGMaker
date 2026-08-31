// editor/panels/aiRegionTaskRunner.ts
// 선택 영역 작업(region task) 실행부. 맵에서 사각형을 고른 뒤 지시하면 채팅 턴이 아니라 이
// 경로가 돈다 — 같은 실행 표면(상태 줄·진행·중단·로그)을 쓰지만 이벤트는 세션이 아니라
// runRegionTask 가 낸다. aiChatPanel(3,422줄)에서 분리했다.
//
// 세션이 없는 경로이므로 감사 기록은 이 실행부가 직접 controller.auditHistory 에 쌓는다.
import { store } from "@/project/store";
import { toast } from "@/util/toast";
import type { AuditEntry, SessionEvent } from "@/ai/assistantSession";
import { buildConversationTurnContext } from "@/ai/conversationTurnContext";
import { getEditorMapViewport } from "@/editor/editorMapViewport";
import { setAgentGhostRunningTool } from "@/editor/agentGhostPreview";
import { isRegionEscapingIntent } from "@/editor/regionTask/regionIntentRouter";
import {
  describeRegionTaskResult,
  type RegionTaskOptions,
  type RegionTaskResult,
} from "@/editor/regionTask/runRegionTask";
import { phaseStatusText, shouldShowStatusInChat } from "./aiChatPanelHelpers";
import { renderStreamedMarkdown } from "./aiConversationLog";
import type { AiRunSurface } from "./aiRunSurface";

export interface AiRegionTaskRunnerDeps {
  /** 채팅 턴과 공유하는 실행 표면. */
  readonly surface: AiRunSurface;
  /** 상태 배지 요소 — 영역 작업은 실패 판정을 이 텍스트로 한다(턴 실행부와 다른 점). */
  readonly status: HTMLElement;
  selectionTaskActive: boolean;
  activeSelectionRegionController: AbortController | null;
  activeSelectionRegionKey: string | null;
  readonly currentSelectionForRegionTask: () =>
    | {
      readonly mapId: string;
      readonly region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
    }
    | null;
  readonly refreshContextChips: () => void;
  readonly runRegion: (options: RegionTaskOptions) => Promise<RegionTaskResult>;
}

export interface AiRegionTaskRunner {
  readonly sendSelectionRegionTask: (text: string) => Promise<void>;
}

export function createAiRegionTaskRunner(deps: AiRegionTaskRunnerDeps): AiRegionTaskRunner {
  const sendSelectionRegionTask = async (text: string): Promise<void> => {
    const selection = deps.currentSelectionForRegionTask();
    if (!selection) {
      deps.selectionTaskActive = false;
      deps.refreshContextChips();
      await deps.surface.sendText(text);
      return;
    }
    // 실내/새 맵은 선택 영역 하드 클립에 담기지 않는다(audit 18: create_map 후 0칸 폐기).
    // 일반 채팅 전량 경로로 우회해 start_interior_room_session 등이 제안으로 남게 한다.
    if (isRegionEscapingIntent(text)) {
      deps.selectionTaskActive = false;
      deps.refreshContextChips();
      toast("실내·새 맵 요청은 선택 영역 밖 작업이라 일반 채팅으로 진행합니다", "info");
      await deps.surface.sendText(text);
      return;
    }
    if (deps.surface.turnBusy) {
      toast("진행 중인 응답이 끝난 뒤 다시 시도하세요", "info");
      return;
    }
    const regionConversationId = deps.surface.conversationId;
    const regionConversationScope = deps.surface.conversationScope;
    const auditHistoryAtRegionStart = [
      ...deps.surface.controller.auditHistory,
      ...(deps.surface.controller.session?.getAuditEntries() ?? []),
    ];
    const regionAuditEntries: AuditEntry[] = [];
    const recordRegionAudit = (entry: AuditEntry): void => {
      regionAuditEntries.push(entry);
      deps.surface.controller.auditHistory.push(entry);
    };
    const abortController = new AbortController();
    const selectionKey = `${selection.mapId}:${selection.region.x}:${selection.region.y}:${selection.region.width}:${selection.region.height}`;
    deps.surface.activeAbortController = abortController;
    deps.activeSelectionRegionController = abortController;
    deps.activeSelectionRegionKey = selectionKey;
    deps.surface.abortNoticeShown = false;
    const ownsRegionRun = (allowAborted = false): boolean =>
      !deps.surface.disposed
      && deps.surface.activeAbortController === abortController
      && deps.activeSelectionRegionController === abortController
      && deps.activeSelectionRegionKey === selectionKey
      && (allowAborted || !abortController.signal.aborted);
    deps.surface.turnBusy = true;
    deps.surface.sendButton.disabled = true;
    deps.surface.collapseAfterAiWork = deps.surface.collapsed;
    deps.surface.expandForAiWork();
    deps.surface.revealVolatileZone();
    deps.surface.closeToolActivity();
    deps.surface.appendBubble("user", text);
    recordRegionAudit({
      kind: "user",
      text,
      at: new Date().toISOString(),
      context: buildConversationTurnContext(store.getCurrent(), {
        mapId: selection.mapId,
        viewport: getEditorMapViewport(),
        selection: { mapId: selection.mapId, ...selection.region },
      }),
    });
    deps.surface.beginTurnProgress();
    deps.surface.refreshAbortButton();
    deps.surface.setStatus("영역 작업 중…");
    let assistantBubble: HTMLElement | null = null;
    let reasoningBox: { box: HTMLElement; body: HTMLElement } | null = null;
    let assistantMessageDisplayed = false;
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
    const appendAssistantText = (content: string): void => {
      if (!content.trim()) return;
      assistantMessageDisplayed = true;
      deps.surface.closeToolActivity();
      deps.surface.appendBubble("assistant", content);
      recordRegionAudit({ kind: "assistant", text: content, at: new Date().toISOString() });
    };
    const onEvent = (event: SessionEvent): void => {
      if (!ownsRegionRun()) return;
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
        reasoningBox = null;
        if (!assistantBubble) {
          assistantBubble = deps.surface.appendBubble("assistant", "");
          streamedBubbles.push(assistantBubble);
          trackCurrentStreamNode(assistantBubble);
          deps.surface.closeToolActivity();
        }
        assistantBubble.textContent = (assistantBubble.textContent ?? "") + event.delta;
        deps.surface.log.scrollTop = deps.surface.log.scrollHeight;
        return;
      }
      if (event.type === "assistant_message") {
        if (!event.content.trim()) return;
        assistantMessageDisplayed = true;
        if (assistantBubble) {
          assistantBubble.textContent = event.content;
          currentStreamNodes = [];
        } else {
          appendAssistantText(event.content);
        }
        return;
      }
      if (event.type === "tool_started") {
        setAgentGhostRunningTool(event.name);
        deps.surface.startLiveActivity(event.name, event.index);
        return;
      }
      if (event.type === "tool_call") {
        deps.surface.completeLiveActivity(event.name, event.result, event.args);
        recordRegionAudit({
          kind: "tool",
          name: event.name,
          args: event.args,
          ok: event.result.ok,
          summary: event.result.summary,
          issues: event.result.issues?.map((issue) => issue.message),
          at: new Date().toISOString(),
        });
        assistantBubble = null;
        reasoningBox = null;
        currentStreamNodes = [];
        return;
      }
      if (event.type === "status") {
        deps.surface.setStatus(event.text);
        recordRegionAudit({ kind: "status", text: event.text, at: new Date().toISOString() });
        if (shouldShowStatusInChat(event.text)) deps.surface.appendBubble("system", event.text);
      }
    };

    try {
      const result = await deps.runRegion({
        mapId: selection.mapId,
        region: selection.region,
        instruction: text,
        gate: "immediate",
        signal: abortController.signal,
        onEvent,
      });
      if (!ownsRegionRun()) {
        result.pending?.discard();
        return;
      }
      streamedBubbles.forEach(renderStreamedMarkdown);
      if (result.assistantText && !assistantMessageDisplayed) appendAssistantText(result.assistantText);
      const summary = describeRegionTaskResult(result);
      deps.surface.appendBubble("system", summary);
      recordRegionAudit({ kind: "status", text: summary, at: new Date().toISOString() });
      deps.surface.setStatus(result.ok ? (result.applied ? "적용됨" : "완료") : "오류");
      if (!result.ok && result.error) toast(`영역 작업 실패: ${result.error}`, "error");
    } catch (cause) {
      if (!ownsRegionRun()) return;
      const message = cause instanceof Error ? cause.message : String(cause);
      deps.surface.setStatus("오류");
      deps.surface.appendBubble("system", `오류: ${message}`);
      recordRegionAudit({ kind: "status", text: `오류: ${message}`, at: new Date().toISOString() });
    } finally {
      const regionEntries = [...auditHistoryAtRegionStart, ...regionAuditEntries];
      if (!ownsRegionRun(true)) {
        if (!deps.surface.disposed) {
          deps.surface.persistConversation({
            id: regionConversationId,
            scope: regionConversationScope,
            entries: regionEntries,
          });
        }
        return;
      }
      const cancelled = abortController.signal.aborted;
      deps.activeSelectionRegionController = null;
      deps.activeSelectionRegionKey = null;
      if (deps.surface.activeAbortController === abortController) deps.surface.activeAbortController = null;
      if (cancelled) deps.surface.setStatus("대기");
      const regionFailed = !cancelled && (deps.status.textContent ?? "") === "오류";
      deps.surface.endTurnProgress();
      deps.surface.turnBusy = false;
      deps.surface.refreshAbortButton();
      if (deps.surface.collapsed && !cancelled) deps.surface.panel.classList.add(regionFailed ? "is-turn-error" : "is-turn-attention");
      deps.surface.persistConversation({
        id: regionConversationId,
        scope: regionConversationScope,
        entries: regionEntries,
      });
      if (!cancelled) deps.surface.notifyIfObscuredByTestPlay();
      deps.surface.drainPendingSends();
      deps.surface.scheduleGlassFold({ failed: regionFailed });
      if (deps.surface.collapseAfterAiWork) {
        if (regionFailed) deps.surface.collapseAfterAiWork = false;
        else deps.surface.scheduleCollapseAfterAiWork();
      }
    }
  };

  return { sendSelectionRegionTask };
}
