import { describe, expect, it } from "vitest";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { isSeCatalogResourceId } from "@/assets/seCatalogRuntime";
import {
  CHEST_OPEN_SE,
  LOOT_FEEDBACK_SE_IDS,
  LOOT_GOLD_SE,
  LOOT_ITEM_SE,
  chestOpenCommands,
  chestOpenedGraphic,
  lootGrantCommands,
  lootRummageCommands,
} from "@/editor/lootFeedback";
import type { EventPageGraphic } from "@/project/types";

// tex_easyrpg_charset_object1 슬롯 6(보물 상자) — 실측(2026-09-04, Object1.png 크롭):
// 행 up=완전 개방, right=반개방, down=닫힘, left=개방(어두움). charsetGraphic 은 down·pattern 1 을 쓴다.
const CHEST_CHARACTER = 6;
const closedChest: EventPageGraphic = {
  sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" },
  direction: "down",
  pattern: charsetFrameIndex({ characterIndex: CHEST_CHARACTER, direction: "down", pattern: 1 }),
};

describe("lootFeedback — 효과음 id 는 전부 CC0 카탈로그 소속", () => {
  it("헬퍼가 내는 모든 SE id 가 런타임 카탈로그에서 풀린다(오타 회귀 가드)", () => {
    expect(LOOT_FEEDBACK_SE_IDS.length).toBeGreaterThanOrEqual(3);
    for (const id of LOOT_FEEDBACK_SE_IDS) expect(isSeCatalogResourceId(id), id).toBe(true);
    expect(LOOT_FEEDBACK_SE_IDS).toEqual(expect.arrayContaining([CHEST_OPEN_SE, LOOT_GOLD_SE, LOOT_ITEM_SE]));
  });
});

describe("chestOpenCommands — 개봉 SE 와 닫힘→반개방→개방 프레임", () => {
  it("SE 를 먼저 울리고 같은 캐릭터 슬롯의 right → up 행으로 프레임을 바꾼다", () => {
    const commands = chestOpenCommands("ev_chest_1", closedChest);
    expect(commands.map((command) => command.kind)).toEqual([
      "playAudio",
      "setEventGraphicPattern",
      "wait",
      "setEventGraphicPattern",
      "wait",
    ]);
    expect(commands[0]).toEqual({ kind: "playAudio", resourceId: CHEST_OPEN_SE, loop: false });
    const frames = commands.filter((command) => command.kind === "setEventGraphicPattern");
    const decoded = frames.map((command) => decodeCharsetFrameIndex((command as { pattern: number }).pattern));
    expect(decoded.map((frame) => frame.direction)).toEqual(["right", "up"]);
    for (const frame of decoded) {
      expect(frame.characterIndex).toBe(CHEST_CHARACTER);
      expect(frame.pattern).toBe(1);
    }
    for (const frame of frames) expect((frame as { eventId: string }).eventId).toBe("ev_chest_1");
    const waits = commands.filter((command) => command.kind === "wait") as { ms: number }[];
    for (const wait of waits) expect(wait.ms).toBeGreaterThan(0);
  });

  it("chestOpenedGraphic 은 같은 시트·슬롯의 up(개방) 프레임을 가리킨다", () => {
    const opened = chestOpenedGraphic(closedChest);
    expect(opened.sprite).toEqual(closedChest.sprite);
    expect(opened.direction).toBe("up");
    const frame = decodeCharsetFrameIndex(opened.pattern as number);
    expect(frame).toEqual({ characterIndex: CHEST_CHARACTER, direction: "up", pattern: 1 });
    expect(opened.pattern).not.toBe(closedChest.pattern);
  });
});

describe("lootGrantCommands — 보상마다 소리가 앞선다", () => {
  it("골드만: 동전 SE → changeGold", () => {
    expect(lootGrantCommands({ gold: 30 })).toEqual([
      { kind: "playAudio", resourceId: LOOT_GOLD_SE, loop: false },
      { kind: "changeGold", op: "+=", amount: 30 },
    ]);
  });

  it("아이템+골드: 아이템 징글 → changeItem → 겹치지 않게 wait → 동전 SE → changeGold", () => {
    const commands = lootGrantCommands({ gold: 30, itemId: "item_potion" });
    expect(commands.map((command) => command.kind)).toEqual([
      "playAudio",
      "changeItem",
      "wait",
      "playAudio",
      "changeGold",
    ]);
    expect(commands[0]).toEqual({ kind: "playAudio", resourceId: LOOT_ITEM_SE, loop: false });
    expect(commands[1]).toEqual({ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 });
    expect(commands[3]).toEqual({ kind: "playAudio", resourceId: LOOT_GOLD_SE, loop: false });
  });

  it("보상이 없으면 빈 배열", () => {
    expect(lootGrantCommands({})).toEqual([]);
  });
});

describe("lootRummageCommands — 가구를 뒤지는 소리와 짧은 사이", () => {
  it("나무 상자 여는 SE 뒤에 wait 하나", () => {
    const commands = lootRummageCommands();
    expect(commands.map((command) => command.kind)).toEqual(["playAudio", "wait"]);
    expect((commands[0] as { resourceId: string }).resourceId).toBe(CHEST_OPEN_SE);
  });
});
