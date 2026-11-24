import { beforeAll, describe, expect, it } from "vitest";
import { buildStampObjectIndex } from "@/ai/stampObjects";
import { propsForTileset } from "@/editor/propRecommendations";
import { albumEntries, albumEntryId } from "@/editor/panels/structureKitDbSources";
import { createBlankProject } from "@/project/defaults/blankProject";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { isRetiredObject, retiredObjectIds } from "@/project/retiredObjects";
import type { TilesetDef } from "@/project/types";

function bundledTilesets(): Record<string, TilesetDef> {
  const project = createBlankProject();
  ensureBundledTilesets(project);
  return project.tilesets;
}

describe("retired objects", () => {
  let tilesets: Record<string, TilesetDef>;
  beforeAll(() => { tilesets = bundledTilesets(); });

  it("names only objects that still exist in their bundled tileset", () => {
    const stale: string[] = [];
    for (const [tilesetId, ids] of retiredObjectIds()) {
      const kits = new Set((tilesets[tilesetId]?.structureKits ?? []).map((kit) => kit.id));
      for (const id of ids) if (!kits.has(id)) stale.push(`${tilesetId}:${id}`);
    }
    expect(stale).toEqual([]);
  });

  it("drops a retired kit from the object search, album and assistant dictionary but keeps its definition", () => {
    const gyms = tilesets["monster_gyms"]!;
    const leaderMat = "mk-monster-gyms-g_leader_mat";
    expect(isRetiredObject(gyms.id, leaderMat)).toBe(true);
    expect(gyms.structureKits?.some((kit) => kit.id === leaderMat)).toBe(true);
    expect(propsForTileset(gyms).map((choice) => choice.id)).not.toContain(leaderMat);
    expect(albumEntries(gyms).map(albumEntryId)).not.toContain(leaderMat);
    expect(buildStampObjectIndex(gyms).map((entry) => entry.id)).not.toContain(leaderMat);
    expect(propsForTileset(gyms).map((choice) => choice.id)).toContain("mk-monster-gyms-g_bigrock");

    const unlisted: TilesetDef = { ...gyms, id: "unlisted_copy_of_monster_gyms" };
    expect(propsForTileset(unlisted).map((choice) => choice.id)).toContain(leaderMat);
    expect(albumEntries(unlisted).map(albumEntryId)).toContain(leaderMat);
    expect(buildStampObjectIndex(unlisted).map((entry) => entry.id)).toContain(leaderMat);
  });

  it("does not retire the same id in a tileset that is not listed", () => {
    expect(isRetiredObject("monster_climate", "mk-monster-gyms-g_leader_mat")).toBe(false);
    expect(isRetiredObject(undefined, "mk-monster-gyms-g_leader_mat")).toBe(false);
  });
});
