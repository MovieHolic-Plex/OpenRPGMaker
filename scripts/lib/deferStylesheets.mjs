// 빌드 산출 index.html 의 <link rel="stylesheet"> 를 <head> 에서 `#app` 바로 뒤(body 끝)로 옮긴다.
//
// 왜(2026-10-15 실측, 격리 netns + 대역폭 제한, 같은 dist 를 정적으로 서빙): vite 는 main.css(2.1MB 원문·약 300KB gzip) 등 스타일시트를
// head 에 심고, head 의 스타일시트는 «렌더 차단» 이라 모든 CSS 가 올 때까지 첫 프레임이 안 그려진다. 스플래시(인라인 CSS·마크업)가
// 있어도 소용이 없었다 — 첫 페인트(FCP) 50Mbps 480–880ms · 10Mbps 1.7–2.1s. body 끝으로 옮기면 같은 조건에서 104–132ms(스플래시 즉시).
//
// 안전한 이유: 지연(defer) 모듈 스크립트(<script type="module">)는 «문서에 있는 스크립트 차단 스타일시트» 가 다 로드될 때까지 실행되지 않는다
// (HTML 표준: 문서 파싱 종료 뒤 실행 전에 style sheet that is blocking scripts 가 없을 때까지 대기). 그래서 편집기가 CSS 없이 마운트되는
// 일(스타일 없는 깜빡임)이 없다. 렌더 차단만 풀린다.
// 인라인 스플래시 CSS 는 <style> 이라 그대로 head 에 둔다(첫 프레임에 필요하다).
//
// index.html(편집기)만 대상. start-screen.html 은 건드리지 않는다(첫 프레임이 CSS 에 기대는 표면이 다르다).

/** @returns {import("vite").Plugin} */
export function deferStylesheetsPlugin() {
  return {
    name: "oprn-defer-stylesheets",
    apply: "build",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const file = ctx?.filename ?? ctx?.path ?? "";
        if (!/(^|[\\/])index\.html$/.test(file) && !/^\/index\.html$/.test(ctx?.path ?? "")) return html;
        const links = html.match(/<link\s+rel="stylesheet"[^>]*>/g);
        if (!links || !html.includes('<div id="app"></div>')) return html;
        let out = html;
        for (const link of links) out = out.replace(link, "");
        // 헤드에 남은 빈 줄 정리
        out = out.replace(/\n[ \t]*\n(?=[ \t]*<)/g, "\n");
        return out.replace('<div id="app"></div>', `<div id="app"></div>\n    ${links.join("\n    ")}`);
      },
    },
  };
}
