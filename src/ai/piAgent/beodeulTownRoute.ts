// 「마을 만들어 줘」가 버들항 계열을 가리키면 숲마을 author_village 생성기가 아니라 author_beodeul_town(블록 키트 조립)이 짠다.
// 2026-10-01 실측: 새 프로젝트에서 마을을 시키면 선언이 author_village 를 골라 마을 계약이 걸렸고, 버들항 타일셋을 가진 프로젝트에서도
// 숲마을(forest_harmony) 또는 합본 마을 방식으로 지어졌다. 버들항 문법(길 위계·블록·건물 키트·항구)은 author_beodeul_town 한 호출에 있다.
// packTownRoute 와 같은 모양이다 — 노트를 갈아 끼우고, author_village 전용 마을 계약을 건너뛴다.

import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { defaultOutdoorTilesetId } from "@/project/defaults/outdoorTileset";
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

/** 마을 문법(theme ≠ city)이 짓는 가장 작은 맵 — authorBeodeulTown.ts VILLAGE_MIN_W/H 와 같다. */
const VILLAGE_MIN = { w: 36, h: 30 } as const;

export function formatBeodeulTownNote(target: BeodeulTownTarget, targetMap: { id: string; width: number; height: number } | null): string {
  const small = !!targetMap && (targetMap.width < VILLAGE_MIN.w || targetMap.height < VILLAGE_MIN.h);
  const where = target.mapId && !target.lived && !small
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 비어 있다 → author_beodeul_town({mapId:"${target.mapId}", theme}) 로 맵 전체에 짓는다(맵은 다시 깔린다).`
    : target.mapId && small && !target.lived
      ? `지금 맵 '${target.mapId}'(${targetMap!.width}×${targetMap!.height})은 마을이 들어가기에 작다(최소 ${VILLAGE_MIN.w}×${VILLAGE_MIN.h}) → mapId 를 주지 말고 author_beodeul_town({name, theme}) 로 새 버들항 맵을 만든다.`
      : target.mapId
        ? `지금 맵 '${target.mapId}' 에는 이미 내용이 있다 → mapId 를 주지 말고 author_beodeul_town({name, theme, width?, height?}) 로 새 버들항 맵을 만든다. 기존 맵을 지우지 않는다.`
        : "author_beodeul_town({name, theme, width?, height?}) 로 새 버들항 맵을 만든다.";
  return [
    // 2026-10-03 실측(r2): 모델이 위키·맵·요약·DB·참고문서 조회 6번(수십 초) 뒤에야 시공을 불렀다. 그동안 사용자는 빈 맵을 본다.
    "[먼저 보이게] 사용자는 맵 위에서 마을이 지어지는 모습을 기다리고 있다. 프로젝트 요약·위키·DB·참고문서 조회로 시간을 쓰지 말고 "
      + "곧바로 author_beodeul_town 을 부른다(이 도구는 타일을 코드가 고르므로 참고문서를 먼저 읽지 않아도 된다). 확인·보충은 시공 뒤에 한다.",
    "[마을 시공 — 버들항] 이 요청의 마을은 버들항 타일셋이다. author_village·author_house 는 숲마을 생성기라 쓰지 않는다. "
      + "author_beodeul_town 한 호출이 사용자가 고른 버들항 변형 마을의 문법(물 → 길 뼈대 → 앵커 건물 → 길을 보는 집 → 일터·울타리 밭·숲 덩이)으로 짓는다 — "
      + "paint_road·fill_region·place_props 로 길과 집을 손으로 깔지 말 것.",
    // 2026-10-22 사용자 「마을 만들어 달라 하면 다 비슷하게 만들어 버리는 게 충격」: 이 줄이 「작은 마을 = houseCount 40×30」을 시켜
    // 늘 같은 고정 배치(같은 세 집·같은 길·같은 우물)가 나왔고, 모델은 매번 seed 7 을 보냈다. 이제 마을의 정체를 먼저 정하고 선택지로 옮긴다.
    "[마을마다 다르게] 먼저 이 마을이 무엇인지 한 줄로 정한다(무엇을 먹고 사나·왜 여기 생겼나·땅). 그 정체를 선택지로 옮긴다 — "
      + "theme(물·기후) · form(마을 형태) · terrain(땅 모양) · roofs(지붕: red 붉은 기와 목골집 · slate 청회색 · moss 이끼 초가·너와 농가 · log 통나무 산골) · forestType(broadleaf·conifer·mixed) · 크기. "
      + "예: 어촌 = coast+street(포구 길가)·slate 또는 red / 산골 = river+terraces+scatter+log+conifer / 숲속 마을 = river+scatter+moss+mixed / 강가 장터 = river+plaza / 방앗간 마을 = river+riverbank. "
      + "요청이 말하지 않은 선택(「평범한 마을」의 form·terrain·roofs 등)과 seed 는 보내지 않는다 — 도구가 프로젝트·맵마다 다르게 고르고 결과 data 에 적는다. 같은 조합을 습관처럼 다시 쓰지 않는다.",
    "집 수를 말하면(3~5채) houseCount 를 theme·form·roofs 와 함께 보낸다(크기를 생략하면 40×32 안팎). 크기는 규모에서: 작은 마을 40×32~44×36, 보통 56×44, 큰 마을 72×56 이상. church:true 는 옛 예제 마을 전용이라 쓰지 않는다.",
    where,
    "theme 은 말에서 고른다: 강·물레방아·시골 마을 = river(기본), 항구·포구·어촌·바닷가 = coast, 사막·오아시스 = desert, 눈·설원·겨울 = snow, 늪·습지 = swamp. "
      + "「도시·로마풍·블록」을 말할 때만 city(블록 격자 도시, 기본 60×60, 항구 호수는 harbour:true·가로 83 이상). 마을 크기는 생략하면 56×44 안팎(36×30~96×80).",
    "form(마을 형태)은 마을이 왜 거기 생겼나에서 고른다: 나루·다리·포구 길·오아시스로 드는 길가 = street, 강을 따라 늘어선 방앗간·나루 마을(river 만) = riverbank, "
      + "농가·산촌·외딴 마을 = scatter, 장터·교역지 = plaza(이때만 광장). 중심 광장·십자 길을 기본으로 삼지 않는다.",
    "시공 뒤 check_city_form 으로 길 위계를 보고, check_reachability({mapId, from, targets}) 로 문 앞 도달을 확인한다(결과 data.doors·data.entrance). "
      + "NPC·출입구 이벤트가 필요하면 그 뒤에 얹는다.",
  ].join("\n");
}
