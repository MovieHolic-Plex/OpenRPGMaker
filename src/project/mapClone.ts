import type { Command, Condition, GameEvent, GameMap, MapId } from "@/project/types";
import { nestedCommandLists } from "@/project/authoredCommandIndex";

export type CloneGameMapOptions = {
  readonly newId: MapId;
  readonly newName: string;
  readonly nextEventId: () => string;
};

type CloneContext = {
  readonly sourceMapId: MapId;
  readonly newMapId: MapId;
  /** 원본 이벤트 id → 복제 이벤트 id. 같은 맵 안의 이벤트 참조를 복제본끼리 다시 잇는 데 쓴다. */
  readonly idMap: ReadonlyMap<string, string>;
};

/** m2Command 필드 중 「이벤트 하나」를 가리키는 칸 이름. 값이 원본 이벤트 id 와 정확히 같을 때만 바꾼다. */
const M2_EVENT_REFERENCE_KEYS = ["eventId", "event", "target"] as const;

export function cloneGameMap(source: GameMap, options: CloneGameMapOptions): GameMap {
  const copy = structuredClone(source);
  copy.id = options.newId;
  copy.name = options.newName;
  // 먼저 새 id 를 모두 정해 둔다 — 명령 안의 eventId 가 아직 복제되지 않은 이벤트를 가리킬 수 있다.
  const idMap = new Map<string, string>();
  for (const event of source.events) idMap.set(event.id, options.nextEventId());
  const context: CloneContext = { sourceMapId: source.id, newMapId: options.newId, idMap };
  copy.events = source.events.map((event) => cloneEvent(event, context, options.nextEventId));
  if (copy.defaultLighting) {
    copy.defaultLighting = {
      ...copy.defaultLighting,
      sources: copy.defaultLighting.sources.map((light) => ({ ...light, at: remapLightAnchor(light.at, context) })),
    };
  }
  return copy;
}

function cloneEvent(event: GameEvent, context: CloneContext, nextEventId: () => string): GameEvent {
  const cloned = structuredClone(event);
  cloned.id = context.idMap.get(event.id) ?? nextEventId();
  rewriteCommandTree(cloned.commands, context);
  if (cloned.condition) cloned.condition = remapCondition(cloned.condition, context);
  if (cloned.pages) {
    cloned.pages = cloned.pages.map((page) => {
      const next = { ...page, id: nextEventId() };
      rewriteCommandTree(next.commands, context);
      next.conditions = (next.conditions ?? []).map((condition) => remapCondition(condition, context));
      return next;
    });
  }
  return cloned;
}

function remapCondition(condition: Condition, context: CloneContext): Condition {
  if (condition.kind === "pursuitActive" && condition.eventId) {
    return { ...condition, eventId: context.idMap.get(condition.eventId) ?? condition.eventId };
  }
  if (condition.kind === "all" || condition.kind === "any") {
    return { ...condition, conditions: condition.conditions.map((child) => remapCondition(child, context)) };
  }
  if (condition.kind === "not") return { ...condition, condition: remapCondition(condition.condition, context) };
  return condition;
}

function remapLightAnchor<T extends { readonly x: number; readonly y: number } | { readonly eventId: string } | "player">(
  anchor: T,
  context: CloneContext,
): T {
  if (typeof anchor === "object" && "eventId" in anchor) {
    return { ...anchor, eventId: context.idMap.get(anchor.eventId) ?? anchor.eventId };
  }
  return anchor;
}

function remapId(value: string, context: CloneContext): string {
  return context.idMap.get(value) ?? value;
}

/** 복제된(이미 structuredClone 된) 명령 트리를 제자리에서 다시 잇는다. 분기 안 명령도 모두 돈다. */
function rewriteCommandTree(commands: Command[], context: CloneContext): void {
  for (const command of commands) {
    rewriteCommand(command, context);
    for (const list of commandBranches(command)) rewriteCommandTree(list, context);
  }
}

/** nestedCommandLists 는 presentItem 의 없는 분기를 새 배열로 돌려주므로, 제자리 수정이 필요한 여기서는 실제 배열만 센다. */
function commandBranches(command: Command): Command[][] {
  if (command.kind === "presentItem") {
    return [
      ...command.options.map((option) => option.branch),
      ...(command.otherwiseBranch ? [command.otherwiseBranch] : []),
      ...(command.cancelBranch ? [command.cancelBranch] : []),
    ];
  }
  return nestedCommandLists(command) as Command[][];
}

function rewriteCommand(command: Command, context: CloneContext): void {
  switch (command.kind) {
    case "transfer":
    case "changeTile":
      if (command.mapId === context.sourceMapId) command.mapId = context.newMapId;
      return;
    case "moveEvent":
    case "setEventGraphicPattern":
    case "callMapEvent":
      command.eventId = remapId(command.eventId, context);
      return;
    case "showAnimation":
      if (typeof command.target === "object" && "eventId" in command.target) {
        command.target = { eventId: remapId(command.target.eventId, context) };
      }
      return;
    case "showEmote":
      if (typeof command.target === "object") command.target = { eventId: remapId(command.target.eventId, context) };
      return;
    case "addLight":
      command.source = { ...command.source, at: remapLightAnchor(command.source.at, context) };
      return;
    case "fork":
      command.condition = remapCondition(command.condition, context);
      return;
    case "choices":
      for (const option of command.options) {
        if (option.showWhen) option.showWhen = remapCondition(option.showWhen, context);
        if (option.enableWhen) option.enableWhen = remapCondition(option.enableWhen, context);
      }
      return;
    case "m2Command": {
      let remapped = false;
      for (const key of M2_EVENT_REFERENCE_KEYS) {
        const value = command.fields[key];
        if (typeof value === "string" && context.idMap.has(value)) {
          command.fields[key] = context.idMap.get(value)!;
          remapped = true;
        }
      }
      // 이벤트를 옮기거나 만드는 m2 명령이 원본 맵 id 를 들고 있으면(같은 맵 안의 이벤트를 가리키는 것) 복제본 맵으로 옮긴다.
      if (remapped && command.fields.mapId === context.sourceMapId) command.fields.mapId = context.newMapId;
      return;
    }
    default:
      return;
  }
}
