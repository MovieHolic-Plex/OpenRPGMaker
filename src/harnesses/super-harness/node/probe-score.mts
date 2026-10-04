// 조수 시험 채점 — qa:game gen 한 판의 결과 폴더를 읽어 새 맵 그림과 숫자를 남긴다.
//
//   bun src/harnesses/super-harness/node/probe-score.mts --run <qa-runs/…> [--out <폴더>]
//
// 숫자: 새 맵 수 · 장치 그림만 있고 이벤트 없는 칸 · 이벤트 종류별 수 · 배치 품질 수리 턴이 돌았나 ·
// 실패한 도구 호출 · 개념 카드 노트가 실제로 붙었나.
import fs from "node:fs";
import path from "node:path";
import { deserialize } from "../../../project/io.ts";
import { eventCounts, gimmicksWithoutEvents, renderAnnotated } from "./lib.mts";

const argv = process.argv.slice(2);
const arg = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const run = arg("run");
if (!run) { console.error("사용법: --run <qa-runs 폴더>"); process.exit(2); }
const out = arg("out") ?? path.join(run, "score");
fs.mkdirSync(out, { recursive: true });

const read = (file: string) => fs.existsSync(path.join(run, file)) ? fs.readFileSync(path.join(run, file), "utf8") : "";
const seed = read("seed.json") ? deserialize(read("seed.json")) : null;
const project = read("project.json") ? deserialize(read("project.json")) : null;
const events = read("events.ndjson").split("\n").filter(Boolean).map((line) => { try { return JSON.parse(line).event ?? {}; } catch { return {}; } });
const calls = read("tools.jsonl").split("\n").filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return {}; } });

const maps = project && seed ? Object.values(project.maps).filter((map) => !seed.maps[map.id]) : [];
const mapReports = maps.map((map) => {
  const file = path.join(out, `${map.id}.png`);
  renderAnnotated(project!, map, file);
  return { mapId: map.id, name: map.name, width: map.width, height: map.height, tilesetId: map.tilesetId, png: path.relative(run, file), events: eventCounts(map), gimmicksWithoutEvents: gimmicksWithoutEvents(map).length };
});
const layoutRepair = events.some((e) => e.type === "execution_status" && e.name === "layout_quality" && e.ok === false);
const conceptNote = read("classification.json").includes("[개념 카드");
const score = {
  finished: Boolean(project),
  newMaps: mapReports.length,
  gimmicksWithoutEvents: mapReports.reduce((sum, m) => sum + m.gimmicksWithoutEvents, 0),
  events: mapReports.reduce((sum, m) => sum + Object.values(m.events).reduce((a, b) => a + b, 0), 0),
  layoutRepair,
  toolCalls: calls.length,
  toolFailures: calls.filter((c) => c.ok === false).length,
  conceptNote,
  maps: mapReports,
};
fs.writeFileSync(path.join(out, "score.json"), JSON.stringify(score, null, 2));
console.log(JSON.stringify({ ...score, maps: undefined }));
