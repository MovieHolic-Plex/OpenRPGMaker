// 진행 중 턴·대기 제안·미확인 계획의 작업 스트립.

import { el } from "@/util/dom";

export type WorkStripStep = {
  readonly id: string;
  readonly label: string;
  readonly done: boolean;
};

export type WorkStripModel = {
  readonly title: string;
  readonly steps: readonly WorkStripStep[];
};

export function buildWorkStripModel(input: {
  readonly busy: boolean;
  readonly pendingProposal: boolean;
  readonly planSteps?: readonly string[];
  readonly planConfirmed?: boolean;
  readonly workPlanItems?: readonly { readonly title: string; readonly done: boolean }[];
}): WorkStripModel | null {
  if (input.planSteps && input.planSteps.length > 0 && !input.planConfirmed) {
    return {
      title: "계획 · 확인 대기",
      steps: input.planSteps.map((label, index) => ({
        id: `plan-${index}`,
        label,
        done: false,
      })),
    };
  }
  if (input.workPlanItems && input.workPlanItems.length > 0) {
    return {
      title: input.busy ? "시공 중" : input.pendingProposal ? "수락 대기" : "작업",
      steps: input.workPlanItems.map((item, index) => ({
        id: `plan-item-${index}`,
        label: item.title,
        done: item.done,
      })),
    };
  }
  if (input.pendingProposal) {
    return {
      title: "수락 대기",
      steps: [
        { id: "sent", label: "요청 전달", done: true },
        { id: "draft", label: "초안 작성", done: true },
        { id: "review", label: "제안 검토", done: false },
      ],
    };
  }
  if (input.busy) {
    return {
      title: "시공 중",
      steps: [
        { id: "sent", label: "요청 전달", done: true },
        { id: "draft", label: "초안 작성", done: false },
        { id: "review", label: "제안 검토", done: false },
      ],
    };
  }
  return null;
}

export function renderWorkStrip(options: {
  readonly model: WorkStripModel;
  readonly onConfirmPlan?: () => void;
  readonly showPlanConfirm?: boolean;
}): HTMLElement {
  const steps = options.model.steps.map((step) =>
    el("div", {
      class: "ai-work-strip-step" + (step.done ? " is-done" : ""),
      dataset: { testid: `ai-work-strip-step-${step.id}` },
      text: `${step.done ? "☑" : "☐"} ${step.label}`,
    }),
  );
  const actions = options.showPlanConfirm
    ? [
        el("button", {
          class: "ai-assistant-action",
          text: "이대로 시공",
          attrs: { type: "button" },
          dataset: { testid: "ai-plan-confirm" },
          on: { click: () => options.onConfirmPlan?.() },
        }),
      ]
    : [];
  return el("div", {
    class: "ai-work-strip",
    dataset: { testid: "ai-work-strip" },
    children: [
      el("div", { class: "ai-work-strip-title", text: options.model.title }),
      ...steps,
      ...actions,
    ],
  });
}
