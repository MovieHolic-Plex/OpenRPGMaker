// 타일셋 아틀라스 저작 파사드(src/editor/tools/tilesetAtlasTools.ts) 계약.
// 2026-08-27 커버리지 감사: 타일셋 자체 생성/속성/오토타일 그룹/애니메이션 스트립/그래프트는
// 에디터 UI 만 쓸 수 있었다. 각 툴이 어느 Project 필드를 쓰는지와 거부 메시지가
// "모델이 다음 호출에 쓸 수 있는 값"을 담는지를 여기서 못박는다.
import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";

const ATLAS_ID = "ts_atlas_test";

function context(): ToolContext {
  return { project: createEmptyToolProject("타일셋 아틀라스") };
}

// 8열 × 4행 = 32칸 커스텀 아틀라스. 모든 툴의 타일 id 범위는 0~31 이다.
function withAtlas(): ToolContext {
  const ctx = context();
  const created = runTool(ctx, "create_tileset", {
    id: ATLAS_ID,
    name: "시험 아틀라스",
    image: { type: "bundled", id: "tex_easyrpg_chipset_interior" },
    kind: "custom",
    tileSize: 16,
    tilesPerRow: 8,
    count: 32,
  }, { dryRun: false });
  expect(created.ok, JSON.stringify(created.issues)).toBe(true);
  return ctx;
}

describe("create_tileset — project.tilesets 슬롯 생성", () => {
  it("새 타일셋을 슬롯 배열까지 채워 만들고 set_tile_metadata 로 바로 쓸 수 있다", () => {
    const ctx = withAtlas();
    const tileset = ctx.project.tilesets[ATLAS_ID];
    expect(tileset).toBeDefined();
    expect(tileset.name).toBe("시험 아틀라스");
    expect(tileset.image).toEqual({ type: "bundled", id: "tex_easyrpg_chipset_interior" });
    expect(tileset.kind).toBe("custom");
    expect(tileset.tileSize).toBe(16);
    expect(tileset.tilesPerRow).toBe(8);
    expect(tileset.count).toBe(32);
    expect(tileset.passability).toHaveLength(32);
    expect(tileset.passability[31]).toEqual({ up: true, down: true, left: true, right: true });
    expect(tileset.priority).toHaveLength(32);
    expect(new Set(tileset.priority)).toEqual(new Set(["lower"]));
    expect(tileset.terrain).toHaveLength(32);
    expect(tileset.terrain.every((tag) => tag === 0)).toBe(true);

    const meta = runTool(ctx, "set_tile_metadata", {
      tilesetId: ATLAS_ID,
      entries: [{ tile: 31, label: "시험 타일" }],
    }, { dryRun: false });
    expect(meta.ok, JSON.stringify(meta.issues)).toBe(true);
    expect(ctx.project.tilesets[ATLAS_ID].tileMeta?.[31]?.label).toBe("시험 타일");
  });

  it("이미 있는 id 는 기존 id 를 알려주며 거부한다", () => {
    const ctx = withAtlas();
    const rejected = runTool(ctx, "create_tileset", {
      id: ATLAS_ID,
      name: "중복",
      image: { type: "bundled", id: "tex_easyrpg_chipset_interior" },
    }, { dryRun: false });
    expect(rejected.ok).toBe(false);
    expect(rejected.issues?.[0]?.message).toContain(ATLAS_ID);
  });

  it("알 수 없는 bundled 이미지는 쓸 수 있는 이미지 id 를 나열하며 거부한다", () => {
    const ctx = context();
    const rejected = runTool(ctx, "create_tileset", {
      name: "없는 그림",
      image: { type: "bundled", id: "tex_does_not_exist" },
    }, { dryRun: false });
    expect(rejected.ok).toBe(false);
    const message = rejected.issues?.[0]?.message ?? "";
    expect(message).toContain("tex_does_not_exist");
    expect(message).toContain("tex_easyrpg_chipset_interior");
  });
});

describe("set_tileset_properties — 이름/그림/기하/투명색 패치", () => {
  it("이름·kind·tilesPerRow·투명색을 패치하고 명시적으로 투명색을 지운다", () => {
    const ctx = withAtlas();
    const patched = runTool(ctx, "set_tileset_properties", {
      tilesetId: ATLAS_ID,
      name: "고친 아틀라스",
      kind: "rpg2k",
      tilesPerRow: 16,
      transparentColor: "#FF00FF",
    }, { dryRun: false });
    expect(patched.ok, JSON.stringify(patched.issues)).toBe(true);
    const tileset = ctx.project.tilesets[ATLAS_ID];
    expect(tileset.name).toBe("고친 아틀라스");
    expect(tileset.kind).toBe("rpg2k");
    expect(tileset.tilesPerRow).toBe(16);
    expect(tileset.transparentColor).toBe("#ff00ff");

    const cleared = runTool(ctx, "set_tileset_properties", {
      tilesetId: ATLAS_ID,
      clearTransparentColor: true,
    }, { dryRun: false });
    expect(cleared.ok, JSON.stringify(cleared.issues)).toBe(true);
    expect("transparentColor" in ctx.project.tilesets[ATLAS_ID]).toBe(false);
  });

  it("count 를 늘리면 슬롯 배열이 함께 늘어난다", () => {
    const ctx = withAtlas();
    const grown = runTool(ctx, "set_tileset_properties", { tilesetId: ATLAS_ID, count: 48 }, { dryRun: false });
    expect(grown.ok, JSON.stringify(grown.issues)).toBe(true);
    const tileset = ctx.project.tilesets[ATLAS_ID];
    expect(tileset.count).toBe(48);
    expect(tileset.passability).toHaveLength(48);
    expect(tileset.priority).toHaveLength(48);
    expect(tileset.terrain).toHaveLength(48);
  });

  it("저작된 타일 메타가 잘릴 count 축소는 충돌 타일을 이름 짓고 거부한다", () => {
    const ctx = withAtlas();
    const meta = runTool(ctx, "set_tile_metadata", {
      tilesetId: ATLAS_ID,
      entries: [{ tile: 30, label: "지킬 타일" }],
    }, { dryRun: false });
    expect(meta.ok, JSON.stringify(meta.issues)).toBe(true);

    const rejected = runTool(ctx, "set_tileset_properties", { tilesetId: ATLAS_ID, count: 16 }, { dryRun: false });
    expect(rejected.ok).toBe(false);
    expect(rejected.issues?.[0]?.message).toContain("30");
    expect(ctx.project.tilesets[ATLAS_ID].count).toBe(32);
  });

  it("빈 슬롯만 잘리는 축소는 경고와 함께 통과한다", () => {
    const ctx = withAtlas();
    const shrunk = runTool(ctx, "set_tileset_properties", { tilesetId: ATLAS_ID, count: 16 }, { dryRun: false });
    expect(shrunk.ok, JSON.stringify(shrunk.issues)).toBe(true);
    expect(ctx.project.tilesets[ATLAS_ID].count).toBe(16);
    expect(ctx.project.tilesets[ATLAS_ID].passability).toHaveLength(16);
    // 쓰기 툴의 비차단 경고는 러너가 diff.warnings 로 실어 보낸다(toolRunner.ts).
    expect(shrunk.diff?.warnings.some((warning) => warning.includes("16"))).toBe(true);
  });

  it("없는 타일셋은 쓸 수 있는 타일셋 id 를 나열하며 거부한다", () => {
    const ctx = withAtlas();
    const rejected = runTool(ctx, "set_tileset_properties", { tilesetId: "ts_nope", name: "x" }, { dryRun: false });
    expect(rejected.ok).toBe(false);
    const message = rejected.issues?.[0]?.message ?? "";
    expect(message).toContain("ts_nope");
    expect(message).toContain(ATLAS_ID);
  });
});

describe("upsert_autotile_group / delete_autotile_group — tilesets[*].autotileGroups", () => {
  it("오토타일 그룹의 모든 필드를 쓰고 같은 id 로 갱신한다", () => {
    const ctx = withAtlas();
    const created = runTool(ctx, "upsert_autotile_group", {
      tilesetId: ATLAS_ID,
      group: {
        id: "auto_path",
        name: "흙길",
        neighborhood: 8,
        memberTileIds: [8, 9, 10],
        connectTileIds: [8, 9, 10, 11],
        triggerTileIds: [8],
        variantMap: { "0": 8, "15": 9, "255": 10 },
      },
    }, { dryRun: false });
    expect(created.ok, JSON.stringify(created.issues)).toBe(true);
    const group = ctx.project.tilesets[ATLAS_ID].autotileGroups?.[0];
    expect(group).toEqual({
      id: "auto_path",
      name: "흙길",
      neighborhood: 8,
      memberTileIds: [8, 9, 10],
      connectTileIds: [8, 9, 10, 11],
      triggerTileIds: [8],
      variantMap: { "0": 8, "15": 9, "255": 10 },
    });

    const updated = runTool(ctx, "upsert_autotile_group", {
      tilesetId: ATLAS_ID,
      group: { id: "auto_path", name: "흙길 v2", neighborhood: 4, memberTileIds: [8], variantMap: { "0": 8 } },
    }, { dryRun: false });
    expect(updated.ok, JSON.stringify(updated.issues)).toBe(true);
    const groups = ctx.project.tilesets[ATLAS_ID].autotileGroups ?? [];
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("흙길 v2");
    expect(groups[0].neighborhood).toBe(4);
    expect(groups[0].connectTileIds).toBeUndefined();
  });

  it("범위 밖 memberTileIds 는 유효 범위를 알려주며 거부한다", () => {
    const ctx = withAtlas();
    const rejected = runTool(ctx, "upsert_autotile_group", {
      tilesetId: ATLAS_ID,
      group: { name: "밖", memberTileIds: [99], variantMap: {} },
    }, { dryRun: false });
    expect(rejected.ok).toBe(false);
    const message = rejected.issues?.[0]?.message ?? "";
    expect(message).toContain("99");
    expect(message).toContain("0~31");
  });

  it("variantMap 값도 범위 검증하고 유효 범위를 알려준다", () => {
    const ctx = withAtlas();
    const rejected = runTool(ctx, "upsert_autotile_group", {
      tilesetId: ATLAS_ID,
      group: { name: "밖", memberTileIds: [1], variantMap: { "0": 77 } },
    }, { dryRun: false });
    expect(rejected.ok).toBe(false);
    expect(rejected.issues?.[0]?.message ?? "").toContain("0~31");
  });

  it("그룹을 삭제하고, 없는 그룹은 남은 그룹 id 를 나열하며 거부한다", () => {
    const ctx = withAtlas();
    const created = runTool(ctx, "upsert_autotile_group", {
      tilesetId: ATLAS_ID,
      group: { id: "auto_sand", name: "모래", memberTileIds: [2], variantMap: { "0": 2 } },
    }, { dryRun: false });
    expect(created.ok, JSON.stringify(created.issues)).toBe(true);

    const rejected = runTool(ctx, "delete_autotile_group", { tilesetId: ATLAS_ID, groupId: "auto_none" }, { dryRun: false });
    expect(rejected.ok).toBe(false);
    const message = rejected.issues?.[0]?.message ?? "";
    expect(message).toContain("auto_none");
    expect(message).toContain("auto_sand");

    const deleted = runTool(ctx, "delete_autotile_group", { tilesetId: ATLAS_ID, groupId: "auto_sand" }, { dryRun: false });
    expect(deleted.ok, JSON.stringify(deleted.issues)).toBe(true);
    expect(ctx.project.tilesets[ATLAS_ID].autotileGroups ?? []).toHaveLength(0);
  });
});

describe("set_animation_strips — tilesets[*].animationStrips", () => {
  it("스트립 목록을 그대로 쓰고 기본 replace 로 갈아친다", () => {
    const ctx = withAtlas();
    const first = runTool(ctx, "set_animation_strips", {
      tilesetId: ATLAS_ID,
      strips: [{ baseTile: 0, frames: 3, fps: 4 }, { baseTile: 8, frames: 2, fps: 2 }],
    }, { dryRun: false });
    expect(first.ok, JSON.stringify(first.issues)).toBe(true);
    expect(ctx.project.tilesets[ATLAS_ID].animationStrips).toEqual([
      { baseTile: 0, frames: 3, fps: 4 },
      { baseTile: 8, frames: 2, fps: 2 },
    ]);

    const replaced = runTool(ctx, "set_animation_strips", {
      tilesetId: ATLAS_ID,
      strips: [{ baseTile: 16, frames: 4, fps: 6 }],
    }, { dryRun: false });
    expect(replaced.ok, JSON.stringify(replaced.issues)).toBe(true);
    expect(ctx.project.tilesets[ATLAS_ID].animationStrips).toEqual([{ baseTile: 16, frames: 4, fps: 6 }]);

    const cleared = runTool(ctx, "set_animation_strips", { tilesetId: ATLAS_ID, strips: [] }, { dryRun: false });
    expect(cleared.ok, JSON.stringify(cleared.issues)).toBe(true);
    expect(ctx.project.tilesets[ATLAS_ID].animationStrips).toBeUndefined();
  });

  it("append 는 기존 스트립을 baseTile 기준으로 합친다", () => {
    const ctx = withAtlas();
    runTool(ctx, "set_animation_strips", { tilesetId: ATLAS_ID, strips: [{ baseTile: 0, frames: 3, fps: 4 }] }, { dryRun: false });
    const appended = runTool(ctx, "set_animation_strips", {
      tilesetId: ATLAS_ID,
      mode: "append",
      strips: [{ baseTile: 0, frames: 2, fps: 8 }, { baseTile: 24, frames: 2, fps: 3 }],
    }, { dryRun: false });
    expect(appended.ok, JSON.stringify(appended.issues)).toBe(true);
    expect(ctx.project.tilesets[ATLAS_ID].animationStrips).toEqual([
      { baseTile: 0, frames: 2, fps: 8 },
      { baseTile: 24, frames: 2, fps: 3 },
    ]);
  });

  it("행을 넘는 프레임은 그 행에서 쓸 수 있는 범위를 알려주며 거부한다", () => {
    const ctx = withAtlas();
    const rejected = runTool(ctx, "set_animation_strips", {
      tilesetId: ATLAS_ID,
      strips: [{ baseTile: 7, frames: 3, fps: 4 }],
    }, { dryRun: false });
    expect(rejected.ok).toBe(false);
    const message = rejected.issues?.[0]?.message ?? "";
    expect(message).toContain("7");
    expect(message).toContain("0~31");
    expect(ctx.project.tilesets[ATLAS_ID].animationStrips).toBeUndefined();
  });

  it("범위 밖 baseTile 은 유효 범위를 알려주며 거부한다", () => {
    const ctx = withAtlas();
    const rejected = runTool(ctx, "set_animation_strips", {
      tilesetId: ATLAS_ID,
      strips: [{ baseTile: 40, frames: 2, fps: 4 }],
    }, { dryRun: false });
    expect(rejected.ok).toBe(false);
    expect(rejected.issues?.[0]?.message ?? "").toContain("0~31");
  });
});

describe("set_tile_grafts — tilesets[*].tileGrafts", () => {
  it("이식을 등록하고 targetTile 로 제거한다", () => {
    const ctx = withAtlas();
    const added = runTool(ctx, "set_tile_grafts", {
      tilesetId: ATLAS_ID,
      grafts: [
        { targetTile: 4, sourceChipset: "tex_easyrpg_chipset_retro_house", sourceTile: 100 },
        { targetTile: 5, sourceChipset: "tex_easyrpg_chipset_retro_house", sourceTile: 101 },
      ],
    }, { dryRun: false });
    expect(added.ok, JSON.stringify(added.issues)).toBe(true);
    expect(ctx.project.tilesets[ATLAS_ID].tileGrafts).toEqual([
      { targetTile: 4, sourceChipset: "tex_easyrpg_chipset_retro_house", sourceTile: 100 },
      { targetTile: 5, sourceChipset: "tex_easyrpg_chipset_retro_house", sourceTile: 101 },
    ]);

    const removed = runTool(ctx, "set_tile_grafts", { tilesetId: ATLAS_ID, remove: [4] }, { dryRun: false });
    expect(removed.ok, JSON.stringify(removed.issues)).toBe(true);
    expect(ctx.project.tilesets[ATLAS_ID].tileGrafts).toEqual([
      { targetTile: 5, sourceChipset: "tex_easyrpg_chipset_retro_house", sourceTile: 101 },
    ]);
  });

  it("알 수 없는 sourceChipset 은 쓸 수 있는 소스를 나열하며 거부한다", () => {
    const ctx = withAtlas();
    const rejected = runTool(ctx, "set_tile_grafts", {
      tilesetId: ATLAS_ID,
      grafts: [{ targetTile: 1, sourceChipset: "chipset_없음", sourceTile: 3 }],
    }, { dryRun: false });
    expect(rejected.ok).toBe(false);
    const message = rejected.issues?.[0]?.message ?? "";
    expect(message).toContain("chipset_없음");
    expect(message).toContain("tex_easyrpg_chipset_interior");
    expect(ctx.project.tilesets[ATLAS_ID].tileGrafts).toBeUndefined();
  });

  it("범위 밖 targetTile 은 유효 범위를 알려주며 거부한다", () => {
    const ctx = withAtlas();
    const rejected = runTool(ctx, "set_tile_grafts", {
      tilesetId: ATLAS_ID,
      grafts: [{ targetTile: 64, sourceChipset: "tex_easyrpg_chipset_retro_house", sourceTile: 3 }],
    }, { dryRun: false });
    expect(rejected.ok).toBe(false);
    expect(rejected.issues?.[0]?.message ?? "").toContain("0~31");
  });
});
