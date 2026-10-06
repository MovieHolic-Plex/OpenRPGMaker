import { describe, expect, it } from "vitest";
import { findSharedPortrait } from "@/assets/sharedPortraitAssets";
import { createBlankProject } from "@/project/defaults";
import { deserialize } from "@/project/io";
import { runTool } from "@/editor/tools";

describe("dialogue portrait discovery and authoring", () => {
  it("exposes bust and full portraits in the first browse page", () => {
    const result = runTool({ project: createBlankProject() }, "list_resources", { kind: "faceset", query: "*" });
    expect(result.ok, result.summary).toBe(true);
    const matches = (result.data as { matches: { id: string }[] }).matches;
    expect(matches.some(match => findSharedPortrait(match.id)?.mode === "bust")).toBe(true);
    expect(matches.some(match => findSharedPortrait(match.id)?.mode === "full")).toBe(true);
  });

  it("keeps dialogue and quest branches when only an existing villager's portrait changes", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const create = runTool(ctx, "make_villager", {
      mapId, id: "qa_portrait_villager", name: "수련생", home: { x: 3, y: 3 },
      graphic: { textureKey: "tex_easyrpg_charset_actor1", characterIndex: 0 },
      pages: [{ lines: ["수련을 시작하겠습니다."], commands: [{ kind: "choices", options: [
        { text: "계속", branch: [{ kind: "text", speaker: "수련생", body: "다음 수련입니다." }] },
        { text: "쉬기", branch: [] },
      ], cancelBehavior: "branch", cancelBranch: [] }] }],
    });
    expect(create.ok, create.summary).toBe(true);
    const event = () => ctx.project.maps[mapId]!.events.find(event => event.id === "qa_portrait_villager")!;
    const withoutFace = () => event().pages!.map(page => ({ ...page, commands: page.commands.filter(command => command.kind !== "changeFace") }));
    const before = structuredClone(withoutFace());
    const resourceId = "shared-brown-headband-expressions-bust-base";
    const update = runTool(ctx, "make_villager", { mapId, id: event().id, name: event().name, home: { x: 3, y: 3 }, face: { resourceId } });
    expect(update.ok, update.summary).toBe(true);
    expect(withoutFace()).toEqual(before);
    const reloaded = deserialize(JSON.stringify(ctx.project));
    expect(reloaded.maps[mapId]!.events.find(event => event.id === "qa_portrait_villager")!.pages![0]!.commands[0])
      .toMatchObject({ kind: "changeFace", resourceId });
  });
});
