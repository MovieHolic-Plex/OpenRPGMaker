// 2026-11-08 tiles-relax (owner: 「이름 거절을 거의 제거하고」): generate_missing_object refuses only an exact id / display-name match.
// A name that merely shares a word with a stock kit (「얼음 기둥」 vs 「정원 정문 (돌기둥·열린 쇠문)」) is drawn, and the similar kits
// come back as a visible note so the agent can still pick a stock one.
import { describe, expect, it } from "vitest";
import { buildObjectGenRequest } from "@/editor/tools/objectGenTool";
import { createHeadlessBlankProject } from "@/headless";

const project = createHeadlessBlankProject();
const map = Object.values(project.maps).find((m) => project.tilesets[m.tilesetId]?.tileSize === 16)!;
const kit = (project.tilesets[map.tilesetId]!.structureKits ?? []).find((k) => k.width <= 8 && k.height <= 8 && (k.name ?? "").length >= 2)!;
const ask = (title: string, extra: Record<string, unknown> = {}) =>
  buildObjectGenRequest(project, { mapId: map.id, title, description: "시험용 기물", objectKind: "floor", need: "시험", ...extra });

describe("generate_missing_object name refusal", () => {
  it("draws a similarly named object and lists the similar kits as a note", () => {
    const result = ask("얼음 기둥");
    expect(result.data.title).toBe("얼음 기둥");
    expect(result.data.similar?.length).toBeGreaterThan(0);
    expect(result.summary).toContain(result.data.similar![0]!.id);
  });

  it("still refuses an exact display name or id, ignoring spaces", () => {
    expect(() => ask(kit.name!)).toThrow(kit.id);
    expect(() => ask(kit.name!.replace(/\s/gu, ""))).toThrow(kit.id);
    expect(() => ask(kit.id)).toThrow(kit.id);
  });

  it("lets notThese override an exact match", () => {
    expect(ask(kit.name!, { notThese: [kit.id] }).data.title).toBe(kit.name);
  });
});
