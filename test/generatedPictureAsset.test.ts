import { describe, expect, it } from "vitest";
import { insertGeneratedPictureAsset } from "@/editor/generatedPictureAsset";
import { faceDisplayModeOf } from "@/editor/panels/eventEditor/facesetPreview";
import { createBlankProject } from "@/project/defaults";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFHAP/q842iQAAAABJRU5ErkJggg==";

describe("insertGeneratedPictureAsset", () => {
  it("dataUrl 그림을 uploaded picture 로 넣고 id 를 돌려준다", () => {
    const project = createBlankProject();
    const before = Object.keys(project.assets.uploaded).length;
    const id = insertGeneratedPictureAsset(project, { name: "달빛 창가", dataUrl: PNG });
    expect(id.length).toBeGreaterThan(0);
    expect(project.assets.uploaded[id]?.kind).toBe("picture");
    expect(project.assets.uploaded[id]?.dataUrl).toBe(PNG);
    expect(project.assets.uploaded[id]?.name).toBe("달빛 창가");
    expect(project.resourceProfiles.some((profile) => profile.assetId === id && profile.kind === "picture")).toBe(true);
    expect(Object.keys(project.assets.uploaded).length).toBe(before + 1);
  });

  it("kind 를 주면 그 kind 로 저장한다", () => {
    const project = createBlankProject();
    const faceId = insertGeneratedPictureAsset(project, { name: "검사", dataUrl: PNG, kind: "faceset" });
    expect(project.assets.uploaded[faceId]?.kind).toBe("faceset");
    expect(project.resourceProfiles.some((profile) => profile.assetId === faceId && profile.kind === "faceset")).toBe(true);
    const titleId = insertGeneratedPictureAsset(project, { name: "타이틀", dataUrl: PNG, kind: "title" });
    expect(project.assets.uploaded[titleId]?.kind).toBe("title");
    const backdropId = insertGeneratedPictureAsset(project, { name: "화산 동굴", dataUrl: PNG, kind: "backdrop" });
    expect(project.assets.uploaded[backdropId]?.kind).toBe("backdrop");
    expect(backdropId).toContain("backdrop_img");
  });

  it("faceset 생성 id 는 통짜 초상 판정을 받는다", () => {
    const project = createBlankProject();
    const id = insertGeneratedPictureAsset(project, { name: "검사", dataUrl: PNG, kind: "faceset" });
    expect(faceDisplayModeOf(id)).not.toBe("chip");
  });

  it("그림 dataUrl 이 아니면 프로젝트에 쓰지 않는다", () => {
    const project = createBlankProject();
    const before = Object.keys(project.assets.uploaded).length;
    expect(() => insertGeneratedPictureAsset(project, { name: "x", dataUrl: "not-an-image" })).toThrow();
    expect(Object.keys(project.assets.uploaded).length).toBe(before);
  });
});
