// 「마을 만들어 줘」가 팩 프리셋 도시 타일셋(Rasak Modern 등)을 가리키면 숲마을 author_village 가 아니라
// build_pack_town 이 짠다. 2026-09-25 편집기 실측: "Rasak Modern · 도시 야외 타일셋으로 새 맵 … 소도시" 요청에
// 선언이 author_village 를 골라 마을 계약이 걸렸고, 68×44 숲마을(forest_harmony)이 지어졌다 — 사용자가 고른 타일셋이 사라졌다.

import type { Project, TilesetDef } from "@/project/types";
import { MV_PACK_PRESETS } from "@/project/rpgmakerMv/packs";

export interface PackTownTarget {
  readonly tilesetId: string;
  readonly tilesetName: string;
  /** 대상 맵이 이미 이 타일셋이면 그 맵 — 아니면 새 맵을 만들어야 한다. */
  readonly mapId?: string;
}

/** 사용자가 한글로 부르는 팩 이름 — «라삭 모던 타일셋으로 …» 은 영문 팩 이름과 겹치지 않는다. */
const PACK_NAME_ALIASES: Readonly<Record<string, readonly string[]>> = { "rasak-modern-city": ["라삭"] };

function hasTownRecipe(tileset: TilesetDef | undefined): tileset is TilesetDef {
  const presetId = tileset?.mvPack?.presetId;
  return !!presetId && MV_PACK_PRESETS.some((preset) => preset.id === presetId && preset.town);
}

/** 요청 문장이 이름을 부른 팩 도시 타일셋, 없으면 대상 맵이 이미 쓰는 팩 도시 타일셋. */
export function packTownTargetFor(project: Pick<Project, "tilesets" | "maps">, requestText: string | undefined, mapId: string | null | undefined): PackTownTarget | null {
  const text = requestText ?? "";
  const map = mapId ? project.maps[mapId] : undefined;
  for (const tileset of Object.values(project.tilesets)) {
    if (!hasTownRecipe(tileset)) continue;
    const preset = MV_PACK_PRESETS.find((entry) => entry.id === tileset.mvPack!.presetId)!;
    const packName = preset.pack.replace(/\s*Tileset$/i, "");
    const aliases = PACK_NAME_ALIASES[preset.id] ?? [];
    if ((tileset.name.length > 3 && text.includes(tileset.name)) || (packName.length > 3 && text.includes(packName))
      || aliases.some((alias) => text.includes(alias))) {
      return { tilesetId: tileset.id, tilesetName: tileset.name, ...(map?.tilesetId === tileset.id ? { mapId: map.id } : {}) };
    }
  }
  const current = map ? project.tilesets[map.tilesetId] : undefined;
  return hasTownRecipe(current) ? { tilesetId: current.id, tilesetName: current.name, mapId: map!.id } : null;
}

export function formatPackTownNote(target: PackTownTarget, targetMap: { id: string; width: number; height: number } | null): string {
  return [
    `[마을 시공 — 팩 도시 타일셋] 이 요청은 '${target.tilesetName}'(${target.tilesetId}) 타일셋 마을이다. author_village·author_house 는 숲마을 전용이라 쓰지 않는다. 현대 맵 Pixel Art World 전용 규칙은 이 팩 타일셋에 적용되지 않는다 — PAW 설치를 안내하지 말고 이 타일셋으로 바로 시공한다.`,
    target.mapId && targetMap?.id === target.mapId && targetMap.width >= 40 && targetMap.height >= 30
      ? `대상 맵 '${targetMap.id}'(${targetMap.width}×${targetMap.height}) 에 build_pack_town 을 먼저 부른다(이미 칠했으면 replace:true).`
      : `create_map 으로 이 타일셋(tilesetId:"${target.tilesetId}") 50×40 맵을 만들고 build_pack_town 을 먼저 부른다.`,
    "뼈대가 깔리면 문 칸(lots[].door)에 이동 이벤트·NPC, 가게마다 소품을 1~3개씩 모아 더하고, check_town_map 의 issues 가 빌 때까지 고친다.",
  ].join("\n");
}
