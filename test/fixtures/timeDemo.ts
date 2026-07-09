import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

export type TimeDemoIds = {
  readonly mapId: string;
  readonly npcEventId: string;
  readonly phaseVariableId: string;
  readonly hookVariableId: string;
  readonly nightTroopId: string;
  readonly dayTroopId: string;
  readonly dayEndCommonEventId: string;
};

export function createTimeDemoProject(): { readonly project: Project; readonly ids: TimeDemoIds } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  if (!project.variables[1]) {
    project.variables.push({ id: "var_time_hook", name: "Day End Count" });
    project.session.variables.var_time_hook = 0;
  }
  const phaseVariableId = project.variables[0]?.id ?? "var1";
  const hookVariableId = project.variables[1]?.id ?? phaseVariableId;
  const dayTroopId = project.database.troops[0]?.id ?? "troop_default";
  const nightTroopId = "troop_night";
  const dayEndCommonEventId = "ce_day_end";
  const baseTroop = project.database.troops[0];
  if (baseTroop && !project.database.troops.some((troop) => troop.id === nightTroopId)) {
    project.database.troops.push({ ...structuredClone(baseTroop), id: nightTroopId, name: "Night Only" });
  }
  project.system.timeSystem = {
    enabled: true,
    minutesPerRealSecond: 60,
    dayStartHour: 6,
    dayEndHour: 26,
    forceSleep: true,
    onDayEnd: dayEndCommonEventId,
  };
  project.commonEvents.push({
    id: dayEndCommonEventId,
    name: "Day End Hook",
    trigger: "none",
    commands: [{ kind: "setVariable", variableId: hookVariableId, op: "+=", value: 1 }],
  });
  const map = project.maps[mapId];
  map.events = [timeNpcEvent(phaseVariableId)];
  map.encounterRate = 1000;
  map.encounterTable = [
    { troopId: dayTroopId, weight: 1, conditions: { timePhase: "day" } },
    { troopId: nightTroopId, weight: 1, conditions: { timePhase: "night" } },
  ];
  return {
    project,
    ids: {
      mapId,
      npcEventId: "ev_time_npc",
      phaseVariableId,
      hookVariableId,
      nightTroopId,
      dayTroopId,
      dayEndCommonEventId,
    },
  };
}

function timeNpcEvent(variableId: string): GameEvent {
  return {
    id: "ev_time_npc",
    x: 0,
    y: 0,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      npcPage("page_day", "낮 인사", [], "해가 높네.", { kind: "setVariable", variableId, op: "=", value: 1 }),
      npcPage("page_night", "밤 인사", [{ kind: "timePhase", phase: "night" }], "밤길 조심해.", { kind: "setVariable", variableId, op: "=", value: 2 }),
    ],
  };
}

function npcPage(
  id: string,
  name: string,
  conditions: EventPage["conditions"],
  body: string,
  marker: Command
): EventPage {
  return {
    id,
    name,
    conditions,
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", speaker: "시간 NPC", body }, marker],
  };
}
