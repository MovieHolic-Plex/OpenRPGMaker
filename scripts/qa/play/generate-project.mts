// 게임 카탈로그(scripts/qa/play/games.json)의 게임 하나를 **제품과 같은 코드 경로**로 만들어 낸다.
//
// 왜 .mts 인가: 게임 빌더는 src/ 의 TS 모듈이고, 그 모듈들은 @/ 별칭과 .css import 를 쓴다.
// 저장소가 이미 쓰는 실행기(tsx + css-stub)를 그대로 쓴다 — 그래서 빌드 결과가 에디터가 만드는
// 프로젝트와 같다(손으로 JSON 을 흉내 내지 않는다).
//
// 사용: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs \
//         scripts/qa/play/generate-project.mts <gameId> <outDir>
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { serialize } from "../../../src/project/io";
import type { Project } from "../../../src/project/types";

const [gameId, outDir] = process.argv.slice(2);
if (!gameId || !outDir) throw new Error("사용: generate-project.mts <gameId> <outDir>");

type Built = { project: Project; serialized?: string };

async function flagship(id: "chrono-bell" | "emerald-crown" | "first-love" | "shitamachi-fourth-season"): Promise<Built> {
  const { createFlagshipDemoProject } = await import("../../../src/project/flagship/index");
  const built = createFlagshipDemoProject(id);
  return { project: built.project, serialized: built.serialized };
}

async function startSeed(choice: string): Promise<Built> {
  const { createProjectStartSeed } = await import("../../../src/editor/projectStartSeed");
  const { START_EXAMPLE_DETAILS } = await import("../../../src/start/projectStart");
  // 제품과 같은 분기: 시작 예제가 있는 장르만 example, 나머지는 빈 시작(blank).
  const mode = (START_EXAMPLE_DETAILS as Record<string, unknown>)[choice] ? "example" : "blank";
  const project = await createProjectStartSeed(choice as never, `QA ${choice}`, mode as never, "wide");
  return { project };
}

const builders: Record<string, () => Promise<Built>> = {
  "fallen-star": () => flagship("chrono-bell"),
  "astra-horizon": () => flagship("emerald-crown"),
  "first-love": () => flagship("first-love"),
  "shitamachi-fourth-season": () => flagship("shitamachi-fourth-season"),
  "scarloxy-demo": async () => {
    const { createScarloxyDemoProject } = await import("../../../src/project/defaults/defaultProject");
    return { project: createScarloxyDemoProject() };
  },
  "monster-expedition": async () => {
    const { createMonsterExpedition } = await import("../../../src/project/examples/monsterExpedition/index");
    // 본래 90맵·60종 캠페인이다. QA 는 한 구간만 보면 되므로 앞에서부터 잘라 만든다(빌드 시간·크기).
    const built = createMonsterExpedition({ gymCount: 1, speciesCount: 8 });
    return { project: built.project, serialized: built.serialized };
  },
  "preset-adventure-jrpg": () => startSeed("adventure-jrpg"),
  "preset-monster-collect": () => startSeed("monster-collect"),
  "preset-farm-life": () => startSeed("farm-life"),
  "preset-story-cutscene": () => startSeed("story-cutscene"),
  "preset-horror-gallery": () => startSeed("horror-gallery"),
  "preset-school-horror": () => startSeed("school-horror"),
  "preset-action-rpg": () => startSeed("action-rpg"),
  "preset-partner-raise": () => startSeed("partner-raise"),
};

const build = builders[gameId];
if (!build) throw new Error(`카탈로그에 없는 생성기: ${gameId} (있는 것: ${Object.keys(builders).join(", ")})`);

const built = await build();
await mkdir(outDir, { recursive: true });
const json = built.serialized ?? serialize(built.project);
await writeFile(join(outDir, "project.json"), json);
const project = built.project;
process.stdout.write(`${JSON.stringify({
  id: gameId,
  title: project.meta.title,
  startMapId: project.startMapId,
  startPos: project.startPos,
  maps: Object.keys(project.maps).length,
  bytes: json.length,
})}\n`);
