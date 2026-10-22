import { evaluateAuthoringJourney, loadAuthoringJourneyProgress, setManualJourneyStage, saveAuthoringJourneyProgress, subscribeAuthoringJourneyProgress, type AuthoringJourneyStage, type ManualJourneyStageId } from "@/editor/authoringJourney";
import { runAuthoringTask, type AuthoringTaskId } from "@/editor/authoringTasks";
import { collectEditorProjectReferenceIssues } from "@/editor/projectReferenceIssues";
import { isTileCellChange, store } from "@/project/store";
import { el } from "@/util/dom";

const STAGE_TASK: Readonly<Record<AuthoringJourneyStage["id"], AuthoringTaskId | null>> = {
  project: null, map: "map", event: "event", data: "data", test: "test",
};
const STAGE_HINT: Readonly<Record<AuthoringJourneyStage["id"], string>> = {
  project: "제목과 첫 맵이 있으면 끝납니다.",
  map: "맵에 타일을 한 번이라도 칠하면 끝납니다.",
  event: "NPC·문 같은 이벤트를 하나 확정하면 끝납니다.",
  data: "자료집에서 항목을 하나 고치면 끝납니다. 연결이 끊긴 항목이 있으면 여기 알려 줘요.",
  test: "지금 버전으로 테스트 플레이가 시작되면 끝납니다.",
};
/** 「시작」「확인」 두 버튼이 같은 말로 읽히던 문제 — 각각 무엇을 하는지 이름으로 보인다. */
const STAGE_GO_LABEL: Readonly<Record<AuthoringJourneyStage["id"], string>> = {
  project: "", map: "맵 열기", event: "이벤트 열기", data: "자료집 열기", test: "테스트 열기",
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
  let validationTimer = 0;
  let renderedKey: string | null = null;

  const render = (): void => {
    if (root.hidden) return;
    const project = store.getCurrent();
    const currentScope = scope();
    const progress = loadAuthoringJourneyProgress(currentScope);
    const stages = evaluateAuthoringJourney(project, progress, issues ?? []).map((stage) =>
      issues === null && stage.id === "data" ? { ...stage, detail: "참조 검사 중…" } : stage,
    );
    const nextKey = JSON.stringify([currentScope, stages, issues === null]);
    if (renderedKey === nextKey) return;
    renderedKey = nextKey;
    const done = (stage: AuthoringJourneyStage) => stage.completion !== null || stage.acknowledgement !== null;
    const next = stages.find((stage) => !done(stage));
    const complete = stages.filter(done).length;
    const rows = stages.map((stage, index) => {
      const finished = done(stage);
      const isNext = stage === next;
      const task = STAGE_TASK[stage.id];
      const row = el("li", {
        class: "left-progress-step" + (finished ? " is-done" : "") + (isNext ? " is-next" : "") + (stage.completion === null && stage.acknowledgement !== null ? " is-claimed" : ""),
        dataset: { testid: `left-progress-${stage.id}`, state: finished ? "done" : isNext ? "next" : "todo" },
        children: [
          el("span", { class: "left-progress-mark", attrs: { "aria-hidden": "true" }, text: stage.completion !== null ? "✓" : finished ? "☑" : String(index + 1) }),
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
          attrs: { type: "button", "aria-label": `${stage.label} 작업 열기`, title: "이 단계의 작업 화면을 엽니다" },
          dataset: { testid: `left-progress-go-${stage.id}` },
          text: STAGE_GO_LABEL[stage.id],
          on: { click: () => runAuthoringTask(task) },
        }));
      }
      if (MANUAL.has(stage.id) && stage.completion === null) {
        const stageId = stage.id as ManualJourneyStageId;
        const checked = stage.acknowledgement !== null;
        row.append(el("button", {
          class: "left-progress-ack",
          attrs: { type: "button", "aria-pressed": String(checked), title: checked ? "「이미 했어요」 표시 해제" : "이 단계는 이미 했다고 직접 표시합니다 (편집기가 변경을 못 찾았을 때)" },
          dataset: { testid: `left-progress-ack-${stage.id}` },
          text: checked ? "이미 했어요 ✓" : "이미 했어요",
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
  let disposed = false;
  const scheduleValidation = (): void => {
    if (validationTimer !== 0 || disposed || root.hidden || issues !== null) return;
    validationTimer = window.setTimeout(() => {
      validationTimer = 0;
      if (disposed || root.hidden) return;
      issues = collectEditorProjectReferenceIssues(store.getCurrent());
      renderedKey = null;
      render();
    }, 0);
  };
  const schedule = (): void => {
    if (queued || disposed || root.hidden) return;
    scheduleValidation();
    queued = true;
    const run = (): void => { queued = false; if (!disposed) render(); };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
    else queueMicrotask(run);
  };
  const unsubscribe = store.subscribe((_project, change) => {
    if (!isTileCellChange(change)) {
      issues = null;
      renderedKey = null;
    }
    schedule();
  });
  // 테스트 부팅 성공은 진행 저장소만 바꾸고 프로젝트 변경을 내지 않는다 — 저장 알림으로도 다시 그린다.
  const unsubscribeProgress = subscribeAuthoringJourneyProgress(schedule);
  return {
    root,
    show: () => { scheduleValidation(); render(); },
    dispose: () => { disposed = true; clearTimeout(validationTimer); unsubscribe(); unsubscribeProgress(); },
  };
}
