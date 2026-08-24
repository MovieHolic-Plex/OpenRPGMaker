import { runAuthoringTask, type AuthoringTaskId } from "@/editor/authoringTasks";
import {
  evaluateAuthoringJourney,
  type AuthoringJourneyProgress,
  type ManualJourneyStageId,
} from "@/editor/authoringJourney";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

export function renderAuthoringJourney(
  project: Project,
  progress: AuthoringJourneyProgress,
  options: {
    readonly referenceIssues?: readonly string[];
    readonly onManualToggle?: (stage: ManualJourneyStageId, complete: boolean) => void;
  } = {},
): HTMLElement {
  const stages = evaluateAuthoringJourney(project, progress, options.referenceIssues);
  const firstPending = stages.find((stage) => stage.completion === null)?.id;
  const root = el("nav", {
    class: "authoring-journey-strip",
    attrs: { "aria-label": "저작 여정" },
    dataset: { testid: "authoring-journey" },
  });
  const list = el("ol", { class: "authoring-journey-list" });
  for (const stage of stages) {
    const complete = stage.completion !== null;
    const item = el("li", {
      class: `authoring-journey-stage${complete ? " is-complete" : ""}${stage.referenceIssueCount > 0 ? " has-issues" : ""}`,
      attrs: firstPending === stage.id ? { "aria-current": "step" } : undefined,
      dataset: {
        testid: `authoring-journey-stage-${stage.id}`,
        completion: stage.completion ?? "pending",
      },
    });
    if (stage.id === "project") {
      item.append(el("span", { class: "authoring-journey-project", text: stage.label }));
    } else {
      const blocked = stage.id === "test" && stage.referenceIssueCount > 0;
      const taskButton = el("button", {
        class: "authoring-journey-task",
        text: stage.label,
        attrs: { type: "button", title: blocked ? `참조 문제 ${stage.referenceIssueCount}개를 먼저 해결하세요` : `${stage.label} 작업 열기: ${stage.detail}` },
        dataset: { testid: `authoring-journey-task-${stage.id}` },
        on: { click: () => runAuthoringTask(stage.id as AuthoringTaskId) },
      });
      if (blocked) {
        taskButton.setAttribute("aria-disabled", "true");
        taskButton.disabled = true;
      }
      item.append(taskButton);
    }
    item.append(el("span", {
      class: "authoring-journey-evidence",
      text: complete ? `✓ ${stage.detail}` : stage.detail,
      attrs: { "aria-label": `${stage.label}: ${complete ? "완료" : "진행 전"}, ${stage.detail}` },
    }));
    if (stage.id === "map" || stage.id === "event" || stage.id === "data") {
      const manualStage = stage.id;
      const manuallyComplete = stage.completion === "manual";
      item.append(el("button", {
        class: "authoring-journey-manual",
        text: manuallyComplete ? "취소" : "확인",
        attrs: { type: "button", "aria-pressed": String(manuallyComplete), "aria-label": manuallyComplete ? `${stage.label} 수동 완료 취소` : `${stage.label} 수동 완료`, title: `${stage.label} 단계를 직접 확인했음으로 표시` },
        dataset: { testid: `authoring-journey-manual-${stage.id}` },
        on: { click: () => options.onManualToggle?.(manualStage, !manuallyComplete) },
      }));
    }
    list.append(item);
  }
  root.append(list);
  return root;
}
