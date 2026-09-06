import type { AiJobInput, BlobRef, JsonValue } from "@/ai/jobs/contracts";
import type { JobReport, ReportSection } from "@/ai/jobs/reportModel";
import { store } from "@/project/store";
import { sameProjectIdentity } from "@/project/loadedProjectIdentity";
import { el } from "@/util/dom";
import { registerModal, isTopModal } from "@/editor/ui/modalStack";
import { showConfirm } from "@/editor/ui/modal";
import { openDbConnectionSettings } from "@/editor/panels/dbConnectionSettings";
import { getJobClient, verifiedArtifact } from "./jobClient";
import { familyNames, jobStateLabels } from "./jobInbox";
import { confirmJobRetry, jobButton, restoreJobFocus } from "./jobQueuePanel";
import { createJobReview } from "./jobReviewControls";
import type { JobReview } from "./materializeJobResult";

const phaseNames = { before: "반영 전", generated: "생성 결과", applied: "실제 반영 결과", "applied-draft": "초안에 반영 · 편집기 확인 필요", staged: "보존된 중간 결과" };
let activeClose: (() => void) | null = null;
export function closeJobReport(): void { activeClose?.(); }
function inspect(value: JsonValue): HTMLElement {
  if (typeof value === "string") return el("p", { class: "ai-jobs-prose", text: value });
  if (value === null) return el("p", { text: "알 수 없음" });
  if (typeof value !== "object") return el("span", { text: String(value) });
  if (Array.isArray(value)) return el("ul", { children: value.map(item => el("li", { children: [inspect(item)] })) });
  return el("dl", { class: "ai-jobs-facts", children: Object.entries(value).flatMap(([key, item]) => [el("dt", { text: key }), el("dd", { children: [inspect(item)] })]) });
}
export async function openJobReport(id: string, opener: HTMLElement, client = getJobClient()): Promise<HTMLElement> {
  activeClose?.();
  let disposed = false, reportHash = "", displayedResult = "", selected = "", revision = 0, busy = false;
  let review: (() => JobReview) | null = null;
  let manifest: readonly BlobRef[] = [];
  let mediaObserver: IntersectionObserver | null = null;
  const urls = new Set<string>();
  const mediaCache = new Map<string, Promise<string>>();
  const clearMedia = (): void => { mediaObserver?.disconnect(); mediaObserver = null; for (const url of urls) URL.revokeObjectURL(url); urls.clear(); mediaCache.clear(); };
  const title = el("h2", { text: "AI 작업 보고서", attrs: { id: "ai-job-report-title" } });
  const states = el("div", { class: "ai-jobs-states", dataset: { testid: "ai-job-states" } });
  const notice = el("p", { class: "ai-jobs-meta", attrs: { role: "status", "aria-live": "polite" }, dataset: { testid: "ai-job-notice" } });
  const error = el("p", { class: "ai-jobs-error", attrs: { role: "alert" }, dataset: { testid: "ai-job-error" } });
  const recoveryReason = el("p", { class: "ai-jobs-prose" });
  const recovery = el("details", { children: [el("summary", { text: "반영 복구 정보" }), recoveryReason] });
  const rail = el("nav", { class: "ai-jobs-objects", attrs: { "aria-label": "영향받는 모든 대상" }, dataset: { testid: "ai-job-objects" } });
  const body = el("div", { class: "ai-jobs-report-body", attrs: { tabindex: "0", "aria-label": "결과 상세" }, dataset: { testid: "ai-job-report-body" } });
  const workspace = el("div", { class: "ai-jobs-workspace", children: [rail, body], dataset: { pane: "detail" } });
  const run = async (action: () => Promise<unknown>): Promise<void> => {
    if (busy) return; busy = true; error.textContent = ""; update();
    try { await action(); } catch (reason) { if (!disposed) error.textContent = String(reason); }
    finally { busy = false; if (!disposed) update(); }
  };
  const adopt = jobButton("새 보고서 보기", "ai-job-refresh-report", () => { void run(load); });
  const retryPreview = jobButton("미리보기만 재시도", "ai-job-retry-report", () => { void run(() => client.retry(id, "report")); });
  const retry = jobButton("생성 재시도", "ai-job-report-retry", () => { const job = client.jobs.get(id); if (job) void run(() => confirmJobRetry(client, job)); });
  const cancel = jobButton("작업 취소", "ai-job-report-cancel", () => { void run(async () => { if (await showConfirm({ message: "작업을 취소할까요? 보존된 결과는 남습니다.", danger: true })) await client.cancel(id); }); });
  const apply = jobButton("검토한 결과 반영", "ai-job-apply", () => { void run(async () => { if (!review || displayedResult !== client.jobs.get(id)?.resultRef?.sha256) throw new Error("현재 결과와 일치하는 보고서를 먼저 여세요."); if (await showConfirm({ message: "선택한 결과를 열린 프로젝트에 반영할까요? 충돌은 덮어쓰지 않습니다. 초안은 원래 편집기에서 확인해야 합니다." })) { if (displayedResult !== client.jobs.get(id)?.resultRef?.sha256) throw new Error("검토 중 결과가 바뀌었습니다. 새 보고서를 여세요."); await client.apply(id, review()); } }); });
  const save = jobButton("저장만 재시도", "ai-job-save", () => { void run(() => client.save(id)); });
  const picker = jobButton("대상 프로젝트 선택", "ai-job-project-picker", () => { close(); openDbConnectionSettings(); });
  const read = jobButton("읽음 확인 다시 시도", "ai-job-read", () => { void run(() => client.markRead(id)); });
  const back = jobButton("대상 목록", "ai-job-object-list", () => { workspace.dataset.pane = workspace.dataset.pane === "list" ? "detail" : "list"; });
  const closeButton = jobButton("닫기", "ai-job-report-close", () => close());
  const panel = el("section", { class: "ai-jobs ai-jobs-report", attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "ai-job-report-title", "data-editor-navigation-owner": "true" }, dataset: { testid: "ai-job-report", jobId: id }, children: [
    el("header", { class: "ai-jobs-header", children: [title, closeButton] }), states,
    el("div", { class: "ai-jobs-report-status", children: [notice, error, adopt, read] }),
    workspace,
    el("footer", { class: "ai-jobs-actions", children: [back, apply, save, retryPreview, retry, cancel, picker] }),
  ] });
  const overlay = el("div", { class: "ai-jobs-backdrop", children: [panel] });
  function update(): void {
    panel.dataset.busy = String(busy);
    const job = client.jobs.get(id); if (!job) return;
    const outcome = client.outcomes.get(id);
    recovery.hidden = !outcome?.reason;
    recoveryReason.textContent = outcome?.reason ?? "";
    title.textContent = `${familyNames[job.family]} · ${job.project.projectId}`;
    title.title = title.textContent;
    states.textContent = `생성 ${jobStateLabels[job.generation]}  /  보고서 ${jobStateLabels[job.report]}  /  반영 ${jobStateLabels[outcome?.application ?? job.application]}  /  저장 ${jobStateLabels[outcome?.save ?? job.save]}`;
    states.dataset.generation = job.generation; states.dataset.application = outcome?.application ?? job.application; states.dataset.save = outcome?.save ?? job.save;
    const matching = store.isLoaded() && sameProjectIdentity(job.project, store.getLoadedProjectIdentity());
    const unknown = (outcome?.application ?? job.application) === "outcome-unknown";
    const applied = (outcome?.application ?? job.application) === "applied";
    const matchingResult = Boolean(displayedResult && displayedResult === job.resultRef?.sha256);
    panel.dataset.matchingResult = String(matchingResult);
    notice.textContent = [client.connection === "offline" ? "연결 끊김 · 보존된 내용을 보고 있습니다." : "", !matching ? `다른 프로젝트의 결과입니다: ${job.project.projectId}. 보기만 가능하며 자동 전환하지 않습니다.` : "", outcome?.reason ? "반영을 완료하지 못한 사유가 있습니다. 아래 복구 정보를 확인하세요." : "", !matchingResult && job.generation === "succeeded" ? "이전 보고서를 보고 있습니다. 현재 생성 결과에 맞는 새 보고서가 필요합니다." : "", unknown ? "반영 결과가 불확실합니다. 복구 증거를 확인하세요. 자동 재반영하지 않습니다." : "", job.report === "running" ? "보고서 갱신 중 · 현재 열린 리비전은 그대로 유지됩니다." : ""].filter(Boolean).join(" ");
    adopt.hidden = !job.reportRef || reportHash === job.reportRef.sha256;
    read.hidden = ![...client.inbox.values()].some(item => item.jobId === id && item.readAt === null);
    retryPreview.hidden = !["partial", "failed", "interrupted"].includes(job.report);
    retry.hidden = !["failed", "cancelled", "interrupted"].includes(job.generation);
    cancel.hidden = !["queued", "running"].includes(job.generation);
    picker.hidden = matching;
    apply.hidden = job.generation !== "succeeded" || applied || unknown;
    apply.disabled = busy || !matching || !matchingResult || !review || store.hasReadOnlyProjectSnapshot();
    apply.title = !matching ? "대상 프로젝트를 먼저 명시적으로 여세요." : !matchingResult ? "현재 결과와 일치하는 보고서를 먼저 여세요." : "충돌·초안·잠금 검사를 통과한 결과만 반영합니다.";
    save.hidden = !applied || (outcome?.save ?? job.save) === "saved";
    save.disabled = busy || !matching;
    for (const button of [adopt, read, retryPreview, retry, cancel]) button.disabled = busy;
  }
  async function renderObject(sections: readonly ReportSection[], key: string, token: number): Promise<void> {
    const group = sections.filter(section => `${section.kind}:${section.objectId}` === key);
    const host = el("section", { class: "ai-jobs-object", dataset: { objectId: key } });
    host.append(el("h3", { text: group[0]?.title ?? key }));
    const media = el("div", { class: "ai-jobs-media", dataset: { testid: "ai-job-media" } });
    host.append(media); body.prepend(host);
    const visible: Promise<void>[] = [];
    const deferred = new Map<Element, () => Promise<void>>();
    mediaObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        const load = deferred.get(entry.target); deferred.delete(entry.target); mediaObserver?.unobserve(entry.target);
        if (load) void load();
      }
    }, { root: body });
    for (const section of group) {
      const phase = el("section", { class: "ai-jobs-phase", dataset: { phase: section.phase }, children: [el("h4", { text: phaseNames[section.phase] })] });
      media.append(phase);
      for (const [index, preview] of section.previews.entries()) {
        const caption = el("figcaption", { text: `${jobStateLabels[preview.role]} · ${preview.width ?? "?"} × ${preview.height ?? "?"}` });
        const figure = el("figure", { dataset: { previewId: preview.id, status: preview.status, mediaRole: preview.role }, children: [caption] }); phase.append(figure);
        if (preview.status !== "ready" || !preview.artifact) { figure.append(el("p", { text: `${jobStateLabels[preview.status]}: ${preview.error ?? "미리보기를 사용할 수 없습니다."}` })); continue; }
        const artifact = preview.artifact;
        const load = async (): Promise<void> => {
          try {
            let pending = mediaCache.get(artifact.sha256);
            if (!pending) {
              pending = (async () => {
                const bytes = await verifiedArtifact(client, id, artifact, manifest);
                if (disposed || token !== revision) return "";
                if (!["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"].includes(artifact.mediaType)) throw new Error("지원하지 않는 이미지 형식입니다.");
                const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: artifact.mediaType })); urls.add(url); return url;
              })();
              mediaCache.set(artifact.sha256, pending);
            }
            const url = await pending;
            if (!url || disposed || token !== revision) return;
            const image = el("img", { attrs: { src: url, alt: `${section.title} · ${phaseNames[section.phase]} · ${jobStateLabels[preview.role]}` }, dataset: { artifactSha: artifact.sha256 } });
            image.addEventListener("error", () => { figure.dataset.status = "failed"; caption.textContent = "이미지를 해석하지 못했습니다. 원본 결과는 보존됩니다."; });
            figure.prepend(image); figure.dataset.loaded = "true";
          } catch (reason) { if (!disposed && token === revision) { figure.dataset.status = "failed"; figure.append(el("p", { text: String(reason) })); } }
        };
        if (index === 0) visible.push(load());
        else { deferred.set(figure, load); mediaObserver.observe(figure); }
      }
      host.append(el("details", { children: [el("summary", { text: `${phaseNames[section.phase]} · 기록과 변경 근거` }), inspect(section.data)] }));
    }
    await Promise.all(visible);
  }
  async function load(): Promise<void> {
    const detail = await client.artifacts.detail(id);
    const { job } = detail;
    if (disposed) return;
    if (!job.reportRef) { if (!reportHash) body.replaceChildren(el("p", { text: "보고서를 준비하고 있습니다. 결과가 도착하면 새 보고서 보기를 선택하세요." })); return; }
    const [document, input] = await Promise.all([
      client.artifacts.json<JobReport>(id, job.reportRef), client.artifacts.json<AiJobInput>(id, job.inputRef),
    ]);
    if (disposed) return;
    if (document.jobId !== id || document.kind !== "ai-job-report") throw new Error("Report identity mismatch");
    const matches = document.source === "result" && document.states.generation === "succeeded" && document.result?.sha256 === job.resultRef?.sha256;
    let controls: Awaited<ReturnType<typeof createJobReview>> | null = null;
    if (matches) {
      try { controls = await createJobReview(client, job); }
      catch (reason) { error.textContent = `검토 데이터를 불러오지 못했습니다: ${String(reason)}`; }
    }
    if (disposed) return;
    revision++; const token = revision; clearMedia(); manifest = detail.manifest;
    displayedResult = matches ? document.result!.sha256 : "";
    reportHash = job.reportRef.sha256; panel.dataset.revision = reportHash; review = controls?.review ?? null;
    const keys = [...new Set(document.sections.map(section => `${section.kind}:${section.objectId}`))];
    if (!keys.includes(selected)) selected = keys[0] ?? "";
    const summary = el("section", { class: "ai-jobs-summary", children: [
      el("h3", { text: "결과와 검증" }),
      el("p", { text: `출처 ${jobStateLabels[document.source]} · ${document.sections.length}개 기록 · ${keys.length}개 대상`, dataset: { testid: "ai-job-source", source: document.source } }),
      ...(document.applied.noChanges ? [el("p", { text: "변경 없음 · 프로젝트를 수정하지 않았습니다.", dataset: { testid: "ai-job-no-changes" } })] : []),
      ...(document.applied.scope === "draft" ? [el("p", { text: "초안에만 반영되었습니다. 원래 편집기에서 확인해야 하며 프로젝트에 저장된 상태가 아닙니다.", dataset: { testid: "ai-job-draft-only" } })] : []),
      ...(document.applied.reason ? [el("p", { text: document.applied.reason })] : []),
      ...(document.failure ? [el("p", { class: "ai-jobs-error", text: document.failure.message })] : []),
      ...[document.output.assistantText, document.output.name, document.output.summary, document.output.record].filter(value => value !== undefined).map(value => inspect(value)),
      el("p", { text: document.usage === null ? "사용량 · 알 수 없음" : "사용량 · 아래 기록에서 확인", dataset: { testid: "ai-job-usage", known: String(document.usage !== null) } }),
      ...(controls ? [controls.element] : []), recovery,
      el("details", { children: [el("summary", { text: "전체 결과 · 검증 · 복구 정보" }), inspect(document.output), inspect(client.outcomes.get(id)?.reason ?? null)] }),
      el("details", { children: [el("summary", { text: "요청 내용" }), inspect(input.payload)] }),
      el("details", { children: [el("summary", { text: "사용량 · 활동 · 불변 식별자" }), inspect({ usage: document.usage, capturedStates: document.states, jobId: id, revision: reportHash, input: document.input, result: document.result, application: document.applicationEvidence, save: document.saveEvidence } as unknown as JsonValue)] }),
    ] });
    const choose = (key: string): void => {
      selected = key; revision++; const next = revision;
      clearMedia(); body.replaceChildren(summary); body.scrollTop = 0;
      for (const button of rail.querySelectorAll<HTMLButtonElement>("button")) button.setAttribute("aria-current", String(button.dataset.objectKey === key));
      workspace.dataset.pane = "detail"; void renderObject(document.sections, key, next);
      body.focus({ preventScroll: true });
    };
    rail.replaceChildren(el("h3", { text: `전체 대상 ${keys.length}` }), ...keys.map(key => {
      const section = document.sections.find(item => `${item.kind}:${item.objectId}` === key)!;
      const button = jobButton(section.title, "ai-job-object", () => choose(key)); button.dataset.objectKey = key; button.setAttribute("aria-current", String(selected === key)); return button;
    }));
    body.replaceChildren(summary); await renderObject(document.sections, selected, token); update();
  }
  const unsubscribe = client.subscribe(update);
  const availability = store.subscribeApplicationAvailability(update);
  const close = registerModal(overlay, () => {
    disposed = true; revision++; unsubscribe(); availability(); overlay.remove();
    clearMedia(); activeClose = null; restoreJobFocus(opener);
  });
  activeClose = close;
  panel.addEventListener("keydown", event => {
    if (event.key !== "Tab" || !isTopModal(overlay)) return;
    const controls = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]')].filter(item => !item.hidden && item.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  overlay.addEventListener("pointerdown", event => { if (event.target === overlay && isTopModal(overlay)) close(); });
  document.body.append(overlay); closeButton.focus(); update();
  await run(async () => { await load(); await client.markRead(id); });
  return panel;
}
