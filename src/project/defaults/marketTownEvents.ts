import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Command, EventPage, EventPageCondition, EventPageGraphic, EventPageMovement, GameEvent, GameMap, Trigger } from "../types";
import { DEFAULT_ITEM_ID } from "./constants";

const NPC_SPRITES = [
  "tex_easyrpg_charset_people1",
  "tex_easyrpg_charset_people2",
  "tex_easyrpg_charset_people3",
  "tex_easyrpg_charset_people4",
  "tex_easyrpg_charset_actor1",
] as const;

const MONSTER_SPRITES = ["tex_easyrpg_charset_monster1", "tex_easyrpg_charset_monster2"] as const;

const MARKET_QUEST = {
  started: "sw_0001",
  westMonsterDefeated: "sw_0002",
  eastMonsterDefeated: "sw_0003",
  complete: "sw_0004",
  defeatedCount: "var_0001",
} as const;

const FIXED_MOVEMENT: EventPageMovement = { type: "fixed", speed: 3, frequency: 3 };
const RANDOM_MOVEMENT: EventPageMovement = { type: "random", speed: 3, frequency: 4 };

type Point = { readonly x: number; readonly y: number };

export function addMarketTownEvents(map: GameMap): void {
  map.events.push(createMarketShopkeeperEvent("potion", { x: 22, y: 19 }, "포션 상인 루나", DEFAULT_ITEM_ID));
  map.events.push(createMarketShopkeeperEvent("tools", { x: 26, y: 24 }, "도구 상인 바르", "item_ether", "item_antidote"));
  map.events.push(createQuestBrokerEvent());
  map.events.push(createQuestBoardEvent());
  const monsters: readonly MonsterEventInput[] = [
    {
      id: "event_market_west_monster",
      name: "서쪽길 슬라임",
      point: { x: 15, y: 31 },
      spriteId: MONSTER_SPRITES[0],
      characterIndex: 0,
      defeatedSwitchId: MARKET_QUEST.westMonsterDefeated,
      troopId: "troop_slime_pair",
      intro: "서쪽길의 물웅덩이에서 슬라임 둘이 튀어나왔다!",
    },
    {
      id: "event_market_east_monster",
      name: "동쪽길 박쥐떼",
      point: { x: 33, y: 31 },
      spriteId: MONSTER_SPRITES[1],
      characterIndex: 2,
      defeatedSwitchId: MARKET_QUEST.eastMonsterDefeated,
      troopId: "troop_bat_swarm",
      intro: "동쪽길 나무 위에서 박쥐떼가 내려앉았다!",
    },
  ];
  for (const monster of monsters) map.events.push(createMonsterEvent(monster));

  const residents: readonly { readonly point: Point; readonly line: string }[] = [
    { point: { x: 16, y: 8 }, line: "중앙 시장 게시판을 봤어? 미라는 길목 몬스터 때문에 계속 사람을 모으고 있어." },
    { point: { x: 24, y: 16 }, line: "루나는 포션값을 낮췄고, 바르는 해독제를 더 가져왔대." },
    { point: { x: 45, y: 16 }, line: "동쪽길 박쥐는 불빛을 싫어해. 바르가 등불 기름을 챙기라고 하더라." },
    { point: { x: 17, y: 30 }, line: "서쪽길 슬라임을 치우면 항구 상인들도 다시 들어올 거야." },
    { point: { x: 45, y: 31 }, line: "미라에게 의뢰를 받고 나가. 그냥 부딪히면 괜히 위험해." },
    { point: { x: 16, y: 45 }, line: "남쪽 길은 조용하지만, 오늘은 시장 사람들이 전부 북쪽 소식을 묻고 있어." },
    { point: { x: 30, y: 45 }, line: "석상 앞에서 루나와 바르가 보상 물자를 모아뒀대." },
    { point: { x: 45, y: 45 }, line: "두 길목을 모두 열면 마을 축제를 다시 시작할 수 있어." },
    { point: { x: 21, y: 30 }, line: "포션 상인 루나는 미라의 의뢰를 도와주는 사람에게 덤을 준대." },
    { point: { x: 27, y: 30 }, line: "도구 상인 바르는 해독제도 팔아. 박쥐떼를 만나기 전에 들러." },
  ];

  residents.forEach((resident, index) => {
    map.events.push(createMarketResidentEvent(`event_market_resident_${index + 1}`, resident.point, index, resident.line));
  });
}

function createMarketShopkeeperEvent(
  idSuffix: string,
  point: Point,
  speaker: string,
  ...itemIds: readonly string[]
): GameEvent {
  return createEvent(`event_market_shop_${idSuffix}`, point, "action", [
    createPage(`page_market_shop_${idSuffix}`, speaker, [], "action", charsetGraphic(NPC_SPRITES[4], 0), FIXED_MOVEMENT, [
      { kind: "text", speaker, body: "어서 와. 미라의 의뢰를 받았다면 필요한 물건을 챙겨 가." },
      {
        kind: "shop",
        itemIds: [...itemIds],
        allowSell: true,
        quantityMode: "single",
        shopType: "normal",
        messageType: "welcome",
        branchOnTransaction: false,
        transactionBranch: [],
      },
    ]),
  ]);
}

function createQuestBrokerEvent(): GameEvent {
  const speaker = "의뢰 중개인 미라";
  return createEvent("event_market_quest_broker", { x: 22, y: 31 }, "action", [
    createPage("page_market_quest_offer", speaker, [], "action", charsetGraphic(NPC_SPRITES[1], 1), FIXED_MOVEMENT, [
      { kind: "text", speaker, body: "서쪽길 슬라임과 동쪽길 박쥐떼 때문에 상인들이 발이 묶였어." },
      {
        kind: "choices",
        prompt: "두 길목을 정리해 줄래?",
        options: [
          {
            text: "맡는다",
            branch: [
              { kind: "setSwitch", switchId: MARKET_QUEST.started, value: true },
              { kind: "setVariable", variableId: MARKET_QUEST.defeatedCount, op: "=", value: 0 },
              { kind: "text", speaker, body: "좋아. 서쪽과 동쪽 길목을 확인하고 돌아와." },
            ],
          },
          { text: "나중에", branch: [{ kind: "text", speaker, body: "시장 사람들은 여기서 기다릴게." }] },
        ],
        cancelBehavior: "choice2",
      },
    ]),
    createPage(
      "page_market_quest_active",
      speaker,
      [
        { kind: "switch", switchId: MARKET_QUEST.started, value: true },
        { kind: "switch", switchId: MARKET_QUEST.complete, value: false },
        { kind: "variable", variableId: MARKET_QUEST.defeatedCount, op: "<", value: 2 },
      ],
      "action",
      charsetGraphic(NPC_SPRITES[1], 1),
      FIXED_MOVEMENT,
      [{ kind: "text", speaker, body: "아직 길목이 완전히 열리지 않았어. 서쪽과 동쪽을 모두 확인해 줘." }]
    ),
    createPage(
      "page_market_quest_reward",
      speaker,
      [
        { kind: "switch", switchId: MARKET_QUEST.started, value: true },
        { kind: "switch", switchId: MARKET_QUEST.complete, value: false },
        { kind: "variable", variableId: MARKET_QUEST.defeatedCount, op: ">=", value: 2 },
      ],
      "action",
      charsetGraphic(NPC_SPRITES[1], 1),
      FIXED_MOVEMENT,
      [
        { kind: "text", speaker, body: "두 길목이 모두 열렸어. 시장 사람들이 네 이름을 알게 됐어." },
        { kind: "changeGold", op: "+=", amount: 120 },
        { kind: "changeItem", itemId: DEFAULT_ITEM_ID, op: "+=", amount: 2 },
        { kind: "setSwitch", switchId: MARKET_QUEST.complete, value: true },
        { kind: "text", speaker, body: "보상 120G와 포션 2개야. 이제 상점도 안심하고 장사할 수 있어." },
      ]
    ),
    createPage(
      "page_market_quest_done",
      speaker,
      [{ kind: "switch", switchId: MARKET_QUEST.complete, value: true }],
      "action",
      charsetGraphic(NPC_SPRITES[1], 1),
      FIXED_MOVEMENT,
      [{ kind: "text", speaker, body: "덕분에 시장이 다시 움직여. 루나와 바르도 네 얘기를 하고 있어." }]
    ),
  ]);
}

function createQuestBoardEvent(): GameEvent {
  return createEvent("event_market_quest_board", { x: 24, y: 29 }, "action", [
    createPage("page_market_quest_board", "의뢰 게시판", [], "action", { transparent: true }, FIXED_MOVEMENT, [
      { kind: "text", speaker: "의뢰 게시판", body: "긴급: 서쪽길 슬라임, 동쪽길 박쥐떼 출몰. 중개인 미라에게 문의." },
    ]),
  ]);
}

type MonsterEventInput = {
  readonly id: string; readonly name: string; readonly point: Point;
  readonly spriteId: (typeof MONSTER_SPRITES)[number]; readonly characterIndex: number; readonly defeatedSwitchId: string;
  readonly troopId: string; readonly intro: string;
};

function createMonsterEvent(input: MonsterEventInput): GameEvent {
  return createEvent(input.id, input.point, "playerTouch", [
    createPage(
      `${input.id}_locked`,
      input.name,
      [],
      "action",
      charsetGraphic(input.spriteId, input.characterIndex),
      FIXED_MOVEMENT,
      [{ kind: "text", speaker: input.name, body: "아직 상대할 이유가 없다. 시장의 의뢰 중개인 미라에게 먼저 가 보자." }]
    ),
    createPage(
      `${input.id}_battle`,
      input.name,
      [
        { kind: "switch", switchId: MARKET_QUEST.started, value: true },
        { kind: "switch", switchId: input.defeatedSwitchId, value: false },
      ],
      "playerTouch",
      charsetGraphic(input.spriteId, input.characterIndex),
      FIXED_MOVEMENT,
      [
        { kind: "text", speaker: input.name, body: input.intro },
        { kind: "battleProcessing", troopId: input.troopId, canEscape: true, canLose: false },
        { kind: "setSwitch", switchId: input.defeatedSwitchId, value: true },
        { kind: "setVariable", variableId: MARKET_QUEST.defeatedCount, op: "+=", value: 1 },
        { kind: "changeGold", op: "+=", amount: 20 },
        { kind: "text", speaker: input.name, body: "길목이 조용해졌다. 미라에게 보고하자." },
      ]
    ),
    createPage(
      `${input.id}_cleared`,
      input.name,
      [{ kind: "switch", switchId: input.defeatedSwitchId, value: true }],
      "action",
      charsetGraphic(input.spriteId, input.characterIndex),
      FIXED_MOVEMENT,
      [{ kind: "text", speaker: input.name, body: "이 길목은 이미 정리됐다." }]
    ),
  ]);
}

function createMarketResidentEvent(id: string, point: Point, spriteIndex: number, body: string): GameEvent {
  const spriteId = NPC_SPRITES[spriteIndex % NPC_SPRITES.length];
  const characterIndex = spriteIndex % 8;
  return createEvent(id, point, "action", [
    createPage(`${id}_page`, `마을 주민 ${spriteIndex + 1}`, [], "action", charsetGraphic(spriteId, characterIndex), RANDOM_MOVEMENT, [
      { kind: "text", speaker: `마을 주민 ${spriteIndex + 1}`, body },
    ]),
  ]);
}

function createEvent(id: string, point: Point, triggerKind: Trigger["kind"], pages: readonly EventPage[]): GameEvent {
  return { id, x: point.x, y: point.y, trigger: { kind: triggerKind }, commands: [], pages: [...pages] };
}

function createPage(
  id: string,
  name: string,
  conditions: readonly EventPageCondition[],
  triggerKind: Trigger["kind"],
  graphic: EventPageGraphic,
  movement: EventPageMovement,
  commands: readonly Command[]
): EventPage {
  return {
    id,
    name,
    conditions: [...conditions],
    graphic,
    trigger: { kind: triggerKind },
    priority: "same",
    overlapForbidden: true,
    movement,
    commands: [...commands],
  };
}

function charsetGraphic(spriteId: string, characterIndex: number): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: spriteId },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}
