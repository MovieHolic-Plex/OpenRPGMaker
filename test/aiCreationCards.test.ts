import { describe, expect, it } from "vitest";
import { listChangeItems, revertChangeItem } from "@/editor/panels/aiChangeSummaryCard";
import { creationCardModel, firstPlayedMusic, firstSpokenLine } from "@/editor/panels/aiCreationCards";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, Project } from "@/project/types";

function run(project: Project, tool: string, args: Record<string, unknown>): Project {
  const ctx = { project };
  const result = runTool(ctx, tool, args);
  if (!result.ok) throw new Error(`${tool}: ${result.summary}`);
  return ctx.project;
}

describe("creation card models", () => {
  it("reads an equipment item's key stats and type from the record the tool wrote", () => {
    const before = createBlankProject();
    const after = run(before, "upsert_item", { item: { id: "item_flame_sword", name: "불꽃검", type: "weapon", price: 300, equipmentProfile: { statBonuses: { attack: 12, defense: 0, mind: 3, agility: 0 } } } });
    const item = listChangeItems(before, after).find((entry) => entry.id === "item_flame_sword")!;
    const model = creationCardModel(after, item)!;
    expect(model.title).toBe("불꽃검");
    expect(model.kindLine).toBe("장비 · 무기");
    expect(model.stats).toBe("공격 +12 · 마력 +3 · 300G");
  });

  it("gives a monster its HP/attack line", () => {
    const before = createBlankProject();
    const after = run(before, "upsert_enemy", { enemy: { id: "enemy_boss", name: "어둠 군주", monsterResourceId: "generated-enemy-slime-01", stats: { maxHp: 900, maxMp: 50, attack: 40, defense: 22, mind: 30, agility: 18 } } });
    const item = listChangeItems(before, after).find((entry) => entry.kind === "enemy" && entry.id === "enemy_boss")!;
    expect(creationCardModel(after, item)!.stats).toMatch(/^HP 900 · 공격 40 · 방어 22/u);
  });

  it("marks an item whose icon is a type stand-in, and clears the mark once a fitting icon is set", () => {
    const before = createBlankProject();
    const after = run(before, "upsert_item", { item: { id: "item_lunchbox", name: "나그네 도시락", type: "medicine" } });
    const item = listChangeItems(before, after).find((entry) => entry.id === "item_lunchbox")!;
    expect(creationCardModel(after, item)!.placeholderArt).toBe(true);
    const fixed = run(after, "upsert_item", { item: { id: "item_lunchbox", iconResourceId: "cc0-jetrel-bread" } });
    expect(creationCardModel(fixed, item)!.placeholderArt).toBeUndefined();
    const tea = run(before, "upsert_item", { item: { id: "item_tea", name: "달빛 차", type: "medicine" } });
    expect(creationCardModel(tea, listChangeItems(before, tea).find((entry) => entry.id === "item_tea")!)!.placeholderArt).toBeUndefined();
  });
});

describe("battle music change", () => {
  it("lists the project battle track as a music item and reverts only it", () => {
    const before = createBlankProject();
    const after = { ...before, system: { ...before.system, battleBgmResourceId: "cc0-bgm-boss-test" } } as Project;
    const items = listChangeItems(before, after);
    const music = items.find((entry) => entry.kind === "music")!;
    expect(music).toMatchObject({ id: "battleBgmResourceId", change: "modified", label: "전투 음악" });
    const reverted = revertChangeItem(after, before, music);
    expect(reverted.system.battleBgmResourceId).toBe(before.system.battleBgmResourceId);
  });
});

describe("firstSpokenLine", () => {
  it("finds the first text line inside nested choices, with its speaker", () => {
    const event = { id: "ev", x: 0, y: 0, pages: [{ commands: [
      { kind: "choices", options: [{ text: "네", branch: [{ kind: "text", speaker: "상인", body: "\n어서 오세요!\n둘째 줄" }] }] },
    ] }] } as unknown as GameEvent;
    expect(firstSpokenLine(event)).toEqual({ speaker: "상인", text: "어서 오세요!" });
  });
});

describe("firstPlayedMusic", () => {
  it("finds the boss track an event plays as background music, ignoring sound effects", () => {
    const event = { id: "ev", x: 0, y: 0, pages: [{ commands: [
      { kind: "playAudio", resourceId: "cc0-se-roar", loop: false },
      { kind: "playAudio", resourceId: "cc0-bgm-boss", loop: true },
    ] }] } as unknown as GameEvent;
    expect(firstPlayedMusic(event)).toBe("cc0-bgm-boss");
  });
});
