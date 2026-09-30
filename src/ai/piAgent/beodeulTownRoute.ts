// 「마을 만들어 줘」가 버들항 계열을 가리키면 숲마을 author_village 생성기가 아니라 author_beodeul_town(블록 키트 조립)이 짠다.
// 2026-10-01 실측: 새 프로젝트에서 마을을 시키면 선언이 author_village 를 골라 마을 계약이 걸렸고, 버들항 타일셋을 가진 프로젝트에서도
// 숲마을(forest_harmony) 또는 합본 마을 방식으로 지어졌다. 버들항 문법(길 위계·블록·건물 키트·항구)은 author_beodeul_town 한 호출에 있다.
// packTownRoute 와 같은 모양이다 — 노트를 갈아 끼우고, author_village 전용 마을 계약을 건너뛴다.

import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { defaultOutdoorTilesetId } from "@/project/defaults/forestHarmony";
import type { Project } from "@/project/types";
import type { IntentDeclaration } from "@/ai/intentDeclaration";

export interface BeodeulTownTarget {
  /** 대상 맵이 이미 버들항이면 그 맵 id — 아니면 새 맵을 만든다. */
  readonly mapId?: string;
  /** 대상 맵에 이미 내용이 있으면 true — 기존 맵 전체를 비우고 다시 까는 호출을 하지 않는다. */
  readonly lived?: boolean;
}

const TOWN_TOOLS: readonly string[] = ["author_village", "author_beodeul_town"];

/** 선언이 마을 시공 도구를 골랐고 대상 계열이 버들항이면 그 대상. 다른 계열(숲마을·합본 마을)이면 null — 종전 경로. */
export function beodeulTownTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "tools" | "mode" | "source">,
  mapId: string | null | undefined,
  lived: boolean,
): BeodeulTownTarget | null {
  if (intent.source !== "llm" || intent.mode === "question") return null;
  if (!intent.tools.some((name) => TOWN_TOOLS.includes(name))) return null;
  const map = mapId ? project.maps[mapId] : undefined;
  if (map) return map.tilesetId === DEFAULT_TILESET_ID ? { mapId: map.id, lived } : null;
  return defaultOutdoorTilesetId(project) === DEFAULT_TILESET_ID ? {} : null;
}

export function formatBeodeulTownNote(target: BeodeulTownTarget, targetMap: { id: string; width: number; height: number } | null): string {
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 비어 있다 → author_beodeul_town({mapId:"${target.mapId}"}) 로 맵 전체에 짓는다(맵은 풀밭으로 다시 깔린다).`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 에는 이미 내용이 있다 → mapId 를 주지 말고 author_beodeul_town({name, id?, width?, height?}) 로 새 버들항 맵을 만든다. 기존 맵을 지우지 않는다.`
      : "author_beodeul_town({name, width?, height?}) 로 새 버들항 맵을 만든다.";
  return [
    "[마을 시공 — 버들항] 이 요청의 마을은 버들항 타일셋이다. author_village·author_house 는 숲마을 생성기라 쓰지 않는다. "
      + "author_beodeul_town 한 호출이 길 위계·블록 격자·건물 키트(주택·상점·시장·저택·교회)·풀밭·소품을 버들항 문법으로 조립한다 — "
      + "paint_road·fill_region·place_props 로 길과 집을 손으로 깔지 말 것.",
    where,
    "크기는 기본 60×60(작게는 16×10, 블록 격자에 맞게 조금 조정된다). 항구·바다·호수·부두 마을이면 harbour:true(가로 83 이상). "
      + "같은 seed 는 같은 마을이니 다른 배치를 원하면 seed 를 바꾼다.",
    "시공 뒤 check_city_form 으로 길 위계를 보고, check_reachability({mapId, from, targets}) 로 문 앞 도달을 확인한다. "
      + "NPC·출입구 이벤트가 필요하면 그 뒤에 얹는다(문 앞 칸은 결과 data 에 있다).",
  ].join("\n");
}
