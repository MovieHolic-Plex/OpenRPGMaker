import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { deserialize } from "@/project/io";
import { readStoredZipEntryNames } from "@/project/packageZip";
import {
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

  it("플레이어 번들 manifest와 프로젝트/에셋을 단일 zip으로 묶는다", async () => {
    const bytes = new TextEncoder();
    const result = await createWebPlayerExportPackage(projectWithUploadedAssets(), {
      fetchBytes: async (path) => {
        if (path.endsWith("player-manifest.json")) {
          return bytes.encode(JSON.stringify({
            "player.html": {
              file: "player.js",
              isEntry: true,
              css: ["assets/player.css"],
              dynamicImports: ["src/player/PlayScene.ts"],
            },
            "src/player/PlayScene.ts": {
              file: "assets/PlayScene.js",
              imports: ["player.html"],
              dynamicImports: ["src/player/playSceneBattle.ts"],
            },
            "src/player/playSceneBattle.ts": { file: "assets/playSceneBattle.js", imports: ["player.html"] },
          }));
        }
        return bytes.encode(`file:${path}`);
      },
    });
    const names = readStoredZipEntryNames(new Uint8Array(await result.blob.arrayBuffer()));

    expect(names).toEqual(expect.arrayContaining([
      "player.html",
      "player.js",
      "project.json",
      "assets/player.css",
      "assets/PlayScene.js",
      "assets/playSceneBattle.js",
      "assets/uploaded/used_picture.png",
    ]));
    expect(result.summary.playerBundleFileCount).toBeGreaterThanOrEqual(4);
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
  project.assets.uploaded = {
    used_picture: uploaded("used_picture"),
    unused_picture: uploaded("unused_picture"),
  };
  project.database.items[0] = {
    ...project.database.items[0]!,
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
