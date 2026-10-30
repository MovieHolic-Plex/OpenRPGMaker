// 단계 이벤트의 주인공 — 사람과 이야기하는 단계는 사람으로, 진행 낱말뿐인 칸은 결과 물건·살펴보는 대상 이름으로(stepSubjects.ts, vm4·vm5 판정).
// 가구 앉히기 앞에 — 사람이 될 칸을 가구에 붙이지 않게.
import type { FinishStage } from "../types";
import { createBuildRun } from "../../buildRun";
import { settleStepSubjects } from "../../stepSubjects";

export const stage: FinishStage = {
  id: "step-subjects", phase: "blueprint", order: 60,
  run({ env, done }) {
    const run = createBuildRun(env.ctx);
    const subjects = settleStepSubjects(run);
    if (subjects.length) done.push(`단계 주인공: ${subjects.join(" / ").slice(0, 500)}`);
  },
};
