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
import type { GameMap, MapId, MapTreeNode, Project } from "@/project/types";
import { playAudioCommand, stopAudioChannel } from "@/player/audio";
import { systemAudioOverride } from "@/player/systemAudioSlots";
import type { M2RuntimeState } from "@/project/sessionRuntimeTypes";

/** 맵 BGM 해석 결과. */
export type MapBgmResolution =
  | { readonly kind: "play"; readonly resourceId: string; readonly fadeInMs?: number }
  | { readonly kind: "silence" };

type BgmProject = Pick<Project, "maps" | "mapTree" | "system">;

/**
 * system.defaultBgmResourceId 가 없는 프로젝트의 최종 폴백.
 *
 * 왜 필요한가(실측): 기존 프로젝트는 전부 동결된 JSON fixture/저장본이라 이 필드를 영원히 갖지 않는다.
 * 폴백이 없으면 "이 필드를 채운 새 프로젝트" 만 소리가 나고 기존 게임은 계속 무음이다.
 * 무음을 원하는 맵은 bgm.mode="none" 으로 명시할 수 있으므로 침묵의 탈출구는 남아 있다.
 */
export const FALLBACK_BGM_RESOURCE_ID = "cc0-bgm-field";

/**
 * mapTree 에서 mapId 의 조상 체인을 뿌리 방향으로 반환한다(가까운 부모부터).
 * 트리에 없는 맵(고아 맵)은 빈 배열 — 그러면 프로젝트 기본으로 떨어진다.
 */
export function mapAncestorIds(tree: MapTreeNode, mapId: MapId): readonly MapId[] {
  const path: MapId[] = [];
  const walk = (node: MapTreeNode): boolean => {
    if (node.mapId === mapId) return true;
    for (const child of node.children) {
      if (!walk(child)) continue;
      path.push(node.mapId);
      return true;
    }
    return false;
  };
  walk(tree);
  return path;
}

/** 한 맵의 bgm 설정이 "결정"인지(custom 유효 / none) 판단해 결과로 바꾼다. 미결정이면 null. */
function decide(map: GameMap | undefined): MapBgmResolution | null {
  const setting = map?.bgm;
  if (!setting) return null;
  if (setting.mode === "none") return { kind: "silence" };
  if (setting.mode !== "custom") return null;
  const resourceId = setting.resourceId?.trim();
  if (!resourceId) return null;
  return { kind: "play", resourceId, fadeInMs: setting.fadeInMs };
}

/** 맵 진입 시 어떤 BGM 이어야 하는지 결정한다. */
export function resolveMapBgm(
  project: BgmProject,
  mapId: MapId,
  overrides: { readonly defaultBgmResourceId?: string } = {},
): MapBgmResolution {
  const own = decide(project.maps[mapId]);
  if (own) return own;
  for (const ancestorId of mapAncestorIds(project.mapTree, mapId)) {
    const inherited = decide(project.maps[ancestorId]);
    if (inherited) return inherited;
  }
  const fallback =
    overrides.defaultBgmResourceId?.trim() || project.system.defaultBgmResourceId?.trim() || FALLBACK_BGM_RESOURCE_ID;
  return fallback ? { kind: "play", resourceId: fallback } : { kind: "silence" };
}

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
