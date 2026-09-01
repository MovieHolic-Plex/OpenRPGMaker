/**
 * 에디터의 «실행형 HTML 로 내보내기» — 게임 하나가 통째로 든 HTML 한 장을 만든다.
 *
 * 웹 게임 내보내기(webExport)와 재료는 같고 담는 그릇만 다르다. 저쪽은 웹 서버에 올릴 ZIP 이고
 * 이쪽은 `file://` 에서 더블클릭으로 도는 단일 문서다. 문서 조립 규칙은 standaloneHtml 이
 * 한 곳에서 쥐고 있어 Node 빌드 스크립트와 결과가 갈리지 않는다.
 */
import {
  buildStandaloneHtml,
  inlineCssAssetUrls,
  standaloneHtmlFileName,
} from "@/project/standaloneHtml";
import { prepareWebExport } from "@/project/webExport";
import type { Project } from "@/project/types";

/** 스탠드얼론 번들이 놓이는 곳. vite.standalone.config.ts 의 outDir 과 짝이다. */
export const STANDALONE_BUNDLE_BASE = "/standalone-player/";

export type StandaloneFetchBytes = (path: string) => Promise<Uint8Array>;

export interface StandaloneExportResult {
  readonly blob: Blob;
  readonly fileName: string;
  readonly summary: {
    readonly assetCount: number;
    readonly missingAssets: readonly string[];
    readonly htmlBytes: number;
  };
}

export interface StandaloneExportOptions {
  readonly bundleBase?: string;
  readonly fetchBytes?: StandaloneFetchBytes;
}

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
};

export async function createStandaloneHtmlExport(
  project: Project,
  options: StandaloneExportOptions = {},
): Promise<StandaloneExportResult> {
  const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
  const bundleBase = options.bundleBase ?? STANDALONE_BUNDLE_BASE;
  const prepared = prepareWebExport(project);

  const inlineAssets: Record<string, string> = {};
  const missingAssets: string[] = [];
  for (const asset of prepared.assets) {
    // 업로드 에셋은 이미 project.json 안에 data URL 로 들어 있다.
    if (asset.kind === "uploaded") continue;
    const dataUrl = await loadDataUrl(asset.sourcePath, fetchBytes);
    if (dataUrl === null) { missingAssets.push(asset.sourcePath); continue; }
    inlineAssets[asset.zipPath] = dataUrl;
  }

  const script = decodeText(await fetchBytes(`${bundleBase}standalone.js`));
  const { css, missing } = await inlineCssAssetUrls(
    decodeText(await fetchBytes(`${bundleBase}standalone.css`)),
    inlineAssets,
    (path) => loadDataUrl(path, fetchBytes),
  );

  const title = project.meta.title || "OPRN Game";
  const html = buildStandaloneHtml({ title, css, script, projectJson: prepared.projectJson, inlineAssets });
  return {
    blob: new Blob([html], { type: "text/html;charset=utf-8" }),
    fileName: standaloneHtmlFileName(title),
    summary: {
      assetCount: Object.keys(inlineAssets).length,
      missingAssets: [...missingAssets, ...missing],
      htmlBytes: html.length,
    },
  };
}

async function loadDataUrl(path: string, fetchBytes: StandaloneFetchBytes): Promise<string | null> {
  try {
    return `data:${mimeOf(path)};base64,${base64Of(await fetchBytes(`/${path.replace(/^\//, "")}`))}`;
  } catch {
    return null;
  }
}

function mimeOf(path: string): string {
  return MIME_BY_EXTENSION[path.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

/**
 * btoa 는 인자 하나에 문자열을 통째로 받는데, 34MB 짜리를 한 번에 넘기면 엔진에 따라
 * 인자 길이 한계에 걸린다. 조각으로 끊어 넘긴다.
 */
function base64Of(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return btoa(binary);
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

async function defaultFetchBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`실행형 HTML 재료를 못 받았습니다: ${path} (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}
