import { afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { ProjectPackageError, projectWithInlineUploadedMedia } from "@/project/package";
import { setUploadedAssetResolver } from "@/project/persistence/assetAccessors";
import { createStandaloneHtmlExport } from "@/project/standaloneExport";
import { STANDALONE_PROJECT_NODE_ID } from "@/project/standaloneHtml";

const encoder = new TextEncoder();
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const REF = { sha256: "b".repeat(64), mime: "image/png", bytes: PNG_BYTES.byteLength, extension: "png" };

function stubFetchBytes() {
  return async (path: string): Promise<Uint8Array> => {
    if (path.endsWith("standalone.js")) return encoder.encode("/*BUNDLE*/");
    if (path.endsWith("standalone.css")) return encoder.encode("body{}");
    return new Uint8Array([1]);
  };
}

afterEach(() => setUploadedAssetResolver(null));

describe("standalone export with separated media", () => {
  it("ref 만 있는 자산을 문서에 data URL 로 되인라인한다", async () => {
    const project = createBlankProject();
    project.assets.uploaded.asset_ref = { id: "asset_ref", name: "참조 자산", kind: "sprite", ref: REF, meta: {} };
    project.resourceProfiles.push({ kind: "chipset", name: "참조 자산", tileWidth: 16, tileHeight: 16, imageWidth: 16, imageHeight: 16, assetId: "asset_ref" });
    // 칩셋 카탈로그 행만으로는 「쓰인 자산」이 아니다(webExportAssets isChipsetCatalogRow, #3293) — 실제로 쓰는 자리(타이틀 배경)에 건다.
    project.system.titleResourceId = "asset_ref";
    setUploadedAssetResolver({
      url: (ref) => `oprn-asset://local/${ref.sha256}`,
      bytes: async () => PNG_BYTES,
    });

    const result = await createStandaloneHtmlExport(project, { fetchBytes: stubFetchBytes() });
    const html = await result.blob.text();
    const projectNode = html.slice(html.indexOf(`id="${STANDALONE_PROJECT_NODE_ID}"`));

    expect(projectNode).toContain("data:image/png;base64,");
    expect(projectNode).not.toContain(REF.sha256);
  });

  it("dataUrl 자산은 그대로 두고 해석기를 부르지 않는다", async () => {
    const project = createBlankProject();
    project.assets.uploaded.asset_inline = {
      id: "asset_inline",
      name: "인라인 자산",
      kind: "sprite",
      dataUrl: "data:image/gif;base64,R0lGOD",
      meta: {},
    };
    project.resourceProfiles.push({ kind: "chipset", name: "인라인 자산", tileWidth: 16, tileHeight: 16, imageWidth: 16, imageHeight: 16, assetId: "asset_inline" });
    project.system.titleResourceId = "asset_inline"; // 칩셋 카탈로그 행만으로는 내보내기에 남지 않는다 — 위와 같다.
    let asked = 0;
    setUploadedAssetResolver({
      url: () => "",
      bytes: async () => {
        asked += 1;
        return PNG_BYTES;
      },
    });

    const result = await createStandaloneHtmlExport(project, { fetchBytes: stubFetchBytes() });
    const html = await result.blob.text();

    expect(html.slice(html.indexOf(`id="${STANDALONE_PROJECT_NODE_ID}"`))).toContain("data:image/gif;base64,R0lGOD");
    expect(asked).toBe(0);
  });

  it("ref 를 읽지 못하면 깨진 문서를 만들지 않고 소재 이름만 알린다", async () => {
    const project = createBlankProject();
    const hostPath = "C:/private/projects/secret/assets/missing.png";
    project.assets.uploaded.missing_ref = { id: "missing_ref", name: "없는 그림", kind: "picture", ref: REF, meta: {} };
    setUploadedAssetResolver({
      url: () => "",
      bytes: async () => {
        throw new Error(`ENOENT: ${hostPath}`);
      },
    });

    const error = await createStandaloneHtmlExport(project, { fetchBytes: stubFetchBytes() }).then(
      () => { throw new Error("export succeeded"); },
      (caught: unknown) => caught,
    );
    const packaged = await projectWithInlineUploadedMedia(project).then(
      () => { throw new Error("package inlining succeeded"); },
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ProjectPackageError);
    expect(packaged).toBeInstanceOf(ProjectPackageError);
    expect((error as ProjectPackageError).message).toContain("missing_ref");
    expect((packaged as ProjectPackageError).message).toBe((error as ProjectPackageError).message);
    expect(String(error)).not.toContain(hostPath);
    expect(String(error)).not.toContain("ENOENT");
    expect((error as ProjectPackageError).cause).toBeInstanceOf(Error);
  });
});