import catalog from '@/assets/pixelArtWorldFacilityComplementsCatalog.json';
import type { TilesetDef } from './types';
export interface FacilityComplementSource {
    id: string;
    filename: string;
    width: number;
    height: number;
    sha256: string;
    sourcePage: string;
    downloadUrl: string;
}
export interface FacilityComplementPart {
    sourceId: string;
    sourceRect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    target: {
        x: number;
        y: number;
    };
    role: string;
    mode: string;
    anchor: unknown;
}
export interface FacilityComplementRecipe {
    id: string;
    name: string;
    width: number;
    height: number;
    parts: FacilityComplementPart[];
    counterexampleParts: FacilityComplementPart[];
    facing: string;
    layer: string;
    occupiedCells: number[][];
    blockingCells: number[][];
    supportCells: number[][];
    approach: {
        x: number;
        y: number;
    };
    notes: string;
    auxiliary?: boolean;
    placementKind: string;
    errorCell: number[];
    wallRowsForExample?: number;
    wallSupportCells?: number[][];
    outputRect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    upperRows: number[][];
}
export interface FacilityComplementMap {
    id: string;
    name: string;
    width: number;
    height: number;
    lowerTiles: number[];
    upperTiles: number[];
    entry: {
        x: number;
        y: number;
    };
    approachCells: {
        x: number;
        y: number;
    }[];
    notes: string;
    rooms: unknown[];
    doorways: unknown[];
    events: unknown[];
    kind: string;
}
export interface FacilityComplementPack {
    id: string;
    name: string;
    sources: FacilityComplementSource[];
    palette: {
        tile: number;
        part: FacilityComplementPart;
        passable: boolean;
    }[];
    recipes: FacilityComplementRecipe[];
    scene: FacilityComplementMap;
    atlas: {
        width: number;
        height: number;
        columns: number;
        count: number;
    };
    coverage: {
        resolved: string[];
        remaining: string[];
    };
    sourcePage: string;
    termsUrl: string;
    credit: string;
}
export const PIXEL_ART_WORLD_FACILITY_COMPLEMENTS = catalog.packs as unknown as readonly FacilityComplementPack[];
export function facilityComplementExample(recipe: FacilityComplementRecipe) {
    const width = recipe.width / 32 + 2, height = recipe.height / 32 + 2, lowerTiles = Array<number>(width * height).fill(0), upperTiles = Array<number>(width * height).fill(-1);
    for (let y = 0; y < (recipe.wallRowsForExample ?? 0); y++) lowerTiles.fill(y === 0 ? 2 : 1, y * width, (y + 1) * width);
    recipe.upperRows.forEach((row, y) => row.forEach((v, x) => upperTiles[(y + 1) * width + x + 1] = v));
    return { width, height, lowerTiles, upperTiles, approach: { x: recipe.approach.x + 1, y: recipe.approach.y + 1 } };
}
export function createFacilityComplementTileset(pack: FacilityComplementPack, assetId: string, id: string): TilesetDef {
    const count = pack.atlas.count, t: TilesetDef = { id, name: `Pixel Art World · ${pack.name} · 조립 보충`, kind: 'custom', image: { type: 'uploaded', id: assetId }, tileSize: 32, tilesPerRow: 8, count, priority: Array.from({ length: count }, () => 'upper' as const), terrain: Array<number>(count).fill(0), passability: Array.from({ length: count }, () => ({ up: true, down: true, left: true, right: true })), tileMeta: Array.from({ length: count }, () => ({ label: '예약 빈 칸', defaultLayer: 'upper' as const, passage: 'passable' as const, source: 'imported' as const })), tileGroups: [], structureKits: [], autotileGroups: [] };
    const mark = (tile: number, label: string, passable: boolean, layer: 'lower' | 'upper') => { t.priority[tile] = layer; t.passability[tile] = { up: passable, down: passable, left: passable, right: passable }; t.tileMeta![tile] = { label, defaultLayer: layer, passage: passable ? 'passable' : 'solid', source: 'imported' }; };
    for (const p of pack.palette)
        mark(p.tile, p.passable ? '장소 바닥' : '장소 벽', p.passable, 'lower');
    for (const r of pack.recipes) {
        const blocked = new Set(r.blockingCells.map(c => c.join(',')));
        r.upperRows.forEach((row, y) => row.forEach((tile, x) => { if (tile >= 0)
            mark(tile, r.name, !blocked.has(`${x},${y}`), 'upper'); }));
        const example = facilityComplementExample(r);
        t.tileGroups!.push({ id: r.id, name: r.name, role: 'prop', defaultLayer: 'upper', sourceRect: r.outputRect, tileIds: r.upperRows.flat().filter(v => v >= 0), source: 'imported', confidence: 'high', description: r.notes, placementRules: '독립 보충 atlas 전체 배열. 기존 원본/539객체 번호와 혼용하지 않는다.', previewMap: example });
        t.structureKits!.push({ id: r.id, name: r.name, kind: 'section', width: r.outputRect.width, height: r.outputRect.height, tileSize: 32, rows: r.upperRows.map(row => ({ tiles: row.map(() => -1), upperTiles: row })), learnedFrom: 'db-authored', ai: { description: r.notes, placementRules: '기존 하위를 보존하고 비운 상위 영역에 전체 조립을 배치. sourceParts를 개별 상위 칸에 겹쳐 찍지 않는다.', role: 'prop', repeatability: 'fixed', layerHome: 'upper', tags: ['paw-loose-supplement', 'static', ...(r.auxiliary ? ['reused-support'] : [])] } });
    }
    const s = pack.scene;
    t.structureKits!.push({ id: s.id, name: s.name, kind: 'section', width: s.width, height: s.height, tileSize: 32, rows: Array.from({ length: s.height }, (_, y) => ({ tiles: s.lowerTiles.slice(y * s.width, (y + 1) * s.width), upperTiles: s.upperTiles.slice(y * s.width, (y + 1) * s.width) })), learnedFrom: 'db-authored', ai: { description: s.notes, layerHome: 'perCell', placementRules: '고정 조립 표본 전체 배열. 받침·벽/바닥 경계·출입구를 유지. 실행 이벤트가 없다.', repeatability: 'fixed', tags: ['paw-loose-supplement', 'static-place'] } });
    return t;
}
