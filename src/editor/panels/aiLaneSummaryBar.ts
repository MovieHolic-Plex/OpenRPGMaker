// 스튜디오 밖 조수 카드의 레인 요약 한 줄 — 「레인 2 작업 중 · 결과 1 대기 — 스튜디오에서 보기 ›」.
//
// 레인은 스튜디오보다 오래 산다(aiLaneSession.ts). 그런데 2026-09-17 까지 스튜디오를 나가면 레인이
// 돌고 있어도 카드에 아무 표시가 없었다 — 결과가 와도 모르고, 중단할 길도 없었다. 이 줄은 그 구멍을
// 메우되 «보인다 · 다시 들어간다» 까지만 한다. 적용·버리기·중단 같은 판단은 스튜디오 보드에서만
// (docs/superpowers/specs/2026-09-15-studio-agent-lanes-design.md §12).
//
// 레인이 0 이면 줄 자체가 사라져 카드는 오늘과 같다.

import type { LaneState } from "@/ai/piAgent/lane";
import { el } from "@/util/dom";
import { laneBoardSummary } from "./aiLaneBoard";
import type { LaneManager } from "./aiLaneManager";

export interface LaneSummaryBarHandle {
  readonly root: HTMLElement;
  dispose(): void;
}

export interface LaneSummaryBarOptions {
  readonly manager: LaneManager;
  /** 「스튜디오에서 보기」 — 결과 대기 레인이 있으면 그 id 를 함께 준다(그 스레드를 바로 연다). */
  readonly onOpenStudio: (laneId: string | null) => void;
}

/** 두 번째 줄 — 지금 가장 눈여겨볼 레인 한 문장. */
export function laneSummaryDetail(lanes: readonly LaneState[]): string {
  const review = lanes.find((lane) => lane.status === "review");
  if (review) return `${review.spec.agentLabel} 「${review.spec.label}」 결과 도착 — 적용은 스튜디오에서`;
  const running = lanes.filter((lane) => lane.status === "running");
  if (running.length > 0) {
    const lane = running[0]!;
    const line = lane.progress.lastLine || "모델이 시작하기를 기다리는 중…";
    return `${lane.spec.agentLabel} 「${lane.spec.label}」 · ${line}`;
  }
  const failed = lanes.find((lane) => lane.status === "failed");
  if (failed) return `${failed.spec.agentLabel} 「${failed.spec.label}」 실패 — 스튜디오에서 다시 실행`;
  return "";
}

export function createLaneSummaryBar(options: LaneSummaryBarOptions): LaneSummaryBarHandle {
  const dot = el("span", { class: "ai-lane-summary-dot", attrs: { "aria-hidden": "true" } });
  const headline = el("b", { class: "ai-lane-summary-headline", dataset: { testid: "ai-lane-summary-headline" } });
  const detail = el("span", { class: "ai-lane-summary-detail", dataset: { testid: "ai-lane-summary-detail" } });
  const open = el("button", {
    class: "ai-lane-summary-open",
    text: "스튜디오에서 보기 ›",
    attrs: { type: "button", title: "레인 보드는 스튜디오에 있습니다 — 적용·버리기·중단은 거기서" },
    dataset: { testid: "ai-lane-summary-open" },
  });
  const root = el("section", {
    class: "ai-lane-summary",
    dataset: { testid: "ai-lane-summary" },
    attrs: { "aria-label": "에이전트 레인 요약", "aria-live": "polite", hidden: "" },
    children: [dot, el("span", { class: "ai-lane-summary-body", children: [headline, detail] }), open],
  });

  let focusLaneId: string | null = null;
  const render = (lanes: readonly LaneState[]): void => {
    // 끝난 레인(적용·버림)만 남았으면 줄을 내린다 — 오늘 카드 그대로.
    const live = lanes.filter((lane) => lane.status !== "applied" && lane.status !== "discarded");
    if (live.length === 0) {
      root.setAttribute("hidden", "");
      root.dataset.state = "empty";
      return;
    }
    const summary = laneBoardSummary(live, []);
    root.removeAttribute("hidden");
    root.dataset.state = summary.running > 0 ? "running" : summary.review > 0 ? "review" : "idle";
    headline.textContent = `레인 ${summary.text}`;
    detail.textContent = laneSummaryDetail(live);
    focusLaneId = live.find((lane) => lane.status === "review")?.spec.id
      ?? live.find((lane) => lane.status === "running")?.spec.id
      ?? live[0]?.spec.id
      ?? null;
  };
  open.addEventListener("click", () => options.onOpenStudio(focusLaneId));
  const unsubscribe = options.manager.subscribe(render);
  render(options.manager.lanes());
  return {
    root,
    dispose: () => { unsubscribe(); },
  };
}
