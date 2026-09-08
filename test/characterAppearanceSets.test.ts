import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { getCharacterAppearance, listAppearanceUsages, resolveActorAppearance, resolveAppearancePortrait } from "@/project/characterAppearances";
import { collectUsedUploadedAssetIds } from "@/project/webExportAssets";
import { characterAppearanceProject } from "./fixtures/characterAppearanceProject";

describe("character appearance authored boundary", () => {
  it.each([
    ["non-array catalog", {}],
    ["missing name", [{ id: "look", description: "" }]],
    ["duplicate ids", [{ id: "look", name: "A", description: "" }, { id: "look", name: "B", description: "" }]],
    ["invalid slot", [{ id: "look", name: "A", description: "", charset: { resourceId: "easyrpg-charset-actor1", characterIndex: 8 } }]],
    ["missing resource", [{ id: "look", name: "A", description: "", face: { resourceId: "missing-face" } }]],
    ["wrong resource kind", [{ id: "look", name: "A", description: "", face: { resourceId: "easyrpg-charset-actor1" } }]],
  ])("rejects %s when loading authored appearances", (_name, characterAppearances) => {
    // Given authored JSON at the existing load boundary.
    const project = createBlankProject();
    const wire = JSON.stringify({ ...project, database: { ...project.database, characterAppearances } });
    // When / Then malformed authored fields must not be silently retained or dropped.
    expect(() => deserialize(wire)).toThrow();
  });

  it("keeps the catalog absent when loading a legacy project", () => {
    // Given a legacy project with no catalog.
    const project = createBlankProject();
    // When it crosses the persistence boundary.
    const loaded = deserialize(serialize(project));
    // Then no empty catalog is invented.
    expect(Object.hasOwn(loaded.database, "characterAppearances")).toBe(false);
  });

  it("preserves catalog, page link, and actor link across save and reload", () => {
    // Given a complete set and an intentionally empty set.
    const project = characterAppearanceProject();
    const legacyActor = { ...project.database.actors[0] };
    // When persisted through the canonical path.
    const loaded = deserialize(serialize(project));
    // Then references and legacy direct fields survive together.
    expect(loaded.database.characterAppearances).toEqual(project.database.characterAppearances);
    expect(loaded.database.actors[0].appearanceId).toBe("look");
    expect(loaded.database.actors[0].characterResourceId).toBe(legacyActor.characterResourceId);
    expect(loaded.maps[loaded.startMapId].events[0].pages?.[0].graphic.appearanceId).toBe("look");
    expect(getCharacterAppearance(loaded, "empty")).toEqual({ id: "empty", name: "Empty", description: "" });
    expect(collectUsedUploadedAssetIds(loaded)).toContain("uploaded-walk");
  });

  it.each(["actor", "page", "command"] as const)("rejects dangling %s links when reloading", (target) => {
    // Given a reference to an absent set.
    const project = characterAppearanceProject();
    const event = project.maps[project.startMapId].events[0];
    switch (target) {
      case "actor": project.database.actors[0].appearanceId = "missing"; break;
      case "page": {
        const page = event.pages?.[0];
        if (!page) throw new Error("fixture page missing");
        page.graphic.appearanceId = "missing";
        break;
      }
      case "command": event.commands = [{ kind: "changeFace", resourceId: "", appearanceId: "missing", position: "left", flipHorizontally: false }]; break;
    }
    // When / Then load rejects instead of erasing authored intent.
    expect(() => deserialize(serialize(project))).toThrow(/appearanceId/);
  });

  it("reports actors, pages, and nested common-event commands when checking usages", () => {
    // Given a reference nested under a loop.
    const project = characterAppearanceProject();
    project.commonEvents.push({ id: "appearance-common", name: "Portrait", trigger: "none", commands: [
      { kind: "loop", body: [{ kind: "changeFace", resourceId: "", appearanceId: "look", position: "left", flipHorizontally: false }] },
    ] });
    // When deletion protection asks for usages.
    const usages = listAppearanceUsages(project, "look");
    // Then each reference kind blocks unsafe deletion.
    expect(usages.map((usage) => usage.kind)).toEqual(["actor", "event", "command"]);
    expect(listAppearanceUsages(project, "empty")).toEqual([]);
  });

  it("falls back to legacy direct slots when an actor links an incomplete set", () => {
    // Given a metadata-only appearance.
    const project = characterAppearanceProject();
    const actor = { ...project.database.actors[0], appearanceId: "empty" };
    // When effective slots are projected.
    const effective = resolveActorAppearance(project, actor);
    // Then omitted set slots retain legacy values and authoring stays intact.
    expect(effective).toEqual(actor);
    expect(resolveAppearancePortrait(project, "empty", "bust")).toBeUndefined();
  });

  it("rejects a charset upload with an unsupported authored sheet layout", () => {
    // Given a purported charset that cannot contain eight 3x4 characters.
    const project = characterAppearanceProject();
    project.assets.uploaded["uploaded-walk"].meta.width = 48;
    // When / Then the linked resource cannot silently use an arbitrary slice.
    expect(() => deserialize(serialize(project))).toThrow(/charset/);
  });

  it.each([
    ["bust", "generated-face-actor1-bust"],
    ["bust", "generated-face-actor1-full"],
    ["face", "generated-actor-hero-01-face"],
  ] as const)("accepts built-in portrait %s/%s offered by the picker", (slot, resourceId) => {
    // Given a real built-in picture, without a redundant project profile.
    const project = characterAppearanceProject();
    project.resourceProfiles = project.resourceProfiles.filter((profile) => profile.assetId !== resourceId);
    project.database.characterAppearances = [{ id: "look", name: "Guide", description: "", [slot]: { resourceId } }];
    // When the authored selection crosses the save/load boundary.
    const loaded = deserialize(serialize(project));
    // Then the picker choice remains valid with explicit bust presentation.
    expect(resolveAppearancePortrait(loaded, "look", slot)?.resourceId).toBe(resourceId);
  });
});
