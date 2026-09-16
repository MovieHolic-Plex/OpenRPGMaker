// `@import` 의 단일 정의. css-flatten / check-css-graph 가 공유한다.
//
// 왜 공유해야 하나 (2026-09-17 실측):
//   css-flatten.mjs 의 정규식은 따옴표를 **필수**로 요구했고 check-css-graph.mjs 는
//   `url(...)` 무따옴표까지 읽었다. 둘 다 유효한 CSS 이고 postcss-import·브라우저 모두
//   같게 로드하는데, 한쪽 도구만 보이는 형태가 생긴 것이다. 그 결과
//       @import "./x.css" layer(database);  →  @import url(./x.css) layer(database);
//   한 줄 편집이 시트 하나를 표면 검사(R1–R6)에서 통째로 면제시켰다(위반 325건 증발).
//   화면은 전혀 안 바뀌므로 스크린샷 게이트도 못 잡는다. 1초짜리 세탁 프리미티브였다.
//
//   두 도구가 같은 정의를 공유하지 않으면 또 벌어진다.

/**
 * 주석만 지우고 문자열 내용은 **보존**한다.
 *
 * check-css-budget.mjs 의 스캐너와 다른 점: 그쪽은 hex/!important 를 세는 용도라
 * 문자열 내용을 빈칸으로 만든다. 여기서 그러면 `@import "./a.css"` 의 경로가 사라진다.
 *
 * 정규식(`/\*[\s\S]*?\*\//g`)을 쓰지 않는 이유는 같다 — 문자열 안의 `/*` 에 속는다:
 *   .a::before { content: "/*"; }
 *   @import "./ghost.css";          ← 정규식 판은 이 줄을 주석으로 삼켜 등록을 놓친다
 *   .b::after  { content: "*\/"; }
 */
export function stripCssComments(css) {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      // 주석이 먹은 줄 수만큼 개행을 남겨 줄 번호를 보존한다.
      const chunk = css.slice(i, end === -1 ? css.length : end + 2);
      out += chunk.replace(/[^\n]/g, "");
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < css.length && css[i] !== quote) {
        if (css[i] === "\\") { out += css[i]; i += 1; }
        if (i < css.length) { out += css[i]; i += 1; }
      }
      if (i < css.length) { out += css[i]; i += 1; }
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

// 따옴표 3종(", ', 없음) × url() 유무를 모두 읽는다. `i` 플래그는 @IMPORT/URL() 대비.
// 없으면 누가 대문자로 한 줄 쓰는 순간 정상 등록을 못 읽어 멀쩡한 파일을 고아로 오탐한다.
export const CSS_IMPORT_RE =
  /@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)|"([^"]*)"|'([^']*)')([^;]*);?/gi;

/**
 * @param {string} rawCss
 * @returns {Array<{spec: string, layer: string|null, index: number}>}
 *   spec  — @import 대상 경로 (쿼리·해시 미제거)
 *   layer — `layer(name)` 의 name, 없으면 null
 */
export function parseImports(rawCss) {
  const css = stripCssComments(rawCss);
  const out = [];
  for (const m of css.matchAll(CSS_IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5];
    if (!spec) continue;
    const layerMatch = /layer\(\s*([\w.-]+)\s*\)/i.exec(m[6] ?? "");
    out.push({ spec, layer: layerMatch ? layerMatch[1] : null, index: m.index ?? 0 });
  }
  return out;
}
