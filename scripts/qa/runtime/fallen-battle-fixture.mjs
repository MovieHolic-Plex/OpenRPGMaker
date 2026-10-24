// 폴른 스타 전투 QA 픽스처 — 구운 play.json 에 「이 트룹과 바로 싸우는」 숲 이벤트를 트룹마다 하나씩 붙인다.
// 체크포인트(checkpoints/fallen-battle.json)가 startEventId 로 그 이벤트를 띄워 타이틀·걷기 없이 전투에서 시작한다.
//   npm run bake:demos -- --out /tmp/fsb --only chrono-bell
//   node scripts/qa/runtime/fallen-battle-fixture.mjs /tmp/fsb/demos/chrono-bell.play.json
//   QA_RECORD_VIDEO=verify-shots/fs-battle/video npm run qa:runtime -- --scenario checkpoints --checkpoint-set fallen-battle --checkpoint all
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const source = process.argv[2] ?? "/tmp/fsb/demos/chrono-bell.play.json";
const out = resolve(REPO_ROOT, process.argv[3] ?? ".omo/fs-battle/fixture.json");
const project = JSON.parse(await readFile(source, "utf8"));
// 숲이 여섯 맵으로 나뉜 뒤(#3332)에는 어귀(fs_forest_edge)에, 예전 한 장 숲이면 fs_forest 에 단다.
const forestId = project.maps.fs_forest_edge ? "fs_forest_edge" : "fs_forest";
const forest = project.maps[forestId];
if (!forest) throw new Error("숲 맵이 없다");
const troops = Array.isArray(project.database.troops) ? project.database.troops : Object.values(project.database.troops);
const events = Array.isArray(forest.events) ? forest.events : Object.values(forest.events);
let added = 0;
for (const troop of troops) {
  if (!troop.id.startsWith("troop_fs_")) continue;
  const id = `qa_fight_${troop.id.slice("troop_fs_".length)}`;
  const page = {
    id: `${id}_page`, name: id, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below",
    overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "battleProcessing", troopId: troop.id, canEscape: true, canLose: true }],
  };
  const event = { id, x: 1, y: 1 + added, trigger: { kind: "action" }, commands: [], pages: [page] };
  const at = events.findIndex((e) => e.id === id);
  if (at >= 0) events[at] = event; else events.push(event);
  added += 1;
}
forest.events = Array.isArray(forest.events) ? events : Object.fromEntries(events.map((e) => [e.id, e]));
// 숲을 걷다 우연히 다른 전투가 끼지 않게 한다.
forest.encounterRate = 0;
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(project));
console.log(JSON.stringify({ out, map: forestId, fights: added }));
