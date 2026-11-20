import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { newCommand } from "@/editor/eventCommandFactory";
import { displayText } from "@/editor/smallTask/target";
import { assertEventShape, EVENT_TOOLS, resolveEventPlacement, resolveTransferEndpoint } from "@/editor/tools/eventTools";
import { compileSimplePage, PASSIVE_MOVEMENT, resolveGraphic, usedCharsetGraphicKeysOnMap } from "@/editor/tools/eventCompile";
import { LOCK_DOOR_TOOLS } from "@/editor/tools/lockDoorTools";
import { inMapBounds, type Point } from "@/editor/tools/mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition } from "@/editor/tools/types";
import { isPassableLanding } from "@/project/collision";
import { GOLD_MAX } from "@/project/economyValues";
import { findEventCoveringPoint } from "@/project/eventFootprintQuery";
import { kitDoorOpenCommands } from "@/project/kitDoors";
import type { Command, Dir, GameEvent, GameMap, Project } from "@/project/types";
import { josa, roJosa } from "@/util/josa";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "25-event-presets";

type Args = Record<string, unknown>;
type TileScope = Extract<SmallTaskScope, { kind: "tileEvent" }>;

function tileScope({ project, target, selection }: PrimitiveContext): TileScope {
  if (target.kind === "dbEntry") throw new PrimitiveError("범위 밖 요청이에요. 맵에서 대상을 선택해 주세요.");
  const map = project.maps[target.mapId];
  if (!map) throw new PrimitiveError("선택한 맵을 찾을 수 없어요.");
  if (target.kind === "event") {
    const event = map.events.find(candidate => candidate.id === target.eventId);
    if (!event || event.x !== target.x || event.y !== target.y
      || (target.pageId && !event.pages?.some(page => page.id === target.pageId))) {
      throw new PrimitiveError("범위 밖 요청이에요. 이벤트를 다시 선택해 주세요.");
    }
    return { kind: "tileEvent", mapId: map.id, x: event.x, y: event.y, eventId: event.id };
  }
  const rect = selection?.rect;
  if (!rect || rect.w !== 1 || rect.h !== 1 || !Number.isInteger(rect.x) || !Number.isInteger(rect.y)
    || !inMapBounds(map, rect.x, rect.y)) {
    throw new PrimitiveError("범위 밖 요청이에요. 배치할 칸 하나를 선택해 주세요.");
  }
  return { kind: "tileEvent", mapId: map.id, x: rect.x, y: rect.y, eventId: null };
}

function selectedEvent(ctx: PrimitiveContext): GameEvent {
  const scope = tileScope(ctx);
  const event = ctx.project.maps[scope.mapId].events.find(candidate => candidate.id === scope.eventId);
  if (!event) throw new PrimitiveError("범위 밖 요청이에요. 바꿀 이벤트를 선택해 주세요.");
  return event;
}

function blankTile(ctx: PrimitiveContext): { map: GameMap; at: Point } {
  const scope = tileScope(ctx);
  const map = ctx.project.maps[scope.mapId];
  if (findEventCoveringPoint(map.events, scope.x, scope.y)) {
    throw new PrimitiveError("선택한 칸에 이미 이벤트가 있어요.");
  }
  return { map, at: { x: scope.x, y: scope.y } };
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

function legacyDraft(
  project: Project, map: GameMap, tool: ToolDefinition, args: Args, failure: string,
): Project {
  // These tools write events. Give them a private event list and keep the tile arrays shared.
  const draft = { ...project, maps: { ...project.maps, [map.id]: { ...map, events: structuredClone(map.events) } } };
  try {
    tool.run(draft, { mapId: map.id, ...args });
    return draft;
  } catch (error) {
    if (error instanceof ToolError) throw new PrimitiveError(failure);
    throw error;
  }
}

const existingTool = (name: string): ToolDefinition => EVENT_TOOLS.find(tool => tool.name === name)!;
const schema = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({
  type: "object", properties, required, additionalProperties: false,
});
const itemSchema: JsonSchema = { type: "string", minLength: 1, description: "자료집에서 선택한 아이템이나 장비" };

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
  scope: tileScope,
  describe: (_ctx, args) => `선택한 칸에 주민 「${label(args.name as string, "주민")}」을 놓아요.`,
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
  scope: tileScope,
  describe(ctx, args) {
    const item = args.itemId === undefined ? "" : `${recordLabel(goods(ctx.project, args.itemId), "아이템")} ${args.count ?? 1}개`;
    const money = args.gold === undefined ? "" : `돈 ${args.gold}`;
    return `${[item, money].filter(Boolean).join("와 ")}를 담은 보물상자를 놓아요.`;
  },
  apply(ctx, args) {
    const { itemId, count, gold } = args;
    if (itemId === undefined && (count !== undefined || gold === undefined)) {
      throw new PrimitiveError("상자에 넣을 아이템이나 돈을 정해 주세요.");
    }
    if (itemId !== undefined) goods(ctx.project, itemId);
    const { map, at } = blankTile(ctx);
    return legacyDraft(ctx.project, map, existingTool("place_chest"), {
      ...at, id: eventId(ctx.project, "chest", at), contents: { itemId, count, gold },
    }, "선택한 칸에 보물상자를 놓을 수 없어요.");
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
      ...(adding ? { price: { type: "integer", minimum: 0, maximum: GOLD_MAX, description: "직접 지정할 판매 가격. 생략하면 자료집 가격을 사용해요." } } : {}),
    }, ["itemId"]),
    scope: tileScope,
    describe(ctx, args) {
      const name = recordLabel(goods(ctx.project, args.itemId), "상품");
      if (!adding) return `상점에서 「${name}」${josa(name, "을/를")} 빼요.`;
      const price = args.price === undefined ? "" : ` ${args.price}에`;
      return `상점에 「${name}」${josa(name, "을/를")}${price} 진열해요.`;
    },
    apply(ctx, args) {
      const item = goods(ctx.project, args.itemId);
      const event = selectedEvent(ctx);
      const map = ctx.project.maps[tileScope(ctx).mapId];
      return legacyDraft(ctx.project, map, existingTool("set_shop_stock"), {
        eventId: event.id,
        [change]: adding ? [{ itemId: item.id, ...(args.price === undefined ? {} : { priceOverride: args.price }) }] : [item.id],
      }, adding ? "이 이벤트에는 상품을 추가할 수 없어요." : "이 이벤트에서 뺄 상점 상품을 찾을 수 없어요.");
    },
  };
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
  scope: tileScope,
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
  if (!Object.hasOwn(project.maps, id)) throw new PrimitiveError("도착할 맵을 찾을 수 없어요.");
  const map = project.maps[id];
  const at = { x: args.toX as number, y: args.toY as number };
  if (!inMapBounds(map, at.x, at.y)) throw new PrimitiveError("도착 칸이 맵 범위 밖이에요.");
  return { map, at };
}

function gateLanding(project: Project, map: GameMap, at: Point): Point {
  const endpoint = resolveTransferEndpoint(project, map, { ...at, exact: true }, "A", []);
  if (!endpoint || endpoint.gate.x !== at.x || endpoint.gate.y !== at.y) {
    throw new PrimitiveError("이 칸에 닿을 수 있는 출입구를 놓을 수 없어요.");
  }
  return endpoint.landing;
}

function awayFrom(gate: Point, landing: Point): Dir {
  if (gate.x !== landing.x) return gate.x < landing.x ? "right" : "left";
  return gate.y < landing.y ? "down" : "up";
}

function transferLeg(
  project: Project, from: { map: GameMap; at: Point }, to: { map: GameMap; at: Point },
  direction: Dir | "retain" = "retain",
): Project {
  const { map, at } = from;
  const id = eventId(project, "transfer", at);
  const trigger = { kind: "playerTouch" } as const;
  const defaults = newCommand("transfer") as Extract<Command, { kind: "transfer" }>;
  const transfer = { ...defaults, mapId: to.map.id, ...to.at, direction };
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
  scope: tileScope,
  describe(ctx, args) {
    const place = recordLabel(destination(ctx.project, args).map, "목적지");
    return `「${place}」${roJosa(place)} 가는 출입구를 놓아요.`;
  },
  apply(ctx, args) {
    const { project } = ctx;
    const from = blankTile(ctx);
    const to = destination(project, args);
    if ((from.map === to.map && from.at.x === to.at.x && from.at.y === to.at.y)
      || !isPassableLanding(project, to.map, to.at.x, to.at.y)
      || findEventCoveringPoint(to.map.events, to.at.x, to.at.y)) {
      throw new PrimitiveError("도착할 수 있는 빈 칸을 골라 주세요.");
    }
    gateLanding(project, from.map, from.at);
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
  scope(ctx, args) {
    tileScope(ctx);
    destination(ctx.project, args);
    throw new PrimitiveError("범위 밖이에요. 왕복 출입구는 두 곳을 고치는 일이에요.");
  },
  describe(ctx, args) {
    const place = recordLabel(destination(ctx.project, args).map, "목적지");
    return `「${place}」${josa(place, "와/과")} 오가는 출입구를 놓아요.`;
  },
  apply(ctx, args) {
    const { project } = ctx;
    const from = blankTile(ctx);
    const to = destination(project, args);
    if ((from.map === to.map && from.at.x === to.at.x && from.at.y === to.at.y)
      || findEventCoveringPoint(to.map.events, to.at.x, to.at.y)) {
      throw new PrimitiveError("서로 다른 빈 칸을 출입구로 골라 주세요.");
    }
    const landingFrom = gateLanding(project, from.map, from.at);
    const landingTo = gateLanding(project, to.map, to.at);
    const first = transferLeg(project, from, { map: to.map, at: landingTo }, awayFrom(to.at, landingTo));
    return transferLeg(first, { ...to, map: first.maps[to.map.id] }, { map: from.map, at: landingFrom }, awayFrom(from.at, landingFrom));
  },
};

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
  scope: tileScope,
  describe(ctx, args) {
    if (args.itemId !== undefined) {
      const item = ctx.project.database.items.find(record => record.id === args.itemId);
      if (item) {
        const name = recordLabel(item, "열쇠");
        return `「${name}」${josa(name, "이/가")} 있어야 문이 열리게 해요.`;
      }
    }
    return "정해진 조건을 만족해야 문이 열리게 해요.";
  },
  apply(ctx, args) {
    const { project } = ctx;
    const { itemId, switchId } = args;
    if ((itemId === undefined) === (switchId === undefined)) {
      throw new PrimitiveError("문을 열 아이템이나 스위치를 하나 골라 주세요.");
    }
    if (itemId !== undefined && !project.database.items.some(item => item.id === itemId)) {
      throw new PrimitiveError("문을 열 아이템을 찾을 수 없어요.");
    }
    if (switchId !== undefined && !project.switches.some(entry => entry.id === switchId)) {
      throw new PrimitiveError("문을 열 스위치를 찾을 수 없어요.");
    }
    const event = selectedEvent(ctx);
    if (!event.pages?.some(page => page.commands.some(command => command.kind === "transfer"))) {
      throw new PrimitiveError("선택한 이벤트에서 이동하는 문을 찾을 수 없어요.");
    }
    const { mapId, x, y } = tileScope(ctx);
    const draft = legacyDraft(project, project.maps[mapId], LOCK_DOOR_TOOLS[0]!, {
      x, y, unlockWhen: itemId === undefined ? { switchId } : { itemId },
      lockedText: textArg((args.text as string | undefined) ?? "문이 잠겨 있다.", "잠겼을 때 보여 줄 글을 입력해 주세요."),
    }, "이 문에 잠금을 달 수 없어요.");
    const updated = draft.maps[mapId].events.find(candidate => candidate.id === event.id)!;
    const closed = updated.pages?.find(page => page.id === `${event.id}_locked`);
    const requirement = updated.pages?.at(-1)?.conditions[0];
    if (!closed || !requirement) throw new PrimitiveError("이 문에 잠금을 달 수 없어요.");

    // Put a locked alternative immediately after each authored transfer page so the existing
    // page conditions and the priority of other pages stay intact.
    const lockedId = (id: string) => `${id}_preset_locked`;
    const pages = event.pages ?? [];
    const transferPages = pages.filter(page => page.commands.some(command => command.kind === "transfer"));
    const generated = new Set(transferPages.map(page => lockedId(page.id)));
    const transfers = new Set(transferPages);
    updated.pages = pages.filter(page => !generated.has(page.id)).flatMap(page => {
      if (!transfers.has(page)) return [structuredClone(page)];
      return [structuredClone(page), {
        ...structuredClone(page), id: lockedId(page.id), name: closed.name,
        conditions: [...structuredClone(page.conditions), { kind: "not", condition: structuredClone(requirement) }],
        commands: structuredClone(closed.commands),
      }];
    });
    assertEventShape(updated);
    return draft;
  },
};

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  npc, chest, stockPrimitive("add"), stockPrimitive("remove"), transfer, pair, sign, lock,
];
