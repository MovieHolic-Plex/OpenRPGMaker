import { describe, expect, it } from "vitest";
import { separateInlineUploadedMedia } from "@/project/persistence/inlineMediaRefs";
import type { ProjectRepository } from "@/project/persistence/types";
import type { Project, UploadedAsset } from "@/project/types";

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
