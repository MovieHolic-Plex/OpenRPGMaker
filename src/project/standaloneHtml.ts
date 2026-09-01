/**
 * 실행형 HTML(단일 파일 게임) 문서를 만든다.
 *
 * Node 스크립트(scripts/build-standalone-html.mts)와 에디터의 «실행형 HTML 로 내보내기» 가
 * **같은 문서를 만들어야** 하므로 조립은 여기 한 곳에 둔다. 양쪽은 재료를 어디서 구하느냐만
 * 다르다 — 디스크냐 fetch 냐.
 *
 * `file://` 제약이 이 모듈의 모든 결정을 지배한다: 외부 파일을 못 읽으므로 스타일·스크립트·
 * 에셋·프로젝트가 전부 이 문서 안에 있어야 한다.
 */
export interface StandaloneHtmlInput {
  readonly title: string;
  /** 빌드된 CSS. url() 은 inlineCssAssetUrls 로 미리 치환해 둔다. */
  readonly css: string;
  /** 빌드된 IIFE 스크립트(Phaser 포함). */
  readonly script: string;
  /** 직렬화된 프로젝트 JSON. */
  readonly projectJson: string;
  /** zip 경로 → data URL. */
  readonly inlineAssets: Readonly<Record<string, string>>;
}

export const STANDALONE_PROJECT_NODE_ID = "oprn-standalone-project";
export const STANDALONE_ASSETS_NODE_ID = "oprn-standalone-assets";

export function buildStandaloneHtml(input: StandaloneHtmlInput): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtmlText(input.title)}</title>
    <style>${input.css}</style>
  </head>
  <body>
    <div id="app"></div>
    <script type="application/json" id="${STANDALONE_ASSETS_NODE_ID}">${embedJson(JSON.stringify(input.inlineAssets))}</script>
    <script type="application/json" id="${STANDALONE_PROJECT_NODE_ID}">${embedJson(input.projectJson)}</script>
    <script>${input.script}</script>
  </body>
</html>
`;
}

/**
 * CSS 의 url() 을 data URL 로 바꾼다. 표에 없는 파일은 `load` 로 한 번 더 구해 본다 —
 * 폰트처럼 프로젝트 에셋 클로저에는 안 잡히지만 CSS 는 반드시 필요로 하는 것들이 있다.
 */
export async function inlineCssAssetUrls(
  css: string,
  inlineAssets: Record<string, string>,
  load: (path: string) => Promise<string | null>,
): Promise<{ readonly css: string; readonly missing: readonly string[] }> {
  const missing: string[] = [];
  const requests = [...css.matchAll(/url\(\s*["']?(\/?[^"')]+)["']?\s*\)/g)]
    .map((match) => match[1] ?? "")
    .filter((raw) => raw !== "" && !raw.startsWith("data:") && !raw.includes("://"));

  for (const raw of new Set(requests)) {
    const key = standaloneAssetKey(raw);
    if (inlineAssets[key] !== undefined) continue;
    const loaded = await load(key);
    if (loaded === null) { missing.push(key); continue; }
    inlineAssets[key] = loaded;
  }

  const next = css.replace(/url\(\s*["']?(\/?[^"')]+)["']?\s*\)/g, (whole, raw: string) => {
    if (raw.startsWith("data:") || raw.includes("://")) return whole;
    const dataUrl = inlineAssets[standaloneAssetKey(raw)];
    return dataUrl === undefined ? whole : `url("${dataUrl}")`;
  });
  return { css: next, missing };
}

export function standaloneAssetKey(pathOrUrl: string): string {
  return pathOrUrl.replace(/^\.?\//, "").split("?")[0] ?? "";
}

export function standaloneHtmlFileName(title: string): string {
  // 윈도우 금지문자·제어문자·공백을 하이픈으로 — webExportAssets.safeFileName 과 같은 규칙.
  const safe = title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-").replace(/\s+/g, "-");
  return `${safe || "oprn-game"}.html`;
}

/**
 * `<script type="application/json">` 은 `</script>` 를 만나면 거기서 끝난다. base64 에는 `<` 가
 * 없지만 저작자가 쓴 대사에는 있을 수 있다.
 */
function embedJson(json: string): string {
  return json.replace(/</g, "\\u003c");
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
