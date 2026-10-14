// 필드 적(place_field_enemy) 런타임 게이트 — 출하 플레이어 경로.
// 시야에 들어온 순간(닿기 전) 머리 위 느낌표 + 짧은 멈춤 → 추격 → 놓치면 원래 자리로 복귀 → 다시 보면 느낌표 → 접촉 전투,
// 이기면 사라지며 맵을 나갔다 돌아와도 사라져 있다(승리 스위치 sw_ev_field_chaser_clear).
// 순찰+추격 해골은 시야 밖에서 순찰하다 시야에 들면 쫓고, 놓치면 돌아와 다시 순찰한다.
// 필드 그림은 전투 그림과 같은 종류(슬라임→슬라임 칩)이고, 대응 칩이 없는 박쥐는 슬라임으로 바꿔치지 않고 거절된다(픽스처가 단정).
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/field-enemy-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
const json = execFileSync(process.execPath, ["node_modules/vite-node/dist/cli.mjs", "--script", "scripts/qa/runtime/field-enemy-fixture.mts"], { maxBuffer: 200 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] });
writeFileSync(fixture, json);
const project = JSON.parse(String(json));
const START = project.startMapId;
const { x: SX, y: SY } = project.startPos;
const CHASER = "ev_field_chaser";
const PATCHASE = "ev_field_patchase";
const HOME = { x: SX + 7, y: SY };
const HOME_RECT = { bodyRect: { left: HOME.x, right: HOME.x, top: HOME.y, bottom: HOME.y } };
const CLEAR = "sw_ev_field_chaser_clear";
const EXCLAMATION_FRAME = 3;

const scene = (attr, value, timeoutMs = 40_000) => ({ kind: "waitForAttr", testid: "battle-scene", attr, value, timeoutMs });
const cursorTo = (testid) => ({ kind: "pressUntil", key: "ArrowDown", testid, state: "present", attr: "data-battle-command-cursor", value: "true", maxPresses: 8, timeoutMs: 1500 });

export default {
  id: "field-enemy",
  projectFixture: fixture,
  beats: [
    { id: "field", note: "새 게임: 주인공은 가운데, 박쥐는 동쪽 7칸(시야 5칸 밖)에 가만히 서 있다", ops: [
      { kind: "key", key: "Enter" },
      { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "absent", maxPresses: 40, timeoutMs: 60_000 },
      { kind: "waitForRuntime" },
      { kind: "waitFor", testid: "cinematic-sequence", state: "absent", timeoutMs: 30_000 },
      { kind: "seed", seed: 1 },
      // 오프닝 뒤 필드로 페이드인이 끝나야 입력이 열린다.
      { kind: "hold", dir: null, ms: 3500 },
    ], expect: { mapId: START, x: SX, y: SY, testidAbsent: ["title-screen", "battle-scene"], switches: { [CLEAR]: false } }, shot: true },
    { id: "sighted-emote", note: "두 칸 다가가 시야(5칸) 안에 들어선다. 닿기 전, 슬라임이 제자리에서 머리 위에 느낌표를 띄운다(아직 한 칸도 안 움직였다)", ops: [
      { kind: "dir", dir: "right" },
      { kind: "waitForPosition", mapId: START, x: SX + 2, y: SY, timeoutMs: 20_000 },
      { kind: "dir", dir: null },
      { kind: "waitForEmote", target: CHASER, frame: EXCLAMATION_FRAME, timeoutMs: 20_000 },
    ], expect: { mapId: START, emoteTargets: [{ target: CHASER, frame: EXCLAMATION_FRAME }], eventRects: { [CHASER]: HOME_RECT }, testidAbsent: ["battle-scene"] }, shot: true },
    { id: "chase-leaves-home", note: "멈춤(0.7초)이 끝나면 쫓아 나온다 — 주인공은 왼쪽 끝으로 달아난다", ops: [
      { kind: "dir", dir: "left" },
      { kind: "waitForEventAt", eventId: CHASER, mapId: START, x: HOME.x, y: HOME.y, not: true, timeoutMs: 20_000 },
    ], expect: { mapId: START, testidAbsent: ["battle-scene"] }, shot: true },
    { id: "lost-then-returns-home", note: "시야 밖으로 벗어나면 슬라임은 마지막 목격 자리를 뒤지다 원래 자리로 돌아가 선다", ops: [
      { kind: "waitForPosition", mapId: START, x: 1, y: SY, timeoutMs: 20_000 },
      { kind: "dir", dir: null },
      { kind: "waitForEventAt", eventId: CHASER, mapId: START, x: HOME.x, y: HOME.y, timeoutMs: 40_000 },
      { kind: "hold", dir: null, ms: 600 },
    ], expect: { mapId: START, eventRects: { [CHASER]: HOME_RECT }, testidAbsent: ["battle-scene"], switches: { [CLEAR]: false } }, shot: true },
    { id: "sighted-again", note: "다시 시야에 들어서면 느낌표를 또 띄운다(놓친 뒤에는 새 발견으로 센다)", ops: [
      { kind: "dir", dir: "right" },
      { kind: "waitForPosition", mapId: START, x: SX + 2, y: SY, timeoutMs: 30_000 },
      { kind: "dir", dir: null },
      { kind: "waitForEmote", target: CHASER, frame: EXCLAMATION_FRAME, timeoutMs: 20_000 },
    ], expect: { mapId: START, emoteTargets: [{ target: CHASER, frame: EXCLAMATION_FRAME }], testidAbsent: ["battle-scene"] }, shot: true },
    { id: "battle-opens", note: "쫓아온 슬라임이 닿으면 전투가 열린다(접촉 트리거) — 전투 적도 필드와 같은 슬라임", ops: [
      { kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 20_000 },
      { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40_000 },
    ], expect: { testidPresent: ["battle-scene", "enemy-1"] }, shot: true },
    { id: "victory-erases", note: "한 방에 쓰러뜨린다 — 전투가 닫히고 처치 스위치가 켜진다", ops: [
      scene("data-battle-sequence-busy", "false"),
      cursorTo("actor-command-attack"),
      { kind: "key", key: "z" },
      { kind: "waitFor", testid: "battle-target-prompt", state: "present", timeoutMs: 10_000 },
      { kind: "key", key: "z" },
      { kind: "pressUntil", key: "z", testid: "battle-scene", state: "absent", maxPresses: 30, timeoutMs: 60_000 },
      // 전투 막이 걷히고 승리 분기(처치 스위치)가 도는 것까지 기다린다.
      { kind: "hold", dir: null, ms: 3000 },
    ], expect: { mapId: START, battleResult: "victory", switches: { [CLEAR]: true }, testidAbsent: ["battle-scene"] }, shot: true },
    { id: "leave-and-return", note: "둘째 맵(순찰·보초 박쥐가 있는 곳)으로 나갔다가 시작 맵으로 돌아온다", ops: [
      { kind: "teleport", mapId: "map_field_two", x: 3, y: 3 },
      { kind: "waitForPosition", mapId: "map_field_two", x: 3, y: 3 },
      { kind: "hold", dir: null, ms: 600 },
    ], expect: { mapId: "map_field_two" }, shot: true },
    { id: "still-cleared", note: "돌아온 시작 맵에는 박쥐가 없다(승리 스위치가 살아 있다)", ops: [
      { kind: "teleport", mapId: START, x: SX + 4, y: SY },
      { kind: "waitForPosition", mapId: START, x: SX + 4, y: SY },
      { kind: "hold", dir: null, ms: 1500 },
    ], expect: { mapId: START, x: SX + 4, y: SY, switches: { [CLEAR]: true }, testidAbsent: ["battle-scene"] }, shot: true },
    { id: "patrol-chase-sights", note: "둘째 맵: 순찰+추격 해골의 순찰 경로 곁(8,11)에 선다 — 시야에 든 순간 머리 위 느낌표", ops: [
      { kind: "teleport", mapId: "map_field_two", x: 8, y: 11 },
      { kind: "waitForPosition", mapId: "map_field_two", x: 8, y: 11 },
      { kind: "waitForEmote", target: PATCHASE, frame: EXCLAMATION_FRAME, timeoutMs: 20_000 },
    ], expect: { mapId: "map_field_two", emoteTargets: [{ target: PATCHASE, frame: EXCLAMATION_FRAME }], testidAbsent: ["battle-scene"] }, shot: true },
    { id: "patrol-chase-returns-and-patrols", note: "주인공이 멀리 사라지면(15,13) 해골은 놓친 자리를 뒤지다 출발 칸(5,11)으로 돌아오고, 다시 순찰을 시작한다", ops: [
      { kind: "teleport", mapId: "map_field_two", x: 15, y: 13 },
      { kind: "waitForPosition", mapId: "map_field_two", x: 15, y: 13 },
      { kind: "waitForEventAt", eventId: PATCHASE, mapId: "map_field_two", x: 5, y: 11, timeoutMs: 40_000 },
      { kind: "waitForEventAt", eventId: PATCHASE, mapId: "map_field_two", x: 5, y: 11, not: true, timeoutMs: 20_000 },
    ], expect: { mapId: "map_field_two", testidAbsent: ["battle-scene"] }, shot: true },
    { id: "guard-bump", note: "둘째 맵: 보초 박쥐(15,4) 왼쪽 칸에서 오른쪽으로 부딪히면 느낌표 뒤 전투가 열린다(정지형 접촉)", ops: [
      { kind: "teleport", mapId: "map_field_two", x: 13, y: 4 },
      { kind: "waitForPosition", mapId: "map_field_two", x: 13, y: 4 },
      { kind: "dir", dir: "right" },
      { kind: "waitForPosition", mapId: "map_field_two", x: 14, y: 4, timeoutMs: 20_000 },
      { kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 30_000 },
      { kind: "dir", dir: null },
      { kind: "waitFor", testid: "actor-command-escape", state: "present", timeoutMs: 40_000 },
    ], expect: { testidPresent: ["battle-scene", "enemy-1"] }, shot: true },
    { id: "escape-then-stun", note: "도망친다 — 박쥐는 바로 옆에 있지만 몇 초 기절해 같은 전투가 곧바로 다시 열리지 않는다", ops: [
      scene("data-battle-sequence-busy", "false"),
      { kind: "pressUntil", key: "ArrowDown", testid: "actor-command-escape", state: "present", attr: "data-battle-command-cursor", value: "true", maxPresses: 8, timeoutMs: 1500 },
      { kind: "key", key: "z" },
      // 「후퇴」 결과 창의 확인을 넘긴다.
      { kind: "pressUntil", key: "z", testid: "battle-scene", state: "absent", maxPresses: 20, timeoutMs: 60_000 },
      { kind: "hold", dir: null, ms: 1200 },
      // 기절 중에 다시 부딪혀 본다.
      { kind: "dir", dir: "right" },
      { kind: "hold", dir: null, ms: 900 },
      { kind: "dir", dir: null },
    ], expect: { mapId: "map_field_two", x: 14, y: 4, battleResult: "escape", testidAbsent: ["battle-scene"], switches: { sw_ev_field_guard_clear: false } }, shot: true },
    { id: "stun-ends", note: "기절이 풀린 뒤 다시 부딪히면 전투가 다시 열린다(도망은 소멸이 아니다)", ops: [
      { kind: "hold", dir: null, ms: 3600 },
      { kind: "dir", dir: "right" },
      { kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 30_000 },
      { kind: "dir", dir: null },
    ], expect: { testidPresent: ["battle-scene"] }, shot: true },
  ],
};
