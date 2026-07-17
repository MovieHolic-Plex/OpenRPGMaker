/**
 * RM2003-style field monster / battle blocker template.
 * battle → fork(battleResult=victory) → clear switch + Erase Event + rewards.
 * Page 0 = live fight, page 1 = cleared transparent (last matching page wins).
 */
import type {
  Command,
  EventPage,
  EventPageCondition,
  EventPageGraphic,
  EventPageMovement,
  GameEvent,
} from "@/project/types";

export const ERASE_EVENT_COMMAND_ID = "m2-086-erase-event" as const;

export type FieldMonsterVictoryItem = {
  readonly itemId: string;
  readonly amount: number;
};

export type FieldMonsterFightCommandsInput = {
  readonly troopId: string;
  readonly clearSwitchId: string;
  readonly intro?: readonly string[];
  readonly victory?: readonly string[];
  readonly victoryItems?: readonly FieldMonsterVictoryItem[];
  readonly canEscape?: boolean;
  readonly canLose?: boolean;
};

export type FieldMonsterPagesInput = FieldMonsterFightCommandsInput & {
  readonly eventId: string;
  readonly graphic?: EventPageGraphic;
  readonly fightPageName?: string;
  readonly clearedPageName?: string;
  readonly fightConditions?: readonly EventPageCondition[];
  readonly clearedCommands?: readonly Command[];
  readonly fightMovement?: EventPageMovement;
  readonly clearedMovement?: EventPageMovement;
  readonly fightPriority?: EventPage["priority"];
  readonly fightOverlapForbidden?: boolean;
  readonly fightTrigger?: EventPage["trigger"];
};

const PASSIVE: EventPageMovement = { type: "fixed", speed: 3, frequency: 3 };

export function buildFieldMonsterFightCommands(input: FieldMonsterFightCommandsInput): Command[] {
  const intro = input.intro?.length ? input.intro : ["적이 앞을 가로막았다!"];
  const victory = input.victory?.length ? input.victory : ["길이 열렸다."];
  const victoryItems = input.victoryItems ?? [];
  return [
    ...intro.map((body): Command => ({ kind: "text", body })),
    {
      kind: "battleProcessing",
      troopId: input.troopId,
      canEscape: input.canEscape ?? true,
      canLose: input.canLose ?? false,
    },
    {
      kind: "fork",
      condition: { kind: "battleResult", result: "victory" },
      then: [
        { kind: "setSwitch", switchId: input.clearSwitchId, value: true },
        { kind: "m2Command", commandId: ERASE_EVENT_COMMAND_ID, fields: {} },
        ...victoryItems.map(
          (entry): Command => ({
            kind: "changeItem",
            itemId: entry.itemId,
            op: "+=",
            amount: entry.amount,
          })
        ),
        ...victory.map((body): Command => ({ kind: "text", body })),
      ],
    },
  ];
}

export function buildFieldMonsterPages(input: FieldMonsterPagesInput): EventPage[] {
  const fightId = `${input.eventId}_fight`;
  const clearedId = `${input.eventId}_cleared`;
  return [
    {
      id: fightId,
      name: input.fightPageName ?? "전투",
      conditions: [...(input.fightConditions ?? [])],
      graphic: structuredClone(input.graphic ?? {}),
      trigger: input.fightTrigger ?? { kind: "action" },
      priority: input.fightPriority ?? "same",
      overlapForbidden: input.fightOverlapForbidden ?? true,
      movement: structuredClone(input.fightMovement ?? PASSIVE),
      commands: buildFieldMonsterFightCommands(input),
    },
    {
      id: clearedId,
      name: input.clearedPageName ?? "정리된 자리",
      conditions: [{ kind: "switch", switchId: input.clearSwitchId, value: true }],
      graphic: { transparent: true },
      trigger: { kind: "action" },
      priority: "below",
      overlapForbidden: false,
      movement: structuredClone(input.clearedMovement ?? PASSIVE),
      commands: structuredClone(input.clearedCommands ?? []),
    },
  ];
}

export function buildFieldMonsterEvent(
  input: FieldMonsterPagesInput & {
    readonly x: number;
    readonly y: number;
    readonly rootTrigger?: GameEvent["trigger"];
  }
): GameEvent {
  return {
    id: input.eventId,
    x: input.x,
    y: input.y,
    trigger: input.rootTrigger ?? { kind: "action" },
    commands: [],
    pages: buildFieldMonsterPages(input),
  };
}

export function defaultFieldMonsterClearSwitchId(eventId: string): string {
  return `sw_${eventId}_clear`;
}

/** True when commands already follow victory → erase pattern (for quality badges). */
export function hasFieldMonsterVictoryErasePattern(commands: readonly Command[]): boolean {
  const flat = flattenCommands(commands);
  const hasBattle = flat.some((command) => command.kind === "battleProcessing");
  const hasErase = flat.some(
    (command) => command.kind === "m2Command" && command.commandId === ERASE_EVENT_COMMAND_ID
  );
  const hasVictoryFork = commands.some(
    (command) =>
      command.kind === "fork" &&
      command.condition.kind === "battleResult" &&
      command.condition.result === "victory"
  );
  return hasBattle && hasErase && hasVictoryFork;
}

function flattenCommands(commands: readonly Command[]): Command[] {
  const out: Command[] = [];
  for (const command of commands) {
    out.push(command);
    if (command.kind === "fork") {
      out.push(...flattenCommands(command.then));
      if (command.else) out.push(...flattenCommands(command.else));
    }
  }
  return out;
}
