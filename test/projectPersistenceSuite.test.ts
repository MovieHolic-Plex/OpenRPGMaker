import { describe, expect, it } from "vitest";
import { separateInlineUploadedMedia } from "@/project/persistence/inlineMediaRefs";
import type { ProjectRepository } from "@/project/persistence/types";
import type { Project, UploadedAsset } from "@/project/types";
import { uploadedAssetForImport } from "@/editor/uploadedAssetStorage";
import { createMemoryRepository } from "@/project/persistence/memoryRepository";
import { createLocalRepositoryFixture, type LocalRepositoryFixture } from "./localStore/localRepositoryFixture";
import { isolateTimers } from "./mergedTeardown";

describe("inlineMediaRefs", () => {
  isolateTimers();
  const png = "data:image/png;base64,iVBORw0KGgo=";
  function project(uploaded: Record<string, UploadedAsset>): Project {
    return { assets: { sprites: {}, uploaded } } as unknown as Project;
  }
  function assets(fail = new Set<string>()): ProjectRepository["assets"] & { readonly puts: string[] } {
    const puts: string[] = [];
    return {
      puts,
      async put(bytes, meta) {
        if (fail.has(meta.originalName ?? "")) throw new Error("disk full");
        puts.push(meta.originalName ?? "");
        return { ref: { sha256: String(bytes.length).padStart(64, "0"), mime: meta.mime, bytes: bytes.length, extension: meta.extension }, dataUrl: null };
      },
      url: () => "",
      list: async () => [],
      pruneUnused: async () => [],
    };
  }
  describe("separateInlineUploadedMedia", () => {
    it("moves inline uploads to refs without touching the source project", async () => {
      // 2026-09-28: the host rewrote these 414 inline shared images after the first save, and the
      // resulting project swap made every in-flight assistant apply fail with stale-base.
      const inline: UploadedAsset = { id: "a", name: "a", kind: "tileset", dataUrl: png, meta: {} };
      const stored: UploadedAsset = { id: "b", name: "b", kind: "tileset", ref: { sha256: "f".repeat(64), mime: "image/png", bytes: 1, extension: "png" }, meta: {} };
      const source = project({ a: inline, b: stored });
      const repo = assets();
      const result = await separateInlineUploadedMedia(source, repo);
      expect(result?.assetIds).toEqual(["a"]);
      expect(repo.puts).toEqual(["a"]);
      expect(result?.project.assets.uploaded.a).toMatchObject({ id: "a", ref: { mime: "image/png", extension: "png" } });
      expect(result?.project.assets.uploaded.a?.dataUrl).toBeUndefined();
      expect(result?.project.assets.uploaded.b).toBe(stored);
      expect(source.assets.uploaded.a).toBe(inline);
      expect(inline.dataUrl).toBe(png);
    });

    it("returns null when nothing is inline and keeps failed uploads inline", async () => {
      expect(await separateInlineUploadedMedia(project({}), assets())).toBeNull();
      const result = await separateInlineUploadedMedia(project({
        a: { id: "a", name: "a", kind: "tileset", dataUrl: png, meta: {} },
        b: { id: "b", name: "b", kind: "tileset", dataUrl: png, meta: {} },
      }), assets(new Set(["b"])));
      expect(result?.assetIds).toEqual(["a"]);
      expect(result?.project.assets.uploaded.b?.dataUrl).toBe(png);
    });
  });
});

describe("uploadedAssetStorage", () => {
  isolateTimers();
  const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const DATA_URL = `data:image/png;base64,${Buffer.from(PNG_BYTES).toString("base64")}`;
  async function withLocalFixture(run: (fixture: LocalRepositoryFixture) => Promise<void>): Promise<void> {
    const fixture = await createLocalRepositoryFixture();
    try {
      await run(fixture);
    } finally {
      fixture.close();
    }
  }
  describe("uploadedAssetForImport", () => {
    it("자산 저장이 없는 어댑터는 dataUrl 을 문서에 넣는다", async () => {
      const repository = createMemoryRepository({ target: { url: "memory://contract", anonKey: "memory", projectId: "p1" } });

      const asset = await uploadedAssetForImport({
        repository,
        id: "asset_mem",
        name: "메모리 이미지",
        kind: "sprite",
        dataUrl: DATA_URL,
        meta: { width: 1, height: 1 },
      });

      expect(asset.dataUrl).toBe(DATA_URL);
      expect(asset.ref).toBeUndefined();
      expect(await repository.assets.list()).toHaveLength(0);
    });

    it("자산 저장이 있는 어댑터는 파일로 넣고 ref 만 문서에 남긴다", async () => {
      await withLocalFixture(async ({ repository }) => {
        const asset = await uploadedAssetForImport({
          repository,
          id: "asset_local",
          name: "로컬 이미지",
          kind: "sprite",
          dataUrl: DATA_URL,
          meta: { width: 1, height: 1 },
        });

        expect(asset.dataUrl).toBeUndefined();
        expect(asset.ref?.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(asset.ref?.extension).toBe("png");
        expect(asset.ref?.mime).toBe("image/png");
        expect(asset.ref?.bytes).toBe(PNG_BYTES.byteLength);

        const listed = await repository.assets.list();
        expect(listed.map((entry) => entry.sha256)).toEqual([asset.ref?.sha256]);
      });
    });
  });
});
