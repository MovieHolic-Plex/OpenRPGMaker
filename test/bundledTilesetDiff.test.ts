import { afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { bundledTilesetById, ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { deserialize, ProjectFormatError, serialize } from "@/project/io";
import { BUNDLED_TILESET_DIFF, bundledTilesetDiffForTest, setBundledTilesetDiffWriting } from "@/project/bundledTilesetDiff";
import { jsonEqual } from "@/util/structuralJson";
import type { Project, TilesetDef } from "@/project/types";

// 2026-10-27: 빈 새 프로젝트 serialize 가 6,420만 자였고 95% 가 모든 프로젝트에 복사된 번들 타일셋 정의였다.
// 저장본은 번들 정의와의 차이만 싣고 읽을 때 되돌린다. 저자 편집은 한 칸도 잃지 않아야 한다.

type Wire = { tilesets: Record<string, Record<string, unknown>> };

function blank(): Project {
  const project = createBlankProject() as Project;
  ensureBundledTilesets(project);
  return project;
}

afterEach(() => setBundledTilesetDiffWriting(true));

describe("bundled tilesets are stored as diffs against the bundle", () => {
  it("a blank project serializes small and round-trips every tileset byte for byte", () => {
    const project = blank();
    const text = serialize(project);
    const full = serialize(project, { inlineBundledTilesets: true });
    expect(text.length).toBeLessThan(full.length / 5);
    const wire = JSON.parse(text) as Wire;
    for (const tileset of Object.values(wire.tilesets)) {
      if (tileset[BUNDLED_TILESET_DIFF]) expect(tileset.tileMeta).toBeUndefined();
    }
    const reloaded = deserialize(text);
    for (const [id, tileset] of Object.entries(project.tilesets)) {
      expect(JSON.stringify(reloaded.tilesets[id])).toBe(JSON.stringify(tileset));
    }
  });

  it("keeps author edits: changed tiles, appended tiles, added kits, changed and deleted fields, key order", () => {
    const project = blank();
    const id = "jp_city";
    const source = project.tilesets[id]!;
    const edited = structuredClone(source) as TilesetDef & Record<string, unknown>;
    edited.name = "저자 이름";
    edited.tileMeta = edited.tileMeta!.map((meta, index) => (index === 7 ? { ...meta, label: "저자 칸" } : meta));
    edited.passability[3] = { up: false, down: false, left: false, right: false };
    edited.count += 2;
    for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) {
      const list = edited[key] as unknown[];
      list.push(structuredClone(list[0]), structuredClone(list[1]));
    }
    edited.structureKits = [...(edited.structureKits ?? []), { id: "author-kit", name: "내 킷" } as never];
    delete (edited as Record<string, unknown>).roomKit;
    edited.authorNote = { text: "새 필드" };
    project.tilesets[id] = edited;

    const text = serialize(project);
    const view = (JSON.parse(text) as Wire).tilesets[id]!;
    expect(view[BUNDLED_TILESET_DIFF]).toBeDefined();
    expect(JSON.stringify(view).length).toBeLessThan(JSON.stringify(edited).length / 20);
    expect(JSON.stringify(deserialize(text).tilesets[id])).toBe(JSON.stringify(edited));
  });

  it("rebases onto a different bundle version without losing author tiles", () => {
    const current = bundledTilesetById("jp_city")! as TilesetDef & Record<string, unknown>;
    // 옛 판 흉내: 칸 64개와 킷 하나가 적은 번들.
    const old = structuredClone(current);
    old.count -= 64;
    for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) (old as Record<string, unknown>)[key] = (old[key] as unknown[]).slice(0, old.count);
    old.structureKits = old.structureKits!.slice(0, -1);
    const copy = structuredClone(old);
    copy.tileMeta![5] = { ...copy.tileMeta![5]!, label: "저자 칸" };
    copy.structureKits!.push({ id: "author-kit", name: "내 킷" } as never);
    copy.count += 1;
    for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) (copy[key] as unknown[]).push(structuredClone((copy[key] as unknown[])[0]));

    const view = bundledTilesetDiffForTest.diff(copy, old)!;
    const sameVersion = bundledTilesetDiffForTest.restore("jp_city", JSON.parse(JSON.stringify(view)), structuredClone(old));
    expect(JSON.stringify(sameVersion.tileset)).toBe(JSON.stringify(copy));

    const rebased = bundledTilesetDiffForTest.restore("jp_city", JSON.parse(JSON.stringify(view)), bundledTilesetById("jp_city")!).tileset as unknown as TilesetDef;
    expect(rebased.count).toBe(copy.count);
    expect(rebased.tileMeta!.length).toBe(copy.count);
    expect(rebased.tileMeta![5]!.label).toBe("저자 칸");
    expect(jsonEqual(rebased.tileMeta![copy.count - 1], copy.tileMeta![copy.count - 1])).toBe(true);
    expect(rebased.structureKits!.some((kit) => kit.id === "author-kit")).toBe(true);
  });

  it("refuses a diff for a bundle this app does not have", () => {
    const wire = JSON.parse(serialize(blank())) as Wire;
    const [id, view] = Object.entries(wire.tilesets).find(([, tileset]) => tileset[BUNDLED_TILESET_DIFF])!;
    delete wire.tilesets[id];
    wire.tilesets["no_such_bundle"] = { ...view, id: "no_such_bundle" };
    expect(() => deserialize(JSON.stringify(wire))).toThrow(ProjectFormatError);
  });

  it("the rollback switch writes full definitions again", () => {
    setBundledTilesetDiffWriting(false);
    const wire = JSON.parse(serialize(blank())) as Wire;
    expect(Object.values(wire.tilesets).some((tileset) => tileset[BUNDLED_TILESET_DIFF])).toBe(false);
  });
});
