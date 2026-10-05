// player/mapBgm.ts
// 맵 진입 BGM — RM2003 Map Properties/BGM 탭 대응.
//
// 이 파일이 존재하는 이유: `GameMap.bgm` 은 타입과 에디터 UI(mapProps.ts)가 이미 있었지만
// 플레이어가 그 값을 읽는 곳이 한 군데도 없었다. 즉 맵마다 곡을 지정해도 게임은 무음이었다.
// applyMapDefaultLighting(lighting.ts:66) 이 세운 "맵 진입 시 세션에 적용" 선례를 그대로 따른다.
//
// 해석 규칙 (mode 별):
//   custom  → 지정 곡. resourceId 가 비면 지정이 없는 것으로 보고 상속으로 내려간다.
//   none    → 무음. 상속하지 않는다(명시적 침묵이 목적).
//   parent  → mapTree 부모 체인을 올라가며 첫 결정(custom/none)을 따른다. 없으면 프로젝트 기본.
//   (bgm 미지정) → parent 와 동일. project.ts 의 "없으면 프로젝트 기본 BGM" 주석과 맞춘다.
//
// 같은 곡이 이미 루프 중이면 재시작하지 않는다 — RM2K3 동작이며 audioEngine.playLoop 가
// resourceId 비교로 이미 보장한다. 그래서 맵을 오가도 음악이 끊기지 않는다.

import type { AudioCommandState } from "@/project/session";
import type { MapId, Project } from "@/project/types";
import { playAudioCommand, stopAudioChannel } from "@/player/audio";
import { systemAudioOverride } from "@/player/systemAudioSlots";
import type { M2RuntimeState } from "@/project/sessionRuntimeTypes";

import { resolveMapBgm, type BgmProject, type MapBgmResolution } from '@/project/mapMusic';
export { resolveMapBgm, mapAncestorIds, FALLBACK_BGM_RESOURCE_ID } from '@/project/mapMusic';
export type { MapBgmResolution } from '@/project/mapMusic';

/**
 * 해석 결과를 세션 오디오 상태에 반영한다(실제 재생은 호출자가 엔진에 넘긴다).
 * 세션에 기록해야 전투 진입 시 battleAudio 가 필드 BGM 을 기억/복원할 수 있고 세이브에도 실린다.
 */
export function applyMapBgmToSession(audio: AudioCommandState, resolution: MapBgmResolution): void {
  if (resolution.kind === "silence") {
    audio.bgm = undefined;
    return;
  }
  audio.bgm = { resourceId: resolution.resourceId, loop: true };
}

/** 맵 진입 시 호출 — 해석 → 세션 기록 → 엔진 재생/정지. loadMap 이 유일한 호출자다. */
export function startMapBgm(
  project: BgmProject & Pick<Project, "assets">,
  session: { audio: AudioCommandState; m2Runtime?: Pick<M2RuntimeState, "system"> },
  mapId: MapId,
): MapBgmResolution {
  const resolution = resolveMapBgm(project, mapId, {
    defaultBgmResourceId: systemAudioOverride(session.m2Runtime, "field"),
  });
  const previous = session.audio.bgm?.resourceId;
  applyMapBgmToSession(session.audio, resolution);
  if (resolution.kind === "silence") {
    // 이미 무음이면 정지 요청을 보내지 않는다 — 무음 맵을 지날 때마다 페이드 타이머가 쌓이는 것 방지.
    if (previous !== undefined) stopAudioChannel("bgm");
    return resolution;
  }
  // 같은 곡이면 엔진이 재시작을 무시한다(audioEngine.playLoop). 그래서 무조건 호출해도 안전하다.
  playAudioCommand({ resourceId: resolution.resourceId, loop: true }, project);
  return resolution;
}
