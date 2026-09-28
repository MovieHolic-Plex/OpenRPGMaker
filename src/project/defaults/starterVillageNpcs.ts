import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import type { GameEvent, GameMap } from "../types";

type StarterVillageNpcSpec = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly spriteId: string;
  readonly characterIndex: number;
  readonly speaker: string;
  readonly body: string;
};

const STARTER_VILLAGE_NPCS = [
  {
    id: "event_starter_mina",
    x: 15,
    y: 14,
    spriteId: "tex_easyrpg_charset_people1",
    characterIndex: 0,
    speaker: "미나",
    body: "어서 와요. 이 마을의 이벤트는 모두 이 에디터 안에서 만들어졌어요.",
  },
  {
    id: "event_starter_rowen",
    x: 13,
    y: 16,
    spriteId: "tex_easyrpg_charset_people2",
    characterIndex: 1,
    speaker: "로웬",
    body: "트리거를 Action Button으로 두면 말을 걸 때만 대화가 시작됩니다.",
  },
  {
    id: "event_starter_sera",
    x: 15,
    y: 18,
    spriteId: "tex_easyrpg_charset_actor2",
    characterIndex: 2,
    speaker: "세라",
    body: "얼굴 그림도 함께 뜨니까 실제 게임에서 보일 대화창을 그대로 확인할 수 있어요.",
  },
] as const satisfies readonly StarterVillageNpcSpec[];

export function addStarterVillageNpcs(map: GameMap): void {
  for (const spec of STARTER_VILLAGE_NPCS) {
    map.events.push(starterVillageNpcEvent(spec));
  }
}

function starterVillageNpcEvent(spec: StarterVillageNpcSpec): GameEvent {
  // 얼굴은 걷기 그림의 검토된 짝만 쓴다. 이름이 같은 얼굴 시트를 짝으로 보면 수녀(People2 #1)에게
  // 청발 여성이, 세라(Actor2 #2)에게 닌자 얼굴이 붙는다(2026-09-28 전수 조사).
  const faceResourceId = reviewedFaceIdForCharset(spec.spriteId, spec.characterIndex);
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
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          ...(faceResourceId ? [{
            kind: "changeFace" as const,
            resourceId: faceResourceId,
            position: "left" as const,
            flipHorizontally: false,
          }] : []),
          { kind: "text", speaker: spec.speaker, body: spec.body },
        ],
      },
    ],
  };
}
