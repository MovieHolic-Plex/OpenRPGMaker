import { currentHumanEditorIdentity, type EditorIdentity } from "./editorIdentity";
import { projectWithoutEventDrafts } from "./eventDrafts";
import { serialize } from "./io";
import { recordProjectCommitToSupabase, type ProjectCommitReviewStatus } from "./supabaseProjectSync";
import type { ChangeSummary } from "@/project/types";
import type { Project } from "./types";

export type CommitLogInput = {
  readonly project: Project;
  readonly identity?: EditorIdentity;
  readonly reviewStatus: ProjectCommitReviewStatus;
  readonly summary: string;
  readonly diff?: ChangeSummary;
  readonly toolNames?: readonly string[];
};

let lastManualSerialized: string | null = null;

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
  const serialized = serialize(persistedProject);
  const result = await recordProjectCommitToSupabase({
    project: persistedProject,
    identity: input.identity ?? currentHumanEditorIdentity(),
    reviewStatus: input.reviewStatus,
    summary: input.summary,
    diff: input.diff,
    toolNames: input.toolNames ?? [],
    serialized,
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
    console.warn("[projectCommits] record failed:", error);
  });
}

export function recordManualProjectCommitAfterSave(project: Project): void {
  const persistedProject = projectWithoutEventDrafts(project);
  const serialized = serialize(persistedProject);
  if (serialized === lastManualSerialized) return;
  const diff = manualDiffSummary();
  void recordProjectCommitToSupabase({
    project: persistedProject,
    identity: currentHumanEditorIdentity(),
    reviewStatus: "direct",
    summary: summaryForDiff(diff),
    diff,
    toolNames: [],
    serialized,
  })
    // 커밋 기록 요청이 실패하면(네트워크 오류 등) baseline을 전진시키지 않는다 —
    // 미리 전진시키면 이후 동일 내용 재저장이 dedup에 걸려 그 커밋이 영구히 기록되지 않는다.
    .then(() => {
      lastManualSerialized = serialized;
    })
    .catch((error) => {
      console.warn("[projectCommits] manual record failed:", error);
    });
}

export function resetManualProjectCommitBaseline(project: Project): void {
  lastManualSerialized = serialize(projectWithoutEventDrafts(project));
}

export function summaryForDiff(diff: ChangeSummary): string {
  const parts = [
    diff.tilesChanged > 0 ? `타일 ${diff.tilesChanged}` : null,
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

function manualDiffSummary(): ChangeSummary {
  const diff = emptyDiffSummary();
  diff.systemChanged = true;
  return diff;
}

function emptyDiffSummary(): ChangeSummary {
  return {
    tilesChanged: 0,
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
