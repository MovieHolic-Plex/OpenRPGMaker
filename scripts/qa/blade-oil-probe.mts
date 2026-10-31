// 칼 기름(상태 attackElementId · releaseAfterBattles) 헤드리스 프로브 — 실제 도구(runTool)로 저작하고 실제 전투 런타임으로 친다.
// 실행: node node_modules/vite-node/dist/cli.mjs --script scripts/qa/blade-oil-probe.mts
import { createBlankProject } from "../../src/project/defaults";
import { runTool } from "../../src/editor/tools/toolRunner";
import { createBattleRuntime, headlessBattleSnapshot } from "../../src/battle/runtime";
import { mulberry32 } from "../../src/util/rng";
import { startSession } from "../../src/project/session";
import { applyBattleRewardsToSession } from "../../src/player/battleRewardsToSession";
import { applySaveSnapshot, createSaveSnapshot } from "../../src/player/saveSlots";
import { useItemFromMenu } from "../../src/player/playerItemUse";

const ctx = { project: createBlankProject() };
const P = () => ctx.project;
let fails = 0;
const rec = (id: string, ok: boolean, detail: string) => { if (!ok) fails += 1; process.stdout.write(`${ok ? "PASS" : "FAIL"} ${id} — ${detail}\n`); };
const call = (name: string, args: Record<string, unknown>) => runTool(ctx, name, args);
const must = (name: string, args: Record<string, unknown>) => {
  const r = call(name, args);
  if (!r.ok) throw new Error(`${name}: ${r.summary} ${JSON.stringify((r.issues ?? []).slice(0, 3))}`);
  return r;
};

const hero = P().database.actors[0]!.id;
must("upsert_actor", { actor: { id: hero, name: "도르반", initialLevel: 10 } });
must("set_party", { scope: "start", actorIds: [hero] });
const bad = call("upsert_state", { state: { id: "state_oil_bad", name: "없는 속성 기름", runtimeEffects: { attackElementId: "no_such_element" } } });
rec("tool.rejects-unknown-element", !bad.ok, bad.summary);
const loose = must("upsert_state", { state: { id: "state_oil_loose", name: "안 풀리는 기름", runtimeEffects: { attackElementId: "fire" } } });
rec("tool.warns-no-release", JSON.stringify(loose).includes("releaseAfterBattles:1"), JSON.stringify(loose).slice(0, 400));
must("upsert_state", { state: { id: "state_oil", name: "불씨 기름", runtimeEffects: { attackElementId: "fire" }, releaseAfterBattles: 1 } });
rec("tool.state-saved", P().database.states.find((s) => s.id === "state_oil")?.releaseAfterBattles === 1, JSON.stringify(P().database.states.find((s) => s.id === "state_oil")));
const wrongKind = call("upsert_item", { item: { id: "item_oil_goods", name: "기름(종류 틀림)", type: "normalGoods", scope: "ally", occasion: "field", consumable: true, price: 25, stateEffects: [{ stateId: "state_oil", chance: 100, operation: "add" }] } });
rec("tool.item-kind-warning", JSON.stringify(wrongKind).includes('type:\\"special\\"'), JSON.stringify(wrongKind.warnings ?? wrongKind).slice(0, 300));
must("upsert_item", { item: { id: "item_oil", name: "불씨 기름", type: "special", scope: "ally", occasion: "field", consumable: true, price: 25, stateEffects: [{ stateId: "state_oil", chance: 100, operation: "add" }] } });
must("upsert_enemy", { enemy: { id: "enemy_drowner", name: "익사귀", monsterResourceId: "generated-enemy-ghoul-grave", stats: { maxHp: 99999, maxMp: 0, attack: 1, defense: 10, mind: 1, agility: 1 }, rewards: { exp: 1, gold: 0 }, elementRates: { fire: "A" } } });
must("upsert_troop", { troop: { id: "troop_drowner", name: "익사귀", enemyIds: ["enemy_drowner"] } });

function firstHit(stateIds: string[]): { amount: number; effectiveness?: number } {
  const session = startSession(P());
  const rt = createBattleRuntime({
    project: P(), troopId: "troop_drowner", canEscape: true, canLose: true,
    party: { levels: { [hero]: 10 }, experience: {}, partyActorIds: [hero], equipment: {}, stateIds: { [hero]: stateIds } },
    sessionState: { switches: {}, variables: {}, inventory: {}, partyActorIds: [hero] },
    captureLocation: { mapId: P().startMapId, x: 1, y: 1 }, rng: mulberry32(7),
  } as never);
  for (let g = 0; g < 400; g += 1) {
    const s = headlessBattleSnapshot(rt);
    if (s.phase === "actorCommand") { rt.performActorCommand({ kind: "attack", targetEnemyId: s.enemies[0]!.id } as never); break; }
    rt.tick(100);
  }
  for (let g = 0; g < 60; g += 1) rt.tick(100);
  const hit = headlessBattleSnapshot(rt).timeline.find((t) => t.kind === "damage" && t.userRecordId === hero) as { amount: number; effectiveness?: number } | undefined;
  void session;
  return hit ?? { amount: -1 };
}
const plain = firstHit([]);
const oiled = firstHit(["state_oil"]);
rec("battle.oil-uses-fire-weakness", oiled.amount > plain.amount * 1.6 && oiled.effectiveness !== undefined && oiled.effectiveness > 1, `맨칼 ${plain.amount}(배율 ${plain.effectiveness ?? 1}) → 기름 ${oiled.amount}(배율 ${oiled.effectiveness})`);

// 필드에서 기름을 바르고, 전투 한 번 뒤 풀린다(전투 종료 일반 규칙이 켜져 있어도 첫 전투는 살아 들어간다).
P().system.clearStatesAfterBattle = true;
const session = startSession(P());
session.inventory = { item_oil: 1 };
const used = useItemFromMenu(P(), session, "item_oil", hero);
rec("field.item-applies-state", (session.actorStateIds?.[hero] ?? []).includes("state_oil"), `use=${JSON.stringify(used)} states=${JSON.stringify(session.actorStateIds)}`);
const actors = (stateIds: string[]) => [{ recordId: hero, stateIds, hp: 100, maxHp: 100, mp: 0, maxMp: 0, side: "actor" }] as never;
const outcome = (stateIds: string[]) => ({ result: "victory", canLose: false, actors: actors(stateIds), rewards: { exp: 0, gold: 0, items: [] } }) as never;
// 저장 → 불러오기 사이에도 수가 남는지(2번 싸움짜리 상태로).
must("upsert_state", { state: { id: "state_bless", name: "축복", runtimeEffects: { attackElementId: "holy" }, releaseAfterBattles: 2 } });
session.actorStateIds![hero] = [...(session.actorStateIds![hero] ?? []), "state_bless"];
applyBattleRewardsToSession(session, outcome(session.actorStateIds![hero]!), P());
rec("battle-end.oil-released-after-one", !(session.actorStateIds?.[hero] ?? []).includes("state_oil"), JSON.stringify(session.actorStateIds?.[hero]));
rec("battle-end.bless-kept-after-one", (session.actorStateIds?.[hero] ?? []).includes("state_bless") && session.stateBattleCounts?.[hero]?.state_bless === 1, JSON.stringify(session.stateBattleCounts));
const snap = createSaveSnapshot(P(), session);
const back = applySaveSnapshot(P(), JSON.parse(JSON.stringify(snap)));
rec("save.counts-roundtrip", back.stateBattleCounts?.[hero]?.state_bless === 1, JSON.stringify(back.stateBattleCounts));
applyBattleRewardsToSession(back, outcome(back.actorStateIds![hero]!), P());
rec("battle-end.bless-released-after-two", !(back.actorStateIds?.[hero] ?? []).includes("state_bless") && !back.stateBattleCounts?.[hero], `${JSON.stringify(back.actorStateIds?.[hero])} ${JSON.stringify(back.stateBattleCounts)}`);
console.log(fails ? `FAILED ${fails}` : "ALL PASS");
process.exit(fails ? 1 : 0);
