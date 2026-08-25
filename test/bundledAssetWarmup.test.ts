/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import {
  listBundledPlayAssetPaths,
  resetBundledPlayAssetWarmup,
  warmBundledPlayAssets,
} from "@/assets/bundledAssetWarmup";
import { createBlankProject } from "@/project/defaults";

describe("bundledAssetWarmup", () => {
  afterEach(() => {
    resetBundledPlayAssetWarmup();
  });

  it("lists core chipset path and project-referenced textures only", () => {
    const project = createBlankProject();
    const paths = listBundledPlayAssetPaths(project);
    expect(paths).toContain("assets/easyrpg-chipset-exterior.png");
    expect(paths).toContain("assets/dialogue-frame.png");
    // blank project still references default actor charset / tileset strings
    expect(paths.length).toBeGreaterThan(2);
  });

  it("shares one in-flight warm promise per asset set", async () => {
    const project = createBlankProject();
    const first = warmBundledPlayAssets(project);
    const second = warmBundledPlayAssets(project);
    expect(second).toBe(first);
    // 테스트 환경 Image 로드는 타임아웃 폴백으로 끝난다.
    await expect(first).resolves.toBeUndefined();
  }, 5_000);
});
