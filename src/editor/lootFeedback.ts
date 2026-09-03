/**
 * 루트 컨테이너(보물상자·서랍·나무 상자)의 게임 느낌 — 소리·개봉 프레임·리듬을 한 곳에서 낸다.
 *
 * 왜 한 곳인가: place_chest 와 place_concept 의 loot 칩이 각자 「지급 + 텍스트」만 뱉어
 * 상자를 열어도 소리 하나 없고 그림도 닫힌 채였다(2026-09-04 실측). 여기 상수와 조립기를 두면
 * 생성기마다 SE id 를 외우지 않아도 되고, 카탈로그 회귀는 test/lootFeedback.test.ts 가 잡는다.
 *
 * SE 는 전부 CC0 카탈로그(src/assets/seCatalog.ts) 소속 — 파일이 레포에 있어 오프라인에서도
 * 울리고, 이벤트 참조 검증(resourceReferenceValidation)을 그대로 통과한다.
 */
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Command, EventPageGraphic } from "@/project/types";

/** 「나무 상자 열기」 0.374s — 상자 뚜껑·서랍·궤 공통. */
export const CHEST_OPEN_SE = "cc0-se-osx-wooded-box-open";
/** 「동전」 0.604s — 금화 입수. */
export const LOOT_GOLD_SE = "cc0-se-orp-inventory-coin";
/** 「8비트 징글 09 (상승)」 0.444s — 아이템 입수. */
export const LOOT_ITEM_SE = "cc0-se-kjg-8-bit-jingles-jingles-nes09";

export const LOOT_FEEDBACK_SE_IDS: readonly string[] = [CHEST_OPEN_SE, LOOT_GOLD_SE, LOOT_ITEM_SE];

/** 반개방 프레임을 보여 주는 시간. 문 열기(houseInteriors 100ms)보다 살짝 길어 뚜껑이 들리는 게 보인다. */
export const CHEST_OPEN_FRAME_WAIT_MS = 120;
/** 완전 개방 뒤 보상 소리까지의 사이 — 개봉 SE(0.374s)가 끝나는 지점. */
export const CHEST_OPEN_HOLD_MS = 260;
/** 가구를 뒤지는 소리와 「찾았다」 사이. */
export const LOOT_RUMMAGE_WAIT_MS = 320;
/** 아이템 징글(0.444s)과 동전 소리가 한 채널에서 서로를 끊지 않게 두는 사이. */
export const LOOT_REWARD_GAP_MS = 420;

/**
 * RM2k3 Object 차셋의 상자 슬롯은 한 캐릭터 안에서 **방향 행**이 개봉 단계다
 * (down=닫힘 → right=반개방 → up=개방). 걷기 패턴 열은 그대로 둔다.
 */
const CHEST_OPEN_DIRECTIONS = ["right", "up"] as const;
const CHEST_OPENED_DIRECTION = "up" as const;

function chestFrame(graphic: EventPageGraphic, direction: (typeof CHEST_OPEN_DIRECTIONS)[number]): number {
  const closed = decodeCharsetFrameIndex(typeof graphic.pattern === "number" ? graphic.pattern : 0);
  return charsetFrameIndex({ characterIndex: closed.characterIndex, direction, pattern: closed.pattern });
}

/** 개봉 SE 를 먼저 울리고 닫힘 → 반개방 → 개방 프레임으로 뚜껑을 연다. */
export function chestOpenCommands(eventId: string, closedGraphic: EventPageGraphic): Command[] {
  const commands: Command[] = [{ kind: "playAudio", resourceId: CHEST_OPEN_SE, loop: false }];
  for (const direction of CHEST_OPEN_DIRECTIONS) {
    commands.push({ kind: "setEventGraphicPattern", eventId, pattern: chestFrame(closedGraphic, direction) });
    commands.push({ kind: "wait", ms: direction === CHEST_OPENED_DIRECTION ? CHEST_OPEN_HOLD_MS : CHEST_OPEN_FRAME_WAIT_MS });
  }
  return commands;
}

/** 열린 뒤 페이지의 그래픽 — 같은 시트·슬롯의 개방(up) 프레임. 닫힘 그림이 남는 회귀를 막는다. */
export function chestOpenedGraphic(closedGraphic: EventPageGraphic): EventPageGraphic {
  return {
    ...closedGraphic,
    direction: CHEST_OPENED_DIRECTION,
    pattern: chestFrame(closedGraphic, CHEST_OPENED_DIRECTION),
  };
}

export type LootReward = {
  readonly gold?: number;
  readonly itemId?: string;
  readonly itemAmount?: number;
};

/** 보상마다 소리가 앞선다: 아이템 징글 → changeItem, (둘 다면 사이를 두고) 동전 → changeGold. */
export function lootGrantCommands(reward: LootReward): Command[] {
  const commands: Command[] = [];
  const hasItem = typeof reward.itemId === "string" && reward.itemId.length > 0;
  const hasGold = typeof reward.gold === "number" && reward.gold > 0;
  if (hasItem) {
    commands.push({ kind: "playAudio", resourceId: LOOT_ITEM_SE, loop: false });
    commands.push({ kind: "changeItem", itemId: reward.itemId as string, op: "+=", amount: reward.itemAmount ?? 1 });
  }
  if (hasGold) {
    if (hasItem) commands.push({ kind: "wait", ms: LOOT_REWARD_GAP_MS });
    commands.push({ kind: "playAudio", resourceId: LOOT_GOLD_SE, loop: false });
    commands.push({ kind: "changeGold", op: "+=", amount: reward.gold as number });
  }
  return commands;
}

/** 그래픽이 없는 타일 가구(서랍·나무 상자·캐비닛)를 뒤지는 소리와 짧은 사이. */
export function lootRummageCommands(): Command[] {
  return [
    { kind: "playAudio", resourceId: CHEST_OPEN_SE, loop: false },
    { kind: "wait", ms: LOOT_RUMMAGE_WAIT_MS },
  ];
}
