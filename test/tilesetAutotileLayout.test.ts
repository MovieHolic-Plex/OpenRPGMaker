import { describe, expect, it } from "vitest";
import {
  filledRoleCount,
  groupPatchFromRoles,
  inferAutotileLayoutKind,
  layoutLabel,
  rolesFromGroup,
  tilesInLayoutBlock,
} from "@/editor/panels/tilesetAutotileLayout";
import { buildTemplateGroup } from "@/editor/panels/tilesetAutotileTemplates";
import { DEFAULT_COBBLE_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { DEFAULT_TILE_COUNT, DEFAULT_TILES_PER_ROW } from "@/project/defaults/constants";

describe("autotile layout helpers", () => {
  it("내장 포석은 11칸으로 읽힌다", () => {
    expect(inferAutotileLayoutKind(DEFAULT_COBBLE_AUTOTILE_GROUP)).toBe("cells-11");
    expect(layoutLabel("cells-11")).toBe("11칸");
    const roles = rolesFromGroup(DEFAULT_COBBLE_AUTOTILE_GROUP);
    expect(roles.body).toBeDefined();
    expect(roles.isolated).toBeDefined();
    expect(filledRoleCount("cells-11", roles).filled).toBe(11);
  });

  it("3×3 템플릿은 9칸 패치로 다시 만들 수 있다", () => {
    const built = buildTemplateGroup("grid-3x3", 33, DEFAULT_TILES_PER_ROW, DEFAULT_TILE_COUNT);
    if ("error" in built) throw new Error(built.error);
    const group = { id: "t", ...built };
    expect(inferAutotileLayoutKind(group)).toBe("cells-9");
    const roles = rolesFromGroup(group);
    const patch = groupPatchFromRoles("cells-9", roles);
    expect(patch?.memberTileIds).toEqual(built.memberTileIds);
    expect(Object.keys(patch?.variantMap ?? {})).toHaveLength(16);
  });

  it("9칸 호버 블록은 앵커에서 3×3 인덱스를 만든다", () => {
    expect(tilesInLayoutBlock("cells-9", 33, DEFAULT_TILES_PER_ROW, DEFAULT_TILE_COUNT)).toEqual([
      33, 34, 35,
      33 + DEFAULT_TILES_PER_ROW, 34 + DEFAULT_TILES_PER_ROW, 35 + DEFAULT_TILES_PER_ROW,
      33 + DEFAULT_TILES_PER_ROW * 2, 34 + DEFAULT_TILES_PER_ROW * 2, 35 + DEFAULT_TILES_PER_ROW * 2,
    ]);
  });
});
