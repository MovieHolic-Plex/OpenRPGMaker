import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { canMove, isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { blankFillTileFor, createStarterMap } from "@/project/defaults/defaultMaps";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import { deserialize, serialize } from "@/project/io";
import { applyRomanceDefaults } from "@/project/romancePreset";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import type { FlagshipDemoBuildResult } from "./types";

function execTool(project: Project, name: string, args: Record<string, unknown>): void {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) {
    throw new Error(`[shitamachi-fourth-season] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  }
  Object.assign(project, ctx.project);
}

function buildShitamachiOpening(project: Project): void {
  project.system.opening = { enabled: true, skippable: true, scenes: [] };
  const shots = [
    {
      id: "sm_shot_1",
      bg: "oprn-still-lullaby",
      caption: "도쿄 시타마치 — 개화 상점가 아케이드 지붕 위로 네 번째 계절의 햇살이 내린다.",
      actorIndex: 0,
    },
    {
      id: "sm_shot_2",
      bg: "oprn-still-moon-meadow",
      caption: "아침 통학 전철과 캠퍼스 — 학생회장 서연과 보내는 분주한 방과후.",
      actorIndex: 4,
    },
    {
      id: "sm_shot_3",
      bg: "oprn-still-harbor",
      caption: "상점가 베이커리 카페에서 기다리는 소꿉친구 지호의 따뜻한 미소.",
      actorIndex: 5,
    },
    {
      id: "sm_shot_4",
      bg: "oprn-still-farm-golden",
      caption: "노을 진 학교 옥상과 시타마치 대중목욕탕 골목에서 마주친 유나.",
      actorIndex: 6,
    },
    {
      id: "sm_shot_5",
      bg: "oprn-still-forest-path",
      caption: "문화제 전야제 — 아케이드 등롱에 불이 켜지면, 네 번째 계절의 고백이 시작된다.",
      actorIndex: 4,
    },
  ] as const;

  for (const [idx, s] of shots.entries()) {
    execTool(project, "create_opening_animatic_shot", {
      shotId: s.id,
      durationMs: 4200,
      width: 384,
      height: 216,
      background: s.bg,
      narration: s.caption,
      replace: true,
      clearLayers: true,
    });
    execTool(project, "set_opening_pixel_grid", {
      shotId: s.id,
      width: 384,
      height: 216,
    });
    if (idx === 0) {
      const sc = project.system.opening?.scenes[0];
      if (sc?.kind === "animatic") delete sc.composition.transition;
    }
    execTool(project, "place_opening_background", {
      shotId: s.id,
      layerId: "bg",
      resourceId: s.bg,
    });
    execTool(project, "place_opening_charset_actor", {
      shotId: s.id,
      layerId: "actor",
      charsetResourceId: "oprn-charset-modern1",
      characterIndex: s.actorIndex,
      direction: "right",
      scale: 1,
      x: 112 + idx * 8,
      y: 136,
      fromX: 100 + idx * 8,
      toX: 176 + idx * 8,
      durationMs: 3900,
      stride: 8,
    });
    execTool(project, "upsert_opening_light_fx", {
      shotId: s.id,
      layerId: "glow",
      kind: "glow",
      x: 192,
      y: 96,
      width: 96,
      height: 96,
      color: "#ffd6a5",
      blend: "lighter",
      inner: 0.25,
      pulse: { hz: 0.6, amount: 0.25, pattern: "pulse", seed: idx + 1 },
    });
    execTool(project, "set_opening_caption", {
      shotId: s.id,
      layerId: "caption",
      letterbox: 0.15,
      color: "#fff4e6",
      cues: [{ atMs: 200, text: s.caption, typewriterMs: 1000 }],
    });
  }
}

export function createShitamachiFourthSeasonFlagshipDemo(): FlagshipDemoBuildResult {
  const project = createBlankProject();
  const initialBlankMapIds = Object.keys(project.maps);

  project.meta.title = "시타마치의 네 번째 계절";
  project.meta.author = "OPRN Flagship Studio";

  const hero = project.database.actors.find((a) => a.id === DEFAULT_ACTOR_ID) ?? project.database.actors[0];
  if (hero) {
    hero.name = "하진";
    hero.nickname = "시타마치 전학생";
    hero.characterResourceId = "oprn-charset-modern1";
    hero.characterIndex = 0;
    const heroFace = reviewedFaceIdForCharset("tex_oprn_charset_modern1", 0);
    if (heroFace) hero.faceResourceId = heroFace;
    else delete hero.faceResourceId;
  }

  execTool(project, "set_title_screen", {
    title: "시타마치의 네 번째 계절",
    backgroundResourceId: "oprn-still-lullaby",
    logoStyle: "glow",
  });

  buildShitamachiOpening(project);

  // 1) Shitamachi Covered Arcade Street Hub (#2943)
  const hubMapId = "map_shitamachi_arcade";
  project.tilesets[JP_CITY_ID] = createJpCityTileset();
  const hubMap = createStarterMap();
  hubMap.id = hubMapId;
  hubMap.name = "시타마치 개화 상점가 아케이드";
  hubMap.tilesetId = JP_CITY_ID;
  hubMap.width = 40;
  hubMap.height = 28;
  hubMap.lowerTiles = new Array(40 * 28).fill(blankFillTileFor(JP_CITY_ID));
  hubMap.upperTiles = new Array(40 * 28).fill(-1);
  project.maps[hubMapId] = hubMap;
  execTool(project, "compose_jp_city_street", {
    mapId: hubMapId,
    style: "shotengai",
    seed: 11,
    replace: true,
  });

  // 2) 8 Core Daily Routine Interior Venues (#2944)
  // 통학 전철 객차는 jp_city 의 손 도트 견본(jp_station 의 train-car)을 그대로 쓴다 - 나머지는 modern_city 일상 견본.
  const interiorSpecs = [
    { mapId: "map_venue_house", name: "하진의 자취방 · 아침", tileset: "modern_city", room: "mc_house", seed: 1 },
    { mapId: "map_venue_train", name: "시타마치 통학 전철 객차", tileset: JP_CITY_ID, room: "train-car", seed: 1 },
    { mapId: "map_venue_school", name: "세이화 학원 교실 · 복도", tileset: "modern_city", room: "mc_school_building", seed: 3 },
    { mapId: "map_venue_council", name: "학생회실 · 문화제 준비", tileset: "modern_city", room: "mc_council_room", seed: 4 },
    { mapId: "map_venue_gym", name: "실내 체육관 · 농구 코트", tileset: "modern_city", room: "mc_gym", seed: 5 },
    { mapId: "map_venue_rooftop", name: "학교 옥상 · 노을 전망대", tileset: "modern_city", room: "mc_rooftop", seed: 6 },
    { mapId: "map_venue_bakery", name: "아케이드 베이커리 카페", tileset: "modern_city", room: "mc_bakery_cafe", seed: 7 },
    { mapId: "map_venue_sento", name: "시타마치 대중목욕탕 · 센토", tileset: "modern_city", room: "mc_sento", seed: 8 },
  ] as const;

  for (const v of interiorSpecs) {
    execTool(project, "build_hand_interior_room", {
      mapId: v.mapId,
      name: v.name,
      tileset: v.tileset,
      replace: true,
      layout: {
        program: v.room,
        seed: v.seed,
        furnish: true,
      },
    });
  }

  for (const blankId of initialBlankMapIds) {
    if (blankId !== hubMapId && project.maps[blankId]) {
      delete project.maps[blankId];
    }
  }

  const hub: GameMap = project.maps[hubMapId]!;
  let spawn = { x: 20, y: 14 };
  for (let r = 0; r < 14; r++) {
    let found: { x: number; y: number } | undefined;
    for (let dy = -r; dy <= r && !found; dy++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        const cx = 20 + dx;
        const cy = 14 + dy;
        if (cx < 2 || cy < 2 || cx >= hub.width - 2 || cy >= hub.height - 2) continue;
        if (!isPassable(project, hub, cx, cy)) continue;
        if (hub.events.some((e) => Math.abs(e.x - cx) + Math.abs(e.y - cy) <= 1)) continue;
        if (canMove(project, hub, cx, cy, cx, cy - 1) && canMove(project, hub, cx, cy, cx + 1, cy)) {
          found = { x: cx, y: cy };
        }
      }
    }
    if (found) {
      spawn = found;
      break;
    }
  }

  project.startMapId = hubMapId;
  project.startPos = spawn;
  project.mapTree = {
    mapId: hubMapId,
    children: interiorSpecs.map((v) => ({ mapId: v.mapId, children: [] })),
  };

  // Register variables and switches for heroine affection & festival lantern state
  const ensureVar = (id: string, name: string): void => {
    if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name });
  };
  ensureVar("var_aff_seoyeon", "서연 호감도");
  ensureVar("var_aff_jiho", "지호 호감도");
  ensureVar("var_aff_yuna", "유나 호감도");

  const ensureSw = (id: string, name: string): void => {
    if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
  };
  ensureSw("sw_shitamachi_lantern_lit", "시타마치 문화제 아케이드 점등");

  // 4 Canonical Endings (3 Heroine True Routes + 1 Friendship Route)
  execTool(project, "define_ending", {
    id: "end_shitamachi_seoyeon",
    name: "서연 트루 엔딩 · 학생회실의 첫눈과 네 번째 계절",
    conditions: [],
    epilogue: [
      { kind: "say", speaker: "서연", text: "하진아, 상점가 아케이드 등롱 아래서 네가 건네준 그 말… 평생 잊지 않을게." },
      { kind: "say", speaker: "하진", text: "다음 계절이 와도 우리는 이 시타마치 거리에서 함께 걸어갈 거야." },
    ],
  });
  execTool(project, "define_ending", {
    id: "end_shitamachi_jiho",
    name: "지호 트루 엔딩 · 베이커리 카페의 아침 향기",
    conditions: [],
    epilogue: [
      { kind: "say", speaker: "지호", text: "갓 구운 크루아상 냄새가 나는 상점가에서, 매일 아침 너와 인사할 수 있어서 행복해!" },
    ],
  });
  execTool(project, "define_ending", {
    id: "end_shitamachi_yuna",
    name: "유나 트루 엔딩 · 노을빛 옥상과 센토 골목의 약속",
    conditions: [],
    epilogue: [
      { kind: "say", speaker: "유나", text: "전철 창밖으로 스쳐 가던 노을이 이제는 우리의 계절이 되었네." },
    ],
  });
  execTool(project, "define_ending", {
    id: "end_shitamachi_friends",
    name: "시타마치 청춘 엔딩 · 우리들의 아케이드 문화제",
    conditions: [],
    epilogue: [
      { kind: "say", speaker: "서연", text: "서연, 지호, 유나, 그리고 하진까지— 시타마치 상점가의 가장 빛나는 문화제였어!" },
    ],
  });
  const currentHub: GameMap = project.maps[hubMapId]!;
  // North of spawn: Seoyeon & Festival Lantern Board (`changeTile` + `dual-fullbody-veil` 1024x768 portrait dialogue + venue tour)
  const seoyeonPos = { x: spawn.x, y: spawn.y - 1 };
  const curTile = currentHub.lowerTiles[seoyeonPos.y * currentHub.width + seoyeonPos.x] ?? 0;
  const festivalTile =
    currentHub.lowerTiles.find((t, idx) => t >= 0 && t !== curTile && isPassable(project, currentHub, idx % currentHub.width, Math.floor(idx / currentHub.width))) ?? curTile;
  const seoyeonEvent: GameEvent = {
    id: "ev_shitamachi_seoyeon",
    name: "학생회장 서연 · 아케이드 문화제 게시판",
    x: seoyeonPos.x,
    y: seoyeonPos.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "ev_shitamachi_seoyeon_p1",
        name: "서연과 대화",
        conditions: [],
        graphic: {
          sprite: { type: "bundled", id: "tex_oprn_charset_modern1" },
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
            speaker: "서연",
            body: "하진아, 마침 잘 왔어! 시타마치 아케이드 상점가 문화제 준비를 함께해 줄래?",
          },
          {
            kind: "choices",
            prompt: "서연과 어떤 일정을 함께할까?",
            options: [
              {
                text: "상점가 문화제 아케이드 등롱을 점등하고 서연을 돕는다 (호감도 상승 & 거리 점등)",
                branch: [
                  { kind: "changeTile", mapId: hubMapId, layer: "lower", x: seoyeonPos.x, y: seoyeonPos.y, tile: festivalTile },
                  { kind: "setVariable", variableId: "var_aff_seoyeon", op: "+=", value: 30 },
                  { kind: "setSwitch", switchId: "sw_shitamachi_lantern_lit", value: true },
                  {
                    kind: "text",
                    speaker: "서연",
                    body: "와아… 아케이드 지붕 아래 등롱이 하나씩 켜졌어! 고마워 하진아, 이제 바로 옆 『문화제 고백 무대』에서 네 마음을 전해 줘!",
                  },
                ],
              },
              {
                text: "일상 실내 명소 둘러보기 (학생회실 · 베이커리 카페 · 옥상 · 센토)",
                branch: [
                  {
                    kind: "choices",
                    prompt: "어느 실내 장소로 이동할까?",
                    options: [
                      { text: "학생회실 (mc_council_room)", branch: [{ kind: "transfer", mapId: "map_venue_council", x: 9, y: 8 }] },
                      { text: "아케이드 베이커리 카페 (mc_bakery_cafe)", branch: [{ kind: "transfer", mapId: "map_venue_bakery", x: 9, y: 8 }] },
                      { text: "학교 옥상 노을 전망대 (mc_rooftop)", branch: [{ kind: "transfer", mapId: "map_venue_rooftop", x: 10, y: 7 }] },
                      { text: "시타마치 대중목욕탕 센토 (mc_sento)", branch: [{ kind: "transfer", mapId: "map_venue_sento", x: 11, y: 8 }] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  currentHub.events.push(seoyeonEvent);

  // East of spawn: Jiho & Yuna Festival Confession Stage (multi-route confession -> Ending)
  // 등롱 점등(sw_shitamachi_lantern_lit) 전에는 무대가 열리지 않는다 — 예전에는 조건 없는 페이지가 스폰
  // 바로 옆에 있어 새 게임 첫 프레임부터 고백 선택지(엔딩 직행)가 열렸다(2026-10-23 필드 QA F2).
  // 잠긴 페이지는 안내만 하고, 점등 뒤에 조건 페이지(마지막 일치 우선)가 무대 그림과 선택지를 낸다.
  const stagePos = { x: spawn.x + 1, y: spawn.y };
  const confessionLockedPage: EventPage = {
    id: "ev_shitamachi_confession_locked",
    name: "문화제 준비 중",
    conditions: [],
    graphic: { transparent: true },
    movement: { type: "fixed", speed: 3, frequency: 3 },
    priority: "same",
    overlapForbidden: true,
    trigger: { kind: "action" },
    commands: [
      {
        kind: "text",
        speaker: "지호",
        body: "아직 아케이드 등롱이 켜지지 않았어. 서연이랑 문화제 준비를 먼저 마치자!",
      },
    ],
  };
  const confessionPage: EventPage = {
    id: "ev_shitamachi_confession_p1",
    name: "문화제 고백 무대",
    conditions: [{ kind: "switch", switchId: "sw_shitamachi_lantern_lit", value: true }],
    graphic: {
      sprite: { type: "bundled", id: "tex_oprn_charset_modern2" },
      direction: "left",
      pattern: charsetFrameIndex({ characterIndex: 0, direction: "left", pattern: 1 }),
      transparent: false,
    },
    movement: { type: "fixed", speed: 3, frequency: 3 },
    priority: "same",
    overlapForbidden: true,
    trigger: { kind: "action" },
    commands: [
      {
        kind: "text",
        speaker: "지호",
        body: "하진아! 문화제 전야제의 아케이드 종이 울렸어. 네 번째 계절의 마지막 페이지, 누구에게 마음을 전할 거야?",
      },
      {
        kind: "choices",
        prompt: "문화제 전야제 — 누구와 네 번째 계절을 맞이할까요?",
        options: [
          {
            text: "학생회장 『서연』에게 고백한다 (서연 트루 엔딩)",
            branch: [
              {
                kind: "text",
                speaker: "서연",
                body: "하진아… 나도 처음 전학 왔던 날부터 줄곧 너를 좋아했어. 우리 둘만의 네 번째 계절을 시작하자!",
              },
              { kind: "triggerEnding", endingId: "end_shitamachi_seoyeon" },
            ],
          },
          {
            text: "베이커리 카페의 『지호』에게 고백한다 (지호 트루 엔딩)",
            branch: [
              {
                kind: "text",
                speaker: "지호",
                body: "정말이지…? 내일 아침부터는 카페 2층 창가 자리가 우리 둘의 지정석이야!",
              },
              { kind: "triggerEnding", endingId: "end_shitamachi_jiho" },
            ],
          },
          {
            text: "옥상 전망대의 『유나』에게 고백한다 (유나 트루 엔딩)",
            branch: [
              {
                kind: "text",
                speaker: "유나",
                body: "노을 진 옥상에서 네가 불러 준 이름, 앞으로도 매일 들려줘.",
              },
              { kind: "triggerEnding", endingId: "end_shitamachi_yuna" },
            ],
          },
          {
            text: "모두와 함께 아케이드 문화제를 즐긴다 (우정 엔딩)",
            branch: [{ kind: "triggerEnding", endingId: "end_shitamachi_friends" }],
          },
        ],
      },
    ],
  };
  currentHub.events.push({
    id: "ev_shitamachi_confession",
    name: "지호 & 유나 · 문화제 고백 무대",
    x: stagePos.x,
    y: stagePos.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [confessionLockedPage, confessionPage],
  });

  // Apply 1024x768 dual-fullbody-veil romance defaults
  applyRomanceDefaults(project);

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  const manifest = {
    ...FLAGSHIP_BEAT_MANIFESTS["shitamachi-fourth-season"],
    mapCount: Object.keys(reloaded.maps).length,
    endingCount: reloaded.endings?.length ?? 0,
  };
  return {
    id: "shitamachi-fourth-season",
    manifest,
    project: reloaded,
    serialized,
  };
}
