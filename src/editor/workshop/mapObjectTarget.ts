// src/editor/workshop/mapObjectTarget.ts
/**
 * 「직접 그려 줘」가 어느 공방으로 가는가 — 지금 맵의 칩셋으로 정한다.
 * 손 도트 실내면 interior-props(번들 기물 사양·3/4 예시가 있다), 그 밖의 16px 칩셋이면 map-objects.
 */
import { editorState } from "@/editor/editorState";
import type { WorkshopEnv } from "@/harnesses/_core/workshop/types";
import { ATLAS_BIOME_INTERIOR_ID } from "@/project/defaults/atlasBiomeInterior";
import { store } from "@/project/store";
import { paletteFromImages, similarObjects } from "@/harnesses/map-objects/editor/sheet";

export type DrawTarget =
  | { readonly harnessId: "interior-props"; readonly tilesetId: string; readonly name: string }
  | { readonly harnessId: "map-objects"; readonly tilesetId: string; readonly name: string }
  | { readonly harnessId: null; readonly reason: string };

/** 공방이 그릴 수 있는 칸 크기 — 격자·굽기가 16px 칸 기준이다 */
export const WORKSHOP_TILE_SIZE = 16;

export function currentDrawTarget(): DrawTarget {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId;
  const tilesetId = mapId ? project.maps[mapId]?.tilesetId : undefined;
  const tileset = tilesetId ? project.tilesets[tilesetId] : undefined;
  if (!tilesetId || !tileset) return { harnessId: null, reason: "열린 맵이 없어요. 그릴 맵을 먼저 열어 주세요." };
  if (tilesetId === ATLAS_BIOME_INTERIOR_ID) return { harnessId: "interior-props", tilesetId, name: tileset.name };
  if (tileset.tileSize !== WORKSHOP_TILE_SIZE) return { harnessId: null, reason: `공방은 16px 칩셋에만 그려 넣을 수 있어요(이 맵 칩셋은 ${tileset.tileSize}px).` };
  return { harnessId: "map-objects", tilesetId, name: tileset.name };
}

/** 새 맵 기물의 팔레트 — 칩셋에서 닮은 물체 색을 먼저(가중치 8), 시트 전체 색으로 채운다. 칩셋을 못 읽으면 빈 배열. */
export async function mapObjectPalette(env: WorkshopEnv, tilesetId: string, title: string, description: string): Promise<string[]> {
  const source = env.tilesetSource ? await env.tilesetSource(tilesetId) : null;
  if (!source) return [];
  const similar = similarObjects(source, title, description, 6).map((object) => ({ image: object.image, weight: 8 }));
  return paletteFromImages([...similar, { image: source.image, weight: 1 }]);
}
