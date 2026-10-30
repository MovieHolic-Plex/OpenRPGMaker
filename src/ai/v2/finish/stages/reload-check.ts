// 저장 → 다시 읽기(reloadCheck) — 끝맺음의 맨 마지막 관문. 빌더가 넣은 이벤트의 빠진 필드는 메우고, 그래도 안 열리면 그 필드를 조수에게 알린다(출하 검사도 project-reload-failed 로 막는다).
import type { FinishStage } from "../types";
import { wantsWholeGame } from "../../shipChecks";
import { ensureReloadable } from "../../reloadCheck";

export const stage: FinishStage = {
  id: "reload-check", phase: "reload", order: 900,
  run(ctx) {
    const { env } = ctx;
    if (!(env.ctx.project.gameBlueprint || wantsWholeGame(env.request.task))) return;
    try {
      const reload = ensureReloadable(env.ctx.project);
      if (reload.project !== env.ctx.project) env.ctx.project = reload.project;
      if (reload.fixed.length || reload.problem) {
        const line = `${reload.fixed.length ? `저장본 다시 읽기: 이벤트 빠진 필드 ${reload.fixed.length}곳을 기본값으로 메움(${reload.fixed.slice(0, 4).join(", ")})` : ""}${reload.problem ? `${reload.fixed.length ? " — " : ""}저장본이 여전히 안 열린다: ${reload.problem.slice(0, 240)}` : ""}`;
        env.emit({ type: "execution_status", name: "v2.reload", ok: !reload.problem, summary: line });
        ctx.autoPath = ctx.autoPath ? `${ctx.autoPath}\n- ${line}` : `[자동으로 지음]\n- ${line}`;
      }
    } catch (error) { env.emit({ type: "execution_status", name: "v2.reload", ok: false, summary: `저장본 다시 읽기 검사 실패: ${error instanceof Error ? error.message : String(error)}` }); }
  },
};
