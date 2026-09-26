import { mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encodedSharedContent, publishSharedContent, readSharedContent, readSharedContentForEditor, readSharedContentPreview } from "../scripts/lib/sharedContentSqlite";
import type { SharedContentLibrary } from "@/project/sharedContentSchema";

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const hashLibrary = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function library(projectDefaults: boolean): SharedContentLibrary {
  return { version: 1, ...(projectDefaults ? { projectDefaults: true } : {}), roots: [], places: {}, tilesets: {}, assets: {}, maps: {}, sourceProjectId: "test", previews: { shared_room: PIXEL } };
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
    expect(readSharedContentPreview("catalog", "place", "missing", file)).toBeNull();
    expect(readSharedContentPreview("catalog", "tileset", "shared_room", file)).toBeNull();
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
