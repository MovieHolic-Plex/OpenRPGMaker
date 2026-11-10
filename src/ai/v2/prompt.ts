// 조수 v2 시스템 지시문 — 역할·고리·규칙 한 쪽 + 요청 종류별 지식 카드 + 지금 프로젝트 요약. 전체 8k 토큰 안(카드 합 ≈ 6천 자).
// 2026-10-30: 모델이 읽는 글은 영어다(싼 모델 gpt-6.1-terra 가 영어 지시를 더 잘 따른다). 코드가 맞추는 한국어 낱말·사용자 글 예시만 한국어로 남긴다.
// 바뀐 글은 scripts/qa/assistant-v2/dumpPrompt.mts 로 통째 본다.
import type { Project } from "@/project/types";
import { INTERIOR_CARD } from "./place/builders/interior";
import { HAND_INTERIOR_TILESET_ID } from "@/editor/handInterior/builder";
import { chipsetCatalog } from "./place/interiorCatalog";
import { VILLAGE_CARD } from "./place/builders/village";
import { DUNGEON_CARD } from "./place/builders/dungeon";
import { JP_CITY_CARD } from "./place/builders/jpCity";
import { MODERN_KR_CARD } from "./place/builders/modernCity";
import { JOSEON_CARD, JOSEON_WORDS } from "./place/builders/joseon";
import { WIZARDING_CARD, WIZARDING_WORDS } from "./place/builders/wizarding";
import { PEOPLE_CARD } from "./people";
import { EVENT_CARD } from "./story/events";
import { DRAW_OBJECT_CARD } from "./place/drawObject";
import { MONSTER_TOWN_CARD } from "./place/builders/monsterTown";
import { SCENE_CARD } from "./story/scene";
import { DRESS_CARD, gameCard, TERRAIN_CARD } from "./game";
import { MAKE_GAME_CARD, makeGameOn } from "./makeGame";
import { BLUEPRINT_CARD, blueprintPin } from "./blueprint";
import { TODO_LOOP_LINE } from "@/ai/agentRules";
import type { TodoStore } from "./loop/todoStore";
import { isComposedWorld, worldCard } from "./world";
import { worldForRequest } from "./request/world";
import { MUSIC_TIER, SOUND_TIER, fallenCard, storeCard } from "./request/toolGroups";
import { leanPromptFor } from "./request/readers";
import { classifyRequest, type RequestIntent } from "./request/intent";
import { INTERIOR_WORDS } from "./request/place";
import { MONSTER_WORDS, CHOICE_SCENE_WORDS } from "./request/genre";

export const V2_CORE_PROMPT = [
  "You are the OPRN RPG editor assistant (v2). Split of work: you decide WHAT (the spec), functions decide HOW (deterministic builders), and other eyes (an independent critic and a screen check) look at the 1x picture.",
  "Reply to the user in the user's language (Korean for a Korean request). Keep Korean names, dialogue and place words as the user wrote them.",
  "Loop (todo list — the runner enforces it):",
  TODO_LOOP_LINE,
  "2) Build the in-progress item with a verb (make_place, edit_place, add_people, add_event, draw_object…), then todo done right away — done runs the machine check and will not close on ✗. Do not end the reply after calling only todo.",
  "3) If you cannot do it, close it with todo block (one-line reason) and move on. If a tool rejects, first try the other verb the rejection names. The runner closes an item as blocked after 3 failures, or when the same failure comes back twice in a row — so change the call, do not repeat it.",
  "4) If you stop with open items, the runner sends you back with «remaining items · do now». Findings from function checks, the critic and the screen check come back appended to the list (with source) — fix them the same way or block them.",
  "5) Report in 3–6 lines: what you built (map names) and what you could not. The runner attaches a machine-check table — if you claim «done» for a ✗ check, the table corrects you.",
  "Fixing a place: fix critic majors with one edit_place patch (1 round per map, gather everything in one patch; an interior laid from spec.layout takes review_layout / layoutPatch rounds instead). A placed piece of furniture that blocks a door or path or faces the wrong way: move_object (at→to · face · remove). An empty room or lots of bare floor in an interior you laid from spec.layout: fill or shrink it yourself with review_layout. dress_room only fills a hand-pixel interior room that you did not design (it refuses designed rooms, outdoor maps, dungeons and world maps laid by build_places) — for those, stamp a prop with stamp_object or report it. None of these uses a round.",
  "Rules:",
  "- Never invent cell coordinates, tile numbers or plan strings — except where a verb asks you to design the cells yourself: an interior's spec.layout (you write every wall, door and piece position; code lays it exactly and checks it), review_layout patches, a village's hints.layout and a dungeon's rooms[].at. Elsewhere name spots with words (entrance, square, in front of the counter…); a tool that needs x,y or a rect gets only cells a tool or the critic gave you.",
  "- To change a map that already exists, use edit_place(mapId=that map), not make_place. Never make_place the same place twice. Several floors go in one call via floors/zones.floor.",
  "- Report what you could not build for lack of art or parts (missingArt). Do not quietly swap in a similar object. For an object the chipset lacks, use draw_object (a drawing card — the auto pick installs a candidate that passed review without waiting for the user, then a follow-up «[공방에서 그려 넣음] … object id …» arrives; place it with place_object. If «[공방에서 못 그림]» arrives instead, place the nearest existing object and report it; do not draw it again). Do not ask the user to pick.",
  "- Ask (ask_user) only at a real fork. Otherwise decide sensibly, build, and say «I decided this» in the report.",
].join("\n");

export const V2_CARDS: readonly string[] = [INTERIOR_CARD, VILLAGE_CARD, DUNGEON_CARD, JP_CITY_CARD, MODERN_KR_CARD, PEOPLE_CARD, EVENT_CARD, DRAW_OBJECT_CARD];
/** 가벼운 지시문에서 처음부터 싣지 않는 장소 짓기 동사(toolExposure.ts 가 load_tools 로 돌린다). add_people·move_object 같은 작은 동사는 남긴다. */
export const PLACE_BUILD_VERBS: ReadonlySet<string> = new Set(["make_place", "edit_place", "review_layout", "dress_room", "room_parts", "dungeon_parts", "find_pieces", "draw_object"]);
export const PLACE_SPEC_KINDS = ["interior", "village", "dungeon", "street", "people", "draw_object"] as const;
export type PlaceSpecKind = (typeof PLACE_SPEC_KINDS)[number];
export const PLACE_SPEC_INDEX = "[Place specs — not loaded] This request works on maps that already exist (events, logic, dialogue, database), so the place-building tools (make_place, edit_place, review_layout, dress_room, room_parts, dungeon_parts, find_pieces, draw_object) and their specs are left out. If you really must build or rebuild a place, load the tool with load_tools and read its spec first with read_specs{names:[…]} — interior (inns, shops, studies, jails, houses inside; with the interior chipset catalog), village, dungeon (also caves), street (modern Japan/Korea streets and houses), people (NPCs, for add_people), draw_object. A build call whose spec you have not read returns the spec instead of building (not a failure) — then call it again following the spec.";
/** 장소 종류(make_place type) → 지식 카드 종류. */
export function placeSpecKindOf(type: string | undefined): PlaceSpecKind | undefined {
  if (type === "interior") return "interior";
  if (type === "village") return "village";
  if (type === "dungeon" || type === "cave") return "dungeon";
  if (type === "street" || type === "house") return "street";
  return undefined;
}
/** 한 종류의 카드 글(실내는 칩셋 목록까지). */
export function placeSpecCards(kind: PlaceSpecKind, project?: Project, currentMapId?: string, task = ""): string[] {
  switch (kind) {
    case "interior": return [INTERIOR_CARD, interiorCatalogCard(project, currentMapId, task)];
    case "village": return [VILLAGE_CARD];
    case "dungeon": return [DUNGEON_CARD];
    case "street": return [JP_CITY_CARD, MODERN_KR_CARD];
    case "people": return [PEOPLE_CARD];
    case "draw_object": return [DRAW_OBJECT_CARD];
  }
}

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
let catalogCard: string | undefined;
/** 칸 배치 목록 카드 — 칩셋 메타데이터에서 생성(interiorCatalog.ts). 지금 맵의 칩셋이 방 역할표를 가진 실내 칩셋이면 그것, 아니면 손 도트 실내 v5. */
export function interiorCatalogCard(project?: Project, currentMapId?: string, task = ""): string {
  const cur = project?.tilesets[project.maps[currentMapId ?? project.startMapId]?.tilesetId ?? ""];
  const v5 = project?.tilesets[HAND_INTERIOR_TILESET_ID];
  const fromCur = cur && cur.id !== HAND_INTERIOR_TILESET_ID && cur.roomKit ? chipsetCatalog(cur, task) : undefined;
  if (fromCur) return fromCur;
  if (v5) { const c = chipsetCatalog(v5, task); if (c) return c; }
  catalogCard ??= chipsetCatalog({ id: HAND_INTERIOR_TILESET_ID } as never, task) ?? `[Interior catalog — chipset ${HAND_INTERIOR_TILESET_ID}] (no spec)`;
  return catalogCard;
}
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
