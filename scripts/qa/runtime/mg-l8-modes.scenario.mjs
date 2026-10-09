import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// mg-l8 큰 모드(출하 플레이어): 옆보기 맵의 중력·걷기·점프, 조사 이벤트가 연 전술 격자 전투를 키보드만으로 이긴다.
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/mg-l8-modes-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/mg-l8-modes-fixture.mts"], {
  maxBuffer: 80 * 1024 * 1024,
}));

const START = "map_blank_start";
const SIDE = "map_side";

export default {
  id: "mg-l8-modes",
  projectFixture: fixture,
  beats: [
    { id: "boot", note: "새 게임", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "title-screen", state: "absent" },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 1 },
    ] },
    { id: "side-view-gravity", note: "옆보기 맵 공중 (3,1) 에 세우면 입력 없이 바닥 위 (3,10) 까지 떨어진다", ops: [
      { kind: "teleport", mapId: SIDE, x: 3, y: 1 },
      { kind: "waitForPosition", mapId: SIDE, x: 3, y: 10 },
    ], expect: { mapId: SIDE, x: 3, y: 10 }, shot: true },
    { id: "side-view-down-blocked", note: "아래 키로는 바닥을 뚫지 않는다(탑다운 이동이 아니다)", ops: [
      { kind: "hold", dir: "down", ms: 500 },
    ], expect: { mapId: SIDE, x: 3, y: 10 } },
    { id: "side-view-jump", note: "위 키는 점프: 두 칸 올라 (3,8) 을 지나 다시 (3,10) 에 착지한다", ops: [
      { kind: "dir", dir: "up" },
      { kind: "waitForPosition", mapId: SIDE, x: 3, y: 8 },
      { kind: "dir", dir: null },
      { kind: "waitForPosition", mapId: SIDE, x: 3, y: 10 },
    ], expect: { mapId: SIDE, x: 3, y: 10 } },
    { id: "side-view-walk", note: "오른쪽 키로 바닥을 따라 오른쪽 끝 (7,10) 까지 걷고 떨어지지 않는다", ops: [
      { kind: "dir", dir: "right" },
      { kind: "waitForPosition", mapId: SIDE, x: 7, y: 10 },
      { kind: "dir", dir: null },
    ], expect: { mapId: SIDE, x: 7, y: 10 } },
    { id: "tactics-open", note: "탑다운 시작 맵 (10,10) 에서 위의 교관을 조사하면 격자 전투가 뜬다", ops: [
      { kind: "teleport", mapId: START, x: 10, y: 10 },
      { kind: "waitForPosition", mapId: START, x: 10, y: 10 },
      { kind: "face", dir: "up" },
      { kind: "action" },
      { kind: "waitFor", testid: "tactics-battle", state: "present" },
    ], expect: { testidPresent: ["tactics-battle", "tactics-grid", "tactics-cell-0-0", "tactics-cell-3-0"] }, shot: true },
    { id: "tactics-keyboard-win", note: "결정→→결정(이동)→결정(공격)으로 슬라임을 잡으면 격자가 닫히고 승리 결과가 남는다", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitForAttr", testid: "tactics-battle", attr: "data-phase", value: "move" },
      { kind: "key", key: "ArrowRight", times: 2 },
      { kind: "key", key: "Enter" },
      { kind: "waitForAttr", testid: "tactics-battle", attr: "data-phase", value: "target" },
      { kind: "key", key: "ArrowRight" },
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "tactics-battle", state: "absent" },
    ], expect: { battleResult: "victory", testidAbsent: ["tactics-battle"] }, shot: true },
  ],
};
