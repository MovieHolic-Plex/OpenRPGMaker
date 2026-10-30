// 해원 사건 1 증거(헤드리스) — 들머리·동헌 자동 장면 → 사건 도구 동봉 시나리오(증거·탐문·정답 지목) → 지목 뒤에도 이어짐 →
// 밤 장면 → 퇴마 전투(고하기 선택을 직접 답한다) → 해원/봉인. 오답 갈래도. 끝으로 임시 SQLite 저장·재로드 뒤 같은 시나리오.
// 실행: node --max-old-space-size=8000 node_modules/vite-node/dist/cli.mjs --script scripts/qa/joseon-haewon-c1-proof.mts [출력.json]
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initLocalProjectStore } from "../../electron/local-store/store";
import { createBattleRuntime, headlessBattleSnapshot } from "@/battle/runtime";
import { createJoseonHaewonFlagshipDemo, preloadJoseonHaewon, lastCase1VerificationScene, JW_MAP, S, SW, V_STAGE } from "@/project/flagship/joseonHaewon";
import { startSession } from "@/project/session";
import type { Project } from "@/project/types";
import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";

await preloadJoseonHaewon();
const { project } = createJoseonHaewonFlagshipDemo();
type Scene = { mapId: string; start: { x: number; y: number }; steps: SceneStep[] };
const caseScene = structuredClone(lastCase1VerificationScene) as Scene;
const W: SceneStep = { kind: "wait", ticks: 900 };

// 프롤로그: 들머리 자동 → 덕배 대화(stage TO_OFFICE) → 동헌 착지 칸에 서면 자동 장면(stage CASE1).
const prologue: SceneStep[] = [W, W, W, W, { kind: "set", mapId: JW_MAP.office, x: 8, y: 11, facing: "up" } as SceneStep, W, W, W, W];
const run = (p: Project, steps: SceneStep[]) => runSceneTest(p, { mapId: p.startMapId, start: p.startPos, steps });
const pro = run(project, prologue);

// 사건 도구 시나리오의 앞(맵·시작)을 프롤로그 뒤에 잇는다.
const solvedSteps: SceneStep[] = [...prologue, { kind: "set", mapId: caseScene.mapId, x: caseScene.start.x, y: caseScene.start.y } as SceneStep, ...caseScene.steps];
const solved = run(project, solvedSteps);
const chooseAt = solvedSteps.map((s) => s.kind).lastIndexOf("choose");
const wrongSteps = structuredClone(solvedSteps);
const ci = (wrongSteps[chooseAt] as { index: number }).index;
(wrongSteps[chooseAt] as { index: number }).index = ci === 0 ? 1 : 0;
const wrong = run(project, [...wrongSteps.slice(0, -1), W]);

// 지목 뒤 마을로 나오면 밤 장면(stage NIGHT) → 월화에게 말 걸기 → 전투 직전까지.
const night = (base: SceneStep[]) => [...base.slice(0, -1), W, { kind: "set", mapId: JW_MAP.village, x: 31, y: 28, facing: "up" } as SceneStep, W, W, W];
const solvedNight = run(project, night(solvedSteps));

// 전투: 고하기 선택에 「정 서방」(1)을 답하면 해원 상태가 붙어 피해가 들어가고 이긴다. 「칠복」(0)만 답하면 끝나지 않는다.
function fight(p: Project, answer: number) {
  const session = startSession(p);
  const rt = createBattleRuntime({ project: p, troopId: "troop_jw_buni", canEscape: false, canLose: true,
    party: { levels: session.actorLevels, experience: session.actorExperience, names: session.actorNames, vitals: session.actorVitals, paramBonuses: session.actorParamBonuses,
      equipment: session.actorEquipment, skillIds: session.actorSkillIds, classOverrides: session.classOverrides, stateIds: session.actorStateIds, partyActorIds: session.partyActorIds },
    sessionState: { switches: session.switches, variables: session.variables, inventory: session.inventory, selfSwitches: session.selfSwitches, battleResult: session.battleResult, gameTime: session.gameTime, friendship: session.friendship },
    rng: () => 0.5 } as never);
  let asked = 0; let hasteState = false;
  for (let i = 0; i < 4000; i += 1) {
    let snap;
    try { snap = headlessBattleSnapshot(rt); } catch (error) {
      const req = (error as { request?: { id: number; options?: unknown[] } }).request ?? (rt.snapshot() as { eventChoice?: { id: number } }).eventChoice;
      if (!req) throw error;
      asked += 1; rt.resumeEventChoice(req.id, answer); continue;
    }
    if (snap.result) return { result: snap.result, asked, buniState: hasteState };
    const buni = snap.enemies.find((e: { enemyId?: string; id: string }) => (e.enemyId ?? e.id).includes("buni"));
    if (buni && (buni as { stateIds?: string[] }).stateIds?.includes("state_jw_haewon")) hasteState = true;
    if (snap.phase === "actorCommand") {
      const target = snap.enemies.find((e: { defeated: boolean; hp: number }) => !e.defeated && e.hp > 0);
      const actorId = (snap as { activeActorId?: string }).activeActorId;
      if (target && actorId) rt.performActorCommand({ kind: "attack", actorId, targetEnemyId: target.id } as never); else rt.tick(1000);
    } else rt.tick(1000);
  }
  return { result: "timeout", asked, buniState: hasteState };
}
const fightRight = fight(project, 1);
const fightWrong = fight(project, 0);

// SQLite 저장 → 다른 핸들 재로드 → 같은 정답 시나리오.
const dir = mkdtempSync(join(tmpdir(), "oprn-haewon-c1-"));
const first = await initLocalProjectStore({ projectDir: dir });
const saved = await first.saveProject(project);
const second = await initLocalProjectStore({ projectDir: dir });
const reloaded = second.loadSnapshot()!.project;
const reloadedRun = run(reloaded, solvedSteps);
const mapsSame = Object.keys(project.maps).every((id) => JSON.stringify(project.maps[id]) === JSON.stringify(reloaded.maps[id]));
rmSync(dir, { recursive: true, force: true });

const on = (r: ReturnType<typeof run>, id: string) => r.finalState.switchesOn.includes(id);
const out = {
  prologue: { ok: pro.ok, failure: pro.failureReason ?? null, stage: pro.finalState.variables[V_STAGE] },
  solved: { ok: solved.ok, failure: solved.failureReason ?? null, step: solved.failedStepIndex ?? null, solvedOn: on(solved, SW.c1Solved), wrongOn: on(solved, SW.c1Wrong), endings: solved.finalState.endingsReached, stage: solved.finalState.variables[V_STAGE], confession: JSON.stringify(solved.finalState.messages).includes("군안에서") },
  wrong: { ok: wrong.ok, failure: wrong.failureReason ?? null, wrongOn: on(wrong, SW.c1Wrong), solvedOn: on(wrong, SW.c1Solved), endings: wrong.finalState.endingsReached, mob: JSON.stringify(wrong.finalState.messages).includes("멍석") },
  night: { ok: solvedNight.ok, failure: solvedNight.failureReason ?? null, nightOn: on(solvedNight, SW.c1Night), stage: solvedNight.finalState.variables[V_STAGE] },
  fightRight, fightWrong,
  storage: { kind: saved.kind, projectId: second.projectId, mapsSame, reloadedOk: reloadedRun.ok && on(reloadedRun, SW.c1Solved) },
  steps: solvedSteps.length,
};
const allOk = out.prologue.ok && out.prologue.stage === S.CASE1 && out.solved.ok && out.solved.solvedOn && !out.solved.wrongOn && out.solved.endings.length === 0 && out.solved.confession
  && out.wrong.wrongOn && !out.wrong.solvedOn && out.wrong.endings.length === 0 && out.night.nightOn && out.night.stage === S.C1_NIGHT
  && fightRight.result === "victory" && fightWrong.result !== "victory" && out.storage.kind === "saved" && out.storage.mapsSame && out.storage.reloadedOk;
const result = { allOk, ...out };
writeFileSync(process.argv[2] ?? "/tmp/jw/c1-proof.json", JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
process.exit(allOk ? 0 : 1);
