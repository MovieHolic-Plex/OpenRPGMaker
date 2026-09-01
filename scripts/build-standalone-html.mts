/**
 * 게임 하나를 통째로 담은 실행형 HTML 을 만든다 — 더블클릭하면 브라우저에서 바로 돈다.
 *
 * 왜 이렇게까지 하나: `file://` 에서는 같은 폴더의 파일도 못 읽는다(출처가 null 이라 fetch·XHR
 * 이 막히고, type=module 스크립트와 외부 CSS 도 거부된다). 그래서 코드·스타일·Phaser·에셋·
 * 프로젝트를 **한 문서 안에** 넣는다.
 *
 *   npm run build:standalone -- [--project <파일.oprn>] [--out <경로.html>]
 *
 * 문서 조립 자체는 src/project/standaloneHtml.ts 가 한다 — 에디터의 «실행형 HTML 로 내보내기»
 * 와 같은 결과물이 나와야 하므로 규칙을 두 벌 두지 않는다.
 */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createBlankProject } from "@/project/defaults";
import { deserialize } from "@/project/io";
import { readProjectPackage } from "@/project/package";
import {
  buildStandaloneHtml,
  inlineCssAssetUrls,
  standaloneHtmlFileName,
} from "@/project/standaloneHtml";
import { prepareWebExport } from "@/project/webExport";
import type { Project } from "@/project/types";

const BUNDLE_DIR = "dist/standalone-player";
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

function argOf(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function mimeOf(path: string): string {
  return MIME_BY_EXTENSION[path.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

function dataUrlOf(diskPath: string): string {
  return `data:${mimeOf(diskPath)};base64,${readFileSync(diskPath).toString("base64")}`;
}

async function loadProject(source: string | undefined): Promise<Project> {
  if (source === undefined) return createBlankProject();
  const bytes = new Uint8Array(readFileSync(source));
  // .oprn 은 단일 파일 패키지다. 평문 JSON 도 받아 준다 — 진단할 때 편하다.
  if (source.endsWith(".json")) return deserialize(new TextDecoder().decode(bytes));
  return await readProjectPackage(new Blob([bytes]));
}

const project = await loadProject(argOf("project"));
const prepared = prepareWebExport(project);
const inlineAssets: Record<string, string> = {};
const unreadable: string[] = [];
let assetBytes = 0;

for (const asset of prepared.assets) {
  if (asset.kind === "uploaded") continue; // 업로드 에셋은 이미 project.json 안에 data URL 로 있다.
  const diskPath = join("public", asset.sourcePath);
  try {
    assetBytes += statSync(diskPath).size;
    inlineAssets[asset.zipPath] = dataUrlOf(diskPath);
  } catch {
    unreadable.push(asset.sourcePath);
  }
}

const script = readFileSync(join(BUNDLE_DIR, "standalone.js"), "utf8");
// 폰트처럼 CSS 만 물고 있는 파일은 여기서 디스크를 한 번 더 뒤져 채운다.
const { css, missing } = await inlineCssAssetUrls(
  readFileSync(join(BUNDLE_DIR, "standalone.css"), "utf8"),
  inlineAssets,
  async (path) => { try { return dataUrlOf(join("public", path)); } catch { return null; } },
);

const title = project.meta.title || "OPRN Game";
const html = buildStandaloneHtml({ title, css, script, projectJson: prepared.projectJson, inlineAssets });
const out = argOf("out") ?? `dist/${standaloneHtmlFileName(title)}`;
writeFileSync(out, html);

const mb = (n: number): string => (n / 1048576).toFixed(2);
console.log(`파일      : ${out}`);
console.log(`크기      : ${mb(Buffer.byteLength(html))} MB`);
console.log(`  코드    : ${mb(script.length)} MB (Phaser 포함)`);
console.log(`  스타일  : ${mb(css.length)} MB`);
console.log(`  프로젝트: ${mb(prepared.projectJson.length)} MB`);
console.log(`  에셋    : ${Object.keys(inlineAssets).length}개 원본 ${mb(assetBytes)} MB`);
if (missing.length > 0) console.log(`CSS 에서 못 채운 url ${missing.length}개: ${missing.slice(0, 5).join(", ")}`);
if (unreadable.length > 0) console.log(`읽지 못한 에셋 ${unreadable.length}개: ${unreadable.slice(0, 5).join(", ")}`);
