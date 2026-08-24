import { committedEvents } from "@/project/eventDrafts";
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
  | "manual"
  | null;

export type AuthoringJourneyProgress = {
  readonly mapTouched: boolean;
  readonly databaseTouched: boolean;
  readonly testBootSucceeded: boolean;
  readonly manualCompleted: readonly ManualJourneyStageId[];
};

export type AuthoringJourneyStage = {
  readonly id: AuthoringJourneyStageId;
  readonly label: string;
  readonly completion: AuthoringJourneyCompletion;
  readonly detail: string;
  readonly referenceIssueCount: number;
};

const STORAGE_KEY = `${STORAGE_PREFIX}authoring-journey:v1`;
export const AUTHORING_TEST_BOOT_SUCCESS_EVENT = "oprn:authoring-test-boot-success";

export function emptyAuthoringJourneyProgress(): AuthoringJourneyProgress {
  return { mapTouched: false, databaseTouched: false, testBootSucceeded: false, manualCompleted: [] };
}

export function evaluateAuthoringJourney(
  project: Project,
  progress: AuthoringJourneyProgress,
  referenceIssues: readonly string[] = collectProjectReferenceIssues(project),
): readonly AuthoringJourneyStage[] {
  const manual = new Set(progress.manualCompleted);
  const mapCount = Object.keys(project.maps).length;
  const committedEventCount = Object.values(project.maps)
    .reduce((count, map) => count + committedEvents(map.events).length, 0);
  const referenceIssueCount = referenceIssues.length;
  const mapCompletion: AuthoringJourneyCompletion = manual.has("map")
    ? "manual"
    : progress.mapTouched ? "map-change" : null;
  const eventCompletion: AuthoringJourneyCompletion = manual.has("event")
    ? "manual"
    : committedEventCount > 0 ? "committed-event" : null;
  const dataCompletion: AuthoringJourneyCompletion = manual.has("data")
    ? "manual"
    : progress.databaseTouched ? "database-change" : null;

  return [
    { id: "project", label: "프로젝트", completion: "project", detail: `${project.meta.title || "제목 없음"} · 맵 ${mapCount}개`, referenceIssueCount: 0 },
    { id: "map", label: "맵", completion: mapCompletion, detail: mapCompletion === "manual" ? "수동 확인" : progress.mapTouched ? "맵 변경 감지" : `맵 ${mapCount}개`, referenceIssueCount: 0 },
    { id: "event", label: "이벤트", completion: eventCompletion, detail: eventCompletion === "manual" ? "수동 확인" : `커밋 ${committedEventCount}개`, referenceIssueCount: 0 },
    { id: "data", label: "데이터", completion: dataCompletion, detail: referenceIssueCount > 0 ? `참조 문제 ${referenceIssueCount}개` : dataCompletion === "manual" ? "수동 확인" : progress.databaseTouched ? "DB 변경 감지" : "참조 정상", referenceIssueCount },
    { id: "test", label: "테스트", completion: progress.testBootSucceeded ? "test-boot" : null, detail: progress.testBootSucceeded ? "플레이어 시작 확인" : referenceIssueCount > 0 ? "참조 문제를 먼저 확인" : "실행 전", referenceIssueCount },
  ];
}

export function recordAuthoringJourneyChange(
  progress: AuthoringJourneyProgress,
  change: ProjectChangeDescriptor,
): AuthoringJourneyProgress {
  if (change.scope === "map") return { ...progress, mapTouched: true };
  if (change.scope === "database" || change.scope === "system") return { ...progress, databaseTouched: true };
  return progress;
}

export function setManualJourneyStage(
  progress: AuthoringJourneyProgress,
  stage: ManualJourneyStageId,
  complete: boolean,
): AuthoringJourneyProgress {
  const next = new Set(progress.manualCompleted);
  if (complete) next.add(stage);
  else next.delete(stage);
  return { ...progress, manualCompleted: Array.from(next) };
}

export function recordSuccessfulTestBoot(progress: AuthoringJourneyProgress): AuthoringJourneyProgress {
  return progress.testBootSucceeded ? progress : { ...progress, testBootSucceeded: true };
}

export function loadAuthoringJourneyProgress(scope: string, target: Storage | null = browserStorage()): AuthoringJourneyProgress {
  if (!target) return emptyAuthoringJourneyProgress();
  try {
    const raw = target.getItem(storageKey(scope));
    if (!raw) return emptyAuthoringJourneyProgress();
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return emptyAuthoringJourneyProgress();
    const manualCompleted = Array.isArray(parsed.manualCompleted)
      ? parsed.manualCompleted.filter(isManualStage)
      : [];
    return {
      mapTouched: parsed.mapTouched === true,
      databaseTouched: parsed.databaseTouched === true,
      testBootSucceeded: parsed.testBootSucceeded === true,
      manualCompleted,
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
