import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";
import {
  buildFieldMonsterEvent,
  defaultFieldMonsterClearSwitchId,
} from "@/project/fieldMonsterTemplate";
import type {
  Command,
  EventPage,
  EventPageGraphic,
  GameEvent,
  GameMap,
  MapTreeNode,
  Project,
} from "@/project/types";
import {
  ICE_DIAGONAL_CANONICAL_SOURCE,
  mirrorIceDiagonalTile,
} from "./iceDiagonalTerrain";

export const ICE_GRAND_ADVENTURE_MAP_ID = "map_g_ice_grand_adventure";
export const ICE_GRAND_ADVENTURE_START = { x: 27, y: 50 } as const;

export type IceGrandAdventureEncounter = {
  readonly eventId: string;
  readonly troopId: string;
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly graphic: {
    readonly textureKey: string;
    readonly characterIndex: number;
  };
  readonly movement: "fixed" | "random";
};

export const ICE_GRAND_ADVENTURE_ENCOUNTERS = [
  {
    eventId: "ev_ice_slime_southwest",
    troopId: "troop_ice_adventure_slime",
    x: 22,
    y: 45,
    label: "서리 슬라임",
    graphic: { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 0 },
    movement: "random",
  },
  {
    eventId: "ev_ice_slime_southeast",
    troopId: "troop_ice_adventure_slime_pair",
    x: 32,
    y: 44,
    label: "빙설 슬라임 무리",
    graphic: { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 0 },
    movement: "random",
  },
  {
    eventId: "ev_ice_bats_west",
    troopId: "troop_ice_adventure_bat_swarm",
    x: 12,
    y: 35,
    label: "빙굴 박쥐 떼",
    graphic: { textureKey: "tex_easyrpg_charset_monster3", characterIndex: 0 },
    movement: "random",
  },
  {
    eventId: "ev_ice_bats_east",
    troopId: "troop_ice_adventure_bat_swarm",
    x: 42,
    y: 34,
    label: "서리 날짐승 떼",
    graphic: { textureKey: "tex_easyrpg_charset_monster3", characterIndex: 0 },
    movement: "random",
  },
  {
    eventId: "ev_ice_golem_west",
    troopId: "troop_ice_adventure_golem_guard",
    x: 18,
    y: 26,
    label: "빙정 골렘 수문장",
    graphic: { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 4 },
    movement: "fixed",
  },
  {
    eventId: "ev_ice_golem_east",
    troopId: "troop_ice_adventure_golem_guard",
    x: 38,
    y: 24,
    label: "빙벽 골렘 수문장",
    graphic: { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 4 },
    movement: "fixed",
  },
  {
    eventId: "ev_ice_dragon_boss",
    troopId: "troop_ice_adventure_dragon",
    x: 27,
    y: 7,
    label: "빙하에 봉인된 적룡",
    graphic: { textureKey: "tex_easyrpg_charset_monster3", characterIndex: 5 },
    movement: "fixed",
  },
] as const satisfies readonly IceGrandAdventureEncounter[];

const ICE_DATABASE_NAMES = {
  enemies: {
    enemy_slime: "서리 슬라임",
    enemy_meadow_slime: "빙설 슬라임",
    enemy_cave_bat: "빙굴 박쥐",
    enemy_stone_golem: "빙정 골렘",
    enemy_dragon: "봉인된 적룡",
  },
  troops: {
    troop_ice_adventure_slime: "서리 슬라임",
    troop_ice_adventure_slime_pair: "빙설 슬라임 무리",
    troop_ice_adventure_bat_swarm: "빙굴 박쥐 떼",
    troop_ice_adventure_golem_guard: "빙정 골렘 수문대",
    troop_ice_adventure_dragon: "빙하에 봉인된 적룡",
  },
} as const;

const ICE_ENEMY_IDS = Object.keys(ICE_DATABASE_NAMES.enemies);
const ICE_TROOP_SOURCE_IDS = {
  troop_ice_adventure_slime: "troop_slime",
  troop_ice_adventure_slime_pair: "troop_slime_pair",
  troop_ice_adventure_bat_swarm: "troop_bat_swarm",
  troop_ice_adventure_golem_guard: "troop_golem_guard",
  troop_ice_adventure_dragon: "troop_dragon",
} as const;

export type IceGrandAdventureInstallResult = {
  readonly mapId: typeof ICE_GRAND_ADVENTURE_MAP_ID;
  readonly map: GameMap;
  readonly encounterCount: number;
  readonly rewardCount: number;
};

export function buildIceGrandAdventureMap(reference: GameMap): GameMap {
  assertCanonicalReference(reference);
  const lowerTiles = mirrorLayer(reference.lowerTiles, reference.width, reference.height);
  const upperTiles = mirrorLayer(reference.upperTiles, reference.width, reference.height);
  const events = [
    ...ICE_GRAND_ADVENTURE_ENCOUNTERS.map(buildEncounter),
    buildRewardChest("ev_ice_reward_west", 15, 18, "서쪽 빙정 보관함"),
    buildRewardChest("ev_ice_reward_east", 39, 18, "동쪽 빙정 보관함"),
    buildRecoveryCrystal(),
  ];

  return {
    ...structuredClone(reference),
    id: ICE_GRAND_ADVENTURE_MAP_ID,
    name: "얼음 동굴 · 몬스터 원정 (55×55)",
    lowerTiles,
    upperTiles,
    lowerTileStacks: mirrorStacks(reference.lowerTileStacks, reference.width),
    upperTileStacks: mirrorStacks(reference.upperTileStacks, reference.width),
    events,
    encounterRate: 0,
    troopIds: [...new Set(ICE_GRAND_ADVENTURE_ENCOUNTERS.map((encounter) => encounter.troopId))],
    layoutPlan: {
      version: 1,
      kind: "ice-grand-adventure",
      seed: 20260722,
      regions: [
        { id: "entry-camp", role: "entry", label: "남쪽 원정 기지", x: 18, y: 43, w: 19, h: 10 },
        { id: "lower-hunt", role: "encounter", label: "슬라임·박쥐 사냥터", x: 7, y: 31, w: 41, h: 14 },
        { id: "golem-gate", role: "encounter", label: "쌍둥이 골렘 관문", x: 13, y: 20, w: 31, h: 10 },
        { id: "dragon-sanctum", role: "boss", label: "적룡 봉인 제단", x: 20, y: 4, w: 15, h: 9 },
      ],
      roadAnchors: [
        { id: "start", ...ICE_GRAND_ADVENTURE_START },
        { id: "west-gate", x: 18, y: 27 },
        { id: "east-gate", x: 38, y: 25 },
        { id: "boss", x: 27, y: 8 },
      ],
      notes: "map_g_ice_grand의 대각 빙벽 정본을 좌우 반전해 재구성한 실전형 원정 맵. 보이는 몬스터와 보상, 회복 체크포인트를 포함한다.",
    },
  };
}

export function installIceGrandAdventure(project: Project): IceGrandAdventureInstallResult {
  const reference = project.maps[ICE_DIAGONAL_CANONICAL_SOURCE.mapId];
  if (!reference) throw new Error(`canonical ice map missing: ${ICE_DIAGONAL_CANONICAL_SOURCE.mapId}`);
  const map = buildIceGrandAdventureMap(reference);
  installBattleRecords(project);
  installSwitches(project);
  project.maps[map.id] = map;
  appendTreeChildOnce(project.mapTree, ICE_DIAGONAL_CANONICAL_SOURCE.mapId, map.id);
  return { mapId: ICE_GRAND_ADVENTURE_MAP_ID, map, encounterCount: ICE_GRAND_ADVENTURE_ENCOUNTERS.length, rewardCount: 2 };
}

function assertCanonicalReference(reference: GameMap): void {
  if (reference.id !== ICE_DIAGONAL_CANONICAL_SOURCE.mapId) {
    throw new Error(`expected canonical map ${ICE_DIAGONAL_CANONICAL_SOURCE.mapId}, received ${reference.id}`);
  }
  if (reference.width !== 55 || reference.height !== 55) {
    throw new Error(`canonical ice map must be 55x55, received ${reference.width}x${reference.height}`);
  }
  if (reference.lowerTiles.length !== 55 * 55 || reference.upperTiles.length !== 55 * 55) {
    throw new Error("canonical ice map layers are incomplete");
  }
}

function mirrorLayer(layer: readonly number[], width: number, height: number): number[] {
  const mirrored = new Array<number>(layer.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      mirrored[y * width + x] = mirrorIceDiagonalTile(layer[y * width + (width - 1 - x)]!);
    }
  }
  return mirrored;
}

function mirrorStacks(stacks: Readonly<Record<number, readonly number[]>> | undefined, width: number): Record<number, number[]> | undefined {
  if (!stacks) return undefined;
  const mirrored: Record<number, number[]> = {};
  for (const [rawIndex, tiles] of Object.entries(stacks)) {
    const index = Number(rawIndex);
    const y = Math.floor(index / width);
    const x = index % width;
    mirrored[y * width + (width - 1 - x)] = tiles.map(mirrorIceDiagonalTile);
  }
  return mirrored;
}

function charsetGraphic(textureKey: string, characterIndex: number): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: textureKey },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}

function buildEncounter(encounter: IceGrandAdventureEncounter): GameEvent {
  const clearSwitchId = defaultFieldMonsterClearSwitchId(encounter.eventId);
  const isBoss = encounter.eventId === "ev_ice_dragon_boss";
  return buildFieldMonsterEvent({
    eventId: encounter.eventId,
    troopId: encounter.troopId,
    clearSwitchId,
    x: encounter.x,
    y: encounter.y,
    graphic: charsetGraphic(encounter.graphic.textureKey, encounter.graphic.characterIndex),
    fightPageName: `${encounter.label} · 전투`,
    clearedPageName: `${encounter.label} · 처치됨`,
    fightMovement: {
      type: encounter.movement,
      speed: isBoss ? 2 : 3,
      frequency: encounter.movement === "random" ? 2 : 3,
    },
    intro: [isBoss ? "빙벽 사이에서 봉인된 적룡이 포효한다!" : `${encounter.label}이 길을 막아섰다!`],
    victory: [isBoss ? "적룡의 불꽃이 꺼지고 얼음 동굴에 고요가 돌아왔다." : `${encounter.label}을 물리쳤다.`],
    victoryItems: isBoss ? [{ itemId: "item_potion", amount: 3 }] : undefined,
    canEscape: !isBoss,
  });
}

function buildRewardChest(eventId: string, x: number, y: number, label: string): GameEvent {
  const closedPage: EventPage = {
    id: `${eventId}_closed`,
    name: `${label} · 닫힘`,
    conditions: [],
    graphic: charsetGraphic("tex_easyrpg_charset_object1", 6),
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [
      { kind: "text", body: "차가운 보관함 안에서 회복 물약을 찾았다." },
      { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 },
      { kind: "setSelfSwitch", key: "A", value: true },
    ],
  };
  const openedPage: EventPage = {
    id: `${eventId}_opened`,
    name: `${label} · 열림`,
    conditions: [{ kind: "selfSwitch", key: "A", value: true }],
    graphic: charsetGraphic("tex_easyrpg_charset_object1", 6),
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: "이미 비어 있는 보관함이다." }],
  };
  return { id: eventId, x, y, trigger: { kind: "action" }, commands: [], pages: [closedPage, openedPage] };
}

function buildRecoveryCrystal(): GameEvent {
  const commands: Command[] = [
    { kind: "text", body: "원정대의 빙정이 따뜻한 빛을 낸다. 체력과 마력을 회복하고 기록을 남겼다." },
    { kind: "recoverAll" },
    { kind: "checkpointSave", label: "얼음 동굴 남쪽 원정 기지" },
  ];
  return {
    id: "ev_ice_recovery_crystal",
    x: 27,
    y: 47,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: "ev_ice_recovery_crystal_active",
      name: "원정대 회복 빙정",
      conditions: [],
      graphic: charsetGraphic("tex_easyrpg_charset_object2", 6),
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: true,
      animationType: "step",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands,
    }],
  };
}

function installBattleRecords(project: Project): void {
  const defaults = defaultBattleRecords();
  const enemyNames = ICE_DATABASE_NAMES.enemies as Readonly<Record<string, string>>;
  const troopNames = ICE_DATABASE_NAMES.troops as Readonly<Record<string, string>>;
  for (const enemy of defaults.enemies.filter((record) => ICE_ENEMY_IDS.includes(record.id))) {
    appendRecordOnce(project.database.enemies, { ...structuredClone(enemy), name: enemyNames[enemy.id] ?? enemy.name });
  }
  for (const [troopId, sourceTroopId] of Object.entries(ICE_TROOP_SOURCE_IDS)) {
    const troop = defaults.troops.find((record) => record.id === sourceTroopId);
    if (!troop) throw new Error(`Missing default troop '${sourceTroopId}' for the ice adventure.`);
    appendRecordOnce(project.database.troops, {
      ...structuredClone(troop),
      id: troopId,
      name: troopNames[troopId] ?? troop.name,
      previewBackgroundResourceId: "scarloxy-backdrop-ice",
    });
  }
  project.database.monsterSpecies ??= [];
  const speciesIds = new Set(project.database.enemies.flatMap((enemy) => enemy.speciesId ? [enemy.speciesId] : []));
  for (const species of defaults.monsterSpecies.filter((record) => speciesIds.has(record.id))) {
    appendRecordOnce(project.database.monsterSpecies, structuredClone(species));
  }
}

function appendRecordOnce<T extends { readonly id: string }>(records: T[], record: T): void {
  if (!records.some((existing) => existing.id === record.id)) records.push(record);
}

function installSwitches(project: Project): void {
  for (const encounter of ICE_GRAND_ADVENTURE_ENCOUNTERS) {
    const switchId = defaultFieldMonsterClearSwitchId(encounter.eventId);
    if (!project.switches.some((entry) => entry.id === switchId)) {
      project.switches.push({ id: switchId, name: `처치 완료 · ${encounter.label}` });
    }
    project.session.switches[switchId] ??= false;
  }
}

function appendTreeChildOnce(root: MapTreeNode, parentMapId: string, childMapId: string): void {
  if (treeContains(root, childMapId)) return;
  const parent = findTreeNode(root, parentMapId) ?? root;
  parent.children.push({ mapId: childMapId, children: [] });
}

function treeContains(node: MapTreeNode, mapId: string): boolean {
  return node.mapId === mapId || node.children.some((child) => treeContains(child, mapId));
}

function findTreeNode(node: MapTreeNode, mapId: string): MapTreeNode | undefined {
  if (node.mapId === mapId) return node;
  for (const child of node.children) {
    const found = findTreeNode(child, mapId);
    if (found) return found;
  }
  return undefined;
}
