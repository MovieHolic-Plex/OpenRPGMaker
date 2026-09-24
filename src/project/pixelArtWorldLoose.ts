import catalog from '@/assets/pixelArtWorldLooseCatalog.json';
import type { TilesetDef } from './types';
type PixelRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export interface LooseRecipe {
    id: string;
    name: string;
    pixelRect: PixelRect;
    alphaBounds: PixelRect;
    anchor: {
        x: number;
        y: number;
    };
    placementKind: string;
    facing: string;
    notes: string;
    supportStatus: string;
    collision: string;
    outputRect?: PixelRect;
    pixelOffset?: {
        x: number;
        y: number;
    };
}
export interface LoosePack {
    id: string;
    name: string;
    filename: string;
    width: number;
    height: number;
    sha256: string;
    sourcePage: string;
    downloadUrl: string;
    termsUrl: string;
    credit: string;
    recipes: LooseRecipe[];
    holds: {
        pixelRect: PixelRect;
        reason: string;
    }[];
    atlas: {
        columns: number;
        width: number;
        height: number;
        count: number;
    };
    coverage: {
        sourceRegions: number;
        fixedObjects: number;
        sourceOnly: number;
        unassignedOpaquePixels: number;
    };
}
export const PIXEL_ART_WORLD_LOOSE: readonly LoosePack[] = catalog.packs;
export const PIXEL_ART_WORLD_LOOSE_SUPPORT = catalog.support;
export function fixedLooseRecipes(pack: LoosePack) { return pack.recipes.filter(recipe => recipe.supportStatus === 'fixed-object' && 'outputRect' in recipe); }
export function looseExample(recipe: LooseRecipe) {
    if (!('outputRect' in recipe) || !recipe.outputRect)
        throw Error('고정점/전체 조립을 검토하지 않은 원본 영역입니다.');
    const rect = recipe.outputRect, width = rect.width + 2, height = rect.height + 2;
    const lowerTiles = Array<number>(width * height).fill(0), upperTiles = Array<number>(width * height).fill(-1);
    if (recipe.placementKind === 'wall')
        for (let y = 0; y < height - 1; y++)
            for (let x = 0; x < width; x++)
                lowerTiles[y * width + x] = y === 0 ? 2 : 1;
    for (let y = 0; y < rect.height; y++)
        for (let x = 0; x < rect.width; x++)
            upperTiles[(y + 1) * width + x + 1] = (rect.y + y) * 8 + rect.x + x;
    const approach = recipe.facing === 'west' ? { x: 0, y: height - 2 } : recipe.facing === 'east' ? { x: width - 1, y: height - 2 } : { x: Math.floor(width / 2), y: recipe.facing === 'north' ? 0 : height - 1 };
    return { width, height, lowerTiles, upperTiles, approach };
}
export function createLooseTileset(pack: LoosePack, assetId: string, id: string, sourceOnly = false): TilesetDef {
    const count = sourceOnly ? pack.width * pack.height / 256 : pack.atlas.count;
    const t: TilesetDef = { id, name: `Pixel Art World · ${pack.name}${sourceOnly ? ' · 원본 참고' : ' · 완전 객체'}`, kind: 'custom', image: { type: 'uploaded', id: assetId }, tileSize: sourceOnly ? 16 : 32, tilesPerRow: sourceOnly ? pack.width / 16 : 8, count,
        passability: Array.from({ length: count }, () => ({ up: true, down: true, left: true, right: true })), priority: Array.from({ length: count }, () => 'upper' as const), terrain: Array<number>(count).fill(0), tileMeta: Array.from({ length: count }, () => ({ label: sourceOnly ? '원본 참고 픽셀' : '예약 빈 칸', defaultLayer: 'upper' as const, passage: 'passable' as const, source: 'imported' as const })), tileGroups: [], structureKits: [], autotileGroups: [] };
    if (sourceOnly)
        return t;
    for (const tile of [0, 1, 2]) {
        t.priority[tile] = 'lower';
        t.passability[tile] = { up: tile === 0, down: tile === 0, left: tile === 0, right: tile === 0 };
        t.tileMeta![tile] = { label: tile === 0 ? '예제 바닥' : '예제 벽', defaultLayer: 'lower', passage: tile === 0 ? 'passable' : 'solid', source: 'imported' };
    }
    for (const r of fixedLooseRecipes(pack)) {
        const q = r.outputRect!, tiles = Array.from({ length: q.height }, (_, y) => Array.from({ length: q.width }, (_, x) => (q.y + y) * 8 + q.x + x)), example = looseExample(r);
        const passive = r.collision === 'passable-overlay';
        for (const tile of tiles.flat()) {
            t.priority[tile] = 'upper';
            t.passability[tile] = { up: passive, down: passive, left: passive, right: passive };
            t.tileMeta![tile] = { label: r.name, description: `${r.notes} 충돌:${r.collision}. 출력은32px포장, 원본픽셀크기불변.`, defaultLayer: 'upper', passage: passive ? 'passable' : 'solid', repeatability: 'fixed', source: 'imported' };
        }
        t.tileGroups!.push({ id: r.id, name: r.name, role: 'prop', defaultLayer: 'upper', sourceRect: q, tileIds: tiles.flat(), source: 'imported', confidence: 'high', description: r.notes, placementRules: '전체 객체를 상위에 고정 배치하고 기존 하위를 보존한다. 참고문서의 받침과 접근 조건을 먼저 확인한다.', previewMap: { width: example.width, height: example.height, lowerTiles: example.lowerTiles, upperTiles: example.upperTiles } });
        t.structureKits!.push({ id: r.id, name: r.name, kind: 'section', width: q.width, height: q.height, tileSize: 32, rows: tiles.map(row => ({ tiles: row.map(() => -1), upperTiles: row })), learnedFrom: 'db-authored', ai: { description: `${r.placementKind}. ${r.notes}`, placementRules: r.placementKind === 'wall' ? '기존 벽면 위에 상위 전체 객체를 배치. 하위-1은 기존 벽 보존.' : '기존 바닥을 보존하고 전체 객체를 상위에 한 번 배치. 방향별 접근을 비운다. 표본 그림은 방/이벤트가 아니다.', role: 'prop', repeatability: 'fixed', layerHome: 'upper', tags: ['paw-loose', r.placementKind], ...(r.placementKind === 'wall' ? { placement: [{ id: 'wall-support', zone: 'wallFace' as const, strength: 'hard' as const }] } : {}) } });
    }
    return t;
}
