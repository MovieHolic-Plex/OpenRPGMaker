// 기술 포인트(TP) 헤드리스 증거: ct-techs 픽스처를 만든 뒤 simulate_battle 로 승리 보상의 TP·습득 미리보기를 보고,
// 같은 결과를 applyBattleRewardsToSession 에 흘려 세션 적립 → 세이브 왕복까지 확인한다.
// 사용: node node_modules/vite-node/vite-node.mjs --script scripts/qa/runtime/ct-techs-tp.mts
import { execFileSync } from "node:child_process";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize } from "../../../src/project/io";
import { startSession } from "../../../src/project/session";
import { applyBattleRewardsToSession } from "../../../src/player/battleRewardsToSession";
import { applySaveSnapshot, createSaveSnapshot } from "../../../src/player/saveSlots";
import type { SimulateBattleResult } from "../../../src/battle/simulate";

const json = execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/ct-techs-fixture.mts"], { maxBuffer: 80 * 1024 * 1024 }).toString();
const project = deserialize(json);
// 한 판에 끝나도록 통나무를 약하게 만든다(도구로만). TP 3 × 3 = 9 ≥ 비검 문턱 5.
const tuned = runTool({ project }, "upsert_enemy", { enemy: { id: "enemy_ct_block", stats: { maxHp: 5 } } });
if (!tuned.ok) throw new Error(tuned.summary);
const sim = runTool({ project }, "simulate_battle", { troopId: "troop_ct_logs", heroLevel: 5, partyActorIds: ["actor_hero", "actor_mage"], n: 1, seed: 3 });
if (!sim.ok) throw new Error(sim.summary);
const data = sim.data as SimulateBattleResult;
const rewards = data.firstRewards!;

const session = startSession(project);
const before = [...(session.actorSkillIds.actor_hero ?? [])];
applyBattleRewardsToSession(session, { result: "victory", rewards, participatingActorIds: data.participatingActorIds }, project);
const reloaded = applySaveSnapshot(project, JSON.parse(JSON.stringify(createSaveSnapshot(project, session))));
const report = {
  simulate: { summary: sim.summary, winRate: data.winRate, rewardsTp: rewards.tp, techLearned: rewards.techLearned },
  session: { actorTechPoints: session.actorTechPoints, heroSkillsBefore: before, heroSkillsAfter: session.actorSkillIds.actor_hero },
  saveRoundTrip: { actorTechPoints: reloaded.actorTechPoints, heroSkills: reloaded.actorSkillIds.actor_hero },
};
console.log(JSON.stringify(report, null, 1));
const ok = rewards.tp === 9
  && rewards.techLearned?.some((entry) => entry.actorId === "actor_hero" && entry.skillIds.includes("skill_ct_tp_tech"))
  && session.actorSkillIds.actor_hero?.includes("skill_ct_tp_tech")
  && !before.includes("skill_ct_tp_tech")
  && reloaded.actorTechPoints?.actor_hero === 9;
console.log(ok ? "CT_TP_OK" : "CT_TP_FAIL");
process.exit(ok ? 0 : 1);
