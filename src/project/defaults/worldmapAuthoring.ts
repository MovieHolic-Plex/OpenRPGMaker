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
    const cells = own ? sheet.tiles.map((_, i) => ({sourceTile: i, targetTile: i}))
        : (t.tileGrafts ?? []).filter(g => g.sourceChipset === WORLDMAP_AUTHORING_TEXTURE);
    let changed = false;
    for (const {sourceTile, targetTile} of cells) {
        const kind = sheet.tiles[sourceTile]?.kind;
        if (!kind || !['sea', 'river', 'lava', 'toxic'].includes(kind)) continue;
        const meta = t.tileMeta?.[targetTile];
        if (meta?.source !== 'bundled-default') continue;
        const pass = t.passability[targetTile];
        if (!pass || pass.up || pass.down || pass.left || pass.right) {
            t.passability[targetTile] = {up: false, down: false, left: false, right: false};
            meta.passage = 'solid';
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
            : b.kind === 'river' ? ['river', 'sea'].includes(t.kind)
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
    if (t.autotileGroups?.some(g => g.id === 'worldmap-brush-grass-sea'))
        return ensureWaterFlags(t);
    const own = t.image.type === 'bundled' && t.image.id === WORLDMAP_AUTHORING_TEXTURE;
    const mapping = new Map<number, number>();
    const existing = new Map(t.tileGrafts?.filter(g => g.sourceChipset === WORLDMAP_AUTHORING_TEXTURE).map(g => [g.sourceTile, g.targetTile]));
    for (let tile = 0; tile < sheet.count; tile++) {
        const before = own ? tile : existing.get(tile), target = before ?? t.count++;
        if (!own && before === undefined)
            (t.tileGrafts ??= []).push({ targetTile: target, sourceChipset: WORLDMAP_AUTHORING_TEXTURE, sourceTile: tile });
        mapping.set(tile, target);
        const m = sheet.tiles[tile]!;
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
    t.autotileGroups = [...(t.autotileGroups ?? []), ...added];
    t.tileGroups = [...(t.tileGroups ?? []), ...sheet.brushes.map(b => ({ id: b.id, name: materialName(b.name, b.background), role: 'terrain' as const,
            defaultLayer: b.layer === 'upper' ? 'upper' as const : 'lower' as const, tileIds: b.tiles.map(remap),
            description: `연결 붓 · 바탕 ${b.background}`, placementRules: '대표 칸을 칠하면 이웃 연결을 계산한다. 숲·산은 위층, 길·다리는 아래층.', source: 'bundled-default' as const })),
        ...sheet.tiles.slice(0, 15).map((m, i) => ({ id: 'worldmap-brush-plain-' + m.kind, name: m.label, role: 'terrain' as const, defaultLayer: 'lower' as const, tileIds: [remap(i)], description: '단일 바탕 칸. 주변 연결 붓도 다시 맞춘다.', placementRules: '아래층 바탕을 채운다. 바다로 칠하면 땅을 깎는다.', source: 'bundled-default' as const }))];
    ensureWaterFlags(t);
    return true;
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
            t.tileMeta![target] = { label: icon.name, description: icon.name, defaultLayer: 'upper', passage: !bottom ? 'star' : entrance ? 'passable' : 'solid', tags: ['worldmap-icon'], source: 'bundled-default' };
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
