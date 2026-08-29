// project/projectCommitLog.ts
// 원격 커밋 로그(Supabase project_commits / project_changes) 기록 경로.
//
// **왜 `@/editor/tools/changeset` 를 여기서 import 하는가 (순환 검사 근거, 2026-08-29 실측):**
// diff 계산기(`summarizeChanges`)를 두 번 만들지 않기 위해 원본을 그대로 쓴다. import 그래프를
// 실제로 넓혀서 확인했다 —
//   - `editor/tools/changeset.ts` 에서 도달 가능한 모듈 218개 중 `project/projectCommitLog.ts`
//     도 `project/store.ts` 도 **없다**. 즉 순환이 아니다.
//   - 무게도 늘지 않는다: `projectCommitLog.ts` 는 이미 `supabaseProjectSync` 경유로
//     `project/lint/projectLint` 를 끌고 있어 224개를 도달한다. changeset 이 추가로 들여오는
//     것은 `editor/detachedDraftMemory`(의존 0개)와 타입 전용 `editor/tools/types` 뿐이다.
//   - `src/project/*` → `src/editor/*` 방향 자체도 선례가 있다
//     (`project/quest/questCompiler.ts` → `@/editor/tools/eventTools` 등 7개 파일).
// 그래서 계산 함수를 `src/project/` 로 옮기거나 sink 주입으로 뒤집을 이유가 없었다.
import { summarizeChanges } from "@/editor/tools/changeset";
import { takeEditActivitySince, type EditActivityCommitAttachment } from "@/editor/editActivityLog";
import { createLogger } from "@/util/logger";
import { currentHumanEditorIdentity, type EditorIdentity } from "./editorIdentity";
import { projectWithoutEventDrafts } from "./eventDrafts";
import { serialize } from "./io";
import { recordProjectCommitToSupabase, type ProjectCommitReviewStatus } from "./supabaseProjectSync";
import type { ChangeSummary } from "@/project/types";
import type { Project } from "./types";

const log = createLogger("project-commits");

export type CommitLogInput = {
  readonly project: Project;
  readonly identity?: EditorIdentity;
  readonly reviewStatus: ProjectCommitReviewStatus;
  readonly summary: string;
  readonly diff?: ChangeSummary;
  readonly toolNames?: readonly string[];
};

let lastManualSerialized: string | null = null;
/** 직전 커밋에서 어디까지 실었는지. 커밋 경로 전체가 이 한 축을 공유한다. */
let editActivityCursor = 0;

/**
 * 이번 커밋에 실을 행위 기록을 꺼내고 커서를 전진시킨다.
 *
 * **모든 커밋 경로가 여기를 지난다** — `recordProjectCommitToSupabase` 호출부가
 * 이 파일의 두 곳(`recordProjectCommit`, `recordManualProjectCommitAfterSave)뿐이라
 * 초크포인트가 성립한다. 호출부마다 붙이면 새 경로가 생길 때 조용히 빠진다.
 *
 * 원격 기록이 실패해도 커서는 전진시킨다: 재시도하면 같은 엔트리가 두 커밋에 실린다.
 * 감사 기록에서 중복은 누락보다 나쁘다 — 같은 행위가 두 번 있었던 것으로 읽힌다.
 * (dedup baseline 인 `lastManualSerialized` 와 정반대 판단인데, 그쪽은 커밋 자체가
 * 영구히 사라지는 문제라 보수적으로 잡는 게 맞다.)
 *
 * 동기 실행 계약: `recordProjectCommit` 의 첫 `await` **이전에** 불러야 한다.
 * 그래야 호출자가 방금 만든 mutation 까지 정확히 이 커밋에 실린다.
 */
function drainEditActivityForCommit(): EditActivityCommitAttachment | undefined {
  const slice = takeEditActivitySince(editActivityCursor);
  editActivityCursor = slice.cursor;
  if (slice.entries.length === 0 && slice.omitted === 0) return undefined;
  return { entries: slice.entries, omitted: slice.omitted };
}

/**
 * 커밋 로그 row — 포스트 적용 증거로 쓰는 결정적 형태. supabase 미설정이면
 * persisted:false + commitId:null(로컬 전용)로 항상 resolve 된다.
 */
export type CommitRow = {
  readonly commitId: string | null;
  readonly persisted: boolean;
  readonly reviewStatus: ProjectCommitReviewStatus;
  readonly summary: string;
  readonly toolNames: readonly string[];
  readonly recordedAt: string;
};

/**
 * await 가능한 커밋 기록 변형 — fire-and-forget과 동일한 직렬화/호출을 거치되
 * 완료까지 기다려 row를 돌려준다(자동 적용 마일스톤의 결정적 커밋 증거, todo 5 의존).
 */
export async function recordProjectCommit(input: CommitLogInput): Promise<CommitRow> {
  const persistedProject = projectWithoutEventDrafts(input.project);
  const editActivity = drainEditActivityForCommit();
  const serialized = serialize(persistedProject);
  const result = await recordProjectCommitToSupabase({
    project: persistedProject,
    identity: input.identity ?? currentHumanEditorIdentity(),
    reviewStatus: input.reviewStatus,
    summary: input.summary,
    diff: input.diff,
    toolNames: input.toolNames ?? [],
    serialized,
    ...(editActivity ? { editActivity } : {}),
  });
  return {
    commitId: result.kind === "saved" ? result.commitId ?? null : null,
    persisted: result.kind === "saved",
    reviewStatus: input.reviewStatus,
    summary: input.summary,
    toolNames: input.toolNames ?? [],
    recordedAt: new Date().toISOString(),
  };
}

export function recordProjectCommitFireAndForget(input: CommitLogInput): void {
  void recordProjectCommit(input).catch((error) => {
    log.warn("커밋 기록 실패", error);
  });
}

/**
 * 사람 손편집이 원격 저장에 성공한 직후의 커밋 로그 1건.
 *
 * `baseline` 은 **이번 저장 직전에 서버가 갖고 있던** 프로젝트다(store 의 `persistedBaseline`
 * 을 덮어쓰기 전 값). 이게 있어야 summary 가 실제 변경을 담는다 —
 * 실측(2026-08-29): 이전 구현은 `systemChanged = true` 만 세워서 타일 3000장을 칠했든
 * NPC 를 지웠든 원격 summary 가 **항상 "변경 저장: 시스템"** 이었다. 진짜 diff 계산기
 * (`summarizeChanges`)는 AI 경로만 쓰고 있었다.
 *
 * 성능: diff 는 dedup 통과 **후에만** 계산한다. 변경 없는 저장(가장 흔한 경우)은
 * 기존과 동일하게 `serialize` 한 번으로 끝난다. 실제로 바뀐 저장에서는 이미 돌고 있는
 * `serialize`(전체 JSON 직렬화)와 같은 자릿수의 비용이 한 번 더 드는 셈이다.
 *
 * 알려진 경계: baseline 은 "서버가 마지막으로 받은 것" 이지 "마지막으로 커밋 로그에 남은 것"
 * 이 아니다. AI 적용(커밋 row 를 따로 남기고 `resetManualProjectCommitBaseline` 만 부른다)
 * 직후 사람이 추가 편집을 하면 그 사람 커밋의 diff 에 AI 변경분이 함께 잡힌다.
 * 과대 집계이긴 하지만 "시스템" 한 단어보다는 감사에 쓸 수 있다.
 */
export function recordManualProjectCommitAfterSave(project: Project, baseline?: Project | null): void {
  const persistedProject = projectWithoutEventDrafts(project);
  const serialized = serialize(persistedProject);
  if (serialized === lastManualSerialized) return;
  // 첫 저장/프로젝트 전환 직후에는 비교 대상이 없다. 기존 동작(systemChanged)으로 떨어뜨리되
  // summary 가 왜 "시스템" 인지 로그에 남긴다 — 안 남기면 예전 버그와 구분이 안 된다.
  const diff = baseline ? manualDiffFromBaseline(baseline, persistedProject) : manualDiffSummary();
  const summary = summaryForDiff(diff);
  if (!baseline) {
    log.info("저장 baseline 이 없어 실제 diff 를 못 낸다 — 시스템 변경으로 기록한다", { summary });
  } else {
    log.debug("수동 저장 커밋 diff", { summary });
  }
  // dedup early-return 뒤에 드레인한다 — 변경 없는 저장(가장 흔한 경우)에서 커서를
  // 전진시키면 다음 진짜 저장이 행위 기록을 잃는다.
  const editActivity = drainEditActivityForCommit();
  void recordProjectCommitToSupabase({
    project: persistedProject,
    identity: currentHumanEditorIdentity(),
    reviewStatus: "direct",
    summary,
    diff,
    toolNames: [],
    serialized,
    ...(editActivity ? { editActivity } : {}),
  })
    // 커밋 기록 요청이 실패하면(네트워크 오류 등) baseline을 전진시키지 않는다 —
    // 미리 전진시키면 이후 동일 내용 재저장이 dedup에 걸려 그 커밋이 영구히 기록되지 않는다.
    //
    // resolve 됐다고 기록된 것은 아니다. `recordProjectCommitToSupabase` 는 supabase 미설정과
    // project_commits/project_changes 테이블 누락을 **정상 resolve(not-configured)** 로 돌려준다.
    // 이전 구현은 `.then()` 에서 kind 를 보지 않아 그 경우에도 baseline 을 전진시켰고,
    // 나중에 설정이 붙은 뒤 동일 내용 재저장이 dedup 에 걸려 그 커밋이 영구히 사라졌다.
    .then((result) => {
      if (result.kind === "saved") {
        lastManualSerialized = serialized;
        return;
      }
      log.warn("수동 저장 커밋이 기록되지 않았다 — dedup baseline 을 전진시키지 않는다", {
        kind: result.kind,
        summary,
      });
    })
    .catch((error) => {
      log.warn("수동 저장 커밋 기록 실패", error);
    });
}

export function resetManualProjectCommitBaseline(project: Project): void {
  lastManualSerialized = serialize(projectWithoutEventDrafts(project));
  // 프로젝트 전환/재베이스라인 시 남아 있던 pending 엔트리를 버린다 — 안 버리면 이전
  // 프로젝트의 편집이 다음 프로젝트의 첫 커밋에 실려 엉뚱한 맵 id 로 읽힌다.
  // AI 적용 경로에서는 바로 앞의 커밋이 이미 드레인했으므로 no-op 이다.
  editActivityCursor = takeEditActivitySince(editActivityCursor).cursor;
}

export function summaryForDiff(diff: ChangeSummary): string {
  const parts = [
    diff.tilesChanged > 0 ? `타일 ${diff.tilesChanged}` : null,
    (diff.mapPropertiesChanged ?? 0) > 0 ? `맵 설정 ${diff.mapPropertiesChanged}` : null,
    diff.eventsAdded > 0 ? `이벤트 추가 ${diff.eventsAdded}` : null,
    diff.eventsModified > 0 ? `이벤트 수정 ${diff.eventsModified}` : null,
    diff.eventsRemoved > 0 ? `이벤트 삭제 ${diff.eventsRemoved}` : null,
    diff.mapsAdded > 0 ? `맵 추가 ${diff.mapsAdded}` : null,
    diff.mapsRemoved > 0 ? `맵 삭제 ${diff.mapsRemoved}` : null,
    diff.dbRecordsChanged > 0 ? `DB ${diff.dbRecordsChanged}` : null,
    diff.tilesetsChanged > 0 ? `타일셋 ${diff.tilesetsChanged}` : null,
    diff.switchesAdded > 0 ? `스위치 ${diff.switchesAdded}` : null,
    diff.variablesAdded > 0 ? `변수 ${diff.variablesAdded}` : null,
    diff.worldEntitiesAdded > 0 ? `세계관 추가 ${diff.worldEntitiesAdded}` : null,
    diff.worldEntitiesModified > 0 ? `세계관 수정 ${diff.worldEntitiesModified}` : null,
    diff.palettePresetsAdded > 0 ? `프리셋 추가 ${diff.palettePresetsAdded}` : null,
    diff.palettePresetsModified > 0 ? `프리셋 수정 ${diff.palettePresetsModified}` : null,
    diff.endingsChanged > 0 ? `엔딩 ${diff.endingsChanged}` : null,
    diff.sessionChanged ? "세션" : null,
    diff.systemChanged ? "시스템" : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? `변경 저장: ${parts.join(", ")}` : "변경 저장";
}

export function combineDiffs(diffs: readonly (ChangeSummary | undefined)[]): ChangeSummary {
  return diffs.reduce<ChangeSummary>((combined, diff) => {
    if (!diff) return combined;
    combined.tilesChanged += diff.tilesChanged;
    combined.mapPropertiesChanged = (combined.mapPropertiesChanged ?? 0) + (diff.mapPropertiesChanged ?? 0);
    combined.eventsAdded += diff.eventsAdded;
    combined.eventsModified += diff.eventsModified;
    combined.eventsRemoved += diff.eventsRemoved;
    combined.mapsAdded += diff.mapsAdded;
    combined.mapsRemoved += diff.mapsRemoved;
    combined.dbRecordsChanged += diff.dbRecordsChanged;
    combined.tilesetsChanged += diff.tilesetsChanged;
    combined.switchesAdded += diff.switchesAdded;
    combined.variablesAdded += diff.variablesAdded;
    combined.worldEntitiesAdded += diff.worldEntitiesAdded;
    combined.worldEntitiesModified += diff.worldEntitiesModified;
    combined.palettePresetsAdded += diff.palettePresetsAdded;
    combined.palettePresetsModified += diff.palettePresetsModified;
    combined.endingsChanged += diff.endingsChanged;
    combined.sessionChanged = combined.sessionChanged || diff.sessionChanged;
    combined.systemChanged = combined.systemChanged || diff.systemChanged;
    combined.warnings.push(...diff.warnings);
    return combined;
  }, emptyDiffSummary());
}

/**
 * baseline → 저장본 실제 diff.
 *
 * baseline 을 한 번 더 `projectWithoutEventDrafts` 로 통과시키는 이유: draft 이벤트가 섞여 있으면
 * `summarizeChanges` 가 그걸 **이벤트 삭제**로 집계해 "이벤트 삭제 3" 같은 거짓 summary 가 나온다.
 * store 의 `persistedBaseline` 은 이미 draft 가 없지만, `resetManualProjectCommitBaseline` 이
 * 라이브 프로젝트를 받는 것과 같은 방어를 여기서도 유지한다.
 */
function manualDiffFromBaseline(baseline: Project, saved: Project): ChangeSummary {
  return summarizeChanges(projectWithoutEventDrafts(baseline), saved);
}

function manualDiffSummary(): ChangeSummary {
  const diff = emptyDiffSummary();
  diff.systemChanged = true;
  return diff;
}

function emptyDiffSummary(): ChangeSummary {
  return {
    tilesChanged: 0,
    mapPropertiesChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    dbRecordsChanged: 0,
    tilesetsChanged: 0,
    switchesAdded: 0,
    variablesAdded: 0,
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    palettePresetsAdded: 0,
    palettePresetsModified: 0,
    endingsChanged: 0,
    sessionChanged: false,
    systemChanged: false,
    warnings: [],
  };
}
