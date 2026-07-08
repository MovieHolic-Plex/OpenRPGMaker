// editor/tools/eventTools.ts
// 이벤트 쓰기 툴: upsert_event / place_npc / create_transfer_pair / place_battle_blocker
//              / duplicate_event / remove_event / move_event.

import { isPassable } from "@/project/collision";
import { isSeason, isTimePhase, type Season } from "@/project/gameTime";
import { validateCommandArray, validateShopStock } from "@/project/io/shapeCommandFields";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { countLimitedRuntimeSupportCommandsForEvent } from "@/project/lint/projectLint";
import { genId } from "@/util/id";
import type { Command, Dir, EventPage, EventPageCondition, GameEvent, GameMap, GiftPrefs, GiftResponses, NpcScheduleEntry, NpcScheduleWhen, Project, ShopStockEntry, TransferFade, Trigger } from "@/project/types";
import {
  compileCutscene,
  CutsceneValidationError,
  type CutsceneBeat,
} from "@/editor/cutscene";
import {
  charsetGraphic,
  compileSimplePages,
  resolveGraphic,
  type GraphicSpec,
} from "./eventCompile";
import { ensureNamedSwitch } from "./flagHelpers";
import { inMapBounds, requireMap, type Point } from "./mapHelpers";
import { ToolError, type SimplePage, type ToolDefinition, type ToolExecResult } from "./types";

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };
const WANDER: EventPage["movement"] = { type: "random", speed: 2, frequency: 3 };
const UPSERT_EVENT_NPC_HINT = "NPC 배치가 목적이면 place_npc {mapId,x,y,name,pages}를 사용하세요.";
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

// 페이지 커맨드 shape를 사전 검증(기존 io 검증기 위임).
function assertEventShape(event: GameEvent): void {
  try {
    validateCommandArray(`${event.id}.commands`, event.commands);
    for (const page of event.pages ?? []) {
      validateCommandArray(`${event.id}.${page.id}.commands`, page.commands);
    }
  } catch (cause) {
    throw new ToolError(`이벤트 형식이 올바르지 않습니다: ${cause instanceof Error ? cause.message : String(cause)}`, {
      code: "event-shape",
    });
  }
}

// (x,y) 주변(또는 자신)에서 통행 가능한 첫 칸을 착지 좌표로 고른다.
function passableLanding(project: Project, map: GameMap, x: number, y: number): Point | null {
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

const upsertEvent: ToolDefinition = {
  name: "upsert_event",
  description: "저수준 만능 이벤트 툴. 기존 GameEvent 구조 그대로 받아 shape 검증 후 맵에 upsert한다. NPC/주민/대화 이벤트 배치는 place_npc를 사용하라. upsert_event는 GameEvent 전체 shape를 아는 경우의 저수준 수정용.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      event: { type: "object", description: "GameEvent(id/x/y/trigger/commands/pages...)" },
    },
    required: ["mapId", "event"],
  },
  invalidArgsHint: UPSERT_EVENT_NPC_HINT,
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const event = args.event as GameEvent;
    if (!event || typeof event.id !== "string") throw new ToolError("event.id(문자열)가 필요합니다.");
    if (typeof event.x !== "number" || typeof event.y !== "number") throw new ToolError("event.x/y(숫자)가 필요합니다.");
    if (!event.trigger) (event as GameEvent).trigger = { kind: "action" };
    if (!Array.isArray(event.commands)) (event as GameEvent).commands = [];
    assertEventShape(event);
    const outcome = upsertEventIntoMap(map, event);
    const unsupportedCommands = countLimitedRuntimeSupportCommandsForEvent(event);
    return {
      summary: `${map.name}에 이벤트 '${event.id}' ${outcome === "added" ? "추가" : "수정"} — 미지원 커맨드 ${unsupportedCommands}건`,
      data: { eventId: event.id, unsupportedCommands },
    };
  },
};

const placeNpc: ToolDefinition = {
  name: "place_npc",
  description: "NPC 이벤트를 배치한다. graphic은 {query} 또는 {textureKey,characterIndex}. query는 기존 별칭(villager|people|npc|human|사람|주민|actor|hero|animal|monster)과 자유 질의를 허용한다: 예 '할머니', 'old woman', '노인 남성'. pages는 SimplePage로 EventPage로 컴파일된다. page.conditions 단수 객체/null, page.commands 단수 객체, command→kind alias는 warning과 함께 정규화한다. 통행 불가/점유 칸이면 근처 통행 가능 칸으로 자동 착지한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      name: { type: "string" },
      graphic: { type: "object", description: "{query} | {textureKey,characterIndex}" },
      movement: { type: "string", enum: ["fixed", "random"] },
      pages: { type: "array", description: "SimplePage[]", items: { type: "object" } },
      id: { type: "string" },
    },
    required: ["mapId", "x", "y", "name", "pages"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const requestedX = args.x as number;
    const requestedY = args.y as number;
    const name = args.name as string;
    if (!inMapBounds(map, requestedX, requestedY)) {
      throw new ToolError(`NPC 위치가 맵 밖입니다: (${requestedX}, ${requestedY})`, { code: "npc-out-of-bounds", mapId: map.id, x: requestedX, y: requestedY });
    }
    // 에이전틱 편의: 통행 불가 칸을 지정하면 실패 대신 근처(반경 3) 통행 가능 칸으로 자동 착지.
    const landing = nearestPassableCell(draft, map, requestedX, requestedY, 3);
    if (!landing) {
      throw new ToolError(
        `NPC를 놓을 통행 가능 칸이 없습니다: (${requestedX}, ${requestedY}) 주변 반경 3칸까지 전부 통행 불가입니다. get_map_region으로 지형을 확인하세요.`,
        { code: "npc-impassable", mapId: map.id, x: requestedX, y: requestedY }
      );
    }
    const { x, y } = landing;
    const graphic = resolveGraphic(args.graphic as GraphicSpec | undefined);
    const id = (args.id as string | undefined) ?? genId("ev_npc");
    const movement = (args.movement as string | undefined) === "random" ? WANDER : PASSIVE;
    const normalizationWarnings: string[] = [];
    const pages = compileSimplePages(id, name, args.pages as SimplePage[], graphic, { movement, warnings: normalizationWarnings });
    const event: GameEvent = { id, x, y, trigger: { kind: "action" }, commands: [], pages };
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    const adjusted = x !== requestedX || y !== requestedY;
    const warnings = [
      ...(adjusted ? [`NPC '${name}' 위치 자동 조정: (${requestedX}, ${requestedY}) → (${x}, ${y})`] : []),
      ...normalizationWarnings,
    ];
    const normalizationSummary = normalizationWarnings.length > 0 ? ` — SimplePage 정규화 경고 ${normalizationWarnings.length}건` : "";
    return {
      summary: `${map.name}에 NPC '${name}' 배치 (${x}, ${y})${adjusted ? ` — 요청 좌표 (${requestedX}, ${requestedY})가 통행 불가라 자동 조정` : ""}${normalizationSummary}`,
      data: { eventId: id, x, y, adjusted },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const setNpcSchedule: ToolDefinition = {
  name: "set_npc_schedule",
  description:
    "기존 NPC 이벤트에 시간표를 설정한다. timeSystem이 켜진 플레이에서 when이 현재 시간과 맞으면 at으로 이동한다. 요일은 GameTime에 없으므로 dayRange를 사용한다.",
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
      data: { eventId: event.id, scheduleCount: schedule.length },
    };
  },
};

const makeVillager: ToolDefinition = {
  name: "make_villager",
  description:
    "home 좌표에 주민 NPC를 만들고 선택적으로 schedule/dailyRoutine/dialogue를 함께 설정한다. dailyRoutine은 {workAt,workHours:[start,end]}로 집→일터→귀가 스케줄을 생성한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      name: { type: "string" },
      graphic: { type: "object", description: "{query} | {textureKey,characterIndex}" },
      home: { type: "object", description: "{x,y}" },
      schedule: npcScheduleSchema,
      dailyRoutine: { type: "object", description: "{workAt:{mapId?,x,y},workHours:[start,end]}" },
      dialogue: { type: "array", description: "{when?,text}[]", items: { type: "object" } },
      giftPrefs: giftPrefsSchema,
      giftResponses: giftResponsesSchema,
      shop: {
        type: "object",
        description: "{stock: ShopStockEntry[]} 상점 주민 옵션",
        properties: { stock: shopStockSchema },
      },
      id: { type: "string" },
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
    const home = pointFromRecord(args.home, "home");
    assertPassableSchedulePoint(draft, map.id, home.x, home.y, "home");
    const schedule = args.schedule !== undefined
      ? parseNpcSchedule(draft, args.schedule, "schedule")
      : routineSchedule(draft, map.id, home, args.dailyRoutine);
    const graphic = resolveGraphic(args.graphic as GraphicSpec | undefined);
    const id = typeof args.id === "string" && args.id.trim() ? args.id.trim() : genId("ev_villager");
    const warnings: string[] = [];
    const pages = compileSimplePages(id, name, villagerPages(args.dialogue, schedule, warnings), graphic, {
      movement: PASSIVE,
      warnings,
    });
    const giftPrefs = parseGiftPrefs(draft, args.giftPrefs, "giftPrefs");
    const giftResponses = parseGiftResponses(args.giftResponses, "giftResponses");
    const shopStock = parseOptionalShopStock(draft, (args.shop as Record<string, unknown> | undefined)?.stock, "shop.stock");
    if (shopStock) appendShopCommandToFirstPage(pages, shopStock);
    const event: GameEvent = {
      id,
      x: home.x,
      y: home.y,
      trigger: { kind: "action" },
      commands: [],
      pages,
      ...(schedule.length > 0 ? { schedule } : {}),
      ...(giftPrefs ? { giftPrefs } : {}),
      ...(giftResponses ? { giftResponses } : {}),
    };
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    return {
      summary: `${map.name}에 주민 '${name}' 생성 (${home.x}, ${home.y}) — 스케줄 ${schedule.length}개, 대사 페이지 ${pages.length}개${shopStock ? ", 상점 재고 " + shopStock.length + "개" : ""}`,
      data: { eventId: id, scheduleCount: schedule.length, pageCount: pages.length, shopStockCount: shopStock?.length ?? 0 },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const setShopStock: ToolDefinition = {
  name: "set_shop_stock",
  description:
    "기존 이벤트의 첫 shop 커맨드에 계절 재고(stock)를 설정한다. shop 커맨드가 없으면 첫 페이지(없으면 이벤트 루트)에 상점 커맨드를 추가한다.",
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

function appendShopCommandToFirstPage(pages: EventPage[], stock: readonly ShopStockEntry[]): void {
  const page = pages[0];
  if (page) page.commands.push(shopCommandFromStock(stock));
}

function setShopStockOnEvent(event: GameEvent, stock: readonly ShopStockEntry[]): "added" | "modified" {
  const existing = findFirstShopCommand(event.pages?.flatMap((page) => page.commands) ?? []) ?? findFirstShopCommand(event.commands);
  if (existing) {
    existing.itemIds = uniqueStockItemIds(stock);
    existing.stock = [...stock];
    return "modified";
  }
  const command = shopCommandFromStock(stock);
  if (event.pages?.[0]) event.pages[0].commands.push(command);
  else event.commands.push(command);
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
function nearestPassableCell(project: Project, map: GameMap, x: number, y: number, maxRadius: number): Point | null {
  const occupied = new Set(map.events.map((event) => `${event.x},${event.y}`));
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

function villagerPages(rawDialogue: unknown, schedule: readonly NpcScheduleEntry[], warnings: string[]): SimplePage[] {
  const pages: SimplePage[] = [{ lines: ["안녕하세요."] }];
  if (rawDialogue !== undefined) {
    if (!Array.isArray(rawDialogue)) throw new ToolError("dialogue는 {when?,text}[] 배열이어야 합니다.", { code: "villager-dialogue" });
    rawDialogue.forEach((entry, index) => {
      const page = dialoguePageFromRecord(entry, index, warnings);
      if (page) pages.push(page);
    });
  }
  if (pages.length === 1) {
    for (const activity of activityLabels(schedule)) {
      pages.push({ conditions: [{ kind: "npcActivity", activity }], lines: [defaultActivityLine(activity)] });
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
  if (record.hourRange !== undefined) warnings.push(`${label}.hourRange는 이벤트 페이지 조건으로 직접 표현되지 않아 무시됩니다.`);
  if (record.dayRange !== undefined) warnings.push(`${label}.dayRange는 이벤트 페이지 조건으로 직접 표현되지 않아 무시됩니다.`);
  return conditions;
}

function activityLabels(schedule: readonly NpcScheduleEntry[]): string[] {
  return [...new Set(schedule.map((entry) => entry.activity).filter((activity): activity is string => typeof activity === "string" && activity.trim().length > 0))];
}

function defaultActivityLine(activity: string): string {
  switch (activity) {
    case "home":
      return "집에서 쉬는 중이야.";
    case "work":
      return "일하는 중이야.";
    default:
      return `${activity} 중이야.`;
  }
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
  description: "두 맵 사이 양방향 출입구를 원자적으로 생성한다. 착지점은 상대 출입구에 인접한 통행 가능 칸으로 자동 선정(즉시 재전이 방지).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      a: { type: "object", description: "{mapId,x,y} 출입구 A" },
      b: { type: "object", description: "{mapId,x,y} 출입구 B" },
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
    const landingB = passableLanding(draft, mapB, b.x, b.y);
    const landingA = passableLanding(draft, mapA, a.x, a.y);
    if (!landingB || !landingA) throw new ToolError("출입구 인접에 통행 가능한 착지 칸이 없습니다.", { code: "transfer-no-landing" });
    // 즉시 재전이 방지: 착지 칸이 상대 출입구 좌표와 겹치면 error.
    if (landingB.x === b.x && landingB.y === b.y) throw new ToolError("A→B 착지가 B 출입구와 겹칩니다.", { code: "transfer-retrigger" });
    if (landingA.x === a.x && landingA.y === a.y) throw new ToolError("B→A 착지가 A 출입구와 겹칩니다.", { code: "transfer-retrigger" });

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
    upsertEventIntoMap(mapA, gate(idA, a.x, a.y, transferTo(b.mapId, landingB.x, landingB.y)));
    upsertEventIntoMap(mapB, gate(idB, b.x, b.y, transferTo(a.mapId, landingA.x, landingA.y)));
    return {
      summary: `출입구 쌍 생성: ${mapA.name}(${a.x},${a.y}) ↔ ${mapB.name}(${b.x},${b.y})`,
      data: { eventIdA: idA, eventIdB: idB, landingA, landingB },
    };
  },
};

const placeBattleBlocker: ToolDefinition = {
  name: "place_battle_blocker",
  description: "전투 블로커를 배치한다(전투 페이지 + 승리 후 투명 페이지). clearSwitchId로 재전투를 막는다.",
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
      victoryItems: { type: "array", description: "[{itemId,amount}] 승리 보상", items: { type: "object" } },
      graphic: { type: "object", description: "{query} | {textureKey,characterIndex}" },
      id: { type: "string" },
    },
    required: ["mapId", "x", "y", "troopId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const x = args.x as number;
    const y = args.y as number;
    const troopId = args.troopId as string;
    if (!inMapBounds(map, x, y)) throw new ToolError(`블로커 위치가 맵 밖입니다: (${x}, ${y})`, { mapId: map.id, x, y });
    if (!draft.database.troops.some((troop) => troop.id === troopId)) {
      throw new ToolError(`존재하지 않는 troopId: ${troopId} — 허용 예시: ${knownIds(draft.database.troops)}`, { code: "troop-not-found", mapId: map.id, x, y });
    }
    const id = (args.id as string | undefined) ?? genId("ev_battle");
    const clearSwitchId = (args.clearSwitchId as string | undefined) ?? `sw_${id}_clear`;
    ensureNamedSwitch(draft, clearSwitchId, `전투 완료: ${id}`);
    const intro = (args.intro as string[] | undefined) ?? ["적이 앞을 가로막았다!"];
    const victory = (args.victory as string[] | undefined) ?? ["길이 열렸다."];
    const victoryItems = (args.victoryItems as Array<{ itemId: string; amount: number }> | undefined) ?? [];
    const graphic = resolveGraphic(args.graphic as GraphicSpec | undefined);

    const fightCommands: Command[] = [
      ...intro.map((body): Command => ({ kind: "text", body })),
      { kind: "battleProcessing", troopId, canEscape: true, canLose: false },
      { kind: "setSwitch", switchId: clearSwitchId, value: true },
      ...victoryItems.map((entry): Command => ({ kind: "changeItem", itemId: entry.itemId, op: "+=", amount: entry.amount })),
      ...victory.map((body): Command => ({ kind: "text", body })),
    ];
    const event: GameEvent = {
      id,
      x,
      y,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: `${id}_fight`,
          name: "전투",
          conditions: [],
          graphic,
          trigger: { kind: "action" },
          priority: "same",
          overlapForbidden: true,
          movement: PASSIVE,
          commands: fightCommands,
        },
        {
          id: `${id}_cleared`,
          name: "정리된 자리",
          conditions: [{ kind: "switch", switchId: clearSwitchId, value: true }],
          graphic: { transparent: true },
          trigger: { kind: "action" },
          priority: "below",
          overlapForbidden: false,
          movement: PASSIVE,
          commands: [],
        },
      ],
    };
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    return { summary: `${map.name}에 전투 블로커 '${troopId}' 배치 (${x}, ${y})`, data: { eventId: id, clearSwitchId } };
  },
};

const placeTrap: ToolDefinition = {
  name: "place_trap",
  description:
    "즉사 트랩 이벤트를 배치한다. at:{x,y} 또는 cells:[{x,y}]를 받으며 trigger는 touch/action. respawnCheckpoint=true면 맵 진입 auto 체크포인트 이벤트를 추가한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      at: { type: "object", description: "{x,y} 단일 좌표" },
      cells: { type: "array", description: "{x,y}[] 여러 좌표", items: { type: "object" } },
      trigger: { type: "string", enum: ["touch", "action"] },
      message: { type: "string" },
      respawnCheckpoint: { type: "boolean" },
      graphic: { type: "object", description: "선택 그래픽 {query} 또는 {textureKey,characterIndex}. 생략 시 투명." },
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
    for (const [index, cell] of cells.entries()) {
      const id = cells.length === 1 ? genId(idPrefix) : genId(`${idPrefix}_${index + 1}`);
      const event = trapEvent(id, cell.x, cell.y, trigger, graphic, typeof args.message === "string" ? args.message : undefined);
      assertEventShape(event);
      upsertEventIntoMap(map, event);
      eventIds.push(id);
    }
    const checkpointEventId = args.respawnCheckpoint === true ? ensureMapCheckpointEvent(map) : undefined;
    return {
      summary: `${map.name}에 즉사 트랩 ${eventIds.length}개 배치${checkpointEventId ? ` — 진입 체크포인트 ${checkpointEventId}` : ""}`,
      data: { eventIds, checkpointEventId },
    };
  },
};

const makeChaseScene: ToolDefinition = {
  name: "make_chase_scene",
  description:
    "장애물을 우회하는 실시간 추격자 이벤트를 만든다. chaser.at/graphic/speed/sightRange를 받고, killOnTouch면 eventTouch에서 killPlayer를 실행한다. safeZone은 map.safeZones에 추가하며, activateSwitch가 있으면 해당 스위치 ON 페이지에서만 추격한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      chaser: { type: "object", description: "{at:{x,y},graphic,speed?,sightRange?}" },
      killOnTouch: { type: "boolean" },
      safeZone: { type: "object", description: "{x,y,w,h}" },
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
    const graphic = resolveGraphic(chaser.graphic as GraphicSpec | undefined);
    const id = genId("ev_chaser");
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
      x: chaser.at.x,
      y: chaser.at.y,
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
          },
          commands,
        },
      ],
    };
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    const checkpointEventId = args.checkpointOnEntry === true ? ensureMapCheckpointEvent(map) : undefined;
    return {
      summary: `${map.name}에 추격자 '${id}' 생성 (${chaser.at.x}, ${chaser.at.y})${safeZone ? " — 안전지대 추가" : ""}${checkpointEventId ? ` — 진입 체크포인트 ${checkpointEventId}` : ""}`,
      data: { eventId: id, safeZone, activateSwitch, checkpointEventId },
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

function ensureMapCheckpointEvent(map: GameMap): string {
  const existing = map.events.find((event) => event.id === `${map.id}_checkpoint_auto`);
  if (existing) return existing.id;
  const id = `${map.id}_checkpoint_auto`;
  map.events.push({
    id,
    x: 0,
    y: 0,
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
  description: "이벤트를 다른 맵/좌표로 복제한다.",
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
    const clone: GameEvent = { ...structuredClone(source), id: newId, x: args.x as number, y: args.y as number };
    upsertEventIntoMap(toMap, clone);
    return { summary: `이벤트 '${args.eventId}' → '${newId}' (${toMap.name})`, data: { eventId: newId } };
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
  description: "이벤트를 같은 맵 내 다른 좌표로 옮긴다.",
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
    const x = args.x as number;
    const y = args.y as number;
    if (!inMapBounds(map, x, y)) throw new ToolError(`이동 위치가 맵 밖입니다: (${x}, ${y})`, { mapId: map.id, x, y });
    event.x = x;
    event.y = y;
    return { summary: `이벤트 '${args.eventId}' → (${x}, ${y})` };
  },
};

function triggerFromArg(value: unknown): Trigger {
  switch (value) {
    case "auto":
      return { kind: "auto" };
    case "parallel":
      return { kind: "parallel" };
    case "action":
    case undefined:
    case null:
      return { kind: "action" };
    default:
      throw new ToolError("trigger는 action, auto, parallel 중 하나여야 합니다.", { code: "cutscene-trigger" });
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
  commands: Command[]
): EventPage {
  return {
    id: pageId,
    name,
    conditions: [],
    graphic: { transparent: true },
    trigger,
    priority: "below",
    overlapForbidden: false,
    animationType: "fixedGraphic",
    movement: PASSIVE,
    commands,
  };
}

const scriptCutscene: ToolDefinition = {
  name: "script_cutscene",
  description:
    "한 장면 컷신을 beat 타임라인으로 작성해 이벤트 페이지로 추가한다. beat 종류: " +
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
      trigger: { type: "string", enum: ["action", "auto", "parallel"], description: "기본 action" },
      beats: { type: "array", description: "CutsceneBeat[]", items: { type: "object" } },
      skippable: { type: "boolean", description: "true면 컷신 잠금 중 Esc 두 번으로 cutscene_end 라벨로 점프" },
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
    const beats = args.beats as CutsceneBeat[];
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
    const page = cutscenePage(`${eventId}_cutscene_${(existing?.pages?.length ?? 0) + 1}`, "컷신", trigger, commands);
    const outcome = existing ? "modified" : "added";
    let event: GameEvent;
    if (existing) {
      existing.pages = [...(existing.pages ?? []), page];
      event = existing;
    } else {
      const pos = cutsceneEventPosition(draft, map, args);
      event = { id: eventId, x: pos.x, y: pos.y, trigger, commands: [], pages: [page] };
      map.events.push(event);
    }
    assertEventShape(event);
    const unsupportedCommands = countLimitedRuntimeSupportCommandsForEvent(event);
    return {
      summary: `${map.name}에 컷신 '${eventId}' ${outcome === "added" ? "생성" : "페이지 추가"} — beat ${beats.length}개, 명령 ${commands.length}개, 미지원 커맨드 ${unsupportedCommands}건`,
      data: { eventId, pageId: page.id, commandCount: commands.length, unsupportedCommands },
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
  makeChaseScene,
  duplicateEvent,
  removeEvent,
  moveEvent,
  scriptCutscene,
];
