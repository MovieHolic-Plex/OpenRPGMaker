// src/editor/workshop/oneClick/place.ts
/**
 * 「한 번에 만들기」 결과를 맵에 놓을 준비 — 물건은 붓(기물 스탬프), 캐릭터는 다음 클릭 칸에 NPC, 지형은 자동 타일 붓.
 * 사용자는 「맵에 놓기」 한 번 + 맵 클릭 한 번이면 된다.
 */
import { editorState } from "@/editor/editorState";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { armMapPick } from "@/editor/mapPickHook";
import { store } from "@/project/store";
import { toast } from "@/util/toast";

/** 캐릭터: 다음 맵 클릭 칸에 그 캐릭터 칩으로 NPC 를 세운다(조수 place_npc 와 같은 길 — 통행 못 하는 칸이면 가까운 칸에 선다). */
export function armCharacterPlacement(input: { readonly textureKey: string; readonly characterIndex: number; readonly name: string }): string | null {
  const mapId = editorState.get().currentMapId;
  if (!mapId || !store.getCurrent().maps[mapId]) return "열린 맵이 없어요. 놓을 맵을 먼저 열어 주세요.";
  armMapPick((pickedMap, x, y) => {
    const map = store.getCurrent().maps[pickedMap];
    if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) {
      toast("맵 안쪽 칸을 눌러 주세요. Esc 로 그만둬요.", "info");
      return false;
    }
    void import("@/editor/tools/eventTools").then(({ EVENT_TOOLS }) => {
      const placeNpc = EVENT_TOOLS.find((tool) => tool.name === "place_npc");
      if (!placeNpc) { toast("NPC 를 놓지 못했어요.", "error"); return; }
      let summary = "";
      try {
        recordProjectSnapshot("공방 캐릭터 놓기");
        store.update((draft) => {
          const result = placeNpc.run(draft, {
            mapId: pickedMap, x, y, name: input.name, movement: "random",
            graphic: { textureKey: input.textureKey, characterIndex: input.characterIndex },
            pages: [{ lines: [`안녕하세요. 저는 ${input.name}이에요.`] }],
          });
          summary = (result as { summary?: string }).summary ?? "";
        }, { scope: "map", mapId: pickedMap });
        toast(`「${input.name}」을(를) 놓았어요. 더블클릭하면 대사를 고칠 수 있어요.`, "ok");
        void summary;
      } catch (error) {
        toast(error instanceof Error ? error.message : String(error), "error");
      }
    });
    return true;
  });
  return null;
}

/** 지형: 지금 맵 칩셋에 합친 자동 타일 그룹의 칸을 붓에 든다(이웃 연결 켬, 아래층). */
export function armTerrainBrush(input: { readonly tilesetId: string; readonly brushTile: number }): string | null {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId;
  const map = mapId ? project.maps[mapId] : undefined;
  if (!map) return "열린 맵이 없어요. 칠할 맵을 먼저 열어 주세요.";
  if (map.tilesetId !== input.tilesetId) return `지금 맵은 「${project.tilesets[input.tilesetId]?.name ?? input.tilesetId}」 칩셋을 쓰지 않아요. 그 칩셋을 쓰는 맵을 열면 칠할 수 있어요.`;
  editorState.set({ tool: "paint", layer: "lower", paintShape: "pen", activePaletteStamp: null, selectedTile: input.brushTile, autoConnectMode: true });
  return null;
}
