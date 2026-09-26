import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// 강하게 다시 하기(New Game+) + 장 표시 — 출하 플레이어 경로.
// 픽스처는 ct-ngplus-fixture.mts 가 편집기 도구(runTool)만으로 굽는다. 시작 (14,18) 북쪽 NPC 가
// 주인공 Lv7 · 장 변수 2 로 올린 뒤 엔딩을 부른다. NG+ 는 레벨을 들고 가고 장은 1 로 돌아가야 한다.
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/ct-ngplus-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/ct-ngplus-fixture.mts"], {
  maxBuffer: 40 * 1024 * 1024,
}));

const key = (name, times = 1) => ({ kind: "key", key: name, times });

export default {
  id: "ct-ngplus",
  projectFixture: fixture,
  beats: [
    { id: "first-title", note: "클리어 기록이 없으니 강하게 다시 하기 항목이 없다", expect: {
      testidPresent: ["title-screen", "title-new-game"], testidAbsent: ["title-new-game-plus"],
    }, shot: true },
    { id: "first-run", note: "새 게임 → 시작 칸, ESC 메뉴에 1장", ops: [
      key("Enter"), { kind: "waitFor", testid: "title-screen", state: "absent" }, { kind: "waitForRuntime" },
      { kind: "waitForPosition", mapId: "map_lantern_village", x: 14, y: 18 },
      key("Escape"), { kind: "waitForVisible", testid: "status-menu-chapter" },
    ], expect: { visibleText: { "status-menu-chapter": "1장" } }, shot: true },
    { id: "talk-to-sage", note: "메뉴를 닫고 북쪽 현자에게 말을 건다 → 대사", ops: [
      key("Escape"), { kind: "waitFor", testid: "main-menu", state: "absent" },
      { kind: "face", dir: "up" }, { kind: "action" },
      { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 15_000 },
    ], expect: { testidPresent: ["dialogue-box"] } },
    { id: "ending", note: "대사를 넘기면 엔딩 화면 → 타이틀로 돌아가기 버튼", ops: [
      { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 6 },
      { kind: "waitFor", testid: "ending-screen", state: "present", timeoutMs: 15_000 },
      { kind: "pressUntil", key: "Enter", testid: "return-title", state: "present", maxPresses: 12, timeoutMs: 4_000 },
    ], expect: { testidPresent: ["ending-screen", "return-title"] }, shot: true },
    { id: "second-title", note: "엔딩 뒤 타이틀에 강하게 다시 하기가 새 게임 다음에 생긴다", ops: [
      { kind: "pressUntil", key: "Enter", testid: "title-new-game-plus", state: "present", maxPresses: 4 },
    ], expect: {
      testidPresent: ["title-new-game", "title-new-game-plus"],
      visibleText: { "title-new-game-plus": "강하게 다시 하기" },
    }, shot: true },
    { id: "ngplus-field", note: "↓ 로 고르고 Enter → 시작 칸에서 새로 시작한다", ops: [
      key("ArrowDown"), { kind: "waitForAttr", testid: "title-new-game-plus", attr: "aria-selected", value: "true" },
      key("Enter"),
      { kind: "waitFor", testid: "title-screen", state: "absent" }, { kind: "waitForRuntime" },
      { kind: "waitForPosition", mapId: "map_lantern_village", x: 14, y: 18 },
    ], expect: { testidAbsent: ["title-screen", "ending-screen"] } },
    { id: "ngplus-menu", note: "ESC → 파티: 주인공 L7(이월), 장은 1장(이야기 상태는 넘어가지 않는다)", ops: [
      { kind: "pressUntil", key: "Escape", testid: "main-menu", state: "present", maxPresses: 4, timeoutMs: 3_000 },
      { kind: "waitForVisible", testid: "status-menu-chapter" },
      key("ArrowDown", 3), { kind: "waitForVisible", testid: "status-menu-party-row-0" },
    ], expect: {
      visibleText: { "status-menu-chapter": "1장 · 서기 1000년", "status-menu-party-row-0": "L7" },
    }, shot: true },
  ],
};
