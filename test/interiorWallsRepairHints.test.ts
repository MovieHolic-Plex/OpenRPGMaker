// 실내 칸 배치 거절 글이 고칠 것을 짚는다(2026-11-04 조수 대조 B1 Argon: 감방을 끝내 못 지었다).
//  - 쇠창살(bars)을 감방 남쪽 벽 줄 위에 그었다 → 「cell (x,8) is not floor」 8건만 받았다 → 벽을 짚어 「창살은 벽 대신 선다」고 말한다.
//  - 가로 벽 문 아래 벽면 두 줄 끝 칸에 화로를 둬 감방이 닿지 않았다 → 「문 곁을 비워라」뿐이었다 → 막는 기물을 이름으로 짚는다.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { HAND_INTERIOR_TILESET_ID, roomSpecOf } from "@/editor/handInterior/builder";
import { checkLayout } from "@/ai/v2/interiorLayout";

const fixture = (name: string) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

describe("실내 칸 배치 거절 글", () => {
  const tileset = createBlankProject().tilesets[HAND_INTERIOR_TILESET_ID]!;
  const spec = roomSpecOf(tileset)!;

  it("벽 위에 그은 쇠창살은 칸마다가 아니라 벽을 짚어 한 줄로 알린다", () => {
    const errors = checkLayout(fixture("argonCellLayoutBarsOnWall"), spec, tileset).errors;
    const rail = errors.filter((e) => e.startsWith("rail"));
    expect(rail).toHaveLength(2);
    expect(rail[0]).toContain(`lie on wall "w_cell_south"`);
    expect(rail[0]).toContain("instead of a wall");
  });

  it("닿지 않는 방은 길을 막는 기물을 이름으로 짚는다", () => {
    const L = fixture("argonCellLayoutBrazierBlocksDoor");
    const errors = checkLayout(L, spec, tileset).errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(`"brazier"@(5,11)`);
    L.objects = L.objects.filter((o: { id: string; x: number; y: number }) => !(o.id === "brazier" && o.x === 5 && o.y === 11));
    expect(checkLayout(L, spec, tileset).errors).toEqual([]);
  });
});
