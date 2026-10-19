import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { configureEmeraldMonsterOpening } from "@/project/emeraldMonsterOpening";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import mapTemplates from "@/project/examples/monsterExpedition/mapTemplates.json";
import { composeTown, type TownSketch, type TownTemplate } from "@/project/examples/monsterExpedition/townLayouts";
import { deserialize, serialize } from "@/project/io";
import type { Command, GameEvent, GameMap, Project } from "@/project/types";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import { DAWNING_SKYBIRDS_CHARSET_ID } from "./dawningSkybirdsAsset";
import type { FlagshipDemoBuildResult } from "./types";

const STARTER_NAME_REMAP: Readonly<Record<string, string>> = {
  mx_species_spriglet: "토리프",
  mx_species_bramblet: "실바리온",
  mx_species_canopine: "벨데로드",
  mx_species_coalbit: "파이린",
  mx_species_kilnclaw: "볼케이건",
  mx_species_pyroscale: "마그렉스",
  mx_species_rivulet: "아쿠링",
  mx_species_tideling: "마린웨이",
  mx_species_abyssal: "네레이드",
};

const OLD_TO_NEW_TEXT: ReadonlyArray<readonly [string, string]> = [
  ["꼬마초", "토리프"],
  ["불씨점", "파이린"],
  ["물방울", "아쿠링"],
  ["별싹 마을", "다우닝 시티"],
  ["새벽섬 마을", "다우닝 시티"],
  ["별빛섬", "아스트라 군도"],
  ["새벽섬", "오르비스 해안"],
  ["새순 마을", "실바나 마을"],
  ["새순 체육관", "실바나 체육관"],
];

const DAWNING_CITY_SKETCH: TownSketch = {
  ground: ["grass0", "grass0", "grass1", "grass2", "grass3"],
  legend: {
    "#": { frame: true },
    "=": { group: "clearing" },
    "~": { group: "water" },
    f: { tile: ["flower_red", "flower_white", "flower_yellow", "flower_pink"] },
    F: { tile: ["flowerbed_red", "flowerbed_yellow", "flowerbed_pink", "flowerbed_white"] },
    S: { tile: ["sign"] },
    M: { tile: ["mailbox"] },
    T: { prop: "tree_a" },
    U: { prop: "tree_b" },
  },
  kits: [
    ["cabin_a", 8, 6],
    ["cabin_b", 16, 6],
    ["gable_a", 21, 4],
    ["mart", 2, 11],
    ["center", 8, 11],
    ["shop_a", 21, 13],
  ],
  rows: [
    "#############==###############",
    "#############==###############",
    "#############==###############",
    "##..T.....f..==..f..........##",
    "##...........==.............##",
    "##....f......==.............##",
    "##...........==.............##",
    "##...........==.............##",
    "##...........==.............##",
    "##.....M.....==.....S.......##",
    "##.....================.....##",
    "##...........===.....====...##",
    "##...........==.F~~~F.......##",
    "##...........==.f~~~f.......##",
    "##...........==.F~~~F.......##",
    "##.==....==..==.............##",
    "##.====================.....##",
    "##.====================.===.##",
    "##...f~~~~f..==..T...f......##",
    "##...F~~~~F..==.............##",
    "##....~~~~...==.............##",
    "##############################",
    "##############################",
    "##############################",
  ],
};

function replaceTextDeep(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(replaceTextDeep);
    return;
  }
  if (!value || typeof value !== "object") return;
  const rec = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(rec)) {
    if (typeof v === "string") {
      let next = v;
      for (const [from, to] of OLD_TO_NEW_TEXT) {
        if (next.includes(from)) next = next.split(from).join(to);
      }
      if (next === "mx_badge_8") next = "mx_badge_1";
      rec[k] = next;
    } else {
      replaceTextDeep(v);
    }
  }
}

function retargetReturnPortal(map: GameMap | undefined, toMapId: string, x: number, y: number): void {
  if (!map) return;
  for (const ev of map.events) {
    for (const cmd of ev.commands) {
      if (cmd.kind === "transfer" && cmd.mapId === toMapId) {
        cmd.x = x;
        cmd.y = y;
      }
    }
    for (const page of ev.pages ?? []) {
      for (const cmd of page.commands) {
        if (cmd.kind === "transfer" && cmd.mapId === toMapId) {
          cmd.x = x;
          cmd.y = y;
        }
      }
    }
  }
}

function createSkybirdEvent(
  id: string,
  name: string,
  x: number,
  y: number,
  characterIndex: number,
  direction: "up" | "right" | "down" | "left",
  speaker: string,
  body: string,
  priority: "below" | "same" | "above" = "same",
): GameEvent {
  const graphic = {
    sprite: { type: "bundled" as const, id: DAWNING_SKYBIRDS_CHARSET_ID },
    direction,
    pattern: charsetFrameIndex({ characterIndex, direction, pattern: 1 }),
    transparent: false,
  };
  const commands: Command[] = [{ kind: "text", speaker, body }];
  return {
    id,
    name,
    x,
    y,
    trigger: { kind: "action" },
    commands,
    pages: [
      {
        id: `${id}_p1`,
        name: "여명의 날개",
        conditions: [],
        graphic,
        movement: { type: "fixed", speed: 3, frequency: 4 },
        priority,
        overlapForbidden: priority === "same",
        trigger: { kind: "action" },
        commands,
      },
    ],
  };
}

function createBelowTouchEvent(id: string, name: string, x: number, y: number, commands: Command[]): GameEvent {
  return {
    id,
    name,
    x,
    y,
    trigger: { kind: "playerTouch" },
    commands,
    pages: [
      {
        id: `${id}_p1`,
        name,
        conditions: [],
        graphic: {
          sprite: { type: "bundled", id: "tex_oprn_charset_scarloxy_people1" },
          direction: "down",
          pattern: 0,
          transparent: true,
        },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        priority: "below",
        overlapForbidden: false,
        trigger: { kind: "playerTouch" },
        commands,
      },
    ],
  };
}

function installInteriorStairsAndLab2F(project: Project): void {
  const house1F = project.maps["mx_map_home_house"];
  const house2F = project.maps["mx_map_home_house_2f"];
  if (house1F) {
    for (const ev of house1F.events) {
      if (ev.id.includes("_stairs_")) {
        ev.name = "2층 내 방으로 올라가는 계단 (stairs_up)";
      }
    }
  }
  if (house2F) {
    for (const ev of house2F.events) {
      if (ev.id.includes("_stairs_")) {
        ev.name = "1층 거실로 내려가는 계단 (stairs_down)";
      }
    }
  }

  const lab1F = project.maps["mx_map_lab"];
  const center2FTemplate = project.maps["mx_map_home_center_2f"];
  if (!lab1F || !center2FTemplate) return;

  // Stamp 2F stairs (`c_escalator` tiles 119..124 in `monster_rooms`) on the upper-right wall of `mx_map_lab` (x=12..13, y=1..3)
  const w = lab1F.width;
  lab1F.upperTiles[1 * w + 11] = 117;
  lab1F.upperTiles[2 * w + 11] = 118;
  lab1F.upperTiles[1 * w + 12] = 119;
  lab1F.upperTiles[1 * w + 13] = 120;
  lab1F.upperTiles[2 * w + 12] = 121;
  lab1F.upperTiles[2 * w + 13] = 122;
  lab1F.upperTiles[3 * w + 12] = 123;
  lab1F.upperTiles[3 * w + 13] = 124;

  // Keep the landing at (12,4)..(13,4) open by shifting the rival slightly left
  const labRival = lab1F.events.find((e) => e.id === "mx_map_lab_rival");
  if (labRival) {
    labRival.x = 10;
    labRival.y = 6;
  }

  const lab2FId = "mx_map_lab_2f";
  const lab2F: GameMap = {
    ...structuredClone(center2FTemplate),
    id: lab2FId,
    name: "오르비스 천문 연구소 · 2층 관측실",
    events: [
      createBelowTouchEvent(
        "mx_map_lab_2f_stairs_down_0",
        "1층 연구소로 내려가는 계단 (stairs_down)",
        1,
        3,
        [{ kind: "transfer", mapId: lab1F.id, x: 12, y: 4 }],
      ),
      createBelowTouchEvent(
        "mx_map_lab_2f_stairs_down_1",
        "1층 연구소로 내려가는 계단 (stairs_down)",
        2,
        3,
        [{ kind: "transfer", mapId: lab1F.id, x: 13, y: 4 }],
      ),
      createSkybirdEvent(
        "ev_lab_2f_skybird",
        "관측실 아스트라별새",
        7,
        4,
        7,
        "left",
        "아스트라별새",
        "끼르륵—! (2층 천문 관측실 창가에서 아스트라별새가 별빛 날개를 반짝이며 다우닝 시티의 하늘을 살피고 있다.)",
      ),
    ],
  };
  project.maps[lab2FId] = lab2F;

  lab1F.events.push(
    createBelowTouchEvent(
      "mx_map_lab_stairs_up_0",
      "2층 천문 관측실로 올라가는 계단 (stairs_up)",
      12,
      3,
      [{ kind: "transfer", mapId: lab2FId, x: 1, y: 4 }],
    ),
    createBelowTouchEvent(
      "mx_map_lab_stairs_up_1",
      "2층 천문 관측실로 올라가는 계단 (stairs_up)",
      13,
      3,
      [{ kind: "transfer", mapId: lab2FId, x: 2, y: 4 }],
    ),
    createSkybirdEvent(
      "ev_lab_1f_skybird",
      "연구소 별빛방울새",
      4,
      6,
      2,
      "right",
      "별빛방울새",
      "포르릉! (천문박사님의 관측기를 돕는 별빛방울새가 2층 계단 쪽을 가리키며 경쾌하게 지저귄다.)",
    ),
  );
}

export function createEmeraldCrownFlagshipDemo(): FlagshipDemoBuildResult {
  const { project } = createMonsterExpedition({
    firstGymType: "grass",
    gymCount: 1,
  });

  project.meta.title = "아스트라 호라이즌: 다우닝 시티와 여명의 날개";
  project.meta.author = "OPRN Flagship Studio";
  if (project.system.titleScreen) {
    project.system.titleScreen.title = "아스트라 호라이즌: 다우닝 시티와 여명의 날개";
    project.system.titleScreen.logoSubtitle = "다우닝 시티에서 시작하는 몬스터 수집·진화·체육관 원정 RPG";
  }

  // Remap starter evolution line names to canonical Flagship #2 names
  for (const sp of project.database.monsterSpecies ?? []) {
    const renamed = STARTER_NAME_REMAP[sp.id];
    if (renamed) {
      sp.name = renamed;
    }
  }
  for (const enemy of project.database.enemies) {
    const renamed = STARTER_NAME_REMAP[enemy.id];
    if (renamed) {
      enemy.name = renamed;
    }
  }
  replaceTextDeep(project.maps);
  replaceTextDeep(project.system.monsterCampaign);

  const mapTitleRemap: Readonly<Record<string, string>> = {
    mx_map_home_house_2f: "다우닝 시티 · 내 방 2층",
    mx_map_home_house: "다우닝 시티 · 우리 집 1층",
    mx_map_home: "다우닝 시티",
    mx_map_home_center: "다우닝 시티 · 회복 센터 1층",
    mx_map_home_center_2f: "다우닝 시티 · 회복 센터 2층",
    mx_map_home_mart: "다우닝 시티 · 프렌들리숍",
    mx_map_school: "다우닝 트레이너 아카데미",
    mx_map_lab: "오르비스 천문 연구소 · 1층",
    mx_map_meadow: "1번 도로 · 여명 해안길",
    mx_map_grove: "실바나 숲 마을",
    mx_map_grove_center: "실바나 회복 센터 1층",
    mx_map_grove_center_2f: "실바나 회복 센터 2층",
    mx_map_grove_mart: "실바나 프렌들리숍",
    mx_map_grove_gym: "실바나 체육관",
    mx_map_garden: "2번 도로 · 솔방울 언덕",
    mx_map_observatory: "아스트라 천문대 · 창공 성소",
    mx_map_league_0: "아스트라 호라이즌 · 챔피언 전당",
  };
  for (const [mapId, title] of Object.entries(mapTitleRemap)) {
    const m = project.maps[mapId];
    if (m) m.name = title;
  }

  // Rebuild the 6-shot opening animatic after title/map remapping so subtitles & Dawning Skybird sprites match
  configureEmeraldMonsterOpening(project);
  if (project.system.titleScreen) {
    project.system.titleScreen.logoSubtitle = "다우닝 시티에서 시작하는 몬스터 수집·진화·체육관 원정 RPG";
  }

  // Install 2F stairs (`stairs_up` / `stairs_down`) in player's home and Orbis Astronomical Lab
  installInteriorStairsAndLab2F(project);

  // Add a companion actor so Follower Companion (`changeParty`) works visibly alongside the monster party
  const followerActorId = "actor_emerald_companion_naru";
  const baseActor = project.database.actors[0]!;
  const trainerCharsetId = baseActor.characterResourceId || "oprn-charset-scarloxy-people1";
  if (!project.database.actors.some((a) => a.id === followerActorId)) {
    project.database.actors.push({
      ...structuredClone(baseActor),
      id: followerActorId,
      name: "나루",
      nickname: "다우닝 시티의 동료 트레이너",
      characterResourceId: trainerCharsetId,
      characterIndex: 1,
      initialLevel: 12,
    });
  }

  // Ensure canonical endings exist (Hall of Fame + Complete Pokedex)
  project.endings = [
    {
      id: "mx_ending_starlight",
      name: "아스트라 호라이즌 · 다우닝 시티 명예의 전당",
      conditions: [{ kind: "switch", switchId: "mx_ending", value: true }],
      priority: 100,
      presentation: {
        tone: "warm",
        credits:
          "아스트라 호라이즌: 다우닝 시티와 여명의 날개\n토리프 · 아쿠링 · 파이린과 함께한 다우닝 시티의 여정\n기획·도트·연출: OPRN Flagship Studio",
      },
    },
    {
      id: "mx_ending_pokedex",
      name: "아스트라 도감 마스터 · 여명의 날개 수호자",
      conditions: [{ kind: "switch", switchId: "mx_ending_dex", value: true }],
      priority: 90,
      presentation: {
        tone: "warm",
        credits:
          "아스트라 호라이즌: 도감 마스터\n다우닝 시티와 아스트라 천문대의 모든 서식지를 밝혔습니다.",
      },
    },
  ];
  if (!project.switches.some((s) => s.id === "mx_ending_dex")) {
    project.switches.push({ id: "mx_ending_dex", name: "도감 마스터 엔딩" });
  }
  if (!project.switches.some((s) => s.id === "sw_emerald_vine_gate")) {
    project.switches.push({ id: "sw_emerald_vine_gate", name: "다우닝 시티 덩굴 수문 개방" });
  }

  // Overhaul `mx_map_home` into the 30x24 Dawning City (다우닝 시티) metropolitan hub
  const homeMap = project.maps[project.startMapId]!;
  const overworldTemplate = (mapTemplates as unknown as Record<string, TownTemplate>)["overworld/map"]!;
  composeTown(project, homeMap, overworldTemplate, DAWNING_CITY_SKETCH);
  homeMap.events = homeMap.events.filter((e) => e.id !== "mx_map_home_opening");

  // Retarget building doorways and northern Route 1 gate to match the 30x24 Dawning City layout
  const portalCoords: Readonly<Record<string, { readonly x: number; readonly y: number; readonly returnMapId?: string; readonly returnX?: number; readonly returnY?: number }>> = {
    mx_map_home_to_mx_map_home_house: { x: 9, y: 9, returnMapId: "mx_map_home_house", returnX: 9, returnY: 10 },
    mx_map_home_to_mx_map_lab: { x: 18, y: 9, returnMapId: "mx_map_lab", returnX: 18, returnY: 10 },
    mx_map_home_to_mx_map_school: { x: 24, y: 10, returnMapId: "mx_map_school", returnX: 24, returnY: 11 },
    mx_map_home_to_mx_map_home_mart: { x: 3, y: 14, returnMapId: "mx_map_home_mart", returnX: 3, returnY: 15 },
    mx_map_home_to_mx_map_home_center: { x: 9, y: 14, returnMapId: "mx_map_home_center", returnX: 9, returnY: 15 },
    mx_map_home_to_mx_map_meadow: { x: 14, y: 2, returnMapId: "mx_map_meadow", returnX: 14, returnY: 3 },
    mx_map_home_sign_mx_map_meadow: { x: 15, y: 5 },
    mx_map_home_guide: { x: 12, y: 11 },
    mx_map_home_local: { x: 6, y: 10 },
    mx_map_home_visit: { x: 14, y: 17 },
    mx_map_home_ambient_resident_1: { x: 7, y: 16 },
    mx_map_home_ambient_resident_2: { x: 20, y: 11 },
  };
  for (const ev of homeMap.events) {
    const next = portalCoords[ev.id];
    if (next) {
      ev.x = next.x;
      ev.y = next.y;
      if (next.returnMapId && next.returnX !== undefined && next.returnY !== undefined) {
        retargetReturnPortal(project.maps[next.returnMapId], homeMap.id, next.returnX, next.returnY);
      }
    }
  }

  // Add Dawning Coast Cafe doorway (`shop_a` at (25, 16))
  homeMap.events.push(
    createBelowTouchEvent("ev_dawning_cafe_door", "다우닝 해안 전망 카페", 25, 16, [
      {
        kind: "text",
        speaker: "전망 카페 바리스타",
        body: "다우닝 해안 전망 카페에 어서 오세요! 여명갈매기가 나는 바다를 보며 허브차 한잔 드시고 동료들의 체력도 모두 회복하세요!",
      },
      { kind: "recoverAll" },
    ]),
  );

  // Place player spawn at the heart of Dawning City Plaza (14, 10)
  const spawn = { x: 14, y: 10 };
  project.startPos = spawn;

  // North of spawn (14, 9): Professor's Outdoor Starter & Vine Gate Switch (`changeTile` + Starter + Follower Companion `changeParty`)
  const profPos = { x: spawn.x, y: spawn.y - 1 };
  const openTile = homeMap.lowerTiles[spawn.y * homeMap.width + (spawn.x - 2)] ?? 0;

  const giveStarterBranch = (speciesId: string, label: string): Command[] => [
    { kind: "giveMonster", speciesId, level: 18, nickname: label },
    { kind: "changeParty", action: "add", actorId: followerActorId },
    { kind: "changeTile", mapId: homeMap.id, layer: "lower", x: profPos.x, y: profPos.y, tile: openTile },
    { kind: "changeItem", itemId: "item_capture_orb", op: "+=", amount: 10 },
    { kind: "changeItem", itemId: "item_hi_potion", op: "+=", amount: 5 },
    { kind: "setSwitch", switchId: "mx_starter", value: true },
    { kind: "setSwitch", switchId: `mx_starter_${speciesId}`, value: true },
    { kind: "setSwitch", switchId: "sw_emerald_vine_gate", value: true },
    {
      kind: "text",
      speaker: "천문박사",
      body: `좋아! 첫 파트너 『${label}』와 동료 트레이너 『나루』가 합류하고, 1번 도로로 향하는 여명의 수문이 열렸다! 포획구슬 10개도 챙겨 주마!`,
    },
  ];

  const profEvent: GameEvent = {
    id: "ev_emerald_prof_starter",
    name: "천문박사 · 파트너 선택 & 여명 수문",
    x: profPos.x,
    y: profPos.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "ev_emerald_prof_starter_p1",
        name: "파트너 선택 전",
        conditions: [],
        graphic: {
          sprite: { type: "bundled", id: "tex_oprn_charset_scarloxy_people1" },
          direction: "down",
          pattern: charsetFrameIndex({ characterIndex: 4, direction: "down", pattern: 1 }),
          transparent: false,
        },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        priority: "same",
        overlapForbidden: true,
        trigger: { kind: "action" },
        commands: [
          {
            kind: "text",
            speaker: "천문박사",
            body: "다우닝 시티의 하늘에 여명의 날개 새떼가 모여들고 있단다! 세 몬스터볼 중 너와 함께 걸을 첫 파트너를 골라 여명 수문을 열어 보렴!",
          },
          {
            kind: "choices",
            prompt: "함께 모험을 떠날 첫 파트너를 선택하세요",
            options: [
              { text: "풀 타입 『토리프』 (토리프 → 실바리온 → 벨데로드)", branch: giveStarterBranch("mx_species_spriglet", "토리프") },
              { text: "물 타입 『아쿠링』 (아쿠링 → 마린웨이 → 네레이드)", branch: giveStarterBranch("mx_species_rivulet", "아쿠링") },
              { text: "불·격투 타입 『파이린』 (파이린 → 볼케이건 → 마그렉스)", branch: giveStarterBranch("mx_species_coalbit", "파이린") },
            ],
          },
        ],
      },
      {
        id: "ev_emerald_prof_starter_p2",
        name: "파트너 선택 후",
        conditions: [{ kind: "switch", switchId: "mx_starter", value: true }],
        graphic: {
          sprite: { type: "bundled", id: "tex_oprn_charset_scarloxy_people1" },
          direction: "down",
          pattern: charsetFrameIndex({ characterIndex: 4, direction: "down", pattern: 1 }),
          transparent: false,
        },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        priority: "same",
        overlapForbidden: true,
        trigger: { kind: "action" },
        commands: [
          {
            kind: "text",
            speaker: "천문박사",
            body: "여명 수문이 열렸단다! 바로 오른쪽의 『관장 유림』에게 말을 걸어 실바나 체육관과 아스트라 천문대 원정에 나서거나, 우리 집·연구소 2층 계단도 둘러보렴!",
          },
        ],
      },
    ],
  };
  homeMap.events.push(profEvent);

  // East of spawn (15, 10): Gym Leader Yoorim + Astra Observatory Guardian Battle & Hall of Fame Ending
  const guidePos = { x: spawn.x + 1, y: spawn.y };
  const gymMap = project.maps["mx_map_grove_gym"];
  const caveMap = project.maps["mx_map_observatory"];
  const labMap = project.maps["mx_map_lab"];
  const gymTroopId =
    project.database.troops.find((t) => t.id.includes("grove_gym_leader"))?.id ??
    project.database.troops.find((t) => t.id.includes("leader"))?.id ??
    project.database.troops[0]!.id;

  // Lower the first gym troop's enemy HP slightly so a single starter wins cleanly in showcase & play
  const gymTroop = project.database.troops.find((t) => t.id === gymTroopId);
  if (gymTroop?.members) {
    for (const member of gymTroop.members) {
      const enemy = project.database.enemies.find((e) => e.id === member.enemyId);
      if (enemy) {
        enemy.stats = {
          ...enemy.stats,
          maxHp: 22,
          attack: 5,
          defense: 3,
          agility: 4,
        };
      }
    }
  }

  homeMap.events.push({
    id: "ev_emerald_expedition_hub",
    name: "실바나 체육관 관장 유림 & 아스트라 천문대 결전",
    x: guidePos.x,
    y: guidePos.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "ev_emerald_expedition_hub_p1",
        name: "원정 도전",
        conditions: [],
        graphic: {
          sprite: { type: "bundled", id: "tex_oprn_charset_scarloxy_people1" },
          direction: "left",
          pattern: charsetFrameIndex({ characterIndex: 2, direction: "left", pattern: 1 }),
          transparent: false,
        },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        priority: "same",
        overlapForbidden: true,
        trigger: { kind: "action" },
        commands: [
          {
            kind: "text",
            speaker: "관장 유림",
            body: "안녕! 실바나 체육관 관장 유림이야. 다우닝 시티에서 출발하는 8개 구역 탐험이나 새잎 배지 시합, 아스트라 천문대 정상 결전으로 안내해 줄게!",
          },
          {
            kind: "choices",
            prompt: "어느 여정을 진행할까요?",
            options: [
              {
                text: "관장 유림 & 아스트라 천문대 수호자 연속 시합 (배지 수여 → 전당 등록 엔딩)",
                branch: [
                  {
                    kind: "text",
                    speaker: "관장 유림",
                    body: "여명의 날개와 함께 여기까지 왔구나! 실바나 체육관의 새잎 배지를 걸고 정정당당하게 승부하자!",
                  },
                  {
                    kind: "battleProcessing",
                    troopId: gymTroopId,
                    canEscape: true,
                    canLose: true,
                    branchOnResult: true,
                    victoryBranch: [
                      { kind: "setSwitch", switchId: "mx_badge_1", value: true },
                      { kind: "setSwitch", switchId: "mx_story_beacon", value: true },
                      { kind: "setSwitch", switchId: "mx_ending", value: true },
                      {
                        kind: "text",
                        speaker: "관장 유림",
                        body: "대단해! 너와 파트너의 호흡이 아스트라 천문대의 등불을 다시 밝혔어! 『새잎 배지』와 다우닝 시티 명예의 전당 자격을 수여할게!",
                      },
                      { kind: "triggerEnding", endingId: "mx_ending_starlight" },
                    ],
                    defeatBranch: [
                      { kind: "recoverAll" },
                      { kind: "setSwitch", switchId: "mx_badge_1", value: true },
                      { kind: "setSwitch", switchId: "mx_ending", value: true },
                      { kind: "text", speaker: "관장 유림", body: "끝까지 포기하지 않는 마음, 정말 멋졌어! 다우닝 시티 명예의 전당으로 가자!" },
                      { kind: "triggerEnding", endingId: "mx_ending_starlight" },
                    ],
                    escapeBranch: [],
                  },
                ],
              },
              ...(gymMap
                ? [
                    {
                      text: "실바나 체육관 내부로 이동 (덩굴 스위치 퍼즐 직접 조작)",
                      branch: [{ kind: "transfer" as const, mapId: gymMap.id, x: 8, y: 18 }],
                    },
                  ]
                : []),
              ...(labMap
                ? [
                    {
                      text: "오르비스 천문 연구소 실내로 이동 (1층 · 2층 계단 연결)",
                      branch: [{ kind: "transfer" as const, mapId: labMap.id, x: 7, y: 8 }],
                    },
                  ]
                : []),
              ...(caveMap
                ? [
                    {
                      text: "아스트라 천문대 · 창공 성소로 이동",
                      branch: [{ kind: "transfer" as const, mapId: caveMap.id, x: Math.floor(caveMap.width / 2), y: Math.floor(caveMap.height / 2) }],
                    },
                  ]
                : []),
            ],
          },
        ],
      },
    ],
  });

  // Populate Dawning Skybirds (`oprn-charset-dawning-skybirds`) across Dawning City, Route 1, and Astra Observatory
  homeMap.events.push(
    createSkybirdEvent(
      "ev_dawning_skybird_gull",
      "다우닝 연못 여명갈매기",
      16,
      11,
      0,
      "left",
      "여명갈매기",
      "끼룩— 끼르륵! (여명갈매기가 다우닝 시티 광장 연못 위에서 푸른 날개를 활짝 펴고 바람을 탄다.)",
    ),
    createSkybirdEvent(
      "ev_dawning_skybird_swallow",
      "다우닝 광장 창공제비",
      12,
      8,
      1,
      "right",
      "창공제비",
      "지지배배—! (창공제비가 우리 집과 오르비스 천문 연구소 지붕 사이를 날렵하게 스쳐 날아간다.)",
    ),
    createSkybirdEvent(
      "ev_dawning_skybird_flock",
      "여명의 날개 새떼 편대",
      13,
      7,
      3,
      "right",
      "여명의 새떼",
      "푸드득—! (새벽빛을 머금은 제비 편대가 다우닝 시티 상공을 가로지르며 1번 도로 쪽을 가리킨다.)",
      "above",
    ),
  );

  const meadowMap = project.maps["mx_map_meadow"];
  if (meadowMap) {
    meadowMap.events.push(
      createSkybirdEvent(
        "ev_meadow_skybird_finch",
        "1번 도로 별빛방울새",
        11,
        11,
        2,
        "left",
        "별빛방울새",
        "뾰로롱—! (별빛방울새가 1번 도로 풀숲 위를 맴돌며 야생 몬스터의 기척을 알려 준다.)",
      ),
      createSkybirdEvent(
        "ev_meadow_skybird_kingfisher",
        "1번 도로 황혼물총새",
        8,
        13,
        6,
        "right",
        "황혼물총새",
        "키르르—! (청록빛 날개의 황혼물총새가 해안 바람을 타고 낮게 활공한다.)",
      ),
    );
  }

  if (caveMap) {
    caveMap.events.push(
      createSkybirdEvent(
        "ev_observatory_skybird_astra",
        "창공 성소 아스트라별새",
        9,
        7,
        7,
        "down",
        "아스트라별새",
        "아아— 끼르륵! (전설로 전해지는 아스트라별새가 창공 성소 제단 위에서 황금빛 깃털을 흩날린다.)",
      ),
    );
  }

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  const manifest = {
    ...FLAGSHIP_BEAT_MANIFESTS["emerald-crown"],
    mapCount: Object.keys(reloaded.maps).length,
    endingCount: reloaded.endings?.length ?? 0,
  };
  return {
    id: "emerald-crown",
    manifest,
    project: reloaded,
    serialized,
  };
}
