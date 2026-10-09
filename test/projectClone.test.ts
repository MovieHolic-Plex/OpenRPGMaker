import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { cloneProjectSharingReferenceDocuments } from "@/project/projectClone";
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
