import {
  buildStandaloneHtml,
  inlineCssAssetUrls,
  standaloneAssetKey,
  standaloneHtmlFileName,
  STANDALONE_ASSETS_NODE_ID,
  STANDALONE_PROJECT_NODE_ID,
} from "@/project/standaloneHtml";
import { describe, expect, it } from "vitest";

const BASE = {
  title: "테스트 게임",
  css: "body{color:red}",
  script: "console.log(1)",
  projectJson: '{"meta":{"title":"테스트 게임"}}',
  inlineAssets: { "assets/a.png": "data:image/png;base64,AA==" },
};

describe("standalone html", () => {
  it("프로젝트와 에셋을 문서 안 노드로 싣는다", () => {
    // Given
    const input = BASE;

    // When
    const html = buildStandaloneHtml(input);

    // Then
    expect(html).toContain(`id="${STANDALONE_PROJECT_NODE_ID}"`);
    expect(html).toContain(`id="${STANDALONE_ASSETS_NODE_ID}"`);
    expect(html).toContain("data:image/png;base64,AA==");
    expect(html).toContain(input.script);
    expect(html).toContain(input.css);
  });

  // 저작자가 대사에 </script> 를 쓰면 문서가 거기서 끊긴다 — 게임이 통째로 안 열린다.
  it("프로젝트 JSON 의 </script> 가 문서를 끊지 않는다", () => {
    // Given
    const projectJson = JSON.stringify({ meta: { title: "x" }, note: "</script><script>alert(1)</script>" });

    // When
    const html = buildStandaloneHtml({ ...BASE, projectJson });

    // Then
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script>");
    // 스크립트 태그는 본문 한 개 + JSON 노드 두 개 = 정확히 3쌍이어야 한다.
    expect(html.match(/<script/g)?.length).toBe(3);
  });

  it("제목의 태그 문자를 이스케이프한다", () => {
    // Given
    const title = "<img src=x onerror=alert(1)>";

    // When
    const html = buildStandaloneHtml({ ...BASE, title });

    // Then
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
  });

  it("CSS 의 url() 을 data URL 로 바꾸고, 표에 없으면 한 번 더 구한다", async () => {
    // Given
    const inlineAssets: Record<string, string> = { "assets/a.png": "data:image/png;base64,AA==" };
    const css = `a{background:url(/assets/a.png)}b{src:url("/assets/fonts/f.woff2")}c{background:url(data:image/gif;base64,BB==)}`;
    const asked: string[] = [];

    // When
    const result = await inlineCssAssetUrls(css, inlineAssets, async (path) => {
      asked.push(path);
      return path === "assets/fonts/f.woff2" ? "data:font/woff2;base64,CC==" : null;
    });

    // Then
    expect(asked).toEqual(["assets/fonts/f.woff2"]);
    expect(result.css).toContain('url("data:image/png;base64,AA==")');
    expect(result.css).toContain('url("data:font/woff2;base64,CC==")');
    expect(result.css).toContain("url(data:image/gif;base64,BB==)"); // 이미 data URL 이면 그대로
    expect(result.missing).toEqual([]);
    expect(inlineAssets["assets/fonts/f.woff2"]).toBe("data:font/woff2;base64,CC==");
  });

  it("못 구한 url 은 원본을 남기고 목록으로 보고한다", async () => {
    // Given
    const css = "a{background:url(/assets/missing.png)}";

    // When
    const result = await inlineCssAssetUrls(css, {}, async () => null);

    // Then
    expect(result.css).toBe(css);
    expect(result.missing).toEqual(["assets/missing.png"]);
  });

  it("경로 키를 한 가지로 맞춘다", () => {
    // Given
    const variants = ["/assets/a.png", "assets/a.png", "./assets/a.png", "assets/a.png?v=2"];

    // When
    const keys = new Set(variants.map(standaloneAssetKey));

    // Then
    expect([...keys]).toEqual(["assets/a.png"]);
  });

  it("파일명에 윈도우 금지문자를 남기지 않는다", () => {
    // Given
    const title = 'my:game/"제목"';

    // When
    const name = standaloneHtmlFileName(title);

    // Then
    expect(name.endsWith(".html")).toBe(true);
    expect(/[<>:"/\\|?*]/.test(name)).toBe(false);
    expect(standaloneHtmlFileName("   ")).toBe("oprn-game.html");
  });
});
