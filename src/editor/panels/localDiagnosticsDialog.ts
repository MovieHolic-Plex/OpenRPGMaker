import { el } from "@/util/dom";
import { DIAGNOSTIC_CATEGORIES, type DiagnosticCategory } from "@/util/localDiagnosticSession";
import { localDiagnostics, startLocalDiagnostics } from "@/editor/localDiagnostics";
import { diagnosticReport } from "@/editor/localDiagnosticReport";
import { openEventSubdialog } from "./eventEditor/subdialog";
import { showConfirm } from "@/editor/ui/modal";
import "@/styles/editor/local-diagnostics.css";

const labels: Record<DiagnosticCategory, string> = {
  conversation: "요청·답변 (역할·글자 수만)", authoring: "편집·저장 세대", movement: "이동 완료 좌표",
  collision: "충돌 종류·좌표", event: "이벤트 실행 상태", transfer: "장소 이동 상태·좌표",
  asset: "소재 준비·누락 수", warning: "경고 발생", error: "오류 발생",
};
let closeDialog: (() => void) | undefined;
let dialogSession: string | null = null;
let indicator: HTMLElement | undefined;
function action(id: string, text: string, run: () => void): HTMLButtonElement {
  return el("button", { class: "btn", text, attrs: { type: "button" }, dataset: { testid: id }, on: { click: run } });
}
localDiagnostics.subscribe(() => {
  const state = localDiagnostics.snapshot();
  if (dialogSession !== state.sessionId) { closeDialog?.(); closeDialog = undefined; }
  if (!state.sessionId) { indicator?.remove(); indicator = undefined; return; }
  if (!indicator?.isConnected) {
    indicator = el("aside", { class: "local-diagnostics-indicator", attrs: { "aria-label": "로컬 진단 세션" }, dataset: { testid: "diagnostics-indicator" } });
    indicator.append(el("span", { dataset: { testid: "diagnostics-status" }, attrs: { role: "status" } }),
      action("diagnostics-open", "진단 보고서", openLocalDiagnosticsDialog),
      action("diagnostics-stop", "중지", () => localDiagnostics.stop()),
      action("diagnostics-clear", "지우기", () => localDiagnostics.clear()));
    document.body.append(indicator);
  }
  const status = indicator.querySelector<HTMLElement>("[data-testid=diagnostics-status]");
  if (status) status.textContent = state.active ? "로컬 진단 기록 중" : "로컬 진단 중지됨";
  const stop = indicator.querySelector<HTMLButtonElement>("[data-testid=diagnostics-stop]");
  if (stop) stop.disabled = !state.active;
});

function checkbox(id: string, text: string, checked: boolean, change: (checked: boolean) => void): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid: id } });
  input.checked = checked;
  input.addEventListener("change", () => change(input.checked));
  return el("label", { class: "local-diagnostics-choice", children: [input, el("span", { text })] });
}

export function openLocalDiagnosticsDialog(): void {
  closeDialog?.();
  const snapshot = localDiagnostics.snapshot();
  dialogSession = snapshot.sessionId;
  openEventSubdialog({ title: "로컬 진단 보고서", testId: "local-diagnostics-dialog", width: "wide",
    subtitle: "명시적으로 선택한 이후 기록만 보관합니다. 자동 전송하지 않습니다.",
    render: (body, close) => {
      closeDialog = close;
      body.classList.add("local-diagnostics-body");
      body.append(el("p", { text: "최대 500건 · 시작 후 30분 · 이 탭의 메모리에만 보관. 중지는 수집을 끝내고, 지우기·프로젝트 교체·새로고침은 기록을 없앱니다. 기존 앱 기록 정책은 바꾸지 않습니다." }),
        el("p", { text: "요청·답변은 역할과 글자 수만 기록합니다. 본문·이름·ID·비밀 지시·비공개 추론·인증 정보·주소·호스트 경로·원시 로그는 수집하지 않습니다. 편집됨과 실행 관찰은 다르며, 목표 달성은 미검증입니다." }));
      if (!snapshot.sessionId) {
        const selected = new Set<DiagnosticCategory>();
        let consent = false;
        const start = action("diagnostics-start", "동의하고 기록 시작", () => {
          close(); startLocalDiagnostics(consent, [...selected]);
        });
        const refresh = () => { start.disabled = !consent || selected.size === 0; };
        const fields = el("fieldset", { children: [el("legend", { text: "수집할 항목 선택" })] });
        for (const category of DIAGNOSTIC_CATEGORIES) fields.append(checkbox(`diagnostics-category-${category}`, labels[category], false, checked => {
          if (checked) selected.add(category); else selected.delete(category); refresh();
        }));
        body.append(fields, checkbox("diagnostics-consent", "선택한 메타데이터의 로컬 수집과 보관에 동의합니다.", false, checked => { consent = checked; refresh(); }),
          el("div", { class: "local-diagnostics-actions", children: [action("diagnostics-cancel", "취소", close), start] }));
        refresh(); return;
      }
      const sections = new Set(snapshot.categories);
      let format: "json" | "markdown" = "json";
      const select = el("select", { attrs: { "aria-label": "보고서 형식" }, dataset: { testid: "diagnostics-format" }, children: [
        el("option", { text: "JSON", attrs: { value: "json" } }), el("option", { text: "Markdown", attrs: { value: "markdown" } }),
      ] });
      const previewHost = el("div", {});
      select.addEventListener("change", () => { format = select.value === "markdown" ? "markdown" : "json"; previewHost.replaceChildren(); });
      const fields = el("fieldset", { children: [el("legend", { text: "내보낼 항목 선택" })] });
      for (const category of snapshot.categories) fields.append(checkbox(`diagnostics-section-${category}`, labels[category], true, checked => {
        if (checked) sections.add(category); else sections.delete(category); previewHost.replaceChildren();
      }));
      const preview = action("diagnostics-preview", "선택 항목 미리보기", () => {
        const frozen = localDiagnostics.snapshot();
        const text = diagnosticReport(frozen, [...sections], format);
        const area = el("textarea", { attrs: { readonly: "", rows: "12", "aria-label": "진단 보고서 미리보기" }, dataset: { testid: "diagnostics-preview-text" } });
        area.value = text;
        const status = el("p", { attrs: { role: "status" } });
        const exportLocal = async (target: "clipboard" | "file") => {
          const accepted = await showConfirm({ title: "로컬 내보내기 확인", message: `${format.toUpperCase()} 미리보기를 ${target === "clipboard" ? "클립보드에 복사" : "파일로 저장"}합니다. 외부 제출은 별도 작업입니다.`, confirmLabel: "확인하여 내보내기" });
          if (!accepted || !area.isConnected || localDiagnostics.snapshot().sessionId !== frozen.sessionId) return;
          try {
            if (target === "clipboard") await navigator.clipboard.writeText(text);
            else {
              const url = URL.createObjectURL(new Blob([text], { type: format === "json" ? "application/json" : "text/markdown" }));
              const link = el("a", { attrs: { href: url, download: `local-diagnostics.${format === "json" ? "json" : "md"}` } });
              document.body.append(link);
              try { link.click(); } finally { link.remove(); URL.revokeObjectURL(url); }
            }
            status.textContent = "로컬 내보내기 완료. 자동 전송하지 않았습니다.";
          } catch (error) {
            status.textContent = error instanceof Error ? "내보내기에 실패했습니다. 브라우저 권한을 확인하고 다시 시도하세요." : "브라우저가 내보내기를 거부했습니다.";
          }
        };
        previewHost.replaceChildren(area, el("div", { class: "local-diagnostics-actions", children: [
          action("diagnostics-copy", "복사 확인…", () => { void exportLocal("clipboard"); }),
          action("diagnostics-file", "파일 저장 확인…", () => { void exportLocal("file"); }),
        ] }), status);
      });
      body.append(fields, select, el("p", { text: `${snapshot.receipts.length}건 보관 · 상한으로 제외된 기록 ${snapshot.omitted}건. 출처와 작성/관찰/미검증 구분은 각 기록에 포함됩니다.` }),
        el("div", { class: "local-diagnostics-actions", children: [action("diagnostics-cancel", "취소", close), preview] }), previewHost);
    },
  });
}
