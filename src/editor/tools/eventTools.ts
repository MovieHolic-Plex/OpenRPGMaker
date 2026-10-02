import { passageBlockWarning } from "../../project/eventPassageBlock";
import { CONFIGURE_OBJECT_BEHAVIOR, PURSUIT_SCHEMA, parsePursuit } from "./horrorBehaviorTools";
// editor/tools/eventTools.ts
// 이벤트 쓰기 툴: upsert_event / place_npc / create_transfer_pair / place_battle_blocker
//              / duplicate_event / remove_event / move_event.

import { shadowedPageWarnings } from "@/project/eventPageShadow";
import { EVENT_ANIMATION_TYPES } from "@/project/types";
import { projectSetterShadowedPages } from "@/project/eventPageSetterShadow";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { buildStoryFlagUsageIndex, usageBucketFor } from "@/project/storyFlagUsage";
import { ACTION_CONTROLS_GUIDE } from "@/player/keyBindings";
import { EventPlacementAnalysis, eventRequiresPassableTile } from "@/project/eventPlacementRecovery";
import { canMove, isPassable, tileAt } from "@/project/collision";
import { normalizeLightingState } from "@/project/lightingRules";
import { isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { roleCapabilities } from "@/project/tileRoles";
import { isSeason, isTimePhase, resolveTimeSystem, type Season } from "@/project/gameTime";
import { validateConditionShape, validateShopStock } from "@/project/io/shapeCommandFields";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { countLimitedRuntimeSupportCommandsForEvent } from "@/project/lint/projectLint";
import { genId } from "@/util/id";
import { chestOpenCommands, chestOpenedGraphic, lootGrantCommands } from "@/editor/lootFeedback";
import { buildMapPlacementContext } from "@/ai/mapPlacementContext";
import type { Command, Condition, Dir, EventPage, EventPageCondition, EventPageGraphic, FaceGraphic, GameEvent, GameMap, GiftPrefs, GiftResponses, NpcScheduleEntry, NpcScheduleWhen, Project, SelfSwitchKey, ShopStockEntry, TransferFade, Trigger } from "@/project/types";
import {
  canonicalizeSayBeatAliases,
  compileCutscene,
  CutsceneValidationError,
  SAY_BEAT_ALIAS_WARNING,
  type CutsceneBeat,
} from "@/editor/cutscene";
import { sharedFaceForCharset } from "@/project/sharedCharacterFaceResolver";
import { reconcileFaceWithCharset } from "@/assets/reviewedCharsetFaces";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { searchResources } from "@/assets/resourceSearch";
import {
  charsetGraphic,
  compileSimplePages,
  resolveGraphic,
  resolveGraphicQuery,
  usedCharsetGraphicKeysOnMap,
  type GraphicSpec,
} from "./eventCompile";
import { normalizeLowLevelCommandArray, validateLowLevelCommandArray } from "./commandArgs";
import { assertEventPartyActorReferences } from "./partyActorReferences";
import { declareReferencedFlags, declaredFlagsWarning, ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { buildFieldMonsterEvent } from "@/project/fieldMonsterTemplate";
import { inMapBounds, requireMap, type Point } from "./mapHelpers";
import { ToolError, type SimplePage, type ToolDefinition, type ToolExecResult } from "./types";
import { isFlushPassable, snapFlushToWall } from "./wallFlush";
import { reachableGateCandidates, transferGatesStayApproachable, transferTileSeversWalk, walkableFromAnchors } from "./transferReachability";
import {
  COMMAND_SCHEMA,
  COORD_SCHEMA,
  CUTSCENE_BEAT_SCHEMA,
  FACE_SCHEMA,
  GRAPHIC_SPEC_SCHEMA,
  ITEM_AMOUNT_SCHEMA,
  NATIVE_EVENT_PAGE_SCHEMA,
  RECT_SCHEMA,
  SIMPLE_PAGE_SCHEMA,
} from "./schemaShapes";

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };
const WANDER: EventPage["movement"] = { type: "random", speed: 2, frequency: 3 };
const STALK: EventPage["movement"] = { type: "approach", speed: 3, frequency: 3 };

/** NPC 이름 기반 이동 아키타입. 명시 movement가 없을 때만 추론한다(명시 우선). */
type NpcMovementArchetype = "anchored" | "roaming" | "stalking" | "ambiguous";

function inferNpcMovementArchetype(name: string): NpcMovementArchetype {
  const spaced = name.trim().toLowerCase();
  const needle = spaced.replace(/\s+/g, "");
  if (!needle) return "ambiguous";
  // 스토커가 최우선: "경비 추격자"는 다가와야지 문지기가 아니다.
  if (/추격|습격|매복|스토커|stalker|ambush|chaser/u.test(needle)) return "stalking";
  if (isShopRoleNpcName(name) || /문지기|경비|간판|안내판|안내인|gatekeeper|guard|signboard/u.test(needle)) return "anchored";
  // 한 글자 토큰(개·새)은 독립 단어일 때만 친다 — "소개"가 배회하는 오탐 방지.
  if (spaced.split(/\s+/).includes("개") || spaced.split(/\s+/).includes("새")) return "roaming";
  if (/아이|꼬마|어린이|행상|떠돌이|배회|유랑|방랑|동물|강아지|고양이|닭|돼지|kid|child|peddler|wanderer|stray|dog|cat|chicken/u.test(needle)) return "roaming";
  return "ambiguous";
}

/**
 * 생략된 movement를 아키타입으로 추론한다. 명시값은 그대로 쓰고, 추론 결과는
 * warnings에 남겨 모델이 다음 호출에서 명시하도록 유도한다.
 */
function resolveNpcMovement(
  name: string,
  explicit: unknown,
  warnings: string[],
): EventPage["movement"] {
  if (typeof explicit === "string" && explicit.trim()) {
    const trimmed = explicit.trim();
    if (trimmed === "random") return WANDER;
    if (trimmed === "approach") return STALK;
    return PASSIVE;
  }
  switch (inferNpcMovementArchetype(name)) {
    case "roaming":
      warnings.push(`이동 추론 → random(배회): '${name}' 아키타입. 고정하려면 movement:"fixed" 명시.`);
      return WANDER;
    case "stalking":
      warnings.push(`이동 추론 → approach(접근): '${name}' 아키타입. 고정하려면 movement:"fixed" 명시.`);
      return STALK;
    case "anchored":
      warnings.push(`이동 추론 → fixed(제자리): '${name}' 대화 거점 아키타입. 배회시키려면 movement:"random" 명시.`);
      return PASSIVE;
    case "ambiguous":
      return PASSIVE;
  }
}
const DIALOGUE_COMMAND_KINDS: ReadonlySet<string> = new Set(["text", "choices"]);

/** place_npc/make_villager face 인자 → FaceGraphic. 실제 배치된 charset 기준으로 맞춘다. */
function resolvePlaceNpcFaceArg(
  faceArg: unknown,
): FaceGraphic | null | undefined {
  if (faceArg && typeof faceArg === "object" && !Array.isArray(faceArg)) {
    const rec = faceArg as Record<string, unknown>;
    if (typeof rec.resourceId === "string" && rec.resourceId.trim()) {
      return {
        resourceId: rec.resourceId.trim(),
        position: rec.position === "right" ? "right" : "left",
        flipHorizontally: rec.flipHorizontally === true,
      };
    }
    if (typeof rec.textureKey === "string") {
      return sharedFaceForCharset(
        rec.textureKey,
        typeof rec.characterIndex === "number" ? rec.characterIndex : 0,
      );
    }
  }
  // Let the compiler resolve each page’s actual graphic against the shared catalog.
  return undefined;
}
const LOW_LEVEL_TOOL_DESCRIPTION_PREFIX = "먼저 위 고수준 툴이 목적에 맞는지 확인하라(트랩=place_trap, 퍼즐=compile_puzzle, 컷신=script_cutscene 등). 이 툴은 커스텀 로직 전용.";
const UPSERT_EVENT_NPC_HINT = "NPC 배치가 목적이면 place_npc {mapId,x,y,name,pages}를 사용하세요.";
const PLACE_NPC_OBJECT_GIMMICK_HINT = "보물상자·보관 상자·세이브포인트 등 오브젝트 기믹은 place_chest/place_storage_chest/place_savepoint를 사용하세요 — place_npc로 흉내내지 마세요.";
const DIRS: readonly Dir[] = ["down", "left", "right", "up"];

const npcScheduleSchema = {
  type: "array" as const,
  description: "NpcScheduleEntry[]",
  items: {
    type: "object" as const,
    properties: {
      when: {
        type: "object" as const,
        properties: {
          timePhase: { type: "string" as const, enum: ["morning", "day", "evening", "night"] },
          hourRange: { type: "array" as const, items: { type: "number" as const } },
          season: { type: "string" as const, enum: ["spring", "summer", "fall", "winter"] },
          dayRange: { type: "array" as const, items: { type: "number" as const } },
        },
      },
      at: {
        type: "object" as const,
        properties: { mapId: { type: "string" as const }, x: { type: "integer" as const }, y: { type: "integer" as const } },
      },
      facing: { type: "string" as const, enum: ["down", "left", "right", "up"] },
      activity: { type: "string" as const },
    },
  },
};

const shopStockSchema = {
  type: "array" as const,
  description: "ShopStockEntry[]: {itemId,seasons?,priceOverride?,priceBySeason?}",
  items: {
    type: "object" as const,
    properties: {
      itemId: { type: "string" as const },
      seasons: { type: "array" as const, items: { type: "string" as const, enum: ["spring", "summer", "fall", "winter"] } },
      priceOverride: { type: "integer" as const },
      priceBySeason: {
        type: "object" as const,
        description: "{spring?:number,summer?:number,fall?:number,winter?:number}",
        additionalProperties: true,
      },
    },
    required: ["itemId"],
  },
};

const giftPrefsSchema = {
  type: "object" as const,
  description: "{loved?:itemId[], liked?:itemId[], disliked?:itemId[]}",
  properties: {
    loved: { type: "array" as const, items: { type: "string" as const } },
    liked: { type: "array" as const, items: { type: "string" as const } },
    disliked: { type: "array" as const, items: { type: "string" as const } },
  },
};

const giftResponsesSchema = {
  type: "object" as const,
  description: "{loved?, liked?, neutral?, disliked?, alreadyGifted?, noItems?}",
  additionalProperties: true,
};

function knownIds(records: readonly { readonly id: string }[], limit = 8): string {
  return records.slice(0, limit).map((record) => record.id).join(", ") || "(없음)";
}

function describeValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(length:${value.length})`;
  if (typeof value === "object") return `object(keys:${Object.keys(value as Record<string, unknown>).slice(0, 4).join(",")})`;
  return typeof value;
}

/** 실내 시공기가 가구마다 자동으로 단 「조사」 이벤트(ev_inspect_*) — 맛 대사 하나뿐인 자리표시다. */
function isAutoInspectEvent(event: GameEvent): boolean {
  return event.id.startsWith("ev_inspect_");
}

/**
 * 저작한 이벤트가 자동 조사 이벤트와 같은 칸에 놓이면 조사 이벤트를 걷어낸다. 둘이 겹치면 런타임이
 * 아래(below) 조사 이벤트를 먼저 집어 상자·NPC 가 영영 반응하지 않았다(2026-09-23 도그푸딩:
 * 동굴 (3,6) chest_cave_potion 과 술통 조사 ev_inspect_…_9_5). 걷어낸 id 를 돌려준다.
 */
export function displaceAutoInspectEvents(map: GameMap, event: GameEvent): string[] {
  if (isAutoInspectEvent(event)) return [];
  const displaced = map.events.filter(entry => entry.id !== event.id && isAutoInspectEvent(entry) && entry.x === event.x && entry.y === event.y);
  if (displaced.length === 0) return [];
  const ids = new Set(displaced.map(entry => entry.id));
  map.events = map.events.filter(entry => !ids.has(entry.id));
  return [...ids];
}

// 맵의 이벤트를 id로 upsert(있으면 교체, 없으면 push).
export function upsertEventIntoMap(map: GameMap, event: GameEvent): "added" | "modified" {
  displaceAutoInspectEvents(map, event);
  const index = map.events.findIndex((entry) => entry.id === event.id);
  if (index >= 0) {
    map.events[index] = event;
    return "modified";
  }
  map.events.push(event);
  return "added";
}

function commandArrayOrEmpty(value: unknown, label: string, warnings?: string[]): Command[] {
  return normalizeLowLevelCommandArray(value, label, warnings);
}

function normalizeEventCommandArrays(event: GameEvent, warnings?: string[], supplied: Partial<GameEvent> = event): void {
  if (supplied === event || Object.prototype.hasOwnProperty.call(supplied, "commands")) {
    event.commands = commandArrayOrEmpty(event.commands, `${event.id}.commands`, warnings);
  }
  if (!Object.prototype.hasOwnProperty.call(supplied, "pages") || event.pages === undefined || event.pages === null) return;
  if (!Array.isArray(event.pages)) {
    throw new ToolError(`이벤트 형식이 올바르지 않습니다: ${event.id}.pages는 배열이어야 합니다. 실제 타입: ${describeValue(event.pages)}`, {
      code: "invalid-args",
    });
  }
  for (const [index, page] of event.pages.entries()) {
    if (typeof page !== "object" || page === null || Array.isArray(page)) continue;
    const pageId = typeof page.id === "string" ? page.id : `pages[${index}]`;
    (page as EventPage).commands = commandArrayOrEmpty((page as { commands?: unknown }).commands, `${event.id}.${pageId}.commands`, warnings);
    fillRequiredPageFields(event, page as Partial<EventPage>, pageId, warnings);
  }
}

/**
 * 말을 걸어야 실행되는데 그래픽이 비어 있는 페이지는 "보이지 않는 NPC" 다 — 플레이어가 찾을
 * 방법이 없으므로 의도된 저작이 아니다. 투명 이벤트를 원할 때는 `graphic:{transparent:true}` 가
 * 명시적 경로이므로, 그 표시가 없는 대화형 action 페이지에만 주민 기본 그래픽을 채운다.
 */
/**
 * 타일로 그려진 가구·문 위의 조사 지점(place_concept 가구, 벽·문 칸). 그림은 타일이 맡으므로 이벤트는
 * 투명한 게 의도다 — 여기에 주민 그림을 세우면 금고·현관문·옷장이 사람으로 보인다(2026-09-24 추격 호러).
 */
const TILE_HOTSPOT_EVENTS = new WeakSet<GameEvent>();

/**
 * upsert_event 가 기존 이벤트의 pages 를 통째로 바꿀 때, 바뀌기 전 그 이벤트의 그림.
 * 새 페이지에 graphic 이 없으면 기본 주민이 아니라 이 그림을 이어 쓴다 — 2026-09-24 연애 도그푸딩:
 * place_npc 로 「girl」「woman」「boy」 를 따로 입힌 공략 인물 셋이 대사를 고치는 upsert_event 한 번씩에
 * 전부 같은 기본 주민(people1 #25)이 됐다.
 */
const PREVIOUS_EVENT_LOOK = new WeakMap<GameEvent, EventPageGraphic>();

const GENERIC_NPC_NAME = /주민|마을 ?사람|행인|손님|병사|경비|상인|점원|아이|villager|guard|merchant|citizen/iu;

/**
 * 다른 맵에 같은 이름으로 이미 선 인물의 외형. 한 인물이 맵마다 다른 사람처럼 보이면 안 된다 —
 * 2026-09-24 연애 도그푸딩: 축제 광장에 다시 세운 공략 인물 셋이 query 가 달라 평소와 다른 얼굴이 됐다.
 * 일반 역할 이름(주민·상인·경비 …)은 여러 사람이므로 건너뛴다.
 */
function recurringCharacterLook(project: Project, mapId: string, name: string): { mapId: string; graphic: EventPageGraphic } | undefined {
  const trimmed = name.trim();
  if (trimmed.length < 2 || GENERIC_NPC_NAME.test(trimmed)) return undefined;
  for (const map of Object.values(project.maps)) {
    if (map.id === mapId) continue;
    for (const event of map.events) {
      if (event.name?.trim() !== trimmed) continue;
      const graphic = eventLook(event);
      if (graphic) return { mapId: map.id, graphic };
    }
  }
  return undefined;
}

function eventLook(event: GameEvent | undefined): EventPageGraphic | undefined {
  const graphic = event?.pages?.find((page) => page.graphic?.sprite !== undefined && page.graphic.transparent !== true)?.graphic;
  return graphic ? structuredClone(graphic) : undefined;
}

/** 이름에 이 낱말이 있으면 말하는 존재로 본다(주민 그림을 세운다). */
const SPEAKING_BEING_WORDS = /사람|주민|아이|소녀|소년|아가씨|청년|노인|할머니|할아버지|아저씨|아주머니|아줌마|여인|남자|여자|상인|점원|주인|손님|경비|병사|기사|마법사|의사|박사|탐정|집사|신부|수녀|왕|공주|왕자|어부|농부|사냥꾼|그림자|유령|요정|정령|괴물|몬스터|인형|villager|person|npc|man|woman|girl|boy|guard|ghost/iu;

/**
 * 투명 action 페이지가 말하는 인물이 아니라 조사할 사물인가 — 그렇다면 주민 그림 대신 쓸 그래픽.
 *
 * 2026-09-24 꿈 세계 도그푸딩: 「기억의 거울」「타오르는 촛대」「버려진 우산」「고양이 석상」「오래된 사진 액자」가
 * 전부 주민 기본 charset(people1)으로 저장돼, 플레이어는 거울·촛대 자리에 서 있는 마을 사람을 봤다. 화자(speaker)가
 * 있는 대사나 인물 낱말이 든 이름이면 null(주민 그림 유지). 사물이면 이름 낱말과 라벨 낱말이 정확히 겹치는
 * charset(문·상자…)을, 없으면 투명을 준다.
 */
function objectEventGraphic(event: GameEvent, page: Partial<EventPage>): { graphic: EventPage["graphic"]; label: string } | null {
  if (event.characterId) return null;
  const name = (event.name ?? "").trim();
  if (allPageCommands(page.commands).some((command) => command.kind === "text"
    && ((typeof command.speaker === "string" && command.speaker.trim()) || bodyNamesSpeaker(command.body, name)))) return null;
  if (!name) return objectGraphicFromId(event.id);
  if (SPEAKING_BEING_WORDS.test(name)) return null;
  // 머리 명사(괄호 앞 마지막 낱말)만 본다 — 「붉은 문」의 「붉은」이 붉은 몬스터를, 「고양이 석상」의 「고양이」가
  // 산 고양이를 고르면 안 된다.
  const head = name.replace(/[(（].*$/u, "").trim().split(/[\s·,/]+/u).filter(Boolean).at(-1);
  // 이름 전체가 라벨과 같으면 그 칸이 먼저다 — 「감옥 문」이 머리 명사 「문」만 보고 나무 문이 되던 경로(2026-09-27).
  const whole = name.replace(/[(（].*$/u, "").trim();
  const exact = searchResources("charset", whole).find((hit) => hit.label.replace(/[(（].*$/u, "").trim() === whole);
  const exactParsed = exact ? /^charset:(.+):(\d+)$/u.exec(exact.id) : null;
  if (exactParsed) return { graphic: charsetGraphic(exactParsed[1]!, Number(exactParsed[2])), label: exact!.label };
  for (const hit of head ? searchResources("charset", head).slice(0, 6) : []) {
    // 라벨의 머리 명사끼리 맞아야 한다. 라벨 낱말 어디든 맞으면 「큰 나무」가 「나무 문(패널)」 그림을 받았다(2026-09-27).
    const labelHead = hit.label.replace(/[(（].*$/u, "").trim().split(/[\s·,/]+/u).filter(Boolean).at(-1);
    if (labelHead !== head) continue;
    const parsed = /^charset:(.+):(\d+)$/u.exec(hit.id);
    if (parsed) return { graphic: charsetGraphic(parsed[1]!, Number(parsed[2])), label: hit.label };
  }
  return { graphic: { transparent: true }, label: "" };
}

/** 영문 id 가 가리키는 사물 — 문은 문 그림, 나머지 사물은 투명. id 에 인물 낱말이 있거나 뜻을 모르면 null(주민 그림). */
const OBJECT_ID_WORDS = /(?:^|_)(door|gate|portal|mirror|candle|altar|diary|book|drawer|desk|bed|window|statue|clock|eye|photo|picture|frame|umbrella|chest|box|sign|shelf|lamp|stair|stairs|well|grave|painting|vase|table|chair|closet|wardrobe|safe|note|letter|item|prop|object|obj|hotspot|examine)(?:_|$|\d)/iu;
const BEING_ID_WORDS = /(?:^|_)(npc|person|people|man|woman|girl|boy|kid|child|villager|guard|shadow|ghost|dancer|resident|merchant|keeper|old|lady|spirit|fairy|monster|cat|dog|bird|character|chara)(?:_|$|\d)/iu;

function objectGraphicFromId(id: string): { graphic: EventPage["graphic"]; label: string } | null {
  if (BEING_ID_WORDS.test(id) || !OBJECT_ID_WORDS.test(id)) return null;
  if (/(?:^|_)(door|gate|portal)(?:_|$|\d)/iu.test(id)) {
    const hit = searchResources("charset", "문").find((entry) => /문/u.test(entry.label));
    const parsed = hit ? /^charset:(.+):(\d+)$/u.exec(hit.id) : null;
    if (parsed) return { graphic: charsetGraphic(parsed[1]!, Number(parsed[2])), label: hit!.label };
  }
  return { graphic: { transparent: true }, label: "" };
}

/**
 * 이벤트 최상위 `graphic`(GameEvent 에 없는 필드)을 그림 없는 페이지의 기본값으로 쓴다.
 *
 * 2026-09-24 연애 도그푸딩: 조수가 공략 인물 셋에 `event.graphic:{sprite:actor1, pattern:25/28/31}` 을 정확히 줬는데
 * 도구는 조용히 버렸다 — 페이지는 그림 없이 발밑·투명이 돼 세 인물이 전부 보이지 않았다. 최상위 trigger·commands 를
 * 페이지로 옮기는 것과 같은 규칙이다.
 */
function applyEventLevelGraphic(draft: Project, map: GameMap, event: GameEvent, patch: Partial<GameEvent>, warnings: string[]): void {
  const raw = (patch as { graphic?: unknown }).graphic;
  delete (event as { graphic?: unknown }).graphic;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  let graphic: EventPageGraphic;
  try {
    graphic = "query" in raw || "textureKey" in raw
      ? resolveGraphic(raw as GraphicSpec, { avoidKeys: usedCharsetGraphicKeysOnMap(map), seed: `${map.id}:${event.id}`, overrides: draft.charsetLabels })
      : structuredClone(raw) as EventPageGraphic;
  } catch (error) {
    if (!(error instanceof ToolError)) throw error;
    warnings.push(`event.graphic 을 해석하지 못해 버렸습니다: ${error.message}`);
    return;
  }
  if (graphic.sprite === undefined && graphic.transparent !== true) return;
  // 모델이 지어낸 sprite id(`easyrpg_charset_actor1` — 실제는 `tex_…`)를 그대로 쓰면 커밋 참조 검증이 이벤트 전체를 반려한다
  // (2026-09-24 연애 4회차 재생). 등록된 id 로 맞추고, 못 맞추면 이 그림은 버리고 페이지 기본 규칙(주민 그림)에 맡긴다.
  if (graphic.sprite?.id) {
    const known = collectResourceIds(draft);
    if (!known.has(graphic.sprite.id)) {
      const fixed = [`tex_${graphic.sprite.id}`, graphic.sprite.id.replace(/^tex_/u, "")].find((id) => known.has(id));
      if (!fixed) { warnings.push(`event.graphic.sprite '${graphic.sprite.id}' 은 없는 리소스라 쓰지 않았습니다 — list_npc_graphics 로 고르세요.`); return; }
      warnings.push(`event.graphic.sprite '${graphic.sprite.id}' → '${fixed}' 로 맞췄습니다.`);
      graphic = { ...graphic, sprite: { ...graphic.sprite, id: fixed } };
    }
  }
  // pages 를 안 보낸 부분 수정이면 「외형만 바꿔」 다 — 기존 페이지 전부에 입힌다. pages 를 보냈으면 그림 없는 페이지만.
  const reskin = !Object.prototype.hasOwnProperty.call(patch, "pages");
  const pages = (event.pages ?? []).filter((page) => page && typeof page === "object"
    && (reskin ? (page as Partial<EventPage>).graphic?.transparent !== true : (page as Partial<EventPage>).graphic === undefined));
  for (const page of pages) (page as EventPage).graphic = structuredClone(graphic);
  if (pages.length > 0) warnings.push(`이벤트 최상위 graphic 을 ${reskin ? "" : "그림 없는 "}페이지 ${pages.length}개에 적용했습니다(그림은 pages[].graphic 에 두는 것이 정본).`);
}

/** 분기 안까지 포함한 페이지의 모든 명령 — 「오늘 이미 만났나」 fork 로 시작하는 대화도 대화다. */
function allPageCommands(commands: readonly Command[] | undefined): Command[] {
  const out: Command[] = [];
  const walk = (list: readonly Command[] | undefined, depth: number): void => {
    if (depth > 8) return;
    for (const command of list ?? []) {
      if (!command || typeof command !== "object") continue;
      out.push(command);
      let nested: readonly (readonly Command[])[] = [];
      try { nested = nestedCommandLists(command); } catch { nested = []; }
      for (const child of nested) walk(child, depth + 1);
    }
  };
  walk(commands, 0);
  return out;
}

function isInvisibleTalkablePage(page: Partial<EventPage>): boolean {
  if (page.trigger?.kind !== "action" || page.priority === "below") return false;
  if (page.graphic?.transparent === true || page.graphic?.sprite !== undefined) return false;
  // 2026-09-24 연애 도그푸딩: 공략 인물 셋의 대사가 전부 「오늘 이미 만났나」 fork 안에 있어 최상위만 보는 검사를
  // 비껴갔다 — 그림 없이 발밑(below) 투명 이벤트가 돼 인물이 보이지도 않고 밟고 지나갔다.
  return allPageCommands(page.commands).some((command) => DIALOGUE_COMMAND_KINDS.has(command.kind));
}

/** 「한여름:\n…」 처럼 대사 본문이 화자 이름으로 시작하는가. */
function bodyNamesSpeaker(body: unknown, name: string): boolean {
  if (typeof body !== "string" || !name) return false;
  const text = body.trimStart();
  return text.startsWith(`${name}:`) || text.startsWith(`${name} :`) || text.startsWith(`[${name}]`) || text.startsWith(`${name}「`);
}

/**
 * `EventPage` 필수 필드를 채운다.
 *
 * 모델은 이벤트 레벨에만 trigger 를 주고 페이지에는 conditions/commands 만 담아 보내는 일이 흔하다.
 * 필수 필드가 비면 프로젝트 린트가 `page.trigger.kind` / `movement.route` 를 읽다 TypeError 로 죽고,
 * 사용자에게는 "후처리 실패: Cannot read properties of undefined" 라는 고칠 수 없는 메시지만 남는다
 * (2026-08-23 실측: upsert_event 3회 연속 같은 실패). 값을 채워 통과시키고 무엇을 채웠는지 경고한다.
 */
function fillRequiredPageFields(event: GameEvent, page: Partial<EventPage>, pageId: string, warnings?: string[]): void {
  const filled: string[] = [];
  if (page.id === undefined) { page.id = pageId; filled.push("id"); }
  if (page.name === undefined) { page.name = event.id; filled.push("name"); }
  if (page.conditions === undefined) { page.conditions = []; filled.push("conditions"); }
  if (page.trigger === undefined) {
    page.trigger = event.trigger ?? { kind: "action" };
    filled.push(`trigger(${page.trigger.kind})`);
  }
  const priorityOmitted = page.priority === undefined;
  if (page.priority === undefined) { page.priority = "same"; filled.push("priority"); }
  if (page.movement === undefined) { page.movement = PASSIVE; filled.push("movement"); }
  else if (typeof page.movement === "object" && page.movement !== null) {
    // `movement:{type:"fixed"}` 처럼 속도·빈도를 뺀 부분 객체는 도구 검사를 통과하고 적용 단계의
    // 직렬화 왕복에서야 `movement.speed가 숫자가 아닙니다` 로 죽었다 — 조수 실행 전체가 중단됐다
    // (2026-09-24 추격 호러 도그푸딩, 38번째 호출). 빠진 숫자만 기본값으로 채운다.
    const movement = page.movement as Partial<EventPage["movement"]>;
    const missing: string[] = [];
    if (typeof movement.type !== "string") { movement.type = PASSIVE.type; missing.push("type"); }
    if (typeof movement.speed !== "number" || !Number.isFinite(movement.speed)) { movement.speed = PASSIVE.speed; missing.push("speed"); }
    if (typeof movement.frequency !== "number" || !Number.isFinite(movement.frequency)) { movement.frequency = PASSIVE.frequency; missing.push("frequency"); }
    if (missing.length > 0) filled.push(`movement.${missing.join("/")}`);
  }
  if (isInvisibleTalkablePage(page) && !TILE_HOTSPOT_EVENTS.has(event)) {
    const siblingGraphic = event.pages?.find(
      (sibling) => sibling !== page && sibling.graphic?.sprite !== undefined,
    )?.graphic;
    const previousLook = siblingGraphic ? undefined : PREVIOUS_EVENT_LOOK.get(event);
    const object = siblingGraphic || previousLook ? null : objectEventGraphic(event, page);
    if (object) {
      // 이름에 맞는 그림이 없으면 투명으로 두고 알린다. 이름과 무관한 대체 그림(예전 보석 표식)은 붙이지 않는다 —
      // 「고대 진실의 제단」이 보석으로 저장돼 제단 자리에 보석이 놓였다(2026-09-27 사용자 지적).
      page.graphic = object.graphic;
      warnings?.push(object.graphic.transparent
        ? `${event.id}.${pageId}: '${event.name ?? event.id}' 은(는) 말하는 인물이 아니라 조사할 사물로 보여 주민 그림을 세우지 않고 투명으로 두었습니다 — ` +
          `이대로는 바닥에서 보이지 않습니다. 그 칸에 사물 타일을 칠하거나(paint_tiles·place_props) graphic 을 지정하세요.`
        : `${event.id}.${pageId}: 조사할 사물 '${event.name ?? event.id}' 에 이름으로 찾은 그림 「${object.label}」 을 붙였습니다.`);
    } else {
      page.graphic = siblingGraphic ? structuredClone(siblingGraphic) : previousLook ? structuredClone(previousLook) : resolveGraphicQuery("villager");
      warnings?.push(
        siblingGraphic
          ? `${event.id}.${pageId}: 대화가 있는 action 페이지인데 그래픽이 비어 있어 보이지 않습니다 — 다른 페이지의 charset 을 재사용했습니다.`
          : previousLook
          ? `${event.id}.${pageId}: 새 페이지에 graphic 이 없어 이 이벤트가 쓰던 charset 을 그대로 이어 썼습니다(외형 유지).`
          : `${event.id}.${pageId}: 대화가 있는 action 페이지인데 그래픽이 비어 있어 보이지 않습니다 — ` +
            `주민 기본 charset 을 붙였습니다. 투명 이벤트가 의도라면 graphic:{transparent:true} 를 명시하고, ` +
            `다른 외형이 필요하면 place_npc {graphic:{query:"…"}} 를 쓰세요.`,
      );
    }
  } else if (page.graphic === undefined) {
    page.graphic = {};
    filled.push("graphic");
  }
  // 그림 없는 페이지(진입 컷신·문 열림 검사·조건 대기 자리표시)에 기본 「same」을 주면 보이지 않는 벽이 된다 —
  // 회상 스토리 도그푸딩에서 투명 논리 이벤트 넷이 레코드 가게 가운데 줄에 서서 메멘토 둘을 막았다(2026-09-24).
  // priority 를 생략한 투명 페이지는 발밑(below)·겹침 허용으로 둔다. 조사(action)는 발밑 이벤트도 바라보고 된다.
  if (priorityOmitted && page.graphic?.sprite === undefined && page.graphic?.appearanceId === undefined && !TILE_HOTSPOT_EVENTS.has(event)) {
    page.priority = "below";
    if (page.overlapForbidden === undefined) page.overlapForbidden = false;
    filled[filled.indexOf("priority")] = "priority(below — 그림 없는 페이지)";
  }
  if (filled.length > 0) {
    warnings?.push(`${event.id}.${pageId}: 필수 페이지 필드 자동 보완 — ${filled.join(", ")}`);
  }
}

/** 조건이 이 아이템을 「가지고 있다」로 보장하는가(all 안의 한 갈래까지). */
function conditionHoldsItem(condition: Condition | undefined, itemId: string): boolean {
  if (!condition) return false;
  if (condition.kind === "item") return condition.itemId === itemId && condition.present !== false;
  if (condition.kind === "all") return condition.conditions.some((child) => conditionHoldsItem(child, itemId));
  return false;
}

/**
 * 선택지 분기 안에서 아이템을 1개 이상 빼는데, 그 아이템을 가졌는지 보는 조건이 없다 — 없는 선물을 건네도
 * 뒤따르는 호감·보상이 그대로 붙는다(changeItem 은 0개에서 조용히 멈춘다).
 * 2026-09-24 연애 도그푸딩: 공략 인물 셋의 「선물을 건넨다」 9갈래가 전부 이 모양이라 잡화점에 가지 않고도 +3 을 받았다.
 * 거부하지 않는다(분위기용 선택지도 있다) — 소지 조건 fork 나 presentItem 을 알려 준다.
 */
function unguardedItemSpendWarnings(event: GameEvent): string[] {
  const unguarded = new Set<string>();
  const walk = (commands: readonly Command[] | undefined, held: readonly Condition[], inChoice: boolean): void => {
    for (const command of commands ?? []) {
      if (!command || typeof command !== "object") continue;
      if (command.kind === "changeItem" && inChoice && (command.op === "-=" || (typeof command.amount === "number" && command.amount < 0))
        && typeof command.itemId === "string" && !held.some((condition) => conditionHoldsItem(condition, command.itemId))) {
        unguarded.add(command.itemId);
      }
      if (command.kind === "choices") {
        for (const option of command.options ?? []) walk(option?.branch, held, true);
        walk(command.cancelBranch, held, true);
      } else if (command.kind === "fork") {
        walk(command.then, [...held, command.condition], inChoice);
        walk(command.else, held, inChoice);
      } else if (command.kind !== "presentItem") {
        let nested: readonly (readonly Command[])[] = [];
        try { nested = nestedCommandLists(command); } catch { nested = []; }
        for (const list of nested) walk(list, held, inChoice);
      }
    }
  };
  walk(event.commands, [], false);
  for (const page of event.pages ?? []) {
    walk(page.commands, page.conditions ?? [], false);
  }
  if (unguarded.size === 0) return [];
  return [
    `이벤트 '${event.id}': 선택지가 아이템 ${[...unguarded].join(", ")} 을(를) 빼는데 소지 여부를 보지 않습니다 — 가진 게 없어도 그 분기의 호감·보상이 그대로 붙습니다. `
    + `선물·제출은 presentItem({kind:"presentItem",itemIds:[…],options:[{itemId,branch}],otherwiseBranch,cancelBranch,consume:true} — 가진 것만 목록에 뜬다)으로 쓰거나, `
    + `분기를 fork{condition:{kind:"item",itemId,present:true},then:[…],else:[…]} 로 감싸세요.`,
  ];
}

/**
 * 모든 선택지의 분기가 비어 있는 choices 명령 — 무엇을 골라도 아무 일도 없다.
 *
 * 2026-09-23 등대지기 재시험: 동료 카일의 「동행을 제안한다」와 보스의 「정령과 맞선다!」가 둘 다
 * `branch:[]` 로 저장돼 합류·전투·점화 스위치가 전부 빠졌는데 도구는 ok 만 돌려줬다. 선택지만 있는
 * 분위기용 질문도 있으니 거부하지 않고 경고로 알린다.
 */
function emptyChoiceWarnings(event: GameEvent): string[] {
  const warnings: string[] = [];
  const walk = (commands: readonly Command[] | undefined, owner: string): void => {
    for (const command of commands ?? []) {
      if (!command || typeof command !== "object") continue;
      if (command.kind === "choices" && Array.isArray(command.options) && command.options.length > 0
        && command.options.every(option => !Array.isArray(option?.branch) || option.branch.length === 0)
        && !(command.cancelBranch?.length)) {
        const labels = command.options.map(option => `「${String(option?.text ?? "")}」`).join("/");
        warnings.push(
          `이벤트 '${event.id}' ${owner}: 선택지 ${labels}의 분기가 모두 비어 있어 무엇을 골라도 아무 일도 일어나지 않습니다. `
          + "place_npc 는 choices[].commands, 네이티브 choices 명령은 options[].branch 에 합류(changeParty)·전투(battleProcessing)·스위치(setSwitch) 등을 넣고, "
          + "run_scene_test 의 {kind:'choose',index} 스텝으로 결과를 확인하세요.",
        );
      }
      let nested: readonly (readonly Command[])[] = [];
      try { nested = nestedCommandLists(command); } catch { nested = []; }
      for (const list of nested) walk(list, owner);
    }
  };
  walk(event.commands, "commands");
  for (const [index, page] of (event.pages ?? []).entries()) walk(page.commands, `페이지 ${index + 1}`);
  return warnings;
}

/**
 * 페이지를 여는 전역 스위치를 프로젝트 어디에서도 켜지 않으면 그 페이지는 영원히 닫혀 있다.
 *
 * 셀프 스위치는 `findUnwrittenSelfSwitchGates` 가 보지만 전역 스위치는 선언된 서사 플래그일 때만
 * 린트가 봤다(story-flag:read-without-write). 등대지기 재시험에서 하몬 할아버지의 구출 후 페이지
 * (조건 sw_catalog_lighthouse_lit)는 켜는 명령이 없어 도달 불가였다. 쓰는 쪽을 나중에 만들 수도
 * 있으니 거부하지 않고, 지금 시점에 없다는 사실만 경고한다.
 */
function unwrittenSwitchGateWarnings(project: Project, event: GameEvent): string[] {
  const gated = new Map<string, number>();
  for (const [index, page] of (event.pages ?? []).entries()) {
    for (const condition of page.conditions ?? []) {
      if (condition.kind === "switch" && condition.value !== false && !gated.has(condition.switchId)) gated.set(condition.switchId, index + 1);
    }
  }
  if (gated.size === 0) return [];
  const usage = buildStoryFlagUsageIndex(project);
  const startSwitches = project.session?.switches ?? {};
  const warnings: string[] = [];
  for (const [switchId, pageNumber] of gated) {
    if (startSwitches[switchId] === true) continue;
    if (usageBucketFor(usage, "switch", switchId).writes.length > 0) continue;
    const name = project.switches.find(entry => entry.id === switchId)?.name;
    warnings.push(
      `이벤트 '${event.id}' 페이지 ${pageNumber}는 스위치 ${switchId}${name ? `(${name})` : ""} 가 켜져야 열리는데 프로젝트에 그것을 켜는 setSwitch 가 아직 없습니다 — `
      + "보스 승리 분기(battleProcessing victoryBranch)나 선택지 분기에서 setSwitch 로 켜지 않으면 이 페이지는 열리지 않습니다.",
    );
  }
  return warnings;
}

function hasPlayerTouchEventAt(map: GameMap, x: number, y: number): boolean {
  for (const event of map.events) {
    if (event.x !== x || event.y !== y) continue;
    if (event.trigger?.kind === "playerTouch") return true;
    if ((event.pages ?? []).some((page) => page.trigger?.kind === "playerTouch")) return true;
  }
  return false;
}

/** 통행 불가(또는 맵 바로 밖) 착지를 반경 3 안의 통행 칸으로 옮긴다. playerTouch 칸은 즉시 재전이되므로 피한다. */
function nearestTransferLanding(project: Project, map: GameMap, x: number, y: number, maxRadius: number): Point | null {
  let any: Point | null = null;
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const cx = x + dx;
        const cy = y + dy;
        if (!inMapBounds(map, cx, cy) || !isPassable(project, map, cx, cy)) continue;
        const point = { x: cx, y: cy };
        if (!any) any = point;
        if (!hasPlayerTouchEventAt(map, cx, cy)) return point;
      }
    }
  }
  return any;
}

/**
 * 전이 한 칸이 벽이면 커밋 게이트가 이벤트 전체를 거부한다.
 * 2026-09-24 JRPG 도그푸딩: 귀환 포탈의 transfer 가 마을 문에서 한 칸 어긋나
 * place_npc 가 「transfer 목적지가 통행 불가」로 통째로 버려졌다.
 */
function relocateImpassableTransfers(project: Project, event: GameEvent, warnings?: string[]): void {
  const seen = new Set<Command>();
  const walk = (commands: readonly Command[] | undefined): void => {
    for (const command of commands ?? []) {
      if (!command || seen.has(command)) continue;
      seen.add(command);
      if (command.kind === "transfer") {
        const target = project.maps[command.mapId];
        if (target && !isPassable(project, target, command.x, command.y)) {
          const landing = nearestTransferLanding(project, target, command.x, command.y, 3);
          if (landing && (landing.x !== command.x || landing.y !== command.y)) {
            warnings?.push(
              `transfer 목적지가 통행 불가 타일이라 옮겼습니다: ${command.mapId} (${command.x}, ${command.y}) → (${landing.x}, ${landing.y}). 착지 칸은 get_map_region 으로 확인하세요.`,
            );
            command.x = landing.x;
            command.y = landing.y;
          }
        }
      }
      for (const list of nestedCommandLists(command)) walk(list);
    }
  };
  walk(event.commands);
  for (const page of event.pages ?? []) walk(page.commands);
}

// 페이지 커맨드 shape를 사전 검증(기존 io 검증기 위임).
function assertEventShape(event: GameEvent, warnings?: string[], supplied: Partial<GameEvent> = event, project?: Project): void {
  try {
    // 조건 모양을 먼저 본다 — `{kind:"all"}`(conditions 배열 없음)이 뒤쪽 검사기에서 「conditions is not iterable」
    // 같은 JS 예외로 새어 나가 모델이 무엇을 고칠지 몰랐다(2026-09-24 회상 스토리 도그푸딩, 같은 호출 재시도).
    for (const page of event.pages ?? []) {
      if (page.conditions === undefined) continue;
      if (!Array.isArray(page.conditions)) {
        throw new ToolError(`이벤트 형식이 올바르지 않습니다: ${event.id}.${page.id ?? "page"}.conditions 는 배열이어야 합니다(조건 없음은 []).`, { code: "invalid-args" });
      }
      page.conditions.forEach((condition, index) => validateConditionShape(`${event.id}.${page.id}.conditions[${index}]`, condition));
    }
    normalizeEventCommandArrays(event, warnings, supplied);
    validateLowLevelCommandArray(`${event.id}.commands`, event.commands);
    for (const page of event.pages ?? []) {
      validateLowLevelCommandArray(`${event.id}.${page.id}.commands`, page.commands);
    }
    for (const warning of shadowedPageWarnings(`이벤트 '${event.id}'`, event.pages, event.commands)) warnings?.push(warning);
    for (const warning of emptyChoiceWarnings(event)) warnings?.push(warning);
    for (const warning of unguardedItemSpendWarnings(event)) warnings?.push(warning);
    if (project && (supplied === event || Object.prototype.hasOwnProperty.call(supplied, "pages") || Object.prototype.hasOwnProperty.call(supplied, "commands"))) {
      relocateImpassableTransfers(project, event, warnings);
    }
  } catch (cause) {
    if (cause instanceof ToolError) throw cause;
    throw new ToolError(`이벤트 형식이 올바르지 않습니다: ${cause instanceof Error ? cause.message : String(cause)}`, {
      code: "invalid-args",
    });
  }
}

function ensureConditionStoryFlags(project: Project, condition: Condition, eventId: string, warnings: string[]): void {
  if (condition.kind === "switch") {
    if (!project.switches.some((entry) => entry.id === condition.switchId)) {
      ensureNamedSwitch(project, condition.switchId, `이벤트 ${eventId}: ${condition.switchId}`);
      warnings.push(`미등록 switchId 자동 생성: ${condition.switchId}`);
    }
  } else if (condition.kind === "variable") {
    if (!project.variables.some((entry) => entry.id === condition.variableId)) {
      ensureNamedVariable(project, condition.variableId, `이벤트 ${eventId}: ${condition.variableId}`);
      warnings.push(`미등록 variableId 자동 생성: ${condition.variableId}`);
    }
  } else if (condition.kind === "all" || condition.kind === "any") {
    for (const child of condition.conditions) ensureConditionStoryFlags(project, child, eventId, warnings);
  } else if (condition.kind === "not") {
    ensureConditionStoryFlags(project, condition.condition, eventId, warnings);
  }
}

function ensureCommandStoryFlags(project: Project, commands: readonly Command[], eventId: string, warnings: string[]): void {
  for (const command of commands) {
    if (command.kind === "setSwitch") {
      if (!project.switches.some((entry) => entry.id === command.switchId)) {
        ensureNamedSwitch(project, command.switchId, `이벤트 ${eventId}: ${command.switchId}`);
        warnings.push(`미등록 switchId 자동 생성: ${command.switchId}`);
      }
    } else if (command.kind === "setVariable") {
      if (!project.variables.some((entry) => entry.id === command.variableId)) {
        ensureNamedVariable(project, command.variableId, `이벤트 ${eventId}: ${command.variableId}`);
        warnings.push(`미등록 variableId 자동 생성: ${command.variableId}`);
      }
    } else if (command.kind === "choices") {
      for (const option of command.options) ensureCommandStoryFlags(project, option.branch, eventId, warnings);
      if (command.cancelBranch) ensureCommandStoryFlags(project, command.cancelBranch, eventId, warnings);
    } else if (command.kind === "presentItem") {
      for (const option of command.options) ensureCommandStoryFlags(project, option.branch, eventId, warnings);
      if (command.otherwiseBranch) ensureCommandStoryFlags(project, command.otherwiseBranch, eventId, warnings);
      if (command.cancelBranch) ensureCommandStoryFlags(project, command.cancelBranch, eventId, warnings);
    } else if (command.kind === "fork") {
      ensureConditionStoryFlags(project, command.condition, eventId, warnings);
      ensureCommandStoryFlags(project, command.then, eventId, warnings);
      if (command.else) ensureCommandStoryFlags(project, command.else, eventId, warnings);
    } else if (command.kind === "loop") {
      ensureCommandStoryFlags(project, command.body, eventId, warnings);
    }
  }
}

function ensureEventStoryFlags(project: Project, event: GameEvent, warnings: string[]): void {
  ensureCommandStoryFlags(project, event.commands, event.id, warnings);
  for (const page of event.pages ?? []) {
    for (const condition of page.conditions) ensureConditionStoryFlags(project, condition, event.id, warnings);
    ensureCommandStoryFlags(project, page.commands, event.id, warnings);
  }
}

// (x,y) 주변(또는 자신)에서 통행 가능한 첫 칸을 착지 좌표로 고른다.
export function passableLanding(project: Project, map: GameMap, x: number, y: number): Point | null {
  const candidates: Point[] = [
    { x, y: y + 1 },
    { x, y: y - 1 },
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y },
  ];
  for (const cell of candidates) {
    if (inMapBounds(map, cell.x, cell.y) && isPassable(project, map, cell.x, cell.y)) return cell;
  }
  return null;
}

/**
 * AI 배치 툴 공용 통행 가능 착지 판정.
 *
 * 왜: place_battle_blocker 등 다수 툴이 inMapBounds 만 보고 몬스터를 벽 위에 세웠다.
 * RM2K3 의미상 action 트리거 이벤트(문·간판)는 통행 불가 타일 위에 있어도 되지만,
 * 캐릭터형 이벤트(몬스터·추격자·NPC)와 밟아야 발동하는 트리거는 반드시 통행 가능 칸에 서야 한다.
 *
 * - kind "character" 또는 steppable 트리거: 최종 칸이 isPassable 이어야 한다(반경 3 자동 착지).
 * - kind "interaction": 벽 위 허용, 단 4방향 이웃(또는 자신) 중 하나는 통행 가능해야 한다.
 *   완전히 갇힌 경우에만 반경 3 자동 착지, 그것도 실패하면 ToolError.
 */
export function resolveEventPlacement(
  project: Project,
  map: GameMap,
  x: number,
  y: number,
  options: {
    readonly kind: "character" | "interaction";
    readonly event?: GameEvent;
    readonly from?: Point;
    readonly steppable?: boolean;
    readonly ignoreEventId?: string;
    readonly reserved?: ReadonlySet<string>;
    /**
     * 호출자가 같은 칸의 자동 조사 이벤트(ev_inspect_*)를 displaceAutoInspectEvents 로 걷어낸다.
     * 점유 칸 회피(2026-09-24)가 그 자리표시도 점유로 봐서, 가구 위 상자가 옆 칸으로 밀리고
     * 조사 이벤트는 남았다. 걷어내지 않는 호출자는 켜면 안 된다 — 같은 칸에 겹친다.
     */
    readonly replacesAutoInspect?: boolean;
    readonly label: string;
    readonly code: string;
  },
): { x: number; y: number; adjusted: boolean } {
  const mustStandOnPassable = options.kind === "character" || options.steppable === true;
  // Existing-event moves must validate the whole body against the CURRENT draft.
  // A preceding move in the same assistant batch may have consumed this advice.
  if (options.event) {
    const analysis = new EventPlacementAnalysis(project, map);
    for (let radius = 0; radius <= 3; radius++) {
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const moved = { ...options.event, x: x + dx, y: y + dy };
        if (!analysis.validDestination(moved, mustStandOnPassable, options.from)) continue;
        return { x: moved.x, y: moved.y, adjusted: radius !== 0 };
      }
    }
    throw new ToolError(
      `${options.label}의 몸·통행·이동·접근 조건을 만족하는 빈 자리가 (${x}, ${y}) 반경 3칸에 없습니다. run_lint 또는 get_map_region으로 현재 점유와 지형을 확인하고 다른 위치를 선택하세요.`,
      { code: options.code, mapId: map.id, x, y },
    );
  }
  const requestedReserved = options.reserved?.has(`${x},${y}`) === true;
  // 같은 칸의 기존 이벤트도 "점유"다 — 조기 반환에서 통행만 보고 넘어가면 새 이벤트가 그 위에
  // 겹쳐 생겨 앞 이벤트가 그림자진다(2026-09-24 몬스터 수집 r2: NPC 위에 ev_starters 가 겹쳐
  // autoplay 의 「첫 파트너 받기」 조사가 NPC 를 집고 실패했다). 조정 경로의 nearestPassableCell 은
  // 이미 점유를 피하므로, 점유 칸 요청은 조정 경로로 보낸다.
  const occupiedRequested = map.events.some((event) => event.id !== options.ignoreEventId && event.x === x && event.y === y
    && !(options.replacesAutoInspect === true && isAutoInspectEvent(event)));
  const keepRequested = !requestedReserved && !occupiedRequested;
  if (keepRequested && isPassable(project, map, x, y)) return { x, y, adjusted: false };
  if (keepRequested && !mustStandOnPassable && passableLanding(project, map, x, y)) return { x, y, adjusted: false };
  const landing = nearestPassableCell(project, map, x, y, 3, options.ignoreEventId, options.reserved);
  if (!landing) {
    throw new ToolError(
      `${options.label}을 놓을 통행 가능 칸이 없습니다: (${x}, ${y}) 주변 반경 3칸까지 전부 통행 불가입니다. get_map_region으로 지형을 확인하세요.`,
      { code: options.code, mapId: map.id, x, y },
    );
  }
  return { x: landing.x, y: landing.y, adjusted: landing.x !== x || landing.y !== y };
}

/** place_npc 와 같은 문구의 자동 조정 경고. */
function placementAdjustedWarning(label: string, from: Point, to: Point): string {
  return `${label} 위치 자동 조정: (${from.x}, ${from.y}) → (${to.x}, ${to.y})`;
}

/** 밟아서 발동하는 트리거인가(touch/playerTouch + priority !== "same"). */
function isSteppableTrigger(trigger: Trigger | undefined, priority: EventPage["priority"] | undefined): boolean {
  if (trigger?.kind !== "touch" && trigger?.kind !== "playerTouch") return false;
  return priority !== "same";
}

/** 이벤트 본체/페이지 중 하나라도 밟아서 발동하면 steppable 로 본다. */
function eventIsSteppable(event: GameEvent): boolean {
  if ((event.pages ?? []).some((page) => isSteppableTrigger(page.trigger, page.priority))) return true;
  if ((event.pages ?? []).length > 0) return false;
  return isSteppableTrigger(event.trigger, undefined);
}

const PLACEMENT_AUTOLAND_HINT = "통행 불가 칸이면 근처(반경 3) 통행 가능 칸으로 자동 착지한다.";

const NATIVE_PAGE_REPAIR_EXAMPLE = {
  mapId: "existing_map_id",
  event: {
    id: "existing_event_id",
    pages: [{
      conditions: [],
      graphic: { transparent: true },
      commands: [{ kind: "choices", options: [
        { text: "Continue", branch: [
          { kind: "changeItem", itemId: "existing_item_id", op: "-=", amount: 1 },
          { kind: "triggerEnding", endingId: "defined_ending_id" },
        ] },
        { text: "Cancel", branch: [] },
      ] }],
    }],
  },
};

/**
 * 페이지가 있는 이벤트는 런타임이 page.commands/page.trigger 만 실행한다(playSceneInterpreter `page?.commands ?? event.commands`).
 * pages 없이 최상위 commands/trigger 만 보낸 패치를 그대로 저장하면 OK 를 돌려주고 아무것도 실행되지 않는다
 * (2026-09-23 추리 도그푸딩: 증거 3개가 전부 이렇게 사라졌다). 페이지가 하나면 그 페이지로 옮기고,
 * 여럿이면 어느 페이지인지 추측하지 않고 거부한다.
 */
function routeRootCommandsIntoPage(
  event: GameEvent,
  patch: Partial<GameEvent>,
  existing: GameEvent | undefined,
  warnings: string[],
): void {
  const has = (key: keyof GameEvent) => Object.prototype.hasOwnProperty.call(patch, key);
  const pages = event.pages ?? [];
  if (has("pages") && pages.length > 0 && Array.isArray(patch.commands) && patch.commands.length > 0) {
    // pages 와 최상위 commands 를 같이 보내고 페이지에는 명령을 안 넣은 경우 — 회상 스토리 도그푸딩에서 「메멘토 3개를
    // 모으면 열리는 문」이 이렇게 저장돼 조건 페이지는 비고 다음 기억으로 가는 transfer 는 최상위에 묻혔다(도달 불가).
    const empty = pages.filter((page) => !Array.isArray(page.commands) || page.commands.length === 0);
    if (empty.length === 1) {
      const index = pages.indexOf(empty[0]!);
      event.pages = pages.map((page, i) => i === index ? { ...page, commands: structuredClone(patch.commands!) } : page);
      event.commands = structuredClone(existing?.commands ?? []);
      warnings.push(`최상위 commands → 명령이 비어 있던 pages[${index}] 로 옮김 (페이지가 있는 이벤트는 페이지 명령만 실행된다)`);
      return;
    }
    throw new ToolError(
      `이벤트 '${event.id}'에 pages 와 최상위 commands 를 함께 보냈습니다 — 페이지가 있으면 최상위 commands 는 실행되지 않습니다. ` +
      (empty.length === 0 ? "모든 페이지에 이미 명령이 있어 어디에 둘지 모릅니다. " : `명령이 빈 페이지가 ${empty.length}개라 어디에 둘지 모릅니다. `) +
      "명령을 해당 pages[].commands 에 넣으세요.",
      { code: "invalid-args" },
    );
  }
  if (pages.length === 0) {
    // 2026-09-24 회상 스토리: 기억의 문을 {commands, conditions} 만으로 만들어 페이지가 0장이었다.
    // 런타임은 페이지 조건을 안 보고, 페이지가 없으면 priority 기본값 same 이라 그 칸을 처음부터 막는다.
    const movesCommands = has("commands") && Array.isArray(patch.commands) && patch.commands.length > 0;
    const rawConditions = (patch as { conditions?: unknown }).conditions;
    const pageConditions = Array.isArray(rawConditions)
      ? rawConditions.filter((entry): entry is EventPageCondition => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
      : [];
    if (movesCommands || pageConditions.length > 0) {
      const page: Partial<EventPage> = {
        id: `${event.id}_page`,
        commands: movesCommands ? structuredClone(patch.commands!) : [],
        ...(pageConditions.length > 0 ? { conditions: structuredClone(pageConditions) } : {}),
        ...(has("trigger") && patch.trigger ? { trigger: structuredClone(patch.trigger) } : {}),
      };
      event.pages = [page as EventPage];
      event.commands = structuredClone(existing?.commands ?? []);
      delete (event as { conditions?: unknown }).conditions;
      fillRequiredPageFields(event, page, `${event.id}_page`, warnings);
      const moved = [movesCommands ? "commands" : "", pageConditions.length > 0 ? "conditions" : ""].filter(Boolean).join("·");
      warnings.push(
        `pages 없이 보낸 최상위 ${moved} 를 pages[0] 으로 만들었습니다 — 페이지가 없으면 스위치 조건은 무시되고 이벤트가 그 칸을 막습니다.`,
      );
    }
    return;
  }
  if (has("pages")) return;
  // 빈 배열은 옮기지 않는다 — 이름만 바꾸려는 패치가 흔히 commands:[] 를 같이 보내는데, 그걸 옮기면 페이지 대사가 지워진다.
  const movesCommands = has("commands") && Array.isArray(patch.commands) && patch.commands.length > 0;
  const movesTrigger = has("trigger") && patch.trigger !== undefined;
  if (!movesCommands && !movesTrigger) return;
  if (pages.length > 1) {
    if (!movesCommands) {
      warnings.push(`최상위 trigger 는 페이지가 있는 이벤트에서 실행되지 않습니다 — 페이지별 trigger 는 pages 로 보내세요 (페이지 ${pages.length}개)`);
      return;
    }
    throw new ToolError(
      `이벤트 '${event.id}'에는 페이지가 ${pages.length}개(${pages.map((page) => page.id).join(", ")}) 있어 최상위 commands 는 실행되지 않습니다. ` +
      "바꿀 페이지의 commands 를 event.pages 에 담아 보내세요 — pages 는 배열 전체 교체이므로 유지할 페이지도 모두 포함하세요. get_event 로 현재 페이지를 먼저 읽으세요.",
      { code: "invalid-args" },
    );
  }
  const page = { ...pages[0]! };
  if (movesCommands) page.commands = structuredClone(patch.commands!);
  if (movesTrigger) page.trigger = structuredClone(patch.trigger!);
  event.pages = [page];
  event.commands = structuredClone(existing?.commands ?? []);
  if (existing?.trigger) event.trigger = structuredClone(existing.trigger);
  const moved = [movesCommands ? "commands" : "", movesTrigger ? "trigger" : ""].filter(Boolean).join("·");
  warnings.push(`최상위 ${moved} → pages[0] 로 옮김 (페이지가 있는 이벤트는 페이지 명령만 실행된다)`);
}

const upsertEvent: ToolDefinition = {
  name: "upsert_event",
  description: `${LOW_LEVEL_TOOL_DESCRIPTION_PREFIX} GameEvent를 추가하거나 기존 이벤트를 부분 수정한다. 기존 id이면 입력에 포함한 최상위 필드만 바꾸고, 생략한 pages/commands/graphic/characterId/좌표 등은 보존한다. 빈 배열처럼 명시한 값은 그대로 반영한다. NPC/주민/대화 이벤트 배치는 place_npc, 스케줄만 바꿀 때는 set_npc_schedule을 우선 사용하라. 증거 제시·아이템 보여주기·선물 건네기는 choices+아이템 조건이 아니라 presentItem 명령({kind:'presentItem',prompt,options:[{itemId,branch}],otherwiseBranch,cancelBranch,consume})으로 만든다. 보스전 결과 분기(이기면 스위치 켜기 등)는 선택지 모양 options 가 아니라 battleProcessing{troopId,branchOnResult:true,victoryBranch:[…],defeatBranch,escapeBranch}로 쓴다.`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      event: {
        type: "object",
        description: "GameEvent 추가 또는 부분 수정. id는 항상 필요하고 x/y는 새 이벤트일 때만 필요. 기존 이벤트에서 생략한 최상위 필드는 보존된다. 새 이벤트 좌표가 통행 불가 칸이면 근처(반경 3) 통행 가능 칸으로 자동 착지하고, 기존 이벤트 부분 수정은 좌표를 건드리지 않는다.",
        properties: {
          id: { type: "string" },
          x: { type: "integer" },
          y: { type: "integer" },
          trigger: { type: "object", properties: { kind: { type: "string" } }, additionalProperties: true },
          commands: { type: "array", items: COMMAND_SCHEMA },
          pages: { type: "array", items: NATIVE_EVENT_PAGE_SCHEMA },
        },
        // 나머지 GameEvent 필드는 이벤트 shape 검증기가 본다.
        additionalProperties: true,
        required: ["id"],
      },
    },
    required: ["mapId", "event"],
  },
  invalidArgsHint: UPSERT_EVENT_NPC_HINT,
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const patch = args.event as Partial<GameEvent> | undefined;
    const warnings: string[] = [];
    if (!patch || typeof patch.id !== "string" || !patch.id.trim()) throw new ToolError("event.id(문자열)가 필요합니다.");
    // A trigger describes when to run; commands belong beside it. Do this on the
    // incoming patch before normalization can turn an omitted command list into [].
    const commandOwners = [
      { path: "event", value: patch },
      ...(Array.isArray(patch.pages) ? patch.pages.map((page, index) => ({ path: `event.pages[${index}]`, value: page })) : []),
    ];
    for (const { path, value } of commandOwners) {
      const trigger = value?.trigger;
      if (trigger && typeof trigger === "object" && Object.prototype.hasOwnProperty.call(trigger, "commands")) {
        throw new ToolError(
          `${path}.trigger.commands는 지원하지 않습니다. 명령을 ${path}.commands로 옮기세요. ` +
          '예: {"trigger":{"kind":"playerTouch"},"commands":[{"kind":"transfer","mapId":"조회한 맵 ID","x":1,"y":1}]}',
          { code: "invalid-args" },
        );
      }
    }
    // Only inspect submitted pages: unrelated partial updates must neither compile
    // nor rewrite old content, including legacy SimplePage-shaped properties.
    for (const [index, page] of (Array.isArray(patch.pages) ? patch.pages : []).entries()) {
      if (!page || typeof page !== "object" || Array.isArray(page)) continue;
      const unsupported = ["choices", "lines", "showText", "messages", "text", "face"]
        .filter(key => Object.prototype.hasOwnProperty.call(page, key));
      for (const key of ["query", "textureKey", "characterIndex"]) {
        if (page.graphic && Object.prototype.hasOwnProperty.call(page.graphic, key)) unsupported.push(`graphic.${key}`);
      }
      if (unsupported.length > 0) {
        throw new ToolError(
          `event.pages[${index}]: ${unsupported.join(", ")}는 SimplePage 전용이며 upsert_event에서 실행되지 않습니다. ` +
          "기존 페이지/명령을 보존하면서 대사는 commands의 text, 선택은 choices.options[].branch, 얼굴은 changeFace, 그림은 graphic.sprite로 바꾸세요. " +
          "pages는 배열 전체 교체이므로 유지할 페이지도 모두 포함하세요. 고수준 페이지는 place_npc/make_villager를 사용하세요. 네이티브 부분 수정 예시: " + JSON.stringify(NATIVE_PAGE_REPAIR_EXAMPLE),
          { code: "invalid-args" },
        );
      }
      // 유니온 밖 값은 저장됐다가 플레이어가 처음 조사하는 순간 런타임 exhaustiveness trips 를
      // 때려 씬이 죽는다(2026-09-24 갤러리 도그푸딩: 모델이 32페이지에 "none" 을 넣어 브라우저 완주가 막힘).
      // args 는 위에서 Partial<GameEvent> 로 캐스팅된 입력이라 런타임 값이 유니온을 어길 수 있다 — includes 로 실제 값을 본다.
      const animationType = page.animationType;
      if (animationType !== undefined && !EVENT_ANIMATION_TYPES.includes(animationType)) {
        throw new ToolError(
          `event.pages[${index}].animationType ${JSON.stringify(animationType)} 는 알 수 없는 값이다 — 유효값: ${EVENT_ANIMATION_TYPES.join(", ")}. ` +
          "멈춰 있는 대상은 fixedGraphic, 걸어 다니는 기본은 normal.",
          { code: "invalid-args" },
        );
      }
    }
    const existing = map.events.find((entry) => entry.id === patch.id);
    let event: GameEvent;
    let adjusted = false;
    if (existing) {
      event = {
        ...structuredClone(existing),
        ...structuredClone(patch),
        id: existing.id,
      } as GameEvent;
      const preserved = ["x", "y", "trigger", "commands", "pages", "characterId"]
        .filter((key) => !Object.prototype.hasOwnProperty.call(patch, key));
      if (preserved.length > 0) {
        warnings.push(`기존 이벤트 부분 병합: 생략 필드 보존 (${preserved.join(", ")})`);
      }
    } else {
      if (typeof patch.x !== "number" || typeof patch.y !== "number") {
        throw new ToolError("새 이벤트에는 event.x/y(숫자)가 필요합니다.");
      }
      event = structuredClone(patch) as GameEvent;
      if (!event.trigger) event.trigger = { kind: "action" };
      // 새 이벤트만 착지 보정한다 — 부분 병합에서 기존 이벤트를 옮기면 저작 의도가 조용히 깨진다.
      const requested: Point = { x: event.x, y: event.y };
      if (inMapBounds(map, requested.x, requested.y)) {
        const placement = resolveEventPlacement(draft, map, requested.x, requested.y, {
          kind: "interaction",
          steppable: eventIsSteppable(event),
          ignoreEventId: event.id,
          label: `이벤트 '${event.id}'`,
          code: "upsert-event-impassable",
        });
        event.x = placement.x;
        event.y = placement.y;
        adjusted = placement.adjusted;
        if (adjusted) warnings.push(placementAdjustedWarning(`이벤트 '${event.id}'`, requested, placement));
      }
    }
    routeRootCommandsIntoPage(event, patch, existing, warnings);
    applyEventLevelGraphic(draft, map, event, patch, warnings);
    // 기존 투명 조사 지점(그림 없는 action 페이지뿐)이나 통행 불가 칸(가구·벽·문 타일) 위의 새 이벤트는 타일이 그림이다.
    const tileHotspot = existing
      ? (existing.pages ?? []).some((page) => page.trigger?.kind === "action") && !(existing.pages ?? []).some((page) => page.graphic?.sprite !== undefined)
      : inMapBounds(map, event.x, event.y) && !isPassable(draft, map, event.x, event.y);
    if (tileHotspot) TILE_HOTSPOT_EVENTS.add(event);
    const previousLook = existing && "pages" in patch ? eventLook(existing) : undefined;
    if (previousLook) PREVIOUS_EVENT_LOOK.set(event, previousLook);
    assertEventShape(event, warnings, existing ? patch : event, draft);
    // place_npc 와 같은 규칙: 새로 쓴 페이지가 켜거나 기다리는 스위치·변수를 등록한다. 없으면 도구는 ok 를
    // 돌려준 뒤 커밋 참조 검증이 `switchId가 존재하지 않습니다` 로 쓰기 전체를 반려했다(2026-09-24 오프닝 컷신).
    if (!existing || "pages" in patch || "commands" in patch) ensureEventStoryFlags(draft, event, warnings);
    if (!existing || "pages" in patch || "commands" in patch) assertEventPartyActorReferences(draft, event);
    const declaredFlags = declaredFlagsWarning(declareReferencedFlags(draft, event));
    if (declaredFlags) warnings.push(declaredFlags);
    const shadowedBefore = projectSetterShadowedPages(draft);
    const outcome = upsertEventIntoMap(map, event);
    warnings.push(...unwrittenSwitchGateWarnings(draft, event));
    for (const [key, hit] of projectSetterShadowedPages(draft)) if (!shadowedBefore.has(key)) warnings.push(hit.message);
    const stored = map.events.find((candidate) => candidate.id === event.id) ?? event;
    const beforeReliefX = stored.x;
    const beforeReliefY = stored.y;
    const passage = passageBlockWarning(draft, map, stored);
    if (passage) warnings.push(passage);
    if (stored.x !== beforeReliefX || stored.y !== beforeReliefY) adjusted = true;
    if (map.disableSave && JSON.stringify(event.pages ?? []).includes('"kind":"openSaveMenu"')) {
      warnings.push(`${map.name} 은(는) 저장 금지 맵이라 이 이벤트의 저장 메뉴(openSaveMenu)에서도 저장할 수 없습니다 — 저장 장소라면 set_map_properties 로 이 맵의 저장 금지를 끄세요(메뉴 저장만 막는 기능이 아닙니다).`);
    }
    const unsupportedCommands = countLimitedRuntimeSupportCommandsForEvent(event);
    return {
      summary: `${map.name}에 이벤트 '${event.id}' ${outcome === "added" ? "추가" : "수정"} — 런타임 제한 커맨드 ${unsupportedCommands}건${adjusted ? ` — 위치 자동 조정 (${event.x}, ${event.y})` : ""}`,
      data: { eventId: event.id, unsupportedCommands, x: event.x, y: event.y, adjusted },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};


// 같은 맵·근접 칸에 비슷한 이름의 NPC가 있으면 새로 만들지 않고 기존 id 재사용(중복 상인 thrash 방지).
function isShopRoleNpcName(name: string): boolean {
  return /상점\s*주인|잡화\s*상|잡화점|가게\s*주인|상인|merchant|shopkeeper|shop\s*owner/u.test(name.trim());
}

/**
 * 문·문 앞 발판·이동 칸은 NPC 가 아니다. 2026-09-24 JRPG 도그푸딩: 집 문 발판(`<문>_step`, 페이지 이름
 * 「무기 상인의 집 문」)이 이름의 「상인」 때문에 상인 NPC 로 재사용돼 덮어써졌다 — 문은 돌아다니는 상인이 되고
 * 집에 들어갈 수 없게 됐다. 모든 페이지가 접촉 발동이거나 이동·연결 명령을 담은 이벤트는 합치지 않는다.
 */
function isNpcMergeCandidate(event: GameEvent): boolean {
  const pages = event.pages ?? [];
  if (event.id.endsWith("_step") || /문$|door$/iu.test(event.name?.trim() ?? pages[0]?.name?.trim() ?? "")) return false;
  if (pages.length === 0) return event.trigger?.kind !== "playerTouch";
  if (pages.every((page) => page.trigger?.kind === "playerTouch" || page.trigger?.kind === "eventTouch")) return false;
  const relay = (commands: readonly Command[]) => commands.some((command) => command.kind === "transfer" || command.kind === "callMapEvent");
  return !pages.every((page) => relay(page.commands ?? []));
}

function findNearbySimilarNpc(
  map: { events: GameEvent[] },
  x: number,
  y: number,
  name: string,
  maxDist = 2,
): GameEvent | undefined {
  const needle = name.trim().toLowerCase().replace(/\s+/g, "");
  if (!needle) return undefined;
  let best: GameEvent | undefined;
  let bestDist = Infinity;
  for (const event of map.events) {
    if (!isNpcMergeCandidate(event)) continue;
    const pageName = event.pages?.[0]?.name?.trim() ?? "";
    const eventName = event.name?.trim() || pageName || event.id;
    const hay = eventName.toLowerCase().replace(/\s+/g, "");
    // 상점/상인/주인 등 역할 유사 또는 부분 일치
    const roleSimilar =
      (isShopRoleNpcName(needle) && isShopRoleNpcName(hay))
      || hay === needle;
    if (!roleSimilar) continue;
    const dist = Math.abs(event.x - x) + Math.abs(event.y - y);
    if (dist > maxDist) continue;
    if (dist < bestDist) {
      best = event;
      bestDist = dist;
    }
  }
  return best;
}

const placeNpc: ToolDefinition = {
  name: "place_npc",
  description:
    `${PLACE_NPC_OBJECT_GIMMICK_HINT} NPC 이벤트를 배치한다. 쓰기 전 find_events/get_event/get_story_state 로 기존 NPC·플래그를 읽고, 상태별 페이지(기본 + 조건이 다른 뒤 페이지)로 구성하라.  페이지는 조건이 서로 다른 상태 변형이어야 한다 — 한 줄 인사 한 페이지만 놓고 끝내지 말 것. graphic 은 query 로 외형을 고르고 생략하면 villager 기본. 물 위·통행 불가 칸 금지. 상점 NPC 는 make_villager({shop}) 1회 또는 이 툴 1회 — 같은 역할을 중복 배치하지 말 것. 순찰·시간표는 set_npc_schedule, 재고는 set_shop_stock.`
    + "한 줄 인사만 놓고 끝내지 마라. graphic은 {query} 또는 {textureKey,characterIndex}. query는 기존 별칭(villager|people|npc|human|사람|주민|actor|hero|animal|monster)과 자유 질의를 허용한다: 예 '할머니', 'old woman', '노인 남성'. "
    + "pages는 SimplePage로 EventPage로 컴파일된다. 페이지마다 name/graphic/conditions 를 줄 수 있다. 호감/선물은 characterId 를 명시. "
    + "**대사가 있으면 charset에 대응하는 faceset changeFace를 자동 삽입**한다(page.face로 덮어쓰기 가능). page.conditions 단수 객체/null, page.commands 단수 객체, command→kind alias는 warning과 함께 정규화한다. 통행 불가/점유 칸이면 근처 통행 가능 칸으로 자동 착지한다. "
    + "guide:'action-controls'는 예외: pages 없이 실제 키 계약의 조작 안내 한 페이지만 만든다. 맵마다 같은 안내를 재사용하며 재시도 시 기존 위치를 유지한다. 명시 id가 우선한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer", description: "배치 칸 x. x,y 대신 home:{x,y} 도 받는다." },
      y: { type: "integer", description: "배치 칸 y." },
      home: {
        type: "object", description: "make_villager 와 같은 모양의 배치 칸 {x,y} — x,y 를 줬으면 생략.",
        properties: { x: { type: "integer" }, y: { type: "integer" } },
      },
      name: { type: "string" },
      graphic: GRAPHIC_SPEC_SCHEMA,
      face: FACE_SCHEMA,
      movement: { type: "string", enum: ["fixed", "random", "approach"], description: "자율 이동. 생략 시 이름 아키타입 추론: 배회형(아이·행상·동물)→random, 추격형(추격자·매복)→approach, 대화 거점(상점 주인·문지기·간판)→fixed, 모호하면 fixed. 명시가 추론보다 우선." },
      pages: {
        type: "array",
        description:
          "상태별 SimplePage[]. 페이지 1=조건 없는 기본, 뒤 페이지는 서로 다른 conditions(switch/selfSwitch/timePhase/friendshipAtLeast 등). 조건 없는 페이지를 여러 장 만들지 마라.",
        items: SIMPLE_PAGE_SCHEMA,
      },
      id: { type: "string" },
      guide: { type: "string", enum: ["action-controls"], description: "키 바인딩 정본의 조작 안내 한 페이지. pages 대신 사용하며 맵별 고정 ID로 재사용한다." },
      characterId: { type: "string", description: "공유 호감/선물 키. 호감 페이지를 쓰면 필수. 생략 시 호감 조건/커맨드가 있으면 이름에서 할당" },
    },
    // x,y 또는 home 중 하나 — 스키마 required 로 두면 make_villager 모양(home)으로 부른 호출이 Pi 검증에서
    // 통째로 거부됐다(2026-09-24 JRPG ember-4: 상점 NPC 넷이 전부 「x,y is required」). run 에서 둘 중 하나를 요구한다.
    required: ["mapId", "name"],
  },
  invalidArgsHint: "대화 NPC는 pages:[{lines:[원래 대사]}]가 필수입니다. dialogue.text는 pages의 lines로 옮기세요. 오브젝트 기믹을 만들려는 경우에만 place_chest/place_storage_chest/place_savepoint를 사용하세요.",
  invalidArgsRepair(args) {
    const dialogue = args.dialogue;
    if (args.pages !== undefined || typeof dialogue !== "object" || dialogue === null || Array.isArray(dialogue)) return undefined;
    if (Object.keys(args).some(key => key !== "dialogue" && !(key in (placeNpc.parameters.properties ?? {})))) return undefined;
    if (Object.keys(dialogue).length !== 1 || !("text" in dialogue) || typeof dialogue.text !== "string" || !dialogue.text.trim()) return undefined;
    return { path: "pages", example: [{ lines: [dialogue.text] }] };
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const home = args.home && typeof args.home === "object" && !Array.isArray(args.home) ? args.home as { x?: unknown; y?: unknown } : undefined;
    const rawX = args.x ?? home?.x;
    const rawY = args.y ?? home?.y;
    if (!Number.isInteger(rawX) || !Number.isInteger(rawY)) {
      throw new ToolError(`place_npc 에는 배치 칸 x,y(정수) 또는 home:{x,y} 가 필요합니다 — 받은 x=${JSON.stringify(args.x)}, y=${JSON.stringify(args.y)}, home=${JSON.stringify(args.home)}.`, { code: "invalid-args" });
    }
    const requestedX = rawX as number;
    const requestedY = rawY as number;
    const name = args.name as string;
    const actionGuide = args.guide === "action-controls";
    // 2026-09-18 거부 대신 기본값. pages 없는 NPC 를 invalid-args 로 막던 규칙이 한 런에서 4번 나왔다 —
    // 모델은 dialogue.text 를 보내거나 아무 말도 안 붙였고, 그때마다 배치가 통째로 무효였다.
    // dialogue.text 가 있으면 그걸 첫 페이지로 옮기고, 없으면 인사 한 줄을 기본으로 깐다. 경고로 알린다.
    // 단, dialogue 가 애매한 모양(null·빈 문자열·choices/when 같은 추가 키)이면 추측하지 않고 예전처럼 repair 힌트와 함께 거부한다.
    let pagesArg = args.pages as SimplePage[] | undefined;
    let pagesDefaulted: string | null = null;
    if (!actionGuide && pagesArg === undefined) {
      const dialogue = args.dialogue;
      const plainText = typeof dialogue === "string" ? dialogue.trim()
        : typeof dialogue === "object" && dialogue !== null && !Array.isArray(dialogue)
          && Object.keys(dialogue).every((key) => key === "text") && typeof (dialogue as { text?: unknown }).text === "string"
          ? (dialogue as { text: string }).text.trim() : null;
      // 최상위 commands 는 스키마 밖이지만 모델이 upsert_event 처럼 자주 보낸다. 버리고 인사 한 줄을 깔면
      // 저작한 대사가 조용히 사라진다(2026-09-24 꿈 세계: 「말없이 춤춘다」가 「그림자 사람 1입니다. 안녕하세요.」로).
      if (Array.isArray(args.commands) && args.commands.length > 0 && dialogue === undefined) {
        pagesArg = [{ commands: args.commands }];
        pagesDefaulted = "최상위 commands → pages[0].commands 로 옮김";
      } else if (dialogue === undefined) {
        pagesArg = [{ lines: [`${name}입니다. 안녕하세요.`] }];
        pagesDefaulted = "pages 생략 → 인사 한 줄 기본 적용";
      } else if (plainText) {
        pagesArg = [{ lines: [plainText] }];
        pagesDefaulted = "dialogue.text → pages[0].lines 로 옮김";
      } else {
        const repair = placeNpc.invalidArgsRepair?.(args);
        throw new ToolError(`일반 NPC에는 pages가 필요합니다.${repair ? `\nrepair: ${JSON.stringify(repair)}` : ""}`, { code: "invalid-args" });
      }
    }
    const explicitId = typeof args.id === "string" && args.id.trim()
      ? args.id.trim()
      : actionGuide ? `ev_action_controls_${map.id}` : undefined;
    if (!inMapBounds(map, requestedX, requestedY)) {
      throw new ToolError(`NPC 위치가 맵 밖입니다: (${requestedX}, ${requestedY})`, { code: "npc-out-of-bounds", mapId: map.id, x: requestedX, y: requestedY });
    }
    // 에이전틱 편의: 통행 불가 칸을 지정하면 실패 대신 근처(반경 3) 통행 가능 칸으로 자동 착지.
    const existingNpc = explicitId ? map.events.find(e => e.id === explicitId) : findNearbySimilarNpc(map, requestedX, requestedY, name, 2);
    const landing = existingNpc ? { x: existingNpc.x, y: existingNpc.y } : nearestPassableCell(draft, map, requestedX, requestedY, 3, explicitId);
    if (!landing) {
      throw new ToolError(
        `NPC를 놓을 통행 가능 칸이 없습니다: (${requestedX}, ${requestedY}) 주변 반경 3칸까지 전부 통행 불가입니다. get_map_region으로 지형을 확인하세요.`,
        { code: "npc-impassable", mapId: map.id, x: requestedX, y: requestedY }
      );
    }
    const { x, y } = landing;
    // graphic 생략 시 투명 고스트가 되지 않도록 주민 기본 캐릭터를 쓴다(함정/컷신은 별도 툴).
    // 일반 query + 시드 샘플 + 맵 내 중복 회피로 동일 타일 그림판 몰림을 줄인다.
    const normalizationWarnings: string[] = [];
    const graphicSpec = (args.graphic as GraphicSpec | undefined) ?? { query: "villager" };
    const specQuery = "query" in graphicSpec ? graphicSpec.query : undefined;
    const recurring = specQuery !== undefined ? recurringCharacterLook(draft, map.id, name) : undefined;
    if (recurring) normalizationWarnings.push(`같은 인물 '${name}' 이 ${recurring.mapId} 에 이미 있어 그 외형을 그대로 썼습니다(graphic.query "${specQuery}" 대신). 다른 모습이 의도라면 graphic 을 sprite 로 명시하세요.`);
    const graphic = recurring?.graphic ?? resolveGraphic(graphicSpec, {
      avoidKeys: usedCharsetGraphicKeysOnMap(map),
      seed: `${map.id}:${name}:${x},${y}`,
      overrides: draft.charsetLabels,
    });
    // 근접 유사 NPC: 상점 역할이면 id가 달라도 기존 이벤트로 합친다(상점 주인+상인 thrash).
    // 일반 NPC는 id 생략일 때만 병합 — 명시 id 2개는 의도적 복수 배치.
    const similar = existingNpc ?? (actionGuide ? undefined : findNearbySimilarNpc(map, x, y, name, 2));
    const shopRole = isShopRoleNpcName(name);
    const mergeSimilar = Boolean(similar) && (similar?.id === explicitId || shopRole || !explicitId);
    const id = mergeSimilar ? similar!.id : (explicitId ?? genId("ev_npc"));
    const reused = mergeSimilar;
    if (args.graphic === undefined) normalizationWarnings.push("graphic 생략 → query:\"villager\" 기본 적용");
    if (pagesDefaulted) normalizationWarnings.push(pagesDefaulted);
    if (reused) normalizationWarnings.push(`근접 유사 NPC 재사용 → id:${id} (새 이벤트 대신 갱신)`);
    // 명시 movement 우선, 생략 시 이름 아키타입 추론(guide 예외는 제자리).
    const movement = actionGuide ? PASSIVE : resolveNpcMovement(name, args.movement, normalizationWarnings);
    const faceArg = resolvePlaceNpcFaceArg(args.face);
    const pages = compileSimplePages(id, name, actionGuide ? [{ text: ACTION_CONTROLS_GUIDE }] : pagesArg as SimplePage[], graphic, {
      movement,
      warnings: normalizationWarnings,
      face: faceArg,
      injectFace: !actionGuide || args.face !== undefined,
    });
    let event: GameEvent;
    let finalX = x;
    let finalY = y;
    if (reused && similar) {
      event = structuredClone(similar);
      event.pages = pages;
      finalX = similar.x;
      finalY = similar.y;
      normalizationWarnings.push(`병합 → 기존 위치 (${finalX}, ${finalY}) 유지, schedule ${similar.schedule?.length ?? 0}개 보존`);
    } else {
      event = { id, x, y, trigger: { kind: "action" }, commands: [], pages };
    }
    event.name = name;
    // 뒤 페이지가 「호감 >= 4」만으로 앞 페이지의 +2/+3을 덮으면, 엔딩 문턱 6에는 영영 못 닿는다.
    // (2026-09-24 연애 도그푸딩: 데이트 페이지가 대화를 지워 나래호감이 4에서 멈춤)
    keepGainPageBelowHigherEnding(draft, event, normalizationWarnings);
    event.placementRole = "npc";
    const requestedCharacterId = typeof args.characterId === "string" && args.characterId.trim()
      ? args.characterId.trim()
      : undefined;
    if (requestedCharacterId) {
      event.characterId = allocateCharacterId(draft, requestedCharacterId, name, normalizationWarnings);
    } else if (eventUsesFriendship(event)) {
      event.characterId = event.characterId
        ?? allocateCharacterId(draft, undefined, name, normalizationWarnings);
      normalizationWarnings.push(`호감 페이지/커맨드 → characterId '${event.characterId}' 자동 할당`);
    }
    ensureEventStoryFlags(draft, event, normalizationWarnings);
    assertEventShape(event, normalizationWarnings, event, draft);
    assertEventPartyActorReferences(draft, event);
    upsertEventIntoMap(map, event);
    normalizationWarnings.push(...unwrittenSwitchGateWarnings(draft, event));
    const npcPassage = passageBlockWarning(draft, map, event);
    if (npcPassage) normalizationWarnings.push(npcPassage);
    finalX = event.x;
    finalY = event.y;
    const adjusted = finalX !== requestedX || finalY !== requestedY;
    const warnings = [
      ...(adjusted ? [`NPC '${name}' 위치 자동 조정: (${requestedX}, ${requestedY}) → (${finalX}, ${finalY})`] : []),
      ...normalizationWarnings,
    ];
    const pageCount = event.pages?.length ?? 0;
    const normalizationSummary = normalizationWarnings.length > 0 ? ` — SimplePage 정규화 경고 ${normalizationWarnings.length}건` : "";
    const reuseSummary = reused ? ` — 기존 NPC 병합 갱신` : "";
    const pageSummary = ` — 페이지 ${pageCount}개`;
    return {
      summary: `${map.name}에 NPC '${name}' 배치 (${finalX}, ${finalY})${pageSummary}${adjusted ? ` — 요청 좌표 (${requestedX}, ${requestedY})에서 자동 조정` : ""}${reuseSummary}${normalizationSummary}`,
      data: { eventId: id, x: finalX, y: finalY, adjusted, reused, pageCount, characterId: event.characterId },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

/**
 * 시간표를 저장했지만 시간 시스템이 꺼져 있으면 경고한다.
 *
 * 왜(2026-07-26 실측): updateNpcSchedules 는 `resolveTimeSystem(project)` 가 없으면 즉시 return 한다
 * (npcSchedules.ts:31). 즉 timeSystem 이 꺼진 프로젝트에서는 시간표를 아무리 넣어도 NPC 가
 * 영원히 제자리에 얼어 있고, **아무 경고도 없었다**. 저작한 데이터가 조용히 죽는 부류의 결함이다.
 */
function timeSystemOffWarnings(project: Project, scheduleCount: number): string[] {
  if (scheduleCount === 0) return [];
  if (resolveTimeSystem(project)) return [];
  return [
    "시간 시스템이 꺼져 있어 이 시간표는 실행되지 않습니다 — NPC 가 제자리에 머무릅니다. " +
      "system.timeSystem.enabled 를 켜면 시간표대로 이동합니다.",
  ];
}

const setNpcSchedule: ToolDefinition = {
  name: "set_npc_schedule",
  description:
    "기존 NPC 이벤트에 시간표를 설정한다. timeSystem이 켜진 플레이에서 when이 현재 시간과 맞으면 at으로 이동한다. 요일은 GameTime에 없으므로 dayRange를 사용한다. 순찰·출근·귀가 같은 이동 시간표는 이 툴(NPC 를 여러 개 복제하지 말 것).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      eventId: { type: "string" },
      schedule: npcScheduleSchema,
    },
    required: ["mapId", "eventId", "schedule"],
  },
  invalidArgsExample: {
    mapId: "map_town",
    eventId: "ev_farmer",
    schedule: [
      { when: { hourRange: [6, 18], season: "spring" }, at: { mapId: "map_town", x: 8, y: 10 }, facing: "down", activity: "field" },
    ],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const event = map.events.find((entry) => entry.id === args.eventId);
    if (!event) throw new ToolError(`스케줄을 설정할 이벤트를 찾을 수 없습니다: ${args.eventId}`, { code: "event-not-found", mapId: map.id });
    const schedule = parseNpcSchedule(draft, args.schedule, "schedule");
    event.schedule = schedule.length > 0 ? schedule : undefined;
    return {
      summary: `${map.name} 이벤트 '${event.id}' 스케줄 ${schedule.length}개 설정`,
      warnings: timeSystemOffWarnings(draft, schedule.length),
      data: { eventId: event.id, scheduleCount: schedule.length },
    };
  },
};

const makeVillager: ToolDefinition = {
  name: "make_villager",
  description:
    "home 좌표에 주민 NPC를 만들고 선택적으로 schedule/dailyRoutine/dialogue/pages를 함께 설정한다. 복잡한 상태별 페이지(선택지·selfSwitch·퀘스트 스위치)는 pages 를 쓰고, 간단한 조건 대사는 dialogue.when 을 쓴다. 같은 맵에 동일 event id 또는 characterId가 이미 있으면 새 주민을 복제하지 않고 기존 위치·생략한 대사 페이지를 보존하며 갱신한다. dailyRoutine은 {workAt,workHours:[start,end]}로 집→일터→귀가 스케줄을 생성한다. 상점 주민은 shop 을 넣어 1회만 만든다(place_npc 와 중복 금지). 한 줄 인사만 두지 말고 조건이 다른 페이지를 둘 것.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      name: { type: "string" },
      graphic: GRAPHIC_SPEC_SCHEMA,
      home: COORD_SCHEMA,
      movement: { type: "string", enum: ["fixed", "random", "approach"], description: "자율 이동. 생략 시 이름 아키타입 추론: 배회형(아이·행상·동물)→random, 추격형→approach, 상점 주인·대화 거점→fixed, 모호하면 fixed. 명시가 추론보다 우선." },
      schedule: npcScheduleSchema,
      dailyRoutine: {
        type: "object",
        description: "{workAt:{mapId?,x,y}, workHours:[start,end]}",
        properties: {
          workAt: {
            type: "object",
            properties: { mapId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } },
            required: ["x", "y"],
          },
          workHours: { type: "array", description: "[시작시각, 종료시각]", items: { type: "integer" } },
        },
      },
      pages: {
        type: "array",
        description:
          "상태별 SimplePage[]. 주면 dialogue 대신 이 페이지를 쓴다. 선택지·setSelfSwitch·상점 외 커맨드가 필요하면 이쪽.",
        items: SIMPLE_PAGE_SCHEMA,
      },
      dialogue: {
        type: "array",
        description: "{when?,text}[] — when 조건에 맞는 대사 페이지. 복잡한 분기는 pages 를 써라.",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            when: {
              type: "object",
              properties: {
                npcActivity: { type: "string" },
                activity: { type: "string" },
                timePhase: { type: "string", enum: ["morning", "day", "evening", "night"] },
                season: { type: "string", enum: ["spring", "summer", "fall", "winter"] },
                switchId: { type: "string", description: "켜진 스위치(기본 value=true). switchValue 로 극성" },
                switchValue: { type: "boolean" },
                selfSwitch: { type: "string", enum: ["A", "B", "C", "D"] },
                variableId: { type: "string" },
                op: { type: "string", enum: ["==", ">=", "<=", ">", "<", "!="] },
                value: { type: "integer", description: "variable 비교값" },
                itemId: { type: "string" },
                present: { type: "boolean" },
                friendshipAtLeast: { type: "integer" },
              },
            },
          },
          required: ["text"],
        },
      },
      giftPrefs: giftPrefsSchema,
      giftResponses: giftResponsesSchema,
      shop: {
        type: "object",
        description: "{stock: ShopStockEntry[]} 상점 주민 옵션",
        properties: { stock: shopStockSchema },
      },
      id: { type: "string" },
      characterId: { type: "string", description: "공유 호감/선물 키. 생략 시 name slug 또는 생성 id" },
      talkFriendship: { type: "boolean", description: "일일 대화 호감 opt-in" },
      friendshipUnlock: { type: "integer", description: "호감 임계 페이지 추가 (D0 패턴)" },
      friendshipLines: {
        type: "object",
        description: "friendshipUnlock 페이지의 대사 {unlock, after}. 생략하면 그 페이지는 대사 없이 만들어지고 캐스트 라이터가 채운다 — 코드는 대사를 지어내지 않는다.",
        properties: { unlock: { type: "string" }, after: { type: "string" } },
      },
    },
    required: ["mapId", "name", "home"],
  },
  invalidArgsExample: {
    mapId: "map_town",
    name: "농부",
    home: { x: 4, y: 8 },
    dailyRoutine: { workAt: { x: 12, y: 8 }, workHours: [6, 18] },
    dialogue: [{ when: { npcActivity: "work" }, text: "밭을 돌보는 중이야." }],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const name = stringArg(args.name, "name");
    const homeRaw = pointFromRecord(args.home, "home");
    // place_npc와 동일: 통행 불가 칸이면 근처 통행 가능 칸으로 자동 착지.
    const homeLanding = nearestPassableCell(draft, map, homeRaw.x, homeRaw.y, 3);
    if (!homeLanding) {
      throw new ToolError(
        `주민을 놓을 통행 가능 칸이 없습니다: (${homeRaw.x}, ${homeRaw.y}) 주변 반경 3칸까지 전부 통행 불가입니다.`,
        { code: "npc-impassable", mapId: map.id, x: homeRaw.x, y: homeRaw.y }
      );
    }
    const home = { x: homeLanding.x, y: homeLanding.y };
    const homeAdjusted = home.x !== homeRaw.x || home.y !== homeRaw.y;
    const warnings: string[] = [];
    if (args.graphic === undefined) warnings.push("graphic 생략 → query:\"villager\" 기본 적용");
    const villagerMovement = resolveNpcMovement(name, args.movement, warnings);
    const schedule = args.schedule !== undefined
      ? parseNpcSchedule(draft, args.schedule, "schedule")
      : routineSchedule(draft, map.id, home, args.dailyRoutine);
    const graphicSpec = (args.graphic as GraphicSpec | undefined) ?? { query: "villager" };
    const graphic = resolveGraphic(graphicSpec, {
      avoidKeys: usedCharsetGraphicKeysOnMap(map),
      seed: `${map.id}:${name}:${home.x},${home.y}`,
      overrides: draft.charsetLabels,
    });
    const explicitId = typeof args.id === "string" && args.id.trim() ? args.id.trim() : undefined;
    const requestedCharacterId = typeof args.characterId === "string" && args.characterId.trim()
      ? args.characterId.trim()
      : undefined;
    const exactIdMatch = explicitId ? map.events.find((event) => event.id === explicitId) : undefined;
    const characterIdMatch = requestedCharacterId
      ? map.events.find((event) => event.characterId?.trim() === requestedCharacterId)
      : undefined;
    const similar = findNearbySimilarNpc(map, home.x, home.y, name, 2);
    const shopRole = isShopRoleNpcName(name);
    const nearbyMatch = Boolean(similar) && (shopRole || !explicitId) ? similar : undefined;
    const reusedEvent = exactIdMatch ?? characterIdMatch ?? nearbyMatch;
    const id = reusedEvent?.id ?? explicitId ?? genId("ev_villager");
    const reused = reusedEvent !== undefined;
    if (args.graphic === undefined && reused) { /* 비재사용 경고는 위에서 이미 기록 */ }
    if (homeAdjusted) warnings.push(`주민 위치 자동 조정: (${homeRaw.x}, ${homeRaw.y}) → (${home.x}, ${home.y})`);
    if (exactIdMatch) warnings.push(`동일 event id NPC 재사용 → id:${id} (새 이벤트 대신 갱신)`);
    else if (characterIdMatch) warnings.push(`동일 characterId NPC 재사용 → id:${id} (중복 이벤트 대신 갱신)`);
    else if (nearbyMatch) warnings.push(`근접 유사 NPC 재사용 → id:${id} (새 이벤트 대신 갱신)`);
    const authoredPages = Array.isArray(args.pages) ? args.pages as SimplePage[] : undefined;
    if (authoredPages && args.dialogue !== undefined) {
      warnings.push("pages 와 dialogue 가 함께 오면 pages 가 이기고 dialogue 는 무시됩니다.");
    }
    const pages = compileSimplePages(
      id,
      name,
      authoredPages ?? villagerPages(args.dialogue, schedule, warnings),
      graphic,
      {
        movement: villagerMovement,
        warnings,
        face: resolvePlaceNpcFaceArg(args.face),
      },
    );
    const giftPrefs = parseGiftPrefs(draft, args.giftPrefs, "giftPrefs");
    const giftResponses = parseGiftResponses(args.giftResponses, "giftResponses");
    const shopStock = parseOptionalShopStock(draft, (args.shop as Record<string, unknown> | undefined)?.stock, "shop.stock");
    if (shopStock) appendShopCommandToPages(pages, shopStock);
    const characterId = reusedEvent
      ? (requestedCharacterId ?? reusedEvent.characterId ?? allocateCharacterId(draft, undefined, name, warnings))
      : allocateCharacterId(draft, args.characterId, name, warnings);
    const unlockAt = typeof args.friendshipUnlock === "number" && Number.isFinite(args.friendshipUnlock)
      ? Math.max(1, Math.trunc(args.friendshipUnlock))
      : undefined;
    const friendshipLines = parseFriendshipLines(args.friendshipLines);
    if (unlockAt !== undefined) {
      pages.push({
        id: genId("page_friend"),
        name: "호감 해금",
        conditions: [{ kind: "friendshipAtLeast", value: unlockAt }],
        graphic: pages[0]?.graphic ?? {},
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: villagerMovement,
        commands: [
          ...(friendshipLines?.unlock ? [{ kind: "text", speaker: name, body: friendshipLines.unlock } as Command] : []),
          { kind: "setSelfSwitch", key: "A", value: true },
        ],
      });
      pages.push({
        id: genId("page_friend_done"),
        name: "호감 이후",
        conditions: [
          { kind: "selfSwitch", key: "A", value: true },
          { kind: "friendshipAtLeast", value: unlockAt },
        ],
        graphic: pages[0]?.graphic ?? {},
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: villagerMovement,
        commands: friendshipLines?.after ? [{ kind: "text", speaker: name, body: friendshipLines.after }] : [],
      });
    }
    const talkFriendship = args.talkFriendship === true ? true : undefined;
    let event: GameEvent;
    if (reusedEvent) {
      event = structuredClone(reusedEvent);
      const replacesDialoguePages = args.dialogue !== undefined || authoredPages !== undefined || unlockAt !== undefined;
      if (replacesDialoguePages) {
        event.pages = pages;
      } else if (args.graphic !== undefined) {
        for (const page of event.pages ?? []) page.graphic = structuredClone(graphic);
      }
      if (shopStock) setShopStockOnEvent(event, shopStock);
      event.characterId = characterId;
      if (args.schedule !== undefined || args.dailyRoutine !== undefined) {
        event.schedule = schedule.length > 0 ? schedule : undefined;
      }
      if (giftPrefs) event.giftPrefs = giftPrefs;
      if (giftResponses) event.giftResponses = giftResponses;
      if (talkFriendship) event.talkFriendship = talkFriendship;
      if (args.movement !== undefined && !replacesDialoguePages) {
        for (const page of event.pages ?? []) page.movement = structuredClone(villagerMovement);
        warnings.push(`이동 갱신 → ${args.movement === "random" ? "random(배회)" : "fixed(제자리)"}`);
      }
      warnings.push(replacesDialoguePages
        ? `병합 → 기존 위치 (${reusedEvent.x}, ${reusedEvent.y}) 유지, 대사 페이지 갱신`
        : `병합 → 기존 위치 (${reusedEvent.x}, ${reusedEvent.y}) 및 생략한 대사 페이지 유지`);
    } else {
      event = {
        id,
        characterId,
        x: home.x,
        y: home.y,
        trigger: { kind: "action" },
        commands: [],
        pages,
        ...(schedule.length > 0 ? { schedule } : {}),
        ...(giftPrefs ? { giftPrefs } : {}),
        ...(giftResponses ? { giftResponses } : {}),
        ...(talkFriendship ? { talkFriendship } : {}),
      };
    }
    ensureEventStoryFlags(draft, event, warnings);
    assertEventShape(event, warnings);
    assertEventPartyActorReferences(draft, event);
    upsertEventIntoMap(map, event);
    const finalX = reusedEvent?.x ?? home.x;
    const finalY = reusedEvent?.y ?? home.y;
    const pageCount = event.pages?.length ?? 0;
    const reuseSummary = reused ? " — 기존 NPC 병합 갱신" : "";
    // 시간표를 붙였는데 시간 시스템이 꺼져 있으면 그 시간표는 실행되지 않는다(set_npc_schedule 과 동일).
    warnings.push(...timeSystemOffWarnings(draft, schedule.length));
    return {
      summary: `${map.name}에 주민 '${name}' 생성 (${finalX}, ${finalY}) — characterId=${characterId}, 스케줄 ${schedule.length}개, 대사 페이지 ${pageCount}개${shopStock ? ", 상점 재고 " + shopStock.length + "개" : ""}${reuseSummary}`,
      data: { eventId: id, characterId, x: finalX, y: finalY, scheduleCount: schedule.length, pageCount, shopStockCount: shopStock?.length ?? 0, reused },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const setShopStock: ToolDefinition = {
  name: "set_shop_stock",
  description:
    "기존 이벤트의 첫 shop 커맨드에 계절 재고(stock)를 설정한다. shop 커맨드가 없으면 첫 페이지(없으면 이벤트 루트)에 상점 커맨드를 추가한다. 상인 NPC 에 판매 재고를 연결하는 정본 — itemId 에는 아이템 id 와 착용 장비(database.equipment) id 를 모두 쓸 수 있다(무기점·방어구점). id 는 get_database_records 로 먼저 확인.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      eventId: { type: "string" },
      stock: shopStockSchema,
    },
    required: ["mapId", "eventId", "stock"],
  },
  invalidArgsExample: {
    mapId: "map_town",
    eventId: "ev_merchant",
    stock: [
      { itemId: "item_spring_seed", seasons: ["spring"], priceBySeason: { spring: 18 } },
      { itemId: "item_firewood", seasons: ["winter"], priceOverride: 30 },
    ],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const event = map.events.find((entry) => entry.id === args.eventId);
    if (!event) throw new ToolError(`상점 재고를 설정할 이벤트를 찾을 수 없습니다: ${args.eventId}`, { code: "event-not-found", mapId: map.id });
    const stock = parseShopStock(draft, args.stock, "stock");
    const outcome = setShopStockOnEvent(event, stock);
    assertEventShape(event);
    return {
      summary: `${map.name} 이벤트 '${event.id}' 상점 재고 ${stock.length}개 ${outcome === "added" ? "추가" : "설정"}`,
      data: { eventId: event.id, stockCount: stock.length, outcome },
    };
  },
};

function allocateCharacterId(
  project: Project,
  raw: unknown,
  name: string,
  warnings: string[]
): string {
  const preferred =
    typeof raw === "string" && raw.trim()
      ? raw.trim()
      : slugCharacterId(name) || genId("char_");
  const used = new Set<string>();
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const id = event.characterId?.trim();
      if (id) used.add(id);
    }
  }
  if (!used.has(preferred)) return preferred;
  let n = 2;
  let candidate = `${preferred}_${n}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${preferred}_${n}`;
  }
  warnings.push(`characterId '${preferred}' 충돌 → '${candidate}' 사용`);
  return candidate;
}

function slugCharacterId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base ? `char_${base}` : "";
}

function parseGiftPrefs(project: Project, raw: unknown, label: string): GiftPrefs | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ToolError(`${label}는 객체여야 합니다.`, { code: "gift-prefs" });
  }
  const record = raw as Record<string, unknown>;
  return {
    ...(record.loved !== undefined ? { loved: parseItemIdArray(project, record.loved, `${label}.loved`) } : {}),
    ...(record.liked !== undefined ? { liked: parseItemIdArray(project, record.liked, `${label}.liked`) } : {}),
    ...(record.disliked !== undefined ? { disliked: parseItemIdArray(project, record.disliked, `${label}.disliked`) } : {}),
  };
}

function parseGiftResponses(raw: unknown, label: string): GiftResponses | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ToolError(`${label}는 객체여야 합니다.`, { code: "gift-responses" });
  }
  const record = raw as Record<string, unknown>;
  const responses: Record<string, string> = {};
  for (const key of ["loved", "liked", "neutral", "disliked", "alreadyGifted", "noItems"]) {
    const value = cleanOptionalString(record[key]);
    if (value) responses[key] = value;
  }
  return responses as GiftResponses;
}

function parseOptionalShopStock(project: Project, raw: unknown, label: string): ShopStockEntry[] | undefined {
  return raw === undefined ? undefined : parseShopStock(project, raw, label);
}

function parseShopStock(project: Project, raw: unknown, label: string): ShopStockEntry[] {
  if (!Array.isArray(raw)) throw new ToolError(`${label}는 배열이어야 합니다.`, { code: "shop-stock" });
  const stock = raw.map((value, index): ShopStockEntry => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new ToolError(`${label}[${index}]는 객체여야 합니다.`, { code: "shop-stock" });
    }
    const record = value as Record<string, unknown>;
    const itemId = sellableIdArg(project, record.itemId, `${label}[${index}].itemId`);
    const seasons = record.seasons === undefined ? undefined : parseSeasonArray(record.seasons, `${label}[${index}].seasons`);
    const priceOverride = record.priceOverride === undefined ? undefined : priceArg(record.priceOverride, `${label}[${index}].priceOverride`);
    const priceBySeason = record.priceBySeason === undefined ? undefined : parsePriceBySeason(record.priceBySeason, `${label}[${index}].priceBySeason`);
    return {
      itemId,
      ...(seasons ? { seasons } : {}),
      ...(priceOverride !== undefined ? { priceOverride } : {}),
      ...(priceBySeason ? { priceBySeason } : {}),
    };
  });
  validateShopStock(label, stock);
  return stock;
}

function parseItemIdArray(project: Project, raw: unknown, label: string): string[] {
  if (!Array.isArray(raw)) throw new ToolError(`${label}는 itemId 배열이어야 합니다.`, { code: "item-id-array" });
  return raw.map((value, index) => itemIdArg(project, value, `${label}[${index}]`));
}

function itemIdArg(project: Project, raw: unknown, label: string): string {
  const itemId = stringArg(raw, label);
  if (!project.database.items.some((item) => item.id === itemId)) {
    throw new ToolError(`${label} 존재하지 않는 itemId: ${itemId} — 허용 예시: ${knownIds(project.database.items)}`, { code: "item-not-found" });
  }
  return itemId;
}

/** 상점 재고 id — 런타임 상점(goodsIndex)·참조 검증과 같이 아이템과 착용 장비를 모두 받는다. */
function sellableIdArg(project: Project, raw: unknown, label: string): string {
  const itemId = stringArg(raw, label);
  if (project.database.items.some((item) => item.id === itemId) || project.database.equipment.some((record) => record.id === itemId)) return itemId;
  throw new ToolError(`${label} 존재하지 않는 itemId: ${itemId} — 아이템(${knownIds(project.database.items)}) 또는 장비(${knownIds(project.database.equipment)}) id 를 쓰세요`, { code: "item-not-found" });
}

function parseSeasonArray(raw: unknown, label: string): Season[] {
  if (!Array.isArray(raw)) throw new ToolError(`${label}는 계절 배열이어야 합니다.`, { code: "season-array" });
  return raw.map((value, index) => parseSeasonArg(value, `${label}[${index}]`));
}

function parsePriceBySeason(raw: unknown, label: string): Partial<Record<Season, number>> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ToolError(`${label}는 객체여야 합니다.`, { code: "price-by-season" });
  }
  const result: Partial<Record<Season, number>> = {};
  for (const [season, value] of Object.entries(raw)) {
    if (!isSeason(season)) throw new ToolError(`${label}.${season} 계절이 잘못되었습니다.`, { code: "season" });
    result[season] = priceArg(value, `${label}.${season}`);
  }
  return result;
}

function priceArg(raw: unknown, label: string): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) throw new ToolError(`${label} 숫자가 필요합니다.`, { code: "price" });
  return Math.max(0, Math.trunc(raw));
}

function shopCommandFromStock(stock: readonly ShopStockEntry[]): Extract<Command, { kind: "shop" }> {
  return {
    kind: "shop",
    itemIds: uniqueStockItemIds(stock),
    stock: [...stock],
    allowSell: true,
    quantityMode: "select",
    shopType: "normal",
    messageType: "welcome",
  };
}

function appendShopCommandToPages(pages: EventPage[], stock: readonly ShopStockEntry[]): void {
  for (const page of pages) page.commands.push(shopCommandFromStock(stock));
}

function setShopStockOnEvent(event: GameEvent, stock: readonly ShopStockEntry[]): "added" | "modified" {
  if ((event.pages?.length ?? 0) > 0) {
    let modified = false;
    for (const page of event.pages ?? []) {
      const existing = findFirstShopCommand(page.commands);
      if (existing) {
        existing.itemIds = uniqueStockItemIds(stock);
        existing.stock = [...stock];
        modified = true;
      } else {
        page.commands.push(shopCommandFromStock(stock));
      }
    }
    return modified ? "modified" : "added";
  }
  const existing = findFirstShopCommand(event.commands);
  if (existing) {
    existing.itemIds = uniqueStockItemIds(stock);
    existing.stock = [...stock];
    return "modified";
  }
  event.commands.push(shopCommandFromStock(stock));
  return "added";
}

function findFirstShopCommand(commands: readonly Command[]): Extract<Command, { kind: "shop" }> | undefined {
  for (const command of commands) {
    if (command.kind === "shop") return command;
    if (command.kind === "choices") {
      for (const option of command.options) {
        const found = findFirstShopCommand(option.branch);
        if (found) return found;
      }
      const cancelFound = findFirstShopCommand(command.cancelBranch ?? []);
      if (cancelFound) return cancelFound;
    } else if (command.kind === "fork") {
      const found = findFirstShopCommand(command.then) ?? findFirstShopCommand(command.else ?? []);
      if (found) return found;
    } else if (command.kind === "loop") {
      const found = findFirstShopCommand(command.body);
      if (found) return found;
    } else if (command.kind === "promoteActor") {
      const found = findFirstShopCommand(command.successBranch ?? []) ?? findFirstShopCommand(command.failureBranch ?? []);
      if (found) return found;
    } else if (command.kind === "evolveMonster") {
      const found = findFirstShopCommand(command.successBranch ?? []) ?? findFirstShopCommand(command.failureBranch ?? []);
      if (found) return found;
    }
  }
  return undefined;
}

function uniqueStockItemIds(stock: readonly ShopStockEntry[]): string[] {
  return [...new Set(stock.map((entry) => entry.itemId))];
}

// (x,y)에서 가까운 순(링 확장)으로 통행 가능 + 이벤트 없는 칸을 찾는다.
//
// 후보가 여러 통행 컴포넌트에 갈라지면 **가장 큰 컴포넌트**의 첫 칸(링 순서)을 고른다.
// 봉인된 주머니가 방보다 링에서 먼저 나오면 자동 조정이 그 안에 놓이고 플레이어는 끝까지
// 걸어가지 못한다(2026-09-24 몬스터 수집 r2: NPC 뒤 주머니 (3,4)에 ev_starters 가 앉아
// 「첫 파트너 받기」 조사가 도달 불가로 막혔다). 단일 컴포넌트 맵에서는 기존과 같은 칸을 고른다.
function nearestPassableCell(
  project: Project,
  map: GameMap,
  x: number,
  y: number,
  maxRadius: number,
  ignoreEventId?: string,
  reserved?: ReadonlySet<string>,
): Point | null {
  const occupied = new Set([
    ...map.events
      .filter((event) => event.id !== ignoreEventId)
      .map((event) => `${event.x},${event.y}`),
    ...(reserved ?? []),
  ]);
  // 컴포넌트 경계: 통행 불가 타일 + 같은 칸을 몸으로 막는 이벤트(EventPlacementAnalysis 와 같은 blocker 정의).
  const blockerCells = new Set(
    map.events
      .filter((event) => {
        if (event.id === ignoreEventId) return false;
        const page = event.pages?.[0];
        return (page?.priority ?? "same") === "same" && page?.overlapForbidden !== false;
      })
      .map((event) => `${event.x},${event.y}`),
  );
  const componentCache = new Map<string, number>(); // 셀 키 → 같은 컴포넌트의 칸 수
  const componentSize = (sx: number, sy: number): number => {
    const cached = componentCache.get(`${sx},${sy}`);
    if (cached !== undefined) return cached;
    const cells: string[] = [];
    const seen = new Set<string>([`${sx},${sy}`]);
    const queue: Array<[number, number]> = [[sx, sy]];
    for (let head = 0; head < queue.length; head += 1) {
      const [cx, cy] = queue[head]!;
      cells.push(`${cx},${cy}`);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx;
        const ny = cy + dy;
        const key = `${nx},${ny}`;
        if (seen.has(key) || !inMapBounds(map, nx, ny)) continue;
        if (!isPassable(project, map, nx, ny) || blockerCells.has(key)) continue;
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
    for (const key of cells) componentCache.set(key, cells.length);
    return cells.length;
  };
  const candidates: Point[] = [];
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    candidates.length = 0;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const cx = x + dx;
        const cy = y + dy;
        if (!inMapBounds(map, cx, cy)) continue;
        if (occupied.has(`${cx},${cy}`)) continue;
        if (!isPassable(project, map, cx, cy)) continue;
        candidates.push({ x: cx, y: cy });
      }
    }
    // 가까운 반경이 이긴다 — 그 안에서만 큰 컴포넌트를 고른다(요청 칸 자체 후보는 항상 유지).
    if (candidates.length > 0) {
      const sizes = candidates.map((cell) => componentSize(cell.x, cell.y));
      const maxSize = Math.max(...sizes);
      return candidates[sizes.indexOf(maxSize)] ?? null;
    }
  }
  return null;
}

function transferEndpoint(
  project: Project,
  map: GameMap,
  requestedX: number,
  requestedY: number,
  maxRadius = 3,
  notes?: string[],
): { gate: Point; landing: Point } | null {
  const occupied = new Set(map.events.map((event) => `${event.x},${event.y}`));
  // 벽에서 1칸 안쪽·벽 칸 위 요청은 벽과 맞닿은 통행 칸으로 먼저 당긴다.
  // playerTouch+below 는 벽 위에서 발동하지 않는다.
  const origin = snapFlushToWall(project, map, requestedX, requestedY, occupied);
  const cleanSnap = snapFlushToWall(project, map, requestedX, requestedY);
  // 스냅이 점유 때문에 밀려난 자리(origin != cleanSnap)는 gate 후보에서 제외한다.
  // 그렇지 않으면 문 자리(8,1)가 막혔을 때 1칸 안쪽(8,2)이 radius=0에서
  // 그대로 gate로 확정돼 "벽에서 1칸 띄운 출구"가 된다. 옆 flush 칸을 먼저 찾는다.
  const snapBlocked = cleanSnap.x !== origin.x || cleanSnap.y !== origin.y;
  const isFlushGate = (x: number, y: number): boolean => isFlushPassable(project, map, x, y);
  const landingFree = (gate: Point): Point | null => {
    const landing = passableLanding(project, map, gate.x, gate.y);
    if (!landing || (landing.x === gate.x && landing.y === gate.y)) return null;
    if (occupied.has(`${landing.x},${landing.y}`)) return null;
    return landing;
  };
  const choices: Array<{ gate: Point; landing: Point; radius: number; flush: boolean; severs: boolean }> = [];
  for (let radius = snapBlocked ? 1 : 0; radius <= maxRadius; radius += 1) {
    const flushGates: Point[] = [];
    const innerGates: Point[] = [];
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const gate = { x: origin.x + dx, y: origin.y + dy };
        if (!inMapBounds(map, gate.x, gate.y) || occupied.has(`${gate.x},${gate.y}`)) continue;
        if (!isPassable(project, map, gate.x, gate.y)) continue;
        (isFlushGate(gate.x, gate.y) ? flushGates : innerGates).push(gate);
      }
    }
    for (const gate of [...flushGates, ...innerGates]) {
      const landing = landingFree(gate);
      if (!landing) continue;
      choices.push({
        gate,
        landing,
        radius,
        flush: isFlushGate(gate.x, gate.y),
        severs: transferTileSeversWalk(project, map, gate.x, gate.y),
      });
    }
  }
  if (choices.length === 0) return null;
  // 유일한 통로(문간 한 칸)보다, 같은 반경 안의 막지 않는 칸을 먼저 고른다.
  // 유일한 통로보다 막지 않는 칸을 먼저. 그 안에서는 예전처럼 가까운 칸, 그다음 벽에 붙은 칸.
  choices.sort((a, b) =>
    Number(a.severs) - Number(b.severs)
    || a.radius - b.radius
    || Number(b.flush) - Number(a.flush)
    || a.gate.y - b.gate.y
    || a.gate.x - b.gate.x);
  const picked = choices[0]!;
  if (notes && !picked.severs) {
    const blocked = choices.find((choice) => choice.severs && (
      choice.radius < picked.radius || (choice.radius === picked.radius && choice.flush && !picked.flush)
    ));
    if (blocked) {
      notes.push(
        `출입구 (${blocked.gate.x},${blocked.gate.y}) 는 같은 맵의 두 구역을 잇는 유일한 통로라 문을 놓으면 한쪽이 막힙니다. (${picked.gate.x},${picked.gate.y}) 에 두었습니다.`,
      );
    }
  }
  return { gate: picked.gate, landing: picked.landing };
}

/**
 * 출입구 자리를 못 찾은 **실제 원인**을 짚는다.
 *
 * 종전 문구는 원인과 무관하게 "get_map_region으로 주변 구조물과 통행 지형을 확인하세요" 였다.
 * 2026-08-28 실측에서 대상이 구조물 0인 잔디 단색 맵이었는데도 같은 안내가 나갔고, 모델은
 * 지형을 확인해 봐야 소용없는 상태에서 3연속 같은 실패를 반복했다. 실패 경로는 셋뿐이므로
 * (범위 밖 / 이벤트 점유 / 통행 불가) 어느 쪽인지 세어서 알려준다.
 */
/**
 * transferEndpoint + 도달성 보정. 맵에 이미 플레이어가 서는 칸(시작 위치·들어오는 착지점)이 있는데
 * 요청 자리가 거기서 걸어 닿지 않으면, 같은 가장자리의 가장 가까운 닿는 칸으로 옮긴다.
 * 닿는 후보가 없으면 원래 자리를 쓰고 경고만 남긴다(막지 않는다).
 *
 * accept 는 「이 배치로 기존 출입구가 봉쇄되지 않는가」 같은 추가 판정 — 거절하면 사유 문자열을
 * 되돌려 후보를 이어서 찾는다(2026-09-24 추격 호러 r8: 앵커 검사만으로는 못 잡은 문 봉쇄).
 */
function reachableTransferEndpoint(
  project: Project,
  map: GameMap,
  requested: { x: number; y: number },
  label: "A" | "B",
  notes: string[],
  accept?: (endpoint: { gate: Point; landing: Point }) => true | string,
): { gate: Point; landing: Point } | null {
  const localNotes: string[] = [];
  const endpoint = transferEndpoint(project, map, requested.x, requested.y, 3, localNotes);
  const reach = walkableFromAnchors(project, map);
  if (!reach && !accept) {
    notes.push(...localNotes);
    return endpoint;
  }
  // 앵커도 후보 시작점(원자리)도 없으면 후보를 지어내지 않는다 — 실패 원인 안내(A:/B:)를 유지.
  if (!reach && !endpoint) {
    notes.push(...localNotes);
    return endpoint;
  }
  const reached = (point: Point): boolean => reach !== null && reach.has(point.y * map.width + point.x);
  const rejectReason = (candidate: { gate: Point; landing: Point }): string | null => {
    if (reach && (!reached(candidate.gate) || !reached(candidate.landing))) return "reach";
    if (accept) {
      const verdict = accept(candidate);
      if (verdict !== true) return verdict;
    }
    return null;
  };
  let firstReject: string | null = null;
  if (endpoint) {
    firstReject = rejectReason(endpoint);
    if (!firstReject) {
      notes.push(...localNotes);
      return endpoint;
    }
  } else {
    firstReject = "reach";
  }
  // 후보: 앵커에서 닿는 칸(anchors 없으면 통행 칸 전부)을 가까운 순으로.
  const fallbackCells: Point[] | null = reach ? null : (() => {
    const out: Point[] = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (isPassable(project, map, x, y)) out.push({ x, y });
      }
    }
    out.sort((a, b) => (Math.abs(a.x - requested.x) + Math.abs(a.y - requested.y)) - (Math.abs(b.x - requested.x) + Math.abs(b.y - requested.y)) || a.y - b.y || a.x - b.x);
    return out.slice(0, 60);
  })();
  const candidates = reach ? reachableGateCandidates(map, reach, requested).slice(0, 60) : fallbackCells ?? [];
  for (const candidate of candidates) {
    const alt = transferEndpoint(project, map, candidate.x, candidate.y, 0);
    if (!alt) continue;
    const reason = rejectReason(alt);
    if (reason) {
      if (firstReject === "reach" && reason !== "reach") firstReject = reason;
      continue;
    }
    if (firstReject === "reach") {
      notes.push(`출입구 ${label} (${requested.x},${requested.y}) 는 ${map.name} 의 시작 위치·다른 입구에서 걸어 닿지 않아 가장 가까운 닿는 칸 (${alt.gate.x},${alt.gate.y}) 로 옮겼습니다.`);
    } else {
      notes.push(`출입구 ${label} (${requested.x},${requested.y}) 는 ${firstReject} — 가장 가까운 다른 자리 (${alt.gate.x},${alt.gate.y}) 로 옮겼습니다.`);
    }
    return alt;
  }
  if (endpoint) {
    notes.push(...localNotes);
    if (firstReject === "reach") {
      notes.push(`출입구 ${label} (${endpoint.gate.x},${endpoint.gate.y}) 는 ${map.name} 의 시작 위치·다른 입구에서 걸어 닿지 않습니다 — 길을 먼저 내거나 show_map_region 으로 닿는 칸을 확인하세요.`);
    } else {
      notes.push(`출입구 ${label} (${endpoint.gate.x},${endpoint.gate.y}) 는 ${firstReject} — 봉쇄를 피한 자리를 찾지 못했습니다. 기존 문(move_event)을 옮기거나 빈 자리로 좌표를 바꿔 다시 create_transfer_pair 하세요.`);
    }
  }
  return endpoint;
}

function transferEndpointFailure(
  project: Project,
  map: GameMap,
  requestedX: number,
  requestedY: number,
  maxRadius = 3,
): string {
  const occupied = new Set(map.events.map((event) => `${event.x},${event.y}`));
  let inBounds = 0;
  let blockedByEvent = 0;
  let noLanding = 0;
  let usable = 0;
  for (let dy = -maxRadius; dy <= maxRadius; dy += 1) {
    for (let dx = -maxRadius; dx <= maxRadius; dx += 1) {
      const x = requestedX + dx;
      const y = requestedY + dy;
      if (!inMapBounds(map, x, y)) continue;
      inBounds += 1;
      if (occupied.has(`${x},${y}`)) {
        blockedByEvent += 1;
        continue;
      }
      // transferEndpoint 와 같은 판정: 착지 칸이 있고 출입구 칸과 달라야 쓸 수 있다.
      // 착지가 이벤트에 점유돼 있으면 재전이 루프이므로 쓸 수 없다.
      const landing = passableLanding(project, map, x, y);
      if (landing && !(landing.x === x && landing.y === y) && !occupied.has(`${landing.x},${landing.y}`)) usable += 1;
      else noLanding += 1;
    }
  }
  const where = `'${map.name}'(${map.id}, ${map.width}×${map.height})의 (${requestedX},${requestedY})`;
  if (inBounds === 0) {
    return `${where} 는 반경 ${maxRadius}칸까지 전부 맵 밖입니다. 좌표를 맵 크기(0..${map.width - 1}, 0..${map.height - 1}) 안으로 잡으세요.`;
  }
  if (blockedByEvent === inBounds) {
    return `${where} 주변 ${inBounds}칸이 전부 기존 이벤트로 점유돼 있습니다. 빈 자리를 골라 좌표를 옮기세요.`;
  }
  // usable > 0 인데 여기까지 왔다면 transferEndpoint 의 반경(3) 밖 후보를 센 것이다 — 좌표만 당기면 된다.
  if (usable > 0) {
    return `${where} 기준 반경 ${maxRadius}칸 안에서는 자리를 못 찾았습니다(조금 더 바깥에 쓸 만한 칸 ${usable}개). 출입구 좌표를 그쪽으로 옮기세요.`;
  }
  return (
    `${where} 주변에 통행 가능한 착지 칸이 붙은 자리가 없습니다 — 후보 ${noLanding}칸 모두 이웃 4방향이 통행 불가입니다. ` +
    `맵이 아직 비어 있다면 먼저 fill_region/author_house 등으로 바닥과 구조를 만든 뒤 연결하세요.`
  );
}

function parseNpcSchedule(project: Project, raw: unknown, label: string): NpcScheduleEntry[] {
  if (!Array.isArray(raw)) throw new ToolError(`${label}는 배열이어야 합니다.`, { code: "npc-schedule" });
  return raw.map((entryRaw, index): NpcScheduleEntry => {
    if (typeof entryRaw !== "object" || entryRaw === null || Array.isArray(entryRaw)) {
      throw new ToolError(`${label}[${index}]는 객체여야 합니다.`, { code: "npc-schedule" });
    }
    const entry = entryRaw as Record<string, unknown>;
    const at = scheduleAt(project, entry.at, `${label}[${index}].at`);
    const facing = entry.facing === undefined ? undefined : dirArg(entry.facing, `${label}[${index}].facing`);
    const activity = cleanOptionalString(entry.activity);
    return {
      when: parseScheduleWhen(entry.when, `${label}[${index}].when`),
      at,
      ...(facing ? { facing } : {}),
      ...(activity ? { activity } : {}),
    };
  });
}

function parseScheduleWhen(raw: unknown, label: string): NpcScheduleWhen {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ToolError(`${label}은 객체여야 합니다.`, { code: "npc-schedule-when" });
  }
  const record = raw as Record<string, unknown>;
  const timePhase = record.timePhase;
  const season = record.season;
  return {
    ...(timePhase !== undefined ? { timePhase: parseTimePhaseArg(timePhase, `${label}.timePhase`) } : {}),
    ...(record.hourRange !== undefined ? { hourRange: numberPair(record.hourRange, `${label}.hourRange`) } : {}),
    ...(season !== undefined ? { season: parseSeasonArg(season, `${label}.season`) } : {}),
    ...(record.dayRange !== undefined ? { dayRange: numberPair(record.dayRange, `${label}.dayRange`) } : {}),
  };
}

function scheduleAt(project: Project, raw: unknown, label: string): NpcScheduleEntry["at"] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ToolError(`${label}은 {mapId,x,y} 객체여야 합니다.`, { code: "npc-schedule-at" });
  }
  const record = raw as Record<string, unknown>;
  const mapId = stringArg(record.mapId, `${label}.mapId`);
  if (typeof record.x !== "number" || typeof record.y !== "number") {
    throw new ToolError(`${label}.x/y 숫자가 필요합니다.`, { code: "npc-schedule-at" });
  }
  const x = Math.trunc(record.x);
  const y = Math.trunc(record.y);
  assertPassableSchedulePoint(project, mapId, x, y, label);
  return { mapId, x, y };
}

function routineSchedule(project: Project, mapId: string, home: Point, rawRoutine: unknown): NpcScheduleEntry[] {
  if (rawRoutine === undefined) return [];
  if (typeof rawRoutine !== "object" || rawRoutine === null || Array.isArray(rawRoutine)) {
    throw new ToolError("dailyRoutine은 {workAt,workHours} 객체여야 합니다.", { code: "daily-routine" });
  }
  const routine = rawRoutine as Record<string, unknown>;
  const workAt = workPoint(project, mapId, routine.workAt, "dailyRoutine.workAt");
  const [start, end] = numberPair(routine.workHours, "dailyRoutine.workHours");
  if (start < 0 || end > 48 || start >= end) {
    throw new ToolError("dailyRoutine.workHours는 0~48 사이의 [start,end] 오름차순 범위여야 합니다.", { code: "daily-routine-hours" });
  }
  const homeEntry = (when: NpcScheduleWhen): NpcScheduleEntry => ({
    when,
    at: { mapId, x: home.x, y: home.y },
    facing: "down",
    activity: "home",
  });
  return [
    ...(start > 0 ? [homeEntry({ hourRange: [0, start] })] : []),
    { when: { hourRange: [start, end] }, at: workAt, facing: "down", activity: "work" },
    ...(end < 48 ? [homeEntry({ hourRange: [end, 48] })] : []),
  ];
}

function workPoint(project: Project, defaultMapId: string, raw: unknown, label: string): NpcScheduleEntry["at"] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ToolError(`${label}은 {mapId?,x,y} 객체여야 합니다.`, { code: "daily-routine-work" });
  }
  const record = raw as Record<string, unknown>;
  const mapId = typeof record.mapId === "string" && record.mapId.trim() ? record.mapId.trim() : defaultMapId;
  if (typeof record.x !== "number" || typeof record.y !== "number") {
    throw new ToolError(`${label}.x/y 숫자가 필요합니다.`, { code: "daily-routine-work" });
  }
  const x = Math.trunc(record.x);
  const y = Math.trunc(record.y);
  assertPassableSchedulePoint(project, mapId, x, y, label);
  return { mapId, x, y };
}

/**
 * 주민 대사 페이지 조립. **조건 없는 대사는 페이지를 나누지 않는다.**
 *
 * 실측 결함(이 변경에서 발견): 기본 인사 페이지를 항상 먼저 넣고 dialogue 항목마다 페이지를
 * 하나씩 밀어넣었다. dialogue 에 when 이 없는 항목이 둘이면 조건 없는 페이지가 셋이 되고,
 * 런타임은 조건이 맞는 **마지막** 페이지 하나만 실행하므로 앞의 둘은 영원히 안 나온다
 * (`make_villager` 가 dialogue 2줄로 "대사 페이지 3개" 를 보고하면서 실제로는 마지막 1줄만
 * 나왔다). 조건 없는 대사는 한 페이지의 여러 줄로 합쳐야 저작 의도대로 전부 나온다.
 */
function villagerPages(rawDialogue: unknown, schedule: readonly NpcScheduleEntry[], warnings: string[]): SimplePage[] {
  const conditional: SimplePage[] = [];
  const defaultLines: string[] = [];
  if (rawDialogue !== undefined) {
    if (!Array.isArray(rawDialogue)) throw new ToolError("dialogue는 {when?,text}[] 배열이어야 합니다.", { code: "villager-dialogue" });
    rawDialogue.forEach((entry, index) => {
      const page = dialoguePageFromRecord(entry, index, warnings);
      if (!page) return;
      if ((page.conditions ?? []).length === 0) defaultLines.push(...(page.lines ?? []));
      else conditional.push(page);
    });
  }
  // 조건 없는 대사가 없으면 기본 페이지는 **대사 없이** 만든다 — 인사말을 대신 넣지 않는다. 대사 없는
  // 페이지는 세션의 캐스트 라이터(ai/npcCast)가 테마·이웃·세계관에 맞춰 채우고, 그마저 실패하면 모델에게
  // 되돌아간다. 고정 인사·"일하는 중이야" 류가 모든 마을을 같게 만들었다(2026-09-03).
  const basePage: SimplePage = { lines: defaultLines };
  const pages: SimplePage[] = [basePage, ...conditional];
  if (pages.length === 1) {
    for (const activity of activityLabels(schedule)) {
      pages.push({ conditions: [{ kind: "npcActivity", activity }], lines: [] });
    }
  }
  return pages;
}

function dialoguePageFromRecord(raw: unknown, index: number, warnings: string[]): SimplePage | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ToolError(`dialogue[${index}]는 {when?,text} 객체여야 합니다.`, { code: "villager-dialogue" });
  }
  const record = raw as Record<string, unknown>;
  const text = cleanOptionalString(record.text);
  if (!text) {
    warnings.push(`dialogue[${index}] text가 비어 있어 건너뜁니다.`);
    return null;
  }
  return {
    lines: [text],
    conditions: dialogueConditionsFromWhen(record.when, `dialogue[${index}].when`, warnings),
  };
}

function dialogueConditionsFromWhen(raw: unknown, label: string, warnings: string[]): EventPageCondition[] {
  if (raw === undefined || raw === null) return [];
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new ToolError(`${label}은 객체여야 합니다.`, { code: "villager-dialogue-when" });
  }
  const record = raw as Record<string, unknown>;
  const conditions: EventPageCondition[] = [];
  const activity = cleanOptionalString(record.npcActivity ?? record.activity);
  if (activity) conditions.push({ kind: "npcActivity", activity });
  if (record.timePhase !== undefined) conditions.push({ kind: "timePhase", phase: parseTimePhaseArg(record.timePhase, `${label}.timePhase`) });
  if (record.season !== undefined) conditions.push({ kind: "season", season: parseSeasonArg(record.season, `${label}.season`) });
  const switchId = cleanOptionalString(record.switchId);
  if (switchId) {
    const value = record.switchValue === false || record.value === false ? false : true;
    conditions.push({ kind: "switch", switchId, value });
  }
  const selfSwitchRaw = record.selfSwitch ?? record.selfSwitchKey;
  if (selfSwitchRaw !== undefined) {
    conditions.push({
      kind: "selfSwitch",
      key: parseSelfSwitchKey(selfSwitchRaw, `${label}.selfSwitch`),
      value: record.value === false ? false : true,
    });
  }
  const variableId = cleanOptionalString(record.variableId);
  if (variableId) {
    conditions.push({
      kind: "variable",
      variableId,
      op: parseVariableOp(record.op, `${label}.op`),
      value: numberArg(record.value, `${label}.value`),
    });
  }
  const itemId = cleanOptionalString(record.itemId);
  if (itemId) {
    conditions.push({ kind: "item", itemId, present: record.present === false ? false : true });
  }
  if (record.friendshipAtLeast !== undefined) {
    conditions.push({ kind: "friendshipAtLeast", value: numberArg(record.friendshipAtLeast, `${label}.friendshipAtLeast`) });
  }
  if (record.hourRange !== undefined) warnings.push(`${label}.hourRange는 이벤트 페이지 조건으로 직접 표현되지 않아 무시됩니다.`);
  if (record.dayRange !== undefined) warnings.push(`${label}.dayRange는 이벤트 페이지 조건으로 직접 표현되지 않아 무시됩니다.`);
  return conditions;
}

const SELF_SWITCH_KEYS: readonly SelfSwitchKey[] = ["A", "B", "C", "D"];
const VARIABLE_OPS = ["==", ">=", "<=", ">", "<", "!="] as const;

function parseSelfSwitchKey(raw: unknown, label: string): SelfSwitchKey {
  if (typeof raw === "string" && (SELF_SWITCH_KEYS as readonly string[]).includes(raw)) return raw as SelfSwitchKey;
  throw new ToolError(`${label}은 A/B/C/D 중 하나여야 합니다.`, { code: "self-switch-key" });
}

function parseVariableOp(raw: unknown, label: string): (typeof VARIABLE_OPS)[number] {
  if (typeof raw === "string" && (VARIABLE_OPS as readonly string[]).includes(raw)) {
    return raw as (typeof VARIABLE_OPS)[number];
  }
  if (raw === undefined) return ">=";
  throw new ToolError(`${label}은 ==/>=/<=/>/</!= 중 하나여야 합니다.`, { code: "variable-op" });
}

function numberArg(raw: unknown, label: string): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
  throw new ToolError(`${label} 숫자가 필요합니다.`, { code: "number-arg" });
}

function commandsRaiseVariable(commands: readonly Command[] | undefined, variableId: string): boolean {
  for (const command of commands ?? []) {
    if (command.kind === "setVariable" && command.variableId === variableId && command.op === "+=" && typeof command.value === "number" && command.value > 0) return true;
    if (command.kind === "choices") {
      if (command.options.some((option) => commandsRaiseVariable(option.branch, variableId))) return true;
      if (commandsRaiseVariable(command.cancelBranch, variableId)) return true;
    } else if (command.kind === "presentItem") {
      if (command.options.some((option) => commandsRaiseVariable(option.branch, variableId))) return true;
      if (commandsRaiseVariable(command.otherwiseBranch, variableId) || commandsRaiseVariable(command.cancelBranch, variableId)) return true;
    } else if (command.kind === "fork") {
      if (commandsRaiseVariable(command.then, variableId) || commandsRaiseVariable(command.else, variableId)) return true;
    }
  }
  return false;
}

/** 더 높은 엔딩 문턱이 있는 변수를 올리는 페이지를, 그보다 낮은 조건 페이지가 덮지 않게 분기로 접는다. */
function keepGainPageBelowHigherEnding(project: Project, event: GameEvent, warnings: string[]): void {
  const pages = event.pages;
  if (!pages || pages.length < 2) return;
  for (let index = pages.length - 1; index >= 1; index -= 1) {
    const page = pages[index];
    if (!page || page.conditions.length !== 1) continue;
    const condition = page.conditions[0];
    if (!condition || condition.kind !== "variable" || (condition.op !== ">=" && condition.op !== ">")) continue;
    const capped = (project.endings ?? []).some((ending) => ending.conditions.some((entry) =>
      entry.kind === "variable" && entry.variableId === condition.variableId
      && (entry.op === ">=" || entry.op === ">") && entry.value > condition.value));
    if (!capped) continue;
    const host = pages.slice(0, index).find((earlier) => commandsRaiseVariable(earlier.commands, condition.variableId));
    if (!host) continue;
    // 분기를 앞세우면 문턱에 닿는 날 호감 상승보다 데이트 선택지가 먼저 떠서 상승이 멈춘다.
    host.commands = [...host.commands, { kind: "fork", condition, then: page.commands }];
    pages.splice(index, 1);
    warnings.push(
      `변수 ${condition.variableId} ${condition.op} ${condition.value} 페이지가 그 변수를 올리는 앞 페이지를 덮어, 더 높은 엔딩 문턱에 닿지 못합니다. 그 페이지 명령을 앞 페이지의 조건 분기로 옮겼습니다.`,
    );
  }
}

function eventUsesFriendship(event: GameEvent): boolean {
  const blob = JSON.stringify(event.pages ?? []);
  return blob.includes("friendshipAtLeast") || blob.includes("changeFriendship") || blob.includes("getFriendship");
}

function activityLabels(schedule: readonly NpcScheduleEntry[]): string[] {
  return [...new Set(schedule.map((entry) => entry.activity).filter((activity): activity is string => typeof activity === "string" && activity.trim().length > 0))];
}

function parseFriendshipLines(raw: unknown): { unlock?: string; after?: string } | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ToolError("friendshipLines는 {unlock?, after?} 객체여야 합니다.", { code: "friendship-lines" });
  }
  const record = raw as Record<string, unknown>;
  const unlock = cleanOptionalString(record.unlock);
  const after = cleanOptionalString(record.after);
  return { ...(unlock ? { unlock } : {}), ...(after ? { after } : {}) };
}

function assertPassableSchedulePoint(project: Project, mapId: string, x: number, y: number, label: string): void {
  const map = requireMap(project, mapId);
  if (!inMapBounds(map, x, y)) throw new ToolError(`${label} 좌표가 맵 밖입니다: (${x}, ${y})`, { code: "npc-schedule-bounds", mapId, x, y });
  if (!isPassable(project, map, x, y)) throw new ToolError(`${label} 좌표가 통행 불가입니다: (${x}, ${y})`, { code: "npc-schedule-passable", mapId, x, y });
}

function numberPair(raw: unknown, label: string): readonly [number, number] {
  if (!Array.isArray(raw) || raw.length !== 2 || typeof raw[0] !== "number" || typeof raw[1] !== "number") {
    throw new ToolError(`${label}는 숫자 2개 배열이어야 합니다.`, { code: "number-pair" });
  }
  return [raw[0], raw[1]];
}

function dirArg(raw: unknown, label: string): Dir {
  if (typeof raw === "string" && DIRS.includes(raw as Dir)) return raw as Dir;
  throw new ToolError(`${label}은 down/left/right/up 중 하나여야 합니다.`, { code: "direction" });
}

function parseTimePhaseArg(raw: unknown, label: string): NonNullable<NpcScheduleWhen["timePhase"]> {
  if (typeof raw === "string" && isTimePhase(raw)) return raw;
  throw new ToolError(`${label}은 morning/day/evening/night 중 하나여야 합니다.`, { code: "time-phase" });
}

function parseSeasonArg(raw: unknown, label: string): NonNullable<NpcScheduleWhen["season"]> {
  if (typeof raw === "string" && isSeason(raw)) return raw;
  throw new ToolError(`${label}은 spring/summer/fall/winter 중 하나여야 합니다.`, { code: "season" });
}

function stringArg(raw: unknown, label: string): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  throw new ToolError(`${label} 문자열이 필요합니다.`, { code: "string-arg" });
}

function cleanOptionalString(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

const createTransferPair: ToolDefinition = {
  name: "create_transfer_pair",
  description:
    "두 맵 사이 양방향 출입구를 원자적으로 생성한다. 출입구는 벽·맵 가장자리에 바짝 붙인 통행 가능 칸에 놓는다 인자 {a:{mapId,x,y}, b:{mapId,x,y}} — 문·계단·텔레포트의 왕복 쌍을 한 번에 만든다. 좌표는 벽·맵 끝에 바짝 붙인 통행 칸(1칸 띄우지 말 것). 문의 시각 배치는 place_door."
    + "(1칸 안쪽 좌표는 자동으로 당기고, 벽 칸 위 요청은 바로 앞 통행 칸으로 옮긴다 — playerTouch는 벽 위에서 발동하지 않음)."
    + " 착지점은 상대 출입구에 인접한 통행 가능 칸으로 자동 선정(즉시 재전이 방지).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      a: {
        type: "object",
        description: "{mapId,x,y} 출입구 A",
        properties: { mapId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } },
        required: ["mapId", "x", "y"],
      },
      b: {
        type: "object",
        description: "{mapId,x,y} 출입구 B",
        properties: { mapId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } },
        required: ["mapId", "x", "y"],
      },
      fade: { type: "string", enum: ["black", "white", "none"] },
    },
    required: ["a", "b"],
  },
  run(draft, args): ToolExecResult {
    const a = args.a as { mapId: string; x: number; y: number };
    const b = args.b as { mapId: string; x: number; y: number };
    const fade = (args.fade as TransferFade | undefined) ?? "black";
    const mapA = requireMap(draft, a.mapId);
    const mapB = requireMap(draft, b.mapId);
    const reachNotes: string[] = [];
    // 봉쇄 판정: 이 배치로 기존(그리고 이번에 놓는) transfer 문이 방 바닥에 실제로 열려 있는가.
    const sealAccept = (map: GameMap) => (candidate: { gate: Point; landing: Point }): true | string => {
      const check = transferGatesStayApproachable(draft, map, candidate.gate);
      if (!check.ok) return `기존 출입구 ${check.sealed.join(", ")} 이(가) 벽·가구·다른 문으로 봉쇄된다`;
      if (!check.group.has(candidate.landing.y * map.width + candidate.landing.x)) return "착지점이 방 바닥과 갈라진 주머니 칸이다";
      return true;
    };
    const endpointA = reachableTransferEndpoint(draft, mapA, a, "A", reachNotes, sealAccept(mapA));
    const endpointB = reachableTransferEndpoint(draft, mapB, b, "B", reachNotes, sealAccept(mapB));
    if (!endpointA || !endpointB) {
      // 어느 쪽 출입구가 왜 실패했는지 짚는다 — 종전에는 두 쪽을 뭉뚱그려 같은 안내만 냈다.
      const failures = [
        endpointA ? null : `A: ${transferEndpointFailure(draft, mapA, a.x, a.y)}`,
        endpointB ? null : `B: ${transferEndpointFailure(draft, mapB, b.x, b.y)}`,
      ].filter((entry): entry is string => entry !== null);
      throw new ToolError(`출입구 자리를 찾지 못했습니다. ${failures.join(" / ")}`, { code: "transfer-no-landing" });
    }
    const { gate: gateA, landing: landingA } = endpointA;
    const { gate: gateB, landing: landingB } = endpointB;

    const idA = genId("ev_gate");
    const idB = genId("ev_gate");
    const transferTo = (mapId: string, x: number, y: number): Command => ({ kind: "transfer", mapId, x, y, fade });
    const gate = (id: string, x: number, y: number, target: Command): GameEvent => ({
      id,
      x,
      y,
      trigger: { kind: "playerTouch" },
      commands: [],
      pages: [
        {
          id: `${id}_page`,
          name: "출입구",
          conditions: [],
          graphic: { transparent: true },
          trigger: { kind: "playerTouch" },
          priority: "below",
          overlapForbidden: false,
          movement: PASSIVE,
          commands: [target],
        },
      ],
    });
    upsertEventIntoMap(mapA, gate(idA, gateA.x, gateA.y, transferTo(b.mapId, landingB.x, landingB.y)));
    upsertEventIntoMap(mapB, gate(idB, gateB.x, gateB.y, transferTo(a.mapId, landingA.x, landingA.y)));
    // 배치가 끝난 뒤 두 맵의 모든 transfer 문이 방 바닥으로 열리는지 최종 점검(같은 맵 쌍·후보가
    // 없어 원자리를 쓴 경우 포함). 막지는 않고 경고로 남긴다 — 도구가 제품 결정을 하진 않는다.
    const sealedAfter: string[] = [];
    for (const map of a.mapId === b.mapId ? [mapA] : [mapA, mapB]) {
      const check = transferGatesStayApproachable(draft, map);
      if (!check.ok) sealedAfter.push(`${map.name}: ${check.sealed.join(", ")}`);
    }
    const adjustedA = gateA.x !== a.x || gateA.y !== a.y;
    const adjustedB = gateB.x !== b.x || gateB.y !== b.y;
    const warnings = [
      ...(adjustedA ? [`출입구 A 위치 자동 조정: (${a.x},${a.y}) → (${gateA.x},${gateA.y})`] : []),
      ...(adjustedB ? [`출입구 B 위치 자동 조정: (${b.x},${b.y}) → (${gateB.x},${gateB.y})`] : []),
      ...reachNotes,
      ...(sealedAfter.length > 0
        ? [`봉쇄 위험 — ${sealedAfter.join(" / ")} — 그 문은 밟아도 아무 데도 못 간다(벽·가구·이웃 문이 접근을 막음). move_event 로 문 자리를 옮기거나 빈 자리로 좌표를 바꿔 다시 create_transfer_pair 하세요.`]
        : []),
    ];
    return {
      summary: `출입구 쌍 생성: ${mapA.name}(${gateA.x},${gateA.y}) ↔ ${mapB.name}(${gateB.x},${gateB.y})`,
      data: { eventIdA: idA, eventIdB: idB, gateA, gateB, landingA, landingB, adjustedA, adjustedB },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const placeBattleBlocker: ToolDefinition = {
  name: "place_battle_blocker",
  description: `필드 몬스터/전투 블로커를 배치한다(전투→승리 시 스위치+이벤트 소거→투명 페이지). clearSwitchId로 재전투를 막는다. 몬스터는 캐릭터형이므로 반드시 통행 가능 칸에 서야 한다 — ${PLACEMENT_AUTOLAND_HINT} 길을 지키는 몬스터 요청의 정본. 무리 인카운터는 set_encounter_table.`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      troopId: { type: "string" },
      clearSwitchId: { type: "string", description: "생략 시 자동 생성" },
      intro: { type: "array", description: "전투 전 대사", items: { type: "string" } },
      victory: { type: "array", description: "승리 후 대사", items: { type: "string" } },
      victoryItems: { type: "array", description: "[{itemId,amount}] 승리 보상", items: ITEM_AMOUNT_SCHEMA },
      graphic: GRAPHIC_SPEC_SCHEMA,
      fightMovement: { type: "string", enum: ["fixed", "random"], description: "전투 페이지 이동. 생략 시 fixed(제자리 보초). 순찰형 몬스터는 random(배회)." },
      id: { type: "string" },
    },
    required: ["mapId", "x", "y", "troopId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const requestedX = args.x as number;
    const requestedY = args.y as number;
    const troopId = args.troopId as string;
    if (!inMapBounds(map, requestedX, requestedY)) throw new ToolError(`블로커 위치가 맵 밖입니다: (${requestedX}, ${requestedY})`, { mapId: map.id, x: requestedX, y: requestedY });
    if (!draft.database.troops.some((troop) => troop.id === troopId)) {
      throw new ToolError(`존재하지 않는 troopId: ${troopId} — 허용 예시: ${knownIds(draft.database.troops)}`, { code: "troop-not-found", mapId: map.id, x: requestedX, y: requestedY });
    }
    const id = (args.id as string | undefined) ?? genId("ev_battle");
    // 몬스터는 캐릭터형 — 벽 위에 세우면 플레이어가 전투를 시작할 수 없다.
    const placement = resolveEventPlacement(draft, map, requestedX, requestedY, {
      kind: "character",
      ignoreEventId: id,
      label: `전투 블로커 '${troopId}'`,
      code: "battle-blocker-impassable",
    });
    const { x, y, adjusted } = placement;
    const clearSwitchId = (args.clearSwitchId as string | undefined) ?? `sw_${id}_clear`;
    ensureNamedSwitch(draft, clearSwitchId, `전투 완료: ${id}`);
    const intro = (args.intro as string[] | undefined) ?? ["적이 앞을 가로막았다!"];
    const victory = (args.victory as string[] | undefined) ?? ["길이 열렸다."];
    const victoryItems = (args.victoryItems as Array<{ itemId: string; amount: number }> | undefined) ?? [];
    // graphic 생략 시 부대와 무관한 「monster」 첫 칸(슬라임)을 쓰지 않고 부대 선두 적의 이름으로 찾는다
    // (2026-09-27 전수 조사: 용 부대가 슬라임으로 서 있었다). 이름으로도 못 찾으면 거절한다.
    const troop = draft.database.troops.find((entry) => entry.id === troopId)!;
    const leadEnemy = draft.database.enemies.find((entry) => entry.id === troop.enemyIds[0]);
    const blockerSpec: GraphicSpec = (args.graphic as GraphicSpec | undefined)
      ?? { query: leadEnemy?.name?.trim() || troop.name?.trim() || "monster" };
    const graphic = resolveGraphic(blockerSpec, { overrides: draft.charsetLabels });
    const event = buildFieldMonsterEvent({
      eventId: id,
      x,
      y,
      troopId,
      clearSwitchId,
      intro,
      victory,
      victoryItems,
      graphic,
      fightMovement: args.fightMovement === "random"
        ? { type: "random", speed: 2, frequency: 3 }
        : { type: "fixed", speed: 3, frequency: 3 },
    });
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    const warnings = [
      ...(args.graphic === undefined ? [`graphic 생략 → 부대 선두 적 이름 query:"${"query" in blockerSpec ? blockerSpec.query : ""}" 로 찾음`] : []),
      ...(args.fightMovement === "random" ? ["전투 페이지 이동 → random(배회): 순찰형 몬스터"] : []),
      ...(adjusted ? [placementAdjustedWarning(`전투 블로커 '${troopId}'`, { x: requestedX, y: requestedY }, { x, y })] : []),
    ];
    return {
      summary: `${map.name}에 전투 블로커 '${troopId}' 배치 (${x}, ${y})${adjusted ? ` — 요청 좌표 (${requestedX}, ${requestedY})에서 자동 조정` : ""}`,
      data: { eventId: id, clearSwitchId, x, y, adjusted },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const placeTrap: ToolDefinition = {
  name: "place_trap",
  description:
    "즉사 트랩 이벤트를 배치한다. at:{x,y} 또는 cells:[{x,y}]를 받으며 trigger는 touch/action. respawnCheckpoint=true면 맵 진입 auto 체크포인트 이벤트를 추가한다.  함정·즉사 트랩 요청의 정본. 트랩+체크포인트+추격을 한 번에 원하면 make_horror_loop."
    + "touch 트랩은 밟을 수 있어야 하므로 통행 불가 칸이면 근처(반경 3) 통행 가능 칸으로 자동 착지한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      at: { ...COORD_SCHEMA, description: "{x,y} 단일 좌표" },
      cells: { type: "array", description: "{x,y}[] 여러 좌표", items: COORD_SCHEMA },
      trigger: { type: "string", enum: ["touch", "action"] },
      message: { type: "string" },
      respawnCheckpoint: { type: "boolean" },
      graphic: { ...GRAPHIC_SPEC_SCHEMA, description: "선택 그래픽. 생략 시 투명." },
      idPrefix: { type: "string" },
    },
    required: ["mapId", "trigger"],
  },
  invalidArgsExample: {
    mapId: "map1",
    cells: [{ x: 4, y: 5 }],
    trigger: "touch",
    message: "바닥이 꺼졌다.",
    respawnCheckpoint: true,
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const cells = trapCells(map, args);
    const trigger = trapTrigger(args.trigger);
    const graphic = resolveGraphic(args.graphic as GraphicSpec | undefined, { overrides: draft.charsetLabels });
    const idPrefix = typeof args.idPrefix === "string" && args.idPrefix.trim() ? args.idPrefix.trim() : "ev_trap";
    const eventIds: string[] = [];
    const warnings: string[] = [];
    // touch 트랩은 밟혀야 발동한다 — 벽 위의 트랩은 죽은 장치다.
    const steppable = trigger.kind === "touch";
    for (const [index, cell] of cells.entries()) {
      const id = cells.length === 1 ? genId(idPrefix) : genId(`${idPrefix}_${index + 1}`);
      const placement = resolveEventPlacement(draft, map, cell.x, cell.y, {
        kind: "interaction",
        steppable,
        ignoreEventId: id,
        label: "트랩",
        code: "trap-impassable",
      });
      if (placement.adjusted) warnings.push(placementAdjustedWarning("트랩", cell, placement));
      const event = trapEvent(id, placement.x, placement.y, trigger, graphic, typeof args.message === "string" ? args.message : undefined);
      assertEventShape(event);
      upsertEventIntoMap(map, event);
      eventIds.push(id);
    }
    const checkpointEventId = args.respawnCheckpoint === true ? ensureMapCheckpointEvent(draft, map) : undefined;
    return {
      summary: `${map.name}에 즉사 트랩 ${eventIds.length}개 배치${checkpointEventId ? ` — 진입 체크포인트 ${checkpointEventId}` : ""}${warnings.length > 0 ? ` — 위치 자동 조정 ${warnings.length}건` : ""}`,
      data: { eventIds, checkpointEventId, adjusted: warnings.length > 0 },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

/** 주인공 걷기 한 칸(PlayScene.moveDurationMs). */
const PLAYER_WALK_STEP_MS = 160;
const CHASER_FREQUENCY = 8;

/** 런타임 추격 한 칸 = npcMoveDurationMs(speed) + npcMoveIntervalMs(frequency) (playScenePageMoveRoutes.ts 와 같은 식). */
function chaseStepMs(speed: number, frequency: number): number {
  const rank = (value: number) => Math.min(8, Math.max(1, Math.trunc(value)));
  return Math.max(80, 640 - rank(speed) * 80) + Math.max(80, 1040 - rank(frequency) * 160);
}

/**
 * 은신처 칸들을 실제 은신 이벤트로 만든다(configure_object_behavior 의 hiding 과 같은 페이지 모양).
 * 칸에 조사 이벤트가 있으면 그 페이지들을 은신처로 바꾸고, 없으면 투명 이벤트를 새로 둔다.
 */
function placeHidingSpots(draft: Project, chaserMap: GameMap, raw: unknown, chaserId: string): { eventIds: string[]; warnings: string[] } {
  const eventIds: string[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(raw)) return { eventIds, warnings };
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object" || typeof (entry as { x?: unknown }).x !== "number" || typeof (entry as { y?: unknown }).y !== "number") { warnings.push("hidingSpots 항목 무시: {x,y} 필요"); continue; }
    const x = Math.trunc((entry as { x: number }).x), y = Math.trunc((entry as { y: number }).y);
    // 옷장은 흔히 추격자와 다른 방(맵)에 있다 — 2026-09-24 r3 에서 침실 옷장 좌표를 복도 맵에 넣어
    // 복도 맨바닥에 보이지 않는 은신처가 생겼다. mapId 를 받는다.
    const spotMapId = (entry as { mapId?: unknown }).mapId;
    const map = typeof spotMapId === "string" && spotMapId.trim() ? draft.maps[spotMapId.trim()] : chaserMap;
    if (!map) { warnings.push(`은신처 맵 '${String(spotMapId)}' 이 없어 건너뛰었습니다.`); continue; }
    if (!inMapBounds(map, x, y)) { warnings.push(`은신처 (${x}, ${y}) 가 맵 밖이라 건너뛰었습니다.`); continue; }
    const hideIn = (page: EventPage): void => {
      page.interaction = { kind: "hiding" };
      page.movement = { ...page.movement, type: "fixed" };
      page.trigger = { kind: "action" };
      page.priority = "same";
      page.overlapForbidden = true;
    };
    const existing = map.events.find((event) => event.id !== chaserId && event.x === x && event.y === y && (event.pages ?? []).length > 0);
    if (existing) {
      for (const page of existing.pages ?? []) hideIn(page);
      if ((existing.pages ?? []).some((page) => page.commands.length > 0)) warnings.push(`은신처 '${existing.id}' 의 조사 명령은 숨기 동작에 가려 실행되지 않습니다.`);
      eventIds.push(existing.id);
      continue;
    }
    // 조사 이벤트가 없는 걸어 다니는 칸이면 플레이어가 찾을 수 없는 투명 은신처다.
    // 2026-09-24 추격 호러 r7: 러그(바닥 타일 있음) 위 은신처는 upper<0 조건에 걸리지 않아 경고 없이
    // 통과했다 — 걸어 다닐 수 있는 칸은 옷장·침대(통행 불가 가구)가 아니므로 어느 쪽이든 경고한다.
    if (isPassable(draft, map, x, y)) {
      const near = map.events
        .filter((event) => event.id !== chaserId && Math.abs(event.x - x) + Math.abs(event.y - y) === 1)
        .map((event) => `${event.id}(${event.x},${event.y})`);
      const hint = near.length > 0
        ? ` — 바로 옆 ${near.join(", ")} 가 옷장이면 hidingSpots 를 그 칸으로 다시 주세요.`
        : " — 옷장·침대 칸 좌표인지, 다른 방이면 hidingSpots[].mapId 를 확인하세요.";
      warnings.push(tileAt(map, x, y).upper < 0
        ? `은신처 ${map.name}(${x}, ${y}) 에 가구·조사 이벤트가 없어 맨바닥의 보이지 않는 은신처가 됐습니다${hint}`
        : `은신처 ${map.name}(${x}, ${y}) 에 조사 이벤트가 없어 (바닥·러그 위) 보이지 않는 은신처가 됐습니다${hint}`);
    }
    const id = genId("ev_hiding");
    const page: EventPage = {
      id: `${id}_hide`, name: "은신처", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" },
      priority: "same", overlapForbidden: true, animationType: "fixedGraphic", movement: PASSIVE, commands: [],
    };
    hideIn(page);
    const event: GameEvent = { id, x, y, trigger: { kind: "action" }, commands: [], pages: [page] };
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    eventIds.push(id);
  }
  return { eventIds, warnings };
}

const makeChaseScene: ToolDefinition = {
  name: "make_chase_scene",
  description:
    "장애물을 우회하는 실시간 추격자 이벤트를 만든다. chaser.at/graphic/speed/sightRange를 받고, killOnTouch면 eventTouch에서 killPlayer를 실행한다. safeZone은 map.safeZones에 추가하며, activateSwitch가 있으면 해당 스위치 ON 페이지에서만 추격한다. 추격자는 캐릭터형이므로 통행 불가 칸이면 근처(반경 3) 통행 가능 칸으로 자동 착지한다. pursuit.scope=connected면 문으로 연결된 방까지 추격한다. doorDelayMs/searchMs/onLost로 문 대기·수색·복귀를 설정한다. 추격전·「쫓아오는」 요청의 정본. " +
    "speed 는 이 엔진 기준이다(RPG Maker 의 4=보통과 다르다): 6=주인공 걷기의 2/3(기본·긴장감 있는 추격), 7=걷기와 같음, 5=절반쯤, 4 이하=걷기의 절반도 안 돼 추격이 되지 않는다. " +
    "hidingSpots 에 옷장·침대 밑·사물함 칸 {x,y,mapId?} 를 주면(다른 방이면 mapId) 그 칸의 조사 이벤트(없으면 새 투명 이벤트)를 진짜 은신처로 만든다 — 조사하면 숨고(주인공이 사라지고 못 움직임) 다시 조사하면 나온다. 숨는 걸 본 추격자가 아니면 놓치고 수색하다 돌아간다. 은신을 대사·선택지+스위치 끄기로 흉내 내지 말 것. " +
    "activateSwitch 를 setSwitch value:false 로 끄면 추격자가 사라질 뿐 은신이 아니다. 숫자 암호·금고·열쇠는 compile_puzzle kind:password — answer 가 1~6자리 숫자면 inputNumber. 선택지 보기에 정답 숫자를 적지 말 것.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      chaser: {
        type: "object",
        description: "{at:{x,y},graphic,speed?,sightRange?}",
        properties: {
          at: COORD_SCHEMA,
          graphic: GRAPHIC_SPEC_SCHEMA,
          speed: { type: "integer" },
          sightRange: { type: "integer" },
        },
        required: ["at"],
      },
      pursuit: PURSUIT_SCHEMA,
      killOnTouch: { type: "boolean" },
      safeZone: { ...RECT_SCHEMA, description: "{x,y,w,h} 안전 지대 — 이 안의 주인공은 절대 잡히지 않는다. 세이브 방·계단참 같은 몇 칸짜리 구역만. 추격 통로를 덮지 말 것" },
      activateSwitch: { type: "string" },
      checkpointOnEntry: { type: "boolean" },
      mood: { type: "boolean", description: "공포 장르에서 조명이 없는 추격 맵을 어둡게(ambient 0.5). 기본 true, false 면 그대로" },
      hidingSpots: { type: "array", items: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" }, mapId: { type: "string", description: "옷장이 다른 방(맵)에 있으면 그 mapId. 생략하면 추격자 맵" } }, required: ["x", "y"] }, description: "{x,y,mapId?}[] 은신처(옷장 등) 칸. 그 칸의 조사 이벤트를 은신처로 바꾸고, 없으면 투명 은신 이벤트를 만든다." },
    },
    required: ["mapId", "chaser"],
  },
  invalidArgsExample: {
    mapId: "map1",
    chaser: { at: { x: 8, y: 4 }, graphic: { query: "monster" }, speed: 6, sightRange: 8 },
    hidingSpots: [{ x: 2, y: 3 }],
    killOnTouch: true,
    safeZone: { x: 1, y: 1, w: 3, h: 2 },
    activateSwitch: "sw_chase_on",
    checkpointOnEntry: true,
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const chaser = chaseSpec(args.chaser);
    if (!inMapBounds(map, chaser.at.x, chaser.at.y)) {
      throw new ToolError(`추격자 위치가 맵 밖입니다: (${chaser.at.x}, ${chaser.at.y})`, { code: "chaser-out-of-bounds", mapId: map.id, x: chaser.at.x, y: chaser.at.y });
    }
    const graphic = resolveGraphic((chaser.graphic as GraphicSpec | undefined) ?? { query: "monster" }, { overrides: draft.charsetLabels });
    const id = genId("ev_chaser");
    // 추격자는 캐릭터형 — 벽 위에서 시작하면 첫 프레임부터 갇힌다.
    const placement = resolveEventPlacement(draft, map, chaser.at.x, chaser.at.y, {
      kind: "character",
      ignoreEventId: id,
      label: "추격자",
      code: "chaser-impassable",
    });
    const activateSwitch = typeof args.activateSwitch === "string" && args.activateSwitch.trim()
      ? args.activateSwitch.trim()
      : undefined;
    if (activateSwitch) ensureNamedSwitch(draft, activateSwitch, `추격 활성: ${id}`);
    const safeZone = args.safeZone === undefined ? undefined : rectFromRecord(args.safeZone, "safeZone");
    if (safeZone) {
      map.safeZones = [...(map.safeZones ?? []), safeZone];
    }
    const speed = Number.isFinite(chaser.speed) ? Math.max(1, Math.min(8, Math.trunc(chaser.speed ?? 6))) : 6;
    // 추격자의 한 칸 = 걸음 트윈(speed) + 다음 걸음까지 대기(frequency). 예전엔 frequency=speed 라
    // speed 3 이 400+560ms/칸 — 주인공 걷기(160ms)의 1/6 속도로 걸어와 추격이 되지 않았다(2026-09-24).
    // 추격자는 쉬지 않고 쫓으므로 대기는 최소(8)로 두고 보폭은 speed 로만 정한다.
    const paceMs = chaseStepMs(speed, CHASER_FREQUENCY);
    // 스위치로 깨우는 추격(「금고를 열자 달려온다」)은 주인공이 벽 너머에 있어도 와야 한다. 추적 정책을 안 정했으면
    // persistent 로 둔다 — lastSeen 은 직접 봐야 움직여서, 깨운 추격자가 복도에 가만히 서 있었다(2026-09-24).
    const parsedPursuit = args.pursuit === undefined ? undefined : parsePursuit(args.pursuit);
    const pursuit = parsedPursuit && activateSwitch && parsedPursuit.tracking === undefined
      ? { ...parsedPursuit, tracking: "persistent" as const } : parsedPursuit;
    const commands: Command[] = args.killOnTouch === true ? [{ kind: "killPlayer", message: "붙잡혔다." }] : [];
    const event: GameEvent = {
      id,
      x: placement.x,
      y: placement.y,
      trigger: { kind: "eventTouch" },
      commands: [],
      pages: [
        {
          id: `${id}_chase`,
          name: "추격자",
          conditions: activateSwitch ? [{ kind: "switch", switchId: activateSwitch, value: true }] : [],
          graphic,
          trigger: { kind: "eventTouch" },
          priority: "same",
          overlapForbidden: true,
          animationType: "normal",
          movement: {
            type: "chase",
            speed,
            frequency: CHASER_FREQUENCY,
            ...(chaser.sightRange !== undefined ? { sightRange: Math.max(0, Math.trunc(chaser.sightRange)) } : {}),
            pathfind: true,
            ...(pursuit ? { pursuit } : {}),
          },
          commands,
        },
      ],
    };
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    // 붙잡히면 게임 오버인 추격은 기본으로 진입 체크포인트를 둔다 — 없으면 「다시 시작」 이 타이틀뿐이다
    // (2026-09-24 r3: 첫 추격에 잡히자 버튼이 「타이틀로 돌아가기」 하나). false 를 명시하면 끈다.
    const wantsCheckpoint = args.checkpointOnEntry === true || (args.checkpointOnEntry === undefined && args.killOnTouch === true);
    const checkpointEventId = wantsCheckpoint ? ensureMapCheckpointEvent(draft, map) : undefined;
    // 공포 장르의 추격 맵이 기본 밝기면 어둡게 한다 — r2~r5 네 번 모두 「어둡고 긴장감 있게」 기획에서 조명을
    // 한 번도 만지지 않았다. 이미 조명을 정했거나 mood:false 면 두고, 무엇을 했는지 요약에 싣는다.
    const darkened = args.mood !== false && draft.system?.genre === "horror-chase" && !map.defaultLighting;
    if (darkened) map.defaultLighting = normalizeLightingState({ ambient: 0.5, color: "#1a1020", sources: [] });
    const hiding = placeHidingSpots(draft, map, args.hidingSpots, id);
    const ratio = PLAYER_WALK_STEP_MS / paceMs;
    // 안전지대 안에서는 절대 잡히지 않는다. 2026-09-24 r4 에서 11×22 복도에 12×17 안전지대를 깔아
    // 추격 맵 전체가 무적 구역이 됐다 — 안전지대는 세이브 방·계단참 같은 작은 구역이다.
    const safeCover = safeZone ? Math.round(100 * Math.max(0, Math.min(map.width, safeZone.x + safeZone.w) - Math.max(0, safeZone.x))
      * Math.max(0, Math.min(map.height, safeZone.y + safeZone.h) - Math.max(0, safeZone.y)) / (map.width * map.height)) : 0;
    const warnings = [
      ...(safeCover >= 30 ? [`안전지대가 맵의 ${safeCover}% 를 덮어 그 안에서는 절대 붙잡히지 않습니다 — 추격이 성립하지 않습니다. 안전지대는 세이브 방처럼 작은 구역(몇 칸)으로 두세요.`] : []),
      ...unwrittenSwitchGateWarnings(draft, event),
      ...(chaser.graphic === undefined ? ['graphic 생략 → query:"monster" 기본 적용'] : []),
      ...(placement.adjusted ? [placementAdjustedWarning("추격자", chaser.at, placement)] : []),
      ...(ratio < 0.5 ? [`추격자 속도 ${speed} 은 한 칸 ${paceMs}ms — 주인공 걷기(${PLAYER_WALK_STEP_MS}ms/칸)의 ${Math.round(ratio * 100)}% 라 걸어서도 쉽게 따돌립니다. 긴장감 있는 추격은 speed 6(걷기의 2/3), 같은 속도는 7.`] : []),
      ...hiding.warnings,
    ];
    return {
      summary: `${map.name}에 추격자 '${id}' 생성 (${placement.x}, ${placement.y}) — 한 칸 ${paceMs}ms(걷기의 ${Math.round(ratio * 100)}%)${placement.adjusted ? ` — 요청 좌표 (${chaser.at.x}, ${chaser.at.y})에서 자동 조정` : ""}${safeZone ? " — 안전지대 추가" : ""}${hiding.eventIds.length ? ` — 은신처 ${hiding.eventIds.length}곳` : ""}${darkened ? " — 맵을 어둡게(ambient 0.5, 밝기는 set_lighting·set_scene_mood 로 조절)" : ""}${checkpointEventId ? ` — 진입 체크포인트 ${checkpointEventId}` : ""}`,
      data: { eventId: id, safeZone, activateSwitch, checkpointEventId, hidingEventIds: hiding.eventIds, stepMs: paceMs, x: placement.x, y: placement.y, adjusted: placement.adjusted },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

/** 벽감의 action 접근 예외는 기본 보물상자를 수면에 띄우는 허가가 아니다. */
function assertChestDrySurface(project: Project, map: GameMap, x: number, y: number): void {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return; // 통행 가능성/누락 타일셋은 resolveEventPlacement가 검사한다.
  const waterTile = (tile: number): boolean => {
    if (tile < 0) return false;
    const role = tileset.tileMeta?.[tile]?.role;
    if (role) return roleCapabilities(tileset, role).terrainTag === "water";
    if (tileset.tileGroups?.some((group) => roleCapabilities(tileset, group.role).terrainTag === "water" && group.tileIds.includes(tile))) return true;
    // 원시 칩 번호는 다른 타일셋에서 다른 그림이다. 메타 없는 기본 칩셋에만 폴백한다.
    return tileset.id === COMBINED_TOWN_TILESET_ID && isWaterChipsetTile(tile);
  };
  const { lower, upper } = tileAt(map, x, y);
  // O 상층(다리/발판)은 수면 위의 지지면이다. ★ 장식은 하층 물을 가리지 않는다.
  const supported = upper >= 0 && !waterTile(upper) && passageMarkForTile(tileset, upper) === "o";
  if (!waterTile(upper) && (!waterTile(lower) || supported)) return;
  throw new ToolError(
    `보물상자는 물 위에 놓을 수 없습니다: (${x}, ${y}). 지면이나 통행 가능한 다리 위 좌표를 선택하세요.`,
    { code: "chest-on-water", mapId: map.id, x, y },
  );
}

// 보물상자: "상자를 열면 X 지급"을 셀프스위치 2페이지로 완결하는 프리셋.
// (코퍼스 hidden-treasure-chest / chest-potion-reward가 "부분 가능"이던 갭 해소)
const placeChest: ToolDefinition = {
  name: "place_chest",
  description:
    "보물상자 이벤트를 배치한다. 조사하면 contents의 아이템/골드를 지급하고 셀프스위치 A로 개봉 상태를 기억한다(2페이지).  보물상자(열면 아이템/골드 지급, 개봉 기억)는 반드시 이 툴 — place_npc/upsert_event 로 흉내내지 말 것. 장식용 박스·나무상자는 이 툴이 아니라 place_props(material:\"나무 상자\"). 넣고 빼는 보관 상자는 place_storage_chest." +
    "'보물상자'·'상자를 열면 ~을 주는' 요청만 이 툴. " +
    "장식용 박스·나무상자·나무박스·과일박스는 place_props(harness-combined-town-wood-box / fruit-box) — place_chest 금지. " +
    "벽 위(문·벽감)여도 인접 칸에서 조사할 수 있으면 그대로 두고, 사방이 막힌 칸이면 근처(반경 3) 통행 가능 칸으로 자동 착지한다. 물 위는 거부한다 — 지면이나 통행 가능한 다리 위 좌표를 선택하라.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      contents: {
        type: "object",
        description: "{itemId?: string, gold?: number} — 최소 1개",
        properties: { itemId: { type: "string" }, gold: { type: "integer" } },
      },
      name: { type: "string" },
      id: { type: "string" },
    },
    required: ["mapId", "x", "y", "contents"],
  },
  invalidArgsExample: { mapId: "map_1", x: 5, y: 5, contents: { itemId: "item_potion", gold: 50 } },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const requestedX = args.x as number;
    const requestedY = args.y as number;
    if (!inMapBounds(map, requestedX, requestedY)) {
      throw new ToolError(`상자 위치가 맵 밖입니다: (${requestedX}, ${requestedY})`, { code: "chest-out-of-bounds", mapId: map.id, x: requestedX, y: requestedY });
    }
    assertChestDrySurface(draft, map, requestedX, requestedY);
    // action 트리거 상자는 RM2K3 문 의미대로 벽 위도 허용 — 단 인접 칸에서 조사할 수 있어야 한다.
    const placement = resolveEventPlacement(draft, map, requestedX, requestedY, {
      kind: "interaction",
      label: "보물상자",
      code: "chest-impassable",
      replacesAutoInspect: true,
    });
    const { x, y, adjusted } = placement;
    assertChestDrySurface(draft, map, x, y);
    const contents = (args.contents ?? {}) as { itemId?: unknown; gold?: unknown };
    const itemId = typeof contents.itemId === "string" && contents.itemId.length > 0 ? contents.itemId : undefined;
    const gold = typeof contents.gold === "number" && Number.isFinite(contents.gold) && contents.gold > 0
      ? Math.floor(contents.gold)
      : undefined;
    if (!itemId && !gold) {
      throw new ToolError("contents.itemId 또는 contents.gold(양수) 중 최소 하나가 필요합니다.", { code: "chest-empty-contents" });
    }
    const warnings: string[] = [];
    if (adjusted) warnings.push(placementAdjustedWarning("보물상자", { x: requestedX, y: requestedY }, placement));
    // 금액은 이 맵의 진행도(전투 보상·기존 상자·상점)와 견준다. 막지는 않는다 — 일부러 적은 상자도 있다.
    const basis = gold ? buildMapPlacementContext(draft, map.id)?.chestGold : undefined;
    if (gold && basis && (gold < basis.min || gold > basis.max)) {
      warnings.push(`보상 ${gold}G 는 이 맵 기준 ${basis.min}~${basis.max}G(${basis.reason}) 밖입니다 — 의도가 아니면 그 범위로 다시 놓으세요`);
    }
    const itemRecord = itemId
      ? draft.database.items.find((item) => item.id === itemId) ?? draft.database.equipment.find((record) => record.id === itemId)
      : undefined;
    if (itemId && !itemRecord) {
      warnings.push(`아이템 '${itemId}'가 데이터베이스(아이템·장비)에 없습니다 — upsert_item/upsert_equipment 로 먼저 만들거나 기존 id를 쓰세요`);
    }
    const graphic = resolveGraphic({ query: "보물상자" }, { overrides: draft.charsetLabels });
    const id = (args.id as string | undefined) ?? genId("ev_chest");
    const name = (args.name as string | undefined) ?? "보물상자";
    const itemLabel = itemRecord?.name.trim() || itemId;
    const rewardText = [itemLabel ?? null, gold ? `${gold}G` : null].filter(Boolean).join(" · ");
    const trigger: Trigger = { kind: "action" };
    const openCommands: Command[] = [
      ...chestOpenCommands(id, graphic),
      ...lootGrantCommands({ itemId, gold }),
      { kind: "text", body: `보물상자를 열었다! ${rewardText} 를 손에 넣었다.` },
      { kind: "setSelfSwitch", key: "A", value: true } as Command,
    ];
    const event: GameEvent = {
      id,
      x,
      y,
      trigger,
      commands: [],
      pages: [
        {
          id: `${id}_closed`,
          name: `${name}(닫힘)`,
          conditions: [{ kind: "selfSwitch", key: "A", value: false }],
          graphic,
          trigger,
          priority: "same",
          overlapForbidden: true,
          animationType: "fixedGraphic",
          movement: PASSIVE,
          commands: openCommands,
        },
        {
          id: `${id}_opened`,
          name: `${name}(열림)`,
          conditions: [{ kind: "selfSwitch", key: "A", value: true }],
          graphic: chestOpenedGraphic(graphic),
          trigger,
          priority: "same",
          overlapForbidden: true,
          animationType: "fixedGraphic",
          movement: PASSIVE,
          commands: [{ kind: "text", body: "상자는 비어 있다." }],
        },
      ],
    };
    assertEventShape(event, warnings);
    const displaced = displaceAutoInspectEvents(map, event);
    if (displaced.length) warnings.push(`같은 칸의 가구 조사 이벤트 ${displaced.join(", ")} 를 보물상자로 대체했습니다.`);
    upsertEventIntoMap(map, event);
    return {
      summary: `${map.name}에 보물상자 '${name}' 배치 (${x}, ${y})${adjusted ? ` — 요청 좌표 (${requestedX}, ${requestedY})에서 자동 조정` : ""} — 보상 ${rewardText}`,
      data: { eventId: id, x, y, adjusted },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

// 세이브 포인트: 조사 → checkpointSave. (코퍼스 auto-save-point가 "불가"이던 갭 해소)
const placeStorageChest: ToolDefinition = {
  name: "place_storage_chest",
  description:
    "보관 상자 이벤트를 배치한다. 조사하면 openChest로 소지품↔상자 입출고 UI를 연다(session.chests).  보관·창고 상자(소지품 입출고)는 이 툴, 보상 상자는 place_chest, 장식 박스는 place_props." +
    "농장 창고·인벤 확장용. 보물상자(1회 보상)는 place_chest. 장식 박스는 place_props. " +
    "벽 위여도 인접 칸에서 조사할 수 있으면 그대로 두고, 사방이 막힌 칸이면 근처(반경 3) 통행 가능 칸으로 자동 착지한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      name: { type: "string" },
      id: { type: "string" },
      chestId: { type: "string", description: "session.chests 키. 생략 시 storage_<eventId>" },
      template: { type: "string", description: "farm | warehouse | vault. 기본 farm" },
      displayName: { type: "string", description: "플레이 창에 보이는 이름" },
    },
    required: ["mapId", "x", "y"],
  },
  invalidArgsExample: { mapId: "map_1", x: 4, y: 6, name: "창고 상자" },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const requestedX = args.x as number;
    const requestedY = args.y as number;
    if (!inMapBounds(map, requestedX, requestedY)) {
      throw new ToolError(`보관 상자 위치가 맵 밖입니다: (${requestedX}, ${requestedY})`, { code: "storage-chest-out-of-bounds", mapId: map.id, x: requestedX, y: requestedY });
    }
    const placement = resolveEventPlacement(draft, map, requestedX, requestedY, {
      kind: "interaction",
      label: "보관 상자",
      code: "storage-chest-impassable",
      replacesAutoInspect: true,
    });
    const { x, y, adjusted } = placement;
    const id = (args.id as string | undefined) ?? genId("ev_storage_chest");
    const name = (args.name as string | undefined) ?? "보관 상자";
    // 이름·템플릿이 금고를 가리키면 금고 그림(object2#2), 아니면 서랍장. 「철제 금고」가 서랍장으로 서던 경로(2026-09-27).
    const vault = args.template === "vault" || /금고|vault|safe/iu.test(name);
    const graphic = resolveGraphic({ query: vault ? "금고" : "서랍장" }, { overrides: draft.charsetLabels });
    const chestIdRaw = typeof args.chestId === "string" ? args.chestId.trim() : "";
    const chestId = chestIdRaw || `storage_${id}`;
    const templateRaw = typeof args.template === "string" ? args.template.trim() : "farm";
    const template = templateRaw === "warehouse" || templateRaw === "vault" || templateRaw === "farm" ? templateRaw : "farm";
    const displayNameRaw = typeof args.displayName === "string" ? args.displayName.trim() : "";
    const displayName = displayNameRaw || (typeof args.name === "string" ? args.name.trim() : "") || undefined;
    const trigger: Trigger = { kind: "action" };
    const openChest: Command = {
      kind: "openChest",
      chestId,
      template,
      ...(displayName ? { displayName } : {}),
    };
    const event: GameEvent = {
      id,
      x,
      y,
      trigger,
      commands: [],
      pages: [
        {
          id: `${id}_page`,
          name,
          conditions: [],
          graphic,
          trigger,
          priority: "same",
          overlapForbidden: true,
          animationType: "fixedGraphic",
          movement: PASSIVE,
          commands: [openChest],
        },
      ],
    };
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    return {
      summary: `${map.name}에 보관 상자 '${name}' 배치 (${x}, ${y})${adjusted ? ` — 요청 좌표 (${requestedX}, ${requestedY})에서 자동 조정` : ""} — chestId=${chestId}`,
      data: { eventId: id, x, y, chestId, adjusted },
      ...(adjusted ? { warnings: [placementAdjustedWarning("보관 상자", { x: requestedX, y: requestedY }, placement)] } : {}),
    };
  },
};

const placeSavepoint: ToolDefinition = {
  name: "place_savepoint",
  description: "세이브 포인트 이벤트를 배치한다. 조사하면 체크포인트 저장이 실행된다(크리스탈 외형). 벽 위여도 인접 칸에서 조사할 수 있으면 그대로 두고, 사방이 막힌 칸이면 근처(반경 3) 통행 가능 칸으로 자동 착지한다. 세이브 포인트는 반드시 이 툴 — place_npc/upsert_event 흉내 금지.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      name: { type: "string" },
      id: { type: "string" },
      heal: { type: "boolean", description: "true 면 저장 전에 파티 전원 회복(recoverAll). 기본 false — 크로노 트리거의 세이브 포인트는 회복하지 않는다." },
    },
    required: ["mapId", "x", "y"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const requestedX = args.x as number;
    const requestedY = args.y as number;
    const heal = args.heal === true;
    if (!inMapBounds(map, requestedX, requestedY)) {
      throw new ToolError(`세이브 포인트 위치가 맵 밖입니다: (${requestedX}, ${requestedY})`, { code: "savepoint-out-of-bounds", mapId: map.id, x: requestedX, y: requestedY });
    }
    // priority "below" 이지만 트리거는 action — 밟는 이벤트가 아니므로 interaction 규칙을 쓴다.
    const placement = resolveEventPlacement(draft, map, requestedX, requestedY, {
      kind: "interaction",
      label: "세이브 포인트",
      code: "savepoint-impassable",
      replacesAutoInspect: true,
    });
    const { x, y, adjusted } = placement;
    const graphic = resolveGraphic({ query: "크리스탈" }, { overrides: draft.charsetLabels });
    const id = (args.id as string | undefined) ?? genId("ev_save");
    const name = (args.name as string | undefined) ?? "세이브 포인트";
    const trigger: Trigger = { kind: "action" };
    const event: GameEvent = {
      id,
      x,
      y,
      trigger,
      commands: [],
      pages: [
        {
          id: `${id}_page`,
          name,
          conditions: [],
          graphic,
          trigger,
          priority: "below",
          overlapForbidden: false,
          animationType: "fixedGraphic",
          movement: PASSIVE,
          commands: [
            ...(heal ? [{ kind: "recoverAll" } as Command] : []),
            { kind: "checkpointSave", label: "savepoint" },
            { kind: "text", body: heal ? "기운이 돌아왔다. 이곳에 모험을 기록했다." : "이곳에 모험을 기록했다." },
          ],
        },
      ],
    };
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    return {
      summary: `${map.name}에 세이브 포인트 '${name}' 배치 (${x}, ${y})${heal ? " — 전원 회복 포함" : ""}${adjusted ? ` — 요청 좌표 (${requestedX}, ${requestedY})에서 자동 조정` : ""}`,
      data: { eventId: id, x, y, adjusted, heal },
      ...(adjusted ? { warnings: [placementAdjustedWarning("세이브 포인트", { x: requestedX, y: requestedY }, placement)] } : {}),
    };
  },
};

function chaseSpec(value: unknown): {
  readonly at: Point;
  readonly graphic?: unknown;
  readonly speed?: number;
  readonly sightRange?: number;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError("chaser는 {at,graphic?,speed?,sightRange?} 객체여야 합니다.", { code: "chaser-spec" });
  }
  const record = value as { at?: unknown; graphic?: unknown; speed?: unknown; sightRange?: unknown };
  return {
    at: pointFromRecord(record.at, "chaser.at"),
    graphic: record.graphic,
    speed: typeof record.speed === "number" ? record.speed : undefined,
    sightRange: typeof record.sightRange === "number" ? record.sightRange : undefined,
  };
}

function rectFromRecord(value: unknown, label: string): { x: number; y: number; w: number; h: number } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError(`${label}는 {x,y,w,h} 객체여야 합니다.`, { code: "rect" });
  }
  const record = value as { x?: unknown; y?: unknown; w?: unknown; h?: unknown; width?: unknown; height?: unknown };
  const w = typeof record.w === "number" ? record.w : record.width;
  const h = typeof record.h === "number" ? record.h : record.height;
  if (typeof record.x !== "number" || typeof record.y !== "number" || typeof w !== "number" || typeof h !== "number") {
    throw new ToolError(`${label}.x/y/w/h 숫자가 필요합니다.`, { code: "rect" });
  }
  return { x: Math.trunc(record.x), y: Math.trunc(record.y), w: Math.max(0, Math.trunc(w)), h: Math.max(0, Math.trunc(h)) };
}

function trapCells(map: GameMap, args: Record<string, unknown>): Point[] {
  const cells: Point[] = [];
  if (args.at !== undefined) cells.push(pointFromRecord(args.at, "at"));
  if (Array.isArray(args.cells)) {
    args.cells.forEach((entry, index) => cells.push(pointFromRecord(entry, `cells[${index}]`)));
  }
  if (cells.length === 0) throw new ToolError("at 또는 cells 중 하나가 필요합니다.", { code: "trap-cells", mapId: map.id });
  for (const cell of cells) {
    if (!inMapBounds(map, cell.x, cell.y)) {
      throw new ToolError(`트랩 위치가 맵 밖입니다: (${cell.x}, ${cell.y})`, { code: "trap-out-of-bounds", mapId: map.id, x: cell.x, y: cell.y });
    }
  }
  return cells;
}

function pointFromRecord(value: unknown, label: string): Point {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError(`${label}는 {x,y} 객체여야 합니다.`, { code: "trap-point" });
  }
  const record = value as { x?: unknown; y?: unknown };
  if (typeof record.x !== "number" || typeof record.y !== "number") {
    throw new ToolError(`${label}.x/y 숫자가 필요합니다.`, { code: "trap-point" });
  }
  return { x: Math.trunc(record.x), y: Math.trunc(record.y) };
}

function trapTrigger(value: unknown): Trigger {
  if (value === "touch") return { kind: "touch" };
  if (value === "action") return { kind: "action" };
  throw new ToolError("trigger는 touch 또는 action이어야 합니다.", { code: "trap-trigger" });
}

function trapEvent(
  id: string,
  x: number,
  y: number,
  trigger: Trigger,
  graphic: EventPage["graphic"],
  message: string | undefined
): GameEvent {
  return {
    id,
    x,
    y,
    trigger,
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: "즉사 트랩",
        conditions: [],
        graphic,
        trigger,
        priority: "below",
        overlapForbidden: false,
        animationType: "fixedGraphic",
        movement: PASSIVE,
        commands: [{ kind: "killPlayer", ...(message ? { message } : {}) }],
      },
    ],
  };
}

function ensureMapCheckpointEvent(project: Project, map: GameMap): string {
  const existing = map.events.find((event) => event.id === `${map.id}_checkpoint_auto`);
  if (existing) return existing.id;
  const id = `${map.id}_checkpoint_auto`;
  const spot = checkpointSpot(project, map, id);
  map.events.push({
    id,
    x: spot.x,
    y: spot.y,
    trigger: { kind: "auto" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: "진입 체크포인트",
        conditions: [{ kind: "selfSwitch", key: "A", value: false }],
        graphic: { transparent: true },
        trigger: { kind: "auto" },
        priority: "below",
        overlapForbidden: false,
        animationType: "fixedGraphic",
        movement: PASSIVE,
        commands: [
          { kind: "setSelfSwitch", key: "A", value: true },
          { kind: "checkpointSave", label: "map-entry" },
        ],
      },
    ],
  });
  return id;
}

const duplicateEvent: ToolDefinition = {
  name: "duplicate_event",
  description: "이벤트를 다른 맵/좌표로 복제한다. 원본 트리거/우선순위 기준으로 통행 가능 칸에 착지한다(밟는 이벤트·캐릭터형은 통행 가능 칸 강제, 그 외는 인접 통행 가능 칸 필요). 같은 NPC/이벤트를 다른 자리에 하나 더 두라는 요청의 정본.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      fromMapId: { type: "string" },
      eventId: { type: "string" },
      toMapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      newId: { type: "string" },
    },
    required: ["fromMapId", "eventId", "toMapId", "x", "y"],
  },
  run(draft, args): ToolExecResult {
    const fromMap = requireMap(draft, args.fromMapId as string);
    const toMap = requireMap(draft, args.toMapId as string);
    const source = fromMap.events.find((event) => event.id === args.eventId);
    if (!source) throw new ToolError(`복제할 이벤트를 찾을 수 없습니다: ${args.eventId}`, { code: "event-not-found" });
    const newId = (args.newId as string | undefined) ?? genId("ev_copy");
    const requestedX = args.x as number;
    const requestedY = args.y as number;
    if (!inMapBounds(toMap, requestedX, requestedY)) {
      throw new ToolError(`복제 위치가 맵 밖입니다: (${requestedX}, ${requestedY})`, { code: "duplicate-out-of-bounds", mapId: toMap.id, x: requestedX, y: requestedY });
    }
    const placement = resolveEventPlacement(draft, toMap, requestedX, requestedY, {
      kind: "interaction",
      steppable: eventIsSteppable(source),
      ignoreEventId: newId,
      label: `이벤트 '${newId}'`,
      code: "duplicate-event-impassable",
    });
    const clone: GameEvent = { ...structuredClone(source), id: newId, x: placement.x, y: placement.y };
    upsertEventIntoMap(toMap, clone);
    return {
      summary: `이벤트 '${args.eventId}' → '${newId}' (${toMap.name} ${placement.x}, ${placement.y})${placement.adjusted ? ` — 요청 좌표 (${requestedX}, ${requestedY})에서 자동 조정` : ""}`,
      data: { eventId: newId, x: placement.x, y: placement.y, adjusted: placement.adjusted },
      ...(placement.adjusted ? { warnings: [placementAdjustedWarning(`이벤트 '${newId}'`, { x: requestedX, y: requestedY }, placement)] } : {}),
    };
  },
};

const removeEvent: ToolDefinition = {
  name: "remove_event",
  description: "맵에서 이벤트를 제거한다(파괴적).",
  mode: "write",
  parameters: {
    type: "object",
    properties: { mapId: { type: "string" }, eventId: { type: "string" } },
    required: ["mapId", "eventId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const index = map.events.findIndex((event) => event.id === args.eventId);
    if (index < 0) throw new ToolError(`제거할 이벤트를 찾을 수 없습니다: ${args.eventId}`, { code: "event-not-found" });
    map.events.splice(index, 1);
    return { summary: `${map.name}에서 이벤트 '${args.eventId}' 제거`, warnings: [`파괴적 작업: 이벤트 '${args.eventId}'를 삭제했습니다.`] };
  },
};

/**
 * 시간 시스템이 켜지면 시간표 칸이 NPC 좌표를 덮는다(npcSchedules.updateNpcSchedules).
 * 옮긴 NPC 의 옛 자리 칸은 새 자리로 따라가게 하고, 다른 곳을 가리키는 칸은 경고로 남긴다 —
 * 옮기라는 요청은 이 NPC 를 여기 두라는 뜻인데, 옛 칸이 남으면 조용히 옛 자리로 돌아간다.
 */
function followScheduleSlots(mapId: string, event: GameEvent, previous: Point): string[] {
  if (!event.schedule?.length || (previous.x === event.x && previous.y === event.y)) return [];
  let followed = 0;
  event.schedule = event.schedule.map((entry) => {
    if (entry.at.mapId !== mapId || entry.at.x !== previous.x || entry.at.y !== previous.y) return entry;
    followed += 1;
    return { ...entry, at: { ...entry.at, x: event.x, y: event.y } };
  });
  const elsewhere = event.schedule
    .filter((entry) => entry.at.mapId !== mapId || entry.at.x !== event.x || entry.at.y !== event.y)
    .map((entry) => `${JSON.stringify(entry.when)} → ${entry.at.mapId} (${entry.at.x}, ${entry.at.y})${entry.activity ? ` ${entry.activity}` : ""}`);
  const notes = followed > 0 ? [`시간표 ${followed}칸을 새 자리 (${event.x}, ${event.y})로 옮겼다.`] : [];
  if (elsewhere.length > 0) {
    notes.push(`'${event.name ?? event.id}' 의 시간표가 시간 시스템에서 이 NPC 를 다른 곳으로 옮긴다: ${elsewhere.join("; ")} — 고정하려면 set_npc_schedule 로 비우거나 고쳐라.`);
  }
  return notes;
}

const moveEvent: ToolDefinition = {
  name: "move_event",
  description: "이벤트를 같은 맵 내 다른 좌표로 옮긴다. 이벤트 자신의 트리거/우선순위 기준으로 통행 가능 칸에 착지한다(밟는 이벤트는 통행 가능 칸 강제, 그 외는 인접 통행 가능 칸 필요). 배치를 옮기라는 요청은 이벤트를 지우고 새로 만들지 말고 이 툴로 옮긴다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" }, eventId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" },
      from: { ...COORD_SCHEMA, description: "접근성을 검사할 같은 맵의 진입 좌표. 린트 후보의 from을 그대로 전달한다. 생략하면 시작 맵의 시작 위치, 그 외 맵은 로컬 접근성을 사용한다." },
    },
    required: ["mapId", "eventId", "x", "y"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const event = map.events.find((entry) => entry.id === args.eventId);
    if (!event) throw new ToolError(`옮길 이벤트를 찾을 수 없습니다: ${args.eventId}`, { code: "event-not-found" });
    const requestedX = args.x as number;
    const requestedY = args.y as number;
    if (!inMapBounds(map, requestedX, requestedY)) throw new ToolError(`이동 위치가 맵 밖입니다: (${requestedX}, ${requestedY})`, { mapId: map.id, x: requestedX, y: requestedY });
    const from = args.from as Point | undefined;
    if (from !== undefined && (!Number.isInteger(from.x) || !Number.isInteger(from.y)
      || !inMapBounds(map, from.x, from.y) || !isPassable(draft, map, from.x, from.y))) {
      throw new ToolError("from은 같은 맵의 통행 가능한 정수 좌표여야 합니다. get_map_region으로 진입 위치를 확인하세요.", {
        code: "move-event-origin-invalid", mapId: map.id, x: from.x, y: from.y,
      });
    }
    const placement = resolveEventPlacement(draft, map, requestedX, requestedY, {
      kind: eventRequiresPassableTile(event) ? "character" : "interaction",
      event,
      from,
      steppable: eventIsSteppable(event),
      ignoreEventId: event.id,
      label: `이벤트 '${event.id}'`,
      code: "move-event-impassable",
    });
    const previous = { x: event.x, y: event.y };
    event.x = placement.x;
    event.y = placement.y;
    const warnings = [
      ...(placement.adjusted ? [placementAdjustedWarning(`이벤트 '${event.id}'`, { x: requestedX, y: requestedY }, placement)] : []),
      ...followScheduleSlots(map.id, event, previous),
    ];
    return {
      summary: `이벤트 '${args.eventId}' → (${placement.x}, ${placement.y})${placement.adjusted ? ` — 요청 좌표 (${requestedX}, ${requestedY})에서 자동 조정` : ""}`,
      data: { eventId: event.id, x: placement.x, y: placement.y, adjusted: placement.adjusted },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

/**
 * 진입 체크포인트(auto 트리거)의 자리.
 *
 * auto 는 좌표와 무관하게 발동하므로 지형 안에 있어도 기능은 살아 있다 — 문제는
 * `event-unreachable` 린트뿐이다. 그래서 통행 가능 칸을 **선호**하되, 좌상단 반경 3이 전부
 * 막혔다고 ToolError 를 올려 place_trap/make_chase_scene 전체를 죽이지는 않는다
 * (동굴·두꺼운 벽 맵에서 그렇게 되면 고치려던 버그보다 나쁘다). 맵 전체를 훑어 첫 통행 칸을
 * 쓰고, 통행 칸이 하나도 없으면 종전대로 (0,0).
 */
function checkpointSpot(project: Project, map: GameMap, id: string): Point {
  try {
    const placement = resolveEventPlacement(project, map, 0, 0, {
      kind: "character",
      ignoreEventId: id,
      label: "진입 체크포인트",
      code: "checkpoint-impassable",
    });
    return { x: placement.x, y: placement.y };
  } catch (cause) {
    if (!(cause instanceof ToolError)) throw cause;
  }
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (isPassable(project, map, x, y)) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

function triggerFromArg(value: unknown): Trigger {
  switch (value) {
    case "auto":
      return { kind: "auto" };
    case "parallel":
      return { kind: "parallel" };
    case "playerTouch":
      return { kind: "playerTouch" };
    case "touch":
      return { kind: "touch" };
    case "action":
    case undefined:
    case null:
      return { kind: "action" };
    default:
      throw new ToolError("trigger는 action, auto, parallel, playerTouch, touch 중 하나여야 합니다.", { code: "cutscene-trigger" });
  }
}

function cutsceneEventPosition(project: Project, map: GameMap, args: Record<string, unknown>): Point {
  const x = typeof args.x === "number" ? args.x : map.id === project.startMapId ? project.startPos.x : 0;
  const y = typeof args.y === "number" ? args.y : map.id === project.startMapId ? project.startPos.y : 0;
  if (!inMapBounds(map, x, y)) throw new ToolError(`컷신 이벤트 위치가 맵 밖입니다: (${x}, ${y})`, { code: "cutscene-out-of-bounds", mapId: map.id, x, y });
  return { x, y };
}

function cutscenePage(
  pageId: string,
  name: string,
  trigger: Trigger,
  commands: Command[],
  conditions: EventPage["conditions"] = []
): EventPage {
  return {
    id: pageId,
    name,
    conditions,
    graphic: { transparent: true },
    trigger,
    priority: "below",
    overlapForbidden: false,
    animationType: "fixedGraphic",
    movement: PASSIVE,
    commands,
  };
}

function resolveCutsceneMusicResources(project: Project, beats: readonly CutsceneBeat[], warnings: string[]): CutsceneBeat[] {
  const resourceIds = collectResourceIds(project);
  const visit = (items: readonly CutsceneBeat[], path: string): CutsceneBeat[] => items.map((beat, index) => {
    const beatPath = `${path}[${index}]`;
    if (beat.kind === "parallel") return { ...beat, beats: visit(beat.beats, `${beatPath}.beats`) };
    if (beat.kind !== "music" || beat.action === "fade" || beat.action === "stop" || !beat.resourceId) return beat;
    if (resourceIds.has(beat.resourceId)) return beat;
    const kind = beat.action === "bgm" ? "bgm" : "se";
    const match = searchResources(kind, beat.resourceId)
      .map((result) => ({ result, resourceId: [result.id, result.id.replace(/^(?:bgm|se):/, "")].find((id) => resourceIds.has(id)) }))
      .find((candidate) => candidate.resourceId !== undefined);
    if (!match?.resourceId) return beat;
    warnings.push(`컷신 리소스 자동 해석: ${beatPath}.resourceId "${beat.resourceId}" → "${match.resourceId}" (${match.result.label})`);
    return { ...beat, resourceId: match.resourceId };
  });
  return visit(beats, "beats");
}

const DIR_DELTA: Readonly<Record<string, { readonly dx: number; readonly dy: number }>> = {
  up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
};

/**
 * moveActor 경로를 맵 위에서 따라가 막히는 칸을 짚는다. 런타임은 막힌 이동에서 최대 30초를 기다린 뒤 넘어가므로
 * 벽으로 걷는 컷신은 「멈춘 것처럼」 보인다. 이벤트 대상만 본다(주인공의 컷신 시작 칸은 진입 경로마다 달라 모른다).
 */
/**
 * moveActor 대상은 이벤트 id 여야 하는데, NPC id 는 `ev_npc_<uuid>` 처럼 불투명하고 say 비트는 이름을 쓴다.
 * 모델이 이름(노을)으로 적으면 검증이 거절하고, 모델은 이동 비트를 빼 버렸다 — 컷신 속 두 사람이 걷지 않았다
 * (2026-09-24 회상 스토리 도그푸딩). 같은 맵에서 이름·characterId 가 하나로 맞으면 id 로 바꾼다.
 */
function resolveCutsceneActorTargets(map: GameMap, beats: readonly CutsceneBeat[], warnings: string[]): CutsceneBeat[] {
  const ids = new Set(map.events.map((event) => event.id));
  const resolve = (items: readonly CutsceneBeat[]): CutsceneBeat[] => items.map((beat): CutsceneBeat => {
    if (beat.kind === "parallel") return { ...beat, beats: resolve(beat.beats) };
    // 연출 비트(파티클·모습·감정)도 인물 이름을 받는다 — 같은 규칙으로 이벤트 id 로 옮긴다.
    if (beat.kind === "particles" || beat.kind === "look" || beat.kind === "emote") {
      const named = (beat.eventId ?? beat.target ?? "").trim();
      if (!named || named === "player" || named === "this-event" || ids.has(named)) return beat;
      const found = map.events.filter((event) => event.name?.trim() === named || event.characterId === named);
      if (found.length !== 1) return beat;
      warnings.push(`컷신 ${beat.kind} 대상 '${named}' 를 같은 맵의 이벤트 id '${found[0]!.id}' 로 바꿨습니다.`);
      return { ...beat, target: found[0]!.id, eventId: undefined };
    }
    if (beat.kind !== "moveActor") return beat;
    const raw = (beat.target ?? beat.eventId ?? beat.actor ?? "player").trim();
    if (raw === "player" || raw === "this-event" || ids.has(raw)) return beat;
    const matches = map.events.filter((event) => event.name?.trim() === raw || event.characterId === raw);
    if (matches.length !== 1) return beat;
    const id = matches[0]!.id;
    warnings.push(`컷신 moveActor 대상 '${raw}' 를 같은 맵의 이벤트 id '${id}' 로 바꿨습니다(대상 칸은 이벤트 id).`);
    return { ...beat, target: id, eventId: undefined, actor: undefined };
  });
  const resolved = resolve(beats);
  const speakers = new Set<string>();
  let moves = 0;
  const scan = (items: readonly CutsceneBeat[]): void => items.forEach((beat) => {
    if (beat.kind === "parallel") scan(beat.beats);
    else if (beat.kind === "moveActor") moves += 1;
    else if (beat.kind === "say" && typeof beat.speaker === "string") speakers.add(beat.speaker.trim());
  });
  scan(resolved);
  const onMap = [...speakers].filter((name) => name && map.events.some((event) => event.name?.trim() === name));
  if (moves === 0 && onMap.length >= 2) {
    warnings.push(`컷신에 맵 위 인물 ${onMap.join("·")} 이 말하지만 moveActor 비트가 하나도 없어 아무도 움직이지 않습니다 — 다가가기·돌아서기 같은 동작이 필요하면 moveActor{target:이름 또는 이벤트 id} 를 넣으세요.`);
  }
  return resolved;
}

/**
 * 컷신 say.face 를 화자의 걷기 그림과 대조한다. 화자가 이 맵 이벤트 이름이거나 배우 이름과 **정확히 하나** 맞을 때만
 * 판단한다 — 화자를 못 찾으면(나레이션·맵 밖 인물) 얼굴을 건드리지 않는다. 규칙은 reconcileFaceWithCharset.
 */
function reconcileCutsceneSayFaces(project: Project, map: GameMap, beats: readonly CutsceneBeat[], warnings: string[]): CutsceneBeat[] {
  const lookOf = (speaker: string): { readonly id: string; readonly index: number } | undefined => {
    const events = map.events.filter((event) => event.name?.trim() === speaker || event.pages?.[0]?.name?.trim() === speaker);
    const actors = project.database.actors.filter((actor) => actor.name.trim() === speaker);
    if (events.length + actors.length !== 1) return undefined;
    const actor = actors[0];
    if (actor) return actor.characterResourceId ? { id: actor.characterResourceId, index: actor.characterIndex ?? 0 } : undefined;
    const graphic = events[0]!.pages?.find((page) => page.graphic && !page.graphic.transparent)?.graphic;
    if (!graphic?.sprite?.id || graphic.sprite.type !== "bundled") return undefined;
    return { id: graphic.sprite.id, index: decodeCharsetFrameIndex(graphic.pattern ?? 0).characterIndex };
  };
  const fix = (items: readonly CutsceneBeat[]): CutsceneBeat[] => items.map((beat): CutsceneBeat => {
    if (beat.kind === "parallel") return { ...beat, beats: fix(beat.beats) };
    if (beat.kind !== "say" || typeof beat.face?.resourceId !== "string" || !beat.speaker?.trim()) return beat;
    const look = lookOf(beat.speaker.trim());
    if (!look) return beat;
    const reconciled = reconcileFaceWithCharset(beat.face.resourceId, look.id, look.index);
    if (reconciled.warning) warnings.push(`컷신 화자 '${beat.speaker.trim()}': ${reconciled.warning}`);
    if (reconciled.faceResourceId === beat.face.resourceId) return beat;
    const { face: _face, ...rest } = beat;
    return reconciled.faceResourceId === null ? rest : { ...beat, face: { ...beat.face, resourceId: reconciled.faceResourceId } };
  });
  return fix(beats);
}

function cutsceneMoveWarnings(project: Project, map: GameMap, beats: readonly CutsceneBeat[]): string[] {
  const warnings: string[] = [];
  const positions = new Map<string, { x: number; y: number }>();
  const walk = (items: readonly CutsceneBeat[], path: string): void => items.forEach((beat, index) => {
    const beatPath = `${path}[${index}]`;
    if (beat.kind === "parallel") { walk(beat.beats, `${beatPath}.beats`); return; }
    if (beat.kind !== "moveActor") return;
    const target = beat.target ?? beat.eventId ?? beat.actor ?? "player";
    if (target === "player" || target === "this-event") return;
    const event = map.events.find((entry) => entry.id === target);
    if (!event) return;
    const at = positions.get(target) ?? { x: event.x, y: event.y };
    let through = false;
    for (const move of beat.route?.moves ?? beat.moves ?? []) {
      if (move.kind === "setThrough") through = move.enabled;
      if (move.kind !== "move") continue;
      const delta = DIR_DELTA[move.dir];
      if (!delta) continue;
      const next = { x: at.x + delta.dx, y: at.y + delta.dy };
      if (!through && !canMove(project, map, at.x, at.y, next.x, next.y)) {
        warnings.push(`컷신 이동 막힘: ${beatPath} '${target}' 이 (${at.x},${at.y})→(${next.x},${next.y}) 로 못 간다(벽·물·맵 밖) — 런타임은 최대 30초 멈춘다. 경로를 통행 가능한 칸으로 고치세요.`);
        break;
      }
      at.x = next.x;
      at.y = next.y;
    }
    positions.set(target, at);
  });
  walk(beats, "beats");
  return warnings;
}

const scriptCutscene: ToolDefinition = {
  name: "script_cutscene",
  description:
    "한 장면 컷신을 beat 타임라인으로 작성해 이벤트 페이지로 추가한다.  컷신·연출·대화 장면·회상 요청의 정본. 투더문식 회상/엔딩 프리셋은 script_cutscene_preset." +
    "**플레이어 조작(이동·조사·공격·메뉴)을 잠그고 시청만 하게 만드는 장면 전용 도구다** — " +
    "회상/플래시백, 오프닝, 엔딩, 시네마틱, '플레이어가 아무것도 못 하는 장면' 요청은 모두 이 툴이다. " +
    "잠금/해제와 스킵 라벨은 컴파일러가 자동으로 감싸므로 upsert_event 로 수동 조립하지 말 것. beat 종류: " +
    "say{speaker,face,text|lines}, moveActor{target:'player'|eventId,moves:[{kind:'move',dir:'up'},{kind:'turn',dir:'left'}],wait}, camera{mode:'pan|follow|fixed|return',target|x,y,durationMs,wait,zoom}, " +
    "picture{action:'show|move|erase',pictureId,resourceId,x,y,scale,opacity,durationMs,easing,blendMode,wait}(easing:'easeOut' 이면 멈출 때 부드럽다, blendMode:'add' 면 빛기둥·유령처럼 밝게 겹친다), music{action:'bgm|se|fade|stop',resourceId}, fade{direction:'in|out',durationMs,wait}, tint{color|value(sepia·#rrggbb·'r,g,b,알파'),durationMs,wait}, background{flowPercent,imageId?,durationMs,wait}(먼 배경 흐름 — 회상 진입에 flowPercent:0 으로 구름이 서서히 멈춘다. 배경 자체는 set_map_properties.background.layerSet), distort{effect:'wave|mosaic|rotate|clear',amount?,durationMs,wait}(화면 그림 자체를 비튼다 — 수중·꿈은 wave, 장면 전환·기억 흐림은 mosaic, 시간 왜곡은 rotate. 컷신 뒤에도 남으니 끝낼 때 clear), flash{color,durationMs}, shake{intensity:1|3|6|10,durationMs,axis:'both|horizontal|vertical'}(지진·쿵은 vertical, 부딪힘은 horizontal), " +
    "letterbox{show,size?,durationMs}(영화식 위아래 검은 띠 — 중요한 장면 시작에 넣는다. 컷신 끝에 자동으로 걷힘, 남기려면 keep:true), " +
    "particles{preset:'sparkle|magic|heal|fire|smoke|dust|explosion|splash',target:'player'|이벤트 id|생략+x,y,durationMs,wait}(한 인물·한 칸에서 터지는 효과 — 보물=sparkle, 주문=magic, 회복=heal, 사라짐=smoke, 착지=dust, 폭발=explosion), " +
    "look{target,pose:'normal|fallen|fallenLeft|crouch|float',tint:'red|blue|green|yellow|purple|gray|black|white|none|#rrggbb',tintFill,flip,angle,afterimage,alpha,reset}(인물 모습 — 기절·잠=fallen, 숨기=crouch, 유령=float+alpha 0.6, 독=tint green, 실루엣=tint black+tintFill, 빠른 이동 잔상=afterimage. 컷신 뒤에도 남으니 되돌릴 땐 {reset:true}), " +
    "emote{target,emote:'exclamation|question|heart|heartBroken|smile|music|sweat|anger|ellipsis|sleep|sparkle|idea',durationMs,wait}(머리 위 감정 말풍선 — 놀람=exclamation), weather{weather:'none|rain|storm|snow|fog',intensity:0~1,durationMs}, " +
    "wait{ms}, parallel{beats}(동시에 — 예: 폭발 particles 와 shake 와 flash 를 한 번에), label, jump. 연출 조합 레시피는 read_directing_guide. " +
    "진행 비트 switch{switchId|key,value} · transfer{mapId,x,y,facing,fade} · ending{endingId} — 기억/장면 진입·다음 장면으로 넘어가는 문·엔딩 컷신도 이 툴 하나로 쓴다(Esc 건너뛰기로도 스위치·이동·엔딩은 빠지지 않는다). " +
    "맵에 들어오면 한 번 재생: trigger:'auto', once:true. 조건이 모이면 재생(메멘토 3개 등): trigger:'auto', requiresSwitches:[…], once:true. " +
    "예: {mapId:'map1',eventId:'ev_memory',skippable:true,beats:[{kind:'camera',mode:'pan',x:8,y:6,durationMs:600},{kind:'say',speaker:'나',text:'그날을 기억한다.'},{kind:'camera',mode:'return'}]}",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      eventId: { type: "string", description: "기존 이벤트 id. 없으면 새 투명 이벤트를 생성합니다." },
      x: { type: "integer", description: "새 이벤트 생성 시 X. 생략 시 시작 맵은 시작 위치, 그 외는 0." },
      y: { type: "integer", description: "새 이벤트 생성 시 Y. 생략 시 시작 맵은 시작 위치, 그 외는 0." },
      trigger: { type: "string", enum: ["action", "auto", "parallel", "playerTouch", "touch"], description: "기본 action. playerTouch/touch 는 통행 가능 칸에 착지한다." },
      beats: { type: "array", description: "CutsceneBeat[]", items: CUTSCENE_BEAT_SCHEMA },
      skippable: { type: "boolean", description: "true면 컷신 잠금 중 Esc 두 번으로 cutscene_end 라벨로 점프" },
      mode: { type: "string", enum: ["replace", "append"], description: "기본 replace. 같은 이벤트에서 이름 컷신 페이지를 교체한다. append는 페이지를 쌓는다." },
      once: { type: "boolean", description: "true면 셀프스위치 A가 꺼져 있을 때만 재생하고 끝나면 A를 켠다." },
      requiresSwitches: {
        type: "array",
        items: { type: "string" },
        description: "이 전역 스위치가 모두 켜졌을 때만 페이지가 선다(예: 메멘토 3개를 다 모으면 자동 재생되는 문 열림 컷신). 없는 스위치 id 는 거부.",
      },
    },
    required: ["mapId", "beats"],
  },
  invalidArgsExample: {
    mapId: "map1",
    eventId: "ev_memory",
    trigger: "action",
    skippable: true,
    beats: [
      { kind: "camera", mode: "pan", x: 8, y: 6, durationMs: 600, wait: true },
      { kind: "say", speaker: "나", text: "그날을 기억한다." },
      { kind: "camera", mode: "return", durationMs: 300 },
    ],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const trigger = triggerFromArg(args.trigger);
    const warnings: string[] = [];
    const aliased = canonicalizeSayBeatAliases(args.beats);
    if (aliased.moved > 0) warnings.push(SAY_BEAT_ALIAS_WARNING(aliased.moved));
    const beats = reconcileCutsceneSayFaces(draft, map,
      resolveCutsceneActorTargets(map, resolveCutsceneMusicResources(draft, aliased.beats as CutsceneBeat[], warnings), warnings), warnings);
    const eventId = typeof args.eventId === "string" && args.eventId.trim() ? args.eventId.trim() : genId("ev_cutscene");
    const eventIds = new Set(map.events.map((event) => event.id));
    eventIds.add(eventId);
    const switchIds = new Set(draft.switches.map((entry) => entry.id));
    const requiresSwitches = Array.isArray(args.requiresSwitches)
      ? [...new Set(args.requiresSwitches.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim()))]
      : [];
    const missingRequired = requiresSwitches.filter((id) => !switchIds.has(id));
    if (missingRequired.length > 0) {
      throw new ToolError(
        `requiresSwitches 에 없는 스위치: ${missingRequired.join(", ")} — get_database_records(collection:"switches") 로 실제 id 를 조회하세요.`,
        { code: "cutscene-validation", mapId: map.id },
      );
    }
    let commands: Command[];
    try {
      commands = compileCutscene(beats, {
        skippable: args.skippable === true,
        context: {
          eventIds,
          resourceIds: collectResourceIds(draft),
          mapIds: new Set(Object.keys(draft.maps)),
          switchIds,
          endingIds: new Set((draft.endings ?? []).map((ending) => ending.id)),
        },
      });
    } catch (cause) {
      if (cause instanceof CutsceneValidationError) {
        throw new ToolError(`컷신 검증 실패: ${cause.reasons.join(" / ")}`, { code: "cutscene-validation", mapId: map.id });
      }
      throw cause;
    }
    warnings.push(...cutsceneMoveWarnings(draft, map, beats));
    const existing = map.events.find((event) => event.id === eventId);
    const mode = args.mode === "append" ? "append" : "replace";
    const once = args.once === true;
    if (once) {
      // 끝이 아니라 잠금 직후에 켠다 — 컷신이 다른 맵으로 옮기거나 엔딩으로 끝나면 끝줄까지 오지 않아 자동 재생이 되풀이된다.
      const beginIndex = commands.findIndex((command) => command.kind === "cutsceneControl");
      commands = [...commands.slice(0, beginIndex + 1), { kind: "setSelfSwitch", key: "A", value: true }, ...commands.slice(beginIndex + 1)];
    }
    const conditions: EventPageCondition[] = [
      ...requiresSwitches.map((switchId): EventPageCondition => ({ kind: "switch", switchId, value: true })),
      ...(once ? [{ kind: "selfSwitch", key: "A", value: false } satisfies EventPageCondition] : []),
    ];
    const page = cutscenePage(
      `${eventId}_cutscene_${(existing?.pages?.length ?? 0) + 1}`,
      "컷신",
      trigger,
      commands,
      conditions
    );
    const outcome = existing ? "modified" : "added";
    let event: GameEvent;
    if (existing) {
      if (isSteppableTrigger(trigger, page.priority)) {
        // 새 페이지가 밟혀야 하는데 기존 좌표가 물이면 페이지만 붙여 죽은 컷신을 만들므로, 이벤트 전체를 먼저 옮긴다.
        const placement = resolveEventPlacement(draft, map, existing.x, existing.y, {
          kind: "interaction",
          steppable: true,
          ignoreEventId: eventId,
          label: "컷신",
          code: "cutscene-impassable",
        });
        if (placement.adjusted) {
          warnings.push(placementAdjustedWarning("컷신", { x: existing.x, y: existing.y }, placement));
          existing.x = placement.x;
          existing.y = placement.y;
        }
      }
      const pages = existing.pages ?? [];
      existing.pages = mode === "append"
        ? [...pages, page]
        : [...pages.filter((entry) => entry.name !== "컷신"), page];
      event = existing;
    } else {
      const pos = cutsceneEventPosition(draft, map, args);
      const placement = resolveEventPlacement(draft, map, pos.x, pos.y, {
        kind: "interaction",
        steppable: isSteppableTrigger(trigger, page.priority),
        ignoreEventId: eventId,
        label: "컷신",
        code: "cutscene-impassable",
      });
      if (placement.adjusted) warnings.push(placementAdjustedWarning("컷신", pos, placement));
      event = { id: eventId, x: placement.x, y: placement.y, trigger, commands: [], pages: [page] };
      map.events.push(event);
    }
    assertEventShape(event);
    assertEventPartyActorReferences(draft, event);
    const unsupportedCommands = countLimitedRuntimeSupportCommandsForEvent(event);
    return {
      summary: `${map.name}에 컷신 '${eventId}' ${outcome === "added" ? "생성" : "페이지 추가"} — beat ${beats.length}개, 명령 ${commands.length}개, 런타임 제한 커맨드 ${unsupportedCommands}건`,
      data: { eventId, pageId: page.id, commandCount: commands.length, unsupportedCommands },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

export { charsetGraphic };
// 스위치 등록 헬퍼는 중립 모듈(flagHelpers)로 이전. 호환을 위해 재수출.
export { ensureNamedSwitch };
export const EVENT_TOOLS: readonly ToolDefinition[] = [
  upsertEvent,
  placeNpc,
  setNpcSchedule,
  makeVillager,
  setShopStock,
  createTransferPair,
  placeBattleBlocker,
  placeTrap,
  placeChest,
  placeStorageChest,
  placeSavepoint,
  makeChaseScene,
  CONFIGURE_OBJECT_BEHAVIOR,
  duplicateEvent,
  removeEvent,
  moveEvent,
  scriptCutscene,
];
