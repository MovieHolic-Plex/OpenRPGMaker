/**
 * 대표 데모게임(?demo=)을 빌드 시점에 project.json 으로 굽는다.
 *
 *   npm run bake:demos [-- --out dist --only id,id]
 *
 * 왜: player.html?demo=… 는 예전에 브라우저에서 createFlagshipDemoProject 로 모든 맵을 절차 생성했다.
 * 에디터 데모 빌더(약 15MB JS)를 받고 메인 스레드를 5~130초 막았다(2026-10-23 실측, chrono-bell 134초).
 * 이제 빌드가 한 번 지어 dist/demos/ 에 두 벌을 쓴다(공용 에셋 assets/ 옆 — 플레이어는 에셋 기준 주소로 찾는다).
 *   <id>.play.json — 플레이어용. 실제 웹 내보내기와 같은 투영(prepareWebExport): 참고문서·초안 이벤트·
 *     안 쓰는 타일셋/업로드 에셋을 뺀다. 그림은 지금처럼 같은 호스트의 공용 에셋을 읽는다.
 *   <id>.project.json — 편집기용(/index.html?demo=…). 투영 없이 serialize 한 전체 프로젝트.
 * dist/export-player/ 에는 쓰지 않는다 — 그 폴더는 SDK 매니페스트가 묶는 정확한 산출물 집합이고 웹 내보내기 zip 의 원본이다.
 * createFlagshipDemoProject 는 그대로 남는다(편집기 메뉴·이 굽기·dev 서버 폴백).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { FLAGSHIP_DEMO_IDS, createFlagshipDemoProject } from "@/project/flagship";
import { serialize } from "@/project/io";
import { prepareWebExport } from "@/project/webExport";

function argOf(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

// 플레이어 번들에는 __OPRN_INSTALLED_BGM_FILES__ define 이 없어 모든 카탈로그 곡이 «설치됨»이다(installedBgm.ts).
// vite.config.ts 는 이 체크아웃 public/ 에 받은 곡만 define 하므로, 실행 스크립트가 OPRN_ASSUME_ALL_BGM_INSTALLED=1 로 끈다.
if (process.env.OPRN_ASSUME_ALL_BGM_INSTALLED !== "1") {
  throw new Error("OPRN_ASSUME_ALL_BGM_INSTALLED=1 로 실행하세요 (npm run bake:demos)");
}

const out = argOf("out") ?? "dist";
const only = argOf("only")?.split(",");
const dir = join(out, "demos");
mkdirSync(dir, { recursive: true });
const mb = (n: number) => (n / 1048576).toFixed(1);
for (const id of FLAGSHIP_DEMO_IDS) {
  if (only && !only.includes(id)) continue;
  const started = performance.now();
  const { project } = createFlagshipDemoProject(id);
  const built = performance.now();
  const player = prepareWebExport(project).projectJson;
  const editor = serialize(project);
  writeFileSync(join(dir, `${id}.play.json`), player);
  writeFileSync(join(dir, `${id}.project.json`), editor);
  console.log(`${id}: build ${((built - started) / 1000).toFixed(1)}s · player ${mb(player.length)}MB (gzip ${mb(gzipSync(player).length)}MB) · editor ${mb(editor.length)}MB · total ${((performance.now() - started) / 1000).toFixed(1)}s`);
}
