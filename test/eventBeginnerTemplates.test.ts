import { describe, expect, it } from "vitest";
import { buildEventBeginnerTemplate } from "@/editor/eventBeginnerTemplates";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";

function commandFor(templateId: Parameters<typeof buildEventBeginnerTemplate>[3]) {
  const project = createBlankProject();
  const result = buildEventBeginnerTemplate(project, project.startMapId, "event-template", templateId);
  if (!result.command) throw new Error(result.unavailableReason);
  return { command: result.command, project };
}

describe("event beginner templates", () => {
  it("builds immediately usable dialogue and unique chest starters", () => {
    expect(commandFor("talking-npc").command).toEqual({ kind: "text", body: "안녕하세요." });
    expect(commandFor("treasure-chest").command).toEqual({
      kind: "openChest",
      chestId: "storage_event-template",
    });
  });

  it("uses only an existing passable map destination", () => {
    const { command, project } = commandFor("transfer");
    expect(command.kind).toBe("transfer");
    if (command.kind !== "transfer") return;
    const map = project.maps[command.mapId];
    expect(map).toBeDefined();
    expect(command.x).toBeGreaterThanOrEqual(0);
    expect(command.y).toBeGreaterThanOrEqual(0);
    expect(command.x).toBeLessThan(map!.width);
    expect(command.y).toBeLessThan(map!.height);
    expect(isPassable(project, map!, command.x, command.y)).toBe(true);
  });

  it("seeds shops and battles with records present in the project", () => {
    const shop = commandFor("shop");
    expect(shop.command.kind).toBe("shop");
    if (shop.command.kind === "shop") {
      const itemIds = new Set(shop.project.database.items.map((item) => item.id));
      expect(shop.command.itemIds.length).toBeGreaterThan(0);
      expect(shop.command.itemIds.every((itemId) => itemIds.has(itemId))).toBe(true);
    }

    const battle = commandFor("battle");
    expect(battle.command.kind).toBe("battleProcessing");
    if (battle.command.kind === "battleProcessing") {
      expect(battle.project.database.troops.some((troop) => troop.id === battle.command.troopId)).toBe(true);
    }
  });

  it("refuses to invent missing database ids", () => {
    const project = createBlankProject();
    project.database.items = [];
    project.database.troops = [];
    delete project.system.initialTroopId;

    const shop = buildEventBeginnerTemplate(project, project.startMapId, "event-template", "shop");
    const battle = buildEventBeginnerTemplate(project, project.startMapId, "event-template", "battle");

    expect(shop.command).toBeUndefined();
    expect(shop.unavailableReason).toContain("아이템");
    expect(battle.command).toBeUndefined();
    expect(battle.unavailableReason).toContain("적 그룹");
  });
});
