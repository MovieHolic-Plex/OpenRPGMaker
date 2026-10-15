// FF6 수정 A(PR3): 팀 교대 전투 헤드리스 프로브. 실제 도구로 저작 → 실제 전투 런타임.
// 실행: node node_modules/vite-node/dist/cli.mjs --script scripts/qa/ff6-fix-a-teams-probe.mts
import { createBlankProject } from "../../src/project/defaults";
import { runTool } from "../../src/editor/tools/toolRunner";
import { createBattleRuntime, headlessBattleSnapshot } from "../../src/battle/runtime";
import { normalizeSystemRecords } from "../../src/project/databaseRecordModel";
import { mulberry32 } from "../../src/util/rng";

const ctx = { project: createBlankProject() };
const P = () => ctx.project;
const rec = (id: string, ok: boolean | null, detail: string) => process.stdout.write(JSON.stringify({ id, ok, detail }) + "\n");
const call = (name: string, args: Record<string, unknown>) => runTool(ctx, name, args);
const must = (name: string, args: Record<string, unknown>) => {
  const r = call(name, args);
  if (!r.ok) throw new Error(`${name}: ${r.summary} ${JSON.stringify((r.issues ?? []).slice(0, 3))}`);
  return r;
};

for (const [id, name] of [["actor_a1", "티나"], ["actor_a2", "로크"], ["actor_b1", "에드가"], ["actor_b2", "마시스"], ["actor_c1", "셀레스"]] as const) {
  must("upsert_actor", { actor: { id, name, classId: "class_hero", initialLevel: 10 } });
}
must("set_party", { scope: "start", actorIds: ["actor_a1", "actor_a2", "actor_b1", "actor_b2", "actor_c1"] });
must("upsert_enemy", { enemy: { id: "enemy_boss", name: "탑의 수문장", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 4000, maxMp: 0, attack: 6, defense: 2, mind: 1, agility: 4 }, rewards: { exp: 1, gold: 1 } } });
must("upsert_troop", { troop: { id: "troop_boss", name: "수문장", enemyIds: ["enemy_boss"], members: [{ enemyId: "enemy_boss", x: 60, y: 80 }] } });

// 1) 도구: 모르는 키 거절 · 겹침 거절 · 정상
const unknownKey = call("set_project_settings", { battle: { teams: [{ id: "t1", actorIds: ["actor_a1"], bogus: 1 }, { id: "t2", actorIds: ["actor_b1"] }] } });
rec("teams.tool-rejects-unknown-key", !unknownKey.ok, unknownKey.summary.slice(0, 200));
const overlap = call("set_project_settings", { battle: { teams: [{ id: "t1", actorIds: ["actor_a1"] }, { id: "t2", actorIds: ["actor_a1"] }] } });
rec("teams.tool-rejects-overlap", !overlap.ok, overlap.summary.slice(0, 200));
const single = call("set_project_settings", { battle: { teams: [{ id: "t1", actorIds: ["actor_a1"] }] } });
rec("teams.tool-rejects-single-team", !single.ok, single.summary.slice(0, 200));
const badCost = call("set_project_settings", { battle: { teamSwapCost: "instant" } });
rec("teams.tool-rejects-bad-cost", !badCost.ok, badCost.summary.slice(0, 200));
const ok = must("set_project_settings", { battle: { flow: "gauge", atbMode: "wait", teams: [
  { id: "team_a", name: "티나 팀", actorIds: ["actor_a1", "actor_a2"] },
  { id: "team_b", name: "에드가 팀", actorIds: ["actor_b1", "actor_b2"] },
  { id: "team_c", name: "셀레스 팀", actorIds: ["actor_c1"] },
] } });
rec("teams.tool-ok-three-teams", (P().system.battleTeams?.length ?? 0) === 3, `battleTeams=${JSON.stringify(P().system.battleTeams?.map((t) => `${t.id}:${t.actorIds.join("+")}`))} warnings=${JSON.stringify(ok.warnings ?? [])}`);
const roundTrip = normalizeSystemRecords(JSON.parse(JSON.stringify(P().system)) as never);
rec("teams.save-roundtrip", JSON.stringify(roundTrip.battleTeams) === JSON.stringify(P().system.battleTeams), "system.battleTeams 가 normalize 왕복에서 보존된다");

function open(troopId = "troop_boss", flow: "gauge" | "strict" = "gauge", seed = 3) {
  return createBattleRuntime({ project: P(), troopId, canEscape: true, canLose: true, battleFlow: flow,
    party: { levels: {}, experience: {}, partyActorIds: P().system.startActorIds ?? [] },
    sessionState: { switches: {}, variables: {}, inventory: {}, partyActorIds: P().system.startActorIds ?? [] },
    captureLocation: { mapId: P().startMapId, x: 1, y: 1 }, rng: mulberry32(seed) } as never);
}
const ids = (s: ReturnType<typeof headlessBattleSnapshot>) => s.actors.map((a) => a.recordId).join("+");
function untilCommand(rt: ReturnType<typeof open>) { let g = 0; while (g++ < 800 && headlessBattleSnapshot(rt).phase !== "actorCommand") rt.tick(100); return headlessBattleSnapshot(rt); }

// 2) 시작: 한 팀만 선다, 다른 팀은 대기(reserve), 개별 교체는 같은 팀 안에서만
try {
  const rt = open();
  const s = untilCommand(rt);
  rec("teams.only-one-team-fights", ids(s) === "actor_a1+actor_a2" && s.activeTeamId === "team_a" && s.reserveActors.length === 3, `싸우는 팀=${s.activeTeamId} 전투원=${ids(s)} 대기=${s.reserveActors.map((a) => a.recordId).join("+")} 팀목록=${JSON.stringify(s.teams?.map((t) => `${t.name}${t.active ? "*" : ""}(${t.alive})`))}`);
  rec("teams.switch-candidates-same-team-only", s.switchCandidateActorIds.length === 0, `개별 교체 후보=${JSON.stringify(s.switchCandidateActorIds)} (다른 팀 구성원은 후보가 아니다)`);
  // 3) gauge 비용: 들어온 팀 게이지 0
  rt.performTeamSwap!({ kind: "teamSwap", targetTeamId: "team_b" });
  let after = headlessBattleSnapshot(rt);
  rec("teams.swap-gauge-cost-starts-at-zero", ids(after) === "actor_b1+actor_b2" && after.activeTeamId === "team_b" && after.actors.every((a) => (a.gauge ?? 0) === 0), `교대 직후 팀=${after.activeTeamId} 전투원=${ids(after)} 게이지=${JSON.stringify(after.actors.map((a) => a.gauge))} phase=${after.phase}`);
  const s2 = untilCommand(rt);
  rec("teams.incoming-team-acts-after-charging", s2.actors.some((a) => a.recordId === s2.activeActorId) && ids(s2) === "actor_b1+actor_b2", `충전 뒤 명령 차례=${s2.activeActorId}`);
  // 같은 팀으로 다시 교대 · 없는 팀은 거부
  const before = ids(headlessBattleSnapshot(rt));
  rt.performTeamSwap!({ kind: "teamSwap", targetTeamId: "team_b" });
  rt.performTeamSwap!({ kind: "teamSwap", targetTeamId: "team_zzz" });
  rec("teams.swap-to-self-or-unknown-rejected", ids(headlessBattleSnapshot(rt)) === before, `전투원 유지=${before}`);
  // 되돌아가기
  rt.performTeamSwap!({ kind: "teamSwap", targetTeamId: "team_a" });
  rec("teams.swap-back", ids(headlessBattleSnapshot(rt)) === "actor_a1+actor_a2", `다시 A팀=${ids(headlessBattleSnapshot(rt))}`);
} catch (e) { rec("teams.only-one-team-fights", false, String((e as Error).stack).slice(0, 500)); }

// 4) free 비용(트룹 덮어쓰기): 들어온 팀 바로 행동
try {
  must("upsert_troop", { troop: { id: "troop_boss", teamSwapCost: "free" } });
  const rt = open();
  untilCommand(rt);
  rt.performTeamSwap!({ kind: "teamSwap", targetTeamId: "team_b" });
  const after = headlessBattleSnapshot(rt);
  const ready = after.actors.some((a) => (a.gauge ?? 0) >= 100) || after.phase === "actorCommand";
  rec("teams.free-cost-acts-at-once", ready && after.teamSwapCost === "free", `비용=${after.teamSwapCost} 게이지=${JSON.stringify(after.actors.map((a) => a.gauge))} phase=${after.phase}`);
  must("upsert_troop", { troop: { id: "troop_boss", teamSwapCost: "turn" } });
  const rt2 = open();
  untilCommand(rt2);
  rt2.performTeamSwap!({ kind: "teamSwap", targetTeamId: "team_b" });
  const g0 = headlessBattleSnapshot(rt2);
  let frames = 0; let firstActor: string | undefined; let enemyActedFirst = false;
  const logLen = () => headlessBattleSnapshot(rt2).actionLog.length;
  const start = logLen();
  while (frames++ < 900) {
    rt2.tick(100);
    const s = headlessBattleSnapshot(rt2);
    if (s.phase === "actorCommand") { firstActor = s.activeActorId; break; }
    if (s.actionLog.length > start) enemyActedFirst = true;
  }
  rec("teams.turn-cost-enemy-acts-before-incoming", g0.teamSwapCost === "turn" && enemyActedFirst && Boolean(firstActor?.startsWith("actor_b")), `비용=${g0.teamSwapCost} 적이 먼저 행동=${enemyActedFirst} 첫 명령 차례=${firstActor}`);
  must("upsert_troop", { troop: { id: "troop_boss", teamSwapCost: null } });
} catch (e) { rec("teams.free-cost-acts-at-once", false, String((e as Error).stack).slice(0, 500)); }

// 5) 팀 전멸 → 다음 팀 자동 투입, 전 팀 전멸이어야 패배
try {
  must("upsert_enemy", { enemy: { id: "enemy_killer", name: "학살자", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 9000, maxMp: 0, attack: 900, defense: 2, mind: 1, agility: 30 }, rewards: { exp: 1, gold: 1 } } });
  must("upsert_troop", { troop: { id: "troop_killer", name: "학살자", enemyIds: ["enemy_killer"], members: [{ enemyId: "enemy_killer", x: 60, y: 80 }] } });
  const rt = open("troop_killer");
  const seen: string[] = [];
  let g = 0;
  while (g++ < 4000) {
    const s = headlessBattleSnapshot(rt);
    if (s.result) break;
    if (s.activeTeamId && seen[seen.length - 1] !== s.activeTeamId) seen.push(s.activeTeamId);
    if (s.phase === "actorCommand") rt.performActorCommand({ kind: "defend" } as never);
    else if (s.phase === "targetSelect") rt.selectTarget?.(s.targetSelection!.targetIds[0]!);
    else rt.tick(100);
  }
  const fin = headlessBattleSnapshot(rt);
  const allDown = [...fin.actors, ...fin.reserveActors].every((a) => a.hp <= 0);
  rec("teams.wiped-team-rotates-then-defeat-only-when-all-down", fin.result === "defeat" && allDown && seen.join(">") === "team_a>team_b>team_c", `팀 순서=${seen.join(">")} 결과=${fin.result} 전원 쓰러짐=${allDown}`);
} catch (e) { rec("teams.wiped-team-rotates-then-defeat-only-when-all-down", false, String((e as Error).stack).slice(0, 500)); }

// 6) strict: 팀 교대는 라운드를 쓰고, 물러난 팀의 명령은 버려진다
try {
  const rt = open("troop_boss", "strict");
  let s = headlessBattleSnapshot(rt);
  rec("teams.strict-starts-with-one-team", ids(s) === "actor_a1+actor_a2" && s.phase === "actorCommand", `전투원=${ids(s)} 차례=${s.activeActorId}`);
  rt.performActorCommand({ kind: "defend" } as never);
  s = headlessBattleSnapshot(rt);
  rt.performTeamSwap!({ kind: "teamSwap", targetTeamId: "team_c" });
  s = headlessBattleSnapshot(rt);
  rec("teams.strict-swap-uses-the-round", s.activeTeamId === "team_c" && ids(s) === "actor_c1" && (s.phase === "actorCommand" || s.phase === "charging"), `팀=${s.activeTeamId} 전투원=${ids(s)} phase=${s.phase} 라운드로그=${s.roundLogs?.length ?? 0}`);
} catch (e) { rec("teams.strict-starts-with-one-team", false, String((e as Error).stack).slice(0, 500)); }

// 7) 회귀: 팀 설정이 없는 프로젝트는 스냅샷에 팀 필드가 없고 전원이 싸운다
try {
  must("set_project_settings", { battle: { teams: [] } });
  const rt = open();
  const s = headlessBattleSnapshot(rt);
  rec("teams.regression-no-teams-unchanged", s.teams === undefined && s.activeTeamId === undefined && s.actors.length === 5 && s.reserveActors.length === 0 && P().system.battleTeams === undefined, `팀 필드=${s.teams === undefined ? "없음" : "있음"} 전투원=${s.actors.length}명 대기=${s.reserveActors.length}`);
} catch (e) { rec("teams.regression-no-teams-unchanged", false, String((e as Error).stack).slice(0, 500)); }
process.stdout.write("DONE\n");
