import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import type Phaser from "phaser";
import { createSharedAnimatedTile } from "@/editor/sharedTileAnimation";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadSharedTileReferences, type SharedTileReferenceSnapshot } from "@/project/sharedTileReferences";
import { sharedTileReferencesMiddleware, encodedSharedTileReferences, readSharedTileReferences } from "../scripts/lib/sharedTileReferencesSqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishSharedContent, readSharedContent, readSharedContentPreview, readSharedReferenceImage } from "../scripts/lib/sharedContentSqlite";
import { isSharedReferenceImage } from "@/project/bundledReferenceImagePath";
import type { SharedContentLibrary } from "@/project/sharedContentSchema";
import { isolateTimers } from "./mergedTeardown";

describe("sharedTileAnimation", () => {
  isolateTimers();
  class Tile extends EventEmitter {
    texture: { key: string };
    frame: { name: string };
    visible = true;
    active = true;
    destroyed = false;
    animation = "";
    constructor(readonly x: number, readonly y: number, texture: string, frame: string) {
      super();
      this.texture = { key: texture };
      this.frame = { name: frame };
    }
    setVisible(value: boolean) { this.visible = value; return this; }
    setTexture(texture: string, frame: string) {
      this.texture = { key: texture };
      this.frame = { name: frame };
      return this;
    }
    play(animation: string) { this.animation = animation; return this; }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.emit("destroy");
      this.removeAllListeners();
    }
  }
  function fixture() {
    const drivers: Tile[] = [];
    const scene = { add: {
      sprite: (x: number, y: number, texture: string, frame: string) => {
        const tile = new Tile(x, y, texture, frame);
        drivers.push(tile);
        return tile;
      },
      image: (x: number, y: number, texture: string, frame: string) => new Tile(x, y, texture, frame),
    } } as unknown as Phaser.Scene;
    const create = (animation = "water", texture = "atlas") =>
      createSharedAnimatedTile(scene, 8, 16, texture, "first", animation) as unknown as Tile;
    return { drivers, create };
  }
  describe("shared editor tile animations", () => {
    it("shares a clock, synchronizes newly added tiles, and releases it after the last tile", () => {
      const { drivers, create } = fixture();
      const images = Array.from({ length: 1000 }, () => create());
      expect(drivers).toHaveLength(1);
      const driver = drivers[0]!;
      expect(driver.visible).toBe(false);
      expect(images[0]).toMatchObject({ x: 8, y: 16, visible: true });
      driver.setTexture("atlas", "next");
      driver.emit("animationupdate");
      expect(images.every(image => image.frame.name === "next")).toBe(true);
      const added = create();
      expect(added.frame.name).toBe("next");
      for (const image of images) image.destroy();
      expect(driver.destroyed).toBe(false);
      added.destroy();
      expect(driver.destroyed).toBe(true);
      create();
      expect(drivers).toHaveLength(2);
    });

    it("isolates different strips and scenes, and tolerates driver-first scene shutdown", () => {
      const first = fixture();
      const second = fixture();
      const a = first.create();
      const b = first.create("uploaded-water", "uploaded-atlas");
      const c = second.create();
      first.drivers[0]!.destroy();
      a.destroy();
      expect(first.drivers[1]!.destroyed).toBe(false);
      expect(second.drivers[0]!.destroyed).toBe(false);
      b.destroy();
      c.destroy();
      expect(first.drivers[1]!.destroyed).toBe(true);
      expect(second.drivers[0]!.destroyed).toBe(true);
    });
  });
});

describe("sharedTileReferencesMiddleware", () => {
  isolateTimers();
  const MISSING = "/tmp/oprn-shared-tile-references-missing.sqlite";
  function respond(url: string, headers: Record<string, string> = {}) {
    const chunks: Buffer[] = [];
    let status = 0;
    let responseHeaders: Record<string, unknown> = {};
    const req = { url, method: "GET", headers } as IncomingMessage;
    const res = {
      writeHead(code: number, nextHeaders?: Record<string, unknown>) {
        status = code;
        responseHeaders = nextHeaders ?? {};
        return res;
      },
      end(body?: Buffer | string) {
        if (body) chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(body));
      },
    } as unknown as ServerResponse;
    return { req, res, done: () => ({ status, headers: responseHeaders, body: Buffer.concat(chunks).toString("utf8") }) };
  }
  describe("shared tile reference fetch", () => {
    const previous = process.env.OPRN_SHARED_CONTENT_SQLITE;

    afterEach(() => {
      if (previous === undefined) delete process.env.OPRN_SHARED_CONTENT_SQLITE;
      else process.env.OPRN_SHARED_CONTENT_SQLITE = previous;
    });

    it("returns JSON instead of the SPA html fallback when the catalog file is absent", () => {
      process.env.OPRN_SHARED_CONTENT_SQLITE = MISSING;
      const call = respond("/__oprn/shared-tile-references", { "accept-encoding": "identity" });
      let forwarded = false;
      sharedTileReferencesMiddleware(call.req, call.res, () => { forwarded = true; });
      const result = call.done();
      expect(forwarded).toBe(false);
      expect(result.status).toBe(200);
      expect(String(result.headers["content-type"])).toContain("application/json");
      expect(JSON.parse(result.body)).toEqual({ revision: "", entries: [] });
    });

    it("rejects an html body before parsing it as tile references", async () => {
      const previousWindow = (globalThis as { window?: unknown }).window;
      const previousFetch = globalThis.fetch;
      (globalThis as { window?: unknown }).window = {};
      globalThis.fetch = vi.fn(async () => new Response("<!doctype html><html></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      })) as typeof fetch;
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      try {
        expect(await loadSharedTileReferences()).toBe(false);
        expect(warn.mock.calls.some((call) => String(call[0]).includes("공용 타일 참고문서"))).toBe(true);
      } finally {
        (globalThis as { window?: unknown }).window = previousWindow;
        globalThis.fetch = previousFetch;
        warn.mockRestore();
      }
    });
  });
});

describe("sharedTileReferencesSqlite", () => {
  isolateTimers();
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
});
