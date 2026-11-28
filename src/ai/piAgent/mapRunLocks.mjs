// Shared by the browser, companion relay and team worker. Claims are synchronous:
// ownership is established before any await, model call or project snapshot.
export function normalizeMapRunRegion(region) {
  if (!region || typeof region !== "object") return null;
  const mapId = typeof region.mapId === "string" && region.mapId.trim() ? region.mapId : null;
  const x = region.x;
  const y = region.y;
  const width = region.width ?? region.w;
  const height = region.height ?? region.h;
  if (!mapId || ![x, y, width, height].every(Number.isInteger)) return null;
  if (width < 1 || height < 1) return null;
  return { mapId, x, y, width, height };
}

export function mapRunRegionsOverlap(a, b) {
  if (!a || !b || a.mapId !== b.mapId) return false;
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function mapRunRegion(request) {
  if (!request || request.mode === "team") return null;
  return normalizeMapRunRegion(request.region);
}

export function createMapRunLocks() {
  const active = new Set();
  const listeners = new Set();
  return {
    // independent: 이 차지의 묶음에서 빼는 맵(따로 맡은 세계 노드, mapBundle.ts MapBundleResult.independentMapIds). 비우면 부분 트리 전부.
    // region: 같은 맵이라도 겹치지 않는 드래그 영역끼리는 동시에 실행할 수 있게 사각형 단위로 잠근다.
    acquire(projectKey, mapIds, owner, independent = [], region = null) {
      const normalizedRegion = normalizeMapRunRegion(region);
      const maps = mapIds === null ? null : new Set(mapIds);
      const lockRegion = normalizedRegion && maps !== null && maps.size === 1 && maps.has(normalizedRegion.mapId)
        ? normalizedRegion
        : null;
      for (const claim of active) {
        // An older caller without project identity must not bypass known callers.
        if (projectKey !== null && claim.projectKey !== null && claim.projectKey !== projectKey) continue;
        const overlap = maps === null ? claim.maps : claim.maps === null ? maps : new Set([...maps].filter(id => claim.maps.has(id)));
        if (overlap === null || overlap.size > 0) {
          // 두 실행 모두 같은 단일 맵의 영역을 잠갔고 사각형이 겹치지 않으면 동시 실행을 허용한다.
          if (lockRegion && claim.region && lockRegion.mapId === claim.region.mapId
            && overlap !== null && overlap.size === 1 && overlap.has(lockRegion.mapId)
            && !mapRunRegionsOverlap(claim.region, lockRegion)) {
            continue;
          }
          return { ok: false, owner: claim.owner, mapIds: overlap === null ? null : [...overlap] };
        }
      }
      const claim = { projectKey, maps, owner, independent, region: lockRegion };
      active.add(claim);
      return { ok: true, release: () => {
        if (active.delete(claim)) queueMicrotask(() => { for (const listener of listeners) listener(); });
      } };
    },
    busy() { return active.size > 0; },
    refreshBundles(projectKey, project) {
      for (const claim of active) if (claim.maps !== null && claim.region === null && (claim.projectKey === projectKey || claim.projectKey === null || projectKey === null)) {
        claim.maps = new Set(mapRunBundleIds(project, [...claim.maps], claim.independent));
      }
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

/**
 * Ownership includes the map's subtree: the existing merger accepts that bundle.
 * Maps in `independent` (other than the requested roots) start their own bundle, so a parent's ownership stops there.
 */
export function mapRunBundleIds(project, mapIds, independent = []) {
  const ids = new Set(mapIds);
  const roots = new Set(mapIds);
  const separate = new Set(independent.filter(id => !roots.has(id)));
  const visit = (node, inherited, seen) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    // A separately owned map ends the parent's ownership; a requested root below it still owns its own subtree.
    const owned = roots.has(node.mapId) || (inherited && !separate.has(node.mapId));
    if (owned && typeof node.mapId === "string") ids.add(node.mapId);
    for (const child of node.children ?? []) visit(child, owned, seen);
  };
  visit(project?.mapTree, false, new Set());
  return [...ids];
}

/** Unrestricted and team requests can touch any map, including maps created later. */
export function mapRunScope(request) {
  const region = mapRunRegion(request);
  if (region) return [region.mapId];
  if (request.mode === "team" || !request.mapIds?.length) return null;
  return mapRunBundleIds(request.project, request.mapIds);
}

/** One root request already owns its descendants. Repeated/contained targets do not spawn workers. */
export function independentMapRunRoots(project, mapIds) {
  const unique = [...new Set(mapIds)];
  return unique.filter(id => !unique.some(other => other !== id && mapRunBundleIds(project, [other]).includes(id)));
}

/** An early failure must not retire ownership while another child is still running. */
export async function settleMapRuns(runs) {
  const settled = await Promise.allSettled(runs);
  return settled.map(result => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
}
