// 조수 v2 시스템 지시문 — 역할·고리·규칙 한 쪽 + 요청 종류별 지식 카드 + 지금 프로젝트 요약. 전체 8k 토큰 안(카드 합 ≈ 6천 자).
// 2026-10-30: 모델이 읽는 글은 영어다(싼 모델 gpt-6.1-terra 가 영어 지시를 더 잘 따른다). 코드가 맞추는 한국어 낱말·사용자 글 예시만 한국어로 남긴다.
// 바뀐 글은 scripts/qa/assistant-v2/dumpPrompt.mts 로 통째 본다.
import type { Project } from "@/project/types";
import { HAND_INTERIOR_TILESET_ID } from "@/editor/handInterior/builder";
import { JOSEON_CARD, JOSEON_WORDS } from "../place/builders/joseon";
import { WIZARDING_CARD, WIZARDING_WORDS } from "../place/builders/wizarding";
import { PEOPLE_CARD } from "../people";
import { EVENT_CARD } from "../story/events";
import { DRAW_OBJECT_CARD } from "../place/drawObject";
import { MONSTER_TOWN_CARD } from "../place/builders/monsterTown";
import { SCENE_CARD } from "../story/scene";
import { DRESS_CARD, TERRAIN_CARD } from "./mapEditCards";
import { gameCard } from "./gameCard";
import { MAKE_GAME_CARD, makeGameOn } from "../makeGame";
import { BLUEPRINT_CARD, blueprintPin } from "../blueprint";
import type { TodoStore } from "../loop/todoStore";
import { isComposedWorld, worldCard } from "../world";
import { worldForRequest } from "../request/world";
import { MUSIC_TIER, SOUND_TIER, fallenCard, storeCard } from "../request/toolGroups";
import { leanPromptFor } from "../request/readers";
import { classifyRequest, type RequestIntent } from "../request/intent";
import { INTERIOR_WORDS } from "../request/place";
import { MONSTER_WORDS, CHOICE_SCENE_WORDS } from "../request/genre";
import { V2_CORE_PROMPT } from "./core";
import { V2_CARDS, PlaceSpecKind, PLACE_SPEC_INDEX, interiorCatalogCard } from "./placeSpecs";
import { projectBrief } from "./projectBrief";
/** 요청·프로젝트가 맞을 때만 싣는 카드. lean 이면(장소를 짓지 않는 요청·구성기 세계) 실내 칩셋 목록은 싣지 않는다 — read_specs 가 준다. */
export function conditionalCards(project: Project, currentMapId?: string, task = "", lean = false): string[] {
  const intent = classifyRequest(task, project);
  const { topic, audio, tools } = intent;
  const tileset = project.tilesets[project.maps[currentMapId ?? project.startMapId]?.tilesetId ?? ""];
  const monster = MONSTER_WORDS.test(topic) || /^oprn-monster/u.test(tileset?.family ?? "");
  const contract = project.gameDesignBrief?.implementation?.harnessId === "romance-scene";
  const joseon = JOSEON_WORDS.test(topic) || tileset?.id === "joseon_baram";
  const wizarding = WIZARDING_WORDS.test(topic) || tileset?.id === "wizarding_world";
  // 실내 칩셋 목록(약 1.6만 자)은 실내 방을 짓거나 고치는 요청에만 싣는다 — 「상점 주인 세워 줘」의 「상점」은 방을 짓는 말이 아니다.
  const interior = !lean && (INTERIOR_WORDS.test(topic) || tileset?.id === HAND_INTERIOR_TILESET_ID);
  const soundCard = audio.sound ? [`[Sound-effect request — use these tools]\n${SOUND_TIER.card}`] : [];
  const byRequest = audio.only
    ? [`[${audio.musicOnly ? "Music" : "Sound-effect"}-only request — only find, install and assign sounds. Do not change maps, events or objects (mention existing problems in the report as notes only)]`, ...(audio.music ? [MUSIC_TIER.card] : []), ...(audio.sound ? [SOUND_TIER.card] : [])]
    : tools.game ? [gameCardFor(intent), ...[fallenCard(tools)].filter(Boolean), ...soundCard]
      : [...(audio.music ? [`[Music request — use these tools]\n${MUSIC_TIER.card}`] : []), ...soundCard];
  return [
    ...(interior ? [interiorCatalogCard(project, currentMapId, task)] : []), ...(monster ? [MONSTER_TOWN_CARD] : []), ...(joseon ? [JOSEON_CARD] : []), ...(wizarding ? [WIZARDING_CARD] : []),
    ...(contract || CHOICE_SCENE_WORDS.test(topic) ? [SCENE_CARD] : []), ...byRequest,
    ...(tools.terrain && !audio.only ? [TERRAIN_CARD] : []), ...(tools.dress && !audio.only ? [DRESS_CARD] : []), ...(tools.store ? [storeCard(tools)] : []),
    ...(makeGameOn() && intent.makeGame ? [MAKE_GAME_CARD] : []),
  ];
}
/** 게임 카드 — 게임 하나를 짓는 요청은 전부, 그 밖의 요청은 늘 싣는 줄과 요청이 말한 주제의 줄만. */
function gameCardFor(intent: RequestIntent): string {
  return intent.wholeGame ? gameCard() : gameCard(intent.topics);
}
/**
 * 작은 일(장소를 짓지 않는 요청)의 카드 — 그 일이 쓰는 것만. 사람을 세우면 사람 카드, 사건·대사를 짜면 이벤트 카드, 옮기기·지우기·소리·질문이면 없음.
 * 장소 카드는 색인 한 줄(PLACE_SPEC_INDEX)로 두고 read_specs 가 준다. 이어 하기가 게임 하나를 잇는 턴은 이벤트 카드를 늘 싣는다.
 */
/** 작은 일의 지시문이 이미 싣고 있는 카드 종류 — 동사가 «이 카드를 아직 안 줬다» 며 같은 카드를 한 번 더 돌려주지 않게(tools/context.ts specShown). */
export function smallJobCardKinds(project: Project, task: string): readonly PlaceSpecKind[] {
  const intent = classifyRequest(task, project);
  return intent.scope !== "audio" && intent.job.people ? ["people"] : [];
}
function smallJobCards(intent: RequestIntent): string[] {
  if (intent.scope === "audio") return [];
  const events = intent.wholeGame || (!intent.job.moveOnly && (intent.scope !== "question" || intent.job.logic));
  return [...(intent.job.people ? [PEOPLE_CARD] : []), ...(events ? [EVENT_CARD] : []), PLACE_SPEC_INDEX];
}

const WORLD_CARDS: readonly string[] = [PEOPLE_CARD, EVENT_CARD, DRAW_OBJECT_CARD];

export function buildV2SystemPrompt(project: Project, currentMapId?: string, task?: string, todo?: TodoStore, projectKey?: string): string[] {
  const intent = classifyRequest(task, project);
  // «계속» 요청이 앞 실행의 할 일을 이어 받았으면 그 목록을 싣는다 — init 하지 말고 이어서 진행한다.
  const carried = todo?.initialized && todo.items.length ? [`[Todo carried over from the previous run — do not todo init; continue from the open items]\n${todo.view(40, true)}`] : [];
  const lean = leanPromptFor(project, task);
  // 이 게임의 세계(게임마다 다른 칩셋 한 벌) — 청사진 카드 바로 뒤에 싣는다. 구성기 세계면 장소 설계 카드는 싣지 않는다.
  const world = worldForRequest(project, projectKey, task);
  const composed = isComposedWorld(world);
  const cards = lean ? smallJobCards(intent) : composed ? WORLD_CARDS : V2_CARDS;
  // 청사진은 핵심 지시 바로 뒤에 박아 매 모델 차례가 대조하게 한다. 청사진 쓰는 법(카드)은 게임 하나를 짓는 턴과 장소를 짓는 턴에만 싣는다.
  const blueprintCard = intent.wholeGame || (!!project.gameBlueprint && !lean);
  return [V2_CORE_PROMPT, ...carried, ...blueprintPin(project), "[Knowledge cards]", ...(blueprintCard ? [BLUEPRINT_CARD] : []), ...(world ? [worldCard(world)] : []), ...cards, ...conditionalCards(project, currentMapId, task, lean || composed), projectBrief(project, currentMapId)];
}
