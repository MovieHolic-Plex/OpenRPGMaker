import { describe, expect, it } from "vitest";
import type { StorePackManifest } from "@/assetStore/format";
import { PublishError, publishProblems, requireTargetBase, targetBase } from "../scripts/store/storePublish.mts";

describe("store publisher targets and pre-upload checks", () => {
  it("takes store addresses from the environment only and stays inert without them", () => {
    expect(targetBase("staging", {})).toBeNull();
    expect(targetBase("production", {})).toBeNull();
    expect(() => requireTargetBase("staging", {})).toThrow(PublishError);
    expect(targetBase("staging", { STORE_PUBLISH_STAGING_URL: "http://127.0.0.1:18320/" })).toBe("http://127.0.0.1:18320");
    expect(() => targetBase("production", { STORE_PUBLISH_PRODUCTION_URL: "http://store.example" })).toThrow("https");
  });

  it("refuses official packs whose title, ids or names carry third-party pack names", () => {
    const manifest: StorePackManifest = {
      schema: "oprn-store-pack/1", title: "Rasak town", summary: "", description: "", tags: ["refmap"], kind: "tileset", license: "OPRN-GAME", aiGenerated: false, credits: "",
      content: { assets: {}, tilesets: {} }, previews: [], blobs: [],
    };
    const problems = publishProblems(manifest);
    expect(problems).toContain("제목: 제3자 팩 이름 「rasak」");
    expect(problems).toContain("태그: 제3자 팩 이름 「refmap」");
  });
});
