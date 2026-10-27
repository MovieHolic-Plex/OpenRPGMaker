import { afterEach, describe, expect, it, vi } from "vitest";
import { readLoadingInfo } from "@/player/bootLoader";
import { webUploadedAssetPath } from "@/project/webUploadedAssetPath";
import type { UploadedAsset } from "@/project/types";

const base = "https://games.example/play/project.json";

function uploaded(id: string, extension: string): UploadedAsset {
  return {
    id,
    name: id,
    kind: "picture",
    meta: { width: 1, height: 1 },
    ref: { sha256: "a".repeat(64), mime: "image/webp", bytes: 3, extension },
  };
}

function stubLoading(body: unknown, ok = true): void {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 404 })));
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("readLoadingInfo", () => {
  it("keeps an exported cover whose file name is not ASCII", async () => {
    const cover = webUploadedAssetPath(uploaded("회중 시계/그림", "webp"));
    const titled = webUploadedAssetPath(uploaded("hero's portrait", "png"));
    stubLoading({ title: "회중 시계", cover, projectBytes: 12 });

    const info = await readLoadingInfo(base);

    expect(cover).toBe("assets/uploaded/회중-시계-그림.webp");
    expect(info.title).toBe("회중 시계");
    expect(info.projectBytes).toBe(12);
    expect(info.cover).toBe(new URL(cover, base).href);
    expect(info.cover).toContain("%ED%9A%8C%EC%A4%91");

    stubLoading({ title: "Portrait", cover: titled });
    expect((await readLoadingInfo(base)).cover).toBe(new URL(titled, base).href);
  });

  it("keeps an audio alias whose packaged name is not ASCII", async () => {
    const from = "assets/uploaded/효과음.wav";
    const to = "assets/uploaded/효과음.web.mp3";
    stubLoading({ aliases: { [from]: to, "assets/ok.wav": "assets/ok.mp3" } });

    expect((await readLoadingInfo(base)).aliases).toEqual({ [from]: to, "assets/ok.wav": "assets/ok.mp3" });
  });

  it("drops a cover or alias that leaves the package and still reads the title", async () => {
    stubLoading({
      title: "Still named",
      cover: "../secret.png",
      aliases: {
        "assets/real.wav": "assets/%2e%2e/secret.mp3",
        "https://evil.example/a.wav": "assets/a.mp3",
        "assets/a#b.wav": "assets/a.mp3",
        "assets/ok.wav": "assets/ok.mp3",
      },
    });

    const info = await readLoadingInfo(base);
    expect(info.title).toBe("Still named");
    expect(info.cover).toBeUndefined();
    expect(info.aliases).toEqual({ "assets/ok.wav": "assets/ok.mp3" });
  });
});
