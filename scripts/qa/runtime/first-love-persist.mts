// 『첫사랑』 데모 프로젝트가 SQLite 정본(project.sqlite + assets/)에 저장되고, 별도 핸들로 다시 열었을 때 같은 문서로 읽히는지 본다.
// 픽스처(first-love-fixture.mts 가 만든 JSON)를 임시 폴더에 저장한다 — 정본·LegacyDb 는 건드리지 않는다.
//
//   npx vite-node --script scripts/qa/runtime/first-love-persist.mts --fixture .omo/flf/fl-gameNN.json --dir /tmp/fl-persist
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { initLocalProjectStore } from "../../../electron/local-store/store";
import { deserialize, serialize } from "@/project/io";

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const fixture = arg("--fixture", ".omo/runtime-qa/first-love/game.json");
const dir = arg("--dir", "/tmp/fl-persist");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const project = deserialize(readFileSync(fixture, "utf8"));
const first = await initLocalProjectStore({ projectDir: dir });
const saved = await first.saveProject(project);
if (saved.kind !== "saved") throw new Error(`저장이 수락되지 않음: ${saved.kind}`);
const second = await initLocalProjectStore({ projectDir: dir });
const snapshot = second.loadSnapshot();
if (!snapshot) throw new Error("다시 연 저장소에 프로젝트가 없다");
const reloaded = snapshot.project;
const before = serialize(project), after = serialize(reloaded);
const maps = Object.keys(reloaded.maps).length;
const endings = Object.keys((reloaded as { endings?: object }).endings ?? {}).length;
console.log(JSON.stringify({ dir, projectId: second.projectId, saved: saved.kind, sha256: snapshot.sha256, revision: snapshot.revision, maps, endings, title: reloaded.meta.title, identical: before === after }, null, 2));
if (before !== after) process.exitCode = 1;
