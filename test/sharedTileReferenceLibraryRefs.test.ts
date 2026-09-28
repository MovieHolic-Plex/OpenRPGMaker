import "fake-indexeddb/auto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { publishSharedContent, readSharedContentForEditor } from "../scripts/lib/sharedContentSqlite";
import { encodedSharedTileReferences, readSharedTileReferences } from "../scripts/lib/sharedTileReferencesSqlite";
import type { SharedContentLibrary } from "@/project/sharedContentSchema";
import type { Project } from "@/project/types";

// 편집기는 공용 타일 참고문서 응답의 라이브러리 표식을 이미 설치한 카탈로그로 채운다.
// 채운 결과는 표식 없이 보낸 예전 응답(작업자 경로)과 같아야 한다.

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function library(): SharedContentLibrary {
  const reference = [{ id: "study", name: "study", description: "", documents: [{ id: "d", name: "d", markdown: "# 방" }], images: [] }];
  const tileset = {
    id: "shared_room", name: "room", kind: "custom", tileSize: 16, tilesPerRow: 1, count: 1,
    image: { type: "uploaded", id: "shared_room_image" }, passability: [{ up: true, down: true, left: true, right: true }], priority: ["lower"], terrain: [0],
    referenceDocuments: reference, structureKits: [{ id: "shared_kit", referenceDocuments: structuredClone(reference) }, { id: "own_kit" }],
  };
  const map = { id: "shared_region", name: "r", width: 1, height: 1, tilesetId: "shared_room", lowerTiles: [0], upperTiles: [-1], events: [] };
  const region = { id: "shared_region", name: "r", kind: "completed-map", regionKind: "settlement", revision: 1, width: 1, height: 1, tilesetId: "shared_room",
    preview: PIXEL, sourceProjectId: "p", sourceMapId: "m", snapshotProjectId: "s", rules: [], limitations: "" };
  return {
    version: 1, roots: [], places: {}, sourceProjectId: "test", previews: {},
    tilesets: { shared_room: tileset } as unknown as SharedContentLibrary["tilesets"],
    assets: { shared_room_image: { id: "shared_room_image", name: "room", kind: "tileset", dataUrl: PIXEL, meta: {} } } as unknown as SharedContentLibrary["assets"],
    maps: { shared_region: map } as unknown as SharedContentLibrary["maps"],
    regions: { shared_region: region } as unknown as SharedContentLibrary["regions"],
  };
}

let directory: string;
let file: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "oprn-tile-ref-wire-"));
  file = join(directory, "shared-content.sqlite");
  publishSharedContent("catalog", library(), null, file);
});
afterEach(() => { vi.unstubAllGlobals(); rmSync(directory, { recursive: true, force: true }); });

// 카탈로그·참고문서는 모듈 상태다 — 시험마다 새로 읽는다.
async function modules() {
  vi.resetModules();
  const content = await import("@/project/sharedContent");
  const references = await import("@/project/sharedTileReferences");
  const spatial = await import("@/project/sharedSpatialReferences");
  return { ...content, ...references, ...spatial };
}

function serveTileReferences(): void {
  const body = gunzipSync(encodedSharedTileReferences(file));
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200, headers: { etag: '"t"' } })));
}

it("fills library references from the installed catalog so entries match the full worker response", async () => {
  const { installSharedContent, loadSharedTileReferences, applySharedTileReferenceEntries, sharedRegionSnapshot } = await modules();
  await installSharedContent(readSharedContentForEditor("all", file));
  serveTileReferences();
  expect(await loadSharedTileReferences()).toBe(true);
  const full = readSharedTileReferences(file, { linkImages: true });
  const project = {
    tilesets: { shared_room: { ...structuredClone(library().tilesets.shared_room!), referenceDocuments: [], structureKits: [] } },
    assets: { uploaded: { shared_room_image: structuredClone(library().assets.shared_room_image!) } },
  } as unknown as Project;
  expect(applySharedTileReferenceEntries(project)).toBe(true);
  expect(project.tilesets.shared_room!.referenceDocuments).toEqual(full.entries[0]!.documents);
  expect(project.tilesets.shared_room!.structureKits).toEqual(full.entries[0]!.kits);
  // 프로젝트에 들어간 문서는 카탈로그 객체가 아닌 사본이다.
  expect(project.tilesets.shared_room!.referenceDocuments).not.toBe(full.entries[0]!.documents);
  const region = sharedRegionSnapshot("shared_region");
  expect(region?.tileset).toEqual(full.spatial!.tilesets.shared_room);
});

it("waits for the rest of the catalog before filling references", async () => {
  // 부팅은 기본 범위만 설치한다. 표식이 가리키는 라이브러리는 편집기가 뜬 뒤 도착한다.
  const { installSharedContent, loadSharedTileReferences, sharedRegionSnapshot } = await modules();
  serveTileReferences();
  let settled = false;
  const loading = loadSharedTileReferences().then(value => { settled = true; return value; });
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(settled).toBe(false);
  await installSharedContent(readSharedContentForEditor("all", file));
  expect(await loading).toBe(true);
  expect(sharedRegionSnapshot("shared_region")?.map.id).toBe("shared_region");
});
