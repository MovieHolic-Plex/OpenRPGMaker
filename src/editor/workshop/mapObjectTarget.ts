// src/editor/workshop/mapObjectTarget.ts
/**
 * 「직접 그려 줘」가 어느 공방으로 가는가 — 지금 맵의 칩셋으로 정한다.
 * 손 도트 실내면 interior-props(번들 기물 사양·3/4 예시가 있다), 그 밖의 16px 칩셋이면 map-objects.
 */
import { editorState } from "@/editor/editorState";
import type { WorkshopEnv } from "@/harnesses/_core/workshop/types";
import { ATLAS_BIOME_INTERIOR_ID } from "@/project/defaults/atlasBiomeInterior";
import { store } from "@/project/store";
import { footprintClass } from "@/harnesses/_core/workshop/footprint";
import { leafLockHexes, ogIsOrganic } from "@/harnesses/_core/workshop/objectGenFlow";
import { classObjects, paletteFromImages, similarObjects } from "@/harnesses/map-objects/editor/sheet";

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

/**
 * 새 맵 기물의 팔레트 — 칩셋에서 닮은 물체 색을 먼저(가중치 8), 시트 전체 색으로 채운다. 칩셋을 못 읽으면 빈 배열.
 * 닮은 물체 = 이름이 맞는 것 + 크기 사전 종류가 같은 것(classObjects). 이름만 보면 「사과나무」가 버들항 나무 킷(oak·olive tree…)을
 * 못 찾아, 팔레트 48색이 잔디색으로 차고 나무 잎 단(#497f3c·#296535·#104c2f…, 시트에 1.5만 화소씩 있다)이 빠졌다 —
 * 조수 나무가 잔디색으로 그려져 풀밭에 묻혔다(2026-10-22 Opus VQA major). 맞는 것이 하나도 없을 때만 여러 칸 물체로 채운다.
 */
export async function mapObjectPalette(env: WorkshopEnv, tilesetId: string, title: string, description: string): Promise<string[]> {
  const source = env.tilesetSource ? await env.tilesetSource(tilesetId) : null;
  if (!source) return [];
  const picked = similarObjects(source, title, description, 6, true);
  const cls = footprintClass(title, description);
  if (cls) for (const object of classObjects(source, cls, 6)) if (picked.length < 8 && !picked.some((o) => o.name === object.name)) picked.push(object);
  const similar = (picked.length ? picked : similarObjects(source, title, description, 6)).map((object) => ({ image: object.image, weight: 8 }));
  const hexes = paletteFromImages([...similar, { image: source.image, weight: 1 }]);
  // 잎 덩이 자연물은 잎 초록을 견본 잎 단으로 잠근다(잔디·올리브 키 제거)
  return ogIsOrganic({ title }) && (cls === "tree" || cls === "plant") ? leafLockHexes(hexes, source.image) : hexes;
}

/** 「물건·가구」 카드가 쓰는 두 실행기 — 손 도트 실내 칩셋(실내 가구)과 지금 맵 칩셋(맵 물건). */
export const OBJECT_WORKSHOP_HARNESSES = ["interior-props", "map-objects"] as const;
export type ObjectWorkshopHarness = (typeof OBJECT_WORKSHOP_HARNESSES)[number];

/** 「만들기」가 처음 여는 실행기: 지금 맵이 손 도트 실내가 아닌 16px 맵이면 그 맵 칩셋, 아니면 실내 가구. */
export function objectWorkshopHarness(): ObjectWorkshopHarness {
  return currentDrawTarget().harnessId === "map-objects" ? "map-objects" : "interior-props";
}
