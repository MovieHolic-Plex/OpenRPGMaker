import { editorState } from "@/editor/editorState";
import { requestEditorCameraFocus } from "@/editor/editorCameraFocus";
import { openRegionTaskModal, type RegionTaskModalOptions } from "@/editor/panels/regionTaskModal";
import { projectLint, type LintIssue } from "@/project/lint/projectLint";
import type { MapId, Project } from "@/project/types";
import { el } from "@/util/dom";

export interface CanvasInspectionDeps {
  readonly focusIssue: (location: { readonly mapId: MapId; readonly x: number; readonly y: number }) => void;
  readonly lint: (project: Project) => readonly LintIssue[];
  readonly openRegionTask: (options: RegionTaskModalOptions) => HTMLElement | void;
}

export interface CanvasInspectionOptions {
  readonly deps?: CanvasInspectionDeps;
  readonly mapId: MapId;
  readonly project: Project;
}

const defaultDeps: CanvasInspectionDeps = {
  focusIssue: ({ mapId, x, y }) => {
    editorState.set({
      currentMapId: mapId,
      selection: { mapId, x, y, width: 1, height: 1 },
      tool: "select",
    });
    requestEditorCameraFocus({ mapId, tileX: x, tileY: y });
  },
  lint: projectLint,
  openRegionTask: openRegionTaskModal,
};

export function openCanvasInspectionPanel(options: CanvasInspectionOptions): HTMLElement {
  document.querySelector('[data-testid="canvas-inspection-panel"]')?.remove();
  const deps = options.deps ?? defaultDeps;
  const issues = deps.lint(options.project);
  const scopedIssues = issues.filter((issue) => issue.mapId === undefined || issue.mapId === options.mapId);
  const errors = scopedIssues.filter((issue) => issue.severity === "error").length;
  const warnings = scopedIssues.filter((issue) => issue.severity === "warning").length;
  const panel = el("section", {
    class: "canvas-inspection-panel",
    attrs: { "aria-label": "맵 검사 결과", role: "dialog" },
    dataset: { testid: "canvas-inspection-panel" },
    children: [
      el("header", {
        class: "canvas-inspection-header",
        children: [
          el("div", {
            children: [
              el("strong", { text: "맵 검사" }),
              el("span", {
                class: "canvas-inspection-summary",
                text: `문제 ${scopedIssues.length}개 · 오류 ${errors} · 주의 ${warnings}`,
                dataset: { testid: "canvas-inspection-summary" },
              }),
            ],
          }),
          el("button", {
            class: "canvas-inspection-close",
            text: "닫기",
            attrs: { "aria-label": "검사 결과 닫기", type: "button" },
            on: { click: () => panel.remove() },
          }),
        ],
      }),
      scopedIssues.length === 0
        ? el("div", {
          class: "canvas-inspection-empty",
          text: "정적 검사에서 문제를 찾지 못했습니다.",
          dataset: { testid: "canvas-inspection-empty" },
        })
        : el("ol", {
          class: "canvas-inspection-list",
          children: scopedIssues.map((issue, index) => renderIssue(issue, index, options, deps)),
        }),
    ],
  });
  document.body.append(panel);
  return panel;
}

function renderIssue(
  issue: LintIssue,
  index: number,
  options: CanvasInspectionOptions,
  deps: CanvasInspectionDeps,
): HTMLElement {
  const located = issue.mapId !== undefined && issue.x !== undefined && issue.y !== undefined;
  const location = located ? `${issue.x}, ${issue.y}` : "프로젝트 전체";
  return el("li", {
    class: `canvas-inspection-item is-${issue.severity}`,
    dataset: { testid: "canvas-inspection-item" },
    children: [
      el("span", { class: "canvas-inspection-severity", text: severityLabel(issue.severity) }),
      el("div", {
        class: "canvas-inspection-content",
        children: [
          el("strong", { text: issue.message }),
          el("span", { class: "canvas-inspection-location", text: location }),
        ],
      }),
      el("div", {
        class: "canvas-inspection-actions",
        children: [
          ...(located ? [
            el("button", {
              text: "위치 보기",
              attrs: { type: "button" },
              dataset: { testid: `canvas-inspection-focus-${index}` },
              on: {
                click: () => deps.focusIssue({
                  mapId: issue.mapId as MapId,
                  x: issue.x as number,
                  y: issue.y as number,
                }),
              },
            }),
          ] : []),
          el("button", {
            class: "is-ai-fix",
            text: "AI로 수정",
            attrs: { type: "button" },
            dataset: { testid: `canvas-inspection-fix-${index}` },
            on: { click: () => openIssueRepair(issue, options, deps) },
          }),
        ],
      }),
    ],
  });
}

function openIssueRepair(
  issue: LintIssue,
  options: CanvasInspectionOptions,
  deps: CanvasInspectionDeps,
): void {
  const mapId = (issue.mapId ?? options.mapId) as MapId;
  const map = options.project.maps[mapId];
  if (!map) return;
  const region = issue.x !== undefined && issue.y !== undefined
    ? boundedRegion(issue.x, issue.y, map.width, map.height)
    : { x: 0, y: 0, width: map.width, height: map.height };
  deps.openRegionTask({
    autoRun: false,
    initialInstruction: [
      "검사에서 발견된 다음 문제만 안전하게 수정해 주세요.",
      issue.message,
      "원래 의도와 통행 가능성을 보존하고, 수정 후 같은 문제가 다시 발생하지 않게 확인해 주세요.",
    ].join("\n"),
    mapId,
    region,
  });
}

function boundedRegion(x: number, y: number, mapWidth: number, mapHeight: number): {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
} {
  const left = Math.max(0, x - 2);
  const top = Math.max(0, y - 2);
  return {
    x: left,
    y: top,
    width: Math.min(5, mapWidth - left),
    height: Math.min(5, mapHeight - top),
  };
}

function severityLabel(severity: LintIssue["severity"]): string {
  switch (severity) {
    case "error": return "오류";
    case "warning": return "주의";
    case "info": return "참고";
  }
}
