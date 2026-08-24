import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import {
  runInteriorRoomPipeline,
  type InteriorRoomPlan,
} from "@/editor/interiorRoomPipeline";
import type { EventPage, GameEvent, Project } from "@/project/types";

export const HORROR_MYSTERY_PROJECT_ID = "rpg-zzu-horror-mystery-prototype-v1";

export const HORROR_MYSTERY_MAP_IDS = {
  gallery: "map_horror_blue_gallery",
  chase: "map_horror_service_corridor",
  finale: "map_horror_restoration_room",
} as const;

export const HORROR_MYSTERY_ITEM_ID = "item_blue_restoration_key";

export const HORROR_MYSTERY_SWITCH_IDS = {
  keyFound: "sw_blue_key_found",
  keyUsed: "sw_blue_key_used",
  sequenceSolved: "sw_gallery_sequence",
  truthHeard: "sw_truth_heard",
} as const;

export const HORROR_MYSTERY_ENDING_IDS = {
  truth: "ending_restore_truth",
  escape: "ending_leave_it_blue",
} as const;

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface HorrorMysteryPrototypeManifest {
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

export interface HorrorMysteryPrototypeBuild {
  readonly project: Project;
  readonly manifest: HorrorMysteryPrototypeManifest;
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

export function createHorrorMysteryPrototypeProject(): HorrorMysteryPrototypeBuild {
  const project = createBlankProject();
  const gallery = buildInteriorMap({
    mapId: HORROR_MYSTERY_MAP_IDS.gallery,
    name: "푸른 액자 전시실",
    width: 26,
    height: 18,
    wings: [{ x: 2, y: 4, w: 22, h: 10 }],
    door: { x: 13, y: 13 },
    theme: "study",
    themeModifiers: ["scholarly", "sacred"],
    seed: 240824,
  });
  const chase = buildInteriorMap({
    mapId: HORROR_MYSTERY_MAP_IDS.chase,
    name: "수장고 서비스 복도",
    width: 28,
    height: 14,
    wings: [{ x: 2, y: 4, w: 24, h: 7 }],
    door: { x: 3, y: 10 },
    theme: "corridor",
    themeModifiers: ["martial"],
    seed: 240825,
  });
  const finale = buildInteriorMap({
    mapId: HORROR_MYSTERY_MAP_IDS.finale,
    name: "복원실",
    width: 20,
    height: 16,
    wings: [{ x: 2, y: 4, w: 16, h: 8 }],
    door: { x: 10, y: 11 },
    theme: "study",
    themeModifiers: ["luxury", "scholarly"],
    wallMaterial: "gold-brick",
    seed: 240826,
  });

  project.meta.title = "푸른 액자의 밤";
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
    title: "푸른 액자의 밤",
    musicResourceId: "cc0-bgm-dungeon",
    backgroundResourceId: "horror-mystery-blue-gallery",
    titleGraphic: { mode: "text" },
    showInputHint: true,
  });
  context.project.maps[HORROR_MYSTERY_MAP_IDS.gallery]!.bgm = {
    mode: "custom",
    resourceId: "cc0-bgm-dungeon",
    fadeInMs: 800,
  };
  context.project.maps[HORROR_MYSTERY_MAP_IDS.chase]!.bgm = {
    mode: "custom",
    resourceId: "cc0-bgm-battle",
    fadeInMs: 250,
  };
  context.project.maps[HORROR_MYSTERY_MAP_IDS.finale]!.bgm = {
    mode: "custom",
    resourceId: "cc0-bgm-dungeon",
    fadeInMs: 1000,
  };
  requireTool(context, "upsert_item", {
    item: {
      id: HORROR_MYSTERY_ITEM_ID,
      name: "푸른 복원 열쇠",
      price: 0,
      description: "액자 뒷면에 숨겨져 있던 차가운 황동 열쇠.",
      consumable: false,
    },
  });

  const galleryHotspots = [
    { at: { x: 4, y: 5 }, name: "찢긴 작품 설명", lines: ["'아이의 시선은 가운데에서 시작해 왼쪽, 오른쪽으로 흐른다.'"], once: true },
    { at: { x: 10, y: 5 }, name: "푸른 아이의 초상", lines: ["눈동자만 덧칠되어 있다. 가운데 액자의 종이 먼저 울린 흔적이다."], setSwitch: HORROR_MYSTERY_SWITCH_IDS.keyFound, once: true },
    { at: { x: 18, y: 5 }, name: "관장 일지", lines: ["복원사는 작품을 지운 것이 아니라, 작품 안의 이름을 감췄다."], once: true },
    { at: { x: 4, y: 8 }, name: "깨진 거울", lines: ["거울 속에서는 출구 위의 액자 세 장이 역순으로 비친다."], once: true },
    {
      at: { x: 10, y: 8 },
      name: "움푹 팬 액자",
      lines: ["캔버스 뒤에서 열쇠가 떨어졌다. 멀리서 수레 끄는 소리가 난다."],
      itemId: HORROR_MYSTERY_ITEM_ID,
      setSwitch: HORROR_MYSTERY_SWITCH_IDS.keyFound,
      once: true,
    },
    { at: { x: 18, y: 8 }, name: "바닥의 긁힌 자국", lines: ["무거운 것이 서비스 복도 쪽으로 끌려갔다. 자국은 복원실에서 끝난다."], once: true },
  ];
  const hotspotData = requireTool(context, "place_examine_hotspots", {
    mapId: HORROR_MYSTERY_MAP_IDS.gallery,
    hotspots: galleryHotspots,
  });
  const clueEventIds = stringArray(hotspotData, "eventIds");
  if (clueEventIds.length !== galleryHotspots.length) throw new Error("gallery hotspot placement incomplete");

  const sequenceAt = [{ x: 7, y: 10 }, { x: 10, y: 10 }, { x: 14, y: 10 }] as const;
  const sequenceData = requireTool(context, "compile_puzzle", {
    mapId: HORROR_MYSTERY_MAP_IDS.gallery,
    puzzleId: "gallery_sequence",
    kind: "switch-sequence",
    nodes: [
      { at: sequenceAt[0], name: "왼쪽 액자의 종" },
      { at: sequenceAt[1], name: "가운데 액자의 종" },
      { at: sequenceAt[2], name: "오른쪽 액자의 종" },
    ],
    order: [1, 0, 2],
    reset: true,
    onSolve: {
      setSwitch: HORROR_MYSTERY_SWITCH_IDS.sequenceSolved,
      message: "세 음이 이어지자 출구의 푸른 물감이 갈라졌다.",
    },
  });

  const itemGateAt = { x: 16, y: 10 } as const;
  const itemGateData = requireTool(context, "compile_puzzle", {
    mapId: HORROR_MYSTERY_MAP_IDS.gallery,
    puzzleId: "blue_restoration_lock",
    kind: "item-gate",
    at: itemGateAt,
    name: "복원 도구함",
    requiredItemId: HORROR_MYSTERY_ITEM_ID,
    consumeItem: true,
    lockedMessage: "푸른 안료로 굳어 있다. 맞는 열쇠가 필요하다.",
    unlockedMessage: "열쇠를 돌리자 안료 아래의 문고리가 드러났다.",
    onSolve: { setSwitch: HORROR_MYSTERY_SWITCH_IDS.keyUsed },
  });

  const galleryTransfer = requireTool(context, "create_transfer_pair", {
    a: { mapId: HORROR_MYSTERY_MAP_IDS.gallery, x: 13, y: 14 },
    b: { mapId: HORROR_MYSTERY_MAP_IDS.chase, x: 3, y: 11 },
    fade: "black",
  });
  const galleryExitEventId = requiredString(galleryTransfer, "eventIdA");
  const galleryExit = context.project.maps[HORROR_MYSTERY_MAP_IDS.gallery]?.events.find((event) => event.id === galleryExitEventId);
  if (!galleryExit?.pages?.[0]) throw new Error("gallery exit event missing");
  galleryExit.pages[0].conditions = [{
    kind: "all",
    conditions: [
      { kind: "switch", switchId: HORROR_MYSTERY_SWITCH_IDS.keyUsed, value: true },
      { kind: "switch", switchId: HORROR_MYSTERY_SWITCH_IDS.sequenceSolved, value: true },
    ],
  }];

  const trapAt = [{ x: 9, y: 8 }, { x: 14, y: 6 }, { x: 20, y: 8 }] as const;
  const chaserAt = { x: 24, y: 6 } as const;
  const horrorLoopData = requireTool(context, "make_horror_loop", {
    mapId: HORROR_MYSTERY_MAP_IDS.chase,
    trapCells: trapAt,
    message: "전시 수레가 벽을 뚫고 덮쳐 왔다.",
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
    const event = context.project.maps[HORROR_MYSTERY_MAP_IDS.chase]?.events.find(
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
  const chaseMoodEvent = context.project.maps[HORROR_MYSTERY_MAP_IDS.chase]?.events.find(
    (event) => event.id === `ev_scene_mood_${HORROR_MYSTERY_MAP_IDS.chase}`,
  );
  if (!chaseMoodEvent) throw new Error("chase mood event missing");
  // 진입 체크포인트와 자동 실행 이벤트가 (0,0)에 겹치면 동작은 해도 lint가 경고한다.
  chaseMoodEvent.x = 1;

  const chaseTransfer = requireTool(context, "create_transfer_pair", {
    a: { mapId: HORROR_MYSTERY_MAP_IDS.chase, x: 25, y: 4 },
    b: { mapId: HORROR_MYSTERY_MAP_IDS.finale, x: 10, y: 12 },
    fade: "black",
  });

  const truthAt = { x: 10, y: 5 } as const;
  const finaleHotspotData = requireTool(context, "place_examine_hotspots", {
    mapId: HORROR_MYSTERY_MAP_IDS.finale,
    hotspots: [
      {
        at: truthAt,
        name: "복원사의 음성 기록",
        lines: [
          "'나는 아이를 그림에 가둔 게 아니다. 관장이 사고 기록을 지우자, 그림이 그 이름을 기억한 것이다.'",
          "푸른 아이의 이름은 윤해였다. 이제 무엇을 남길지 선택해야 한다.",
        ],
        setSwitch: HORROR_MYSTERY_SWITCH_IDS.truthHeard,
        once: true,
      },
      { at: { x: 4, y: 7 }, name: "지워진 사고 대장", lines: ["빈 줄마다 같은 푸른 안료가 배어 있다."], once: true },
      { at: { x: 16, y: 7 }, name: "반쯤 복원된 액자", lines: ["얼굴은 없지만 손이 출구가 아니라 기록 보관함을 가리킨다."], once: true },
    ],
  });
  const finaleHotspotIds = stringArray(finaleHotspotData, "eventIds");

  requireTool(context, "define_ending", {
    id: HORROR_MYSTERY_ENDING_IDS.truth,
    name: "진실을 복원한 밤",
    priority: 20,
    conditions: [{ kind: "switch", switchId: HORROR_MYSTERY_SWITCH_IDS.truthHeard, value: true }],
    epilogue: [
      { kind: "say", speaker: "나", text: "나는 푸른 안료를 걷어 내고 윤해의 이름을 사고 대장에 되돌려 놓았다." },
      { kind: "say", speaker: "푸른 아이", text: "이번에는… 나를 봐 줬구나." },
    ],
  });
  requireTool(context, "define_ending", {
    id: HORROR_MYSTERY_ENDING_IDS.escape,
    name: "푸른 채로 남긴 밤",
    priority: 1,
    conditions: [],
    epilogue: [{ kind: "say", speaker: "나", text: "문은 열렸다. 하지만 다음 날, 전시 목록에는 내 이름이 추가되어 있었다." }],
  });

  const truthEndingAt = { x: 7, y: 10 } as const;
  const escapeEndingAt = { x: 13, y: 10 } as const;
  const finaleMap = context.project.maps[HORROR_MYSTERY_MAP_IDS.finale];
  if (!finaleMap) throw new Error("finale map missing");
  finaleMap.events.push(
    endingEvent({
      id: "ev_restore_truth_ending",
      name: "사고 대장 복원",
      at: truthEndingAt,
      endingId: HORROR_MYSTERY_ENDING_IDS.truth,
      conditions: [{ kind: "switch", switchId: HORROR_MYSTERY_SWITCH_IDS.truthHeard, value: true }],
      text: "윤해의 이름을 기록에 되돌려 놓는다.",
    }),
    endingEvent({
      id: "ev_leave_blue_ending",
      name: "비상구",
      at: escapeEndingAt,
      endingId: HORROR_MYSTERY_ENDING_IDS.escape,
      text: "진실을 덮어 둔 채 혼자 빠져나간다.",
    }),
  );

  const manifest: HorrorMysteryPrototypeManifest = {
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
      truthEventId: finaleHotspotIds[0]!,
      truthEndingEventId: "ev_restore_truth_ending",
      escapeEndingEventId: "ev_leave_blue_ending",
      truthAt,
      truthEndingAt,
      escapeEndingAt,
    },
  };

  return { project: context.project, manifest };
}
