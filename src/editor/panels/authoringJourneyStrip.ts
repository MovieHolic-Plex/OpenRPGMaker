import { runAuthoringTask, type AuthoringTaskId } from "@/editor/authoringTasks";
import {
  evaluateAuthoringJourney,
  type AuthoringJourneyProgress,
  type ManualJourneyStageId,
} from "@/editor/authoringJourney";
import { collectProjectReferenceIssues } from "@/project/io/references";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

const JOURNEY_ICON = `
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M3.5 4h9M3.5 8h9M3.5 12h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>
`.trim();

export function renderAuthoringJourney(
  project: Project,
  progress: AuthoringJourneyProgress,
  options: {
    readonly referenceIssues?: readonly string[];
    readonly onManualToggle?: (stage: ManualJourneyStageId, acknowledged: boolean) => void;
    readonly open?: boolean;
    readonly onOpenChange?: (open: boolean) => void;
  } = {},
): HTMLElement {
  const referenceIssues = options.referenceIssues ?? collectProjectReferenceIssues(project);
  const stages = evaluateAuthoringJourney(project, progress, referenceIssues);
  const firstPending = stages.find((stage) => stage.completion === null)?.id;
  const pendingCount = stages.filter((stage) => stage.completion === null).length;
  let open = options.open === true;
  const root = el("div", {
    class: open ? "authoring-journey is-open" : "authoring-journey",
    dataset: { testid: "authoring-journey" },
  });
  const toggle = el("button", {
    class: "authoring-journey-toggle",
    html: JOURNEY_ICON,
    attrs: {
      type: "button",
      "aria-expanded": String(open),
      "aria-controls": "authoring-journey-strip",
      "aria-label": "저작 진행",
      title: referenceIssues.length > 0
        ? `참조 문제 ${referenceIssues.length}개`
        : pendingCount > 0 ? `저작 진행 · 남은 단계 ${pendingCount}` : "저작 진행 완료",
    },
    dataset: { testid: "authoring-journey-toggle" },
    on: {
      click: () => {
        open = !open;
        root.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
        strip.hidden = !open;
        options.onOpenChange?.(open);
      },
    },
  });
  if (referenceIssues.length > 0) {
    toggle.append(el("span", {
      class: "authoring-journey-badge",
      text: String(referenceIssues.length),
      attrs: { "aria-hidden": "true" },
    }));
  }
  const strip = el("nav", {
    class: "authoring-journey-strip",
    attrs: { id: "authoring-journey-strip", "aria-label": "저작 여정" },
    dataset: { testid: "authoring-journey-strip" },
  });
  strip.hidden = !open;
  const list = el("ol", { class: "authoring-journey-list" });
  for (const stage of stages) {
    const complete = stage.completion !== null;
    const acknowledged = stage.acknowledgement === "acknowledged";
    const item = el("li", {
      class: `authoring-journey-stage${complete ? " is-complete" : ""}${acknowledged ? " is-acknowledged" : ""}${stage.referenceIssueCount > 0 ? " has-issues" : ""}`,
      attrs: firstPending === stage.id ? { "aria-current": "step" } : undefined,
      dataset: {
        testid: `authoring-journey-stage-${stage.id}`,
        completion: stage.completion ?? "pending",
        acknowledgement: stage.acknowledgement ?? "none",
      },
    });
    if (stage.id === "project") {
      item.append(el("span", { class: "authoring-journey-project", text: stage.label }));
    } else {
      const taskButton = el("button", {
        class: "authoring-journey-task",
        text: stage.label,
        attrs: {
          type: "button",
          // 참조 문제는 신호일 뿐 잠금이 아니다 — 끊긴 참조가 있어도 눌러서 돌려볼 수 있어야 한다.
          title: stage.referenceIssueCount > 0
            ? `${stage.label} 작업 열기 (참조 문제 ${stage.referenceIssueCount}개): ${stage.detail}`
            : `${stage.label} 작업 열기: ${stage.detail}`,
        },
        dataset: { testid: `authoring-journey-task-${stage.id}` },
        on: { click: () => runAuthoringTask(stage.id as AuthoringTaskId) },
      });
      item.append(taskButton);
    }
    item.append(el("span", {
      class: "authoring-journey-evidence",
      text: complete ? `✓ ${stage.detail}` : acknowledged ? `확인 · ${stage.detail}` : stage.detail,
      attrs: {
        "aria-label": `${stage.label}: ${complete ? "완료" : acknowledged ? "확인됨, 완료 증거 아님" : "진행 전"}, ${stage.detail}`,
      },
    }));
    if (stage.id === "map" || stage.id === "event" || stage.id === "data") {
      const manualStage: ManualJourneyStageId = stage.id;
      item.append(el("button", {
        class: "authoring-journey-manual",
        text: acknowledged ? "취소" : "확인",
        attrs: {
          type: "button",
          "aria-pressed": String(acknowledged),
          "aria-label": acknowledged
            ? `${stage.label} 확인 취소`
            : `${stage.label} 확인 (완료 증거 아님)`,
          title: "직접 확인한 상태만 기록합니다. 완료 증거로 사용하지 않습니다.",
        },
        dataset: { testid: `authoring-journey-manual-${stage.id}` },
        on: { click: () => options.onManualToggle?.(manualStage, !acknowledged) },
      }));
    }
    if (stage.id === "data" && referenceIssues.length > 0) {
      const issueList = el("ul", { class: "authoring-journey-reference-list" });
      referenceIssues.forEach((issue, index) => {
        issueList.append(el("li", {
          text: issue,
          dataset: { testid: `authoring-journey-reference-issue-${index}` },
        }));
      });
      const issuePanel = el("div", { class: "authoring-journey-reference-panel" });
      issuePanel.append(
        issueList,
        el("button", {
          class: "authoring-journey-reference-repair",
          text: "데이터에서 복구",
          attrs: { type: "button" },
          dataset: { testid: "authoring-journey-repair-references" },
          on: { click: () => runAuthoringTask("data") },
        }),
      );
      const details = el("details", {
        class: "authoring-journey-reference-issues",
        dataset: { testid: "authoring-journey-reference-issues" },
      });
      details.append(
        el("summary", { text: `문제 목록 ${referenceIssues.length}개` }),
        issuePanel,
      );
      item.append(details);
    }
    list.append(item);
  }
  strip.append(list);
  root.append(toggle, strip);
  return root;
}
