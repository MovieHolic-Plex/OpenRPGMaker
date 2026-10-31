// 폴른 스타 지하 미궁(1막) 전투 헤드리스 밸런스 — 세 가지 손버릇으로 트룹마다 n판을 돌린다.
//   node_modules/.bin/vite-node --script scripts/qa/fallen-vault-sim.mts <chrono-bell.project.json> [n] [--apply] [--json out.json]
//   --apply : 구운 파일 위에 지금 체크아웃의 applyFallenVaultCombat(적·트룹·용)을 덮어 본다(굽지 않고 조정할 때).
// 손버릇
//   attack   — 모두 「공격」만, HP 30% 아래면 회복약. (기믹을 읽지 않는 막무가내)
//   auto     — 게임의 자동 전투 AI(가진 기술을 효용대로 고른다). 수첩·몸짓을 안 읽고 버튼만 누르는 사람.
//   sensible — 수첩을 읽은 사람: 용은 찔러 가르고(관통상) 갈라진 동안 마법, 모으는 큰 기술엔 찌르기·방어,
//              무리는 사제·조준 중인 석궁수·사냥개지기를 먼저, 낫 고행자는 기세 꺾기, 침묵은 정화, 다치면 치유.
import { readFileSync, writeFileSync } from "node:fs";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
import { createBattleRuntime, headlessBattleSnapshot } from "@/battle/runtime";
import type { ActorCommand, BattleBattlerSnapshot, BattleSnapshot } from "@/battle/types";
import type { Project, SkillRecord } from "@/project/types";
import { mulberry32, type Rng } from "@/util/rng";

const args = process.argv.slice(2);
const path = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a)) ?? "/tmp/fsvc/explore.json";
const n = Number(args.find((a) => /^\d+$/.test(a)) ?? 40);
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : undefined;
const project = JSON.parse(readFileSync(path, "utf8")) as Project;
if (args.includes("--apply")) {
  const { applyFallenVaultCombat } = await import("@/project/flagship/fallen/vaultCombat");
  applyFallenVaultCombat(project);
}

const PIERCED = "state_fs_pierced";
const DRAGON = "enemy_fs_moon_dragon";
const PARTY = ["actor_hero", "actor_fs_elena", "actor_fs_iris"];
const skills = new Map(project.database.skills.map((s) => [s.id, s] as const));
const mpOf = (id: string): number => skills.get(id)?.mpCost?.flat ?? 0;
type Policy = "attack" | "masher" | "auto" | "sensible";

/** 적 역할 우선순위(낮을수록 먼저 친다) — sensible 이 무리를 상대할 때. */
const ROLE_ORDER: Array<[RegExp, number]> = [
  [/inq_priest/, 0], [/inq_handler/, 1], [/inq_crossbow/, 2], [/inq_flagellant/, 3], [/inq_spy/, 3],
  [/preacher/, 4], [/fanatic$/, 5], [/hound/, 6], [/inq_penitent/, 7], [/inq_shield/, 8],
];
const roleRank = (e: BattleBattlerSnapshot): number => {
  if (e.charging) return -1;
  for (const [re, rank] of ROLE_ORDER) if (re.test(e.recordId)) return rank;
  return 5;
};

function alive(list: readonly BattleBattlerSnapshot[]): BattleBattlerSnapshot[] {
  return list.filter((b) => !b.defeated && b.hp > 0);
}
function has(actor: BattleBattlerSnapshot, skillId: string): boolean {
  return actor.skillIds.includes(skillId) && actor.mp >= mpOf(skillId) && !(actor.stateIds ?? []).includes("state_silence");
}
function inv(snap: BattleSnapshot, itemId: string): number {
  return snap.eventState.inventory[itemId] ?? 0;
}

function sensible(snap: BattleSnapshot, actor: BattleBattlerSnapshot): ActorCommand {
  const foes = alive(snap.enemies);
  const friends = alive(snap.actors);
  const dragon = foes.find((e) => e.recordId === DRAGON);
  const me = actor.recordId;
  const hurt = [...friends].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]!;
  // 치유 — 엘레나가 맡고, 위급하면 누구든 약.
  if (me === "actor_fs_elena" && hurt.hp < hurt.maxHp * 0.5 && has(actor, "skill_heal")) return { kind: "skill", skillId: "skill_heal", targetEnemyId: foes[0]!.id, targetActorId: hurt.recordId };
  if (hurt.hp < hurt.maxHp * 0.3) {
    for (const item of ["item_hi_potion", "item_potion"]) if (inv(snap, item) > 0) return { kind: "item", itemId: item, targetEnemyId: foes[0]!.id, targetActorId: hurt.recordId };
  }
  if (actor.mp < 8 && inv(snap, "item_ether") > 0 && me !== "actor_hero") return { kind: "item", itemId: "item_ether", targetEnemyId: foes[0]!.id, targetActorId: me };
  const silenced = friends.find((f) => f.stateIds.includes("state_silence"));
  if (me === "actor_fs_elena" && silenced && silenced.recordId !== me && has(actor, "skill_fs_purify")) return { kind: "skill", skillId: "skill_fs_purify", targetEnemyId: foes[0]!.id, targetActorId: silenced.recordId };

  if (dragon) {
    const pierced = dragon.stateIds.includes(PIERCED);
    const charging = dragon.charging;
    if (me === "actor_hero") {
      if ((!pierced || charging) && has(actor, "skill_hero_rush_pierce")) return { kind: "skill", skillId: "skill_hero_rush_pierce", targetEnemyId: dragon.id };
      if (charging && charging.turnsLeft <= 1) return { kind: "defend" };
      return has(actor, "skill_hero_flame_sword") ? { kind: "skill", skillId: "skill_hero_flame_sword", targetEnemyId: dragon.id } : { kind: "attack", targetEnemyId: dragon.id };
    }
    if (me === "actor_fs_iris") {
      if (!pierced && !actor.charging && has(actor, "skill_gunner_snipe")) return { kind: "skill", skillId: "skill_gunner_snipe", targetEnemyId: dragon.id };
      if (charging && charging.turnsLeft <= 1) return { kind: "defend" };
      return has(actor, "skill_gunner_rapid_fire") ? { kind: "skill", skillId: "skill_gunner_rapid_fire", targetEnemyId: dragon.id } : { kind: "attack", targetEnemyId: dragon.id };
    }
    // 엘레나 — 갈라진 동안만 마법, 아니면 기세 꺾기·방어.
    if (pierced) {
      for (const id of ["skill_mage_gravity", "skill_mage_fireball", "skill_arcane_bolt"]) if (has(actor, id)) return { kind: "skill", skillId: id, targetEnemyId: dragon.id };
    }
    if (charging && charging.turnsLeft <= 1) return { kind: "defend" };
    if (!dragon.stateIds.includes("state_attack_down") && has(actor, "skill_fs_dampen")) return { kind: "skill", skillId: "skill_fs_dampen", targetEnemyId: dragon.id };
    if (hurt.hp < hurt.maxHp * 0.75 && has(actor, "skill_heal")) return { kind: "skill", skillId: "skill_heal", targetEnemyId: dragon.id, targetActorId: hurt.recordId };
    return { kind: "defend" };
  }

  // 무리 — 역할 순으로 고른 표적.
  const target = [...foes].sort((a, b) => roleRank(a) - roleRank(b) || a.hp - b.hp)[0]!;
  const zealous = foes.find((e) => e.stateIds.includes("fs_state_zeal") && !e.stateIds.includes("state_attack_down"));
  if (me === "actor_fs_elena") {
    if (zealous && has(actor, "skill_fs_dampen")) return { kind: "skill", skillId: "skill_fs_dampen", targetEnemyId: zealous.id };
    if (foes.length >= 2) for (const id of ["skill_mage_chain_lightning", "skill_mage_blizzard"]) if (has(actor, id)) return { kind: "skill", skillId: id, targetEnemyId: target.id };
    for (const id of ["skill_mage_fireball", "skill_arcane_bolt"]) if (has(actor, id)) return { kind: "skill", skillId: id, targetEnemyId: target.id };
    return { kind: "attack", targetEnemyId: target.id };
  }
  if (me === "actor_fs_iris") {
    if (target.charging && has(actor, "skill_gunner_butt_strike")) return { kind: "skill", skillId: "skill_gunner_butt_strike", targetEnemyId: target.id };
    if (has(actor, "skill_gunner_rapid_fire")) return { kind: "skill", skillId: "skill_gunner_rapid_fire", targetEnemyId: target.id };
    return { kind: "attack", targetEnemyId: target.id };
  }
  if (foes.length >= 3 && has(actor, "skill_hero_whirlwind")) return { kind: "skill", skillId: "skill_hero_whirlwind", targetEnemyId: target.id };
  for (const id of ["skill_hero_flame_sword", "skill_hero_cross_slash", "skill_sword_slash"]) if (has(actor, id)) return { kind: "skill", skillId: id, targetEnemyId: target.id };
  return { kind: "attack", targetEnemyId: target.id };
}

function choose(policy: Policy, snap: BattleSnapshot, rng: Rng): ActorCommand | undefined {
  const actor = snap.actors.find((a) => a.recordId === snap.activeActorId);
  const foes = alive(snap.enemies);
  if (!actor || foes.length === 0) return undefined;
  if (policy === "sensible") return sensible(snap, actor);
  if (actor.hp <= actor.maxHp * 0.3) for (const item of ["item_hi_potion", "item_potion"]) if (inv(snap, item) > 0) return { kind: "item", itemId: item, targetEnemyId: foes[0]!.id, targetActorId: actor.recordId };
  if (policy === "auto") return chooseAutoBattleCommand(project, snap, rng) ?? { kind: "attack", targetEnemyId: foes[0]!.id };
  if (policy === "masher") {
    // 버튼만 누르는 사람 — 쓸 수 있는 공격 기술 가운데 아무거나(돌진 찌르기·충전 광선포도 우연히 섞인다), 표적은 아무나.
    const usable = actor.skillIds.filter((id) => { const sk = skills.get(id); return sk?.effect.kind === "damage" && !sk.comboActorIds?.length && has(actor, id); });
    const target = foes[Math.floor(rng() * foes.length)]!;
    const pick = usable.length && rng() < 0.75 ? usable[Math.floor(rng() * usable.length)]! : undefined;
    return pick ? { kind: "skill", skillId: pick, targetEnemyId: target.id } : { kind: "attack", targetEnemyId: target.id };
  }
  return { kind: "attack", targetEnemyId: foes[0]!.id };
}

interface Row { troop: string; lv: number; policy: Policy; win: number; turns: number; hpLeft: number; items: number; breaks: string; pages: string }

function run(troopId: string, level: number, policy: Policy, inventory: Record<string, number>, seed = 11): Row {
  const rng = mulberry32(seed);
  let wins = 0, turnsSum = 0, hpSum = 0, itemSum = 0, breaks = 0, charges = 0;
  const fired = new Map<string, number>();
  for (let i = 0; i < n; i += 1) {
    const rt = createBattleRuntime({
      project, troopId, canEscape: false, canLose: true,
      party: { levels: Object.fromEntries(PARTY.map((id) => [id, level])), experience: {}, partyActorIds: [...PARTY] },
      sessionState: { switches: {}, variables: {}, inventory: { ...inventory } },
      captureLocation: { mapId: project.startMapId, x: 0, y: 0 }, rng,
    });
    let turns = 0, items = 0;
    for (let step = 0; step < 9000; step += 1) {
      const snap = headlessBattleSnapshot(rt);
      if (snap.result) break;
      if (snap.phase === "actorCommand") {
        const cmd = choose(policy, snap, rng);
        if (!cmd) { rt.tick(1000); continue; }
        turns += 1;
        if (cmd.kind === "item") items += 1;
        const before = `${snap.activeActorId}|${snap.timeline.length}`;
        rt.performActorCommand(cmd);
        const after = headlessBattleSnapshot(rt);
        // 거절된 명령(대상·자원 부족) — 같은 차례가 그대로면 통상 공격으로 넘긴다.
        if (after.phase === "actorCommand" && `${after.activeActorId}|${after.timeline.length}` === before) {
          if (cmd.kind === "item") items -= 1;
          const foe = alive(after.enemies)[0];
          if (foe) rt.performActorCommand({ kind: "attack", targetEnemyId: foe.id });
        }
      } else rt.tick(1000);
    }
    const end = headlessBattleSnapshot(rt);
    if (end.result === "victory") wins += 1;
    turnsSum += turns; itemSum += items;
    hpSum += end.actors.reduce((s, a) => s + Math.max(0, a.hp), 0) / Math.max(1, end.actors.reduce((s, a) => s + a.maxHp, 0));
    for (const e of end.timeline) {
      if (e.side !== "enemy" || !e.chargeSkillId) continue;
      if (e.chargeStart) charges += 1;
      if (e.chargeBroken) breaks += 1;
    }
    const seen = new Set<string>();
    for (const log of end.eventLogs) if (log.kind === "fired" && !seen.has(log.pageId)) { seen.add(log.pageId); fired.set(log.pageId, (fired.get(log.pageId) ?? 0) + 1); }
  }
  return {
    troop: troopId, lv: level, policy, win: Math.round((wins / n) * 100), turns: Math.round((turnsSum / n) * 10) / 10,
    hpLeft: Math.round((hpSum / n) * 100), items: Math.round((itemSum / n) * 10) / 10,
    breaks: `${breaks}/${charges}`, pages: [...fired].map(([k, v]) => `${k.replace(/^troop_fs_/, "")}:${v}`).join(" "),
  };
}

// ── 한 층씩 이어서(HP·MP·약을 다음 싸움으로) — 지하 2층 → 3층 → 4층 쉼터(전부 회복) → 용 ──
const CHAIN = (process.env.FS_CHAIN ?? [
  "troop_fs_inq_zeal", "troop_fs_inq_shieldwall", "troop_fs_inq_bolts", "troop_fs_inq_false_prisoner",
  "troop_fs_inq_phalanx", "troop_fs_inq_vigil", "troop_fs_inq_patrol", "troop_fs_inq_kennel", "troop_fs_inq_penance", "troop_fs_inq_ledge",
].join(",")).split(",");
const deaths: Record<string, number> = {};
function chain(level: number, policy: Policy, seed: number): { survived: boolean; fights: number; lowest: number; dragon: boolean; potionsLeft: number } {
  const rng = mulberry32(seed);
  const inv: Record<string, number> = { item_potion: 5, item_hi_potion: 1, item_ether: 1 };
  const loot: Record<number, Record<string, number>> = { 5: { item_elixir: 1, item_ether: 2, item_hi_potion: 2 } }; // 지하 3층 막다른 길 상자 둘
  let vitals: Record<string, { hp: number; mp: number }> | undefined;
  let lowest = 1;
  const maxOf: Record<string, { hp: number; mp: number }> = {};
  for (let i = 0; i < CHAIN.length; i += 1) {
    for (const [k, v] of Object.entries(loot[i] ?? {})) inv[k] = (inv[k] ?? 0) + v;
    const res = fight(CHAIN[i]!, level, policy, inv, rng, vitals);
    if (!res.won) { deaths[CHAIN[i]!] = (deaths[CHAIN[i]!] ?? 0) + 1; return { survived: false, fights: i, lowest: 0, dragon: false, potionsLeft: inv.item_potion ?? 0 }; }
    for (const [id, v] of Object.entries(res.max)) maxOf[id] = v;
    vitals = res.vitals;
    // 싸움 사이 — 쓰러진 동료는 불사조 깃(필드)으로 1할, 엘레나 남는 마력으로 치유, 그래도 반 아래면 회복약.
    for (const id of PARTY) {
      const v = vitals[id]!; const m = maxOf[id]!;
      if (v.hp <= 0) v.hp = Math.round(m.hp * 0.1);
    }
    {
      const elena = vitals.actor_fs_elena!;
      while (elena.mp >= 4 + 12) {
        const low = PARTY.map((id) => [id, vitals![id]!] as const).sort((a, b) => a[1].hp / maxOf[a[0]]!.hp - b[1].hp / maxOf[b[0]]!.hp)[0]!;
        if (low[1].hp >= maxOf[low[0]]!.hp * 0.8) break;
        low[1].hp = Math.min(maxOf[low[0]]!.hp, low[1].hp + 72); elena.mp -= 4;
      }
    }
    for (const id of PARTY) {
      const v = vitals[id]!; const m = maxOf[id]!;
      while (v.hp < m.hp * 0.5 && (inv.item_potion ?? 0) > 0) { v.hp = Math.min(m.hp, v.hp + 150); inv.item_potion! -= 1; }
      lowest = Math.min(lowest, v.hp / m.hp);
    }
  }
  // 지하 4층 쉼터 — 기록 결정·샘이 모두 회복한다. 그리고 용.
  // 용 앞 가방 — 지하에서 남긴 것 + 쉼터 전 마을에서 산 몫(체크포인트 dragon 과 같은 6·3·4 를 바닥으로).
  const bag = { ...inv, item_potion: Math.max(6, inv.item_potion ?? 0), item_hi_potion: Math.max(3, inv.item_hi_potion ?? 0), item_ether: Math.max(4, inv.item_ether ?? 0) };
  const dragonRes = fight("troop_fs_dragon", level, policy, bag, rng, undefined);
  return { survived: true, fights: CHAIN.length, lowest, dragon: dragonRes.won, potionsLeft: inv.item_potion ?? 0 };
}

function fight(troopId: string, level: number, policy: Policy, inv: Record<string, number>, rng: Rng, vitals?: Record<string, { hp: number; mp: number }>):
  { won: boolean; vitals: Record<string, { hp: number; mp: number }>; max: Record<string, { hp: number; mp: number }> } {
  const rt = createBattleRuntime({
    project, troopId, canEscape: false, canLose: true,
    party: { levels: Object.fromEntries(PARTY.map((id) => [id, level])), experience: {}, partyActorIds: [...PARTY], ...(vitals ? { vitals } : {}) },
    sessionState: { switches: {}, variables: {}, inventory: inv },
    captureLocation: { mapId: project.startMapId, x: 0, y: 0 }, rng,
  });
  for (let step = 0; step < 9000; step += 1) {
    const snap = headlessBattleSnapshot(rt);
    if (snap.result) break;
    if (snap.phase !== "actorCommand") { rt.tick(1000); continue; }
    const cmd = choose(policy, snap, rng);
    if (!cmd) { rt.tick(1000); continue; }
    const before = `${snap.activeActorId}|${snap.timeline.length}`;
    rt.performActorCommand(cmd);
    const after = headlessBattleSnapshot(rt);
    if (after.phase === "actorCommand" && `${after.activeActorId}|${after.timeline.length}` === before) {
      const foe = alive(after.enemies)[0];
      if (foe) rt.performActorCommand({ kind: "attack", targetEnemyId: foe.id });
    }
  }
  const end = headlessBattleSnapshot(rt);
  for (const [k, v] of Object.entries(end.eventState.inventory)) inv[k] = v;
  return {
    won: end.result === "victory",
    vitals: Object.fromEntries(end.actors.map((a) => [a.recordId, { hp: Math.max(0, a.hp), mp: a.mp }])),
    max: Object.fromEntries(end.actors.map((a) => [a.recordId, { hp: a.maxHp, mp: a.maxMp }])),
  };
}

if (process.env.FS_TRACE) {
  const rng = mulberry32(Number(process.env.FS_TRACE));
  const inv = { item_potion: 6, item_hi_potion: 3, item_ether: 4, item_elixir: 1 };
  const rt = createBattleRuntime({ project, troopId: process.env.FS_TRACE_TROOP ?? "troop_fs_dragon", canEscape: false, canLose: true,
    party: { levels: Object.fromEntries(PARTY.map((id) => [id, Number(process.env.FS_LEVELS ?? 8)])), experience: {}, partyActorIds: [...PARTY] },
    sessionState: { switches: {}, variables: {}, inventory: inv }, captureLocation: { mapId: "x", x: 0, y: 0 }, rng });
  const pol = (process.env.FS_POLICY ?? "sensible") as Policy;
  for (let step = 0; step < 9000; step += 1) {
    const snap = headlessBattleSnapshot(rt);
    if (snap.result) { console.log("RESULT", snap.result, "turn", snap.turn); break; }
    if (snap.phase !== "actorCommand") { rt.tick(1000); continue; }
    const cmd = choose(pol, snap, rng)!;
    rt.performActorCommand(cmd);
  }
  const end = headlessBattleSnapshot(rt);
  for (const e of end.timeline) {
    const r = e as unknown as Record<string, unknown>;
    if (["damage", "healing", "stateAdded", "stateRemoved", "special", "message"].includes(String(r.kind)))
      console.log(String(r.kind).padEnd(12), String(r.userRecordId ?? "").replace(/^(actor_|enemy_fs_)/, "").padEnd(12), String(r.skillName ?? r.stateId ?? "").padEnd(12), String(r.targetId ?? "").padEnd(10), r.amount ?? "", r.message ?? "", r.chargeStart ? "CHARGE" : "", r.chargeBroken ? "BROKEN" : "");
  }
  process.exit(0);
}

if (process.env.FS_RUN) {
  for (const lv of (process.env.FS_LEVELS ?? "8,9").split(",").map(Number)) for (const policy of ["attack", "masher", "auto", "sensible"] as Policy[]) {
    let ok = 0, dragonWins = 0, fightsSum = 0, lowSum = 0;
    for (let i = 0; i < n; i += 1) {
      const r = chain(lv, policy, 100 + i);
      if (r.survived) ok += 1;
      if (r.dragon) dragonWins += 1;
      fightsSum += r.fights; lowSum += r.lowest;
    }
    console.log(JSON.stringify(deaths)); for (const k of Object.keys(deaths)) delete deaths[k];
    console.log(JSON.stringify({ run: "vault", lv, policy, reachB4: Math.round((ok / n) * 100), clearDragon: Math.round((dragonWins / n) * 100), avgFightsWon: Math.round((fightsSum / n) * 10) / 10, lowestHp: Math.round((lowSum / n) * 100) }));
  }
  process.exit(0);
}

const VAULT_TROOPS = (process.env.FS_TROOPS ?? "").split(",").filter(Boolean);
const troops = VAULT_TROOPS[0] === "none" ? [] : VAULT_TROOPS.length ? VAULT_TROOPS : project.database.troops.map((t) => t.id).filter((id) => /troop_fs_(fanatic|inq_)/.test(id));
const fieldInv = { item_potion: 4, item_hi_potion: 1, item_ether: 1 };
const bossInv = { item_potion: 6, item_hi_potion: 3, item_ether: 4, item_elixir: 1 };
const rows: Row[] = [];
const levels = (process.env.FS_LEVELS ?? "8,9").split(",").map(Number);
for (const lv of levels) {
  for (const t of troops) for (const policy of ["attack", "masher", "auto", "sensible"] as Policy[]) rows.push(run(t, lv, policy, fieldInv));
  if (!process.env.FS_NO_DRAGON) for (const policy of ["attack", "masher", "auto", "sensible"] as Policy[]) rows.push(run("troop_fs_dragon", lv, policy, bossInv));
}
for (const r of rows) console.log(JSON.stringify(r));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
void (null as unknown as SkillRecord);
