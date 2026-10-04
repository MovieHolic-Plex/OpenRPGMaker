// Shared by the browser, companion relay and team worker. Claims are synchronous:
// ownership is established before any await, model call or project snapshot.
export function createMapRunLocks() {
  const active = new Set();
  const listeners = new Set();
  return {
    acquire(projectKey, mapIds, owner) {
      const maps = mapIds === null ? null : new Set(mapIds);
      for (const claim of active) {
        // An older caller without project identity must not bypass known callers.
        if (projectKey !== null && claim.projectKey !== null && claim.projectKey !== projectKey) continue;
        const overlap = maps === null ? claim.maps : claim.maps === null ? maps : new Set([...maps].filter(id => claim.maps.has(id)));
        if (overlap === null || overlap.size > 0) return { ok: false, owner: claim.owner, mapIds: overlap === null ? null : [...overlap] };
      }
      const claim = { projectKey, maps, owner };
      active.add(claim);
      return { ok: true, release: () => {
        if (active.delete(claim)) queueMicrotask(() => { for (const listener of listeners) listener(); });
      } };
    },
    busy() { return active.size > 0; },
    refreshBundles(projectKey, project) {
      for (const claim of active) if (claim.maps !== null && (claim.projectKey === projectKey || claim.projectKey === null || projectKey === null)) {
        claim.maps = new Set(mapRunBundleIds(project, [...claim.maps]));
      }
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

/** Ownership includes the map's subtree: the existing merger accepts that bundle. */
export function mapRunBundleIds(project, mapIds) {
  const ids = new Set(mapIds);
  const roots = new Set(mapIds);
  const visit = (node, inherited, seen) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    const owned = inherited || roots.has(node.mapId);
    if (owned && typeof node.mapId === "string") ids.add(node.mapId);
    for (const child of node.children ?? []) visit(child, owned, seen);
  };
  visit(project?.mapTree, false, new Set());
  return [...ids];
}

/** Unrestricted and team requests can touch any map, including maps created later. */
export function mapRunScope(request) {
  if (request.mode === "team" || !request.mapIds?.length || (request.scopeStrict === false && !request.mapBundleMerge)) return null;
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
