// store_find_music 이 음악 팩을 쪽을 넘겨 전부 보는가(16개 상한 없음), 1위에 recommended·이유를 붙이는가,
// 미술관 요청을 던전으로 읽지 않는가, set_game_audio 가 틀린 mapIds 에 실제 맵을 알려 주는가(2026-10-30 실조수 e2e 14/16).
import { afterEach, describe, expect, it } from "vitest";
import { setWorkerStoreAccess, type StoreReadAccess } from "@/assetStore/storeAccess";
import type { StoreCatalogPage, StorePackManifest } from "@/assetStore/format";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { clearStoreMusicCache, listAllStoreMusicPacks, type StoreMusicChoice } from "@/editor/tools/storeTools";
import { mapIdsError } from "@/editor/tools/musicAuthoringTools";

const sha = (n: number): string => n.toString(16).padStart(64, "0");

function manifest(n: number, music: Record<string, unknown>): StorePackManifest {
  return {
    schema: "oprn-store-pack/1", title: `Pack ${n}`, summary: "s", description: "d", tags: ["bgm"], kind: "music",
    license: "OPRN-GAME", aiGenerated: true, credits: "Music", previews: [],
    content: { tilesets: {}, assets: { [`t${n}`]: { id: `t${n}`, name: `track ${n}`, kind: "music", blob: sha(n), mime: "audio/ogg", meta: { oprnMusic: music } } } },
    blobs: [{ sha256: sha(n), mime: "audio/ogg", bytes: 10 }],
  } as unknown as StorePackManifest;
}

const filler = (n: number) => manifest(n, { genreLine: "joseon", genreKo: "조선 전통", sceneRoles: ["town"], mood: ["평화로운"], loopable: true, lengthSec: 60, summaryKo: "마을." });

function fakeStore(manifests: StorePackManifest[], pageSize: number, calls: { catalog: number; manifest: number }): StoreReadAccess {
  const items = manifests.map((_, n) => ({ slug: `pack-${n}`, title: `Pack ${n}`, summary: "", kind: "music", grade: "single", license: "OPRN-GAME", aiGenerated: true, author: "OPRN", tags: [], latestVersion: 1, cover: null, downloads: 0, updatedAt: "" }));
  return {
    url: `http://paging.test/${manifests.length}/${pageSize}`, autoInstall: true, userMentionedStore: true,
    catalog: async (input): Promise<StoreCatalogPage> => {
      calls.catalog += 1;
      const page = input.page ?? 1;
      return { items: items.slice((page - 1) * pageSize, page * pageSize) as never, total: items.length, page, pageSize };
    },
    item: async () => { throw new Error("not used"); },
    manifest: async (slug) => { calls.manifest += 1; return manifests[Number(slug.slice(5))]!; },
    blob: async () => new Uint8Array(),
  };
}

afterEach(() => { setWorkerStoreAccess(null); clearStoreMusicCache(); });

describe("store music paging", () => {
  it("lists every music pack across pages (not just 16) and caches the list and manifests for the session", async () => {
    const calls = { catalog: 0, manifest: 0 };
    const packs = Array.from({ length: 30 }, (_, n) => (n === 29
      ? manifest(n, { genreLine: "horror", genreKo: "호러 앰비언트", sceneRoles: ["tense"], mood: ["으스스한"], loopable: true, lengthSec: 60, summaryKo: "공포." })
      : filler(n)));
    const access = fakeStore(packs, 12, calls);
    expect((await listAllStoreMusicPacks(access)).items).toHaveLength(30);
    expect(calls.catalog).toBe(3);
    setWorkerStoreAccess(access);
    const result = await runToolAsync({ project: createEmptyToolProject() }, "store_find_music", { scene: "tense", query: "호러" }, { dryRun: true });
    expect(result.ok, result.summary).toBe(true);
    expect((result.data as StoreMusicChoice).tracks[0]).toMatchObject({ slug: "pack-29", recommended: true, rank: 1 });
    expect(calls.catalog).toBe(3);
    expect(calls.manifest).toBe(30);
    await runToolAsync({ project: createEmptyToolProject() }, "store_find_music", { scene: "town", query: "조선" }, { dryRun: true });
    expect(calls).toEqual({ catalog: 3, manifest: 30 });
  });
});

describe("store music recommendation", () => {
  const packs = [
    manifest(0, { genreLine: "snes-jrpg", genreKo: "16비트 레트로 JRPG", sceneRoles: ["battle"], mood: ["긴박한"], loopable: true, lengthSec: 60, summaryKo: "레트로 전투." }),
    manifest(1, { genreLine: "symphonic-jrpg", genreKo: "심포닉 JRPG", sceneRoles: ["battle"], mood: ["웅장한"], loopable: true, lengthSec: 60, summaryKo: "오케스트라 전투." }),
  ];

  it("marks only the top candidate recommended, with a reason, and marks other-line candidates of a game name as fallback", async () => {
    setWorkerStoreAccess(fakeStore(packs, 24, { catalog: 0, manifest: 0 }));
    const result = await runToolAsync({ project: createEmptyToolProject() }, "store_find_music", { scene: "battle", query: "파판 전투곡 느낌으로 일반 전투" }, { dryRun: true });
    expect(result.ok, result.summary).toBe(true);
    const tracks = (result.data as StoreMusicChoice).tracks;
    expect(tracks.map((t) => [t.slug, t.recommended === true, t.fallback === true])).toEqual([["pack-1", true, false], ["pack-0", false, true]]);
    expect(tracks[0]!.why).toMatch(/symphonic-jrpg/u);
    expect(result.summary).toMatch(/recommended/u);
    expect(result.summary).toContain("pack-1");
  });

  it("reads a gallery/mansion request passed as scene:dungeon as town", async () => {
    const town = [manifest(0, { genreLine: "piano-story", genreKo: "클래식 피아노", sceneRoles: ["town"], mood: ["잔잔한"], loopable: true, lengthSec: 60, summaryKo: "미술관." }),
      manifest(1, { genreLine: "horror", genreKo: "호러", sceneRoles: ["dungeon"], mood: ["어두운"], loopable: true, lengthSec: 60, summaryKo: "동굴." })];
    setWorkerStoreAccess(fakeStore(town, 24, { catalog: 0, manifest: 0 }));
    const result = await runToolAsync({ project: createEmptyToolProject() }, "store_find_music", { scene: "dungeon", query: "이브 같은 미술관 BGM" }, { dryRun: true });
    expect(result.ok, result.summary).toBe(true);
    expect((result.data as StoreMusicChoice).scene).toBe("town");
    expect((result.data as StoreMusicChoice).tracks[0]!.slug).toBe("pack-0");
    const cave = await runToolAsync({ project: createEmptyToolProject() }, "store_find_music", { scene: "dungeon", query: "미술관 지하 동굴" }, { dryRun: true });
    expect((cave.data as StoreMusicChoice).scene).toBe("dungeon");
  });
});

describe("set_game_audio map ids", () => {
  it("rejects a tileset id in mapIds with the real map ids and the start map", () => {
    const ctx = { project: createEmptyToolProject() };
    expect(runTool(ctx, "create_map", { id: "m_gallery", name: "미술관", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
    ctx.project.tilesets.beodeul_city ??= { id: "beodeul_city" } as never;
    const message = mapIdsError(ctx.project, ["beodeul_city"]);
    expect(message).toMatch(/beodeul_city 는 타일셋 id/u);
    expect(message).toContain("m_gallery(미술관");
    expect(message).toMatch(/시작 맵/u);
  });
});
