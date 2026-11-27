import { prefillAiAssistantInput } from "@/editor/aiBootIntent";
import { editorState } from "@/editor/editorState";
import { validateEventDraft, type EventDraftIssue } from "@/editor/eventDraftValidator";
import { eventValidationDiagnosticReport, formatEventValidationDiagnostics } from "@/editor/eventValidationDiagnostics";
import { store } from "@/project/store";
import type { GameEvent, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { submitEventEditLine } from "./eventEditLine";

function formatCommandFixPrompt(issues: readonly EventDraftIssue[]): string {
  const lines = issues.map((issue) => {
    const step = issue.commandPath?.length ? `[명령 ${issue.commandPath.map((n) => n + 1).join("→")}] ` : "";
    const hint = issue.hint ? ` (${issue.hint})` : "";
    return `${step}${issue.message}${hint}`;
  });
  return `이 페이지의 다음 검증 문제를 고쳐 주세요: ${lines.join(" / ")}`;
}

function formatFullEventFixPrompt(
  mapId: MapId,
  event: GameEvent,
  issues: readonly EventDraftIssue[],
): string {
  const mapName = store.getCurrent().maps[mapId]?.name?.trim() || mapId;
  const eventLabel = event.name?.trim() || event.id;
  const pages = event.pages ?? [];
  const lines = issues.map((issue) => {
    const pageIdx = pages.findIndex((p) => p.id === issue.pageId);
    const pageTag = pageIdx >= 0 ? `페이지 ${pageIdx + 1}` : "이벤트";
    const pathTag = issue.commandPath?.length ? ` · 경로 ${JSON.stringify(issue.commandPath)}` : "";
    const hint = issue.hint ? ` → ${issue.hint}` : "";
    return `- [${issue.severity === "error" ? "오류" : "경고"} · ${pageTag}${pathTag}] ${issue.message}${hint}`;
  });
  return [
    `맵 「${mapName}」(mapId: ${mapId})의 이벤트 「${eventLabel}」(eventId: ${event.id})에서 아래 검증 문제를 고쳐 주세요.`,
    ...lines,
  ].join("\n");
}

export function renderEventValidationActions(close: () => void): HTMLElement {
  const format = el("select", { class: "event-validation-format", attrs: { "aria-label": "진단 복사 형식" }, dataset: { testid: "event-validation-format" }, children: [
    el("option", { attrs: { value: "markdown" }, text: "Markdown (익명)" }),
    el("option", { attrs: { value: "json" }, text: "JSON (익명)" }),
  ] });
  const currentContext = () => {
    const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
    const mapId = modal?.dataset.mapId as MapId | undefined;
    const eventId = modal?.dataset.eventId;
    const event = mapId && eventId ? store.getCurrent().maps[mapId]?.events.find(candidate => candidate.id === eventId) : undefined;
    if (!mapId || !eventId || !event || !modal) return undefined;
    const validation = validateEventDraft(store.getCurrent(), mapId, eventId);
    return {
      modal,
      mapId,
      eventId,
      event,
      validation,
      report: eventValidationDiagnosticReport(validation, event),
    };
  };
  const copy = el("button", { class: "btn small", attrs: { type: "button" }, text: "익명 진단 복사",
    dataset: { testid: "event-validation-copy" }, on: { click: () => {
      const current = currentContext();
      if (!current) return;
      const text = formatEventValidationDiagnostics(current.report, format.value === "json" ? "json" : "markdown");
      if (!navigator.clipboard) { toast("클립보드를 사용할 수 없습니다.", "error"); return; }
      void navigator.clipboard.writeText(text).then(() => toast("진단을 복사했습니다. 외부로 전송하지 않았습니다.", "ok"),
        () => toast("진단을 복사하지 못했습니다. 클립보드 권한을 확인하세요.", "error"));
    } } });
  const ask = el("button", { class: "btn small primary event-validation-ask-btn", attrs: { type: "button", title: "조수에게 이 문제들을 대신 고쳐 달라고 부탁해요." },
    text: "조수에게 고쳐달라 하기", dataset: { testid: "event-validation-ask-assistant" }, on: { click: () => {
      const current = currentContext();
      if (!current) return;
      close();
      const actionable = current.validation.issues.filter((i) => i.severity === "error" || i.severity === "warning");
      const targets = actionable.length > 0 ? actionable : current.validation.issues;
      const pageLevelIssues = targets.filter((i) => !i.commandPath?.length);
      const commandIssues = targets.filter((i) => Boolean(i.commandPath?.length));

      // 명령 문제만 있을 때는 모달을 떠나지 않고 이벤트 전용 빠른 조수(eventEditLine)로 바로 수리한다.
      if (commandIssues.length > 0 && pageLevelIssues.length === 0) {
        const activePageId = editorState.get().selectedEventPageId ?? current.event.pages?.[0]?.id ?? "";
        const targetPageId = commandIssues.some((i) => i.pageId === activePageId)
          ? activePageId
          : commandIssues[0]!.pageId;
        const pageCommandIssues = commandIssues.filter((i) => i.pageId === targetPageId);
        const prompt = formatCommandFixPrompt(pageCommandIssues);
        const runFastFix = () => {
          if (submitEventEditLine(prompt)) {
            toast("한 줄 고치기로 조수 수리를 시작했습니다.", "info");
            return;
          }
          // eventEditLine 이 없는 화면에서는 구체 컨텍스트와 함께 메인 조수 입력창으로 폴백한다.
          current.modal.querySelector<HTMLButtonElement>('[data-testid="event-editor-window-minimize"]')?.click();
          if (!prefillAiAssistantInput(formatFullEventFixPrompt(current.mapId, current.event, targets), { preserveDraft: true })) {
            document.querySelector<HTMLButtonElement>('[data-testid="event-editor-window-restore"]')?.click();
            toast("조수 입력창을 사용할 수 없습니다. 개발자·AI 진단 복사를 사용하세요.", "error");
            return;
          }
          toast("현재 이벤트의 오류 내용을 조수 입력창에 채웠습니다. 확인 후 전송하세요.", "info");
        };
        if (targetPageId && targetPageId !== activePageId) {
          editorState.set({ selectedEventPageId: targetPageId });
          queueMicrotask(runFastFix);
        } else {
          runFastFix();
        }
        return;
      }

      // 페이지 조건·순서·위치 등 명령 밖 설정을 고쳐야 할 때는 익명 JSON 대신
      // 실제 mapId · eventId · 구체 이슈를 담아 메인 조수 입력창에 채워 준다.
      current.modal.querySelector<HTMLButtonElement>('[data-testid="event-editor-window-minimize"]')?.click();
      if (!prefillAiAssistantInput(formatFullEventFixPrompt(current.mapId, current.event, targets), { preserveDraft: true })) {
        document.querySelector<HTMLButtonElement>('[data-testid="event-editor-window-restore"]')?.click();
        toast("조수 입력창을 사용할 수 없습니다. 개발자·AI 진단 복사를 사용하세요.", "error");
        return;
      }
      toast("현재 이벤트의 오류 내용을 조수 입력창에 채웠습니다. 확인 후 전송하세요.", "info");
    } } });
  // 복사 형식(Markdown/JSON)과 익명 진단 복사는 개발자·AI용 접힘 서랍으로 분리해 처음 화면에서 숨긴다.
  const devFold = el("details", {
    class: "event-validation-dev-fold",
    dataset: { testid: "event-validation-dev-fold" },
    children: [
      el("summary", { class: "event-validation-dev-summary", text: "개발자·AI 진단 복사" }),
      el("div", {
        class: "event-validation-dev-drawer",
        children: [
          el("label", { children: [el("span", { text: "형식" }), format] }),
          copy,
        ],
      }),
    ],
  });
  return el("div", { class: "event-draft-validation-actions", children: [
    el("div", { class: "event-draft-validation-primary-row", children: [ask] }),
    devFold,
  ] });
}
