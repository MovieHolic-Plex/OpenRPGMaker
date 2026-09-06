import type { AiJob } from "@/ai/jobs/contracts";
import { el } from "@/util/dom";
import { getJobClient, type JobClient } from "./jobClient";
import { openJobQueue } from "./jobQueuePanel";

export type JobFilter = "all" | "queued" | "running" | "attention" | "completed" | "failed" | "unread";
export const jobFilters: readonly [JobFilter, string][] = [["all", "전체"], ["queued", "대기"], ["running", "진행"], ["attention", "확인 필요"], ["completed", "완료"], ["failed", "실패"], ["unread", "안 읽음"]];
export const familyNames: Record<AiJob["family"], string> = { assistant: "조수", region: "영역", database: "자료집", "event-commands": "이벤트", tileset: "타일셋", image: "이미지" };
export const jobStateLabels: Record<string, string> = {
  queued: "대기", running: "진행 중", succeeded: "생성 완료", failed: "실패", cancelled: "취소됨", interrupted: "중단됨",
  pending: "준비 중", ready: "준비됨", partial: "일부 미리보기 실패", "not-requested": "요청 안 함",
  "awaiting-editor": "편집기 대기", "awaiting-review": "검토 필요", applying: "반영 중", applied: "반영됨", conflict: "충돌",
  "outcome-unknown": "결과 불확실", unsaved: "저장 안 됨", saving: "저장 중", saved: "저장 확인됨", unknown: "알 수 없음",
  connecting: "연결 중", connected: "연결됨", offline: "연결 끊김", unavailable: "실행 환경 필요",
  missing: "원본 없음", unsupported: "지원하지 않는 미디어", result: "완성 결과", checkpoint: "보존된 중간 결과", input: "접수 내용",
  artwork: "그림", atlas: "전체 타일 그림판", crop: "타일 확대", map: "지도", flow: "명령 흐름",
};
export function filteredJobs(client: JobClient, filter: JobFilter, query: string): AiJob[] {
  return [...client.jobs.values()].filter(job => {
    if (query && !`${familyNames[job.family]} ${client.labels.get(job.id) ?? ""} ${job.id} ${job.project.projectId}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return false;
    switch (filter) {
      case "all": return true;
      case "unread": return [...client.inbox.values()].some(item => item.jobId === job.id && item.readAt === null);
      case "attention": return ["awaiting-editor", "awaiting-review", "conflict", "outcome-unknown"].includes(client.outcomes.get(job.id)?.application ?? job.application) || ["failed", "unknown", "unsaved"].includes(job.save) || ["partial", "failed"].includes(job.report) || job.generation === "interrupted";
      case "completed": return job.generation === "succeeded";
      case "failed": return ["failed", "cancelled", "interrupted"].includes(job.generation);
      default: return job.generation === filter;
    }
  }).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}
export function mountJobLauncher(client = getJobClient()): { element: HTMLButtonElement; dispose: () => void } {
  const running = el("span", { dataset: { testid: "ai-jobs-running" } });
  const unread = el("span", { attrs: { "aria-live": "polite", "aria-atomic": "true" }, dataset: { testid: "ai-jobs-unread" } });
  const element = el("button", { class: "btn ai-jobs-launcher", attrs: { type: "button", "aria-expanded": String(Boolean(document.querySelector('[data-testid="ai-jobs-queue"]'))), "aria-controls": "ai-jobs-queue" }, dataset: { testid: "ai-jobs-open" }, children: [el("span", { text: "AI 작업" }), running, unread] });
  const update = (): void => {
    if (running.textContent !== `진행 ${client.running}`) running.textContent = `진행 ${client.running}`;
    running.setAttribute("aria-label", `진행 중 ${client.running}개`);
    if (unread.textContent !== `안 읽음 ${client.unread}`) unread.textContent = `안 읽음 ${client.unread}`;
    unread.setAttribute("aria-label", `안 읽은 알림 ${client.unread}개`);
    unread.dataset.active = String(client.unread > 0);
  };
  update(); const dispose = client.subscribe(update);
  element.addEventListener("click", () => openJobQueue(element, client));
  return { element, dispose };
}
