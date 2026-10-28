import { projectViewWithoutEventDrafts } from "@/project/eventDrafts";
import { serialize } from "@/project/io";
import { collectProjectReferenceIssues } from "@/project/io/references";
import type { ProjectChangeDescriptor } from "@/project/store";
import type { GameEvent, Project } from "@/project/types";
import { STORAGE_PREFIX } from "@/util/appStorage";

export type AuthoringJourneyStageId = "project" | "map" | "event" | "data" | "test";
export type ManualJourneyStageId = "map" | "event" | "data";
export type AuthoringJourneyCompletion =
  | "project"
  | "map-change"
  | "map-tiles"
  | "committed-event"
  | "database-change"
  | "test-boot"
  | null;
export type AuthoringJourneyAcknowledgement = "acknowledged" | null;

export type AuthoringJourneyProgress = {
  readonly mapTouched: boolean;
  readonly databaseTouched: boolean;
  readonly testedProjectFingerprint: string | null;
  readonly manualAcknowledged: readonly ManualJourneyStageId[];
};

export type AuthoringJourneyStage = {
  readonly id: AuthoringJourneyStageId;
  readonly label: string;
  readonly completion: AuthoringJourneyCompletion;
  readonly acknowledgement: AuthoringJourneyAcknowledgement;
  readonly detail: string;
  readonly referenceIssueCount: number;
};

const STORAGE_KEY = `${STORAGE_PREFIX}authoring-journey:v1`;
export const AUTHORING_TEST_BOOT_SUCCESS_EVENT = "oprn:authoring-test-boot-success";

const committedEventCounts = new WeakMap<readonly GameEvent[], number>();

/** Count the committedEvents projection without cloning command/page payloads.
 * Store mutations replace event arrays; tile/relief edits retain them. Cache at
 * that boundary, not at map identity (a painted map gets a new object).
 */
export function countJourneyCommittedEvents(events: readonly GameEvent[]): number {
  const cached = committedEventCounts.get(events);
  if (cached !== undefined) return cached;
  let count = 0;
  for (const event of events) {
    if (event.draft?.kind === "new") continue;
    if (event.draft?.kind === "edit") {
      if (event.draft.conflict?.kind !== "remote-delete" && event.draft.original) count += 1;
      continue;
    }
    count += 1;
  }
  committedEventCounts.set(events, count);
  return count;
}

const tiledLayers = new WeakMap<readonly number[], boolean>();

/** 칸이 하나라도 칠해진 층인지. 칠하기는 배열을 바꾸므로 배열 단위로 기억한다. */
function layerHasTiles(tiles: readonly number[] | undefined): boolean {
  if (!tiles) return false;
  const cached = tiledLayers.get(tiles);
  if (cached !== undefined) return cached;
  const has = tiles.some((tile) => tile >= 0);
  tiledLayers.set(tiles, has);
  return has;
}

/** 타일이 깔린 맵 수 — 새 맵은 기본 바닥으로 채워져 태어나므로, 사용자 붓질만 세면 「칠하면 끝」이 영영 안 끝났다. */
export function countTiledMaps(project: Project): number {
  let count = 0;
  for (const map of Object.values(project.maps)) {
    if (layerHasTiles(map.lowerTiles) || layerHasTiles(map.upperTiles)) count += 1;
  }
  return count;
}

export function emptyAuthoringJourneyProgress(): AuthoringJourneyProgress {
  return {
    mapTouched: false,
    databaseTouched: false,
    testedProjectFingerprint: null,
    manualAcknowledged: [],
  };
}

const projectFingerprints = new WeakMap<Project, string>();

/** Stable evidence key for the committed authored project, excluding open event drafts. */
export function authoringProjectFingerprint(project: Project): string {
  const cached = projectFingerprints.get(project);
  if (cached !== undefined) return cached;
  const source = serialize(projectViewWithoutEventDrafts(project));
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const fingerprint = `v1:${(hash >>> 0).toString(16).padStart(8, "0")}:${source.length}`;
  projectFingerprints.set(project, fingerprint);
  return fingerprint;
}

export function evaluateAuthoringJourney(
  project: Project,
  progress: AuthoringJourneyProgress,
  referenceIssues: readonly string[] = collectProjectReferenceIssues(project),
): readonly AuthoringJourneyStage[] {
  const acknowledged = new Set(progress.manualAcknowledged);
  const mapCount = Object.keys(project.maps).length;
  const committedEventCount = Object.values(project.maps)
    .reduce((count, map) => count + countJourneyCommittedEvents(map.events), 0);
  const referenceIssueCount = referenceIssues.length;
  const tiledMapCount = countTiledMaps(project);
  // 참조 문제는 테스트를 막지 않는다 — 지적은 데이터 단계가 하고, 테스트 완료는 실제 부팅으로 판정한다.
  const testComplete = progress.testedProjectFingerprint !== null
    && progress.testedProjectFingerprint === authoringProjectFingerprint(project);

  return [
    {
      id: "project",
      label: "프로젝트",
      completion: "project",
      acknowledgement: null,
      detail: `${project.meta.title || "제목 없음"} · 맵 ${mapCount}개`,
      referenceIssueCount: 0,
    },
    {
      id: "map",
      label: "맵",
      completion: progress.mapTouched ? "map-change" : tiledMapCount > 0 ? "map-tiles" : null,
      acknowledgement: acknowledged.has("map") ? "acknowledged" : null,
      // 프로젝트 행이 이미 「맵 N개」를 말한다 — 여기서는 칠한 상태만 말한다.
      detail: progress.mapTouched
        ? "맵을 고쳤어요"
        : tiledMapCount > 0
          ? "타일이 깔린 맵이 있어요"
          : acknowledged.has("map") ? "직접 표시함 · 타일 없음" : "아직 타일이 없어요",
      referenceIssueCount: 0,
    },
    {
      id: "event",
      label: "이벤트",
      completion: committedEventCount > 0 ? "committed-event" : null,
      acknowledgement: acknowledged.has("event") ? "acknowledged" : null,
      detail: committedEventCount > 0
        ? `이벤트 ${committedEventCount}개`
        : acknowledged.has("event") ? "직접 표시함 · 이벤트 없음" : "이벤트 0개",
      referenceIssueCount: 0,
    },
    {
      id: "data",
      label: "데이터",
      completion: progress.databaseTouched ? "database-change" : null,
      acknowledgement: acknowledged.has("data") ? "acknowledged" : null,
      detail: referenceIssueCount > 0
        ? `참조 문제 ${referenceIssueCount}개`
        : progress.databaseTouched
          ? "DB 변경 감지"
          : acknowledged.has("data") ? "직접 표시함 · 고친 항목 없음" : "참조 정상",
      referenceIssueCount,
    },
    {
      id: "test",
      label: "테스트",
      completion: testComplete ? "test-boot" : null,
      acknowledgement: null,
      detail: testComplete
        ? "현재 버전 플레이어 시작 확인"
        : "플레이어 시작 전",
      referenceIssueCount,
    },
  ];
}

export function recordAuthoringJourneyChange(
  progress: AuthoringJourneyProgress,
  change: ProjectChangeDescriptor,
): AuthoringJourneyProgress {
  if (change.scope === "map") {
    if (progress.mapTouched && progress.testedProjectFingerprint === null) return progress;
    return { ...progress, mapTouched: true, testedProjectFingerprint: null };
  }
  if (change.scope === "database" || change.scope === "system") {
    if (progress.databaseTouched && progress.testedProjectFingerprint === null) return progress;
    return { ...progress, databaseTouched: true, testedProjectFingerprint: null };
  }
  if (progress.testedProjectFingerprint === null) return progress;
  return { ...progress, testedProjectFingerprint: null };
}

export function setManualJourneyStage(
  progress: AuthoringJourneyProgress,
  stage: ManualJourneyStageId,
  acknowledged: boolean,
): AuthoringJourneyProgress {
  const next = new Set(progress.manualAcknowledged);
  if (acknowledged) next.add(stage);
  else next.delete(stage);
  return { ...progress, manualAcknowledged: Array.from(next) };
}

export function recordSuccessfulTestBoot(
  progress: AuthoringJourneyProgress,
  evidenceFingerprint: string,
  currentFingerprint: string,
): AuthoringJourneyProgress {
  // 참조 문제가 남아 있어도 «지금 이 버전으로 플레이어가 떴다» 는 사실은 사실이다 —
  // 예전에는 여기서 증거를 버려, 끊긴 참조 하나가 테스트 단계를 영구히 미완료로 묶었다.
  if (!evidenceFingerprint || evidenceFingerprint !== currentFingerprint) return progress;
  return progress.testedProjectFingerprint === evidenceFingerprint
    ? progress
    : { ...progress, testedProjectFingerprint: evidenceFingerprint };
}

export function loadAuthoringJourneyProgress(
  scope: string,
  target: Storage | null = browserStorage(),
): AuthoringJourneyProgress {
  if (!target) return emptyAuthoringJourneyProgress();
  try {
    const raw = target.getItem(storageKey(scope));
    if (!raw) return emptyAuthoringJourneyProgress();
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return emptyAuthoringJourneyProgress();
    const acknowledgementSource = Array.isArray(parsed.manualAcknowledged)
      ? parsed.manualAcknowledged
      : Array.isArray(parsed.manualCompleted) ? parsed.manualCompleted : [];
    const testedProjectFingerprint = typeof parsed.testedProjectFingerprint === "string"
      && parsed.testedProjectFingerprint.trim().length > 0
      ? parsed.testedProjectFingerprint
      : null;
    return {
      mapTouched: parsed.mapTouched === true,
      databaseTouched: parsed.databaseTouched === true,
      testedProjectFingerprint,
      manualAcknowledged: acknowledgementSource.filter(isManualStage),
    };
  } catch {
    return emptyAuthoringJourneyProgress();
  }
}

const progressListeners = new Set<() => void>();

/** 진행 저장소에 쓰기가 일어날 때마다 알린다 — 프로젝트 변경 없이 바뀌는 단계(테스트 부팅)를 패널이 따라가게 한다. */
export function subscribeAuthoringJourneyProgress(listener: () => void): () => void {
  progressListeners.add(listener);
  return () => { progressListeners.delete(listener); };
}

export function saveAuthoringJourneyProgress(
  scope: string,
  progress: AuthoringJourneyProgress,
  target: Storage | null = browserStorage(),
): void {
  try {
    target?.setItem(storageKey(scope), JSON.stringify(progress));
  } catch {
    // Journey hints must never block editing in private/quota-limited storage.
  }
  for (const listener of progressListeners) listener();
}

function storageKey(scope: string): string {
  return `${STORAGE_KEY}:${encodeURIComponent(scope || "local")}`;
}

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function isManualStage(value: unknown): value is ManualJourneyStageId {
  return value === "map" || value === "event" || value === "data";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
