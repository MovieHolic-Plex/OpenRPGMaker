import { sharedContentSnapshot } from './sharedContent';
import type { SharedContentLibrary } from './sharedContentSchema';
import type { GameMap, Project, TilesetDef } from './types';
import { isPassableLanding } from './collision';
export type SharedSceneLinks = 'reject' | 'omit' | 'include';
type Source = {
    library: SharedContentLibrary;
    libraryId: string;
    id: string;
};
function source(id: string): Source {
    const matches = Object.entries(sharedContentSnapshot().libraries).filter(([, lib]) => Object.hasOwn(lib.places, id));
    if (matches.length !== 1)
        throw new Error(matches.length ? 'Ambiguous shared scene ID' : 'Shared scene not found');
    return { library: matches[0][1], libraryId: matches[0][0], id };
}
export function sharedSceneList(query = '', libraryId?: string) {
    const q = query.trim().toLocaleLowerCase();
    return Object.entries(sharedContentSnapshot().libraries).filter(([id]) => !libraryId || id === libraryId).flatMap(([libraryId, lib]) => Object.values(lib.places).map(p => ({
        id: p.id, name: p.name, libraryId, kind: lib.regions?.[p.id] ? 'region' : 'place', children: p.children.length,
        hasSavedEvents: !!lib.maps[p.id], referenceKind: lib.regions?.[p.id] ? 'region' : 'place',
        reviewPending: p.referenceDocuments?.some(c => c.id === 'review-pending') ?? false, tags: p.tags,
    }))).filter(p => !q || [p.id, p.name, ...(p.tags ?? [])].join(' ').toLocaleLowerCase().includes(q));
}
function transfers(value: unknown): {
    mapId: string;
    x: number;
    y: number;
}[] {
    if (Array.isArray(value))
        return value.flatMap(transfers);
    if (!value || typeof value !== 'object')
        return [];
    const v = value as Record<string, unknown>;
    if (v.kind === 'transfer' && typeof v.mapId === 'string')
        return [{ mapId: v.mapId, x: Number(v.x), y: Number(v.y) }];
    return Object.values(v).flatMap(transfers);
}
function sceneMaps(s: Source, links: SharedSceneLinks) {
    const maps = new Map<string, GameMap>(), visited = new Set<string>();
    const visit = (id: string) => {
        if (visited.has(id))
            return;
        visited.add(id);
        const place = s.library.places[id];
        if (!place && !s.library.maps[id])
            throw new Error('Missing shared child ' + id);
        if (s.library.maps[id])
            maps.set(id, structuredClone(s.library.maps[id]));
        else if (place?.exterior) {
            const ts = s.library.tilesets[place.exterior.tilesetId], kit = ts?.structureKits?.find(k => k.id === place.exterior!.kitId);
            if (!kit || kit.kind !== 'section')
                throw new Error('Missing full scene raster ' + id);
            maps.set(id, { id, name: place.name, width: kit.width, height: kit.height, tileSize: kit.tileSize ?? ts.tileSize, tilesetId: ts.id,
                lowerTiles: kit.rows.flatMap(r => [...r.tiles]), upperTiles: kit.rows.flatMap(r => [...(r.upperTiles ?? Array(kit.width).fill(-1))]), events: [] });
        }
        for (const child of place?.children ?? []) {
            if (child.source.kind !== 'place')
                throw new Error('Shared scene requires a saved place child');
            visit(child.source.id);
        }
    };
    visit(s.id);
    if (links === 'include')
        for (const map of maps.values())
            for (const t of transfers(map.events))
                visit(t.mapId);
    if (!maps.size)
        throw new Error('Scene contains no authored maps');
    const external = [...maps.values()].flatMap(m => transfers(m.events).filter(t => !maps.has(t.mapId)).map(t => ({ from: m.id, ...t })));
    // Legacy flat commands and pages can contain the same transfer; report it once.
    const unique = [...new Map(external.map(t => [JSON.stringify(t), t])).values()];
    if (links === 'reject' && unique.length)
        throw new Error('External map links exist; explicitly choose links=include or links=omit');
    return { maps, external: unique };
}
export function inspectSharedScene(id: string, links: SharedSceneLinks = 'omit') {
    const s = source(id), data = sceneMaps(s, links), place = s.library.places[id];
    return { id, name: place.name, libraryId: s.libraryId, revision: sharedContentSnapshot().revision, links,
        maps: [...data.maps.values()].map(m => ({ id: m.id, name: m.name, width: m.width, height: m.height, tilesetId: m.tilesetId, events: m.events.length })),
        externalLinks: data.external, staticOnly: [...data.maps.values()].every(m => !m.events.length),
        reference: { kind: s.library.regions?.[id] ? 'region' : 'place', id },
        limitations: ['Exact authored example; editable after creation. Not a generator for arbitrary floor plans.',
            ...(data.external.length ? ['links=omit removes whole events that reference an external map; omitted links are reported, never left dangling.'] : []),
            ...(place.referenceDocuments?.filter(c => c.id === 'review-pending').map(c => c.description) ?? [])] };
}
export function buildSharedScene(project: Project, id: string, namespace: string, revision: string, links: SharedSceneLinks, setStart = false) {
    if (revision !== sharedContentSnapshot().revision)
        throw new Error('Shared catalog changed. Inspect the scene again.');
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,47}$/.test(namespace) || ['constructor', 'prototype', '__proto__'].includes(namespace))
        throw new Error('Use a fresh safe namespace (1–48 letters/digits/_/-).');
    if (!['reject', 'omit', 'include'].includes(links))
        throw new Error('Invalid links policy');
    const limitations = inspectSharedScene(id, links).limitations;
    const s = source(id), { maps, external } = sceneMaps(s, links), key = (value: string) => `${namespace}__${value}`;
    const mapIds = Object.fromEntries([...maps.keys()].map(id => [id, key(id)]));
    for (const target of Object.values(mapIds))
        if (Object.hasOwn(project.maps, target))
            throw new Error('Map ID exists: ' + target);
    const copiedTilesets: Record<string, TilesetDef> = {}, copiedAssets: Project['assets']['uploaded'] = {}, visiting = new Set<string>();
    const copyAsset = (id: string) => {
        const target = key(id);
        if (copiedAssets[target])
            return target;
        if (Object.hasOwn(project.assets.uploaded, target))
            throw new Error('Asset ID exists: ' + target);
        const asset = s.library.assets[id];
        if (!asset?.dataUrl)
            throw new Error('User-local asset is not installed: ' + id);
        copiedAssets[target] = { ...structuredClone(asset), id: target };
        return target;
    };
    const copyTileset = (id: string) => {
        const target = key(id);
        if (copiedTilesets[target])
            return target;
        if (Object.hasOwn(project.tilesets, target))
            throw new Error('Tileset ID exists: ' + target);
        if (visiting.has(id))
            throw new Error('Tileset reference cycle');
        visiting.add(id);
        const original = s.library.tilesets[id];
        if (!original)
            throw new Error('Missing scene tileset ' + id);
        const t = structuredClone(original);
        t.id = target;
        if (t.image.type === 'uploaded')
            t.image = { type: 'uploaded', id: copyAsset(t.image.id) };
        if (t.referenceSourceTilesetId)
            t.referenceSourceTilesetId = copyTileset(t.referenceSourceTilesetId);
        else {
            // Persist identity for the next assistant turn/reopened project without
            // consuming a category slot or adding documents to a shared pointer.
            const identity = `독립 장면 사본: 문서의 공용 tilesetId ${id}는 이 프로젝트에서 ${target}이다. 타일 번호·그림·통행은 동일하다. 원본 장면 ${s.id}, 공용 revision ${revision}.\n\n`;
            const first = t.referenceDocuments?.flatMap(c => c.documents)[0];
            if (first) first.markdown = identity + first.markdown;
        }
        copiedTilesets[target] = t;
        visiting.delete(id);
        return target;
    };
    const rewrite = (value: unknown): unknown => {
        if (Array.isArray(value))
            return value.map(rewrite);
        if (!value || typeof value !== 'object')
            return value;
        const v = value as Record<string, unknown>;
        if (v.type === 'uploaded' && typeof v.id === 'string')
            return { ...v, id: copyAsset(v.id) };
        return Object.fromEntries(Object.entries(v).map(([k, v]) => [k, k === 'mapId' && typeof v === 'string' && mapIds[v] ? mapIds[v] : rewrite(v)]));
    };
    const imported: Record<string, GameMap> = {}, omittedEvents: {
        mapId: string;
        eventId: string;
        destinations: string[];
    }[] = [];
    for (const original of maps.values()) {
        const tileId = copyTileset(original.tilesetId);
        const events = original.events.filter(e => {
            const missing = transfers(e).filter(t => !maps.has(t.mapId));
            if (missing.length) {
                omittedEvents.push({ mapId: mapIds[original.id], eventId: e.id, destinations: [...new Set(missing.map(t => t.mapId))] });
                return false;
            }
            return true;
        });
        const m = rewrite({ ...original, events }) as GameMap;
        m.id = mapIds[original.id];
        m.tilesetId = tileId;
        for (const e of m.events) {
            e.id = key(e.id);
            for (const p of e.pages ?? [])
                p.id = key(p.id);
        }
        if (m.lowerTiles.length !== m.width * m.height || m.upperTiles.length !== m.width * m.height)
            throw new Error('Incomplete scene raster');
        for (const tile of [...m.lowerTiles, ...m.upperTiles])
            if (!Number.isInteger(tile) || tile < -1 || tile >= copiedTilesets[tileId].count)
                throw new Error('Scene tile out of range');
        imported[m.id] = m;
    }
    const candidate = { ...project, maps: { ...project.maps, ...imported }, tilesets: { ...project.tilesets, ...copiedTilesets }, assets: { ...project.assets, uploaded: { ...project.assets.uploaded, ...copiedAssets } } };
    for (const m of Object.values(imported))
        for (const t of transfers(m.events)) {
            const dest = candidate.maps[t.mapId];
            if (!dest || !isPassableLanding(candidate, dest, t.x, t.y))
                throw new Error(`Blocked or missing transfer destination ${t.mapId} (${t.x},${t.y})`);
        }
    const rootId = Object.values(mapIds)[0], root = imported[rootId];
    const sourceEntry = Object.values(s.library.maps).flatMap(m => transfers(m.events)).find(t => mapIds[t.mapId] === rootId && isPassableLanding(candidate, root, t.x, t.y));
    const port = s.library.places[root.id.replace(namespace + '__', '')]?.ports.find(p => isPassableLanding(candidate, root, p.x, p.y));
    const index = root.lowerTiles.findIndex((_t, i) => isPassableLanding(candidate, root, i % root.width, Math.floor(i / root.width)));
    const spawn = sourceEntry ? { x: sourceEntry.x, y: sourceEntry.y } : port ? { x: port.x, y: port.y } : index >= 0 ? { x: index % root.width, y: Math.floor(index / root.width) } : null;
    if (!spawn)
        throw new Error('Scene has no passable start cell');
    // Publish only after all dependency, collision and namespace checks have passed.
    Object.assign(project.maps, imported);
    Object.assign(project.tilesets, copiedTilesets);
    Object.assign(project.assets.uploaded, copiedAssets);
    const tree = { mapId: rootId, children: Object.values(mapIds).slice(1).map(mapId => ({ mapId, children: [] })) };
    if (project.maps[project.mapTree.mapId])
        project.mapTree.children.push(tree);
    else
        project.mapTree = tree;
    if (setStart) {
        project.startMapId = rootId;
        project.startPos = spawn;
    }
    return { sourceId: id, revision, mapIds, tilesetIds: Object.keys(copiedTilesets), tilesetIdMapping: Object.fromEntries(Object.keys(copiedTilesets).map(target => [target.slice(namespace.length + 2), target])), rootMapId: rootId, spawn, omittedEvents, externalLinks: external,
        maps: Object.values(imported).map(m => ({ id: m.id, name: m.name, width: m.width, height: m.height, events: m.events.length })),
        limitations };
}
