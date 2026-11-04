// 발깔개는 2칸이라 2칸 출구에만 깐다. 1칸 출구에 깔면 한 칸이 벽 앞에 붙어 깔개 위 두 칸 중 한 칸에서만
// 나갔다(fs2 스웜 I24, 2026-11-04 서리나루 여관).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import HAND_INTERIOR_SPEC from "@/assets/handInteriorSpec.json";

const MAT = (HAND_INTERIOR_SPEC as { objects: Record<string, { cells: number[][] }> }).objects.doormat!.cells.map((c) => c[2]);
let lastWarnings: string[] = [];

function build(plan: string[], exitWidth?: number, objects?: { id: string; x: number; y: number }[]) {
  const ctx = { project: createBlankProject() };
  const parts = runTool(ctx, "list_hand_interior_parts", {}).data as { floors?: ({ id: string } | string)[]; walls?: ({ id: string } | string)[] };
  const pick = (x: { id: string } | string | undefined) => (typeof x === "string" ? x : x?.id);
  const res = runTool(ctx, "build_hand_interior_room", {
    tileset: "atlas_biome_interior", mapId: "room", name: "방", plan, floor: pick(parts.floors?.[0]), wall: pick(parts.walls?.[0]), ...(exitWidth ? { exitWidth } : {}), ...(objects ? { objects } : {}),
  });
  expect(res.ok).toBe(true);
  lastWarnings = ((res.data as { warnings?: string[] }).warnings ?? []);
  const map = ctx.project.maps.room!;
  const mats: string[] = [];
  for (const [name, layer] of [["lower", map.lowerOverlayTiles], ["upper", map.upperTiles]] as const) {
    layer?.forEach((tile, i) => { if (MAT.includes(tile)) mats.push(`${name}:${i % map.width},${Math.floor(i / map.width)}`); });
  }
  return mats;
}

describe("build_hand_interior_room 발깔개", () => {
  it("1칸 출구에는 깔지 않는다", () => {
    expect(build(["########", "#......#", "#......#", "#......#", "###.####"])).toEqual([]);
  });

  it("2칸 출구에는 틈 바로 안쪽 두 칸에 맞춰 깐다", () => {
    const mats = build(["########", "#......#", "#......#", "#......#", "###..###"], 2);
    expect(mats.map((m) => m.split(":")[1])).toEqual(["3,3", "4,3"]);
  });

  it("조수가 출구 안쪽을 벗어난 발깔개를 깔면 경고한다", () => {
    build(["########", "#......#", "#......#", "#......#", "###.####"], undefined, [{ id: "doormat", x: 3, y: 3 }]);
    expect(lastWarnings.some((w) => w.includes("2칸 출구 전용"))).toBe(true);
    build(["########", "#......#", "#......#", "#......#", "###..###"], 2, [{ id: "doormat", x: 3, y: 3 }]);
    expect(lastWarnings.some((w) => w.includes("2칸 출구 전용"))).toBe(false);
  });
});
