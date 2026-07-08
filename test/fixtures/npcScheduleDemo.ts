import { createBlankMap, createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent, NpcScheduleEntry, Project } from "@/project/types";

export type NpcScheduleDemoIds = {
  readonly townMapId: string;
  readonly shopMapId: string;
  readonly farmerEventId: string;
  readonly merchantEventId: string;
  readonly farmerFieldVariableId: string;
  readonly merchantShopVariableId: string;
};

export function createNpcScheduleDemoProject(): { readonly project: Project; readonly ids: NpcScheduleDemoIds } {
  const project = createBlankProject();
  const town = project.maps[project.startMapId];
  if (!town) throw new Error("missing starter map");
  town.name = "스케줄 마을";
  town.events = [];
  town.lowerTiles.fill(0);
  town.upperTiles.fill(-1);
  project.startPos = { x: 8, y: 1 };

  const shop = createBlankMap("상점", 12, 12, town.tilesetId, town.tileSize);
  shop.id = "map_schedule_shop";
  shop.lowerTiles.fill(0);
  shop.upperTiles.fill(-1);
  project.maps[shop.id] = shop;
  project.mapTree = { mapId: town.id, children: [{ mapId: shop.id, children: [] }] };
  project.system.timeSystem = {
    enabled: true,
    minutesPerRealSecond: 60,
    dayStartHour: 6,
    dayEndHour: 26,
  };

  const farmerFieldVariableId = "var_farmer_field_dialogue";
  const merchantShopVariableId = "var_merchant_shop_dialogue";
  ensureVariable(project, farmerFieldVariableId, "농부 밭 대사");
  ensureVariable(project, merchantShopVariableId, "상인 상점 대사");

  const farmerSchedule: NpcScheduleEntry[] = [
    { when: { hourRange: [6, 18] }, at: { mapId: town.id, x: 8, y: 2 }, facing: "down", activity: "field" },
    { when: { hourRange: [18, 48] }, at: { mapId: town.id, x: 2, y: 2 }, facing: "down", activity: "home" },
  ];
  const merchantSchedule: NpcScheduleEntry[] = [
    { when: { hourRange: [0, 9] }, at: { mapId: town.id, x: 4, y: 2 }, facing: "down", activity: "home" },
    { when: { hourRange: [9, 20] }, at: { mapId: shop.id, x: 4, y: 4 }, facing: "left", activity: "shop" },
    { when: { hourRange: [20, 48] }, at: { mapId: town.id, x: 4, y: 2 }, facing: "down", activity: "home" },
  ];

  town.events = [
    villagerEvent("ev_farmer", "농부", 2, 2, farmerSchedule, [
      activityPage("ev_farmer_home", "농부", "home", "집에 돌아왔어.", { kind: "setVariable", variableId: farmerFieldVariableId, op: "=", value: 0 }),
      activityPage("ev_farmer_field", "농부", "field", "밭을 돌보는 중이야.", { kind: "setVariable", variableId: farmerFieldVariableId, op: "=", value: 1 }),
    ]),
    villagerEvent("ev_merchant", "상인", 4, 2, merchantSchedule, [
      activityPage("ev_merchant_home", "상인", "home", "오늘 장사는 끝났어.", { kind: "setVariable", variableId: merchantShopVariableId, op: "=", value: 0 }),
      activityPage("ev_merchant_shop", "상인", "shop", "필요한 물건을 골라 봐.", { kind: "setVariable", variableId: merchantShopVariableId, op: "=", value: 1 }),
    ]),
  ];

  return {
    project,
    ids: {
      townMapId: town.id,
      shopMapId: shop.id,
      farmerEventId: "ev_farmer",
      merchantEventId: "ev_merchant",
      farmerFieldVariableId,
      merchantShopVariableId,
    },
  };
}

function ensureVariable(project: Project, id: string, name: string): void {
  if (!project.variables.some((variable) => variable.id === id)) project.variables.push({ id, name });
  project.session.variables[id] = 0;
}

function villagerEvent(
  id: string,
  name: string,
  x: number,
  y: number,
  schedule: NpcScheduleEntry[],
  activityPages: EventPage[]
): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    schedule,
    pages: [
      basePage(`${id}_base`, name),
      ...activityPages,
    ],
  };
}

function basePage(id: string, name: string): EventPage {
  return {
    id,
    name,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", speaker: name, body: "안녕하세요." }],
  };
}

function activityPage(id: string, name: string, activity: string, body: string, marker: Command): EventPage {
  return {
    ...basePage(id, name),
    conditions: [{ kind: "npcActivity", activity }],
    commands: [{ kind: "text", speaker: name, body }, marker],
  };
}
