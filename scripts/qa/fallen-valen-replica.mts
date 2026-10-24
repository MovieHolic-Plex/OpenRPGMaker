// 발렌 전투 — 실제 게임과 같은 경로(QA 체크포인트 세션 → playSceneBattle 과 같은 파티 필드 → 게임 자동 전투 AI)로 돌린 승률.
//   node_modules/.bin/vite-node --script scripts/qa/fallen-valen-replica.mts <level> <n> session
//   R_INV=1 시작 물약을 가진다 · R_NOTHUNDER=1 번개 금지 · R_TRACE=1 진 판 하나 덤프 · R_JSON 레코드 덮어쓰기
import { readFileSync } from "node:fs";
import { createBattleRuntime, headlessBattleSnapshot } from "@/battle/runtime";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
import { sessionFromQaCheckpoint } from "@/player/qaCheckpoint";
import { mulberry32 } from "@/util/rng";
const project = JSON.parse(readFileSync("dist/demos/chrono-bell.project.json", "utf8"));
const patch = JSON.parse(process.env.R_JSON ?? "{}") as Record<string, Record<string, Record<string, unknown>>>;
for (const [table, rows] of Object.entries(patch)) for (const [id, fields] of Object.entries(rows)) {
  const rec = project.database[table].find((r: { id: string }) => r.id === id);
  for (const [k, v] of Object.entries(fields)) if (k === "stats") Object.assign(rec.stats, v); else rec[k] = v;
}
const level = Number(process.argv[2] ?? 15), n = Number(process.argv[3] ?? 20), mode = process.argv[4] ?? "session";
const BASE = { sw_fs_main_started: true, sw_fs_main_step0: true, sw_fs_valen_marched: true, sw_fs_main_step1: true, sw_fs_iris_awake: true, sw_fs_iris_joined: true, sw_fs_valen_crash_on: true };
let wins = 0;
for (let i = 0; i < n; i++) {
  const s = sessionFromQaCheckpoint(project, { id: "r", mapId: "fs_forest", x: 15, y: 9, switches: BASE, party: ["actor_hero", "actor_fs_elena", "actor_fs_iris"].map((actorId) => ({ actorId, level })) } as never);
  if (i === 0) console.log("skills", JSON.stringify(s.actorSkillIds), "equip", JSON.stringify(s.actorEquipment).slice(0, 300), "rows", JSON.stringify(s.actorRows), "states", JSON.stringify(s.actorStateIds));
  const party = mode === "session" ? { levels: s.actorLevels, experience: s.actorExperience, vitals: s.actorVitals, paramBonuses: s.actorParamBonuses, equipment: s.actorEquipment, skillIds: s.actorSkillIds, classOverrides: s.classOverrides, rows: s.actorRows, stateIds: s.actorStateIds, partyActorIds: s.partyActorIds, battleCommands: s.actorBattleCommands }
    : { levels: s.actorLevels, experience: {}, partyActorIds: s.partyActorIds };
  const rng = mulberry32(100 + i);
  const rt = createBattleRuntime({ project, troopId: "troop_fs_valen_crash", canEscape: false, canLose: true, party, sessionState: { switches: { ...s.switches }, variables: { ...s.variables }, inventory: process.env.R_INV ? { item_potion: 6, item_hi_potion: 3, item_ether: 4 } : {} }, captureLocation: { mapId: "fs_forest", x: 0, y: 0 }, rng } as never);
  if (i === 0) console.log("actors", headlessBattleSnapshot(rt).actors.map((a: any) => `${a.name} hp${a.maxHp} ${JSON.stringify(a.effectiveStats)} skills:${(a.skillIds ?? []).length}`).join(" | "));
  for (let k = 0; k < 9000; k++) {
    const snap = headlessBattleSnapshot(rt); if (snap.result) break;
    if (snap.phase !== "actorCommand") { rt.tick(1000); continue; }
    let cmd: any = chooseAutoBattleCommand(project, snap, rng);
    if (process.env.R_NOTHUNDER && cmd?.kind === "skill" && project.database.skills.find((sk: any) => sk.id === cmd.skillId)?.elementId === "thunder") cmd = { kind: "attack", targetEnemyId: snap.enemies.find((e: any) => e.hp > 0 && !e.hidden)!.id };
    rt.performActorCommand(cmd ?? { kind: "attack", targetEnemyId: snap.enemies.find((e: any) => e.hp > 0)!.id } as never);
  }
  const fin = headlessBattleSnapshot(rt);
  if (fin.result === "victory") wins++;
  const fired = new Set(fin.eventLogs.filter((l: any) => l.kind === "fired").map((l: any) => String(l.pageId).replace(/^troop_fs_valen_crash_/, "")));
  if (fin.result !== "victory") {
    const dmg: Record<string, number> = {}; const cnt: Record<string, number> = {};
    for (const r of fin.roundLogs) for (const a of r.actions) if (a.side === "enemy" && typeof a.amount === "number") { const k = `${a.userRecordId.replace("enemy_fs_valen", "V")}:${a.skillName ?? a.commandKind}`; dmg[k] = (dmg[k] ?? 0) + a.amount; cnt[k] = (cnt[k] ?? 0) + 1; }
    const ag = (globalThis as any).__dmg ??= {}; for (const k of Object.keys(dmg)) { ag[k] ??= [0, 0]; ag[k][0] += dmg[k]!; ag[k][1] += cnt[k]!; }
  }
  if (process.env.R_TRACE && fin.result !== "victory" && !fired.has("p3") && !(globalThis as any).__traced) {
    (globalThis as any).__traced = true;
    for (const r of fin.roundLogs) console.log("R" + r.round, r.actions.map((a: any) => `${a.side === "enemy" ? a.userRecordId.replace("enemy_fs_valen", "V") : a.userRecordId.replace("actor_", "")}>${a.skillName ?? a.commandKind}${a.amount !== undefined ? "=" + a.amount : ""}${a.targetId ? "@" + String(a.targetId).slice(-6) : ""}`).join(" "));
    console.log("fired", [...fired].join(","), "enemies", fin.enemies.map((e: any) => `${e.recordId.replace("enemy_fs_valen", "V")}:${e.hp}/${e.maxHp}${e.hidden ? "(h)" : ""}[${e.stateIds.join("+")}]`).join(" "));
  }
  const stage = fired.has("p3") ? "p3" : fired.has("p2") ? "p2" : "p1";
  (globalThis as any).__st ??= {}; const st = (globalThis as any).__st; st[stage + (fin.result === "victory" ? "W" : "L")] = (st[stage + (fin.result === "victory" ? "W" : "L")] ?? 0) + 1;
}
console.log(mode, "lv", level, "win", wins / n, JSON.stringify((globalThis as any).__st));
for (const [k, [d, c]] of Object.entries((globalThis as any).__dmg ?? {}) as any) console.log("  ", k, "hits", c, "avg", Math.round(d / c), "total/loss", Math.round(d / Math.max(1, n - wins)));
