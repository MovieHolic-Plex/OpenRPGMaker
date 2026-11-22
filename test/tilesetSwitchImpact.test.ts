// 지형 리뷰 F2: 칩셋을 바꾸면 범위 밖 칸이 말없이 빈 칸이 됐다. 확인 창이 그 칸 수와 크기 변화를 센다.
import { describe, expect, it } from "vitest";
import { tilesetSwitchImpact, tilesetSwitchMessage, tilesetSwitchNeedsConfirm } from "@/editor/tilesetSwitchImpact";
import { createBlankProject } from "@/project/defaults";

describe("칩셋 교체 영향", () => {
  it("범위 밖 칸과 칸 크기 변화를 세고 확인을 요구한다", () => {
    const project = createBlankProject();
    const map = structuredClone(project.maps[project.startMapId]!);
    const current = project.tilesets[map.tilesetId]!;
    map.lowerTiles.fill(-1);
    map.upperTiles.fill(-1);
    map.lowerTiles[0] = 3;
    map.lowerTiles[1] = 50;
    map.upperTiles[2] = 70;

    const small = { ...current, id: "small", count: 40 };
    const impact = tilesetSwitchImpact(map, current, small);
    expect(impact.paintedCells).toBe(3);
    expect(impact.outOfRangeCells).toBe(2);
    expect(impact.sizeChanged).toBe(false);
    expect(tilesetSwitchNeedsConfirm(impact)).toBe(true);
    expect(tilesetSwitchMessage(impact, "작은 칩셋")).toContain("3칸 중 2칸");

    const bigger = { ...current, id: "big", count: 1000, tileSize: current.tileSize * 2 };
    const sized = tilesetSwitchImpact(map, current, bigger);
    expect(sized.outOfRangeCells).toBe(0);
    expect(sized.sizeChanged).toBe(true);
    expect(tilesetSwitchNeedsConfirm(sized)).toBe(true);

    const same = tilesetSwitchImpact(map, current, { ...current, id: "same", count: 1000 });
    expect(tilesetSwitchNeedsConfirm(same)).toBe(false);
  });
});
