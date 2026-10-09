import { runTool } from "@/editor/tools";
import { createBlankProject, TILE } from "@/project/defaults";
import type { Project } from "@/project/types";

export const HORROR_FLAG_SWITCH = "sw_horror_truth";
export const HORROR_SCORE_VARIABLE = "var_horror_score";
export const HORROR_TRUE_ENDING = "ending_horror_true";
export const HORROR_BAD_ENDING = "ending_horror_bad";

export function createHorrorPhase3Fixture(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("start map missing");
  map.name = "체크포인트 트랩 방";
  map.width = 8;
  map.height = 6;
  map.lowerTiles = Array.from({ length: map.width * map.height }, () => TILE.GRASS);
  map.upperTiles = Array.from({ length: map.width * map.height }, () => TILE.EMPTY);
  map.events = [];
  project.startPos = { x: 2, y: 2 };
  project.switches.push({ id: HORROR_FLAG_SWITCH, name: "진실을 봄" });
  project.variables.push({ id: HORROR_SCORE_VARIABLE, name: "공포 점수" });
  project.session.switches[HORROR_FLAG_SWITCH] = false;
  project.session.variables[HORROR_SCORE_VARIABLE] = 0;

  const ctx = { project };
  const trapResult = runTool(ctx, "place_trap", {
    mapId: map.id,
    cells: [{ x: 3, y: 2 }, { x: 5, y: 2 }],
    trigger: "touch",
    message: "발밑에서 차가운 손이 올라왔다.",
    respawnCheckpoint: true,
  });
  if (!trapResult.ok) throw new Error(trapResult.summary);
  const trueEnding = runTool(ctx, "define_ending", {
    id: HORROR_TRUE_ENDING,
    name: "진실의 방",
    priority: 10,
    conditions: [{ kind: "switch", switchId: HORROR_FLAG_SWITCH, value: true }],
    epilogue: [{ kind: "say", speaker: "나", text: "문 뒤의 이름을 기억했다." }],
  });
  if (!trueEnding.ok) throw new Error(trueEnding.summary);
  const badEnding = runTool(ctx, "define_ending", {
    id: HORROR_BAD_ENDING,
    name: "닫힌 방",
    priority: 1,
    conditions: [{ kind: "variable", variableId: HORROR_SCORE_VARIABLE, op: ">=", value: 0 }],
  });
  if (!badEnding.ok) throw new Error(badEnding.summary);

  const targetMap = ctx.project.maps[ctx.project.startMapId];
  if (!targetMap) throw new Error("start map missing after tool writes");
  targetMap.events.push({
    id: "ev_truth_switch",
    x: 2,
    y: 3,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "ev_truth_switch_page",
        name: "진실 단서",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "setSwitch", switchId: HORROR_FLAG_SWITCH, value: true },
          { kind: "triggerEnding" },
        ],
      },
    ],
  });

  return ctx.project;
}
