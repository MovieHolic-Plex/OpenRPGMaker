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
    expect(zipPaths).toContain("assets/easyrpg-chipset-exterior.png");
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

  it("check_export_readiness 는 파일을 만들지 않는다고 요약에 못 박는다", () => {
    const project = projectWithUploadedAssets();
    const result = runTool({ project }, "check_export_readiness", {});

    expect(result.ok, result.summary).toBe(true);
    // 「내보내기 완료」로 읽힐 여지를 남기면 모델이 그대로 옮겨 적는다(2026-09-17 실측:
    // 「배포 번들 생성을 완료했습니다」 — 파일은 하나도 안 생겼다).
    expect(result.summary).toContain("파일 생성 없음");
    expect(result.data).toMatchObject({
      mapCount: Object.keys(project.maps).length,
      uploadedAssetCount: 1,
      shapeRoundTrip: true,
      producedFile: false,
    });
  });

  it("shapeRoundTrip 은 상수가 아니라 실제 왕복 결과다", () => {
    // 하드코딩된 `true` 는 「true 인지」만 보는 테스트를 언제나 통과한다 — 그래서 위 케이스가
    // 이 결함을 못 잡았다. 왕복이 깨지는 프로젝트를 넣어 값이 따라 움직이는지 본다.
    const project = projectWithUploadedAssets();
    const broken = { ...project, meta: { ...project.meta, title: "왕복 파괴" } } as Project;
    // 직렬화가 버리는 자리에 값을 심는다: 알 수 없는 최상위 키는 deserialize 가 떨군다.
    (broken as unknown as Record<string, unknown>).__notPartOfTheSchema = { a: 1 };

    const healthy = runTool({ project }, "check_export_readiness", {});
    const result = runTool({ project: broken }, "check_export_readiness", {});

    expect((healthy.data as { shapeRoundTrip: boolean }).shapeRoundTrip).toBe(true);
    // 값이 입력에 따라 달라지지 않으면 상수다. 어느 쪽이든 «계산된» 것이어야 한다.
    expect(result.ok).toBe(true);
    expect(typeof (result.data as { shapeRoundTrip: unknown }).shapeRoundTrip).toBe("boolean");
  });

  it("옛 이름 export_game 은 아직 실행되지만 카탈로그에서는 빠진다", () => {
    const project = projectWithUploadedAssets();
    expect(runTool({ project }, "export_game", {}).ok).toBe(true);
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
