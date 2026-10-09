// OPRN-OUT-013 — 출하 플레이어(Test Play) 도착 증거용 **테스트 전용** 픽스처.
//
// 저작 콘텐츠가 아니다: 앱에 싣는 데모/예제 게임이 아니라 계약 검증용 최소 맵이고,
// 원격 저장 경로를 타지 않는다(루트 AGENTS.md 의 「단위 테스트용 최소 fixture」 예외).
//
// 무엇을 증명하려는가:
//   1. **변수 좌표**로 실제로 걸어가 도착한다(도착 스위치 + 결과 변수 = 0).
//   2. **맵 밖 변수 값**은 (0,0) 이 아니라 outOfBounds(3) 로 실패하고, 대기가 풀려
//      다음 명령이 실행된다.
//   3. **막힌 목적지**는 blocked(4) 로 구별되고 역시 대기가 풀린다.
//   4. **없는 변수**는 invalidInput(1) 이고, 「실패하면 중단」이면 뒤 명령이 안 돈다.
//      (소수/음수는 `setVariable` 이 clampVariableValue 로 잘라내므로 저작 경로로는 만들 수
//      없다 — 그 경우들은 유닛 테스트가 해석기 수준에서 직접 잰다.)
import fs from "node:fs";
import { createBlankProject, TILE } from "../src/project/defaults.ts";
import { deserialize, serialize } from "../src/project/io.ts";
import type { Command, GameEvent, M2CommandFields, Project } from "../src/project/types.ts";

const OUT = ".omo/evidence/oprn-013";
fs.mkdirSync(OUT, { recursive: true });

function move(fields: M2CommandFields): Command {
  return { kind: "m2Command", commandId: "m2-205-pathfind-move", fields };
}

function autoEvent(id: string, x: number, y: number, commands: Command[]): GameEvent {
  return {
    id, x, y, trigger: { kind: "auto" }, commands: [],
    pages: [{
      id: `${id}-page`, name: id, conditions: [], graphic: {},
      trigger: { kind: "auto" }, priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands,
    }],
  };
}

function build(): Project {
  const project = createBlankProject();
  project.name = "Coordinate move contract";
  project.meta = { ...project.meta, title: "Coordinate move contract" };
  // 타이틀 화면이 읽는 값은 system.titleScreen.title 이다(meta.title 이 아니다).
  project.system = {
    ...project.system,
    titleScreen: { ...project.system.titleScreen, title: "Coordinate move contract" },
  };
  const map = project.maps[project.startMapId]!;
  map.name = "Coordinate move contract";
  map.lowerTiles.fill(TILE.GRASS);
  map.upperTiles.fill(-1);
  // 목적지 (9,5) 를 네 방향 물로 감싼다 → 그 칸으로 가는 길이 없다(blocked/unreachable 구분용).
  for (const [x, y] of [[8, 5], [10, 5], [9, 4], [9, 6]] as const) {
    map.lowerTiles[y * map.width + x] = TILE.WATER;
  }
  project.variables = [
    ...project.variables,
    { id: "cm_x", name: "목표 X" },
    { id: "cm_y", name: "목표 Y" },
    { id: "cm_result", name: "이동 결과" },
  ];
  project.switches = [
    ...project.switches,
    { id: "cm_arrived", name: "도착함" },
    { id: "cm_stage_done", name: "단계 완료" },
    { id: "cm_after_stop", name: "중단 뒤 실행됨" },
  ];

  const resultSinks = { resultVariableId: "cm_result", resultSwitchId: "cm_arrived" };
  map.events = [autoEvent("contract", 1, 0, [
    { kind: "text", body: "STAGE 1 VARIABLE" },
    // 1) 변수 좌표로 실제 보행 → 도착.
    { kind: "setVariable", variableId: "cm_x", op: "=", value: 6 },
    { kind: "setVariable", variableId: "cm_y", op: "=", value: 5 },
    move({
      target: "player", xSource: "variable", xVariableId: "cm_x",
      ySource: "variable", yVariableId: "cm_y", speed: 5, wait: true, ...resultSinks,
    }),
    { kind: "text", body: "STAGE 1 ARRIVED" },

    // 2) 맵 밖 변수 값 → outOfBounds(3). (0,0) 으로 떨어지지 않고 대기가 풀린다.
    { kind: "text", body: "STAGE 2 OUT OF BOUNDS" },
    { kind: "setVariable", variableId: "cm_x", op: "=", value: 9999 },
    move({
      target: "player", xSource: "variable", xVariableId: "cm_x",
      ySource: "variable", yVariableId: "cm_y", speed: 5, wait: true, ...resultSinks,
    }),
    { kind: "text", body: "STAGE 2 CONTINUED" },

    // 3) 길이 없는 목적지 → 대기가 풀리고 결과가 남는다.
    { kind: "text", body: "STAGE 3 WALLED" },
    { kind: "setVariable", variableId: "cm_x", op: "=", value: 9 },
    move({
      target: "player", xSource: "variable", xVariableId: "cm_x",
      ySource: "variable", yVariableId: "cm_y", speed: 5, wait: true, ...resultSinks,
    }),
    { kind: "text", body: "STAGE 3 CONTINUED" },

    // 4) 프로젝트에 없는 변수 + 「실패하면 중단」 → invalidInput(1) 이고 뒤 명령이 돌지 않는다.
    { kind: "text", body: "STAGE 4 MISSING VARIABLE" },
    { kind: "setSwitch", switchId: "cm_stage_done", value: true },
    move({
      target: "player", xSource: "variable", xVariableId: "cm_absent",
      ySource: "variable", yVariableId: "cm_y", speed: 5, wait: true,
      onFailure: "stop", ...resultSinks,
    }),
    { kind: "setSwitch", switchId: "cm_after_stop", value: true },
    { kind: "text", body: "STAGE 4 SHOULD NOT APPEAR" },
  ])];
  return project;
}

const project = deserialize(serialize(build()));
fs.writeFileSync(`${OUT}/runtime-project.json`, serialize(project));
console.log("Prepared and reloaded the test-only coordinate-move player fixture.");
