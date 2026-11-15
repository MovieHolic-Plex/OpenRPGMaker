// 한 게임 안에서 건물 가족은 하나다: 새 건물(jp-bldg-f-*)이 구워져 있으면 옛 손 도트 건물(jp-bldg-*)은 정의에 남되 조수에게 권하는 목록·참고문서에서 빠진다.
// 옛 키트는 id 로 부르면 그대로 찍힌다(옛 저장본 · 열쇠 없는 옛 구성기).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { blankFillTileFor, createStarterMap } from "@/project/defaults/defaultMaps";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";

const OLD = /jp-bldg-(?!f-)[a-z0-9-]+/g;
/** 새 가족에 같은 구실이 없어 남겨 둔 옛 건물 */
const HAND_ONLY = ["school", "school-gym", "kindergarten", "gas-office", "market-hall", "factory", "warehouse", "machikoba-home"].map((s) => `jp-bldg-${s}`);

function setup() {
  const project = createBlankProject();
  project.tilesets[JP_CITY_ID] = createJpCityTileset();
  const hub = createStarterMap();
  Object.assign(hub, { id: "hub", name: "거리", tilesetId: JP_CITY_ID, width: 40, height: 30 });
  hub.lowerTiles = new Array(40 * 30).fill(blankFillTileFor(JP_CITY_ID));
  hub.upperTiles = new Array(40 * 30).fill(-1);
  project.maps.hub = hub;
  return { project, assistantRun: true, lookKey: "game-a" };
}

describe("jp_city building family", () => {
  it("keeps the old hand-drawn buildings in the definition but marks the ones the new family replaces", () => {
    const kits = createJpCityTileset().structureKits ?? [];
    const old = kits.filter((k) => k.id.startsWith("jp-bldg-") && !k.id.startsWith("jp-bldg-f-"));
    expect(old.length).toBe(77);
    expect(kits.filter((k) => k.id.startsWith("jp-bldg-f-")).length).toBeGreaterThanOrEqual(67);
    expect(old.filter((k) => !k.ai?.supersededBy).map((k) => k.id).sort()).toEqual([...HAND_ONLY].sort());
    expect(kits.filter((k) => k.id.startsWith("jp-bldg-f-")).every((k) => !k.ai?.supersededBy)).toBe(true);
  });

  it("offers the assistant only the new family in the kit lists", () => {
    const ctx = setup();
    for (const [tool, args] of [["list_structure_kits", { mapId: "hub" }], ["list_spatial_designs", { kind: "object", query: "jp-bldg" }], ["list_spatial_designs", { kind: "object", query: "라멘" }]] as const) {
      const res = runTool(ctx, tool, args, { dryRun: true });
      const ids = [...new Set(JSON.stringify((res as { data?: unknown }).data ?? null).match(/(?:kit:jp_city\/|"kitId":")(jp-bldg-[a-z0-9-]+)/g) ?? [])].map((s) => s.replace(/^.*(jp-bldg-)/, "$1"));
      for (const id of ids.filter((s) => !s.startsWith("jp-bldg-f-"))) expect(HAND_ONLY, `${tool} lists ${id}`).toContain(id);
    }
    const all = JSON.stringify((runTool(ctx, "list_structure_kits", { mapId: "hub" }, { dryRun: true }) as { data?: unknown }).data);
    expect(all).toContain("jp-bldg-f-ramen");
    expect(all).not.toContain('"kitId":"jp-bldg-shop-ramen"');
  });

  it("drops the old buildings purpose from the bundled reference documents and points the reading order at the new one", () => {
    const cats = createJpCityTileset().referenceDocuments ?? [];
    expect(cats.some((c) => c.id === "jp-buildings-f")).toBe(true);
    expect(cats.some((c) => c.id === "jp-buildings-hand")).toBe(false);
    const order = cats.find((c) => c.id === "jp-start")!.documents.find((d) => d.id === "jp-order")!.markdown;
    expect(order).toContain("jp-bldg-f-rules");
    expect(order).not.toContain("jp-bldg-hand-rules");
    // 남은 문서가 옛 건물 키트를 사전으로 싣지 않는다(예제 배치에 남은 이름은 학교·전차 예제의 것)
    const dict = cats.flatMap((c) => c.documents).filter((d) => /"kit":"jp-bldg-(?!f-)/.test(d.markdown));
    expect(dict.map((d) => d.id)).toEqual([]);
    expect(JSON.stringify(cats).match(OLD)?.length ?? 0).toBeLessThan(40);
  });

  it("still stamps an old kit when it is named by id (old saves, keyless composer)", () => {
    const ctx = setup();
    const res = runTool(ctx, "stamp_object", { objectId: "kit:jp_city/jp-bldg-shop-ramen", mapId: "hub", x: 5, y: 5 }, { dryRun: false });
    expect(res.ok, res.summary).toBe(true);
    expect(ctx.project.maps.hub!.upperTiles!.some((t) => t >= 0)).toBe(true);
  });
});
