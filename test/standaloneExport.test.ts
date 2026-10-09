import { createBlankProject } from "@/project/defaults";
import { createStandaloneHtmlExport } from "@/project/standaloneExport";
import { STANDALONE_ASSETS_NODE_ID, STANDALONE_PROJECT_NODE_ID } from "@/project/standaloneHtml";
import { afterEach, describe, expect, it, vi } from "vitest";

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

  afterEach(() => vi.unstubAllGlobals());

  it.each([".png", ".woff2"])("rejects missing required %s instead of returning a download", async (extension) => {
    const { fetchBytes } = stubFetchBytes({ missing: (path) => path.endsWith(extension) });
    await expect(createStandaloneHtmlExport(createBlankProject(), { fetchBytes }))
      .rejects.toThrow(extension);
  });

  it.each(["standalone.js", "standalone.css", ".png", ".woff2"])(
    "rejects editor HTML returned with status 200 for %s", async (suffix) => {
      const { fetchBytes } = stubFetchBytes();
      vi.stubGlobal("fetch", async (path: string) => new Response(
        path.endsWith(suffix) ? "<!doctype html><html><body>editor</body></html>" : await fetchBytes(path),
        { status: 200, headers: { "Content-Type": "application/octet-stream" } },
      ));
      await expect(createStandaloneHtmlExport(createBlankProject())).rejects.toThrow(suffix);
    },
  );

  it("rejects a text/html response even without an HTML opening tag", async () => {
    const { fetchBytes } = stubFetchBytes();
    vi.stubGlobal("fetch", async (path: string) => new Response(await fetchBytes(path), {
      headers: { "Content-Type": path.endsWith("standalone.js") ? "text/html; charset=utf-8" : "application/octet-stream" },
    }));
    await expect(createStandaloneHtmlExport(createBlankProject())).rejects.toThrow("standalone.js");
  });

  it.each(["standalone.js", "standalone.css", ".png"])("rejects empty %s", async (suffix) => {
    const { fetchBytes } = stubFetchBytes();
    await expect(createStandaloneHtmlExport(createBlankProject(), {
      fetchBytes: (path) => path.endsWith(suffix) ? Promise.resolve(new Uint8Array()) : fetchBytes(path),
    })).rejects.toThrow(suffix);
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
