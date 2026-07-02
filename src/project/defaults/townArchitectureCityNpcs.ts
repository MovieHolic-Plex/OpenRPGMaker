import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { GameEvent, GameMap } from "../types";

type CityNpcSpec = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly spriteId: string;
  readonly characterIndex: number;
  readonly speaker: string;
  readonly body: string;
};

export const TOWN_ARCHITECTURE_CITY_NPC_COUNT = 30;

const NPC_SPRITES = [
  "tex_easyrpg_charset_people1",
  "tex_easyrpg_charset_people2",
  "tex_easyrpg_charset_people3",
  "tex_easyrpg_charset_people4",
  "tex_easyrpg_charset_people5",
  "tex_easyrpg_charset_actor1",
] as const;

const NPC_LINES = [
  "오늘 장터가 꽤 시끄럽지?",
  "새 길이 생겨서 돌아다니기 편해졌어.",
  "저 집은 아침마다 빵 냄새가 나.",
  "도시는 계획대로만 크지 않더라.",
  "남쪽 길은 밤에도 사람이 많아.",
  "물가 근처는 잠깐 쉬기 좋아.",
  "이 골목은 늘 길을 헷갈리게 해.",
  "상인이 좋은 물건을 들여왔대.",
  "집들이 제각각이라 더 살아 있는 느낌이야.",
  "오늘은 멀리 가지 말고 동네만 돌 거야.",
  "북쪽 지붕 색이 마음에 들어.",
  "새로 온 사람을 찾고 있었어.",
  "도시가 좀 복잡해야 재미있지.",
  "길 위에는 물건을 두면 안 돼.",
  "저쪽 문은 아직 고치는 중이래.",
  "시장까지 같이 걸어갈래?",
  "건물이 여덟 채라 꽤 붐비네.",
  "울타리가 없으니 시야가 탁 트여.",
  "사람이 많아지니 진짜 도시 같아.",
  "오늘은 NPC도 바쁘게 움직인다니까.",
  "서쪽 길로 가면 오래된 집이 보여.",
  "동쪽은 새 건물이 많아졌어.",
  "여기는 약속 장소로 딱 좋아.",
  "내 대사는 짧지만 존재감은 확실해.",
  "걸어 다니면 도시가 더 커 보여.",
  "저 벤치 옆은 늘 누가 지나가.",
  "남쪽 끝 길은 넓어서 마음에 들어.",
  "북쪽으로 가면 지붕들이 줄지어 있어.",
  "여기서 보는 도시 풍경이 제일 좋아.",
  "말을 걸면 모두 한마디씩은 해.",
] as const;

const CITY_NPC_POINTS = [
  { x: 2, y: 15 }, { x: 6, y: 15 }, { x: 10, y: 15 }, { x: 14, y: 15 }, { x: 18, y: 15 },
  { x: 22, y: 13 }, { x: 27, y: 13 }, { x: 34, y: 11 }, { x: 39, y: 11 }, { x: 45, y: 11 },
  { x: 18, y: 20 }, { x: 18, y: 25 }, { x: 4, y: 28 }, { x: 9, y: 28 }, { x: 14, y: 28 },
  { x: 21, y: 30 }, { x: 27, y: 30 }, { x: 34, y: 28 }, { x: 40, y: 28 }, { x: 46, y: 28 },
  { x: 19, y: 38 }, { x: 19, y: 43 }, { x: 34, y: 34 }, { x: 34, y: 39 }, { x: 34, y: 44 },
  { x: 6, y: 47 }, { x: 12, y: 47 }, { x: 24, y: 47 }, { x: 39, y: 47 }, { x: 46, y: 47 },
] as const;

const CITY_NPCS = CITY_NPC_POINTS.map((point, index): CityNpcSpec => ({
  id: `event_city_walker_${String(index + 1).padStart(2, "0")}`,
  x: point.x,
  y: point.y,
  spriteId: NPC_SPRITES[index % NPC_SPRITES.length],
  characterIndex: index % 8,
  speaker: `도시 주민 ${index + 1}`,
  body: NPC_LINES[index],
}));

export function addTownArchitectureCityNpcs(map: GameMap): void {
  for (const spec of CITY_NPCS) map.events.push(cityNpcEvent(spec));
}

function cityNpcEvent(spec: CityNpcSpec): GameEvent {
  return {
    id: spec.id,
    x: spec.x,
    y: spec.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${spec.id}_page`,
        name: spec.speaker,
        conditions: [],
        graphic: {
          sprite: { type: "bundled", id: spec.spriteId },
          direction: "down",
          pattern: charsetFrameIndex({ characterIndex: spec.characterIndex, direction: "down", pattern: 1 }),
        },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        animationType: "normal",
        movement: { type: "random", speed: 3, frequency: 4 },
        commands: [{ kind: "text", speaker: spec.speaker, body: spec.body }],
      },
    ],
  };
}
