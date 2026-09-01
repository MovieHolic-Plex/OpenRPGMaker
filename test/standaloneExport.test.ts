import { createBlankProject } from "@/project/defaults";
import { createStandaloneHtmlExport } from "@/project/standaloneExport";
import { STANDALONE_ASSETS_NODE_ID, STANDALONE_PROJECT_NODE_ID } from "@/project/standaloneHtml";
import { describe, expect, it } from "vitest";

const encoder = new TextEncoder();

/** 디스크·네트워크 대신 쓰는 재료 공급자. 번들은 표식만, 에셋은 1바이트만 준다. */
function stubFetchBytes(options: { readonly missing?: (path: string) => boolean } = {}) {
  const asked: string[] = [];
  const fetchBytes = async (path: string): Promise<Uint8Array> => {
    asked.push(path);
    if (path.endsWith("standalone.js")) return encoder.encode("/*BUNDLE*/");
    if (path.endsWith("standalone.css")) return encoder.encode("body{background:url(/assets/fonts/x.woff2)}");
    if (options.missing?.(path) === true) throw new Error("없음");
    return new Uint8Array([1]);
  };
  return { asked, fetchBytes };
}

describe("standalone html export", () => {
  it("에셋을 data URL 로 문서에 싣고 파일명을 제목에서 만든다", async () => {
    // Given
    const project = createBlankProject();
    project.meta.title = "모험 하나";
    const { fetchBytes } = stubFetchBytes();

    // When
    const result = await createStandaloneHtmlExport(project, { fetchBytes });
    const html = await result.blob.text();

    // Then
    expect(result.fileName).toBe("모험-하나.html");
    expect(result.summary.assetCount).toBeGreaterThan(100);
    expect(result.summary.missingAssets).toEqual([]);
    expect(html).toContain("/*BUNDLE*/");
    expect(html).toContain(`id="${STANDALONE_PROJECT_NODE_ID}"`);
    expect(html).toContain(`id="${STANDALONE_ASSETS_NODE_ID}"`);
    expect(html).toContain("data:image/png;base64,");
  });

  // 재료를 못 구했으면 조용히 빠뜨리지 말고 세어서 알려야 한다 — 그림 없는 게임이 나가면
  // 사용자는 원인을 모른다.
  it("못 구한 에셋을 삼키지 않고 보고한다", async () => {
    // Given
    const project = createBlankProject();
    const { fetchBytes } = stubFetchBytes({ missing: (path) => path.endsWith(".png") });

    // When
    const result = await createStandaloneHtmlExport(project, { fetchBytes });

    // Then
    expect(result.summary.missingAssets.length).toBeGreaterThan(0);
    expect(result.summary.missingAssets.some((path) => path.endsWith(".png"))).toBe(true);
  });

  it("CSS 가 요구하는 폰트를 에셋 클로저 밖에서도 채운다", async () => {
    // Given
    const project = createBlankProject();
    const { asked, fetchBytes } = stubFetchBytes();

    // When
    const result = await createStandaloneHtmlExport(project, { fetchBytes });
    const html = await result.blob.text();

    // Then
    expect(asked).toContain("/assets/fonts/x.woff2");
    expect(html).toContain('url("data:font/woff2;base64,');
  });

  it("번들 재료를 못 받으면 실패를 숨기지 않는다", async () => {
    // Given
    const project = createBlankProject();
    const fetchBytes = async (path: string): Promise<Uint8Array> => {
      if (path.endsWith("standalone.js")) throw new Error("번들 없음");
      return new Uint8Array([1]);
    };

    // When
    const attempt = createStandaloneHtmlExport(project, { fetchBytes });

    // Then
    await expect(attempt).rejects.toThrow("번들 없음");
  });
});
