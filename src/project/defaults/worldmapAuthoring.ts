import sheet from '@/assets/worldmapAuthoringSheet.json';
import type { AutotileGroup, TilesetDef } from '../types';
import { WORLDMAP_SELECTED_TEXTURE, WORLDMAP_SELECTED_ICONS } from './worldmapSelected';
export const WORLDMAP_AUTHORING_ID = 'worldmap_authoring';
export const WORLDMAP_AUTHORING_TEXTURE = 'tex_worldmap_authoring';
export const WORLDMAP_BRUSHES = sheet.brushes;
const BACKGROUND_NAMES: Record<string, string> = { grass: '초원', sand: '사막', snow: '설원' };
function materialName(name: string, background: string): string {
    return BACKGROUND_NAMES[background] ? `${name} · ${BACKGROUND_NAMES[background]}` : name;
}
/** Refresh only bundle-owned liquid flags, including prototypes saved before deployment. */
function ensureWaterFlags(t: TilesetDef): boolean {
    const own = t.image.type === 'bundled' && t.image.id === WORLDMAP_AUTHORING_TEXTURE;
    const grafts = t.tileGrafts ?? [];
    const authored = grafts.filter(g => g.sourceChipset === WORLDMAP_AUTHORING_TEXTURE);
    const occupied = new Set(grafts.map(g => g.targetTile));
    const cells = own ? [...sheet.tiles.flatMap((_, i) => occupied.has(i) ? [] : [{sourceTile: i, targetTile: i}]), ...authored] : authored;
    let changed = false;
    for (const {sourceTile, targetTile} of cells) {
        const kind = sheet.tiles[sourceTile]?.kind;
        if (!kind || !['sea', 'river', 'lava', 'toxic'].includes(kind) && !kind.startsWith('bridge-')) continue;
        const meta = t.tileMeta?.[targetTile];
        if (meta?.source !== 'bundled-default') continue;
        const pass = t.passability[targetTile];
        const horizontal = kind === 'bridge-horizontal', vertical = kind === 'bridge-vertical';
        const expected = {up: vertical, down: vertical, left: horizontal, right: horizontal};
        if (!pass || JSON.stringify(pass) !== JSON.stringify(expected)) {
            t.passability[targetTile] = expected;
            meta.passage = horizontal || vertical ? 'passable' : 'solid';
            changed = true;
        }
        if (['sea', 'river'].includes(kind) && !meta.tags?.includes('water')) {
            meta.tags = [...(meta.tags ?? []), 'water'];
            changed = true;
        }
    }
    return changed;
}
function groups(remap: (tile: number) => number): AutotileGroup[] {
    return sheet.brushes.filter(b => b.variantMap).map<AutotileGroup>(b => {
        const forests = ['forest', 'conifer', 'jungleforest', 'deadforest', 'snowforest'];
        const mountains = ['mountain', 'snowmountain', 'volcano', 'mesa'];
        // Cross-background paths join. River mouths meet the sea; coasts meet all land.
        const connects = sheet.tiles.flatMap((t, i) => (b.background === 'sea'
            ? t.layer === 'lower' && !['sea', 'river', 'lava', 'toxic'].includes(t.kind)
            : b.kind === 'river' || b.kind.startsWith('bridge-') ? ['river', 'sea'].includes(t.kind) || t.kind.startsWith('bridge-')
                : b.kind === 'road' ? t.kind === 'road' || t.kind.startsWith('bridge-')
                    : forests.includes(b.kind) ? forests.includes(t.kind)
                        : mountains.includes(b.kind) ? mountains.includes(t.kind) : t.kind === b.kind) ? [remap(i)] : []);
        return { id: b.id, name: materialName(b.name, b.background), neighborhood: b.neighborhood === 4 ? 4 : 8,
            layer: b.layer === 'upper' ? 'upper' : 'lower', memberTileIds: b.tiles.map(remap), connectTileIds: connects,
            variantMap: Object.fromEntries(Object.entries(b.variantMap!).map(([mask, tile]) => [mask, remap(tile)])) };
    });
}
/** Append-only: original raster materials and every authored cell keep their IDs. */
export function attachWorldmapAuthoringBrushes(t: TilesetDef): boolean {
    let changed = false;
    const own = t.image.type === 'bundled' && t.image.id === WORLDMAP_AUTHORING_TEXTURE;
    const mapping = new Map<number, number>();
    const existing = new Map(t.tileGrafts?.filter(g => g.sourceChipset === WORLDMAP_AUTHORING_TEXTURE).map(g => [g.sourceTile, g.targetTile]));
    for (let tile = 0; tile < sheet.count; tile++) {
        // New source frames may overlap an existing atlas's appended icon grafts.
        // In that case append an authoring graft; never renumber or replace an icon.
        const occupied = t.tileGrafts?.some(g => g.targetTile === tile);
        const before = existing.get(tile) ?? (own && !occupied ? tile : undefined), target = before ?? t.count++;
        if (before === undefined) {
            (t.tileGrafts ??= []).push({ targetTile: target, sourceChipset: WORLDMAP_AUTHORING_TEXTURE, sourceTile: tile });
            changed = true;
        }
        if (own && target >= t.count) { t.count = target + 1; changed = true; }
        mapping.set(tile, target);
        const m = sheet.tiles[tile]!;
        if (t.tileMeta?.[target]) continue;
        changed = true;
        t.passability[target] = { up: m.walkable, down: m.walkable, left: m.walkable, right: m.walkable };
        t.priority[target] = m.layer === 'upper' ? 'upper' : 'lower';
        t.terrain[target] = 0;
        (t.tileMeta ??= [])[target] = { label: materialName(m.label, m.background), description: '연결 붓: 이웃에 맞춰 경계·모서리·교차로를 고른다.',
            defaultLayer: m.layer === 'upper' ? 'upper' : 'lower', passage: m.walkable ? 'passable' : 'solid',
            tags: ['worldmap-brush', m.kind, m.background], source: 'bundled-default' };
    }
    const remap = (tile: number) => mapping.get(tile)!;
    const added = groups(remap);
    const historical = (t.tileMeta ?? []).flatMap((m, i) => m.tags?.includes('worldmap-material') ? [{ i, label: m.label ?? '' }] : []);
    for (const g of added)
        if (g.id.endsWith('-sea'))
            g.connectTileIds!.push(...historical.filter(m => !['바다', '강', '용암', '독수'].includes(m.label)).map(m => m.i));
    t.autotileGroups ??= [];
    for (const g of added) {
        const before = t.autotileGroups.find(old => old.id === g.id);
        if (!before) { t.autotileGroups.push(g); changed = true; }
        else if (JSON.stringify(before.memberTileIds) === JSON.stringify(g.memberTileIds)
            && JSON.stringify(before.variantMap) === JSON.stringify(g.variantMap)
            && JSON.stringify(before.connectTileIds) !== JSON.stringify(g.connectTileIds)) {
            before.connectTileIds = g.connectTileIds; changed = true;
        }
    }
    const paletteGroups = [...sheet.brushes.map(b => ({ id: b.id, name: materialName(b.name, b.background), role: 'terrain' as const,
            defaultLayer: b.layer === 'upper' ? 'upper' as const : 'lower' as const, tileIds: b.tiles.map(remap),
            description: `연결 붓 · 바탕 ${b.background}`, placementRules: '대표 칸을 칠하면 이웃 연결을 계산한다. 숲·산은 위층, 길·다리는 아래층.', source: 'bundled-default' as const })),
        ...sheet.tiles.slice(0, 15).map((m, i) => ({ id: 'worldmap-brush-plain-' + m.kind, name: m.label, role: 'terrain' as const, defaultLayer: 'lower' as const, tileIds: [remap(i)], description: '단일 바탕 칸. 주변 연결 붓도 다시 맞춘다.', placementRules: '아래층 바탕을 채운다. 바다로 칠하면 땅을 깎는다.', source: 'bundled-default' as const }))];
    t.tileGroups ??= [];
    for (const g of paletteGroups) {
        const before = t.tileGroups.find(old => old.id === g.id);
        if (!before) { t.tileGroups.push(g); changed = true; }
        else if (before.source === 'bundled-default' && JSON.stringify(before.tileIds) !== JSON.stringify(g.tileIds)) {
            before.tileIds = g.tileIds; changed = true;
        }
    }
    return ensureWaterFlags(t) || changed;
}
export function createWorldmapAuthoringTileset(): TilesetDef {
    const t: TilesetDef = { id: WORLDMAP_AUTHORING_ID, name: '월드맵 · 연결 지형 붓', family: 'worldmap-kit', kind: 'custom',
        image: { type: 'bundled', id: WORLDMAP_AUTHORING_TEXTURE }, tileSize: 16, tilesPerRow: sheet.tilesPerRow, count: sheet.count,
        priority: [], passability: [], terrain: [], referenceSourceTilesetId: 'worldmap_selected' };
    attachWorldmapAuthoringBrushes(t);
    for (const icon of WORLDMAP_SELECTED_ICONS.filter(i => i.theme === 'fantasy')) {
        const rows = icon.rows.map((row, dy) => row.map((sourceTile, dx) => {
            const target = t.count++, bottom = dy === icon.height - 1, entrance = bottom && dx === Math.floor(icon.width / 2), walk = !bottom || entrance;
            (t.tileGrafts ??= []).push({ targetTile: target, sourceChipset: WORLDMAP_SELECTED_TEXTURE, sourceTile });
            t.passability[target] = { up: walk, down: walk, left: walk, right: walk };
            t.priority[target] = 'upper';
            t.terrain[target] = 0;
            t.tileMeta![target] = { label: icon.name, defaultLayer: 'upper', passage: !bottom ? 'star' : entrance ? 'passable' : 'solid', tags: ['worldmap-icon'], source: 'bundled-default' };
            return target;
        }));
        (t.structureKits ??= []).push({ id: 'wmi-' + icon.id, name: icon.name, kind: 'section', tileSize: 16, width: icon.width, height: icon.height,
            rows: rows.map(row => ({ tiles: row.map(() => -1), upperTiles: row })), learnedFrom: 'db-authored',
            ai: { role: 'prop', repeatability: 'fixed', layerHome: 'upper', description: icon.name, placementRules: '열린 육지 위에 전체 키트로 놓는다. 이동 이벤트는 별도.' } });
    }
    return t;
}
export function ensureWorldmapAuthoringBrushes(project: {
    tilesets: Record<string, TilesetDef>;
}): boolean {
    let changed = false;
    for (const t of Object.values(project.tilesets))
        if (t.id === WORLDMAP_AUTHORING_ID || t.family === 'worldmap-kit' && t.tileGroups?.some(g => g.id.startsWith('worldmap-material-')))
            changed = attachWorldmapAuthoringBrushes(t) || changed;
    return changed;
}
