import { createBlankProject } from "@/project/defaults";
import { charsetGraphic } from "@/editor/tools/eventCompile";
import { runTool } from "@/editor/tools";
import {
  runInteriorRoomPipeline,
  type InteriorRoomPlan,
} from "@/editor/interiorRoomPipeline";
import type { EventPage, GameEvent, Project } from "@/project/types";

export const NIGHT_MONSTER_PROJECT_ID = "rpg-zzu-night-monster-20260905";

export const NIGHT_MONSTER_MAP_IDS = {
  foyer: "map_night_foyer",
  bedroom: "map_night_bedroom",
  gallery: "map_night_study",
  chase: "map_night_corridor",
  finale: "map_night_basement",
} as const;

export const NIGHT_MONSTER_ITEM_ID = "item_blue_restoration_key";

export const NIGHT_MONSTER_SWITCH_IDS = {
  keyFound: "sw_blue_key_found",
  keyUsed: "sw_blue_key_used",
  sequenceSolved: "sw_gallery_sequence",
  truthHeard: "sw_truth_heard",
} as const;

export const NIGHT_MONSTER_ENDING_IDS = {
  truth: "ending_restore_truth",
  escape: "ending_leave_it_blue",
} as const;

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface NightMonsterManifest {
  readonly gallery: {
    readonly clueEventIds: readonly string[];
    readonly keyEventId: string;
    readonly sequenceEventIds: readonly string[];
    readonly itemGateEventId: string;
    readonly exitEventId: string;
    readonly keyAt: Point;
    readonly sequenceAt: readonly Point[];
    readonly itemGateAt: Point;
  };
  readonly chase: {
    readonly trapEventIds: readonly string[];
    readonly checkpointEventId: string;
    readonly chaserEventId: string;
    readonly exitEventId: string;
    readonly entryAt: Point;
    readonly trapAt: readonly Point[];
    readonly chaserAt: Point;
  };
  readonly finale: {
    readonly truthEventId: string;
    readonly truthEndingEventId: string;
    readonly escapeEndingEventId: string;
    readonly truthAt: Point;
    readonly truthEndingAt: Point;
    readonly escapeEndingAt: Point;
  };
}

export interface NightMonsterBuild {
  readonly project: Project;
  readonly manifest: NightMonsterManifest;
}

type ToolData = Record<string, unknown>;

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

function requireTool(
  context: { project: Project },
  name: string,
  args: Record<string, unknown>,
): ToolData {
  const result = runTool(context, name, args);
  if (!result.ok) {
    throw new Error(`${name}: ${result.summary} ${JSON.stringify(result.issues ?? [])}`);
  }
  return (result.data ?? {}) as ToolData;
}

function stringArray(data: ToolData, key: string): string[] {
  const value = data[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`tool result ${key} must be string[]`);
  }
  return value as string[];
}

function requiredString(data: ToolData, key: string): string {
  const value = data[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`tool result ${key} must be string`);
  return value;
}

function endingEvent(input: {
  readonly id: string;
  readonly name: string;
  readonly at: Point;
  readonly endingId: string;
  readonly conditions?: EventPage["conditions"];
  readonly text: string;
}): GameEvent {
  return {
    id: input.id,
    x: input.at.x,
    y: input.at.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: `${input.id}_page`,
      name: input.name,
      conditions: input.conditions ?? [],
      graphic: { transparent: true },
      trigger: { kind: "action" },
      priority: "below",
      overlapForbidden: false,
      animationType: "fixedGraphic",
      movement: PASSIVE,
      commands: [
        { kind: "text", speaker: "나", body: input.text },
        { kind: "triggerEnding", endingId: input.endingId },
      ],
    }],
  };
}

function buildInteriorMap(plan: InteriorRoomPlan) {
  const built = runInteriorRoomPipeline(plan);
  if (!built.ok) {
    throw new Error(`${plan.mapId} interior build failed: ${built.warnings.join(" / ")}`);
  }
  return { ...built.map, events: [] };
}

export function createNightMonsterProject(): NightMonsterBuild {
  const project = createBlankProject();
  const gallery = buildInteriorMap({
    mapId: NIGHT_MONSTER_MAP_IDS.gallery,
    name: "2 · 잠긴 서재",
    width: 26,
    height: 18,
    wings: [{ x: 2, y: 4, w: 22, h: 10 }],
    door: { x: 13, y: 13 },
    theme: "study",
    themeModifiers: ["scholarly", "sacred"],
    seed: 240824,
  });
  const chase = buildInteriorMap({
    mapId: NIGHT_MONSTER_MAP_IDS.chase,
    name: "4 · 괴물의 복도",
    width: 28,
    height: 14,
    wings: [{ x: 2, y: 4, w: 24, h: 7 }],
    door: { x: 3, y: 10 },
    theme: "corridor",
    themeModifiers: ["martial"],
    seed: 240825,
  });
  const finale = buildInteriorMap({
    mapId: NIGHT_MONSTER_MAP_IDS.finale,
    name: "5 · 지하 격리실",
    width: 20,
    height: 16,
    wings: [{ x: 2, y: 4, w: 16, h: 8 }],
    door: { x: 10, y: 11 },
    theme: "study",
    themeModifiers: ["luxury", "scholarly"],
    wallMaterial: "gold-brick",
    seed: 240826,
  });

  project.meta.title = "밤의 괴물";
  project.maps = {
    [gallery.id]: gallery,
    [chase.id]: chase,
    [finale.id]: finale,
  };
  project.mapTree = {
    mapId: gallery.id,
    children: [{ mapId: chase.id, children: [{ mapId: finale.id, children: [] }] }],
  };
  project.startMapId = gallery.id;
  project.startPos = { x: 13, y: 13 };

  const context = { project };
  requireTool(context, "set_title_screen", {
    title: "밤의 괴물",
    musicResourceId: "cc0-bgm-dungeon",
    backgroundResourceId: "horror-mystery-blue-gallery",
    titleGraphic: { mode: "text" },
    showInputHint: true,
  });
  context.project.maps[NIGHT_MONSTER_MAP_IDS.gallery]!.bgm = {
    mode: "custom",
    resourceId: "cc0-bgm-dungeon",
    fadeInMs: 800,
  };
  context.project.maps[NIGHT_MONSTER_MAP_IDS.chase]!.bgm = {
    mode: "custom",
    resourceId: "cc0-bgm-battle",
    fadeInMs: 250,
  };
  context.project.maps[NIGHT_MONSTER_MAP_IDS.finale]!.bgm = {
    mode: "custom",
    resourceId: "cc0-bgm-dungeon",
    fadeInMs: 1000,
  };
  requireTool(context, "upsert_item", {
    item: {
      id: NIGHT_MONSTER_ITEM_ID,
      name: "황동 열쇠",
      price: 0,
      description: "서재의 잠긴 문고리에 맞는 차가운 열쇠.",
      consumable: false,
    },
  });

  const galleryHotspots = [
    { at: { x: 4, y: 5 }, name: "찢긴 악보", lines: ["'자장가의 순서: 가운데 → 왼쪽 → 오른쪽. 틀렸으면 처음부터.'"], once: true },
    { at: { x: 10, y: 5 }, name: "웃지 않는 가족사진", lines: ["눈동자만 덧칠되어 있다. 가운데 버튼이 먼저 울린 흔적이다."], setSwitch: NIGHT_MONSTER_SWITCH_IDS.keyFound, once: true },
    { at: { x: 18, y: 5 }, name: "저택 주인의 일기", lines: ["9월 5일. 그것은 이제 사람의 목소리를 낸다. 이름을 부르면 절대로 대답하지 말 것."], once: true },
    { at: { x: 4, y: 8 }, name: "깨진 거울", lines: ["내가 멈췄는데 거울 속 나는 한 걸음 더 걸었다."], once: true },
    {
      at: { x: 10, y: 8 },
      name: "움푹 팬 초상",
      lines: ["초상 뒤에서 황동 열쇠를 찾았다. 오른쪽 아래 문고리에 써 보자. …위층에서 발소리가 멎었다."],
      itemId: NIGHT_MONSTER_ITEM_ID,
      setSwitch: NIGHT_MONSTER_SWITCH_IDS.keyFound,
      once: true,
    },
    { at: { x: 18, y: 8 }, name: "바닥의 긁힌 자국", lines: ["맨발 자국이 복도와 지하실로 이어진다. 사람 발가락은 여섯 개가 아니다."], once: true },
  ];
  const hotspotData = requireTool(context, "place_examine_hotspots", {
    mapId: NIGHT_MONSTER_MAP_IDS.gallery,
    hotspots: galleryHotspots,
  });
  const clueEventIds = stringArray(hotspotData, "eventIds");
  if (clueEventIds.length !== galleryHotspots.length) throw new Error("gallery hotspot placement incomplete");

  const sequenceAt = [{ x: 7, y: 10 }, { x: 10, y: 10 }, { x: 14, y: 10 }] as const;
  const sequenceData = requireTool(context, "compile_puzzle", {
    mapId: NIGHT_MONSTER_MAP_IDS.gallery,
    puzzleId: "gallery_sequence",
    kind: "switch-sequence",
    nodes: [
      { at: sequenceAt[0], name: "왼쪽 버튼" },
      { at: sequenceAt[1], name: "가운데 버튼" },
      { at: sequenceAt[2], name: "오른쪽 버튼" },
    ],
    order: [1, 0, 2],
    reset: true,
    onSolve: {
      setSwitch: NIGHT_MONSTER_SWITCH_IDS.sequenceSolved,
      message: "찰칵. 복도 잠금쇠가 풀렸다. 문 너머에서 친구의 목소리가 들린다. “들어와.”",
    },
  });

  const itemGateAt = { x: 16, y: 10 } as const;
  const itemGateData = requireTool(context, "compile_puzzle", {
    mapId: NIGHT_MONSTER_MAP_IDS.gallery,
    puzzleId: "blue_restoration_lock",
    kind: "item-gate",
    at: itemGateAt,
    name: "황동 문고리",
    requiredItemId: NIGHT_MONSTER_ITEM_ID,
    consumeItem: true,
    lockedMessage: "문고리가 잠겼다. 서재의 움푹 팬 초상을 조사하자.",
    unlockedMessage: "문고리를 풀었다. 이제 세 버튼을 맞는 순서로 누르면 아래쪽 문이 열린다.",
    onSolve: { setSwitch: NIGHT_MONSTER_SWITCH_IDS.keyUsed },
  });

  const galleryTransfer = requireTool(context, "create_transfer_pair", {
    a: { mapId: NIGHT_MONSTER_MAP_IDS.gallery, x: 13, y: 14 },
    b: { mapId: NIGHT_MONSTER_MAP_IDS.chase, x: 3, y: 11 },
    fade: "black",
  });
  const galleryExitEventId = requiredString(galleryTransfer, "eventIdA");
  const galleryExit = context.project.maps[NIGHT_MONSTER_MAP_IDS.gallery]?.events.find((event) => event.id === galleryExitEventId);
  if (!galleryExit?.pages?.[0]) throw new Error("gallery exit event missing");
  galleryExit.pages[0].conditions = [{
    kind: "all",
    conditions: [
      { kind: "switch", switchId: NIGHT_MONSTER_SWITCH_IDS.keyUsed, value: true },
      { kind: "switch", switchId: NIGHT_MONSTER_SWITCH_IDS.sequenceSolved, value: true },
    ],
  }];

  const trapAt = [{ x: 9, y: 8 }, { x: 14, y: 6 }, { x: 20, y: 8 }] as const;
  const chaserAt = { x: 24, y: 6 } as const;
  const horrorLoopData = requireTool(context, "make_horror_loop", {
    mapId: NIGHT_MONSTER_MAP_IDS.chase,
    trapCells: trapAt,
    message: "압력판을 밟자 마룻바닥이 꺼졌다. 붉은 압력판을 피해야 한다.",
    includeChase: true,
    chaserAt,
    safeZone: { x: 2, y: 8, w: 5, h: 3 },
    mood: true,
  });
  const lethalEventIds = [
    ...stringArray(horrorLoopData, "trapEventIds"),
    requiredString(horrorLoopData, "chaseEventId"),
  ];
  for (const eventId of lethalEventIds) {
    const event = context.project.maps[NIGHT_MONSTER_MAP_IDS.chase]?.events.find(
      (candidate) => candidate.id === eventId,
    );
    const commands = event?.pages?.[0]?.commands;
    if (!commands) throw new Error(`lethal event missing: ${eventId}`);
    commands.unshift({
      kind: "playAudio",
      resourceId: eventId === lethalEventIds.at(-1)
        ? "easyrpg-sound-monster1"
        : "easyrpg-sound-collapse1",
      loop: false,
    });
  }
  const chaseMoodEvent = context.project.maps[NIGHT_MONSTER_MAP_IDS.chase]?.events.find(
    (event) => event.id === `ev_scene_mood_${NIGHT_MONSTER_MAP_IDS.chase}`,
  );
  if (!chaseMoodEvent) throw new Error("chase mood event missing");
  // 진입 체크포인트와 자동 실행 이벤트가 (0,0)에 겹치면 동작은 해도 lint가 경고한다.
  chaseMoodEvent.x = 4;
  chaseMoodEvent.y = 9;

  const chaseTransfer = requireTool(context, "create_transfer_pair", {
    a: { mapId: NIGHT_MONSTER_MAP_IDS.chase, x: 25, y: 4 },
    b: { mapId: NIGHT_MONSTER_MAP_IDS.finale, x: 10, y: 12 },
    fade: "black",
  });

  const truthAt = { x: 10, y: 5 } as const;
  const finaleHotspotData = requireTool(context, "place_examine_hotspots", {
    mapId: NIGHT_MONSTER_MAP_IDS.finale,
    hotspots: [
      {
        at: truthAt,
        name: "낡은 카세트 녹음기",
        lines: [
          "'그것은 내 목소리를 훔쳤어. 침실에서 찾은 내 호루라기를 세 번 불어. 진짜 나는 대답할 수 없어.'",
          "민서가 남긴 녹음이었다. 왼쪽에서 호루라기를 불어 친구를 찾거나, 오른쪽 비상문으로 혼자 나갈 수 있다.",
        ],
        setSwitch: NIGHT_MONSTER_SWITCH_IDS.truthHeard,
        once: true,
      },
      { at: { x: 4, y: 7 }, name: "낡은 실험 기록", lines: ["실험체는 들은 목소리를 따라 한다. 그러나 숨을 불어 소리를 낼 수는 없다."], once: true },
      { at: { x: 16, y: 7 }, name: "찢어진 교복", lines: ["교복 안쪽에 민서의 이름이 쓰였다. 천 뒤에서 아주 약한 숨소리가 난다."], once: true },
    ],
  });
  const finaleHotspotIds = stringArray(finaleHotspotData, "eventIds");

  requireTool(context, "define_ending", {
    id: NIGHT_MONSTER_ENDING_IDS.truth,
    name: "새벽 · 함께 돌아온 두 사람",
    priority: 20,
    conditions: [{ kind: "switch", switchId: NIGHT_MONSTER_SWITCH_IDS.truthHeard, value: true }],
    epilogue: [
      { kind: "say", speaker: "나", text: "호루라기를 세 번 불었다. 벽장 속에서 민서가 내 손을 잡았다. 우리는 서로의 손을 놓지 않고 새벽까지 달렸다." },
      { kind: "say", speaker: "민서", text: "뒤돌아보지 마. 지금 네 이름을 부르는 건 내가 아니야." },
    ],
  });
  requireTool(context, "define_ending", {
    id: NIGHT_MONSTER_ENDING_IDS.escape,
    name: "탈출 · 뒤따라온 목소리",
    priority: 1,
    conditions: [],
    epilogue: [{ kind: "say", speaker: "나", text: "혼자 저택을 나왔다. 다음 날 새벽, 잠긴 방문 너머에서 내 목소리가 들렸다. “들어와.”" }],
  });

  const truthEndingAt = { x: 7, y: 10 } as const;
  const escapeEndingAt = { x: 13, y: 10 } as const;
  const finaleMap = context.project.maps[NIGHT_MONSTER_MAP_IDS.finale];
  if (!finaleMap) throw new Error("finale map missing");
  finaleMap.events.push(
    endingEvent({
      id: "ev_restore_truth_ending",
      name: "호루라기 세 번",
      at: truthEndingAt,
      endingId: NIGHT_MONSTER_ENDING_IDS.truth,
      conditions: [{ kind: "switch", switchId: NIGHT_MONSTER_SWITCH_IDS.truthHeard, value: true }],
      text: "호루라기를 입에 댔다. 이제 진짜 민서를 찾는다.",
    }),
    endingEvent({
      id: "ev_leave_blue_ending",
      name: "비상구",
      at: escapeEndingAt,
      endingId: NIGHT_MONSTER_ENDING_IDS.escape,
      text: "뒤에서 민서가 부른다. 대답하지 않고 혼자 비상문을 연다.",
    }),
  );

  // Two quiet spaces establish the controls, optional rescue clue, and a breathing pause.
  const foyer = buildInteriorMap({ mapId: NIGHT_MONSTER_MAP_IDS.foyer, name: "1 · 비 내리는 현관",
    width: 22, height: 18, wings: [{ x: 2, y: 4, w: 18, h: 10 }],
    door: { x: 11, y: 13 }, theme: "dining", seed: 260905 });
  const bedroom = buildInteriorMap({ mapId: NIGHT_MONSTER_MAP_IDS.bedroom, name: "3 · 숨죽인 침실",
    width: 20, height: 16, wings: [{ x: 2, y: 4, w: 16, h: 8 }],
    door: { x: 10, y: 11 }, theme: "bedroom", seed: 260906 });
  context.project.maps[foyer.id] = foyer;
  context.project.maps[bedroom.id] = bedroom;
  context.project.startMapId = foyer.id;
  context.project.startPos = { x: 11, y: 12 };
  context.project.mapTree = { mapId: foyer.id, children: [{ mapId: gallery.id, children: [
    { mapId: bedroom.id, children: [] }, { mapId: chase.id, children: [{ mapId: finale.id, children: [] }] },
  ] }] };
  requireTool(context, "set_title_screen", { title: "밤의 괴물",
    menuLabels: { newGame: "저택에 들어가기", continueGame: "이어서 도망치기", quit: "돌아가기" },
    particles: { preset: "rain", density: 30 }, showInputHint: true });
  for (const map of Object.values(context.project.maps)) {
    map.encounterRate = 0;
    map.bgm = { mode: "custom", resourceId: map.id === chase.id ? "cc0-bgm-battle" : "cc0-bgm-dungeon", fadeInMs: 650 };
    requireTool(context, "set_scene_mood", { mapId: map.id, applyMode: "map",
      lighting: { ambient: map.id === chase.id ? 0.76 : 0.64, color: "#080c19",
        sources: [{ id: "flashlight", at: "player", radius: 4.5, intensity: 0.92 }] } });
  }
  requireTool(context, "create_transfer_pair", {
    a: { mapId: foyer.id, x: 11, y: 14 }, b: { mapId: gallery.id, x: 3, y: 14 }, fade: "black" });
  requireTool(context, "create_transfer_pair", {
    a: { mapId: gallery.id, x: 22, y: 14 }, b: { mapId: bedroom.id, x: 10, y: 12 }, fade: "black" });
  requireTool(context, "place_examine_hotspots", { mapId: foyer.id, hotspots: [
    { at: { x: 10, y: 11 }, name: "현관의 쪽지", once: false, lines: [
      "밤 11시 47분. 민서의 마지막 문자는 이 저택 주소였다. 문이 등 뒤에서 잠겼다.",
      "방향키/WASD 이동 · Shift 달리기 · Enter/Z 조사 · Esc 메뉴. 가구와 버튼 앞에서 조사해 보자.",
      "아래쪽 통로는 서재. 황동 열쇠와 세 버튼의 암호로 복도를 열자. 서재 오른쪽 끝 통로는 침실이다.",
      "괴물과 싸울 수는 없다. Shift로 달리자. 복도 왼쪽 입구 구역은 안전하다. 붙잡히면 체크포인트부터 다시 시작할 수 있다." ] },
    { at: { x: 5, y: 6 }, name: "잠긴 현관문", once: false, lines: ["안에서 열 수 없는 자물쇠다. 집 어딘가에 다른 출구가 있을 것이다."] },
    { at: { x: 16, y: 6 }, name: "꺼진 전화", once: true, lines: ["선이 끊겨 있다. 그런데 수화기에서 내 숨소리가 들린다."] },
  ] });
  requireTool(context, "place_examine_hotspots", { mapId: bedroom.id, hotspots: [
    { at: { x: 6, y: 6 }, name: "민서의 가방", once: true, setSwitch: "sw_night_whistle", lines: [
      "민서의 호루라기를 찾았다. 가방 안쪽 쪽지: '그것은 말을 따라 하지만 호루라기는 불지 못해.'",
      "호루라기를 주머니에 넣었다. 지하에서 민서를 찾을 때 필요할 것 같다." ] },
    { at: { x: 14, y: 6 }, name: "닫힌 옷장", once: false, lines: ["옷장 안에서 잠시 숨을 골랐다. 여기까지 발소리가 따라오지는 않는다."] },
    { at: { x: 10, y: 8 }, name: "침대 밑 쪽지", once: false, lines: [
      "'복도에서는 붉은 압력판을 밟지 마. 왼쪽 입구 주변는 안전해. 오른쪽 위 문이 지하로 이어져.'" ] },
  ] });
  // Rescue needs the optional bedroom discovery; the solo exit always remains available.
  const rescue = context.project.maps[finale.id]!.events.find(e => e.id === "ev_restore_truth_ending")!;
  rescue.pages![0]!.conditions.push({ kind: "switch", switchId: "sw_night_whistle", value: true });
  rescue.pages!.unshift({ ...structuredClone(rescue.pages![0]!), id: "ev_night_rescue_locked",
    name: "잠긴 격리문", conditions: [], commands: [{ kind: "text", body: "문 뒤에서 누군가 숨을 죽이고 있다. 침실에서 민서의 소지품을 찾고 지하실 녹음기를 들어 보자." }] });
  const rescueEnding = context.project.endings!.find(e => e.id === NIGHT_MONSTER_ENDING_IDS.truth)!;
  rescueEnding.conditions.push({ kind: "switch", switchId: "sw_night_whistle", value: true });
  const monster = context.project.maps[chase.id]!.events.find(e => e.id === requiredString(horrorLoopData, "chaseEventId"))!;
  monster.pages![0]!.name = "목소리를 훔치는 괴물";
  monster.pages![0]!.graphic.scale = 1.6;
  for (const command of monster.pages![0]!.commands) {
    if (command.kind === "killPlayer") command.message = "민서의 목소리가 귓가에서 웃었다. 그것은 민서가 아니었다.";
  }
  // Opening runs once, with a later self-switch page that prevents replay on return.
  const opening: GameEvent = { id: "ev_night_opening", x: 11, y: 12, trigger: { kind: "auto" }, commands: [], pages: [
    { id: "night_opening", name: "잠긴 문", conditions: [], graphic: { transparent: true },
      trigger: { kind: "auto" }, priority: "below", overlapForbidden: false, animationType: "fixedGraphic", movement: PASSIVE,
      commands: [{ kind: "text", speaker: "나", body: "민서야? …문이 잠겼다. 손전등부터 켜자. 바로 앞의 쪽지를 조사해 보자." },
        { kind: "setSelfSwitch", key: "A", value: true }, { kind: "checkpointSave", label: "저택에 들어온 밤" }] },
    { id: "night_opening_done", name: "진입 완료", conditions: [{ kind: "selfSwitch", key: "A", value: true }],
      graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below", overlapForbidden: false,
      animationType: "fixedGraphic", movement: PASSIVE, commands: [] },
  ] };
  context.project.maps[foyer.id]!.events.push(opening);

  const hero = context.project.database.actors.find(a => a.id === context.project.session.partyActorIds[0]);
  if (hero) {
    hero.name = "지우";
    hero.nickname = "민서를 찾아온 친구";
    hero.characterResourceId = "easyrpg-charset-people1";
    hero.characterIndex = 5;
    hero.faceResourceId = "easyrpg-faceset-people1-05";
    hero.initialEquipment = {};
  }
  const lockedExit = context.project.maps[gallery.id]!.events.find(e => e.id === galleryExitEventId)!;
  const openPage = lockedExit.pages![0]!;
  lockedExit.pages!.unshift({ ...structuredClone(openPage), id: `${lockedExit.id}_locked`,
    name: "잠긴 복도 문", conditions: [], trigger: { kind: "action" },
    commands: [{ kind: "text", body: "복도 문은 열쇠와 세 버튼으로 이중 잠금되어 있다. 초상과 찢긴 악보를 조사하자." }] });
  for (const map of Object.values(context.project.maps)) {
    for (const event of map.events.filter(e => e.id.startsWith("ev_gate_"))) {
      for (const page of event.pages ?? []) page.graphic = charsetGraphic("tex_easyrpg_charset_object1", 0);
    }
  }

  // Runtime event position/state indexes use event ids across maps: scope the hotspot ids.
  for (const map of Object.values(context.project.maps)) {
    for (const event of map.events) {
      if (event.id.startsWith("ev_examine_")) {
        if (map.id !== gallery.id) event.id = `${map.id}_${event.id}`;
        for (const page of event.pages ?? []) {
          page.id = `${event.id}_${page.id}`;
          page.graphic = charsetGraphic("tex_easyrpg_charset_object2", 4);
          if (page.commands.length === 0) page.commands = event.pages![0]!.commands.filter(c => c.kind === "text");
        }
      }
    }
  }
  for (const id of stringArray(sequenceData, "eventIds")) {
    const event = context.project.maps[gallery.id]!.events.find(e => e.id === id)!;
    for (const page of event.pages ?? []) page.graphic = charsetGraphic("tex_easyrpg_charset_object2", 0);
  }
  const lock = context.project.maps[gallery.id]!.events.find(e => e.id === stringArray(itemGateData, "eventIds")[0])!;
  for (const page of lock.pages ?? []) page.graphic = charsetGraphic("tex_easyrpg_charset_object2", 1);
  for (const id of stringArray(horrorLoopData, "trapEventIds")) {
    const event = context.project.maps[chase.id]!.events.find(e => e.id === id)!;
    event.pages![0]!.graphic = charsetGraphic("tex_easyrpg_charset_object2", 0);
  }
  monster.pages![0]!.graphic = { ...charsetGraphic("tex_easyrpg_charset_monster1", 6), scale: 1.6 };
  for (const event of context.project.maps[finale.id]!.events.filter(e => e.id.includes("ending"))) {
    for (const page of event.pages ?? []) page.graphic = charsetGraphic("tex_easyrpg_charset_object1", event.id.includes("truth") ? 1 : 0);
  }

  const manifest: NightMonsterManifest = {
    gallery: {
      clueEventIds,
      keyEventId: clueEventIds[4]!,
      sequenceEventIds: stringArray(sequenceData, "eventIds"),
      itemGateEventId: stringArray(itemGateData, "eventIds")[0]!,
      exitEventId: galleryExitEventId,
      keyAt: galleryHotspots[4]!.at,
      sequenceAt,
      itemGateAt,
    },
    chase: {
      trapEventIds: stringArray(horrorLoopData, "trapEventIds"),
      checkpointEventId: requiredString(horrorLoopData, "checkpointEventId"),
      chaserEventId: requiredString(horrorLoopData, "chaseEventId"),
      exitEventId: requiredString(chaseTransfer, "eventIdA"),
      entryAt: (galleryTransfer.landingB ?? { x: 3, y: 10 }) as Point,
      trapAt,
      chaserAt,
    },
    finale: {
      truthEventId: `${finale.id}_${finaleHotspotIds[0]!}`,
      truthEndingEventId: "ev_restore_truth_ending",
      escapeEndingEventId: "ev_leave_blue_ending",
      truthAt,
      truthEndingAt,
      escapeEndingAt,
    },
  };

  return { project: context.project, manifest };
}
