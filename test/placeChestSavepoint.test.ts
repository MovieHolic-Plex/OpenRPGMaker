import { describe, expect, it } from "vitest";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { CHEST_OPEN_SE, LOOT_GOLD_SE, LOOT_ITEM_SE } from "@/editor/lootFeedback";
import { getTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

// createBlankProject()가 기본 맵/타일셋/아이템 픽스처를 제공하는 기존 테스트 픽스처 패턴을 따른다
// (place_npc 계열 테스트: test/placeNpcMalformedPage.test.ts)와 동일 소스.
function projectWithMap(): { project: Project; mapId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  return { project, mapId };
}

describe("place_chest", () => {
  it("셀프스위치 2페이지 보물상자 이벤트를 만든다 (아이템+골드)", () => {
    const { project, mapId } = projectWithMap();
    const itemId = project.database.items[0]?.id ?? "item_potion";
    const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { itemId, gold: 50 } });
    expect(result.summary).toContain("보물상자");
    const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
    expect(event.pages).toHaveLength(2);
    const closed = event.pages![0];
    expect(closed.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: false }]);
    const kinds = closed.commands.map((command) => command.kind);
    expect(kinds).toEqual([
      "playAudio",
      "setEventGraphicPattern",
      "wait",
      "setEventGraphicPattern",
      "wait",
      "playAudio",
      "changeItem",
      "wait",
      "playAudio",
      "changeGold",
      "text",
      "setSelfSwitch",
    ]);
    const audio = closed.commands.filter((command) => command.kind === "playAudio") as { resourceId: string }[];
    expect(audio.map((command) => command.resourceId)).toEqual([CHEST_OPEN_SE, LOOT_ITEM_SE, LOOT_GOLD_SE]);
    const frames = closed.commands.filter((command) => command.kind === "setEventGraphicPattern") as { eventId: string; pattern: number }[];
    expect(frames.every((command) => command.eventId === event.id)).toBe(true);
    expect(frames.map((command) => decodeCharsetFrameIndex(command.pattern).direction)).toEqual(["right", "up"]);
    const opened = event.pages![1];
    expect(opened.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: true }]);
  });

  it("열림 페이지는 개방(up) 프레임을 그리고, 닫힘 페이지는 닫힘(down) 프레임을 그린다", () => {
    const { project, mapId } = projectWithMap();
    const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { gold: 20 } });
    const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
    const [closed, opened] = event.pages!;
    expect(closed.graphic.direction).toBe("down");
    expect(opened.graphic.direction).toBe("up");
    expect(opened.graphic.sprite).toEqual(closed.graphic.sprite);
    expect(opened.graphic.pattern).not.toBe(closed.graphic.pattern);
    const closedFrame = decodeCharsetFrameIndex(closed.graphic.pattern as number);
    const openedFrame = decodeCharsetFrameIndex(opened.graphic.pattern as number);
    expect(openedFrame.characterIndex).toBe(closedFrame.characterIndex);
    expect(openedFrame.direction).toBe("up");
  });

  it("보상 텍스트는 아이템 id 가 아니라 데이터베이스 이름을 쓴다", () => {
    const { project, mapId } = projectWithMap();
    const item = project.database.items[0]!;
    expect(item.name.length).toBeGreaterThan(0);
    const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { itemId: item.id, gold: 50 } });
    const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
    const text = event.pages![0].commands.find((command) => command.kind === "text") as { body: string };
    expect(text.body).toContain(item.name);
    expect(text.body).not.toContain(item.id);
    expect(text.body).toContain("50G");
    expect(result.summary).toContain(item.name);
  });

  it("골드만 있으면 동전 SE → changeGold 만 지급한다", () => {
    const { project, mapId } = projectWithMap();
    const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { gold: 20 } });
    const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
    const kinds = event.pages![0].commands.map((command) => command.kind);
    expect(kinds).toEqual([
      "playAudio",
      "setEventGraphicPattern",
      "wait",
      "setEventGraphicPattern",
      "wait",
      "playAudio",
      "changeGold",
      "text",
      "setSelfSwitch",
    ]);
    expect(kinds).not.toContain("changeItem");
  });

  it("contents가 비면 ToolError", () => {
    const { project, mapId } = projectWithMap();
    expect(() => getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: {} })).toThrow(/contents/);
  });

  it("DB에 없는 아이템이면 경고를 남긴다", () => {
    const { project, mapId } = projectWithMap();
    const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { itemId: "item_없는것" } });
    expect(result.warnings?.some((warning) => warning.includes("item_없는것"))).toBe(true);
  });
});

describe("place_savepoint", () => {
  it("checkpointSave 커맨드를 가진 이벤트를 만든다", () => {
    const { project, mapId } = projectWithMap();
    const result = getTool("place_savepoint")!.run(project, { mapId, x: 2, y: 2 });
    const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
    const kinds = event.pages![0].commands.map((command) => command.kind);
    expect(kinds).toContain("checkpointSave");
  });
});

describe("place_storage_chest", () => {
  it("openChest 커맨드 1페이지 보관 상자 이벤트를 만든다", () => {
    const { project, mapId } = projectWithMap();
    const result = getTool("place_storage_chest")!.run(project, { mapId, x: 4, y: 5, name: "창고" });
    expect(result.summary).toContain("보관 상자");
    const data = result.data as { eventId: string; chestId: string };
    const event = project.maps[mapId].events.find((entry) => entry.id === data.eventId)!;
    expect(event.pages).toHaveLength(1);
    expect(event.trigger).toEqual({ kind: "action" });
    const page = event.pages![0];
    expect(page.commands).toEqual([{ kind: "openChest", chestId: data.chestId }]);
    expect(data.chestId).toBe(`storage_${data.eventId}`);
  });
  it("보물상자와 다른 그래픽을 쓴다 (보관함 식별)", () => {
    const { project, mapId } = projectWithMap();
    const itemId = project.database.items[0]?.id ?? "item_potion";
    const chest = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { itemId } });
    const storage = getTool("place_storage_chest")!.run(project, { mapId, x: 5, y: 5, name: "창고" });
    const chestEvent = project.maps[mapId].events.find((entry) => entry.id === (chest.data as { eventId: string }).eventId)!;
    const storageEvent = project.maps[mapId].events.find((entry) => entry.id === (storage.data as { eventId: string }).eventId)!;
    const chestGraphic = chestEvent.pages![0].graphic;
    const storageGraphic = storageEvent.pages![0].graphic;
    expect(storageGraphic.sprite).toEqual({ type: "bundled", id: "tex_easyrpg_charset_object2" });
    expect(chestGraphic.sprite).toEqual({ type: "bundled", id: "tex_easyrpg_charset_object1" });
    expect(storageGraphic.pattern).not.toBe(chestGraphic.pattern);
    expect(decodeCharsetFrameIndex(storageGraphic.pattern as number).characterIndex).toBe(7);
  });

  it("chestId를 지정하면 그대로 쓴다", () => {
    const { project, mapId } = projectWithMap();
    const result = getTool("place_storage_chest")!.run(project, {
      mapId,
      x: 1,
      y: 1,
      id: "ev_box_home",
      chestId: "farm_main_chest",
    });
    const data = result.data as { eventId: string; chestId: string };
    expect(data.eventId).toBe("ev_box_home");
    expect(data.chestId).toBe("farm_main_chest");
    const event = project.maps[mapId].events.find((entry) => entry.id === data.eventId)!;
    expect(event.pages![0].commands[0]).toEqual({ kind: "openChest", chestId: "farm_main_chest" });
  });

  it("맵 밖이면 ToolError", () => {
    const { project, mapId } = projectWithMap();
    expect(() => getTool("place_storage_chest")!.run(project, { mapId, x: 999, y: 999 })).toThrow(/맵 밖/);
  });
});
