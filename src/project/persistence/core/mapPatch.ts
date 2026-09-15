import { applyAudioDescriptionDelta } from "../../audioDescriptions";
import { serialize } from "../../io";
import { validateProjectReferences } from "../../io/references";
import { readProjectV4MapMergeSnapshot } from "../../io/shape";
import { applyMonsterMetadataDelta } from "../../monsterMetadata";
import { SCHEMA_VERSION, type Project } from "../../types";
import { deserializeStoredProjectJson, repairStoredLoadFoundation } from "./loadRepair";
import { changedMapIdsBetween, changedMapTreeIdsBetween, mapSaveConflicts, mergeProjectMaps, type MapSaveConflict } from "./mapMerge";
import { projectWire, type ProjectWire } from "./projectWire";

// Map merging only needs maps/mapTree, but the audio-description and monster-metadata
// deltas compare the same remote snapshot, so those optional roots stay visible.
export type MapPatchSnapshot = Pick<Project, "maps" | "mapTree"> & Partial<Pick<Project, "audioDescriptions" | "monsterMetadata">>;

/**
 * Symmetric map comparison keeps load-compatible shape defaults without erasing
 * references before root ownership is resolved. Malformed local intermediates
 * retain the existing comparison fallback; the completed candidate must validate.
 */
export function canonicalizeForMapComparison(project: Project): MapPatchSnapshot {
  try {
    return readMapPatchSnapshot(JSON.parse(serialize(project)) as unknown);
  } catch {
    return project;
  }
}

export function readMapPatchSnapshot(value: unknown): MapPatchSnapshot {
  if (!isRecord(value) || value.version !== SCHEMA_VERSION) return deserializeStoredProjectJson(value);
  const snapshot = structuredClone(value);
  // Keep compatibility foundation changes, but never use ordinary load repair
  // to prune map references against roots that the local candidate may restore.
  repairStoredLoadFoundation(snapshot);
  return readProjectV4MapMergeSnapshot(snapshot);
}

/** 한 번의 저장 시도 동안 변하지 않는 재료. 재시도 루프 밖에서 한 번 계산한다. */
export type MapPatchChangeSet = {
  /** 이벤트 초안을 뺀 기준본. 호출자가 `projectWithoutEventDrafts` 와 legacy sprite 제거를 끝낸 것. */
  readonly baseProject: Project;
  /** 같은 처리를 끝낸 로컬 문서. */
  readonly persistedProject: Project;
  readonly canonicalBase: MapPatchSnapshot;
  readonly canonicalLocal: MapPatchSnapshot;
  readonly changedMapIds: readonly string[];
  readonly changedMapTreeIds: readonly string[];
};

export function mapPatchChangeSet(baseProject: Project, persistedProject: Project, changedMapIds?: readonly string[]): MapPatchChangeSet {
  const canonicalBase = canonicalizeForMapComparison(baseProject);
  const canonicalLocal = canonicalizeForMapComparison(persistedProject);
  return {
    baseProject,
    persistedProject,
    canonicalBase,
    canonicalLocal,
    changedMapIds: changedMapIds ?? changedMapIdsBetween(canonicalBase, canonicalLocal),
    changedMapTreeIds: changedMapTreeIdsBetween(canonicalBase.mapTree, canonicalLocal.mapTree),
  };
}

export type MapPatchPlan =
  | { readonly kind: "conflict"; readonly conflicts: readonly MapSaveConflict[] }
  | { readonly kind: "candidate"; readonly mergedProject: Project; readonly wire: ProjectWire };

/**
 * 최신 저장본 하나에 대해 충돌을 판정하고 병합 후보와 와이어를 만든다. 쓰지 않는다 —
 * 조건부 갱신(CAS)과 재시도는 어댑터의 몫이다. 어댑터마다 이 함수를 같은 순서로 부른다.
 */
export async function planMapPatch(changeSet: MapPatchChangeSet, latest: MapPatchSnapshot): Promise<MapPatchPlan> {
  const { baseProject, persistedProject, canonicalBase, canonicalLocal, changedMapIds, changedMapTreeIds } = changeSet;
  const conflicts = mapSaveConflicts(canonicalBase, canonicalLocal, latest, changedMapIds);
  if (conflicts.length > 0) return { kind: "conflict", conflicts };

  const candidate = mergeProjectMaps(latest, persistedProject, changedMapIds, changedMapTreeIds);
  const audioDescriptions = applyAudioDescriptionDelta(
    baseProject.audioDescriptions,
    persistedProject.audioDescriptions,
    latest.audioDescriptions,
  );
  // mergeProjectMaps returns a detached root; never mutate any input snapshot.
  if (audioDescriptions === undefined) delete candidate.audioDescriptions;
  else candidate.audioDescriptions = audioDescriptions;
  const monsterMetadata = applyMonsterMetadataDelta(
    baseProject.monsterMetadata,
    persistedProject.monsterMetadata,
    latest.monsterMetadata,
  );
  if (monsterMetadata === undefined) delete candidate.monsterMetadata;
  else candidate.monsterMetadata = monsterMetadata;
  // Do not let load repair silently discard invalid intended references. Only
  // the fully validated merge may enter the existing SHA-conditional write.
  validateProjectReferences(candidate);
  const mergedProject = deserializeStoredProjectJson(candidate);
  return { kind: "candidate", mergedProject, wire: await projectWire(mergedProject) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
