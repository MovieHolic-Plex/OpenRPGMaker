/**
 * 한 프로젝트를 편집기와 같은 내보내기 경로로 «웹 게임 ZIP»과 «실행형 HTML 한 장»으로 만든다 — 로딩 시간 비교용.
 *
 *   node node_modules/vite-node/dist/cli.mjs --script scripts/qa/perf/export-formats.mts \
 *     --project dist/demos/emerald-crown.play.json --name emerald-crown --out /tmp/gls/exports [--dist dist] [--public public,../rpg-zzu/public]
 *
 * 쓰는 것: <out>/<name>-web/ (ZIP 을 푼 폴더, 정적 호스트에 그대로 올리는 모양) · <out>/<name>.html · 크기 요약.
 * 플레이어 번들은 --dist 의 export-player/·standalone-player/, 공용 에셋은 --public 들(앞에서부터)에서 읽는다.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { deserialize } from "@/project/io";
import { readStoredZipEntry, readStoredZipEntryNames } from "@/project/packageZip";
import { createStandaloneHtmlExport, STANDALONE_BUNDLE_BASE } from "@/project/standaloneExport";
import { createWebPlayerExportPackage, WEB_PLAYER_BUNDLE_BASE } from "@/project/webExport";

function argOf(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const projectPath = argOf("project");
const name = argOf("name");
const out = argOf("out");
if (!projectPath || !name || !out) throw new Error("--project --name --out 이 필요하다");
const dist = argOf("dist") ?? "dist";
const publics = (argOf("public") ?? "public").split(",");

function readPublic(path: string): Uint8Array {
  const relative = path.replace(/^\/+/, "");
  for (const root of publics) {
    const file = join(root, relative);
    if (existsSync(file)) return new Uint8Array(readFileSync(file));
  }
  console.error(`없는 에셋: ${path}`);
  throw new Error(`없는 에셋: ${path}`);
}

async function fetchBytes(path: string): Promise<Uint8Array> {
  if (/^https?:\/\//i.test(path)) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP ${response.status} ${path}`);
    return new Uint8Array(await response.arrayBuffer());
  }
  if (path.startsWith(WEB_PLAYER_BUNDLE_BASE) || path.startsWith(STANDALONE_BUNDLE_BASE)) {
    return new Uint8Array(readFileSync(join(dist, path)));
  }
  return readPublic(path);
}

const mb = (n: number) => (n / 1048576).toFixed(1);
const project = deserialize(readFileSync(projectPath, "utf8"));
mkdirSync(out, { recursive: true });

if (!process.argv.includes("--html-only")) {
const web = await createWebPlayerExportPackage(project, { fetchBytes });
const webBytes = new Uint8Array(await web.blob.arrayBuffer());
const webDir = join(out, `${name}-web`);
rmSync(webDir, { recursive: true, force: true });
for (const entryName of readStoredZipEntryNames(webBytes)) {
  const file = join(webDir, entryName);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, readStoredZipEntry(webBytes, entryName) ?? new Uint8Array());
}
console.log(`${name} web: zip ${mb(webBytes.length)}MB · ${web.summary.zipEntryCount} files · assets ${web.summary.assetCount} · project.json ${mb(web.summary.projectJsonBytes)}MB`);
}

const standalone = await createStandaloneHtmlExport(project, { fetchBytes });
writeFileSync(join(out, `${name}.html`), new Uint8Array(await standalone.blob.arrayBuffer()));
console.log(`${name} html: ${mb(standalone.summary.htmlBytes)}MB · assets ${standalone.summary.assetCount} · missing ${standalone.summary.missingAssets.length}`);
