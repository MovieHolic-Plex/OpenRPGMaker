// 걸음 발소리 — 주인공이 한 칸을 다 걸었을 때 그 칸 지형의 발소리를 낸다.
//
// 왜(2026-10-30): 지형 기록에 「발소리」(DatabaseTerrainRecord.footstepSoundResourceId)를 고를 수 있었지만 런타임이 한 번도
// 틀지 않았다. 스토어 효과음 팩도 footstep-grass·footstep-stone … 자리로 발소리를 싣는다.
//
// 고르는 순서: 지형 기록의 발소리 → 지형 이름이 가리키는 자리(footstep-<표면>, project.system.seCues) → 없음(무음).
// 발소리가 하나도 걸려 있지 않으면 아무것도 하지 않는다 — 옛 프로젝트는 소리가 바뀌지 않는다.
// 크기는 효과음 채널(설정 메뉴 「효과음」)을 따르고, 대시처럼 빠른 걸음에서도 MIN_INTERVAL_MS 안에는 한 번만 낸다.
import { playAudioCommand } from "@/player/audio";
import { footstepCueForTerrain, projectSeCue } from "@/project/seCues";
import { terrainRecordAt, type TerrainLocation } from "@/project/terrainAt";
import type { Project } from "@/project/types";

export const FOOTSTEP_MIN_INTERVAL_MS = 180;
/** 발소리는 배경에 깔린다 — 효과음 채널 크기의 이 비율로 낸다. */
export const FOOTSTEP_VOLUME = 45;

let lastAt = -Infinity;

/** 이 칸의 발소리 리소스 id. 없으면 undefined. */
export function footstepResourceAt(project: Project, location: TerrainLocation): string | undefined {
  const terrain = terrainRecordAt(project, location)?.record;
  const own = terrain?.footstepSoundResourceId?.trim();
  if (own) return own;
  const cue = footstepCueForTerrain(terrain?.name);
  return cue ? projectSeCue(project, cue) : undefined;
}

/** 한 걸음이 끝난 칸에서 부른다. 소리를 냈으면 true. now 는 시험용. */
export function playFootstep(project: Project, location: TerrainLocation, now: number = nowMs()): boolean {
  if (now - lastAt < FOOTSTEP_MIN_INTERVAL_MS) return false;
  const resourceId = footstepResourceAt(project, location);
  if (!resourceId) return false;
  lastAt = now;
  playAudioCommand({ resourceId, loop: false, channel: "se", volume: FOOTSTEP_VOLUME }, project);
  return true;
}

/** 시험용 — 간격 기억을 지운다. */
export function resetFootstepClock(): void {
  lastAt = -Infinity;
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
