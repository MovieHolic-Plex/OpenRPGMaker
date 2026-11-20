import type { Condition } from "@/project/types";

type Of<K extends Condition["kind"]> = Extract<Condition, { kind: K }>;
type Fields<K extends Condition["kind"]> = Omit<Of<K>, "kind">;
type Comparison = Pick<Fields<"variable">, "op" | "value">;

export function buildConditionSwitch({ switchId, value = true }: Pick<Fields<"switch">, "switchId"> & { value?: boolean }): Of<"switch"> {
  return { kind: "switch", switchId, value };
}

export function buildConditionVariable({ variableId, op = ">=", value = 0 }: Pick<Fields<"variable">, "variableId"> & Partial<Comparison>): Of<"variable"> {
  return { kind: "variable", variableId, op, value };
}

export function buildConditionSelfSwitch({ key = "A", value = true }: Partial<Fields<"selfSwitch">>): Of<"selfSwitch"> {
  return { kind: "selfSwitch", key, value };
}

export function buildConditionStringVariable({ stringVariableId, op = "==", value = "" }: Pick<Fields<"stringVariable">, "stringVariableId"> & Partial<Omit<Fields<"stringVariable">, "stringVariableId">>): Of<"stringVariable"> {
  return { kind: "stringVariable", stringVariableId, op, value: op === "empty" ? "" : value };
}

export function buildConditionItem({ itemId, present = true }: Pick<Fields<"item">, "itemId"> & { present?: boolean }): Of<"item"> {
  return { kind: "item", itemId, present };
}

export function buildConditionItemUsed({ itemId }: Fields<"itemUsed">): Of<"itemUsed"> {
  return { kind: "itemUsed", itemId };
}

export function buildConditionGold({ op = ">=", amount = 0 }: Partial<Fields<"gold">>): Of<"gold"> {
  return { kind: "gold", op, amount };
}

export function buildConditionTimer({ timerId = "timer1", seconds = 0, op }: Partial<Fields<"timer">>): Of<"timer"> {
  return { kind: "timer", timerId, seconds, ...(op !== undefined && { op }) };
}

export function buildConditionActor({ actorId, present = true }: Pick<Fields<"actor">, "actorId"> & { present?: boolean }): Of<"actor"> {
  return { kind: "actor", actorId, present };
}

export function buildConditionActorStat({ actorId = "leader", stat = "level", op = ">=", value = 10 }: Partial<Fields<"actorStat">>): Of<"actorStat"> {
  return { kind: "actorStat", actorId, stat, op, value };
}

export function buildConditionActorState({ actorId = "anyone", stateId, present = true }: Pick<Fields<"actorState">, "stateId"> & Partial<Omit<Fields<"actorState">, "stateId">>): Of<"actorState"> {
  return { kind: "actorState", actorId, stateId, present };
}

export function buildConditionPartyLeader({ actorId }: Fields<"partyLeader">): Of<"partyLeader"> {
  return { kind: "partyLeader", actorId };
}

export function buildConditionPartyKnowsSkill({ skillId, present = true }: Fields<"partyKnowsSkill">): Of<"partyKnowsSkill"> {
  return { kind: "partyKnowsSkill", skillId, present };
}

export function buildConditionPartySize({ op = ">=", value = 2 }: Partial<Comparison>): Of<"partySize"> {
  return { kind: "partySize", op, value };
}

export function buildConditionBadgeCount({ op = ">=", value = 1 }: Partial<Comparison>): Of<"badgeCount"> {
  return { kind: "badgeCount", op, value };
}

export function buildConditionMonsterSpecies({ speciesId, present = true }: Pick<Fields<"monsterSpecies">, "speciesId"> & { present?: boolean }): Of<"monsterSpecies"> {
  return { kind: "monsterSpecies", speciesId, present };
}

export function buildConditionAll({ conditions }: { conditions: readonly Condition[] }): Of<"all"> {
  return { kind: "all", conditions: structuredClone([...conditions]) };
}

export function buildConditionAny({ conditions }: { conditions: readonly Condition[] }): Of<"any"> {
  return { kind: "any", conditions: structuredClone([...conditions]) };
}

export function buildConditionNot({ condition }: Fields<"not">): Of<"not"> {
  return { kind: "not", condition: structuredClone(condition) };
}
