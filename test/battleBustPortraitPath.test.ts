/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { registerExportAssetBase, registerInlineAssets } from "@/assets/inlineAssetStore";
import { actorBustImage } from "@/player/battleComboCutIn";
import type { Project } from "@/project/types";

// 사장 1.37 VQA D3(2026-11-05): 전투 흉상 요청이 사이트 루트(/assets/...)로 나가 404.
// 같은 파일은 게임이 실린 경로(/fallen-star/1.37/assets/...)에 있었다. 내보낸 게임은 하위 경로에
// 실릴 수 있으므로, 흉상 주소도 내보내기 기준(assetBase)으로 해석돼야 한다.

const BUST_SET = "shared-brown-headband-expressions";

function projectWithBust(): Project {
  return {
    meta: { id: "d3-test", title: "d3", terms: { gold: "G", item: "아이템" } },
    system: {},
    database: {
      actors: [{ id: "actor_test", name: "테스트", appearanceId: "appearance_test" }],
      characterAppearances: [{ id: "appearance_test", bust: { resourceId: `${BUST_SET}-bust-base`, presentation: "bust" } }],
    },
    assets: { uploaded: {} },
  } as unknown as Project;
}

afterEach(() => {
  registerExportAssetBase(null);
  registerInlineAssets(null);
});

describe("battle bust portrait URL", () => {
  it("resolves against the shipped game directory, not the site root", () => {
    registerExportAssetBase(new URL("https://games.example.test/fallen-star/1.37/"));
    const bust = actorBustImage(projectWithBust(), "actor_test");
    expect(bust).toBeDefined();
    expect(bust!.url.startsWith("https://games.example.test/fallen-star/1.37/assets/shared/portraits/")).toBe(true);
    expect(bust!.url).not.toMatch(/^https:\/\/games\.example\.test\/assets\//u);
  });
});
