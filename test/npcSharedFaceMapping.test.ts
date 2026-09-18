import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { acceptSharedCharacterGraphics, refreshSharedCharacterGraphics, sharedFaceForCharset } from "@/project/sharedCharacterFaceResolver";
import { defaultSharedCharacterGraphics, SHARED_CHARACTER_GRAPHICS_ENDPOINT } from "@/project/sharedCharacterGraphicsSchema";

const textureKey = "tex_easyrpg_charset_people1";
const chosen = "easyrpg-faceset-actor1-09"; // Deliberately unlike the old people1#0 heuristic.
function catalog(status: "mapped" | "no-face" | "pending" = "mapped") {
  const doc = defaultSharedCharacterGraphics();
  const row = doc.mappings.find(row => row.textureKey === textureKey && row.characterIndex === 0)!;
  row.status = status;
  row.faceResourceId = status === "mapped" ? chosen : null;
  return doc;
}
function npc(tool: string, extra: Record<string, unknown> = {}) {
  const ctx: ToolContext = { project: createBlankProject() };
  const result = runTool(ctx, tool, {
    mapId: ctx.project.startMapId, name: "매핑 확인 주민",
    ...(tool === "make_villager" ? { home: { x: 3, y: 3 } } : { x: 3, y: 3 }),
    graphic: { textureKey, characterIndex: 0 }, pages: [{ lines: ["매핑 확인 대사"] }], ...extra,
  });
  expect(result.ok, result.summary).toBe(true);
  const event = ctx.project.maps[ctx.project.startMapId]!.events.find(event => event.id === (result.data as { eventId: string }).eventId)!;
  expect(event).toBeDefined();
  return event.pages!;
}
afterEach(() => { acceptSharedCharacterGraphics(defaultSharedCharacterGraphics()); vi.unstubAllGlobals(); });

describe.each(["place_npc", "make_villager"])("%s shared face mapping", tool => {
  it("writes the authored mapping into real event commands and survives JSON reload", () => {
    acceptSharedCharacterGraphics(catalog());
    const pages = JSON.parse(JSON.stringify(npc(tool)));
    expect(pages[0].commands[0]).toMatchObject({ kind: "changeFace", resourceId: chosen });
    expect(pages[0].commands.some((command: { kind: string }) => command.kind === "text")).toBe(true);
  });
  it.each(["no-face", "pending"] as const)("does not reintroduce a heuristic portrait for %s", status => {
    acceptSharedCharacterGraphics(catalog(status));
    expect(npc(tool)[0]!.commands.some(command => command.kind === "changeFace")).toBe(false);
  });
  it("keeps explicit face overrides", () => {
    acceptSharedCharacterGraphics(catalog("no-face"));
    expect(npc(tool, { face: { resourceId: chosen } })[0]!.commands[0]).toMatchObject({ kind: "changeFace", resourceId: chosen });
  });
  it("resolves each page graphic, not just the top-level sprite", () => {
    acceptSharedCharacterGraphics(catalog("no-face"));
    const pages = npc(tool, { pages: [{ lines: ["기본"] }, {
      conditions: [{ kind: "selfSwitch", key: "A", value: true }], lines: ["다른 모습"],
      graphic: { textureKey: "tex_easyrpg_charset_actor2", characterIndex: 1 },
    }] });
    expect(pages[0]!.commands.some(command => command.kind === "changeFace")).toBe(false);
    expect(pages[1]!.commands[0]).toMatchObject({ kind: "changeFace", resourceId: "easyrpg-faceset-actor1-09" });
  });
  it("uses a newly fetched server mapping without opening the database tab", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ document: catalog(), revision: "test" }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);
    await refreshSharedCharacterGraphics();
    expect(fetcher).toHaveBeenCalledWith(SHARED_CHARACTER_GRAPHICS_ENDPOINT, expect.objectContaining({ cache: "no-store" }));
    expect(npc(tool)[0]!.commands[0]).toMatchObject({ kind: "changeFace", resourceId: chosen });
  });
});

it("does not guess absent rows or invalid slots", () => {
  acceptSharedCharacterGraphics({ ...catalog(), mappings: [] });
  expect(sharedFaceForCharset(textureKey, 0)).toBeNull();
  expect(sharedFaceForCharset(textureKey, 8)).toBeNull();
});
it("rejects unavailable or invalid host data without replacing the last accepted catalog", async () => {
  acceptSharedCharacterGraphics(catalog());
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
  await expect(refreshSharedCharacterGraphics()).rejects.toThrow("공용");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ document: {} }), { headers: { "Content-Type": "application/json" } })));
  await expect(refreshSharedCharacterGraphics()).rejects.toThrow();
  expect(sharedFaceForCharset(textureKey, 0)?.resourceId).toBe(chosen);
});
