import { mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishSharedContent, readSharedContent, readSharedContentPreview, readSharedReferenceImage } from "../scripts/lib/sharedContentSqlite";
import { encodedSharedTileReferences, readSharedTileReferences } from "../scripts/lib/sharedTileReferencesSqlite";
import { isSharedReferenceImage } from "@/project/bundledReferenceImagePath";
import type { SharedContentLibrary } from "@/project/sharedContentSchema";
import type { SharedTileReferenceSnapshot } from "@/project/sharedTileReferences";

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const hashLibrary = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const bytes = (dataUrl: string) => Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");

function library(sourceProjectId = "test"): SharedContentLibrary {
  const reference = [{ id: "study", name: "study", description: "", documents: [], images: [{ id: "a", name: "a", caption: "", dataUrl: PIXEL }] }];
  const tileset = {
    id: "shared_room", name: "room", kind: "custom", tileSize: 16, tilesPerRow: 1, count: 1,
    image: { type: "uploaded", id: "shared_room_image" }, passability: [], priority: [], terrain: [],
    referenceDocuments: reference, structureKits: [{ id: "shared_kit", referenceDocuments: structuredClone(reference) }],
  };
  const map = { id: "shared_region", name: "r", width: 1, height: 1, tilesetId: "shared_room", lowerTiles: [0], upperTiles: [-1], events: [] };
  const region = { id: "shared_region", name: "r", kind: "completed-map", regionKind: "settlement", revision: 1, width: 1, height: 1, tilesetId: "shared_room",
    preview: PIXEL, sourceProjectId: "p", sourceMapId: "m", snapshotProjectId: "s", rules: [], limitations: "" };
  return {
    version: 1, roots: [], places: {}, sourceProjectId, previews: {},
    tilesets: { shared_room: tileset } as unknown as SharedContentLibrary["tilesets"],
    assets: { shared_room_image: { id: "shared_room_image", name: "room", kind: "tileset", dataUrl: PIXEL, meta: {} } } as unknown as SharedContentLibrary["assets"],
    maps: { shared_region: map } as unknown as SharedContentLibrary["maps"],
    regions: { shared_region: region } as unknown as SharedContentLibrary["regions"],
  };
}

let directory: string;
let file: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "oprn-shared-tile-refs-"));
  file = join(directory, "shared-content.sqlite");
  publishSharedContent("catalog", library(), null, file);
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

const decode = (gzip: Buffer) => JSON.parse(gunzipSync(gzip).toString()) as SharedTileReferenceSnapshot;

describe("editor shared tile references", () => {
  it("sends catalog-owned tilesets, sheets and documents as library references and region previews as host addresses", () => {
    const snapshot = decode(encodedSharedTileReferences(file));
    const entry = snapshot.entries.find(item => item.id === "shared_room")! as unknown as Record<string, unknown>;
    // 참고문서·구조 킷·타일셋·그림은 공용 카탈로그에 같은 글로 있다 — 라이브러리 id 만 온다.
    expect(entry.library).toBe("catalog");
    expect(entry.documents).toBeUndefined();
    expect(entry.kits).toBeUndefined();
    expect(snapshot.spatial!.tilesets.shared_room).toEqual({ $library: "catalog" });
    expect(snapshot.spatial!.assets.shared_room_image).toEqual({ $library: "catalog" });
    expect(entry.dataUrlSha256).toBe(createHash("sha256").update(PIXEL).digest("hex"));
    const preview = new URL(snapshot.spatial!.regions[0]!.preview, "http://host").searchParams;
    expect(readSharedContentPreview(preview.get("library")!, preview.get("kind")!, preview.get("id")!, file)?.bytes.equals(bytes(PIXEL))).toBe(true);
  });

  it("links reference images to host addresses that serve the same bytes", () => {
    const snapshot = readSharedTileReferences(file, { linkImages: true });
    const entry = snapshot.entries.find(item => item.id === "shared_room")!;
    const address = entry.documents[0]!.images[0]!.dataUrl;
    expect(isSharedReferenceImage(address)).toBe(true);
    expect(entry.kits![0]!.referenceDocuments![0]!.images[0]!.dataUrl).toBe(address);
    expect(readSharedReferenceImage(address, file)?.bytes.equals(bytes(PIXEL))).toBe(true);
    expect(snapshot.spatial!.assets.shared_room_image!.dataUrl).toBe(PIXEL);
  });

  it("keeps the worker reader byte-exact", () => {
    const snapshot = readSharedTileReferences(file);
    expect(snapshot.entries[0]!.documents[0]!.images[0]!.dataUrl).toBe(PIXEL);
    expect(snapshot.spatial!.regions[0]!.preview).toBe(PIXEL);
  });

  it("reuses the encoded response until a library is republished", () => {
    const first = encodedSharedTileReferences(file);
    expect(encodedSharedTileReferences(file)).toBe(first);
    publishSharedContent("catalog", library("changed"), hashLibrary(readSharedContent(file).libraries.catalog), file);
    const second = encodedSharedTileReferences(file);
    expect(second).not.toBe(first);
    expect(decode(second).revision).not.toBe(decode(first).revision);
  });
});
