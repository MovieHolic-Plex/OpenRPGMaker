import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { deserialize } from "@/project/io";
import {
  WEB_PLAYER_MANIFEST,
  collectWebExportAssets,
  createWebPlayerExportPackage,
  prepareWebExport,
} from "@/project/webExport";
import type { Project, UploadedAsset } from "@/project/types";

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgo=";

describe("web player export", () => {
  it("직렬화 프로젝트는 shape 왕복을 통과하고 사용 중인 업로드 에셋만 보존한다", () => {
    const project = projectWithUploadedAssets();
    const prepared = prepareWebExport(project);
    const reloaded = deserialize(prepared.projectJson);

    expect(Object.keys(reloaded.assets.uploaded)).toEqual(["used_picture"]);
    expect(reloaded.database.items[0]?.imageResourceId).toBe("used_picture");
    expect(prepared.summary.mapCount).toBe(Object.keys(project.maps).length);
    expect(prepared.summary.uploadedAssetCount).toBe(1);
  });

  it("에셋 수집은 사용 중인 업로드 파일만 assets/uploaded에 넣는다", () => {
    const project = prepareWebExport(projectWithUploadedAssets()).project;
    const assets = collectWebExportAssets(project);
    const zipPaths = assets.map((asset) => asset.zipPath);

    expect(zipPaths).toContain("assets/uploaded/used_picture.png");
    expect(zipPaths).not.toContain("assets/uploaded/unused_picture.png");
    expect(zipPaths).toContain("assets/rm2k3-original-chipset.png");
  });

  it("검증된 배포 manifest가 없으면 불완전 ZIP을 만들지 않는다", async () => {
    const exportAttempt = createWebPlayerExportPackage(projectWithUploadedAssets(), {
      fetchBytes: async (path) => {
        if (path.endsWith(WEB_PLAYER_MANIFEST)) throw new Error("fixture manifest unavailable");
        return new TextEncoder().encode(`file:${path}`);
      },
    });

    await expect(exportAttempt).rejects.toMatchObject({ code: "manifest-unavailable" });
  });

  it("export_game 툴은 헤드리스 요약과 shape 검증 결과를 반환한다", () => {
    const project = projectWithUploadedAssets();
    const result = runTool({ project }, "export_game", {});

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("웹 내보내기 준비 완료");
    expect(result.data).toMatchObject({
      mapCount: Object.keys(project.maps).length,
      uploadedAssetCount: 1,
      shapeRoundTrip: true,
    });
  });
});

function projectWithUploadedAssets(): Project {
  const project = createBlankProject();
  const firstItem = project.database.items[0];
  if (firstItem === undefined) throw new TypeError("web export fixture requires a database item");
  project.assets.uploaded = {
    used_picture: uploaded("used_picture"),
    unused_picture: uploaded("unused_picture"),
  };
  project.database.items[0] = {
    ...firstItem,
    imageResourceId: "used_picture",
    iconResourceId: "cc0-jetrel-potion-red",
  };
  return project;
}

function uploaded(id: string): UploadedAsset {
  return {
    id,
    name: id,
    kind: "picture",
    dataUrl: PNG_DATA_URL,
    meta: { width: 1, height: 1 },
  };
}
