// 《이슬 마을의 종》 주민 대사에 관계를 입힌다 — 시간대·현재 활동·호감·퀘스트 진행.
//
// 실측 배경(2026-07-26): 장로만 6페이지 퀘스트 체인을 갖고 있고 나머지 주민은 **1페이지 고정 대사**였다.
// 종을 되살려도(sw_0006) 마을 사람 누구도 그 사실을 모른다. 그래서 마을이 배경 그림처럼 느껴진다.
// 조건 시스템은 이미 timePhase·npcActivity·friendshipAtLeast·switch 를 전부 지원한다(Condition union).
// 즉 기능이 없어서가 아니라 **쓰지 않아서** 비어 있었다.
//
// 두 가지 함정을 함께 해결한다:
//  1. friendshipAtLeast 는 resolveSocialKey(event) 가 null 이면 항상 false 다(socialKey.ts:22).
//     characterId 가 없으면 호감 조건이 영원히 거짓이므로 characterId 를 반드시 채운다.
//  2. 페이지가 교체되면 **그 페이지의 명령 전체**가 바뀐다. 상인의 shop / 노아의 recoverAll 을
//     빠뜨리면 조건이 맞는 순간 상점과 회복이 사라진다. 그래서 기능 명령은 모든 변형에 유지한다.
//
// 페이지 선택 규칙: 뒤에서부터 조건이 맞는 첫 페이지가 이긴다(pageResolution.ts:20, RM2K3 동작).
// 따라서 p0 = 무조건 폴백, 뒤로 갈수록 더 구체적인 상황을 둔다.

import type { Command, Condition, EventPage, GameEvent, Project } from "@/project/types";

/** 퀘스트 진행 스위치 — 장로 페이지(dew-village-demo fixture)가 쓰는 것과 같은 id. */
const QUEST = {
  accepted: "sw_0001",
  herbsDone: "sw_0002",
  bellRestored: "sw_0006",
} as const;

interface DialogueLayer {
  /** 이 층이 나타날 조건. 빈 배열이면 폴백. */
  readonly conditions: readonly Condition[];
  /** 이 층에서 말할 대사(여러 줄 가능). */
  readonly lines: readonly string[];
}

interface NpcDialogue {
  readonly eventId: string;
  readonly characterId: string;
  readonly speaker: string;
  /** 뒤로 갈수록 구체적. p0 은 기존 페이지를 재사용하므로 여기 넣지 않는다. */
  readonly layers: readonly DialogueLayer[];
}

const switchOn = (switchId: string): Condition => ({ kind: "switch", switchId, value: true });
const activity = (name: string): Condition => ({ kind: "npcActivity", activity: name });
const phase = (name: "morning" | "day" | "evening" | "night"): Condition =>
  ({ kind: "timePhase", phase: name } as Condition);
const friendship = (value: number): Condition => ({ kind: "friendshipAtLeast", value });

const NPC_DIALOGUE: readonly NpcDialogue[] = [
  {
    eventId: "ev_merchant",
    characterId: "char_merchant",
    speaker: "만물상",
    layers: [
      // 시간대·활동 — 같은 사람이 하루 중 언제 만나느냐에 따라 다른 말을 한다.
      { conditions: [activity("prepare")], lines: ["아직 좌판을 펴는 중이야. 조금만 기다려 주겠나?"] },
      { conditions: [activity("market")], lines: ["이슬 장터의 자랑, 아침에 들어온 것만 골라 왔지."] },
      { conditions: [phase("evening")], lines: ["오늘 장사는 접었네. 그래도 급하면 꺼내 주지."] },
      // 퀘스트 진행 — 마을이 사건을 알고 있다.
      {
        conditions: [switchOn(QUEST.accepted)],
        lines: ["미르 장로 심부름인가? 달빛 숲은 안개가 짙어. 물약은 넉넉히 챙기게."],
      },
      {
        conditions: [switchOn(QUEST.bellRestored)],
        lines: ["종이 다시 울린 뒤로 손님이 늘었어. 자네 덕이야 — 값은 깎아 주지."],
      },
      // 관계 — 자주 말을 걸면 태도가 바뀐다.
      { conditions: [friendship(30)], lines: ["자네한테는 좋은 물건부터 보여주지. 우리 사이에 뭘."] },
    ],
  },
  {
    eventId: "ev_noah",
    characterId: "char_noah",
    speaker: "노아",
    layers: [
      { conditions: [activity("well")], lines: ["아침 물을 긷는 중이야. 우물이 마르면 마을이 마르지."] },
      { conditions: [activity("field")], lines: ["밭일은 허리가 아파도 정직하네. 다친 데는 없나?"] },
      { conditions: [phase("evening")], lines: ["해 질 때 종소리를 들으면 하루가 닫히는 기분이야."] },
      {
        conditions: [switchOn(QUEST.accepted)],
        lines: ["약초를 찾는다고? 달빛 숲 북쪽, 물기 있는 그늘을 보게. 반짝 꽃은 마른 땅을 싫어해."],
      },
      {
        conditions: [switchOn(QUEST.herbsDone)],
        lines: ["세 포기를 다 모았다고? 미르 장로가 기다리시겠네. 몸은 내가 봐 주지."],
      },
      {
        conditions: [switchOn(QUEST.bellRestored)],
        lines: ["안개가 걷히니 약초가 잘 자라. 이런 아침을 다시 볼 줄은 몰랐어."],
      },
      { conditions: [friendship(30)], lines: ["자네는 이제 마을 사람이야. 아플 땐 참지 말고 오게."] },
    ],
  },
  {
    eventId: "ev_kid",
    characterId: "char_lu",
    speaker: "루",
    layers: [
      { conditions: [activity("play")], lines: ["잡아 봐! 나 진짜 빠르다!"] },
      {
        conditions: [phase("evening")],
        lines: ["엄마가 부르는데… 조금만 더 놀면 안 될까?"],
      },
      {
        conditions: [switchOn(QUEST.accepted)],
        lines: ["반짝 꽃 봤어! 세 포기 맞아. 근데 안개 속에서 뭔가 움직였어… 무서워서 도망쳤어."],
      },
      {
        conditions: [switchOn(QUEST.bellRestored)],
        lines: ["종소리 들었어? 나 그 소리 처음 들어! 이제 아침에도 밖에서 놀 수 있대!"],
      },
      {
        conditions: [friendship(20)],
        lines: ["너 내 친구지? 그럼 비밀 알려줄게 — 창고 뒤에 아무도 안 보는 데가 있어."],
      },
    ],
  },
];

/** 기존 페이지의 명령 중 선행 text 만 바꾸고 기능 명령(shop/recoverAll 등)은 유지한다. */
function commandsWithLines(base: readonly Command[], speaker: string, lines: readonly string[]): Command[] {
  const functional = base.filter((command) => command.kind !== "text");
  const spoken: Command[] = lines.map((body) => ({ kind: "text", speaker, body }) as Command);
  return [...spoken, ...functional];
}

export interface DialogueLayerResult {
  readonly npcs: number;
  readonly pagesAdded: number;
  readonly skipped: readonly string[];
}

/**
 * 주민 대사를 층으로 쌓는다. project 를 제자리에서 수정하며, 이미 적용된 프로젝트에는 다시 쌓지 않는다.
 * 장로(ev_mir_elder)는 건드리지 않는다 — 퀘스트 체인이 페이지 순서에 의존하므로 추가 페이지가
 * 뒤에서 이겨 버리면 퀘스트가 진행되지 않는다.
 */
export function layerDewVillageDialogue(project: Project): DialogueLayerResult {
  const map = project.maps[project.startMapId];
  if (!map) return { npcs: 0, pagesAdded: 0, skipped: [] };
  const skipped: string[] = [];
  let npcs = 0;
  let pagesAdded = 0;

  for (const spec of NPC_DIALOGUE) {
    const event: GameEvent | undefined = map.events.find((entry) => entry.id === spec.eventId);
    if (!event) {
      skipped.push(`${spec.eventId}(이벤트 없음)`);
      continue;
    }
    const base = event.pages?.[0];
    if (!base) {
      skipped.push(`${spec.eventId}(기본 페이지 없음)`);
      continue;
    }
    // 호감 조건이 작동하려면 characterId 가 있어야 한다(없으면 resolveSocialKey → null → 항상 false).
    event.characterId ??= spec.characterId;
    // 대화로 호감이 자라지 않으면 friendshipAtLeast 층은 영원히 열리지 않는다.
    event.talkFriendship ??= true;

    // 멱등: 이미 층이 쌓여 있으면(1페이지 초과) 다시 쌓지 않는다.
    if ((event.pages?.length ?? 0) > 1) {
      npcs += 1;
      continue;
    }
    const layered: EventPage[] = spec.layers.map((layer, index) => ({
      ...base,
      id: `${base.id}_layer_${index + 1}`,
      conditions: [...layer.conditions],
      commands: commandsWithLines(base.commands, spec.speaker, layer.lines),
    }));
    event.pages = [base, ...layered];
    npcs += 1;
    pagesAdded += layered.length;
  }
  return { npcs, pagesAdded, skipped };
}
