import { CONFIGURE_OBJECT_BEHAVIOR, PURSUIT_SCHEMA, parsePursuit } from "./horrorBehaviorTools";
// editor/tools/eventTools.ts
// 이벤트 쓰기 툴: upsert_event / place_npc / create_transfer_pair / place_battle_blocker
//              / duplicate_event / remove_event / move_event.

import { shadowedPageWarnings } from "@/project/eventPageShadow";
import { isPassable } from "@/project/collision";
import { isSeason, isTimePhase, resolveTimeSystem, type Season } from "@/project/gameTime";
import { validateShopStock } from "@/project/io/shapeCommandFields";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { countLimitedRuntimeSupportCommandsForEvent } from "@/project/lint/projectLint";
import { genId } from "@/util/id";
import { chestOpenCommands, chestOpenedGraphic, lootGrantCommands } from "@/editor/lootFeedback";
import type { Command, Condition, Dir, EventPage, EventPageCondition, EventPageGraphic, FaceGraphic, GameEvent, GameMap, GiftPrefs, GiftResponses, NpcScheduleEntry, NpcScheduleWhen, Project, SelfSwitchKey, ShopStockEntry, TransferFade, Trigger } from "@/project/types";
import {
  compileCutscene,
  CutsceneValidationError,
  type CutsceneBeat,
} from "@/editor/cutscene";
import { faceGraphicForCharset, faceGraphicFromEventGraphic } from "@/assets/charsetFaceMap";
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
import { ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { buildFieldMonsterEvent } from "@/project/fieldMonsterTemplate";
import { inMapBounds, requireMap, type Point } from "./mapHelpers";
import { ToolError, type SimplePage, type ToolDefinition, type ToolExecResult } from "./types";
import { isFlushPassable, snapFlushToWall } from "./wallFlush";
import {
  COMMAND_SCHEMA,
  COORD_SCHEMA,
  CUTSCENE_BEAT_SCHEMA,
  FACE_SCHEMA,
  GRAPHIC_SPEC_SCHEMA,
  ITEM_AMOUNT_SCHEMA,
  RECT_SCHEMA,
  SIMPLE_PAGE_SCHEMA,
} from "./schemaShapes";

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };
const WANDER: EventPage["movement"] = { type: "random", speed: 2, frequency: 3 };
const DIALOGUE_COMMAND_KINDS: ReadonlySet<string> = new Set(["text", "choices"]);

/** place_npc/make_villager face 인자 → FaceGraphic. 실제 배치된 charset 기준으로 맞춘다. */
function resolvePlaceNpcFaceArg(
  faceArg: unknown,
  resolvedGraphic: EventPageGraphic,
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
      return faceGraphicForCharset(
        rec.textureKey,
        typeof rec.characterIndex === "number" ? rec.characterIndex : 0,
      );
    }
  }
  // 다양화 픽 이후 실제 graphic → faceset (query 기본값 people1#0 고정 금지)
  return faceGraphicFromEventGraphic(resolvedGraphic) ?? undefined;
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

// 맵의 이벤트를 id로 upsert(있으면 교체, 없으면 push).
export function upsertEventIntoMap(map: GameMap, event: GameEvent): "added" | "modified" {
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

function normalizeEventCommandArrays(event: GameEvent, warnings?: string[]): void {
  (event as GameEvent).commands = commandArrayOrEmpty((event as { commands?: unknown }).commands, `${event.id}.commands`, warnings);
  if (event.pages === undefined || event.pages === null) return;
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
function isInvisibleTalkablePage(page: Partial<EventPage>): boolean {
  if (page.trigger?.kind !== "action" || page.priority === "below") return false;
  if (page.graphic?.transparent === true || page.graphic?.sprite !== undefined) return false;
  return (page.commands ?? []).some((command) => DIALOGUE_COMMAND_KINDS.has(command.kind));
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
  if (page.priority === undefined) { page.priority = "same"; filled.push("priority"); }
  if (page.movement === undefined) { page.movement = PASSIVE; filled.push("movement"); }
  if (isInvisibleTalkablePage(page)) {
    const siblingGraphic = event.pages?.find(
      (sibling) => sibling !== page && sibling.graphic?.sprite !== undefined,
    )?.graphic;
    page.graphic = siblingGraphic ? structuredClone(siblingGraphic) : resolveGraphicQuery("villager");
    warnings?.push(
      siblingGraphic
        ? `${event.id}.${pageId}: 대화가 있는 action 페이지인데 그래픽이 비어 있어 보이지 않습니다 — 다른 페이지의 charset 을 재사용했습니다.`
        : `${event.id}.${pageId}: 대화가 있는 action 페이지인데 그래픽이 비어 있어 보이지 않습니다 — ` +
          `주민 기본 charset 을 붙였습니다. 투명 이벤트가 의도라면 graphic:{transparent:true} 를 명시하고, ` +
          `다른 외형이 필요하면 place_npc {graphic:{query:"…"}} 를 쓰세요.`,
    );
  } else if (page.graphic === undefined) {
    page.graphic = {};
    filled.push("graphic");
  }
  if (filled.length > 0) {
    warnings?.push(`${event.id}.${pageId}: 필수 페이지 필드 자동 보완 — ${filled.join(", ")}`);
  }
}

// 페이지 커맨드 shape를 사전 검증(기존 io 검증기 위임).
function assertEventShape(event: GameEvent, warnings?: string[]): void {
  try {
    normalizeEventCommandArrays(event, warnings);
    validateLowLevelCommandArray(`${event.id}.commands`, event.commands);
    for (const page of event.pages ?? []) {
      validateLowLevelCommandArray(`${event.id}.${page.id}.commands`, page.commands);
    }
    for (const warning of shadowedPageWarnings(`이벤트 '${event.id}'`, event.pages, event.commands)) warnings?.push(warning);
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
    readonly steppable?: boolean;
    readonly ignoreEventId?: string;
    readonly reserved?: ReadonlySet<string>;
    readonly label: string;
    readonly code: string;
  },
): { x: number; y: number; adjusted: boolean } {
  const mustStandOnPassable = options.kind === "character" || options.steppable === true;
  const requestedReserved = options.reserved?.has(`${x},${y}`) === true;
  if (!requestedReserved && isPassable(project, map, x, y)) return { x, y, adjusted: false };
  if (!requestedReserved && !mustStandOnPassable && passableLanding(project, map, x, y)) return { x, y, adjusted: false };
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

const upsertEvent: ToolDefinition = {
  name: "upsert_event",
  description: `${LOW_LEVEL_TOOL_DESCRIPTION_PREFIX} GameEvent를 추가하거나 기존 이벤트를 부분 수정한다. 기존 id이면 입력에 포함한 최상위 필드만 바꾸고, 생략한 pages/commands/graphic/characterId/좌표 등은 보존한다. 빈 배열처럼 명시한 값은 그대로 반영한다. NPC/주민/대화 이벤트 배치는 place_npc, 스케줄만 바꿀 때는 set_npc_schedule을 우선 사용하라.`,
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
          pages: { type: "array", items: SIMPLE_PAGE_SCHEMA },
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
    assertEventShape(event, warnings);
    const outcome = upsertEventIntoMap(map, event);
    const unsupportedCommands = countLimitedRuntimeSupportCommandsForEvent(event);
    return {
      summary: `${map.name}에 이벤트 '${event.id}' ${outcome === "added" ? "추가" : "수정"} — 미지원 커맨드 ${unsupportedCommands}건${adjusted ? ` — 위치 자동 조정 (${event.x}, ${event.y})` : ""}`,
      data: { eventId: event.id, unsupportedCommands, x: event.x, y: event.y, adjusted },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};


// 같은 맵·근접 칸에 비슷한 이름의 NPC가 있으면 새로 만들지 않고 기존 id 재사용(중복 상인 thrash 방지).
function isShopRoleNpcName(name: string): boolean {
  return /상점\s*주인|잡화\s*상|잡화점|가게\s*주인|상인|merchant|shopkeeper|shop\s*owner/u.test(name.trim());
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
    const pageName = event.pages?.[0]?.name?.trim() ?? "";
    const eventName = pageName || event.id;
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
    + "**대사가 있으면 charset에 대응하는 faceset changeFace를 자동 삽입**한다(page.face로 덮어쓰기 가능). page.conditions 단수 객체/null, page.commands 단수 객체, command→kind alias는 warning과 함께 정규화한다. 통행 불가/점유 칸이면 근처 통행 가능 칸으로 자동 착지한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      name: { type: "string" },
      graphic: GRAPHIC_SPEC_SCHEMA,
      face: FACE_SCHEMA,
      movement: { type: "string", enum: ["fixed", "random"], description: "자율 이동. 생략 시 fixed(제자리). 시장·광장·마을 주민처럼 돌아다니는 NPC는 random(배회). 상점 주인·간판 NPC·대화 거점은 fixed." },
      pages: {
        type: "array",
        description:
          "상태별 SimplePage[]. 페이지 1=조건 없는 기본, 뒤 페이지는 서로 다른 conditions(switch/selfSwitch/timePhase/friendshipAtLeast 등). 조건 없는 페이지를 여러 장 만들지 마라.",
        items: SIMPLE_PAGE_SCHEMA,
      },
      id: { type: "string" },
      characterId: { type: "string", description: "공유 호감/선물 키. 호감 페이지를 쓰면 필수. 생략 시 호감 조건/커맨드가 있으면 이름에서 할당" },
    },
    required: ["mapId", "x", "y", "name", "pages"],
  },
  invalidArgsHint: PLACE_NPC_OBJECT_GIMMICK_HINT,
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const requestedX = args.x as number;
    const requestedY = args.y as number;
    const name = args.name as string;
    const explicitId = typeof args.id === "string" && args.id.trim() ? args.id.trim() : undefined;
    if (!inMapBounds(map, requestedX, requestedY)) {
      throw new ToolError(`NPC 위치가 맵 밖입니다: (${requestedX}, ${requestedY})`, { code: "npc-out-of-bounds", mapId: map.id, x: requestedX, y: requestedY });
    }
    // 에이전틱 편의: 통행 불가 칸을 지정하면 실패 대신 근처(반경 3) 통행 가능 칸으로 자동 착지.
    const landing = nearestPassableCell(draft, map, requestedX, requestedY, 3, explicitId);
    if (!landing) {
      throw new ToolError(
        `NPC를 놓을 통행 가능 칸이 없습니다: (${requestedX}, ${requestedY}) 주변 반경 3칸까지 전부 통행 불가입니다. get_map_region으로 지형을 확인하세요.`,
        { code: "npc-impassable", mapId: map.id, x: requestedX, y: requestedY }
      );
    }
    const { x, y } = landing;
    // graphic 생략 시 투명 고스트가 되지 않도록 주민 기본 캐릭터를 쓴다(함정/컷신은 별도 툴).
    // 일반 query + 시드 샘플 + 맵 내 중복 회피로 동일 타일 그림판 몰림을 줄인다.
    const graphicSpec = (args.graphic as GraphicSpec | undefined) ?? { query: "villager" };
    const graphic = resolveGraphic(graphicSpec, {
      avoidKeys: usedCharsetGraphicKeysOnMap(map),
      seed: `${map.id}:${name}:${x},${y}`,
    });
    // 근접 유사 NPC: 상점 역할이면 id가 달라도 기존 이벤트로 합친다(상점 주인+상인 thrash).
    // 일반 NPC는 id 생략일 때만 병합 — 명시 id 2개는 의도적 복수 배치.
    const similar = findNearbySimilarNpc(map, x, y, name, 2);
    const shopRole = isShopRoleNpcName(name);
    const mergeSimilar = Boolean(similar) && (shopRole || !explicitId);
    const id = mergeSimilar ? similar!.id : (explicitId ?? genId("ev_npc"));
    const reused = mergeSimilar;
    const movement = (args.movement as string | undefined) === "random" ? WANDER : PASSIVE;
    const normalizationWarnings: string[] = [];
    if (args.graphic === undefined) normalizationWarnings.push("graphic 생략 → query:\"villager\" 기본 적용");
    if (reused) normalizationWarnings.push(`근접 유사 NPC 재사용 → id:${id} (새 이벤트 대신 갱신)`);
    const faceArg = resolvePlaceNpcFaceArg(args.face, graphic);
    const pages = compileSimplePages(id, name, args.pages as SimplePage[], graphic, {
      movement,
      warnings: normalizationWarnings,
      face: faceArg,
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
    assertEventShape(event, normalizationWarnings);
    upsertEventIntoMap(map, event);
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
      movement: { type: "string", enum: ["fixed", "random"], description: "자율 이동. 생략 시 fixed(제자리). 돌아다니는 주민은 random(배회). 상점 주인은 fixed." },
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
    const villagerMovement = (args.movement as string | undefined) === "random" ? WANDER : PASSIVE;
    const schedule = args.schedule !== undefined
      ? parseNpcSchedule(draft, args.schedule, "schedule")
      : routineSchedule(draft, map.id, home, args.dailyRoutine);
    const graphicSpec = (args.graphic as GraphicSpec | undefined) ?? { query: "villager" };
    const graphic = resolveGraphic(graphicSpec, {
      avoidKeys: usedCharsetGraphicKeysOnMap(map),
      seed: `${map.id}:${name}:${home.x},${home.y}`,
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
    const warnings: string[] = [];
    if (args.graphic === undefined && !reused) warnings.push("graphic 생략 → query:\"villager\" 기본 적용");
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
        face: resolvePlaceNpcFaceArg(args.face, graphic),
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
    "기존 이벤트의 첫 shop 커맨드에 계절 재고(stock)를 설정한다. shop 커맨드가 없으면 첫 페이지(없으면 이벤트 루트)에 상점 커맨드를 추가한다. 상인 NPC 에 판매 재고를 연결하는 정본 — 아이템 id 는 get_database_records 로 먼저 확인.",
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
    const itemId = itemIdArg(project, record.itemId, `${label}[${index}].itemId`);
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
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const cx = x + dx;
        const cy = y + dy;
        if (!inMapBounds(map, cx, cy)) continue;
        if (occupied.has(`${cx},${cy}`)) continue;
        if (isPassable(project, map, cx, cy)) return { x: cx, y: cy };
      }
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
      return { gate, landing };
    }
  }
  return null;
}

/**
 * 출입구 자리를 못 찾은 **실제 원인**을 짚는다.
 *
 * 종전 문구는 원인과 무관하게 "get_map_region으로 주변 구조물과 통행 지형을 확인하세요" 였다.
 * 2026-08-28 실측에서 대상이 구조물 0인 잔디 단색 맵이었는데도 같은 안내가 나갔고, 모델은
 * 지형을 확인해 봐야 소용없는 상태에서 3연속 같은 실패를 반복했다. 실패 경로는 셋뿐이므로
 * (범위 밖 / 이벤트 점유 / 통행 불가) 어느 쪽인지 세어서 알려준다.
 */
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
    const endpointA = transferEndpoint(draft, mapA, a.x, a.y);
    const endpointB = transferEndpoint(draft, mapB, b.x, b.y);
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
    const adjustedA = gateA.x !== a.x || gateA.y !== a.y;
    const adjustedB = gateB.x !== b.x || gateB.y !== b.y;
    const warnings = [
      ...(adjustedA ? [`출입구 A 위치 자동 조정: (${a.x},${a.y}) → (${gateA.x},${gateA.y})`] : []),
      ...(adjustedB ? [`출입구 B 위치 자동 조정: (${b.x},${b.y}) → (${gateB.x},${gateB.y})`] : []),
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
    const graphic = resolveGraphic((args.graphic as GraphicSpec | undefined) ?? { query: "monster" });
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
    });
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    const warnings = [
      ...(args.graphic === undefined ? ['graphic 생략 → query:"monster" 기본 적용'] : []),
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
    const graphic = resolveGraphic(args.graphic as GraphicSpec | undefined);
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

const makeChaseScene: ToolDefinition = {
  name: "make_chase_scene",
  description:
    "장애물을 우회하는 실시간 추격자 이벤트를 만든다. chaser.at/graphic/speed/sightRange를 받고, killOnTouch면 eventTouch에서 killPlayer를 실행한다. safeZone은 map.safeZones에 추가하며, activateSwitch가 있으면 해당 스위치 ON 페이지에서만 추격한다. 추격자는 캐릭터형이므로 통행 불가 칸이면 근처(반경 3) 통행 가능 칸으로 자동 착지한다. pursuit.scope=connected면 문으로 연결된 방까지 추격한다. doorDelayMs/searchMs/onLost로 문 대기·수색·복귀를 설정한다. 추격전·「쫓아오는」 요청의 정본.",
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
      safeZone: { ...RECT_SCHEMA, description: "{x,y,w,h} 안전 지대" },
      activateSwitch: { type: "string" },
      checkpointOnEntry: { type: "boolean" },
    },
    required: ["mapId", "chaser"],
  },
  invalidArgsExample: {
    mapId: "map1",
    chaser: { at: { x: 8, y: 4 }, graphic: { query: "monster" }, speed: 6, sightRange: 8 },
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
    const graphic = resolveGraphic((chaser.graphic as GraphicSpec | undefined) ?? { query: "monster" });
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
            frequency: speed,
            ...(chaser.sightRange !== undefined ? { sightRange: Math.max(0, Math.trunc(chaser.sightRange)) } : {}),
            pathfind: true,
            ...(args.pursuit !== undefined ? { pursuit: parsePursuit(args.pursuit) } : {}),
          },
          commands,
        },
      ],
    };
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    const checkpointEventId = args.checkpointOnEntry === true ? ensureMapCheckpointEvent(draft, map) : undefined;
    const warnings = [
      ...(chaser.graphic === undefined ? ['graphic 생략 → query:"monster" 기본 적용'] : []),
      ...(placement.adjusted ? [placementAdjustedWarning("추격자", chaser.at, placement)] : []),
    ];
    return {
      summary: `${map.name}에 추격자 '${id}' 생성 (${placement.x}, ${placement.y})${placement.adjusted ? ` — 요청 좌표 (${chaser.at.x}, ${chaser.at.y})에서 자동 조정` : ""}${safeZone ? " — 안전지대 추가" : ""}${checkpointEventId ? ` — 진입 체크포인트 ${checkpointEventId}` : ""}`,
      data: { eventId: id, safeZone, activateSwitch, checkpointEventId, x: placement.x, y: placement.y, adjusted: placement.adjusted },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

// 보물상자: "상자를 열면 X 지급"을 셀프스위치 2페이지로 완결하는 프리셋.
// (코퍼스 hidden-treasure-chest / chest-potion-reward가 "부분 가능"이던 갭 해소)
const placeChest: ToolDefinition = {
  name: "place_chest",
  description:
    "보물상자 이벤트를 배치한다. 조사하면 contents의 아이템/골드를 지급하고 셀프스위치 A로 개봉 상태를 기억한다(2페이지).  보물상자(열면 아이템/골드 지급, 개봉 기억)는 반드시 이 툴 — place_npc/upsert_event 로 흉내내지 말 것. 장식용 박스·나무상자는 이 툴이 아니라 place_props(material:\"나무 상자\"). 넣고 빼는 보관 상자는 place_storage_chest." +
    "'보물상자'·'상자를 열면 ~을 주는' 요청만 이 툴. " +
    "장식용 박스·나무상자·나무박스·과일박스는 place_props(harness-combined-town-wood-box / fruit-box) — place_chest 금지. " +
    "벽 위(문·벽감)여도 인접 칸에서 조사할 수 있으면 그대로 두고, 사방이 막힌 칸이면 근처(반경 3) 통행 가능 칸으로 자동 착지한다.",
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
    // action 트리거 상자는 RM2K3 문 의미대로 벽 위도 허용 — 단 인접 칸에서 조사할 수 있어야 한다.
    const placement = resolveEventPlacement(draft, map, requestedX, requestedY, {
      kind: "interaction",
      label: "보물상자",
      code: "chest-impassable",
    });
    const { x, y, adjusted } = placement;
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
    const itemRecord = itemId ? draft.database.items.find((item) => item.id === itemId) : undefined;
    if (itemId && !itemRecord) {
      warnings.push(`아이템 '${itemId}'가 데이터베이스에 없습니다 — upsert_item으로 먼저 만들거나 기존 id를 쓰세요`);
    }
    const graphic = resolveGraphic({ query: "보물상자" });
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
    });
    const { x, y, adjusted } = placement;
    const graphic = resolveGraphic({ query: "보물상자" });
    const id = (args.id as string | undefined) ?? genId("ev_storage_chest");
    const name = (args.name as string | undefined) ?? "보관 상자";
    const chestIdRaw = typeof args.chestId === "string" ? args.chestId.trim() : "";
    const chestId = chestIdRaw || `storage_${id}`;
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
          priority: "same",
          overlapForbidden: true,
          animationType: "fixedGraphic",
          movement: PASSIVE,
          commands: [{ kind: "openChest", chestId }],
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
    },
    required: ["mapId", "x", "y"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const requestedX = args.x as number;
    const requestedY = args.y as number;
    if (!inMapBounds(map, requestedX, requestedY)) {
      throw new ToolError(`세이브 포인트 위치가 맵 밖입니다: (${requestedX}, ${requestedY})`, { code: "savepoint-out-of-bounds", mapId: map.id, x: requestedX, y: requestedY });
    }
    // priority "below" 이지만 트리거는 action — 밟는 이벤트가 아니므로 interaction 규칙을 쓴다.
    const placement = resolveEventPlacement(draft, map, requestedX, requestedY, {
      kind: "interaction",
      label: "세이브 포인트",
      code: "savepoint-impassable",
    });
    const { x, y, adjusted } = placement;
    const graphic = resolveGraphic({ query: "크리스탈" });
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
            { kind: "checkpointSave", label: "savepoint" },
            { kind: "text", body: "이곳에 모험을 기록했다." },
          ],
        },
      ],
    };
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    return {
      summary: `${map.name}에 세이브 포인트 '${name}' 배치 (${x}, ${y})${adjusted ? ` — 요청 좌표 (${requestedX}, ${requestedY})에서 자동 조정` : ""}`,
      data: { eventId: id, x, y, adjusted },
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

const moveEvent: ToolDefinition = {
  name: "move_event",
  description: "이벤트를 같은 맵 내 다른 좌표로 옮긴다. 이벤트 자신의 트리거/우선순위 기준으로 통행 가능 칸에 착지한다(밟는 이벤트는 통행 가능 칸 강제, 그 외는 인접 통행 가능 칸 필요). 배치를 옮기라는 요청은 이벤트를 지우고 새로 만들지 말고 이 툴로 옮긴다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: { mapId: { type: "string" }, eventId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } },
    required: ["mapId", "eventId", "x", "y"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const event = map.events.find((entry) => entry.id === args.eventId);
    if (!event) throw new ToolError(`옮길 이벤트를 찾을 수 없습니다: ${args.eventId}`, { code: "event-not-found" });
    const requestedX = args.x as number;
    const requestedY = args.y as number;
    if (!inMapBounds(map, requestedX, requestedY)) throw new ToolError(`이동 위치가 맵 밖입니다: (${requestedX}, ${requestedY})`, { mapId: map.id, x: requestedX, y: requestedY });
    const placement = resolveEventPlacement(draft, map, requestedX, requestedY, {
      kind: "interaction",
      steppable: eventIsSteppable(event),
      ignoreEventId: event.id,
      label: `이벤트 '${event.id}'`,
      code: "move-event-impassable",
    });
    event.x = placement.x;
    event.y = placement.y;
    return {
      summary: `이벤트 '${args.eventId}' → (${placement.x}, ${placement.y})${placement.adjusted ? ` — 요청 좌표 (${requestedX}, ${requestedY})에서 자동 조정` : ""}`,
      data: { eventId: event.id, x: placement.x, y: placement.y, adjusted: placement.adjusted },
      ...(placement.adjusted ? { warnings: [placementAdjustedWarning(`이벤트 '${event.id}'`, { x: requestedX, y: requestedY }, placement)] } : {}),
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

const scriptCutscene: ToolDefinition = {
  name: "script_cutscene",
  description:
    "한 장면 컷신을 beat 타임라인으로 작성해 이벤트 페이지로 추가한다.  컷신·연출·대화 장면·회상 요청의 정본. 투더문식 회상/엔딩 프리셋은 script_cutscene_preset." +
    "**플레이어 조작(이동·조사·공격·메뉴)을 잠그고 시청만 하게 만드는 장면 전용 도구다** — " +
    "회상/플래시백, 오프닝, 엔딩, 시네마틱, '플레이어가 아무것도 못 하는 장면' 요청은 모두 이 툴이다. " +
    "잠금/해제와 스킵 라벨은 컴파일러가 자동으로 감싸므로 upsert_event 로 수동 조립하지 말 것. beat 종류: " +
    "say{speaker,face,text|lines}, moveActor{target:'player'|eventId,moves,wait}, camera{mode:'pan|follow|fixed|return',target|x,y,durationMs,wait}, " +
    "picture{action:'show|move|erase',pictureId,resourceId,x,y,durationMs,wait}, music{action:'bgm|se|fade|stop',resourceId}, tint{color|value,durationMs,wait}, flash, shake, wait{ms}, parallel{beats}, label, jump. " +
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
    const beats = resolveCutsceneMusicResources(draft, args.beats as CutsceneBeat[], warnings);
    const eventId = typeof args.eventId === "string" && args.eventId.trim() ? args.eventId.trim() : genId("ev_cutscene");
    const eventIds = new Set(map.events.map((event) => event.id));
    eventIds.add(eventId);
    let commands: Command[];
    try {
      commands = compileCutscene(beats, {
        skippable: args.skippable === true,
        context: { eventIds, resourceIds: collectResourceIds(draft) },
      });
    } catch (cause) {
      if (cause instanceof CutsceneValidationError) {
        throw new ToolError(`컷신 검증 실패: ${cause.reasons.join(" / ")}`, { code: "cutscene-validation", mapId: map.id });
      }
      throw cause;
    }
    const existing = map.events.find((event) => event.id === eventId);
    const mode = args.mode === "append" ? "append" : "replace";
    const once = args.once === true;
    if (once) {
      commands = [...commands, { kind: "setSelfSwitch", key: "A", value: true }];
    }
    const page = cutscenePage(
      `${eventId}_cutscene_${(existing?.pages?.length ?? 0) + 1}`,
      "컷신",
      trigger,
      commands,
      once ? [{ kind: "selfSwitch", key: "A", value: false }] : []
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
    const unsupportedCommands = countLimitedRuntimeSupportCommandsForEvent(event);
    return {
      summary: `${map.name}에 컷신 '${eventId}' ${outcome === "added" ? "생성" : "페이지 추가"} — beat ${beats.length}개, 명령 ${commands.length}개, 미지원 커맨드 ${unsupportedCommands}건`,
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
