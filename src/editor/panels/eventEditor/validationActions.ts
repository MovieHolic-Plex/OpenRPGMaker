import { prefillAiAssistantInput } from "@/editor/aiBootIntent";
import { validateEventDraft } from "@/editor/eventDraftValidator";
import { eventValidationDiagnosticReport, formatEventValidationDiagnostics } from "@/editor/eventValidationDiagnostics";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export function renderEventValidationActions(close: () => void): HTMLElement {
  const format = el("select", { attrs: { "aria-label": "진단 복사 형식" }, dataset: { testid: "event-validation-format" }, children: [
    el("option", { attrs: { value: "markdown" }, text: "Markdown" }),
    el("option", { attrs: { value: "json" }, text: "JSON" }),
  ] });
  const currentReport = () => {
    const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
    const mapId = modal?.dataset.mapId;
    const eventId = modal?.dataset.eventId;
    const event = mapId && eventId ? store.getCurrent().maps[mapId]?.events.find(event => event.id === eventId) : undefined;
    if (!mapId || !eventId || !event || !modal) return undefined;
    return { modal, report: eventValidationDiagnosticReport(validateEventDraft(store.getCurrent(), mapId, eventId), event) };
  };
  const copy = el("button", { class: "btn small", attrs: { type: "button" }, text: "진단 복사",
    dataset: { testid: "event-validation-copy" }, on: { click: () => {
      const current = currentReport();
      if (!current) return;
      const text = formatEventValidationDiagnostics(current.report, format.value === "json" ? "json" : "markdown");
      if (!navigator.clipboard) { toast("클립보드를 사용할 수 없습니다.", "error"); return; }
      void navigator.clipboard.writeText(text).then(() => toast("진단을 복사했습니다. 외부로 전송하지 않았습니다.", "ok"),
        () => toast("진단을 복사하지 못했습니다. 클립보드 권한을 확인하세요.", "error"));
    } } });
  const ask = el("button", { class: "btn small", attrs: { type: "button", title: "기존 입력 뒤에 진단을 추가합니다. 전송은 직접 해주세요." },
    text: "로컬 조수에게 묻기", dataset: { testid: "event-validation-ask-assistant" }, on: { click: () => {
      const current = currentReport();
      if (!current) return;
      close();
      current.modal.querySelector<HTMLButtonElement>('[data-testid="event-editor-window-minimize"]')?.click();
      if (!prefillAiAssistantInput(formatEventValidationDiagnostics(current.report, "markdown"), { preserveDraft: true })) {
        document.querySelector<HTMLButtonElement>('[data-testid="event-editor-window-restore"]')?.click();
        toast("조수 입력창을 사용할 수 없습니다. 진단 복사를 사용하세요.", "error");
        return;
      }
      toast("진단을 미전송 초안에 추가했습니다. 지시를 더 적고 직접 전송하세요.", "info");
    } } });
  return el("div", { class: "event-draft-validation-head", children: [format, copy, ask] });
}
