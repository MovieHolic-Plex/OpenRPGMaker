import { evaluateAuthoringJourney, loadAuthoringJourneyProgress, setManualJourneyStage, saveAuthoringJourneyProgress, type AuthoringJourneyStage, type ManualJourneyStageId } from "@/editor/authoringJourney";
import { runAuthoringTask, type AuthoringTaskId } from "@/editor/authoringTasks";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { isTileCellChange, store } from "@/project/store";
import { el } from "@/util/dom";

const STAGE_TASK: Readonly<Record<AuthoringJourneyStage["id"], AuthoringTaskId | null>> = {
  project: null, map: "map", event: "event", data: "data", test: "test",
};
const STAGE_HINT: Readonly<Record<AuthoringJourneyStage["id"], string>> = {
  project: "제목과 첫 맵이 있으면 끝납니다.",
  map: "맵에 타일을 한 번이라도 칠하면 끝납니다.",
  event: "NPC·문 같은 이벤트를 하나 확정하면 끝납니다.",
  data: "데이터베이스를 한 번 고치면 끝납니다. 참조 문제가 있으면 여기 표시됩니다.",
  test: "지금 버전으로 테스트 플레이가 시작되면 끝납니다.",
};
const MANUAL: ReadonlySet<string> = new Set<ManualJourneyStageId>(["map", "event", "data"]);

/**
 * 왼쪽 활동 막대 「진행」: 작성 여정(프로젝트 → 맵 → 이벤트 → 데이터 → 테스트)을 세로 체크리스트로 보인다.
 * 판정은 캔버스 위 여정 띠와 같은 evaluateAuthoringJourney·진행 저장소를 쓴다 — 두 표면이 다른 답을 내지 않는다.
 * 첫 미완료 단계가 「다음」이고, 행을 누르면 그 단계의 작업(runAuthoringTask)으로 간다.
 */
export function createLeftProgressPane(scope: () => string): { root: HTMLElement; show(): void; dispose(): void } {
  const root = el("section", { class: "left-progress-pane", attrs: { "aria-label": "작성 진행" }, dataset: { testid: "left-progress-pane" } });
  let issues: readonly string[] | null = null;

  const render = (): void => {
    if (root.hidden) return;
    const project = store.getCurrent();
    issues ??= collectProjectReferenceIssues(project);
    const progress = loadAuthoringJourneyProgress(scope());
    const stages = evaluateAuthoringJourney(project, progress, issues);
    const done = (stage: AuthoringJourneyStage) => stage.completion !== null || stage.acknowledgement !== null;
    const next = stages.find((stage) => !done(stage));
    const complete = stages.filter(done).length;
    const rows = stages.map((stage, index) => {
      const finished = done(stage);
      const isNext = stage === next;
      const task = STAGE_TASK[stage.id];
      const row = el("li", {
        class: "left-progress-step" + (finished ? " is-done" : "") + (isNext ? " is-next" : ""),
        dataset: { testid: `left-progress-${stage.id}`, state: finished ? "done" : isNext ? "next" : "todo" },
        children: [
          el("span", { class: "left-progress-mark", attrs: { "aria-hidden": "true" }, text: finished ? "✓" : String(index + 1) }),
          el("div", {
            class: "left-progress-copy",
            children: [
              el("strong", { text: stage.label }),
              el("span", { class: "left-progress-detail", text: stage.detail }),
              ...(isNext ? [el("span", { class: "left-progress-hint", text: STAGE_HINT[stage.id] })] : []),
            ],
          }),
        ],
      });
      if (task) {
        row.append(el("button", {
          class: "left-progress-go",
          attrs: { type: "button", "aria-label": `${stage.label} 작업 열기` },
          dataset: { testid: `left-progress-go-${stage.id}` },
          text: isNext ? "시작" : "열기",
          on: { click: () => runAuthoringTask(task) },
        }));
      }
      if (MANUAL.has(stage.id) && stage.completion === null) {
        const stageId = stage.id as ManualJourneyStageId;
        const checked = stage.acknowledgement !== null;
        row.append(el("button", {
          class: "left-progress-ack",
          attrs: { type: "button", "aria-pressed": String(checked), title: checked ? "확인 표시 해제" : "직접 확인했다고 표시" },
          dataset: { testid: `left-progress-ack-${stage.id}` },
          text: checked ? "확인됨" : "확인",
          on: { click: () => { saveAuthoringJourneyProgress(scope(), setManualJourneyStage(loadAuthoringJourneyProgress(scope()), stageId, !checked)); render(); } },
        }));
      }
      return row;
    });
    root.replaceChildren(
      el("div", {
        class: "left-progress-head",
        children: [
          el("strong", { text: "작성 진행" }),
          el("span", { class: "left-progress-count", dataset: { testid: "left-progress-count" }, text: `${complete}/${stages.length}` }),
        ],
      }),
      el("div", { class: "left-progress-bar", attrs: { role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(stages.length), "aria-valuenow": String(complete), "aria-label": "작성 진행" }, children: [el("span", { attrs: { style: `width:${Math.round((complete / stages.length) * 100)}%` } })] }),
      el("ol", { class: "left-progress-list", children: rows }),
    );
  };

  let queued = false;
  const schedule = (): void => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; render(); });
  };
  const unsubscribe = store.subscribe((_project, change) => {
    if (!isTileCellChange(change)) issues = null;
    schedule();
  });
  return {
    root,
    show: () => { issues = null; render(); },
    dispose: () => unsubscribe(),
  };
}
