import catalog from '@/assets/pixelArtWorldFoodCatalog.json';
import type { TilesetDef } from './types';
export const PIXEL_ART_WORLD_FOOD = catalog.packs;
export const PIXEL_ART_WORLD_FOOD_SUPPORT = catalog.support;
export type PixelArtWorldFoodPack = typeof catalog.packs[number];
export type PixelArtWorldFoodRecipe = PixelArtWorldFoodPack['recipes'][number];
export function foodCompositionRecipes(pack: PixelArtWorldFoodPack) {
    return pack.recipes.filter(recipe => recipe.composition === 'table');
}
export function foodCompositionRect(index: number) {
    return { x: (index % 4) * 3, y: 1 + Math.floor(index / 4) * 3, width: 3, height: 3 };
}
export function foodCompositionExample(index: number) {
    const rect = foodCompositionRect(index), lowerTiles = Array<number>(25).fill(0), upperTiles = Array<number>(25).fill(-1);
    for (let y = 0; y < 3; y++)
        for (let x = 0; x < 3; x++)
            upperTiles[(y + 1) * 5 + x + 1] = (rect.y + y) * 12 + rect.x + x;
    return { width: 5, height: 5, lowerTiles, upperTiles, approach: { x: 2, y: 4 } };
}
export function validateFoodCompositionExample(index: number, actual: ReturnType<typeof foodCompositionExample>) {
    const expected = foodCompositionExample(index), errors: {
        code: string;
        x: number;
        y: number;
    }[] = [];
    if (actual.width !== 5 || actual.height !== 5 || actual.lowerTiles.length !== 25 || actual.upperTiles.length !== 25)
        return [{ code: 'DIMENSIONS', x: 0, y: 0 }];
    expected.lowerTiles.forEach((tile, i) => {
        if (actual.lowerTiles[i] !== tile)
            errors.push({ code: 'FLOOR_REPLACED', x: i % 5, y: Math.floor(i / 5) });
        if (actual.upperTiles[i] !== expected.upperTiles[i])
            errors.push({ code: 'SUPPORT_OR_OBJECT_CELL', x: i % 5, y: Math.floor(i / 5) });
    });
    if (actual.upperTiles[22] !== -1)
        errors.push({ code: 'APPROACH_BLOCKED', x: 2, y: 4 });
    return errors;
}
export function createFoodTileset(pack: PixelArtWorldFoodPack, assetId: string, tilesetId: string, composed: boolean): TilesetDef {
    const recipes = composed ? foodCompositionRecipes(pack) : pack.recipes;
    const columns = composed ? 12 : 4;
    const count = composed ? 12 * (1 + Math.ceil(recipes.length / 4) * 3) : pack.width * pack.height / 1024;
    const tileset: TilesetDef = {
        id: tilesetId, name: `${pack.name}${composed ? ' · 식탁 합성' : ' · 원본 소품'}`, kind: 'custom',
        image: { type: 'uploaded', id: assetId }, tileSize: 32, tilesPerRow: columns, count,
        passability: Array.from({ length: count }, () => ({ up: true, down: true, left: true, right: true })),
        priority: Array.from({ length: count }, () => 'upper' as const), terrain: Array<number>(count).fill(0),
        tileMeta: Array.from({ length: count }, () => ({ label: '빈 예약칸', description: '아직 소품을 배정하지 않은 예약 칸. 배치에 쓰지 않는다.', defaultLayer: 'upper' as const, passage: 'passable' as const, source: 'imported' as const })),
        tileGroups: [], autotileGroups: [],
    };
    if (composed) {
        tileset.priority[0] = 'lower';
        tileset.tileMeta![0] = { label: '식탁 예제의 원본 바닥', description: '식탁 합성 예제가 깔고 있는 바닥 칸. 통행 가능하며 반복해 깔 수 있다.', defaultLayer: 'lower', passage: 'passable', repeatability: 'repeat', source: 'imported' };
    }
    recipes.forEach((recipe, index) => {
        const rect = composed ? foodCompositionRect(index) : recipe.sourceRect;
        const tileIds = Array.from({ length: rect.height }, (_, y) => Array.from({ length: rect.width }, (_, x) => (rect.y + y) * columns + rect.x + x)).flat();
        for (const tile of tileIds) {
            const solid = composed && Math.floor(tile / columns) > rect.y;
            tileset.passability[tile] = { up: !solid, down: !solid, left: !solid, right: !solid };
            tileset.tileMeta![tile] = { label: recipe.name, defaultLayer: 'upper', passage: solid ? 'solid' : 'passable', repeatability: 'fixed', source: 'imported', description: composed ? '음식과 식탁을 이미 합성한 완전3×3 객체. 식탁 두 행만 충돌.' : `${recipe.notes} 원본 소품은 별도 받침 합성이 필요하다. 기존 상위 식탁 위에 덮으면 식탁이 지워진다.` };
        }
        const example = composed ? foodCompositionExample(index) : { width: rect.width, height: rect.height, lowerTiles: Array<number>(tileIds.length).fill(-1), upperTiles: tileIds };
        const { width, height, lowerTiles, upperTiles } = example;
        tileset.tileGroups!.push({
            id: `${recipe.id}${composed ? '-table' : ''}`, name: `${recipe.name}${composed ? ' · 식탁' : ''}`, role: 'prop', defaultLayer: 'upper',
            tileIds, sourceRect: rect, source: 'imported', confidence: 'high',
            description: composed ? '원본 식탁3×2와 음식의 픽셀 합성. 전체3×3 고정 객체.' : `원본4열. ${recipe.placementKind}. ${recipe.notes}`,
            placementRules: composed ? '전체3×3을 상위에 배치하고 하위 바닥을 보존한다. 남쪽 한 칸 접근. 별도 음식 타일을 다시 덮지 않는다.' : '소품 원본 자료. 바닥/독립 가구가 아니다. 이미 점유된 상위 셀에 찍지 말고 식탁 합성 타일셋을 사용한다. 매달린 소품3개는 고정점 조립 미검토.',
            previewMap: { width, height, lowerTiles, upperTiles },
        });
    });
    return tileset;
}
