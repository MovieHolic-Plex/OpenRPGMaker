import { committedEvents, projectWithoutEventDrafts } from "@/project/eventDrafts";
import { serialize } from "@/project/io";
import { collectProjectReferenceIssues } from "@/project/io/references";
import type { ProjectChangeDescriptor } from "@/project/store";
import type { Project } from "@/project/types";
import { STORAGE_PREFIX } from "@/util/appStorage";

export type AuthoringJourneyStageId = "project" | "map" | "event" | "data" | "test";
export type ManualJourneyStageId = "map" | "event" | "data";
export type AuthoringJourneyCompletion =
  | "project"
  | "map-change"
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

export function emptyAuthoringJourneyProgress(): AuthoringJourneyProgress {
  return {
    mapTouched: false,
    databaseTouched: false,
    testedProjectFingerprint: null,
    manualAcknowledged: [],
  };
}

/** Stable evidence key for the committed authored project, excluding open event drafts. */
export function authoringProjectFingerprint(project: Project): string {
  const source = serialize(projectWithoutEventDrafts(project));
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v1:${(hash >>> 0).toString(16).padStart(8, "0")}:${source.length}`;
}

export function evaluateAuthoringJourney(
  project: Project,
  progress: AuthoringJourneyProgress,
  referenceIssues: readonly string[] = collectProjectReferenceIssues(project),
): readonly AuthoringJourneyStage[] {
  const acknowledged = new Set(progress.manualAcknowledged);
  const mapCount = Object.keys(project.maps).length;
  const committedEventCount = Object.values(project.maps)
    .reduce((count, map) => count + committedEvents(map.events).length, 0);
  const referenceIssueCount = referenceIssues.length;
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
      completion: progress.mapTouched ? "map-change" : null,
      acknowledgement: acknowledged.has("map") ? "acknowledged" : null,
      detail: progress.mapTouched
        ? "맵 변경 감지"
        : acknowledged.has("map") ? "확인됨 · 변경 증거 없음" : `맵 ${mapCount}개`,
      referenceIssueCount: 0,
    },
    {
      id: "event",
      label: "이벤트",
      completion: committedEventCount > 0 ? "committed-event" : null,
      acknowledgement: acknowledged.has("event") ? "acknowledged" : null,
      detail: committedEventCount > 0
        ? `커밋 ${committedEventCount}개`
        : acknowledged.has("event") ? "확인됨 · 커밋 증거 없음" : "커밋 0개",
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
          : acknowledged.has("data") ? "확인됨 · DB 변경 증거 없음" : "참조 정상",
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
