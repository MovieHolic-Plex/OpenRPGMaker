import { afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
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
});