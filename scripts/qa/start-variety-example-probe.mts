// 「예제로 시작」 시작 마을이 제목마다 다른지 — 예제 시작 시드를 제목 6개로 만들어 렌더한다.
//   bun scripts/qa/start-variety-example-probe.mts [--out output/evidence/start-variety]
import fs from "node:fs";
import { renderMapPng } from "../qa-game/render.mts";
import { createProjectStartSeed } from "../../src/editor/projectStartSeed.ts";
import { planStart, startSeedText } from "../../src/project/startVariety.ts";
const i = process.argv.indexOf("--out");
const OUT = i >= 0 ? process.argv[i + 1]! : "output/evidence/start-variety";
fs.mkdirSync(OUT, { recursive: true });
const cases: [string, "adventure-jrpg" | "story-cutscene"][] = [["바람이 머무는 마을", "adventure-jrpg"], ["달빛 우체국", "story-cutscene"], ["은퇴한 용사의 이삿짐센터", "adventure-jrpg"], ["골목 끝 찻집", "story-cutscene"], ["등대지기의 편지", "adventure-jrpg"], ["여름방학 마지막 날", "story-cutscene"]];
const rows: unknown[] = [];
for (const [title, id] of cases) {
  const seed = planStart({ seedText: startSeedText(undefined, title) }).seed;
  try {
    const project = await createProjectStartSeed(id, title, "example");
    const start = project.maps[project.startMapId]!;
    fs.writeFileSync(`${OUT}/example-${rows.length}.png`, renderMapPng(project, start).png);
    rows.push({ title, genre: id, seed, size: [start.width, start.height], file: `example-${rows.length}.png` });
    console.log(title, seed, start.width, start.height, "ok");
  } catch (e) { rows.push({ title, seed, error: String((e as Error).message) }); console.log(title, seed, "FAIL", (e as Error).message); }
}
fs.writeFileSync(`${OUT}/example-report.json`, JSON.stringify(rows, null, 1));
