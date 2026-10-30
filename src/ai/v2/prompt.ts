// 조수 v2 시스템 지시문 — 역할·고리·규칙 한 쪽 + 요청 종류별 지식 카드 + 지금 프로젝트 요약. 전체 8k 토큰 안(카드 합 ≈ 6천 자).
// 2026-10-30: 모델이 읽는 글은 영어다(싼 모델 gpt-6.1-terra 가 영어 지시를 더 잘 따른다). 코드가 맞추는 한국어 낱말·사용자 글 예시만 한국어로 남긴다.
// 바뀐 글은 scripts/qa/assistant-v2/dumpPrompt.mts 로 통째 본다.
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
import { GAME_CARD, MUSIC_TIER, TERRAIN_CARD, fallenTierCard, storeTierCard, wantsGameTools, wantsMusicTools, wantsStoreTools, wantsTerrainTools } from "./game";
import { MAKE_GAME_CARD, makeGameOn, wantsMakeGame } from "./makeGame";
import { BLUEPRINT_CARD, blueprintPin } from "./blueprint";
import { wantsWholeGame } from "./shipChecks";
import { musicOnly } from "./musicWords";
import type { TodoStore } from "./loop/todoStore";

export const V2_CORE_PROMPT = [
  "You are the OPRN RPG editor assistant (v2). Split of work: you decide WHAT (the spec), functions decide HOW (deterministic builders), and other eyes (an independent critic and a screen check) look at the 1x picture.",
  "Reply to the user in the user's language (Korean for a Korean request). Keep Korean names, dialogue and place words as the user wrote them.",
  "Loop (todo list — the runner enforces it):",
  "1) For a change request, the first call is todo(op:\"init\") listing the whole request as steps, nothing left out — one item per place, person, dialogue, battle, link, ending and object, each with a check (machine check). A write verb called before the list is bounced.",
  "2) Build the in-progress item with a verb (make_place, edit_place, add_people, add_event, draw_object…), then todo done right away — done runs the machine check and will not close on ✗. Do not end the reply after calling only todo.",
  "3) If you cannot do it, close it with todo block (one-line reason) and move on. If a tool rejects, first try the other verb the rejection names. After 3 failures on one item the runner closes it as blocked.",
  "4) If you stop with open items, the runner sends you back with «remaining items · do now». Findings from function checks, the critic and the screen check come back appended to the list (with source) — fix them the same way or block them.",
  "5) Report in 3–6 lines in the user's language: what you built (map names) and what you could not. The runner attaches a machine-check table — if you claim «done» for a ✗ check, the table corrects you.",
  "Fixing a place: fix critic majors with one edit_place patch (1 round per map, gather everything in one patch). A placed piece of furniture that blocks a door or path or faces the wrong way: move_object (at→to · face · remove). An empty room or lots of bare floor: dress_room (mapId · at · purpose). Neither uses a round.",
  "Rules:",
  "- Never invent cell coordinates, tile numbers or plan strings. Name spots with words (entrance, square, in front of the counter…); pass only coordinates the critic gave you, as near/at.",
  "- To change a map that already exists, use edit_place(mapId=that map), not make_place. Never make_place the same place twice. Several floors go in one call via floors/zones.floor.",
  "- Report what you could not build for lack of art or parts (missingArt). Do not quietly swap in a similar object. For an object the chipset lacks, use draw_object (a drawing card — when the user picks, a follow-up «[공방에서 그려 넣음] … object id …» arrives; then place it with place_object).",
  "- Ask (ask_user) only at a real fork. Otherwise decide sensibly, build, and say «I decided this» in the report.",
].join("\n");

export const V2_CARDS: readonly string[] = [INTERIOR_CARD, VILLAGE_CARD, DUNGEON_CARD, JP_CITY_CARD, MODERN_KR_CARD, PEOPLE_CARD, EVENT_CARD, DRAW_OBJECT_CARD];

/**
 * 지금 프로젝트를 모델이 알 만큼만 — 맵(이름·칩셋·크기·사람 수·비었는지), 지금 보는 맵, 시작 맵.
 * 2026-10-30 실조수 e2e: 「map_blank_start 「버들 마을」 beodeul_city 20×15」처럼 칩셋 id 가 이름표 없이 맵 id 옆에 있어
 * 7번 중 5번 set_game_audio mapIds 에 칩셋 id 를 넣었다. 맵 id 는 `mapId=` 로, 칩셋은 괄호 안 `칩셋 …` 으로 이름을 붙인다.
 */
export function projectBrief(project: Project, currentMapId?: string): string {
  const maps = Object.values(project.maps).slice(0, 24).map((m) => {
    const filled = m.lowerTiles.some((t) => (t ?? -1) >= 0);
    const people = (m.events ?? []).filter((e) => e.pages?.[0]?.graphic).length;
    const marks = [m.id === project.startMapId ? "start map" : "", m.id === currentMapId ? "current map" : ""].filter(Boolean);
    const details = [`chipset ${m.tilesetId}`, `${m.width}×${m.height}`, ...(filled ? [] : ["empty map"]), ...(people ? [`people/objects ${people}`] : [])];
    return `- mapId=${m.id} 「${m.name}」 (${details.join(", ")})${marks.length ? ` ← ${marks.join("·")}` : ""}`;
  });
  return ["[Current project — fields that point at a map (mapId·mapIds) take the value after mapId=]", ...maps, Object.keys(project.maps).length > 24 ? `…first 24 of ${Object.keys(project.maps).length} maps` : ""].filter(Boolean).join("\n");
}

/** 요청·프로젝트가 맞을 때만 싣는 카드(각 한 장) — 몬스터 수집 마을, 두 선택 대화 장면. */
const MONSTER_WORDS = /포켓몬|몬스터 ?수집|monster[- ]?collect|pok[eé]mon|트레이너|체육관|연구소|몬스터 ?센터/iu;
const SCENE_WORDS = /대화 ?장면|선택지|고백|속마음|연애|데이트|첫 ?만남|romance|confess/iu;
export function conditionalCards(project: Project, currentMapId?: string, task = ""): string[] {
  const tileset = project.tilesets[project.maps[currentMapId ?? project.startMapId]?.tilesetId ?? ""];
  const monster = MONSTER_WORDS.test(task) || /^oprn-monster/u.test(tileset?.family ?? "");
  const contract = project.gameDesignBrief?.implementation?.harnessId === "romance-scene";
  const joseon = JOSEON_WORDS.test(task) || tileset?.id === "joseon_baram";
  return [...(monster ? [MONSTER_TOWN_CARD] : []), ...(joseon ? [JOSEON_CARD] : []), ...(WIZARDING_WORDS.test(task) || tileset?.id === "wizarding_world" ? [WIZARDING_CARD] : []), ...(contract || SCENE_WORDS.test(task) ? [SCENE_CARD] : []), ...(musicOnly(task) ? [`[Music-only request — only find, install and assign tracks. Do not change maps, events or objects (mention existing problems in the report as notes only)]\n${MUSIC_TIER.card}`] : wantsGameTools(task) ? [GAME_CARD, ...[fallenTierCard(task)].filter(Boolean)] : wantsMusicTools(task) ? [`[Music request — use these tools]\n${MUSIC_TIER.card}`] : []), ...(wantsTerrainTools(task) && !musicOnly(task) ? [TERRAIN_CARD] : []), ...(wantsStoreTools(task) ? [storeTierCard(task)] : []), ...(makeGameOn() && wantsMakeGame(task) ? [MAKE_GAME_CARD] : [])];
}

export function buildV2SystemPrompt(project: Project, currentMapId?: string, task?: string, todo?: TodoStore): string[] {
  // 청사진은 핵심 지시 바로 뒤에 박아 매 모델 차례가 대조하게 한다(2026-10-28). 게임 하나를 만드는 요청이면 청사진 카드도 싣는다.
  const whole = wantsWholeGame(task ?? "");
  // «계속» 요청이 앞 실행의 할 일을 이어 받았으면 그 목록을 싣는다 — init 하지 말고 이어서 진행한다.
  const carried = todo?.initialized && todo.items.length ? [`[Todo carried over from the previous run — do not todo init; continue from the open items]\n${todo.view(40, true)}`] : [];
  return [V2_CORE_PROMPT, ...carried, ...blueprintPin(project), "[Knowledge cards]", ...(whole || project.gameBlueprint ? [BLUEPRINT_CARD] : []), ...V2_CARDS, ...conditionalCards(project, currentMapId, task), projectBrief(project, currentMapId)];
}
