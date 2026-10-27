/**
 * 실행형 HTML 은 플레이어와 에셋을 문서 한 장에 넣는다. 대표 데모 실측은 100~230MB
 * (openwiki/architecture.md). GitHub 는 50MiB 부터 경고하고 100MiB 를 넘는 파일은
 * 푸시를 거절하므로, 그 파일은 GitHub Pages 저장소에 커밋할 수 없다.
 * 웹 공개는 파일을 나누는 「웹 서버 ZIP」을 풀어 올린다.
 *
 * https://docs.github.com/repositories/working-with-files/managing-large-files/about-large-files-on-github
 */

const MIB = 1024 * 1024;

/** GitHub warns when a pushed file is at least this big. */
export const GITHUB_FILE_WARN_BYTES = 50 * MIB;

/** GitHub rejects a push that contains a file at least this big. */
export const GITHUB_FILE_BLOCK_BYTES = 100 * MIB;

export type StandaloneHostingLevel = "ok" | "warn" | "blocked";

export function standaloneHostingLevel(htmlBytes: number): StandaloneHostingLevel {
  if (!Number.isFinite(htmlBytes) || htmlBytes < GITHUB_FILE_WARN_BYTES) return "ok";
  return htmlBytes < GITHUB_FILE_BLOCK_BYTES ? "warn" : "blocked";
}

/** Downloaded HTML size. `string.length` counts UTF-16 code units and undercounts Korean. */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export interface StandaloneExportDoneInput {
  readonly htmlBytes: number;
  readonly assetCount: number;
  readonly missingCount: number;
}

const ZIP_HINT = "웹에 올릴 때는 「웹 서버 ZIP」을 풀어 쓰세요.";

/** Korean source for the completion toast. Catalog keys match these sentences. */
export function standaloneExportDoneMessage(input: StandaloneExportDoneInput): string {
  const size = (input.htmlBytes / MIB).toFixed(1);
  const level = standaloneHostingLevel(input.htmlBytes);
  if (level === "blocked" && input.missingCount === 0) {
    return `실행형 HTML 완료: ${size}MB, 에셋 ${input.assetCount}개. GitHub는 100MB를 넘는 파일을 거절하므로 이 파일은 GitHub Pages에 올릴 수 없습니다. ${ZIP_HINT}`;
  }
  if (level === "blocked") {
    return `실행형 HTML 완료: ${size}MB, 에셋 ${input.assetCount}개, 못 넣은 에셋 ${input.missingCount}개. GitHub는 100MB를 넘는 파일을 거절하므로 이 파일은 GitHub Pages에 올릴 수 없습니다. ${ZIP_HINT}`;
  }
  if (level === "warn" && input.missingCount === 0) {
    return `실행형 HTML 완료: ${size}MB, 에셋 ${input.assetCount}개. GitHub는 50MB부터 경고합니다. ${ZIP_HINT}`;
  }
  if (level === "warn") {
    return `실행형 HTML 완료: ${size}MB, 에셋 ${input.assetCount}개, 못 넣은 에셋 ${input.missingCount}개. GitHub는 50MB부터 경고합니다. ${ZIP_HINT}`;
  }
  if (input.missingCount === 0) return `실행형 HTML 완료: ${size}MB, 에셋 ${input.assetCount}개`;
  return `실행형 HTML 완료(경고): ${size}MB, 못 넣은 에셋 ${input.missingCount}개`;
}

export function standaloneExportDoneKind(input: StandaloneExportDoneInput): "ok" | "info" {
  if (input.missingCount > 0 || standaloneHostingLevel(input.htmlBytes) !== "ok") return "info";
  return "ok";
}

/** Title on the publishing dialog's single-file HTML button, before the export starts. */
export const STANDALONE_HTML_GITHUB_PAGES_HINT =
  "게임과 플레이어를 HTML 한 장에 넣습니다. 100MB를 넘기면 GitHub Pages에 올릴 수 없습니다. 웹 공개는 「웹 서버 ZIP」을 쓰세요.";
