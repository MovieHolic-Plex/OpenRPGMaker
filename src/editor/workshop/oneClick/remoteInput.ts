// src/editor/workshop/oneClick/remoteInput.ts
/**
 * 지형 생성기(tile-gen)에 보낼 칩셋 그림과 참고 칸 — 「지금 맵 칩셋 그림 받기」와 같은 바탕 시트(이식 없는 그림, 투명색을 뺀 것).
 * 참고 칸은 그 칩셋을 쓰는 맵(지금 맵 먼저)의 아래층에서 가장 많이 쓴 칸들이다 — 지형은 그 땅의 색·결을 따른다.
 */
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { browserWorkshopEnv } from "../pixels";
import { terrainRefCells } from "./infer";

export async function terrainTilesetInput(tilesetId: string): Promise<{ png: string; refs: [number, number][] }> {
  const project = store.getCurrent();
  const tileset = project.tilesets[tilesetId];
  if (!tileset) throw new Error("지형을 넣을 칩셋을 찾지 못했어요. 맵을 연 채로 다시 해 주세요.");
  const env = browserWorkshopEnv();
  const source = await env.tilesetSource?.(tilesetId);
  if (!source) throw new Error("지금 맵 칩셋 그림을 읽지 못했어요. 맵이 다 불러와진 뒤 다시 해 주세요.");
  const size = tileset.tileSize;
  const perRow = Math.floor(source.image.width / size);
  const sheetCount = perRow * Math.floor(source.image.height / size);
  const currentId = editorState.get().currentMapId;
  const maps = Object.values(project.maps).filter((map) => map.tilesetId === tilesetId).sort((a, b) => (a.id === currentId ? -1 : b.id === currentId ? 1 : 0));
  let refs: [number, number][] = [];
  for (const map of maps) {
    refs = terrainRefCells(map.lowerTiles, sheetCount, perRow);
    if (refs.length) break;
  }
  if (!refs.length) throw new Error("지금 맵에서 참고할 땅 칸을 찾지 못했어요. 바닥을 조금 칠한 뒤 다시 해 주세요.");
  return { png: env.encodePng(source.image), refs };
}
