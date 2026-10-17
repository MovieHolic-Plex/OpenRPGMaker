// FF6 수정 A: 순차 팀 전환(파티 나누기 · 번갈아 조작 · 합류) 헤드리스 프로브.
// 실제 도구(upsert_event)로 이벤트를 저작 → 인터프리터로 실행 → 팀별 전투 → 세이브 왕복.
// 실행: node node_modules/vite-node/dist/cli.mjs --script scripts/qa/ff6-fix-a-party-probe.mts
import { createBlankProject } from "../../src/project/defaults";
import { runTool } from "../../src/editor/tools/toolRunner";
import { createInterpreter } from "../../src/player/interpreter";
import { startSession } from "../../src/project/session";
import { createBattleRuntime, headlessBattleSnapshot } from "../../src/battle/runtime";
import { applySaveSnapshot, createSaveSnapshot } from "../../src/player/saveSlots";
import { mulberry32 } from "../../src/util/rng";
import type { Command } from "../../src/project/types";

const ctx = { project: createBlankProject() };
const P = () => ctx.project;
const rec = (id: string, ok: boolean | null, detail: string) => process.stdout.write(JSON.stringify({ id, ok, detail }) + "\n");
const call = (name: string, args: Record<string, unknown>) => runTool(ctx, name, args);
const must = (name: string, args: Record<string, unknown>) => {
  const r = call(name, args);
  if (!r.ok) throw new Error(`${name}: ${r.summary} ${JSON.stringify((r.issues ?? []).slice(0, 3))}`);
  return r;
};

for (const [id, name] of [["actor_terra", "티나"], ["actor_locke", "로크"], ["actor_edgar", "에드가"], ["actor_sabin", "마시스"], ["actor_celes", "셀레스"], ["actor_cyan", "카이엔"]] as const) {
  must("upsert_actor", { actor: { id, name, classId: "class_hero", initialLevel: 12 } });
}
must("set_party", { scope: "start", actorIds: ["actor_terra", "actor_locke", "actor_edgar", "actor_sabin", "actor_celes", "actor_cyan"] });
const base = P().maps[P().startMapId]!;
must("create_map", { id: "map_tower_b", name: "탑 B", width: 20, height: 15, tilesetId: base.tilesetId });
must("create_map", { id: "map_tower_c", name: "탑 C", width: 20, height: 15, tilesetId: base.tilesetId });
// 팀 편성 이벤트: 시작 맵에서 3팀으로 나눈다(= 파티를 이름으로 저장, 나머지는 다른 맵에 세워 둔다)
const splitCommands: Command[] = [
  { kind: "storeParty", partySetId: "team_a" },
  { kind: "changeParty", actorId: "actor_edgar", action: "remove" }, { kind: "changeParty", actorId: "actor_sabin", action: "remove" },
  { kind: "changeParty", actorId: "actor_celes", action: "remove" }, { kind: "changeParty", actorId: "actor_cyan", action: "remove" },
  { kind: "storeParty", partySetId: "team_a" },
] as never;
const r1 = call("upsert_event", { mapId: P().startMapId, event: { id: "ev_split", name: "팀 편성", x: 5, y: 5, pages: [{ trigger: "action", commands: splitCommands }] } });
const switchAB: Command[] = [{ kind: "recallParty", partySetId: "team_b" }] as never;
const r2 = call("upsert_event", { mapId: P().startMapId, event: { id: "ev_switch_b", name: "팀 B 로", x: 6, y: 5, pages: [{ trigger: "action", commands: switchAB }] } });
rec("party.authoring-tools", r1.ok && r2.ok, `upsert_event 편성=${r1.summary.slice(0, 60)} · 전환=${r2.summary.slice(0, 60)}`);

function runCommands(commands: Command[], session: ReturnType<typeof startSession>): string[] {
  const steps: string[] = [];
  const it = createInterpreter(commands, session, P(), { continueAfterTransfer: true });
  let step = it.start();
  while (step.kind !== "done") {
    steps.push(step.kind);
    if (step.kind === "transfer") { session.currentMapId = step.mapId; session.x = step.x; session.y = step.y; }
    step = it.resume();
  }
  return steps;
}

try {
  const session = startSession(P());
  session.partyActorIds = ["actor_terra", "actor_locke"]; session.currentMapId = P().startMapId; session.x = 3; session.y = 3;
  runCommands([{ kind: "storeParty", partySetId: "team_a" }] as never, session);
  session.partyActorIds = ["actor_edgar", "actor_sabin"]; session.currentMapId = "map_tower_b"; session.x = 4; session.y = 4;
  runCommands([{ kind: "storeParty", partySetId: "team_b" }] as never, session);
  session.partyActorIds = ["actor_celes", "actor_cyan"]; session.currentMapId = "map_tower_c"; session.x = 5; session.y = 5;
  runCommands([{ kind: "storeParty", partySetId: "team_c" }] as never, session);
  // 팀 A → B → C → A 로 번갈아 조작, 각자 자기 자리에서 이어 간다
  const trail: string[] = [];
  for (const id of ["team_a", "team_b", "team_c", "team_a"]) {
    const steps = runCommands([{ kind: "recallParty", partySetId: id }] as never, session);
    trail.push(`${id}[${session.partyActorIds.join("+")} @${session.currentMapId}(${session.x},${session.y}) ${steps.join(",")}]`);
  }
  const a = session.partySets?.team_a; const b = session.partySets?.team_b;
  rec("party.sequential-switch-positions", session.partyActorIds.join() === "actor_terra,actor_locke" && session.currentMapId === P().startMapId && b?.mapId === "map_tower_b" && b?.x === 4, trail.join(" → "));
  rec("party.sets-limit", (() => { const s = startSession(P()); let ok = 0; for (let i = 0; i < 10; i += 1) { const r = runCommands([{ kind: "storeParty", partySetId: `t${i}` }] as never, s); void r; ok = Object.keys(s.partySets ?? {}).length; } return ok === 8; })(), "저장 묶음 상한 8(PARTY_SET_LIMIT)에서 멈춘다");
  // 팀별 전투: 현재 조작 팀의 구성원이 전투 파티가 된다
  must("upsert_enemy", { enemy: { id: "enemy_tower", name: "탑의 수문장", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 300, maxMp: 0, attack: 8, defense: 2, mind: 1, agility: 5 }, rewards: { exp: 1, gold: 1 } } });
  must("upsert_troop", { troop: { id: "troop_tower", name: "수문장", enemyIds: ["enemy_tower"], members: [{ enemyId: "enemy_tower", x: 60, y: 80 }] } });
  const partiesInBattle: string[] = [];
  for (const id of ["team_b", "team_c", "team_a"]) {
    runCommands([{ kind: "recallParty", partySetId: id }] as never, session);
    const rt = createBattleRuntime({ project: P(), troopId: "troop_tower", canEscape: true, canLose: true, battleFlow: "gauge",
      party: { levels: session.actorLevels, experience: {}, partyActorIds: session.partyActorIds, equipment: {}, vitals: session.actorVitals },
      sessionState: { switches: {}, variables: {}, inventory: {}, partyActorIds: session.partyActorIds },
      captureLocation: { mapId: session.currentMapId, x: session.x, y: session.y }, rng: mulberry32(3) } as never);
    partiesInBattle.push(`${id}:${headlessBattleSnapshot(rt).actors.map((x) => x.recordId).join("+")}`);
  }
  rec("party.team-battle-uses-current-team", partiesInBattle.join(" ").includes("team_b:actor_edgar+actor_sabin") && partiesInBattle.join(" ").includes("team_c:actor_celes+actor_cyan"), partiesInBattle.join(" · "));
  const reloaded = applySaveSnapshot(P(), JSON.parse(JSON.stringify(createSaveSnapshot(P(), session))));
  rec("party.save-roundtrip", Object.keys(reloaded.partySets ?? {}).sort().join() === "team_a,team_b,team_c" && reloaded.activePartySetId === session.activePartySetId, `partySets=${Object.keys(reloaded.partySets ?? {}).sort().join()} active=${reloaded.activePartySetId}`);
  void a;
} catch (e) { rec("party.sequential-switch-positions", false, String((e as Error).stack).slice(0, 600)); }
process.stdout.write("DONE\n");
