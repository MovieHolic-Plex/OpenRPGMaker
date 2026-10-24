// 폴른 스타 story2 — 구운 프로젝트를 정본 저장소(project.sqlite)에 저장하고 다시 열어 바뀐 것이 남았는지 본다. (진단 전용)
//   node --max-old-space-size=12000 node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/fallen-story2.verify.mts <project.json> <storeDir>
import { readFileSync, rmSync, mkdirSync } from "node:fs";
import { deserialize, serialize } from "@/project/io";
import { initLocalProjectStore, openLocalProjectStore } from "../../../electron/local-store/store";

const [projectArg, dirArg] = process.argv.slice(2);
if (!projectArg || !dirArg) throw new Error("usage: fallen-story2.verify.mts <project.json> <storeDir>");
const project = deserialize(readFileSync(projectArg, "utf8"));
rmSync(dirArg, { recursive: true, force: true });
mkdirSync(dirArg, { recursive: true });
const store = await initLocalProjectStore({ projectDir: dirArg });
const saved = await store.saveSerialized(serialize(project));
store.close();
const reopened = await openLocalProjectStore({ projectDir: dirArg });
const snap = reopened.loadSnapshot();
reopened.close();
if (!snap) throw new Error("reload: 저장소가 비었다");
const p = snap.project;
const text = JSON.stringify(p.maps);
const checks: Record<string, boolean> = {
  joinChoice: text.includes("이리스를 데려갈까?") && text.includes("여기 숨어 있는 게 안전해"),
  hanelForeshadow: text.includes("누가 타고 있었다는 거예요?"),
  bramForeshadow: text.includes("안에 누가 있어."),
  hanelMeetsIris: text.includes("너희가 숲에서 찾은 별이냐"),
  valenF5: text.includes("나는 그 집에 있었다"),
  valenF6: text.includes("삼십 년 전에도 그랬다"),
  smokeExit: text.includes("easyrpg-sound-fog1") && text.includes("연기가 걷혔을 때"),
  fanaticTroops: ["troop_fs_fanatics", "troop_fs_fanatic_sermon", "troop_fs_fanatic_cell"].every((t) => p.database.troops.some((x) => x.id === t) && text.includes(`"${t}"`)),
  fanaticEnemies: p.database.enemies.some((e) => e.id === "enemy_fs_fanatic" && e.monsterResourceId === "charset-battler-actor3-2"),
  scoldHanel: text.includes("그 서랍은 열지 않는 게 좋다"),
  scoldRino: text.includes("\"물러서라!\""),
  scoldValen: text.includes("쥐가 한 마리 있군"),
  scoldAnvil: text.includes("읽은 게냐. 읽어도 된다"),
  elderDusk: text.includes("등을 하나 띄우시지"),
};
let loot = 0, boxes = 0;
for (const map of Object.values(p.maps)) for (const e of map.events) {
  if (!String(e.id).startsWith("ev_fs_box_") && !String(e.id).startsWith("ev_fs_cache_")) continue;
  boxes += 1;
  if (/"kind":"change(Gold|Item)","(itemId|op)/.test(JSON.stringify(e.pages?.[0]?.commands ?? [])) && /"op":"\+="/.test(JSON.stringify(e.pages?.[0]?.commands ?? []))) loot += 1;
}
console.log(JSON.stringify({ saved: saved.kind, revision: snap.revision, sha: snap.sha256.slice(0, 12), projectId: p.meta?.title, maps: Object.keys(p.maps).length, boxes, lootBoxes: loot, checks }, null, 1));
if (Object.values(checks).some((v) => !v)) process.exitCode = 1;
