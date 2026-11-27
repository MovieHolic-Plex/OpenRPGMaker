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
import { join, resolve } from "node:path";
import { FLAGSHIP_DEMO_IDS, type FlagshipDemoBuildResult, type FlagshipDemoId } from "@/project/flagship/types";
import type { Project } from "@/project/types";
import { syncDemoBgm } from "./bake-demos-lib.mjs";

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
const only = argOf("only")?.split(",").filter(Boolean);
const dir = join(out, "demos");

/**
 * 데모 하나만 동적으로 불러온다. `src/project/flagship/index.ts` 배럴을 거치지 않아
 * 데모별 캐시 그래프와 워커 프로세스가 다른 데모 코드를 읽지 않는다.
 * `createFlagshipDemoProject` 의 `lockDemoOpening` 계약(skippable: false)을 그대로 적용한다.
 */
async function buildSingleDemo(id: FlagshipDemoId): Promise<FlagshipDemoBuildResult> {
  let result: FlagshipDemoBuildResult;
  switch (id) {
    case "chrono-bell": {
      const { createChronoBellFlagshipDemo } = await import("@/project/flagship/chronoBell");
      result = createChronoBellFlagshipDemo();
      break;
    }
    case "emerald-crown": {
      const { createEmeraldCrownFlagshipDemo } = await import("@/project/flagship/emeraldCrown");
      result = createEmeraldCrownFlagshipDemo();
      break;
    }
    case "shitamachi-fourth-season": {
      const { createShitamachiFourthSeasonFlagshipDemo } = await import("@/project/flagship/shitamachiFourthSeason");
      result = createShitamachiFourthSeasonFlagshipDemo();
      break;
    }
    case "first-love": {
      const { createFirstLoveFlagshipDemo } = await import("@/project/flagship/firstLove");
      result = createFirstLoveFlagshipDemo();
      break;
    }
    case "maou-konbini": {
      const { createMaouKonbiniFlagshipDemo } = await import("@/project/flagship/maouKonbini");
      result = createMaouKonbiniFlagshipDemo();
      break;
    }
    default: {
      const { createFlagshipDemoProject } = await import("@/project/flagship");
      return createFlagshipDemoProject(id);
    }
  }
  const opening = result.project.system.opening;
  if (opening && opening.skippable !== false) {
    result.project.system.opening = { ...opening, skippable: false };
  }
  return result;
}

// 캐시에서 JSON 을 복원한 경우 BGM 만 채운다. 데모 생성 모듈도 그때는 읽지 않는다.
async function bakeDemos(): Promise<void> {
  const { serialize } = await import("@/project/io");
  const { validateShippedPlayJson } = await import("@/project/flagship/ipCleanliness");
  const { demoLoreCounts, demoLoreProblems } = await import("@/project/flagship/loreKit");
  const { prepareWebExport } = await import("@/project/webExport");
  const { visitProjectCommands } = await import("@/editor/tools/commandTraversal");
  const { collectProjectItemReferenceIds } = await import("@/project/io/references");

  /** 데이터베이스에 없는 아이템·장비를 가리키는 참조. 폴른 스타가 편집기에서 「Error 2」로 보였다(2026-11-19 QA). */
  function danglingInventoryRefs(project: Project): string[] {
    const equipment = new Set(project.database.equipment.map((record) => record.id));
    const inventory = new Set([...project.database.items.map((record) => record.id), ...equipment]);
    const missing = new Set([...collectProjectItemReferenceIds(project)].filter((ref) => !inventory.has(ref)));
    visitProjectCommands(project, ({ command }) => {
      if (command.kind === "changeEquipment" && command.equipmentId && !equipment.has(command.equipmentId)) missing.add(command.equipmentId);
    });
    return [...missing];
  }

  mkdirSync(dir, { recursive: true });
  const mb = (n: number) => (n / 1048576).toFixed(1);
  for (const id of FLAGSHIP_DEMO_IDS) {
    if (only && !only.includes(id)) continue;
    const started = performance.now();
    const { project } = await buildSingleDemo(id);
    const built = performance.now();
    const player = prepareWebExport(project).projectJson;
    const editor = serialize(project);
    writeFileSync(join(dir, `${id}.play.json`), player);
    writeFileSync(join(dir, `${id}.project.json`), editor);
    // 출하 play.json 의 플레이어 글에 원작 IP 고유명이 있으면 굽기를 실패시킨다(styleLock.bannedProperNouns + 전역 + 마법 학교 원작 이름).
    const ipHits = validateShippedPlayJson(id, player);
    if (ipHits.length > 0) {
      for (const hit of ipHits) console.error(`[ip-clean] ${id}.play.json ${hit.path}: 「${hit.noun}」`);
      console.error(`[ip-clean] ${id}: 원작 고유명 ${ipHits.length}건 — 굽기 실패`);
      process.exit(1);
    }
    const dangling = danglingInventoryRefs(project);
    if (dangling.length > 0) {
      console.error(`[item-refs] ${id}: 데이터베이스에 없는 아이템·장비 참조 ${dangling.length}건 — 굽기 실패: ${dangling.join(", ")}`);
      process.exit(1);
    }
    console.log(`${id}: build ${((built - started) / 1000).toFixed(1)}s · player ${mb(player.length)}MB (gzip ${mb(gzipSync(player).length)}MB) · editor ${mb(editor.length)}MB · total ${((performance.now() - started) / 1000).toFixed(1)}s`);
    // 자료집 「이야기」(세계 개요·설정집·인물)가 비면 판매용 데모를 연 사람이 이 게임을 읽을 수 없다(2026-10-29 전 데모 0개였다).
    // 데모마다 *Lore.ts 를 빌더 끝에서 부른다. 빠지거나 하한 아래로 줄면 여기서 크게 경고한다.
    const loreProblems = demoLoreProblems(project);
    if (loreProblems.length > 0) console.warn(`[demo-lore] ${id}: 「이야기」 탭이 비었다: ${loreProblems.join(" / ")}`);
    else console.log(`  lore ${JSON.stringify(demoLoreCounts(project))}`);
  }
}

if (!process.argv.includes("--bgm-only")) await bakeDemos();

// `--no-bgm`: 입구(bake-flagship-demos.mjs)가 데모를 병렬로 구울 때 각 프로세스는 BGM 을 건너뛰고, 끝에 한 번으로 받는다.
if (!process.argv.includes("--no-bgm")) {
  const demoIds = only ? FLAGSHIP_DEMO_IDS.filter((id) => only.includes(id)) : [...FLAGSHIP_DEMO_IDS];
  await syncDemoBgm({
    root: process.cwd(),
    outDir: resolve(process.cwd(), out),
    demoIds,
    cacheDir: process.env.OPRN_BAKE_DEMOS_CACHE_DIR || null,
  });
}
