// 조수 v2 시스템 지시문 — 역할·고리·규칙 한 쪽 + 요청 종류별 지식 카드 + 지금 프로젝트 요약. 전체 8k 토큰 안(카드 합 ≈ 6천 자).
// 2026-10-30: 모델이 읽는 글은 영어다(싼 모델 gpt-6.1-terra 가 영어 지시를 더 잘 따른다). 코드가 맞추는 한국어 낱말·사용자 글 예시만 한국어로 남긴다.
// 바뀐 글은 scripts/qa/assistant-v2/dumpPrompt.mts 로 통째 본다.
import type { Project } from "@/project/types";
import { INTERIOR_CARD } from "./builders/interior";
import { HAND_INTERIOR_TILESET_ID } from "@/editor/handInterior/builder";
import { chipsetCatalog } from "./interiorCatalog";
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
import { gameCard, MUSIC_TIER, SOUND_TIER, TERRAIN_CARD, fallenTierCard, storeTierCard, wantsGameTools, wantsMusicTools, wantsSoundTools, wantsStoreTools, wantsTerrainTools } from "./game";
import { MAKE_GAME_CARD, makeGameOn, wantsMakeGame } from "./makeGame";
import { BLUEPRINT_CARD, blueprintPin } from "./blueprint";
import { wantsWholeGame } from "./shipChecks";
import { audioOnly, musicOnly, wantsMusic } from "./musicWords";
import { isFreshProject } from "./genreDefaults";
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
  "Fixing a place: fix critic majors with one edit_place patch (1 round per map, gather everything in one patch; an interior laid from spec.layout takes review_layout / layoutPatch rounds instead). A placed piece of furniture that blocks a door or path or faces the wrong way: move_object (at→to · face · remove). An empty room or lots of bare floor: dress_room (mapId · at · purpose) — but in an interior laid from spec.layout fill or shrink it yourself with review_layout. Neither uses a round.",
  "Rules:",
  "- Never invent cell coordinates, tile numbers or plan strings — except where a verb asks you to design the cells yourself: an interior's spec.layout (you write every wall, door and piece position; code lays it exactly and checks it), review_layout patches, a village's hints.layout and a dungeon's rooms[].at. Elsewhere name spots with words (entrance, square, in front of the counter…) and pass only coordinates the critic gave you, as near/at.",
  "- To change a map that already exists, use edit_place(mapId=that map), not make_place. Never make_place the same place twice. Several floors go in one call via floors/zones.floor.",
  "- Report what you could not build for lack of art or parts (missingArt). Do not quietly swap in a similar object. For an object the chipset lacks, use draw_object (a drawing card — when the user picks, a follow-up «[공방에서 그려 넣음] … object id …» arrives; then place it with place_object).",
  "- Ask (ask_user) only at a real fork. Otherwise decide sensibly, build, and say «I decided this» in the report.",
].join("\n");

export const V2_CARDS: readonly string[] = [INTERIOR_CARD, VILLAGE_CARD, DUNGEON_CARD, JP_CITY_CARD, MODERN_KR_CARD, PEOPLE_CARD, EVENT_CARD, DRAW_OBJECT_CARD];

/**
 * 지은 맵에 로직만 넣는 요청(editOnlyRequest)은 장소 짓기 지식 카드와 짓기 동사를 지시문·도구 목록에 싣지 않는다(2026-11-01 비용 분석 —
 * openwiki/assistant-v2.md 「토큰 비용 재기」). 실내·마을·던전·거리·사람·그리기 카드와 실내 칩셋 목록이 약 1.9만 토큰, make_place·edit_place 등
 * 짓기 동사가 약 1.6만 토큰인데, 로직 요청 18판에서 한 번도 쓰지 않으면서 호출마다 다시 읽었다.
 * 그런 요청이면 지시문에는 색인 한 줄(PLACE_SPEC_INDEX)만 두고, 짓기 동사는 load_tools 로, 카드는 read_specs 나 그 종류의 첫 짓기 호출이 기록(캐시 뒤쪽)으로 준다.
 * 게임 하나·장소 짓기·빈 프로젝트 요청은 예전 그대로 다 싣는다. 끄기: OPRN_V2_LEAN_PROMPT=0 (A/B 측정용).
 */
export function leanPromptOn(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.OPRN_V2_LEAN_PROMPT !== "0";
}
/** 장소를 짓거나 다시 짓는 요청 낱말 — 장소 이름 뒤 열두 글자 안에 짓기 동사, 또는 «새 ○○». 넉넉히 잡는다(잘못 맞으면 예전처럼 다 실을 뿐이다). */
const PLACE_NOUNS = "맵|지도|마을|도시|거리|골목|던전|동굴|미궁|탑|성|궁|방|실내|집|건물|가게|상점|여관|주점|교회|성당|신전|사당|숲|들판|필드|평원|항구|부두|광장|학교|병원|저택|감옥|지하|층|섬|산|장소|무대|공간|place|map|village|town|city|dungeon|cave|room|house|building|interior|street";
const BUILD_VERBS = "만들|지어|짓|그려|그리|깔아|깔|넓혀|넓히|키워|늘려|추가|하나 더|고쳐|바꿔|꾸며|꾸미|배치|build|make|add|create|expand|redesign|rebuild|draw";
export const PLACE_BUILD_WORDS = new RegExp(`(${PLACE_NOUNS})[^.!?\\n]{0,12}(${BUILD_VERBS})|(새|새로운|new)\\s*(${PLACE_NOUNS})`, "iu");
/** 이미 지은 게임에 로직·대사·데이터만 넣는 요청인가 — 게임 하나·첫 장소(빈 프로젝트)·장소 짓기 낱말이면 아니다. */
export function editOnlyRequest(project: Project, task: string): boolean {
  return !!task.trim() && !wantsWholeGame(task) && !wantsMakeGame(task) && !isFreshProject(project) && !PLACE_BUILD_WORDS.test(task);
}
/** 이 요청에 가벼운 지시문(장소 카드·짓기 동사를 필요할 때만)을 쓰나. */
export function leanPromptFor(project: Project, task: string | undefined): boolean {
  return leanPromptOn() && editOnlyRequest(project, task ?? "");
}
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

/** 요청·프로젝트가 맞을 때만 싣는 카드(각 한 장) — 몬스터 수집 마을, 두 선택 대화 장면. */
const MONSTER_WORDS = /포켓몬|몬스터 ?수집|monster[- ]?collect|pok[eé]mon|트레이너|체육관|연구소|몬스터 ?센터/iu;
const SCENE_WORDS = /대화 ?장면|선택지|고백|속마음|연애|데이트|첫 ?만남|romance|confess/iu;
/** 실내 칸 배치용 칩셋 목록 카드(영어, 만든 것) — 실내 요청이거나 지금 맵이 손 도트 실내일 때만 싣는다(약 4k 토큰). */
export const INTERIOR_WORDS = /실내|방|여관|주점|선술집|객잔|가게|상점|잡화|서재|도서|서고|감옥|뇌옥|감방|교회|성당|예배당|대장간|길드|집\s*안|부엌|연구실|inn|tavern|shop|store|library|study|jail|prison|room|interior|chapel|forge|guild|kitchen/iu;
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
export function conditionalCards(project: Project, currentMapId?: string, task = "", lean = false): string[] {
  const tileset = project.tilesets[project.maps[currentMapId ?? project.startMapId]?.tilesetId ?? ""];
  const monster = MONSTER_WORDS.test(task) || /^oprn-monster/u.test(tileset?.family ?? "");
  const contract = project.gameDesignBrief?.implementation?.harnessId === "romance-scene";
  const joseon = JOSEON_WORDS.test(task) || tileset?.id === "joseon_baram";
  // 가벼운 지시문이면 실내 칩셋 목록은 interior 카드와 함께 필요할 때 준다(placeSpecCards).
  const interior = !lean && (INTERIOR_WORDS.test(task) || tileset?.id === HAND_INTERIOR_TILESET_ID);
  return [...(interior ? [interiorCatalogCard(project, currentMapId, task)] : []), ...(monster ? [MONSTER_TOWN_CARD] : []), ...(joseon ? [JOSEON_CARD] : []), ...(WIZARDING_WORDS.test(task) || tileset?.id === "wizarding_world" ? [WIZARDING_CARD] : []), ...(contract || SCENE_WORDS.test(task) ? [SCENE_CARD] : []), ...(audioOnly(task) ? [`[${musicOnly(task) ? "Music" : "Sound-effect"}-only request — only find, install and assign sounds. Do not change maps, events or objects (mention existing problems in the report as notes only)]`, ...(wantsMusic(task) ? [MUSIC_TIER.card] : []), ...(wantsSoundTools(task) ? [SOUND_TIER.card] : [])] : wantsGameTools(task) ? [gameCard(), ...[fallenTierCard(task)].filter(Boolean), ...(wantsSoundTools(task) ? [`[Sound-effect request — use these tools]\n${SOUND_TIER.card}`] : [])] : wantsMusicTools(task) ? [...(wantsMusic(task) ? [`[Music request — use these tools]\n${MUSIC_TIER.card}`] : []), ...(wantsSoundTools(task) ? [`[Sound-effect request — use these tools]\n${SOUND_TIER.card}`] : [])] : []), ...(wantsTerrainTools(task) && !audioOnly(task) ? [TERRAIN_CARD] : []), ...(wantsStoreTools(task) ? [storeTierCard(task)] : []), ...(makeGameOn() && wantsMakeGame(task) ? [MAKE_GAME_CARD] : [])];
}

export function buildV2SystemPrompt(project: Project, currentMapId?: string, task?: string, todo?: TodoStore): string[] {
  // 청사진은 핵심 지시 바로 뒤에 박아 매 모델 차례가 대조하게 한다(2026-10-28). 게임 하나를 만드는 요청이면 청사진 카드도 싣는다.
  const whole = wantsWholeGame(task ?? "");
  // «계속» 요청이 앞 실행의 할 일을 이어 받았으면 그 목록을 싣는다 — init 하지 말고 이어서 진행한다.
  const carried = todo?.initialized && todo.items.length ? [`[Todo carried over from the previous run — do not todo init; continue from the open items]\n${todo.view(40, true)}`] : [];
  const lean = leanPromptFor(project, task);
  const cards = lean ? [EVENT_CARD, PLACE_SPEC_INDEX] : V2_CARDS;
  return [V2_CORE_PROMPT, ...carried, ...blueprintPin(project), "[Knowledge cards]", ...(whole || project.gameBlueprint ? [BLUEPRINT_CARD] : []), ...cards, ...conditionalCards(project, currentMapId, task, lean), projectBrief(project, currentMapId)];
}
