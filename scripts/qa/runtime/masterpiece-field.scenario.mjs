import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// 명작 공백 필드 키트(2026-09-27) — 출하 플레이어(player.html)로 본다.
// 한 이벤트가 차례로: 문자열 변수 문자 입력(#35) → \T[id] 대사 → 선두 레벨 조건(#2) → 제한시간 선택지(#1)
// → QTE(#1) → 최고 점수(#1) → 순간이동 지점 기록·메뉴(#24). 마지막은 클릭(탭) 이동(#32).
// 증거는 세션 변수·스위치(readState) · 대사 글자 · 순간이동 뒤 맵 id · 클릭 뒤 좌표다.
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/masterpiece-field-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/masterpiece-field-fixture.mts"], { maxBuffer: 80 * 1024 * 1024 }));

export default {
  id: "masterpiece-field",
  projectFixture: fixture,
  beats: [
    { id: "field", note: "새 게임 → 필드", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitForRuntime" },
    ], expect: { testidAbsent: ["title-screen"] } },
    { id: "string-entry", note: "신탁 조사 → 문자열 변수로 받는 문자 입력(안내 문구 = prompt)", ops: [
      { kind: "face", dir: "up" },
      { kind: "action" },
      { kind: "waitForVisible", testid: "runtime-name-entry", timeoutMs: 20_000 },
      { kind: "key", key: "L" }, { kind: "key", key: "U" }, { kind: "key", key: "X" },
    ], expect: { testidPresent: ["runtime-name-entry"], visibleText: { "runtime-name-entry": "기도문을 적어라" } }, shot: true },
    { id: "string-dialogue", note: "Enter 확정 → 대사가 \\T[prayer] 를 LUX 로 찍는다", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "runtime-name-entry", state: "absent", timeoutMs: 10_000 },
      { kind: "waitForVisible", testid: "dialogue-box", timeoutMs: 10_000 },
      // 첫 z 는 타이핑을 끝까지 보인다(대사를 넘기지 않는다).
      { kind: "key", key: "z" },
    ], expect: { visibleText: { "dialogue-box": "LUX" } }, shot: true },
    { id: "timed-choice", note: "대사 넘김 → 선두 레벨 조건 스위치 → 제한시간 막대가 달린 선택지", ops: [
      { kind: "pressUntil", key: "z", testid: "runtime-timed-choice-bar", state: "present", maxPresses: 8, timeoutMs: 1_500 },
      { kind: "waitForVisible", testid: "runtime-choices", timeoutMs: 5_000 },
    ], expect: { testidPresent: ["runtime-timed-choice-bar", "runtime-choices"], switches: { leader_ok: true } }, shot: true },
    { id: "qte", note: "두 번째(오른쪽) 선택 → QTE 오버레이(↑ Z)", ops: [
      { kind: "key", key: "ArrowDown" },
      { kind: "key", key: "z" },
      { kind: "waitForVisible", testid: "runtime-qte", timeoutMs: 5_000 },
    ], expect: { testidPresent: ["runtime-qte"], variables: { pick: 2 } }, shot: true },
    { id: "teleport-menu", note: "↑ Z 성공 → 최고 점수 70 기록 → 방문지 순간이동 메뉴", ops: [
      { kind: "key", key: "ArrowUp" },
      { kind: "key", key: "z" },
      { kind: "waitFor", testid: "runtime-qte", state: "absent", timeoutMs: 5_000 },
      { kind: "waitForVisible", testid: "runtime-choices", timeoutMs: 5_000 },
    ], expect: {
      visibleText: { "runtime-choices": "항구 마을" },
      variables: { qte: 1, best: 70 },
      switches: { qte_ok: true, new_record: true },
    }, shot: true },
    { id: "teleported", note: "항구 마을 선택 → 그 지점으로 이동", ops: [
      { kind: "key", key: "z" },
      { kind: "waitForPosition", mapId: "map_harbor", x: 4, y: 4, timeoutMs: 15_000 },
    ], expect: { variables: { where: 1 } }, shot: true },
    { id: "click-move", note: "시작 맵으로 돌아가 오른쪽 두 칸을 클릭 → 경로 탐색으로 걸어간다", ops: [
      { kind: "teleport", mapId: "map_blank_start", x: 10, y: 8 },
      { kind: "waitForPosition", mapId: "map_blank_start", x: 10, y: 8, timeoutMs: 10_000 },
      { kind: "clickTile", x: 12, y: 8 },
      // 런타임이 스스로 적는 클릭 영수증 — "walking:12,8" 이면 경로가 섰다.
      { kind: "waitForAttr", testid: "play-stage", attr: "data-pointer-move", value: "walking:12,8", timeoutMs: 5_000 },
      { kind: "waitForPosition", mapId: "map_blank_start", x: 12, y: 8, timeoutMs: 10_000 },
    ], expect: { testidAbsent: ["runtime-choices"] }, shot: true },
  ],
};
