// 『첫사랑』 출하 데모 그대로의 프로젝트 JSON — 런타임 QA 픽스처.
// 실행: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/first-love-fixture.mts > .omo/runtime-qa/first-love/game.json
// FL_STAGE=<n> FL_JIHU=<n> FL_MAP=<id> FL_X FL_Y 로 시작 지점을 옮긴 시험판을 만든다(장면 하나만 볼 때).
import { serialize } from "../../../src/project/io";

const { createFlagshipDemoProject } = await import("../../../src/project/flagship");
const project = createFlagshipDemoProject("first-love").project;
const env = process.env;
if (env.FL_MAP) {
  project.startMapId = env.FL_MAP;
  project.startPos = { x: Number(env.FL_X ?? 5), y: Number(env.FL_Y ?? 5) };
}
if (env.FL_STAGE || env.FL_JIHU) {
  // 시험판 전용: 새 게임 시작 때 단계를 미리 맞추는 자동 실행 공통 이벤트(정본 데모에는 없다).
  const cmds = [] as unknown[];
  if (env.FL_STAGE) cmds.push({ kind: "setVariable", variableId: "var_fl_stage", op: "=", value: Number(env.FL_STAGE) });
  if (env.FL_JIHU) cmds.push({ kind: "setVariable", variableId: "var_fl_jihu", op: "=", value: Number(env.FL_JIHU) });
  for (const sw of (env.FL_SW ?? "").split(",").filter(Boolean)) cmds.push({ kind: "setSwitch", switchId: sw, value: true });
  cmds.push({ kind: "setSwitch", switchId: "sw_fl_qa_seeded", value: true });
  project.switches.push({ id: "sw_fl_qa_seeded", name: "QA 시드" });
  project.commonEvents = [...(project.commonEvents ?? []), { id: "ce_fl_qa_seed", name: "QA seed", trigger: "auto", conditionSwitchId: undefined, commands: cmds } as never];
}
process.stderr.write(`[first-love] maps=${Object.keys(project.maps).length} endings=${project.endings?.length} start=${project.startMapId} ${JSON.stringify(project.startPos)}\n`);
process.stdout.write(serialize(project));
