/**
 * 게임 하나를 통째로 담은 실행형 HTML 을 만든다 — 더블클릭하면 브라우저에서 바로 돈다.
 *
 *   npm run build:standalone -- [--project <파일.oprn>] [--out <경로.html>]
 *
 * 에디터와 같은 내보내기 경로를 쓴다. 재료 하나라도 없거나 잘못됐으면 파일을 쓰지 않는다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createBlankProject } from "@/project/defaults";
import { deserialize } from "@/project/io";
import { readProjectPackage } from "@/project/package";
import { createStandaloneHtmlExport, STANDALONE_BUNDLE_BASE } from "@/project/standaloneExport";
import type { Project } from "@/project/types";

function argOf(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadProject(source: string | undefined): Promise<Project> {
  if (source === undefined) return createBlankProject();
  const bytes = new Uint8Array(readFileSync(source));
  // .oprn 은 단일 파일 패키지다. 평문 JSON 도 받아 준다 — 진단할 때 편하다.
  if (source.endsWith(".json")) return deserialize(new TextDecoder().decode(bytes));
  return await readProjectPackage(new Blob([bytes]));
}

const result = await createStandaloneHtmlExport(await loadProject(argOf("project")), {
  fetchBytes: async (path) => new Uint8Array(readFileSync(
    path.startsWith(STANDALONE_BUNDLE_BASE)
      ? join("dist", path)
      : join("public", path),
  )),
});
const out = argOf("out") ?? `dist/${result.fileName}`;
writeFileSync(out, new Uint8Array(await result.blob.arrayBuffer()));
console.log(`파일      : ${out}`);
console.log(`크기      : ${(result.blob.size / 1048576).toFixed(2)} MB`);
console.log(`  에셋    : ${result.summary.assetCount}개`);
