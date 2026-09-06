import type { AiJob } from "@/ai/jobs/contracts";
import { el } from "@/util/dom";
import { showConfirm } from "@/editor/ui/modal";
import { hasOpenModalLayer } from "@/editor/ui/modalStack";
import { getJobClient, type JobClient } from "./jobClient";
import { familyNames, filteredJobs, jobFilters, jobStateLabels, type JobFilter } from "./jobInbox";
import { openJobReport } from "./jobReportPanel";

export function jobButton(label: string, testid: string, action: () => void): HTMLButtonElement {
  return el("button", { class: "btn", text: label, attrs: { type: "button" }, dataset: { testid }, on: { click: action } });
}
export function restoreJobFocus(opener: HTMLElement): void {
  (opener.isConnected ? opener : document.querySelector<HTMLElement>('[data-testid="ai-jobs-open"]'))?.focus();
}
export async function confirmJobRetry(client: JobClient, job: AiJob): Promise<void> {
  const accepted = await showConfirm({ title: "생성 재시도", message: "새 시도는 유료 요청을 다시 보낼 수 있습니다. 이전 제공자 응답이 불확실하면 중복 비용이 발생할 수 있습니다. 결과를 유지한 채 재시도할까요?", confirmLabel: "중복 비용 가능성 확인 · 재시도" });
  if (accepted) await client.retry(job.id, "generation", true);
}
let activeClose: (() => void) | null = null;
export function closeJobQueue(): void { activeClose?.(); }
export function openJobQueue(opener: HTMLElement, client = getJobClient()): HTMLElement | null {
  if (activeClose) { activeClose(); return null; }
  let filter: JobFilter = "all", query = "";
  const currentOpener = (): HTMLElement => opener.isConnected ? opener : document.querySelector<HTMLElement>('[data-testid="ai-jobs-open"]') ?? opener;
  const status = el("p", { class: "ai-jobs-meta", attrs: { role: "status", "aria-live": "polite" }, dataset: { testid: "ai-jobs-connection" } });
  const error = el("p", { class: "ai-jobs-error", attrs: { role: "alert" } });
  const list = el("div", { class: "ai-jobs-list", dataset: { testid: "ai-jobs-list" } });
  const select = el("select", { attrs: { "aria-label": "작업 상태 필터" }, dataset: { testid: "ai-jobs-filter" }, children: jobFilters.map(([value, label]) => el("option", { value, text: label })) });
  const search = el("input", { attrs: { type: "search", placeholder: "작업 · 프로젝트 찾기", "aria-label": "작업 검색" }, dataset: { testid: "ai-jobs-search" } });
  const closeButton = jobButton("닫기", "ai-jobs-close", () => close(true));
  const panel = el("section", { class: "ai-jobs ai-jobs-queue", attrs: { id: "ai-jobs-queue", role: "region", "aria-label": "AI 작업함", "data-editor-navigation-owner": "true" }, dataset: { testid: "ai-jobs-queue" }, children: [
    el("header", { class: "ai-jobs-header", children: [el("h2", { text: "AI 작업함" }), closeButton] }),
    el("div", { class: "ai-jobs-controls", children: [search, select, status, jobButton("연결 다시 시도", "ai-jobs-reconnect", () => { void client.connect(); }), error] }), list,
  ] });
  const rows = new Map<string, { element: HTMLElement; state: HTMLElement; cancel: HTMLButtonElement; retry: HTMLButtonElement }>();
  const run = async (action: () => Promise<unknown>, button: HTMLButtonElement): Promise<void> => {
    button.disabled = true;
    try { await action(); error.textContent = ""; } catch (reason) { error.textContent = String(reason); }
    finally { button.disabled = false; update(); }
  };
  function update(): void {
    status.textContent = client.connection === "connected" ? "로컬 서버에서 계속 실행됩니다. 창을 닫아도 취소되지 않습니다." : `${jobStateLabels[client.connection]} · ${client.error || "로컬 서버와 Chromium 실행 환경을 확인하세요."}`;
    panel.dataset.connection = client.connection;
    const jobs = filteredJobs(client, filter, query), visible = new Set(jobs.map(job => job.id));
    for (const [id, row] of rows) row.element.hidden = !visible.has(id);
    list.querySelector('[data-testid="ai-jobs-empty"]')?.remove();
    const scroll = list.scrollTop;
    const focused = document.activeElement as HTMLElement | null;
    let cursor = list.firstElementChild;
    for (const job of jobs) {
      let row = rows.get(job.id);
      if (!row) {
        const state = el("p", { class: "ai-jobs-meta" });
        const report = jobButton(`${familyNames[job.family]} · ${job.id}`, "ai-job-open-report", () => { close(false); void openJobReport(job.id, opener, client); });
        report.classList.add("ai-jobs-row-title");
        const cancel = jobButton("취소", "ai-job-cancel", () => { void run(async () => {
          if (await showConfirm({ message: "진행 중인 작업을 취소할까요? 완료된 결과는 유지됩니다.", danger: true })) await client.cancel(job.id);
        }, cancel); });
        const retry = jobButton("생성 재시도", "ai-job-retry", () => { void run(() => confirmJobRetry(client, client.jobs.get(job.id)!), retry); });
        const element = el("article", { class: "ai-jobs-row", dataset: { jobId: job.id }, children: [report, el("p", { class: "ai-jobs-meta", text: `${familyNames[job.family]} · ${job.project.projectId}` }), state, el("div", { class: "ai-jobs-actions", children: [cancel, retry] })] });
        row = { element, state, cancel, retry }; rows.set(job.id, row); list.append(element);
        void client.readInput(job).then(() => {
          if (!element.isConnected) return;
          const label = client.labels.get(job.id);
          if (label) { report.textContent = label; report.title = label; report.setAttribute("aria-label", `${familyNames[job.family]} · ${label}`); }
        }).catch(reason => { if (element.isConnected) report.title = `접수 내용 읽기 실패: ${String(reason)}`; });
      }
      if (row.element !== cursor) list.insertBefore(row.element, cursor); else cursor = cursor.nextElementSibling;
      row.state.textContent = `생성 ${jobStateLabels[job.generation]} · 보고서 ${jobStateLabels[job.report]} · 반영 ${jobStateLabels[client.outcomes.get(job.id)?.application ?? job.application]} · 저장 ${jobStateLabels[client.outcomes.get(job.id)?.save ?? job.save]}`;
      row.cancel.hidden = !["queued", "running"].includes(job.generation);
      row.retry.hidden = !["failed", "cancelled", "interrupted"].includes(job.generation);
      row.element.dataset.unread = String([...client.inbox.values()].some(item => item.jobId === job.id && item.readAt === null));
    }
    if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
    list.scrollTop = scroll;
    if (!jobs.length) list.append(el("div", { class: "ai-jobs-empty", dataset: { testid: "ai-jobs-empty", kind: client.jobs.size ? "no-results" : "empty" }, children: [el("p", { text: client.jobs.size ? "조건에 맞는 작업이 없습니다." : "아직 접수한 작업이 없습니다. 편집을 계속할 수 있습니다." }), ...(client.jobs.size ? [jobButton("필터 초기화", "ai-jobs-reset", () => { filter = "all"; query = ""; search.value = ""; select.value = "all"; update(); search.focus(); })] : [])] }));
  }
  const onPointer = (event: PointerEvent): void => { if (!panel.contains(event.target as Node) && !currentOpener().contains(event.target as Node) && !hasOpenModalLayer()) close(false); };
  const onKey = (event: KeyboardEvent): void => { if (event.key === "Escape" && !hasOpenModalLayer()) { event.preventDefault(); event.stopPropagation(); close(true); } };
  const position = (): void => {
    const rect = currentOpener().getBoundingClientRect();
    panel.style.right = `${Math.max(8, innerWidth - rect.right)}px`;
    panel.style.top = `${rect.bottom + 8}px`;
    panel.style.maxHeight = `${Math.max(0, innerHeight - rect.bottom - 16)}px`;
  };
  const unsubscribe = client.subscribe(update);
  function close(restore: boolean): void {
    unsubscribe(); panel.remove(); document.removeEventListener("pointerdown", onPointer); window.removeEventListener("keydown", onKey, true); window.removeEventListener("resize", position);
    currentOpener().setAttribute("aria-expanded", "false"); activeClose = null; if (restore) restoreJobFocus(opener);
  }
  activeClose = () => close(true); select.addEventListener("change", () => { filter = select.value as JobFilter; update(); }); search.addEventListener("input", () => { query = search.value; update(); });
  document.body.append(panel); opener.setAttribute("aria-expanded", "true"); position(); update(); search.focus();
  document.addEventListener("pointerdown", onPointer); window.addEventListener("keydown", onKey, true); window.addEventListener("resize", position);
  return panel;
}
