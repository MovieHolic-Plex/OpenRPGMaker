import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { cloneProjectForMutation, cloneProjectSharingReferenceDocuments, finishProjectMutation } from "@/project/projectClone";
import { readTileset } from "@/project/lazyTilesetRead";
import { isPassable } from "@/project/collision";
import { store } from "@/project/store";
import { updateDatabaseRecord } from "@/editor/databaseActions";

describe("cloneProjectSharingReferenceDocuments", () => {
  it("shares reference document arrays and keeps database edits off the source", () => {
    const source = createBlankProject();
    const tiled = Object.values(source.tilesets).find((tileset) => tileset.referenceDocuments?.length);
    expect(tiled?.referenceDocuments?.length).toBeGreaterThan(0);
    const clone = cloneProjectSharingReferenceDocuments(source);
    const clonedTile = clone.tilesets[tiled!.id]!;
    expect(clonedTile.referenceDocuments).toBe(tiled!.referenceDocuments);

    clonedTile.referenceDocuments = [];
    expect(tiled!.referenceDocuments?.length).toBeGreaterThan(0);

    clone.database.skills[0]!.name = "clone-only";
    expect(source.database.skills[0]!.name).not.toBe("clone-only");
  });

  it("database updates do not rewrite the previous project's reference documents", () => {
    store.replace(createBlankProject());
    const before = store.getCurrent();
    const beforeDocs = Object.values(before.tilesets).find((tileset) => tileset.referenceDocuments)?.referenceDocuments;
    updateDatabaseRecord("skills", before.database.skills[0]!.id, { name: "parity-skill" });
    const after = store.getCurrent();
    expect(after).not.toBe(before);
    expect(after.database.skills[0]!.name).toBe("parity-skill");
    expect(before.database.skills[0]!.name).not.toBe("parity-skill");
    expect(Object.values(before.tilesets).find((tileset) => tileset.referenceDocuments)?.referenceDocuments).toBe(beforeDocs);
  });
});

describe("readTileset on a mutation draft", () => {
  it("reads an untouched tileset without cloning it, and sees the draft copy once a tool writes it", () => {
    const source = createBlankProject();
    const map = Object.values(source.maps)[0]!;
    const original = source.tilesets[map.tilesetId]!;
    const draft = cloneProjectForMutation(source);

    expect(readTileset(draft.tilesets, map.tilesetId)).toBe(original);
    isPassable(draft, draft.maps[map.id]!, 0, 0);
    // 통행 검사는 자리를 복제로 확정하지 않는다(접근자가 그대로 남는다).
    expect(Object.getOwnPropertyDescriptor(draft.tilesets, map.tilesetId)?.get).toBeTypeOf("function");
    expect(finishProjectMutation(draft)?.size).toBe(0);
    expect(draft.tilesets[map.tilesetId]).toBe(original);

    const written = cloneProjectForMutation(source);
    written.tilesets[map.tilesetId]!.name = "draft-only";
    expect(readTileset(written.tilesets, map.tilesetId)?.name).toBe("draft-only");
    expect(original.name).not.toBe("draft-only");
    expect([...finishProjectMutation(written)!]).toEqual([map.tilesetId]);
  });
});
