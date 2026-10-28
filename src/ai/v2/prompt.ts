// 조수 v2 시스템 지시문 — 역할·고리·규칙 한 쪽 + 요청 종류별 지식 카드 + 지금 프로젝트 요약. 전체 8k 토큰 안(카드 합 ≈ 6천 자).
import type { Project } from "@/project/types";
import { INTERIOR_CARD } from "./builders/interior";
import { VILLAGE_CARD } from "./builders/village";
import { DUNGEON_CARD } from "./builders/dungeon";
import { JP_CITY_CARD } from "./builders/jpCity";
import { MODERN_KR_CARD } from "./builders/modernCity";
import { JOSEON_CARD, JOSEON_WORDS } from "./builders/joseon";
import { WIZARDING_CARD, WIZARDING_WORDS } from "./builders/wizarding";
import { PEOPLE_CARD } from "./people";
import { EVENT_CARD } from "./events";
import { DRAW_OBJECT_CARD } from "./drawObject";
import { MONSTER_TOWN_CARD } from "./builders/monsterTown";
import { SCENE_CARD } from "./scene";
import { GAME_CARD, TERRAIN_CARD, fallenTierCard, storeTierCard, wantsGameTools, wantsStoreTools, wantsTerrainTools } from "./game";
import { MAKE_GAME_CARD, makeGameOn, wantsMakeGame } from "./makeGame";
import { BLUEPRINT_CARD, blueprintPin } from "./blueprint";
import { wantsWholeGame } from "./shipChecks";

export const V2_CORE_PROMPT = [
  "너는 OPRN RPG 편집기의 조수(v2)다. 역할 분담: 너는 «무엇을» 정한다(명세), 함수가 «어떻게» 짓는다(결정론 빌더), 다른 눈(독립 비평가)이 1배 그림을 본다.",
  "고리: 1) 요청을 읽고 명세를 쓴다 → 2) 동사(make_place·add_people·add_event·draw_object)를 부른다 → 3) 결과의 그림·기계 검사·비평 major 를 본다 → 4) 고칠 수 있는 major 는 edit_place 패치로 한 번 고친다(맵당 1바퀴, 패치 하나에 모아서). 놓인 가구 하나가 문·길을 막거나 방향이 틀린 것은 move_object(at→to·face·remove)로, 방이 비었거나 빈 바닥이 많은 것은 dress_room(mapId·at 방 바닥 한 칸·purpose 방 쓰임)으로 — 둘 다 바퀴를 쓰지 않는다 → 5) 짧게 보고한다.",
  "규칙:",
  "- 칸 좌표·타일 번호·평면 문자열을 지어내지 않는다. 자리는 낱말(입구·광장·카운터 앞…)로 말하고, 비평가가 짚은 좌표만 near/at 으로 넘긴다.",
  "- 요청의 모든 부분(장소·사람·대사·사건·물건)을 빠짐없이 동사로 옮긴다. 이미 있는 맵을 고치라는 요청이면 make_place 로 새로 짓지 말고 edit_place(mapId=그 맵)를 쓴다.",
  "- 한 동사에 한 번에 담는다(같은 장소를 make_place 로 두 번 짓지 않는다). 여러 층은 floors/zones.floor 로 한 번에.",
  "- 「다 됐다」는 비평 major 0 이고 기계 검사가 통과했을 때만 말한다. 아니면 남은 문제를 그대로 적는다.",
  "- 그림·부품이 없어 못 한 것(missingArt)은 보고에 반드시 적는다. 비슷한 다른 물건으로 몰래 바꿔 넣지 않는다. 칩셋에 없는 물건을 사용자가 원하면 draw_object 를 쓴다(그림 카드가 뜨고, 사용자가 고르면 「[공방에서 그려 넣음] … 물체 id …」 후속 지시가 온다 — 그때 그 지시의 stamp_tileset_object 대신 place_object 로 놓는다).",
  "- 묻는 것은 정말 갈림길일 때만(ask_user). 보통은 합리적으로 정해서 짓고 보고에 「이렇게 정했다」고 쓴다.",
  "- 보고는 한국어 3~6줄: 지은 것(맵 이름), 검사 결과(통과/남은 문제), 못 한 것.",
].join("\n");

export const V2_CARDS: readonly string[] = [INTERIOR_CARD, VILLAGE_CARD, DUNGEON_CARD, JP_CITY_CARD, MODERN_KR_CARD, PEOPLE_CARD, EVENT_CARD, DRAW_OBJECT_CARD];

/** 지금 프로젝트를 모델이 알 만큼만 — 맵(이름·칩셋·크기·사람 수·비었는지), 지금 보는 맵, 시작 맵. */
export function projectBrief(project: Project, currentMapId?: string): string {
  const maps = Object.values(project.maps).slice(0, 24).map((m) => {
    const filled = m.lowerTiles.some((t) => (t ?? -1) >= 0);
    const people = (m.events ?? []).filter((e) => e.pages?.[0]?.graphic).length;
    return `- ${m.id} 「${m.name}」 ${m.tilesetId} ${m.width}×${m.height}${filled ? "" : " (빈 맵)"}${people ? ` 사람·물체 ${people}` : ""}${m.id === currentMapId ? " ← 지금 보는 맵" : ""}${m.id === project.startMapId ? " (시작 맵)" : ""}`;
  });
  return ["[지금 프로젝트]", ...maps, Object.keys(project.maps).length > 24 ? `…맵 ${Object.keys(project.maps).length}개 중 24개만` : ""].filter(Boolean).join("\n");
}

/** 요청·프로젝트가 맞을 때만 싣는 카드(각 한 장) — 몬스터 수집 마을, 두 선택 대화 장면. */
const MONSTER_WORDS = /포켓몬|몬스터 ?수집|monster[- ]?collect|pok[eé]mon|트레이너|체육관|연구소|몬스터 ?센터/iu;
const SCENE_WORDS = /대화 ?장면|선택지|고백|속마음|연애|데이트|첫 ?만남|romance|confess/iu;
export function conditionalCards(project: Project, currentMapId?: string, task = ""): string[] {
  const tileset = project.tilesets[project.maps[currentMapId ?? project.startMapId]?.tilesetId ?? ""];
  const monster = MONSTER_WORDS.test(task) || /^oprn-monster/u.test(tileset?.family ?? "");
  const contract = project.gameDesignBrief?.implementation?.harnessId === "romance-scene";
  const joseon = JOSEON_WORDS.test(task) || tileset?.id === "joseon_baram";
  return [...(monster ? [MONSTER_TOWN_CARD] : []), ...(joseon ? [JOSEON_CARD] : []), ...(WIZARDING_WORDS.test(task) || tileset?.id === "wizarding_world" ? [WIZARDING_CARD] : []), ...(contract || SCENE_WORDS.test(task) ? [SCENE_CARD] : []), ...(wantsGameTools(task) ? [GAME_CARD, ...[fallenTierCard(task)].filter(Boolean)] : []), ...(wantsTerrainTools(task) ? [TERRAIN_CARD] : []), ...(wantsStoreTools(task) ? [storeTierCard(task)] : []), ...(makeGameOn() && wantsMakeGame(task) ? [MAKE_GAME_CARD] : [])];
}

export function buildV2SystemPrompt(project: Project, currentMapId?: string, task?: string): string[] {
  // 청사진은 핵심 지시 바로 뒤에 박아 매 모델 차례가 대조하게 한다(2026-10-28). 게임 하나를 만드는 요청이면 청사진 카드도 싣는다.
  const whole = wantsWholeGame(task ?? "");
  return [V2_CORE_PROMPT, ...blueprintPin(project), "[지식 카드]", ...(whole || project.gameBlueprint ? [BLUEPRINT_CARD] : []), ...V2_CARDS, ...conditionalCards(project, currentMapId, task), projectBrief(project, currentMapId)];
}
