import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import type { Command, Project } from "@/project/types";
import { buildFixture, movie, picture } from "./eventCommandRemediation/U04.fixture";

// Composes the already exercised authoring contracts at the shipping codec seam.
// This does not claim UI interaction or runtime availability in every owner.
function storageFixture(): Project {
  const project = buildFixture();
  const actor = project.database.actors[0];
  const page = project.maps[project.startMapId]?.events[0]?.pages?.[0];
  const troop = project.database.troops[0];
  if (!actor || !page || !troop) throw new TypeError("Storage fixture owners are missing");
  const omittedWait = { ...picture(true, 0), pictureId: "omitted" };
  delete omittedWait.waitForPicture;
  const commands: Command[] = [
    ...(["festival", "closingSale", "vip"] as const).map<Command>(messageType => ({
      kind: "shop", itemIds: [], messageType, allowSell: false, merchantGold: 37,
      branchOnTransaction: true,
      transactionBranch: [{ kind: "text", body: "Purchased", speaker: "Merchant", emotion: "happy" }],
      failedTransactionBranch: [{ kind: "text", body: "Unchanged failure branch" }],
    })),
    { ...picture(true, 0), pictureId: "wait", x: 30, y: 40 },
    { ...picture(false, 500), pictureId: "no-wait" },
    omittedWait,
    { kind: "changeExp", actorId: actor.id, op: "+=", amount: { kind: "var", id: "var_0002" } },
    { kind: "loop", body: [
      { kind: "text", body: "Edited child", speaker: "NPC", emotion: "happy", autoAdvance: true },
      { kind: "breakLoop" },
    ] },
    { kind: "fork", condition: { kind: "variable", variableId: "var_0002", op: ">=", value: 17 },
      then: [{ kind: "text", body: "THEN", speaker: "Then speaker" }],
      else: [{ kind: "text", body: "ELSE", emotion: "sad" }] },
    { kind: "transfer", mapId: project.startMapId, x: 2, y: 3, direction: "left", fade: "black", transition: "fade" },
    movie({ wait: false, skippable: false }),
    { kind: "removeFollower", name: "Bob" },
    { kind: "addFollower", actorId: actor.id, name: "Hero" },
    { kind: "text", body: "Hello\\n[2]\\v[2] world", speaker: "Narrator", emotion: "happy" },
    { kind: "timer", action: "start", timerId: "timer1" },
    { kind: "timer", action: "start", timerId: "timer1", seconds: 0 },
  ];
  page.commands = structuredClone(commands);
  project.commonEvents.push({
    id: "storage_probe", name: "Storage probe", trigger: "none", commands: structuredClone(commands),
  });
  troop.battleEventPages.push({
    id: "storage_probe", name: "Storage probe", span: "battle", conditions: [], commands: structuredClone(commands),
  });
  return project;
}

function commandGroups(project: Project): readonly Command[][] {
  const map = project.maps[project.startMapId]?.events[0]?.pages?.[0]?.commands;
  const common = project.commonEvents.find(event => event.id === "storage_probe")?.commands;
  const troop = project.database.troops[0]?.battleEventPages.find(page => page.id === "storage_probe")?.commands;
  if (!map || !common || !troop) throw new TypeError("Stored command owner is missing");
  return [map, common, troop];
}

describe("composed event-command storage contracts", () => {
  it("preserves authored payloads across map, common and troop storage owners", () => {
    // Given: different command families and nested branches coexist in one project.
    const project = storageFixture();
    const before = structuredClone(project);

    // When: the complete project crosses the production save/load boundary.
    const reloaded = deserialize(serialize(project));

    // Then: authored values and unrelated data remain, including meaningful omissions.
    expect(reloaded).toMatchObject(before);
    expect(project).toEqual(before);
    const groups = commandGroups(reloaded);
    expect(groups).toMatchObject(commandGroups(before));
    for (const commands of groups) {
      expect(commands.find(command => command.kind === "showPicture" && command.pictureId === "omitted"))
        .not.toHaveProperty("waitForPicture");
      expect(commands.find(command => command.kind === "addFollower")).not.toHaveProperty("graphic");
      expect(commands.find(command => command.kind === "timer")).not.toHaveProperty("seconds");
    }
  });

  it("keeps the normalized mixed project stable through another save/load cycle", () => {
    // Given: an already normalized project with the same composed payloads.
    const normalized = deserialize(serialize(storageFixture()));

    // When: it is saved and loaded again.
    const reopened = deserialize(serialize(normalized));

    // Then: no later normalization rewrites command intent or unrelated data.
    expect(reopened).toEqual(normalized);
  });
});
