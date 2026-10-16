// editor/panels/aiJobEntry.ts
// 작업 목록의 입구 버튼 둘 — 열린 도크 위쪽(「작업 N개 · 확인 필요 K」)과 접힌 레일(개수 배지). 둘 다 상태 줄의 요약 버튼과 같은 목록을 연다.
// 읽는 것은 요약(개수·가장 급한 상태) 하나뿐이다 — 행은 목록이 열릴 때만 만들어진다(aiJobList 의 구독 규칙).

import { el } from "@/util/dom";
import { subscribeJobSummary } from "./aiJobList";
import { markJobListEntry, syncJobListEntry, toggleAiJobList } from "./aiJobListView";
import type { JobSummary } from "./aiPresence";

export interface JobEntry {
  readonly button: HTMLButtonElement;
  dispose(): void;
}

/**
 * variant:
 *  - dock: 열린 도크 위쪽. 「작업 3개 · 확인 필요 1」 글. 일이 없으면 숨는다.
 *  - rail: 접힌 레일. 숫자 배지(자세한 문장은 열린 뒤 목록이 말한다). 일이 없으면 숨는다. 접히지 않은 도크에서는 CSS 가 숨긴다.
 */
export function createJobEntry(variant: "dock" | "rail"): JobEntry {
  const button = el("button", {
    class: `ai-status-jobs-entry is-${variant}`,
    attrs: { type: "button", hidden: "", title: "모든 AI 작업을 한 목록으로 봅니다" },
    dataset: { testid: variant === "dock" ? "ai-job-entry-dock" : "ai-job-entry-rail" },
    on: { click: () => toggleAiJobList(button) },
  }) as HTMLButtonElement;
  markJobListEntry(button);
  const offExpanded = syncJobListEntry(button);
  let lastSig = "";
  const paint = (summary: JobSummary): void => {
    const sig = `${summary.total}|${summary.review}|${summary.failed}|${summary.top}`;
    if (sig === lastSig) return;
    lastSig = sig;
    const show = summary.total > 0;
    button.hidden = !show;
    button.dataset.top = summary.top ?? "";
    if (!show) { button.replaceChildren(); return; }
    if (variant === "rail") {
      const urgent = summary.review + summary.failed;
      button.replaceChildren(el("span", { text: String(urgent > 0 ? urgent : summary.total), attrs: { "aria-hidden": "true" } }));
      button.setAttribute("aria-label", [`작업 ${summary.total}개`, ...(summary.review > 0 ? [`확인 필요 ${summary.review}`] : []), ...(summary.failed > 0 ? [`실패 ${summary.failed}`] : [])].join(", "));
      return;
    }
    const pieces: string[] = [`작업 ${summary.total}개`];
    if (summary.review > 0) pieces.push(`확인 필요 ${summary.review}`);
    if (summary.failed > 0) pieces.push(`실패 ${summary.failed}`);
    button.removeAttribute("aria-label");
    button.replaceChildren(...pieces.flatMap((text, i) => [...(i ? [el("i", { text: " · ", attrs: { "aria-hidden": "true" } })] : []), el("span", { text })]));
  };
  const offSummary = subscribeJobSummary(paint);
  return { button, dispose: () => { offSummary(); offExpanded(); button.remove(); } };
}
