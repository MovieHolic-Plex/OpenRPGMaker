import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { faceIdForSheetCell } from "@/assets/facesetFaceAssets";
import type { GameEvent, GameMap } from "../types";

type StarterVillageNpcSpec = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly spriteId: string;
  readonly characterIndex: number;
  /** 낱장 얼굴 리소스 id. */
  readonly faceResourceId: string;
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
    faceResourceId: faceIdForSheetCell("easyrpg-faceset-people1", 0),
    speaker: "미나",
    body: "어서 와요. 이 마을의 이벤트는 모두 이 에디터 안에서 만들어졌어요.",
  },
  {
    id: "event_starter_rowen",
    x: 13,
    y: 16,
    spriteId: "tex_easyrpg_charset_people2",
    characterIndex: 1,
    faceResourceId: faceIdForSheetCell("easyrpg-faceset-people2", 1),
    speaker: "로웬",
    body: "트리거를 Action Button으로 두면 말을 걸 때만 대화가 시작됩니다.",
  },
  {
    id: "event_starter_sera",
    x: 15,
    y: 18,
    spriteId: "tex_easyrpg_charset_actor2",
    characterIndex: 2,
    faceResourceId: faceIdForSheetCell("easyrpg-faceset-actor2", 2),
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
          {
            kind: "changeFace",
            resourceId: spec.faceResourceId,
            position: "left",
            flipHorizontally: false,
          },
          { kind: "text", speaker: spec.speaker, body: spec.body },
        ],
      },
    ],
  };
}
