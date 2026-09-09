import { el } from "@/util/dom";
import { openJobReport } from "./jobReportPanel";

export function jobOriginLink(jobId: string, opener: HTMLElement): HTMLElement {
  return el("button", {
    class: "btn",
    text: "작업함에서 보기",
    attrs: { type: "button" },
    dataset: { testid: "ai-job-origin-open", jobId },
    on: {
      click: () => {
        void openJobReport(jobId, opener);
      },
    },
  });
}
