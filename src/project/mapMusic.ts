import type { GameMap, MapId, MapTreeNode, Project } from "./types";

/** 맵 BGM 해석 결과. */
export type MapBgmResolution =
  | { readonly kind: "play"; readonly resourceId: string; readonly fadeInMs?: number }
  | { readonly kind: "silence" };

export type BgmProject = Pick<Project, "maps" | "mapTree" | "system">;

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

