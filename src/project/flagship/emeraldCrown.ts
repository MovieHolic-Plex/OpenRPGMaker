import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { canMove, isPassable } from "@/project/collision";
import { deserialize, serialize } from "@/project/io";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import type { Command, GameEvent, GameMap, Project } from "@/project/types";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
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
  ["별싹 마을", "새벽섬 마을"],
  ["별빛섬", "새벽섬"],
];

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

function findOpenNeighbor(
  project: Project,
  map: GameMap,
  origin: { readonly x: number; readonly y: number },
  avoid: ReadonlySet<string>,
): { readonly x: number; readonly y: number } {
  const offsets = [
    [0, 0],
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
    [1, -1],
    [-1, -1],
  ] as const;
  for (const [dx, dy] of offsets) {
    const x = origin.x + dx;
    const y = origin.y + dy;
    if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) continue;
    if (avoid.has(`${x},${y}`)) continue;
    if (!isPassable(project, map, x, y)) continue;
    if (map.events.some((e) => e.x === x && e.y === y)) continue;
    return { x, y };
  }
  return { x: origin.x, y: Math.max(1, origin.y - 1) };
}

export function createEmeraldCrownFlagshipDemo(): FlagshipDemoBuildResult {
  const { project } = createMonsterExpedition({
    firstGymType: "grass",
    gymCount: 1,
  });

  project.meta.title = "에메랄드 크라운: 새벽섬의 수호자";
  project.meta.author = "OPRN Flagship Studio";
  if (project.system.titleScreen) {
    project.system.titleScreen.title = "에메랄드 크라운: 새벽섬의 수호자";
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
    mx_map_home_house_2f: "내 방 · 2층",
    mx_map_home_house: "새벽섬 · 우리 집 1층",
    mx_map_home: "새벽섬 마을",
    mx_map_lab: "천문박사의 연구소",
    mx_map_meadow: "1번 도로 · 바람언덕 초원",
    mx_map_grove: "초록숲 관장 마을",
    mx_map_grove_center: "초록숲 회복 센터",
    mx_map_grove_mart: "초록숲 프렌들리숍",
    mx_map_grove_gym: "초록숲 체육관",
    mx_map_garden: "2번 도로 · 솔방울 언덕",
    mx_map_observatory: "에메랄드 동굴 · 정상 성소",
    mx_map_league_0: "에메랄드 크라운 · 챔피언 전당",
  };
  for (const [mapId, title] of Object.entries(mapTitleRemap)) {
    const m = project.maps[mapId];
    if (m) m.name = title;
  }

  // Add a companion actor so Follower Companion (`changeParty`) works visibly alongside the monster party
  const followerActorId = "actor_emerald_companion_naru";
  const baseActor = project.database.actors[0]!;
  const trainerCharsetId = baseActor.characterResourceId || "oprn-charset-scarloxy-people1";
  if (!project.database.actors.some((a) => a.id === followerActorId)) {
    project.database.actors.push({
      ...structuredClone(baseActor),
      id: followerActorId,
      name: "나루",
      nickname: "새벽섬의 동료 트레이너",
      characterResourceId: trainerCharsetId,
      characterIndex: 1,
      initialLevel: 12,
    });
  }

  // Ensure canonical endings exist (Hall of Fame + Complete Pokedex)
  project.endings = [
    {
      id: "mx_ending_starlight",
      name: "에메랄드 크라운 · 새벽섬 명예의 전당",
      conditions: [{ kind: "switch", switchId: "mx_ending", value: true }],
      priority: 100,
      presentation: {
        tone: "warm",
        credits:
          "에메랄드 크라운: 새벽섬의 수호자\n토리프 · 아쿠링 · 파이린과 함께한 새벽섬의 여정\n기획·도트·연출: OPRN Flagship Studio",
      },
    },
    {
      id: "mx_ending_pokedex",
      name: "새벽섬 도감 마스터 · 전설의 수호자",
      conditions: [{ kind: "switch", switchId: "mx_ending_dex", value: true }],
      priority: 90,
      presentation: {
        tone: "warm",
        credits:
          "에메랄드 크라운: 도감 마스터\n새벽섬의 모든 서식지와 에메랄드 동굴의 비밀을 밝혔습니다.",
      },
    },
  ];
  if (!project.switches.some((s) => s.id === "mx_ending_dex")) {
    project.switches.push({ id: "mx_ending_dex", name: "도감 마스터 엔딩" });
  }
  if (!project.switches.some((s) => s.id === "sw_emerald_vine_gate")) {
    project.switches.push({ id: "sw_emerald_vine_gate", name: "새벽섬 덩굴 수문 개방" });
  }

  // Place interactive Dawn Island Field Guide & Vine Switch right next to the player on `mx_map_home`
  const homeMap = project.maps[project.startMapId]!;
  // Remove auto-trigger intro popup if it blocks immediate movement, or keep it short
  homeMap.events = homeMap.events.filter((e) => e.id !== "mx_map_home_opening");

  let spawn = project.startPos;
  for (let r = 0; r < 10; r++) {
    let found: { x: number; y: number } | undefined;
    for (let dy = -r; dy <= r && !found; dy++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        const cx = spawn.x + dx;
        const cy = spawn.y + dy;
        if (cx < 2 || cy < 2 || cx >= homeMap.width - 2 || cy >= homeMap.height - 2) continue;
        if (!isPassable(project, homeMap, cx, cy)) continue;
        if (homeMap.events.some((e) => Math.abs(e.x - cx) + Math.abs(e.y - cy) <= 1)) continue;
        if (canMove(project, homeMap, cx, cy, cx, cy - 1) && canMove(project, homeMap, cx, cy, cx + 1, cy)) {
          found = { x: cx, y: cy };
        }
      }
    }
    if (found) {
      spawn = found;
      break;
    }
  }
  project.startPos = spawn;

  const avoid = new Set<string>([`${spawn.x},${spawn.y}`]);

  // North of spawn: Professor's Outdoor Starter & Vine Gate Switch (`changeTile` + Starter `토리프`/`아쿠링`/`파이린` + Follower Companion `changeParty`)
  const profPos = { x: spawn.x, y: spawn.y - 1 };
  avoid.add(`${profPos.x},${profPos.y}`);
  const curTile = homeMap.lowerTiles[profPos.y * homeMap.width + profPos.x] ?? 0;
  const openTile =
    homeMap.lowerTiles.find((t, idx) => t >= 0 && t !== curTile && isPassable(project, homeMap, idx % homeMap.width, Math.floor(idx / homeMap.width))) ??
    curTile;

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
      body: `좋아! 첫 파트너 『${label}』와 동료 트레이너 『나루』가 합류하고, 1번 도로로 향하는 덩굴 수문이 열렸다! 포획구슬 10개도 챙겨 주마!`,
    },
  ];

  const profEvent: GameEvent = {
    id: "ev_emerald_prof_starter",
    name: "천문박사 · 파트너 선택 & 덩굴 수문",
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
            body: "새벽섬의 에메랄드 등대가 흔들리고 있단다! 가방 속 세 몬스터볼 중 너와 함께 걸을 첫 파트너를 골라 덩굴 수문을 열어 보렴!",
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
            body: "덩굴 수문이 열렸단다! 바로 오른쪽의 『초록숲 체육관 & 에메랄드 동굴 원정대』에게 말을 걸거나 북쪽 길로 걸어가 보렴!",
          },
        ],
      },
    ],
  };
  homeMap.events.push(profEvent);

  // East of spawn: Gym Vine Switch + Gym Leader Yoorim + Emerald Cave Guardian Battle & Hall of Fame Ending
  const guidePos = findOpenNeighbor(project, homeMap, { x: spawn.x + 1, y: spawn.y }, avoid);
  avoid.add(`${guidePos.x},${guidePos.y}`);
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
    name: "초록숲 체육관 관장 유림 & 에메랄드 동굴 결전",
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
            body: "안녕! 초록숲 체육관 관장 유림이야. 새벽섬의 8개 구역 탐험이나 에메랄드 배지 시합, 에메랄드 동굴 정상 결전으로 안내해 줄게!",
          },
          {
            kind: "choices",
            prompt: "어느 여정을 진행할까요?",
            options: [
              {
                text: "관장 유림 & 에메랄드 동굴 수호자 연속 시합 (배지 수여 → 전당 등록 엔딩)",
                branch: [
                  {
                    kind: "text",
                    speaker: "관장 유림",
                    body: "덩굴 수문 장치를 풀고 여기까지 왔구나! 초록숲의 새잎 배지를 걸고 정정당당하게 승부하자!",
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
                        body: "대단해! 너와 파트너의 호흡이 새벽섬의 등대를 다시 밝혔어! 『새잎 배지』와 에메랄드 크라운 명예의 전당 자격을 수여할게!",
                      },
                      { kind: "triggerEnding", endingId: "mx_ending_starlight" },
                    ],
                    defeatBranch: [
                      { kind: "recoverAll" },
                      { kind: "setSwitch", switchId: "mx_badge_1", value: true },
                      { kind: "setSwitch", switchId: "mx_ending", value: true },
                      { kind: "text", speaker: "관장 유림", body: "끝까지 포기하지 않는 마음, 정말 멋졌어! 새벽섬 명예의 전당으로 가자!" },
                      { kind: "triggerEnding", endingId: "mx_ending_starlight" },
                    ],
                    escapeBranch: [],
                  },
                ],
              },
              ...(gymMap
                ? [
                    {
                      text: "초록숲 체육관 내부로 이동 (덩굴 스위치 퍼즐 직접 조작)",
                      branch: [{ kind: "transfer" as const, mapId: gymMap.id, x: 8, y: 18 }],
                    },
                  ]
                : []),
              ...(labMap
                ? [
                    {
                      text: "천문박사의 연구소 실내로 이동",
                      branch: [{ kind: "transfer" as const, mapId: labMap.id, x: 7, y: 8 }],
                    },
                  ]
                : []),
              ...(caveMap
                ? [
                    {
                      text: "에메랄드 동굴 · 정상 성소로 이동",
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
