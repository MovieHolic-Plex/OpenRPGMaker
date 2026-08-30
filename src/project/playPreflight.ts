// project/playPreflight.ts
// 플레이 부팅 전 예비검사 권위. 순수 함수 — DOM / store / Phaser / I/O 를 쓰지 않는다.
//
// 왜: `src/player/player.ts` 는 `startMapId` 를 검증 없이 Phaser 에 넘긴다. 없는 시작 맵,
// 프로젝트에 없는 타일셋 id, 빈 파티, 경계 밖·통행 불가 시작 좌표가 모두 Phaser 안쪽의
// throw / hang 으로 터진다. 여기서 **부팅 가능한 프로젝트 + 무엇을 고쳤고 무엇이 아직
// 못 노는지에 대한 타입 있는 보고서**로 바꿔 둔다. 어떤 입력에도 던지지 않는다.

import { inBounds, isPassable } from "./collision";
import { repairMapTreeOrphans } from "./mapTree";
import type { GameMap, MapId, Project } from "./types";

export type PlayPreflightRepair = { readonly code: string; readonly detail: string };
export type PlayPreflightBlocker = { readonly code: string; readonly detail: string };
export type PlayPreflightResult = {
  readonly project: Project;
  readonly repairs: readonly PlayPreflightRepair[];
  readonly blockers: readonly PlayPreflightBlocker[];
};

/** 통행 가능한 칸을 찾을 때 바깥으로 훑는 최대 반경. 맵 최대 변보다 크면 더 볼 것이 없다. */
const MAX_SCAN_RADIUS = 512;

export function preflightProjectForPlay(
  project: Project,
  startOverride?: { mapId: string; x: number; y: number },
): PlayPreflightResult {
  const draft = cloneProject(project);
  const repairs: PlayPreflightRepair[] = [];
  const blockers: PlayPreflightBlocker[] = [];

  const maps = draft.maps ?? {};
  const mapIds = Object.keys(maps);
  const tilesetIds = Object.keys(draft.tilesets ?? {});

  // 파티는 맵/타일셋과 독립이므로 차단 상황에서도 먼저 고쳐 둔다.
  repairParty(draft, repairs);

  if (mapIds.length === 0) {
    blockers.push({
      code: "no-maps",
      detail: "프로젝트에 맵이 하나도 없어 시작할 위치를 정할 수 없습니다. 맵을 하나 만들어 주세요.",
    });
    return { project: draft, repairs, blockers };
  }

  // 맵 트리 고아/죽은 루트 복구는 기존 권위를 그대로 쓴다 — 시작 맵 재배선이 트리 루트를 신뢰한다.
  if (repairMapTreeOrphans(draft)) {
    repairs.push({
      code: "map-tree-repaired",
      detail: "맵 트리에 없는 맵이나 삭제된 트리 루트를 복구했습니다.",
    });
  }

  const requestedMapId = startOverride ? startOverride.mapId : draft.startMapId;
  const resolvedMapId = resolveStartMapId(draft, requestedMapId);
  if (resolvedMapId !== requestedMapId) {
    repairs.push({
      code: "start-map-missing",
      detail: `시작 맵 «${requestedMapId || "(없음)"}» 이 프로젝트에 없어 «${resolvedMapId}» 로 재배선했습니다.`,
    });
  }
  draft.startMapId = resolvedMapId;
  const startMap = maps[resolvedMapId]!;

  if (tilesetIds.length === 0) {
    blockers.push({
      code: "no-tilesets",
      detail: "프로젝트에 타일셋이 하나도 없어 맵의 통행 판정을 할 수 없습니다. 타일셋을 하나 추가해 주세요.",
    });
    // 통행 판정 자체가 불가능하므로 좌표는 경계 안으로만 접어 둔다.
    draft.startPos = clampToBounds(startMap, requestedStartPos(draft, startOverride));
    return { project: draft, repairs, blockers };
  }

  if (!draft.tilesets[startMap.tilesetId]) {
    const substitute = tilesetIds[0]!;
    repairs.push({
      code: "start-map-tileset-missing",
      detail: `시작 맵의 타일셋 «${startMap.tilesetId}» 이 프로젝트에 없어 «${substitute}» 로 대체했습니다.`,
    });
    startMap.tilesetId = substitute;
  }

  const requested = requestedStartPos(draft, startOverride);
  if (!isPassable(draft, startMap, requested.x, requested.y)) {
    const relocated = findNearestPassable(draft, startMap, requested);
    if (relocated) {
      repairs.push({
        code: "start-position-unreachable",
        detail: `시작 좌표 (${requested.x}, ${requested.y}) 가 맵 밖이거나 통행 불가라 (${relocated.x}, ${relocated.y}) 로 옮겼습니다.`,
      });
      draft.startPos = relocated;
    } else {
      blockers.push({
        code: "no-passable-start-tile",
        detail: `시작 맵 «${startMap.id}» 에 통행 가능한 칸이 하나도 없습니다. 바닥 타일을 통행 가능하게 고쳐 주세요.`,
      });
      draft.startPos = clampToBounds(startMap, requested);
    }
  } else {
    draft.startPos = { x: requested.x, y: requested.y };
  }

  return { project: draft, repairs, blockers };
}

function cloneProject(project: Project): Project {
  return structuredClone(project);
}

function requestedStartPos(
  draft: Project,
  startOverride?: { mapId: string; x: number; y: number },
): { x: number; y: number } {
  if (startOverride) return { x: Math.trunc(startOverride.x), y: Math.trunc(startOverride.y) };
  const pos = draft.startPos;
  const x = Number.isFinite(pos?.x) ? Math.trunc(pos!.x) : 0;
  const y = Number.isFinite(pos?.y) ? Math.trunc(pos!.y) : 0;
  return { x, y };
}

/** 없는 시작 맵은 트리 루트 → 첫 맵 순으로 재배선한다(mapDeletion 의 규칙과 같다). */
function resolveStartMapId(draft: Project, requestedMapId: string): MapId {
  if (requestedMapId && draft.maps[requestedMapId]) return requestedMapId;
  const rootId = draft.mapTree?.mapId;
  if (rootId && draft.maps[rootId]) return rootId;
  return Object.keys(draft.maps)[0]!;
}

/** 빈 파티 / 없는 액터 id 는 첫 액터로 시드한다. 액터가 없으면 손대지 않는다. */
function repairParty(draft: Project, repairs: PlayPreflightRepair[]): void {
  const actors = draft.database?.actors ?? [];
  const actorIds = new Set(actors.map((actor) => actor.id).filter(Boolean));
  const current = draft.session?.partyActorIds ?? [];
  const kept = current.filter((id) => actorIds.has(id));
  if (kept.length === current.length && kept.length > 0) return;
  if (kept.length === 0) {
    const seed = actors.find((actor) => actor.id)?.id;
    if (!seed) return;
    draft.session = { ...draft.session, partyActorIds: [seed] };
    repairs.push({
      code: "party-empty",
      detail: `시작 파티가 비어 있거나 없는 액터만 가리켜 «${seed}» 한 명으로 채웠습니다.`,
    });
    return;
  }
  draft.session = { ...draft.session, partyActorIds: kept };
  repairs.push({
    code: "party-empty",
    detail: "시작 파티에서 프로젝트에 없는 액터 id 를 제거했습니다.",
  });
}

function clampToBounds(map: GameMap, pos: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(pos.x, Math.max(0, map.width - 1))),
    y: Math.max(0, Math.min(pos.y, Math.max(0, map.height - 1))),
  };
}

/** 요청 좌표에서 체비쇼프 링을 바깥으로 훑어 첫 통행 가능 칸을 찾는다. */
function findNearestPassable(
  project: Project,
  map: GameMap,
  from: { x: number; y: number },
): { x: number; y: number } | null {
  const base = clampToBounds(map, from);
  if (inBounds(map, base.x, base.y) && isPassable(project, map, base.x, base.y)) return base;
  const maxRadius = Math.min(MAX_SCAN_RADIUS, Math.max(map.width, map.height));
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = base.x + dx;
        const y = base.y + dy;
        if (!inBounds(map, x, y)) continue;
        if (isPassable(project, map, x, y)) return { x, y };
      }
    }
  }
  return null;
}
