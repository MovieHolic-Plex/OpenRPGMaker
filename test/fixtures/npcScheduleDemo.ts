import { createBlankMap, createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import type { Command, EventPage, GameEvent, NpcScheduleEntry, Project } from "@/project/types";

export type NpcScheduleDemoIds = {
  readonly townMapId: string;
  readonly shopMapId: string;
  readonly farmerEventId: string;
  readonly merchantEventId: string;
  readonly farmerFieldVariableId: string;
  readonly farmerFriendshipVariableId: string;
  readonly merchantShopVariableId: string;
  readonly strawberryItemId: string;
  readonly springSeedItemId: string;
  readonly winterFirewoodItemId: string;
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
  project.system.giftSystem = true;

  const farmerFieldVariableId = "var_farmer_field_dialogue";
  const farmerFriendshipVariableId = "var_farmer_friendship";
  const merchantShopVariableId = "var_merchant_shop_dialogue";
  ensureVariable(project, farmerFieldVariableId, "농부 밭 대사");
  ensureVariable(project, farmerFriendshipVariableId, "농부 호감도");
  ensureVariable(project, merchantShopVariableId, "상인 상점 대사");
  const strawberryItemId = "item_strawberry";
  const springSeedItemId = "item_spring_seed";
  const winterFirewoodItemId = "item_winter_firewood";
  project.database.items.push(
    normalizeItemRecord({ id: strawberryItemId, name: "딸기", price: 12, scope: "none" }),
    normalizeItemRecord({ id: springSeedItemId, name: "봄 씨앗", price: 30, scope: "none" }),
    normalizeItemRecord({ id: winterFirewoodItemId, name: "겨울 장작", price: 50, scope: "none" })
  );
  project.session.inventory[strawberryItemId] = 1;

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
    {
      ...villagerEvent("ev_farmer", "농부", 2, 2, farmerSchedule, [
        activityPage("ev_farmer_home", "농부", "home", "집에 돌아왔어.", { kind: "setVariable", variableId: farmerFieldVariableId, op: "=", value: 0 }),
        activityPage("ev_farmer_field", "농부", "field", "밭을 돌보는 중이야.", { kind: "setVariable", variableId: farmerFieldVariableId, op: "=", value: 1 }),
        {
          ...basePage("ev_farmer_friend", "농부"),
          conditions: [{ kind: "friendshipAtLeast", value: 80 }],
          commands: [
            { kind: "text", speaker: "농부", body: "딸기 덕분에 힘이 나네. 특별한 밭 이야기를 해줄게." },
            { kind: "getFriendship", variableId: farmerFriendshipVariableId },
            { kind: "setVariable", variableId: farmerFieldVariableId, op: "=", value: 2 },
          ],
        },
      ]),
      giftPrefs: { loved: [strawberryItemId] },
      giftResponses: { loved: "딸기는 내가 제일 좋아하는 선물이야!" },
    },
    villagerEvent("ev_merchant", "상인", 4, 2, merchantSchedule, [
      activityPage("ev_merchant_home", "상인", "home", "오늘 장사는 끝났어.", { kind: "setVariable", variableId: merchantShopVariableId, op: "=", value: 0 }),
      activityPage("ev_merchant_shop", "상인", "shop", "필요한 물건을 골라 봐.", { kind: "setVariable", variableId: merchantShopVariableId, op: "=", value: 1 }, {
        kind: "shop",
        itemIds: [springSeedItemId, winterFirewoodItemId],
        allowSell: true,
        quantityMode: "select",
        shopType: "normal",
        messageType: "welcome",
        stock: [
          { itemId: springSeedItemId, seasons: ["spring"], priceBySeason: { spring: 18 } },
          { itemId: winterFirewoodItemId, seasons: ["winter"], priceBySeason: { winter: 28 } },
        ],
      }),
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
      farmerFriendshipVariableId,
      merchantShopVariableId,
      strawberryItemId,
      springSeedItemId,
      winterFirewoodItemId,
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

function activityPage(id: string, name: string, activity: string, body: string, ...commands: Command[]): EventPage {
  return {
    ...basePage(id, name),
    conditions: [{ kind: "npcActivity", activity }],
    commands: [{ kind: "text", speaker: name, body }, ...commands],
  };
}
