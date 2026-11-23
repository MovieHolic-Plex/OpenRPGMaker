import { describe, expect, it } from "vitest";
import { buildSceneKit, findObjectScene, nameHasWord, OBJECT_SCENES, sceneWordLabel } from "@/editor/tools/objectScenes";
import { sharedObjects } from "@/editor/tools/sharedDesignCatalog";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults/blankProject";

type Kit = { place: string; slots: { role: string; items: { word: string; rows: { id: string; name: string }[] }[] }[] };
const kitOf = (args: Record<string, unknown>) => {
  const listed = runTool({ project: createBlankProject() }, "list_spatial_designs", { kind: "object", ...args });
  expect(listed.ok, listed.summary).toBe(true);
  return { summary: listed.summary, kit: (listed.data as { shared: { sceneKit?: Kit } }).shared.sceneKit };
};

describe("object scene kits", () => {
  it("finds the scene from the longest trigger and ignores spacing", () => {
    expect(findObjectScene("편의점앞 밤거리")?.scene.place).toBe("편의점 앞");
    expect(findObjectScene(undefined, "수산시장")?.scene.place).toBe("수산시장");
    expect(findObjectScene("수산시장 골목 만들어 줘")?.scene.place).toBe("수산시장");
    expect(findObjectScene("사당 기도터 촛불")?.scene.place).toBe("사당");
    expect(findObjectScene("쓰레기통")).toBeUndefined();
  });

  it("only keeps dictionary words that name a catalog object", () => {
    const names = sharedObjects(createBlankProject()).map(row => row.name);
    for (const scene of OBJECT_SCENES) {
      for (const words of Object.values(scene.roles)) {
        for (const word of words) expect(names.some(name => nameHasWord(name, word)), `${scene.place}: ${word}`).toBe(true);
      }
    }
  });

  it("matches any alternative name of a word and shows the first one", () => {
    expect(nameHasWord("조선 장독대 3×2", "항아리|장독")).toBe(true);
    expect(nameHasWord("조선 장독대 3×2", "항아리|옹기")).toBe(false);
    expect(sceneWordLabel("항아리|장독")).toBe("항아리");
  });

  it("lists role slots with distinct rows for a place query", () => {
    const { summary, kit } = kitOf({ query: "편의점" });
    expect(kit?.place).toBe("편의점 앞");
    expect(summary).toContain("장면 키트");
    const roles = kit!.slots.map(slot => slot.role);
    expect(roles).toEqual(expect.arrayContaining(["structure", "floor", "life"]));
    const rows = kit!.slots.flatMap(slot => slot.items.flatMap(item => item.rows));
    expect(rows.every((row, index) => rows.findIndex(other => other.id === row.id) === index)).toBe(true);
    for (const slot of kit!.slots) {
      expect(slot.items.length).toBeLessThanOrEqual(6);
      for (const item of slot.items) expect(item.rows.length).toBeGreaterThan(0);
    }
    const floor = kit!.slots.find(slot => slot.role === "floor")!;
    expect(floor.items.some(item => item.rows.some(row => row.name.includes("쓰레기통")))).toBe(true);
  });

  it("prefers rows that carry the request's other words", () => {
    const found = findObjectScene("조선 장터")!;
    const rows = [
      { id: "a", name: "버들항 수레", tilesetId: "beodeul_city", tags: ["버들항"] },
      { id: "b", name: "조선 수레 2×2", tilesetId: "joseon_baram", tags: ["조선"] },
    ];
    const kit = buildSceneKit({ scene: { ...found.scene, roles: { structure: [], floor: ["수레"], life: [], light: [], nature: [] } }, trigger: found.trigger }, rows, ["조선", "장터"]);
    expect(kit.slots[0]!.items[0]!.rows[0]!.id).toBe("b");
  });

  it("adds no scene kit to a plain object query or a place listing", () => {
    expect(kitOf({ query: "쓰레기통" }).kit).toBeUndefined();
    const places = runTool({ project: createBlankProject() }, "list_spatial_designs", { kind: "place", query: "편의점" });
    expect((places.data as { shared: { sceneKit?: unknown } }).shared.sceneKit).toBeUndefined();
  });
});
