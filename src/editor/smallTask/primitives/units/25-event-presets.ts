import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { newCommand } from "@/editor/eventCommandFactory";
import { displayText } from "@/editor/smallTask/target";
import { assertEventShape, placeChest, resolveEventPlacement, resolveTransferEndpoint } from "@/editor/tools/eventTools";
import { compileSimplePage, PASSIVE_MOVEMENT, resolveGraphic, usedCharsetGraphicKeysOnMap } from "@/editor/tools/eventCompile";
import { inMapBounds, type Point } from "@/editor/tools/mapHelpers";
import { ToolError, type JsonSchema } from "@/editor/tools/types";
import { fieldBoolean } from "@/player/interpreter/m2RuntimeFields";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { canMove, canMoveFootprint, isPassable, isPassableLanding } from "@/project/collision";
import { doorstepArrival } from "@/project/doorEntries";
import { GOLD_MAX } from "@/project/economyValues";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { footprintContains, normalizeCharacterFootprint, rectCells } from "@/project/footprint";
import { kitDoorOpenCommands } from "@/project/kitDoors";
import { playerBodyRect, playerPassageRect, resolvePlayerBody } from "@/project/playerFootprint";
import { findBlockingEventOverlappingRect } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { isSpatialPlacementBlocking } from "@/project/spatialOccupancy";
import type { Command, Condition, Dir, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { josa, roJosa } from "@/util/josa";
import { jsonEqual } from "@/util/structuralJson";
import { PrimitiveError, SELECT_EVENT_PAGE } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "25-event-presets";

type Args = Record<string, unknown>;
type TileScope = Extract<SmallTaskScope, { kind: "tileEvent" }>;

function selectedMap(project: Project, mapId: string): GameMap {
  const map = Object.hasOwn(project.maps, mapId) ? project.maps[mapId] : undefined;
  if (!map || map.id !== mapId) throw new PrimitiveError("선택한 맵을 찾을 수 없어요.");
  return map;
}

function placementScope({ project, target, selection }: PrimitiveContext): TileScope {
  if (target.kind !== "map") throw new PrimitiveError("범위 밖이에요. 맵에서 배치할 칸을 골라 주세요.");
  const map = selectedMap(project, target.mapId);
  const rect = selection?.rect;
  if (!rect || rect.w !== 1 || rect.h !== 1 || !Number.isInteger(rect.x) || !Number.isInteger(rect.y)
    || !inMapBounds(map, rect.x, rect.y)) {
    throw new PrimitiveError("범위 밖이에요. 맵 안에서 배치할 칸 하나를 골라 주세요.");
  }
  return { kind: "tileEvent", mapId: map.id, x: rect.x, y: rect.y, eventId: null };
}

function selectedEvent({ project, target }: PrimitiveContext): { map: GameMap; event: GameEvent; page?: EventPage } {
  if (target.kind !== "event") throw new PrimitiveError("범위 밖이에요. 바꿀 이벤트를 골라 주세요.");
  const map = selectedMap(project, target.mapId);
  const events = map.events.filter(candidate => candidate.id === target.eventId);
  const event = events[0];
  if (events.length !== 1 || !event || event.x !== target.x || event.y !== target.y
    || !Number.isInteger(event.x) || !Number.isInteger(event.y) || !inMapBounds(map, event.x, event.y)) {
    throw new PrimitiveError("범위 밖이에요. 이벤트를 다시 선택해 주세요.");
  }
  if (target.pageId === undefined) return { map, event };
  const pages = event.pages?.filter(page => page.id === target.pageId);
  if (pages?.length !== 1) throw new PrimitiveError("범위 밖이에요. 이벤트 페이지를 다시 선택해 주세요.");
  return { map, event, page: pages[0] };
}

function selectedStockEvent(ctx: PrimitiveContext) {
  const selected = selectedEvent(ctx);
  if (selected.page) return selected;
  const pages = selected.event.pages;
  if (pages && pages.length > 1) throw new PrimitiveError(SELECT_EVENT_PAGE);
  return { ...selected, page: pages?.[0] };
}

function eventScope(map: GameMap, event: GameEvent): TileScope {
  return { kind: "tileEvent", mapId: map.id, x: event.x, y: event.y, eventId: event.id };
}

function tileOccupied(map: GameMap, { x, y }: Point): boolean {
  return map.events.some(event => (event.x === x && event.y === y) || event.pages?.some(page =>
    footprintContains(event.x, event.y, normalizeCharacterFootprint(page.footprint), x, y)));
}

function blankTile(ctx: PrimitiveContext): { map: GameMap; at: Point } {
  const { mapId, x, y } = placementScope(ctx);
  const map = ctx.project.maps[mapId];
  const at = { x, y };
  if (tileOccupied(map, at)) {
    throw new PrimitiveError("선택한 칸에 이미 이벤트가 있어요.");
  }
  return { map, at };
}

function eventId(project: Project, kind: string, at: Point): string {
  const ids = new Set(Object.values(project.maps).flatMap(map => map.events.map(event => event.id)));
  const base = `ev_preset_${kind}_${at.x}_${at.y}`;
  let id = base;
  for (let suffix = 2; ids.has(id) || Object.hasOwn(project.session.selfSwitches ?? {}, id); suffix++) {
    id = `${base}_${suffix}`;
  }
  return id;
}

function appendEvent(project: Project, map: GameMap, event: GameEvent): Project {
  return {
    ...project,
    maps: { ...project.maps, [map.id]: { ...map, events: [...map.events, event] } },
  };
}

function replaceEvent(project: Project, map: GameMap, event: GameEvent, edited: GameEvent): Project {
  const events = map.events.map(candidate => candidate === event ? edited : candidate);
  return { ...project, maps: { ...project.maps, [map.id]: { ...map, events } } };
}

function goods(project: Project, itemId: unknown) {
  const record = project.database.items.find(item => item.id === itemId)
    ?? project.database.equipment.find(item => item.id === itemId);
  if (!record) throw new PrimitiveError("자료집에서 해당 아이템이나 장비를 찾을 수 없어요.");
  return record;
}

function textArg(value: string, error: string): string {
  const text = value.trim();
  if (!text) throw new PrimitiveError(error);
  return text;
}

function label(value: string, fallback: string): string {
  const text = displayText(value.replace(/[{}\[\]]/gu, " "), fallback);
  return text.length <= 36 ? text : text.slice(0, 35) + "…";
}

function recordLabel(record: { id: string; name: string }, fallback: string): string {
  return label(record.id === record.name ? "" : record.name, fallback);
}

const schema = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({
  type: "object", properties, required, additionalProperties: false,
});
const itemSchema: JsonSchema = { type: "string", minLength: 1, description: "자료집에서 선택한 아이템이나 장비" };
// The persisted shop command uses a lower maximum than the player's gold balance.
const SHOP_PRICE_MAX = 999_999;

function assertFixedPlacement(
  project: Project, map: GameMap, at: Point, kind: "character" | "interaction", name: string, failure: string,
): void {
  try {
    const placement = resolveEventPlacement(project, map, at.x, at.y, { kind, label: name, code: "preset-impassable" });
    if (placement.adjusted) throw new PrimitiveError(failure);
  } catch (error) {
    if (error instanceof ToolError) throw new PrimitiveError(failure);
    throw error;
  }
}

const npc: SmallTaskPrimitive = {
  id: "event.npc.place",
  unit: UNIT,
  title: "주민 놓기",
  covers: { tools: ["place_npc"] },
  targets: ["map"],
  args: schema({
    name: { type: "string", minLength: 1, maxLength: 60, description: "주민 이름이나 역할" },
    dialogue: { type: "string", minLength: 1, maxLength: 500, description: "말을 걸 때 들려줄 대사. 생략하면 인사해요." },
  }, ["name"]),
  scope: placementScope,
  describe(_ctx, args) {
    const name = label(args.name as string, "주민");
    return `선택한 칸에 주민 「${name}」${josa(name, "을/를")} 놓아요.`;
  },
  apply(ctx, args) {
    const name = textArg(args.name as string, "주민 이름을 적어 주세요.");
    const line = textArg((args.dialogue as string | undefined) ?? `${name}입니다. 안녕하세요.`, "주민이 말할 대사를 적어 주세요.");
    const { project } = ctx;
    const { map, at } = blankTile(ctx);
    assertFixedPlacement(project, map, at, "character", name, "범위 밖이에요. 선택한 칸에 주민을 세울 수 없어요.");
    const id = eventId(project, "npc", at);
    let graphic: ReturnType<typeof resolveGraphic>;
    try {
      graphic = resolveGraphic({ query: "villager" }, {
        seed: `${map.id}:${name}:${at.x},${at.y}`,
        overrides: project.charsetLabels,
        avoidKeys: usedCharsetGraphicKeysOnMap(map),
      });
    } catch (error) {
      if (error instanceof ToolError) throw new PrimitiveError("주민 외형을 찾을 수 없어요.");
      throw error;
    }
    const page = compileSimplePage(`${id}_p0`, name, { lines: [line] }, graphic, { movement: PASSIVE_MOVEMENT });
    const event: GameEvent = { ...at, id, name, placementRole: "npc", trigger: page.trigger, commands: [], pages: [page] };
    assertEventShape(event);
    return appendEvent(project, map, event);
  },
};

const chest: SmallTaskPrimitive = {
  id: "event.chest.place",
  unit: UNIT,
  title: "보물상자 놓기",
  covers: { tools: ["place_chest"] },
  targets: ["map"],
  args: schema({
    itemId: itemSchema,
    count: { type: "integer", minimum: 1, maximum: 99, description: "아이템 개수. 생략하면 한 개예요." },
    gold: { type: "integer", minimum: 1, maximum: GOLD_MAX, description: "함께 넣을 돈의 양. 아이템 없이 돈만 넣을 수도 있어요." },
  }),
  scope: placementScope,
  describe(ctx, args) {
    const item = args.itemId === undefined ? "" : `${recordLabel(goods(ctx.project, args.itemId), "아이템")} ${args.count ?? 1}개`;
    if (args.gold === undefined) return `${item}를 담은 보물상자를 놓아요.`;
    const money = `금화 ${args.gold}닢`;
    return `${item ? `${item}와 ` : ""}${money}을 담은 보물상자를 놓아요.`;
  },
  apply(ctx, args) {
    const { itemId, count, gold } = args;
    if (itemId === undefined && (count !== undefined || gold === undefined)) {
      throw new PrimitiveError("상자에 넣을 아이템이나 돈을 정해 주세요.");
    }
    if (itemId !== undefined) goods(ctx.project, itemId);
    const { project } = ctx;
    const { map, at } = blankTile(ctx);
    const failure = "선택한 칸에 보물상자를 놓을 수 없어요. 조사할 수 있는 다른 칸을 골라 주세요.";
    const id = eventId(project, "chest", at);
    // The existing tool can relocate the chest and displace an auto-inspect event.
    // Take only the new chest, and only when it stayed on the selected tile.
    const draftMap = { ...map, events: map.events.slice() };
    const draft = { ...project, maps: { ...project.maps, [map.id]: draftMap } };
    try {
      placeChest.run(draft, { mapId: map.id, ...at, id, contents: { itemId, count, gold } });
    } catch (error) {
      if (error instanceof ToolError) throw new PrimitiveError(failure);
      throw error;
    }
    const event = draftMap.events.find(candidate => candidate.id === id);
    if (!event || event.x !== at.x || event.y !== at.y) throw new PrimitiveError(failure);
    return appendEvent(project, map, event);
  },
};

function stockPrimitive(change: "add" | "remove"): SmallTaskPrimitive {
  const adding = change === "add";
  return {
    id: `event.shop.${adding ? "addStock" : "removeStock"}`,
    unit: UNIT,
    title: adding ? "상점 상품 추가" : "상점 상품 빼기",
    covers: { tools: ["set_shop_stock"] },
    targets: ["event"],
    args: schema({
      itemId: itemSchema,
      ...(adding ? { price: { type: "integer", minimum: 0, maximum: SHOP_PRICE_MAX, description: "기본 판매가(0~999,999골드). 새 상품의 가격을 생략하면 자료집 가격을 사용해요." } } : {}),
    }, ["itemId"]),
    scope(ctx) {
      const { map, event, page } = selectedStockEvent(ctx);
      return page ? { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id } : eventScope(map, event);
    },
    describe(ctx, args) {
      const name = recordLabel(goods(ctx.project, args.itemId), "상품");
      if (!adding) return `상점에서 「${name}」${josa(name, "을/를")} 빼요.`;
      if (args.price === undefined) return `상점에 「${name}」${josa(name, "을/를")} 진열해요.`;
      return `상점에 「${name}」${josa(name, "을/를")} 기본 판매가 ${args.price}골드로 진열해요.`;
    },
    apply(ctx, args) {
      const item = goods(ctx.project, args.itemId);
      const { map, event, page } = selectedStockEvent(ctx);
      const price = args.price as number | undefined;
      const commands = structuredClone(page?.commands ?? event.commands);
      const shops = commandsOfKind(commands, "shop");
      if (!shops.length) throw new PrimitiveError("선택한 곳에서 상점을 찾을 수 없어요.");
      let changed = false;
      for (const shop of shops) {
        const before = { itemIds: shop.itemIds, stock: shop.stock };
        editStock(shop, item.id, adding, price);
        if (jsonEqual(before, { itemIds: shop.itemIds, stock: shop.stock })) continue;
        assertStockSurvivesReload(shop);
        changed = true;
      }
      if (!changed) throw new PrimitiveError(adding ? "이미 같은 설정으로 파는 상품이에요." : "이 상점에서 팔고 있는 상품이 아니에요.");
      const edited = page
        ? { ...event, pages: event.pages!.map(candidate => candidate === page ? { ...page, commands } : candidate) }
        : { ...event, commands };
      return replaceEvent(ctx.project, map, event, edited);
    },
  };
}

function commandsOfKind<K extends Command["kind"]>(commands: readonly Command[], kind: K): Extract<Command, { kind: K }>[] {
  const found: Extract<Command, { kind: K }>[] = [];
  function visit(list: readonly Command[]): void {
    for (const command of list) {
      if (command.kind === kind) found.push(command as Extract<Command, { kind: K }>);
      for (const branch of nestedCommandLists(command)) visit(branch);
    }
  }
  visit(commands);
  return found;
}

function editStock(shop: Extract<Command, { kind: "shop" }>, itemId: string, adding: boolean, price?: number): void {
  if (!adding) {
    shop.itemIds = shop.itemIds.filter(id => id !== itemId);
    if (shop.stock) shop.stock = shop.stock.filter(entry => entry.itemId !== itemId);
    return;
  }
  const stock = shop.stock ?? (price === undefined ? undefined : shop.itemIds.map(id => ({ itemId: id })));
  if (!shop.itemIds.includes(itemId)) shop.itemIds = [...shop.itemIds, itemId];
  if (!stock) return;
  if (!stock.some(entry => entry.itemId === itemId)) {
    shop.stock = [...stock, { itemId, ...(price === undefined ? {} : { priceOverride: price }) }];
  } else if (price !== undefined) {
    shop.stock = stock.map(entry => entry.itemId === itemId ? { ...entry, priceOverride: price } : entry);
  }
}

function assertStockSurvivesReload({ itemIds, stock }: Extract<Command, { kind: "shop" }>): void {
  if (!stock) return;
  const ids = new Set(itemIds);
  // Loading drops orphaned rows and falls back to itemIds if no explicit rows remain.
  if ((stock.length === 0 && ids.size > 0) || stock.some(entry => !ids.has(entry.itemId))) {
    throw new PrimitiveError("상점의 상품 목록과 진열 설정이 서로 달라요. 상점 편집기에서 목록을 확인해 주세요.");
  }
}

const sign: SmallTaskPrimitive = {
  id: "event.sign.place",
  unit: UNIT,
  title: "표지판 놓기",
  covers: { tools: ["place_sign"] },
  targets: ["map"],
  args: schema({
    text: { type: "string", minLength: 1, maxLength: 500, description: "표지판을 조사할 때 읽는 문구" },
  }, ["text"]),
  scope: placementScope,
  describe: (_ctx, args) => `「${label(args.text as string, "안내")}」라고 적힌 표지판을 놓아요.`,
  apply(ctx, args) {
    const text = textArg(args.text as string, "표지판에 적을 글을 입력해 주세요.");
    const { map, at } = blankTile(ctx);
    assertFixedPlacement(ctx.project, map, at, "interaction", "표지판", "범위 밖이에요. 선택한 칸에서 표지판을 읽을 수 없어요.");
    const id = eventId(ctx.project, "sign", at);
    const graphic = resolveGraphic({ textureKey: "tex_easyrpg_charset_object1", characterIndex: 0 });
    const page = compileSimplePage(`${id}_p0`, "표지판", {}, graphic, { movement: PASSIVE_MOVEMENT });
    page.commands = [{ kind: "text", body: text }];
    const event: GameEvent = { ...at, id, name: "표지판", trigger: page.trigger, commands: [], pages: [page] };
    assertEventShape(event);
    return appendEvent(ctx.project, map, event);
  },
};

const destinationFields = {
  toMapId: { type: "string", minLength: 1, description: "도착할 맵" },
  toX: { type: "integer", minimum: 0, description: "도착 칸의 가로 좌표. 왕복이면 반대편 출입구의 가로 좌표." },
  toY: { type: "integer", minimum: 0, description: "도착 칸의 세로 좌표. 왕복이면 반대편 출입구의 세로 좌표." },
} satisfies Record<string, JsonSchema>;

function destination(project: Project, args: Args): { map: GameMap; at: Point } {
  const id = args.toMapId as string;
  const map = Object.hasOwn(project.maps, id) ? project.maps[id] : undefined;
  if (!map || map.id !== id) throw new PrimitiveError("도착할 맵을 찾을 수 없어요.");
  const at = { x: args.toX as number, y: args.toY as number };
  if (!Number.isInteger(at.x) || !Number.isInteger(at.y) || !inMapBounds(map, at.x, at.y)) {
    throw new PrimitiveError("도착 칸이 맵 범위 밖이에요.");
  }
  return { map, at };
}

function assertGatePlacement(project: Project, map: GameMap, at: Point): void {
  const failure = "선택한 칸에 출입구를 놓을 수 없어요. 걸어서 닿을 수 있는 다른 칸을 골라 주세요.";
  try {
    const endpoint = resolveTransferEndpoint(project, map, { ...at, exact: true }, "A", []);
    if (!endpoint || endpoint.gate.x !== at.x || endpoint.gate.y !== at.y) throw new PrimitiveError(failure);
  } catch (error) {
    if (error instanceof ToolError) throw new PrimitiveError(failure);
    throw error;
  }
}

function hasWalkableLanding(
  project: Project, from: { map: GameMap; at: Point }, { map, at }: { map: GameMap; at: Point },
): boolean {
  const sameMap = from.map === map;
  if ((sameMap && from.at.x === at.x && from.at.y === at.y) || tileOccupied(map, at)
    || !isPassableLanding(project, map, at.x, at.y)
    || (!sameMap && doorstepArrival(project, map, at.x, at.y, from.map.id)?.moved)) return false;

  const session = startSession(project);
  session.currentMapId = map.id;
  session.x = at.x;
  session.y = at.y;
  const body = resolvePlayerBody(project, session);
  const canStand = (x: number, y: number): boolean => {
    const bounds = playerBodyRect(body, x, y);
    if (!inMapBounds(map, bounds.left, bounds.top) || !inMapBounds(map, bounds.right, bounds.bottom)) return false;
    const passage = playerPassageRect(body, x, y);
    return rectCells(passage).every(cell => isPassable(project, map, cell.x, cell.y))
      && !findBlockingEventOverlappingRect(project, map, session, {}, passage)
      && !isSpatialPlacementBlocking(project, session, map.id, passage);
  };
  return canStand(at.x, at.y) && ORTHOGONAL_STEPS.some(([, dx, dy]) => {
    const x = at.x + dx;
    const y = at.y + dy;
    if (sameMap && from.at.x === x && from.at.y === y) return false;
    return canMoveFootprint(project, map, at.x, at.y, body.footprint, x, y, body.passRows) && canStand(x, y);
  });
}

function transferLeg(
  project: Project, from: { map: GameMap; at: Point }, to: { map: GameMap; at: Point },
): Project {
  const { map, at } = from;
  const id = eventId(project, "transfer", at);
  const trigger = { kind: "playerTouch" } as const;
  const defaults = newCommand("transfer") as Extract<Command, { kind: "transfer" }>;
  const transfer = { ...defaults, mapId: to.map.id, ...to.at };
  const event: GameEvent = {
    ...at, id, name: "출입구", trigger, commands: [],
    pages: [{
      id: `${id}_page`, name: "출입구", conditions: [], graphic: { transparent: true },
      trigger, priority: "below", overlapForbidden: false, movement: PASSIVE_MOVEMENT,
      commands: [...kitDoorOpenCommands(project, map, at), transfer],
    }],
  };
  assertEventShape(event);
  return appendEvent(project, map, event);
}

const transfer: SmallTaskPrimitive = {
  id: "event.transfer.place",
  unit: UNIT,
  title: "편도 출입구 놓기",
  covers: { tools: ["create_transfer_pair"] },
  targets: ["map"],
  args: schema(destinationFields, ["toMapId", "toX", "toY"]),
  scope: placementScope,
  describe(ctx, args) {
    const place = recordLabel(destination(ctx.project, args).map, "목적지");
    return `「${place}」${roJosa(place)} 가는 출입구를 놓아요.`;
  },
  apply(ctx, args) {
    const { project } = ctx;
    const from = blankTile(ctx);
    const to = destination(project, args);
    if (!hasWalkableLanding(project, from, to)) {
      throw new PrimitiveError("도착할 수 있는 빈 칸을 골라 주세요. 주인공이 정확히 도착해 걸어서 나갈 수 있어야 해요.");
    }
    assertGatePlacement(project, from.map, from.at);
    return transferLeg(project, from, to);
  },
};

const pair: SmallTaskPrimitive = {
  id: "event.transfer.placePair",
  unit: UNIT,
  title: "왕복 출입구 놓기",
  covers: { tools: ["create_transfer_pair"] },
  targets: ["map"],
  args: schema(destinationFields, ["toMapId", "toX", "toY"]),
  scope: refuseTransferPair,
  describe(ctx, args) {
    const place = recordLabel(destination(ctx.project, args).map, "목적지");
    return `「${place}」${josa(place, "와/과")} 오가는 출입구를 놓아요.`;
  },
  apply: refuseTransferPair,
};

function refuseTransferPair(): never {
  throw new PrimitiveError("범위 밖이에요. 왕복 출입구는 두 곳을 고치는 일이에요. 한쪽씩 놓아 주세요.");
}

const lock: SmallTaskPrimitive = {
  id: "event.door.setLock",
  unit: UNIT,
  title: "문에 잠금 달기",
  covers: { tools: ["set_door_lock"] },
  targets: ["event"],
  args: schema({
    itemId: { type: "string", minLength: 1, description: "문을 여는 데 필요한 아이템. 스위치와 둘 중 하나를 골라요." },
    switchId: { type: "string", minLength: 1, description: "켜지면 문이 열리는 스위치. 아이템과 둘 중 하나를 골라요." },
    text: { type: "string", minLength: 1, maxLength: 200, description: "문이 잠겼을 때 표시할 글. 생략하면 잠겼다는 안내가 나와요." },
  }),
  scope(ctx) {
    const { map, event } = selectedDoor(ctx);
    return eventScope(map, event);
  },
  describe(ctx, args) {
    if (args.itemId !== undefined) {
      const item = ctx.project.database.items.find(record => record.id === args.itemId);
      if (item) {
        const name = recordLabel(item, "열쇠");
        return `「${name}」${josa(name, "이/가")} 있어야 문이 열리게 해요.`;
      }
    }
    const entry = ctx.project.switches.find(record => record.id === args.switchId);
    const name = entry ? recordLabel(entry, "선택한 스위치") : "선택한 스위치";
    return `「${name}」${josa(name, "이/가")} 켜져야 문이 열리게 해요.`;
  },
  apply(ctx, args) {
    const { project } = ctx;
    const { itemId, switchId } = args as { itemId?: string; switchId?: string };
    if ((itemId === undefined) === (switchId === undefined)) {
      throw new PrimitiveError("문을 열 아이템이나 스위치를 하나 골라 주세요.");
    }
    if (itemId !== undefined && !project.database.items.some(item => item.id === itemId)) {
      throw new PrimitiveError("문을 열 아이템을 찾을 수 없어요.");
    }
    if (switchId !== undefined && !project.switches.some(entry => entry.id === switchId)) {
      throw new PrimitiveError("문을 열 스위치를 찾을 수 없어요.");
    }
    const { map, event } = selectedDoor(ctx);
    const pages = event.pages ?? [];
    const doors = pages.filter(page => page.commands.some(command => command.kind === "transfer"));
    const otherCommands = pages.map(page => page.commands.filter(command => command.kind !== "transfer"));
    if (transferDestinations(project, map, [event.commands, ...otherCommands]).size) {
      throw new PrimitiveError("이 문은 분기, 다른 이벤트 호출, 페이지 밖 명령 등으로도 이동할 수 있어요. 이벤트 편집기에서 잠금 조건을 달아 주세요.");
    }
    if (doors.length === 0) {
      throw new PrimitiveError("선택한 이벤트에서 이동하는 문을 찾을 수 없어요.");
    }
    if (doors.some(page => page.trigger.kind === "auto" || page.trigger.kind === "parallel")) {
      throw new PrimitiveError("자동으로 실행되는 이동 이벤트예요. 잠금 안내가 반복될 수 있으니 이벤트 편집기에서 조건을 달아 주세요.");
    }
    const destinations = new Set(doors.flatMap(page => page.commands.flatMap(command =>
      command.kind === "transfer" ? [command.mapId] : [])));
    if (map.events.some(candidate => candidate !== event && Math.abs(candidate.x - event.x) + Math.abs(candidate.y - event.y) <= 1
      && [...transferDestinations(project, map, eventCommandLists(candidate))].some(mapId => mapId === null || destinations.has(mapId)))) {
      throw new PrimitiveError("범위 밖이에요. 붙어 있는 이동 칸도 같은 맵으로 갈 수 있어요. 두 칸을 함께 확인해 주세요.");
    }

    const body = textArg((args.text as string | undefined) ?? "문이 잠겨 있다.", "잠겼을 때 보여 줄 글을 입력해 주세요.");
    const requirement: Condition = itemId === undefined
      ? { kind: "switch", switchId: switchId!, value: true }
      : { kind: "item", itemId, present: true };
    const byId = new Map(pages.map(page => [page.id, page]));
    if (byId.size !== pages.length) throw new PrimitiveError("서로 구분할 수 없는 페이지가 있어 잠금을 달 수 없어요.");
    const retreat = doorRetreat(project, map, event);
    const replacements = new Map<EventPage, EventPage>();
    doors.forEach(door => {
      const commands: Command[] = [{ kind: "text", body }];
      if (retreat && door.trigger.kind === "playerTouch" && door.priority === "below") {
        commands.push({ kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "move", dir: retreat }], repeat: false, wait: true, skippable: true } });
      }
      const locked = lockedPage(door, requirement, commands);
      const previous = byId.get(locked.id);
      if (previous && (pages[pages.indexOf(door) + 1] !== previous || !isPresetLock(door, previous))) {
        throw new PrimitiveError("기존 페이지와 잠금 페이지를 구분할 수 없어요. 이벤트 편집기에서 페이지를 확인해 주세요.");
      }
      replacements.set(door, locked);
    });
    // The last matching page wins. Insert each alternative immediately after its own door page.
    const updated: EventPage[] = [];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]!;
      updated.push(page);
      const locked = replacements.get(page);
      if (!locked) continue;
      updated.push(locked);
      if (pages[i + 1]?.id === locked.id) i++;
    }
    return replaceEvent(project, map, event, { ...event, pages: updated });
  },
};

function selectedDoor(ctx: PrimitiveContext) {
  const selected = selectedEvent(ctx);
  if (selected.page) {
    throw new PrimitiveError("범위 밖이에요. 잠금을 달려면 잠김 페이지를 따로 만들어야 해요. 맵에서 문 이벤트 전체를 골라 주세요.");
  }
  return selected;
}

function eventCommandLists(event: GameEvent): readonly Command[][] {
  return [event.commands, ...(event.pages ?? []).map(page => page.commands)];
}

function transferDestinations(project: Project, map: GameMap, lists: readonly (readonly Command[])[]): Set<string | null> {
  // null means the destination can be chosen or looked up only while playing.
  const destinations = new Set<string | null>();
  const seen = new Set<readonly Command[]>();
  const pending = [...lists];
  while (pending.length) {
    const commands = pending.pop()!;
    if (seen.has(commands)) continue;
    seen.add(commands);
    for (const command of commands) {
      pending.push(...nestedCommandLists(command));
      if (command.kind === "transfer") destinations.add(command.mapId);
      if (command.kind === "script" || command.kind === "runSchedule" || command.kind === "recallParty"
        || (command.kind === "m2Command" && m2CommandById(command.commandId)?.title === "Teleport Menu"
          && (!("transfer" in command.fields) || fieldBoolean(command.fields, "transfer", true)))) {
        destinations.add(null);
      }
      if (command.kind === "callCommonEvent") {
        const called = project.commonEvents.find(event => event.id === command.commonEventId);
        if (called) pending.push(called.commands);
      }
      if (command.kind === "callMapEvent") {
        const called = map.events.find(event => event.id === command.eventId);
        if (called) pending.push(...eventCommandLists(called));
      }
    }
  }
  return destinations;
}

const ORTHOGONAL_STEPS = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]] as const;

function doorRetreat(project: Project, map: GameMap, event: GameEvent): Dir | undefined {
  const open = ORTHOGONAL_STEPS.flatMap(([dir, dx, dy]) => {
    const at = { x: event.x + dx, y: event.y + dy };
    if (!canMove(project, map, event.x, event.y, at.x, at.y) || tileOccupied(map, at)) return [];
    return [{ dir, depth: Math.min(at.x, at.y, map.width - 1 - at.x, map.height - 1 - at.y) }];
  });
  return open.sort((a, b) => b.depth - a.depth)[0]?.dir;
}

function lockedPage(door: EventPage, requirement: Condition, commands: Command[]): EventPage {
  const { commands: _commands, ...settings } = door;
  const page = structuredClone(settings);
  return {
    ...page,
    id: `${door.id}_preset_locked`,
    name: "잠김",
    conditions: [...page.conditions, { kind: "not", condition: structuredClone(requirement) }],
    commands,
  };
}

function isPresetLock(door: EventPage, page: EventPage): boolean {
  const requirement = page.conditions.at(-1);
  const [text, retreat] = page.commands;
  const move = retreat?.kind === "moveEvent" ? retreat.route.moves[0] : undefined;
  const expectedCommands: Command[] = text?.kind === "text" ? [{ kind: "text", body: text.body }] : [];
  if (move?.kind === "move" && retreat?.kind === "moveEvent") {
    const skippable = retreat.route.skippable === true ? { skippable: true } : {};
    expectedCommands.push({ kind: "moveEvent", eventId: "@player", route: { moves: [move], repeat: false, wait: true, ...skippable } });
  }
  return requirement?.kind === "not"
    && ((requirement.condition.kind === "switch" && requirement.condition.value === true)
      || (requirement.condition.kind === "item" && requirement.condition.present === true))
    && text?.kind === "text"
    && jsonEqual(page, lockedPage(door, requirement.condition, expectedCommands));
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  npc, chest, stockPrimitive("add"), stockPrimitive("remove"), transfer, pair, sign, lock,
];
