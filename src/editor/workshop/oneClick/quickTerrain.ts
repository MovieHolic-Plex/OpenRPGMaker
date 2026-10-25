// src/editor/workshop/oneClick/quickTerrain.ts
/**
 * 「한 번에 만들기」 지형 빠른 길 — 브라우저에서 몇 초. 모델·에이전트 없이 지금 맵 칩셋의 자동 타일 모양에 글의 재질 색을 입힌다.
 * 규칙·이유는 src/project/workshopQuickTerrain.ts. 되돌리기 한 번으로 뺀다.
 */
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import {
  installQuickTerrain, pickQuickTerrainSource, QUICK_TERRAIN_ASSET_PREFIX, quickMaterialOf, quickTerrainInteriorTile, quickTerrainTiles, recolorQuickTerrain,
  type QuickTerrainResult,
} from "@/project/workshopQuickTerrain";
import { withInstallOwnership } from "../installOwnership";
import { browserWorkshopEnv } from "../pixels";

export interface QuickTerrainDone extends QuickTerrainResult {
  readonly tilesetId: string;
  readonly title: string;
  readonly material: string;
  readonly sourceName: string;
  /** 속 칸 4배 미리 보기 */
  readonly thumbUrl: string;
  readonly ms: number;
}

function hashOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export async function makeQuickTerrain(text: string, tilesetId: string): Promise<QuickTerrainDone> {
  const started = performance.now();
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset) throw new Error("지형을 넣을 칩셋을 찾지 못했어요. 맵을 연 채로 다시 해 주세요.");
  const env = browserWorkshopEnv();
  const source = await env.tilesetSource?.(tilesetId);
  if (!source) throw new Error("지금 맵 칩셋 그림을 읽지 못했어요. 맵이 다 불러와진 뒤 다시 해 주세요.");
  const size = tileset.tileSize;
  const sheetCount = Math.floor(source.image.width / size) * Math.floor(source.image.height / size);
  const material = quickMaterialOf(text);
  const group = pickQuickTerrainSource(tileset, material, sheetCount);
  if (!group) throw new Error("이 칩셋에는 바탕으로 쓸 물·길 모양이 없어요. 「자세히 → 새로 그리기」로 만들어 보세요.");
  const { tiles, strips } = quickTerrainTiles(tileset, group);
  const interior = quickTerrainInteriorTile(group);
  const interiorFrames = tiles.filter((tile) => tile >= interior && tile < interior + (strips.find((s) => tiles[s.base] === interior)?.frames ?? 1));
  const sheet = recolorQuickTerrain(source.image, size, tiles, interiorFrames.length ? interiorFrames : [interior], material.ramp, material.base);
  const dataUrl = env.encodePng(sheet);
  const title = text.trim().slice(0, 24) || material.name;
  const asset = { id: `${QUICK_TERRAIN_ASSET_PREFIX}${hashOf(`${tilesetId}|${group.id}|${dataUrl}`)}_${dataUrl.length.toString(36)}`, dataUrl, width: sheet.width, height: sheet.height };
  let result: QuickTerrainResult | null = null;
  withInstallOwnership([tilesetId], `공방 지형 넣기: ${title}`, () => {
    recordProjectSnapshot("공방 지형 칩셋에 넣기");
    store.update((draft) => { result = installQuickTerrain(draft, tilesetId, { title, source: group, tiles, strips, asset }); }, { scope: "project", origin: "human", label: `공방 지형 넣기: ${title}` });
  });
  if (!result) throw new Error("지형을 넣지 못했어요.");
  // 미리 보기: 새 시트의 속 칸(첫 프레임)을 4배로
  const k = tiles.indexOf(interior);
  const thumb = { width: size * 4, height: size * 4, data: new Uint8ClampedArray(size * 4 * size * 4 * 4) };
  const ox = (k % 16) * size, oy = Math.floor(k / 16) * size;
  for (let y = 0; y < size * 4; y++) for (let x = 0; x < size * 4; x++) {
    const i = ((oy + (y >> 2)) * sheet.width + ox + (x >> 2)) * 4, o = (y * size * 4 + x) * 4;
    thumb.data[o] = sheet.data[i]!; thumb.data[o + 1] = sheet.data[i + 1]!; thumb.data[o + 2] = sheet.data[i + 2]!; thumb.data[o + 3] = sheet.data[i + 3]!;
  }
  const done = result as QuickTerrainResult;
  return { ...done, tilesetId, title, material: material.name, sourceName: group.name, thumbUrl: env.encodePng(thumb), ms: Math.round(performance.now() - started) };
}
