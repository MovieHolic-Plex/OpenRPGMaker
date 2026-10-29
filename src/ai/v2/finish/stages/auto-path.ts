// 청사진 경로(+ 회복 길) 자동 짓기(session.buildPath, 한 실행에 한 번).
import type { FinishStage } from "../types";
import { BLUEPRINT_PATH_IDS } from "../../blueprint";
import { battleSites, healingSources } from "../../combatChecks";

export const stage: FinishStage = {
  id: "auto-path", phase: "blueprint", order: 40,
  async run(ctx) {
    const { env, session, done } = ctx;
    // 전투가 있는데 회복할 길이 0(출하 검사 combat-no-healing)도 경로 짓기가 고친다(build_blueprint_path 끝의 ensureHealingAccess) — 경로 막힘이 없어도 부른다.
    const noHealing = battleSites(env.ctx.project).length > 0 && healingSources(env.ctx.project).length === 0;
    const walked = ctx.walked;
    if (session.buildPath && !session.autoPathDone && (noHealing || walked.some((b) => BLUEPRINT_PATH_IDS.has(b.id)))) {
      session.autoPathDone = true;
      const built = await session.buildPath([...walked.map((b) => b.id), ...(noHealing ? ["combat-no-healing"] : [])].join(","));
      env.emit({ type: "execution_status", name: "v2.blueprint.auto_path", ok: built.ok, summary: `청사진 경로 자동 짓기 — ${built.summary.slice(0, 300)}` });
      done.push(built.ok ? `경로: ${built.summary.slice(0, 600)}` : `경로 짓기 실패: ${built.summary.slice(0, 400)} — 이 이유를 고친 뒤 build_blueprint_path 를 부른다.`);
    }
  },
};
