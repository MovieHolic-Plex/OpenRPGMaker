import { el } from "@/util/dom";
import { copyTextToClipboard } from "@/util/clipboard";
import { downloadBlob } from "@/util/downloadBlob";
import { store } from "@/project/store";
import { currentTeamActivity } from "@/ai/piAgent/teamActivity";
import { readActivityArchive } from "@/ai/activityTraceArchive";
import { formatActivityTraceText, projectActivityTrace } from "@/ai/activityTraceExport";
import type { ActivityTrace } from "@/ai/activityTrace";
import { deckIcon } from "./aiDeckIcons";

export interface AiLogSelection { trace?: ActivityTrace; actor?: string; name: string }

/** A visible extraction entry point, independent of the activity detail setting. */
export function createWorkspaceLogs(getSelection: () => AiLogSelection | undefined, onOpen: () => void) {
  let archives: ActivityTrace[] = [];
  let generation = 0;
  let disposed = false;
  let openProjectId = "";
  const trigger = el("button", { attrs: { type: "button", "aria-label": "AI 로그 추출", "aria-expanded": "false", "aria-controls": "ai-workspace-logs" },
    class: "ai-workspace-log-trigger", dataset: { testid: "ai-workspace-logs-toggle" }, children: [deckIcon("export"), el("span", { text: "로그" })] }) as HTMLButtonElement;
  const scope = el("select", { attrs: { "aria-label": "추출할 로그" }, dataset: { testid: "ai-workspace-log-scope" } }) as HTMLSelectElement;
  const status = el("p", { attrs: { role: "status", "aria-live": "polite" }, dataset: { testid: "ai-workspace-log-status" } });
  const manual = el("textarea", { attrs: { readonly: "", hidden: "", "aria-label": "복사할 로그 내용" }, dataset: { testid: "ai-workspace-log-manual" } }) as HTMLTextAreaElement;
  const buttons: HTMLButtonElement[] = [];
  const action = (label: string, kind: string, handler: () => void) => {
    const button = el("button", { text: label, attrs: { type: "button" }, dataset: { testid: `ai-workspace-log-${kind}` }, on: { click: handler } }) as HTMLButtonElement;
    buttons.push(button); return button;
  };
  const snapshot = (): { trace: ActivityTrace; actor?: string } | undefined => {
    const projectId = store.getProjectIdentity().id;
    const selected = getSelection();
    const candidate = scope.value === "member" ? selected?.trace : scope.value === "run"
      ? [currentTeamActivity()?.trace, selected?.trace, archives[0]].filter((trace): trace is ActivityTrace => trace?.projectId === projectId)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0] : archives.find(trace => trace.id === scope.value);
    return candidate?.projectId === projectId ? { trace: candidate, actor: scope.value === "member" ? selected?.actor : undefined } : undefined;
  };
  const refresh = () => {
    const value = snapshot();
    const count = value ? value.trace.entries.filter(e => !value.actor || e.actor === value.actor).length : 0;
    status.textContent = value ? `${value.trace.title} · ${count}건${value.trace.dropped ? ` · 원본에서 ${value.trace.dropped}건 생략` : ""}` : "아직 보관된 실행 기록이 없어요.";
    buttons.forEach(button => button.disabled = count === 0);
  };
  const refreshSelection = () => {
    if (root.hidden) return;
    if (openProjectId !== store.getProjectIdentity().id) { close(); archives = []; scope.replaceChildren(); return; }
    const selected = getSelection();
    const option = scope.querySelector<HTMLOptionElement>('option[value="member"]');
    if (option) {
      const key = `${selected?.trace?.id ?? ""}:${selected?.actor ?? ""}`;
      if (option.dataset.selectionKey !== key) manual.hidden = true;
      option.dataset.selectionKey = key;
      option.textContent = selected ? `선택한 조수 · ${selected.name}` : "선택한 조수"; option.disabled = !selected?.trace;
    }
    refresh();
  };
  const copy = async () => {
    const value = snapshot(); if (!value) return;
    const text = formatActivityTraceText(value.trace, value.actor);
    const copied = await copyTextToClipboard(text);
    if (disposed || root.hidden) return;
    if (copied) status.textContent = "로그를 복사했어요.";
    else { manual.value = text; manual.hidden = false; manual.focus(); manual.select(); status.textContent = "로그 내용을 선택했어요. 복사해서 사용하세요."; }
  };
  const download = (json: boolean) => {
    const value = snapshot(); if (!value) return;
    const record = projectActivityTrace(value.trace, value.actor);
    const text = json ? JSON.stringify(record, null, 2) : formatActivityTraceText(value.trace, value.actor);
    const name = `${record.id}${value.actor ? `-${value.actor}` : ""}`.replace(/[^a-zA-Z0-9_-]/g, "-");
    downloadBlob(new Blob([text], { type: json ? "application/json" : "text/plain;charset=utf-8" }), `${name}.${json ? "json" : "txt"}`);
    status.textContent = json ? "JSON 로그를 내려받았어요." : "TXT 로그를 내려받았어요.";
  };
  const close = () => { generation++; root.hidden = true; trigger.setAttribute("aria-expanded", "false"); };
  const root = el("section", { class: "ai-workspace-logs", attrs: { id: "ai-workspace-logs", hidden: "", "aria-label": "AI 로그 추출" }, dataset: { testid: "ai-workspace-logs" },
    children: [el("div", { class: "ai-workspace-logs-head", children: [el("strong", { text: "로그 추출" }), el("button", { attrs: { type: "button", "aria-label": "로그 추출 닫기" }, children: [deckIcon("x")], on: { click: () => { close(); trigger.focus(); } } })] }),
      scope, status, el("div", { class: "ai-workspace-log-actions", children: [action("복사", "copy", () => { void copy(); }), action("TXT 내려받기", "txt", () => download(false)), action("JSON 내려받기", "json", () => download(true))] }), manual] });
  async function open() {
    onOpen(); root.hidden = false; trigger.setAttribute("aria-expanded", "true");
    const serial = ++generation; const projectId = store.getProjectIdentity().id;
    openProjectId = projectId;
    const selected = getSelection();
    scope.replaceChildren(el("option", { text: "현재 / 최근 실행", attrs: { value: "run" } }),
      el("option", { text: selected ? `선택한 조수 · ${selected.name}` : "선택한 조수", attrs: { value: "member", ...(selected?.trace ? {} : { disabled: "" }) } }));
    scope.value = "run"; archives = []; manual.hidden = true; refreshSelection(); scope.focus();
    try {
      const rows = await readActivityArchive(projectId);
      if (disposed || serial !== generation || store.getProjectIdentity().id !== projectId) return;
      archives = rows;
      for (const trace of rows) scope.append(el("option", { text: `${new Date(trace.startedAt).toLocaleString()} · ${trace.title}`, attrs: { value: trace.id } }));
      refresh();
    } catch { if (!disposed && serial === generation) status.textContent = "보관 기록을 불러오지 못했어요. 현재 실행 기록은 추출할 수 있어요."; }
  }
  trigger.addEventListener("click", () => { if (root.hidden) void open(); else close(); });
  scope.addEventListener("change", () => { manual.hidden = true; refresh(); });
  root.addEventListener("keydown", event => { if (event.key === "Escape") { event.stopPropagation(); close(); trigger.focus(); } });
  return { root, trigger, open, close, refreshSelection, dispose: () => { disposed = true; generation++; root.remove(); trigger.remove(); } };
}
