import { mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encodedSharedContent, publishSharedContent, readSharedContent, readSharedContentForEditor, readSharedContentPreview, readSharedReferenceImage } from "../scripts/lib/sharedContentSqlite";
import { isSharedReferenceImage } from "@/project/bundledReferenceImagePath";
import { validateTilesetReferences } from "@/project/tilesetReferences";
import type { SharedContentLibrary } from "@/project/sharedContentSchema";

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const hashLibrary = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function library(projectDefaults: boolean): SharedContentLibrary {
  const reference = [{ id: "study", name: "study", description: "", documents: [], images: [{ id: "a", name: "a", caption: "", dataUrl: PIXEL }] }];
  const tileset = { id: "shared_room", referenceDocuments: reference, structureKits: [{ id: "kit", referenceDocuments: structuredClone(reference) }] };
  return { version: 1, ...(projectDefaults ? { projectDefaults: true } : {}), roots: [], places: {}, tilesets: { shared_room: tileset } as unknown as SharedContentLibrary["tilesets"], assets: {}, maps: {}, sourceProjectId: "test", previews: { shared_room: PIXEL } };
}

let directory: string;
let file: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "oprn-shared-content-"));
  file = join(directory, "shared-content.sqlite");
  publishSharedContent("catalog", library(false), null, file);
  publishSharedContent("defaults", library(true), null, file);
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe("editor shared-content snapshot", () => {
  it("serves only projectDefaults libraries for the boot scope, with the full-catalog revision", () => {
    const boot = readSharedContentForEditor("defaults", file);
    expect(Object.keys(boot.libraries)).toEqual(["defaults"]);
    expect(boot.revision).toBe(readSharedContentForEditor("all", file).revision);
    expect(boot.revision).toBe(readSharedContent(file).revision);
  });

  it("replaces inline previews with an address that returns the same bytes", () => {
    const url = readSharedContentForEditor("all", file).libraries.catalog!.previews.shared_room!;
    expect(url.startsWith("data:")).toBe(false);
    const params = new URL(url, "http://host").searchParams;
    const found = readSharedContentPreview(params.get("library")!, params.get("kind")!, params.get("id")!, file);
    expect(found?.mime).toBe("image/png");
    expect(found?.bytes.equals(Buffer.from(PIXEL.slice(PIXEL.indexOf(",") + 1), "base64"))).toBe(true);
  });

  it("keeps the publishing reader byte-exact and rejects unknown preview requests", () => {
    expect(readSharedContent(file).libraries.catalog!.previews.shared_room).toBe(PIXEL);
    expect(readSharedContent(file).libraries.defaults!.tilesets.shared_room!.referenceDocuments![0]!.images[0]!.dataUrl).toBe(PIXEL);
    expect(readSharedContentPreview("catalog", "place", "missing", file)).toBeNull();
    expect(readSharedContentPreview("catalog", "tileset", "shared_room", file)).toBeNull();
  });
});

describe("shared tileset reference images", () => {
  it("replaces inline tileset and kit reference images with one address that serves the same bytes", () => {
    const tileset = readSharedContentForEditor("defaults", file).libraries.defaults!.tilesets.shared_room!;
    const address = tileset.referenceDocuments![0]!.images[0]!.dataUrl;
    expect(isSharedReferenceImage(address)).toBe(true);
    expect(tileset.structureKits![0]!.referenceDocuments![0]!.images[0]!.dataUrl).toBe(address);
    expect(() => validateTilesetReferences(tileset.referenceDocuments)).not.toThrow();
    const found = readSharedReferenceImage(address, file);
    expect(found?.mime).toBe("image/png");
    expect(found?.bytes.equals(Buffer.from(PIXEL.slice(PIXEL.indexOf(",") + 1), "base64"))).toBe(true);
  });

  it("serves an address from a library outside the requested scope and rejects unknown or malformed ones", () => {
    const address = readSharedContentForEditor("all", file).libraries.catalog!.tilesets.shared_room!.referenceDocuments![0]!.images[0]!.dataUrl;
    expect(readSharedReferenceImage(address, file)).not.toBeNull();
    expect(readSharedReferenceImage(address.replace(/-\d+\.png$/, "-1.png"), file)).toBeNull();
    expect(readSharedReferenceImage("/__oprn/shared-content/image/../x.png", file)).toBeNull();
  });
});

describe("encoded editor response", () => {
  it("decodes to the editor snapshot and is rebuilt after a library is republished", () => {
    const first = encodedSharedContent("defaults", file);
    expect(JSON.parse(gunzipSync(first).toString())).toEqual(readSharedContentForEditor("defaults", file));
    expect(encodedSharedContent("defaults", file)).toBe(first);
    const old = readSharedContent(file).libraries.defaults!;
    publishSharedContent("defaults", { ...library(true), roots: [], sourceProjectId: "changed" }, hashLibrary(old), file);
    const second = encodedSharedContent("defaults", file);
    expect(second).not.toBe(first);
    expect(JSON.parse(gunzipSync(second).toString()).libraries.defaults.sourceProjectId).toBe("changed");
  });
});
