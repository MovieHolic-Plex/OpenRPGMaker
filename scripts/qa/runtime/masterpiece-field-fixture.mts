// 명작 공백 필드 키트 런타임 QA 픽스처 — 조건(G1)·문자 입력(#35)·미니게임(#1)·순간이동(#24)·클릭 이동(#32).
// 편집기 AI 도구(runTool)만으로 저작한다. stdout: 직렬화한 프로젝트 JSON. 출하·원격 저장 없음.
import { createBlankProject } from "../../../src/project/defaults";
import { isPassable } from "../../../src/project/collision";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";
import type { Command } from "../../../src/project/types";

const project = createBlankProject();
const ctx = { project };
function call(name: string, args: Record<string, unknown>) {
  const result = runTool(ctx, name, args);
  if (!result.ok) throw new Error(`${name} 실패: ${result.summary} ${JSON.stringify(result.issues ?? [])}`);
  return result;
}

call("set_project_settings", { title: "명작 공백 필드 QA" });
call("upsert_actor", { actor: { id: "actor_hero", name: "렌", learnedSkills: [] } });
call("set_party", { scope: "start", actorIds: ["actor_hero"] });

// runTool 은 ctx.project 를 새 객체로 바꾼다 — 이후 직접 편집은 ctx.project 에 한다.
const live = () => ctx.project;
// 클릭 이동은 시스템 스위치 하나다(#32).
live().system.pointerMovement = true;
const mapId = live().startMapId;
const start = live().startPos;
// 시작 칸 위쪽 이벤트: 문자 입력 → \T 대사 → 선두 레벨 조건 → 제한시간 선택지 → QTE → 최고 점수 → 순간이동 메뉴.
const oracleCommands: Command[] = [
  { kind: "enterHeroName", actorId: "", maxLength: 8, showInitialName: false, stringVariableId: "prayer", prompt: "기도문을 적어라" },
  { kind: "text", body: "기도가 닿았다: \\T[prayer]" },
  { kind: "fork", condition: { kind: "actorStat", actorId: "leader", stat: "level", op: ">=", value: 1 },
    then: [{ kind: "setSwitch", switchId: "leader_ok", value: true }] },
  { kind: "m2Command", commandId: "m2-220-timed-choice", fields: { prompt: "빨리 골라라", options: "왼쪽\n오른쪽", timeLimitMs: 8000, resultVariableId: "pick" } },
  { kind: "m2Command", commandId: "m2-221-quick-time-event", fields: { mode: "sequence", keys: "up,z", windowMs: 6000, resultVariableId: "qte", resultSwitchId: "qte_ok" } },
  { kind: "setVariable", variableId: "score", op: "=", value: 70 },
  { kind: "m2Command", commandId: "m2-222-high-score", fields: { scoreId: "shrine", action: "submit", valueVariableId: "score", resultVariableId: "best", recordSwitchId: "new_record" } },
  { kind: "m2Command", commandId: "m2-072-set-teleportation-point", fields: { mapId: "map_harbor", x: 4, y: 4, label: "항구 마을" } },
  { kind: "m2Command", commandId: "m2-223-teleport-menu", fields: { prompt: "어디로 갈까요?", resultVariableId: "where", transfer: true } },
];
call("upsert_event", { mapId, event: {
  id: "ev_oracle", x: start.x, y: start.y - 1, trigger: { kind: "action" }, commands: [],
  pages: [{ id: "ev_oracle_p1", name: "신탁", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands: oracleCommands }],
} });
// 순간이동 도착지 맵(시작 맵 복제, 이벤트 없음).
const map = live().maps[mapId]!;
live().maps.map_harbor = { ...structuredClone(map), id: "map_harbor", name: "항구 마을", events: [] };
if (!isPassable(live(), live().maps.map_harbor!, 4, 4)) throw new Error("항구 도착 칸이 막혀 있다");
if (!isPassable(live(), map, start.x + 2, start.y)) throw new Error("클릭 목적지가 막혀 있다");
process.stderr.write(JSON.stringify({ start, clickTarget: { x: start.x + 2, y: start.y } }) + "\n");
const json = serialize(ctx.project);
deserialize(json);
process.stdout.write(json);
