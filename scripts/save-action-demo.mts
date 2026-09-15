/**
 * 액션 전투 데모 프로젝트를 저장소의 실제 원격 영속 경로(saveProjectToSupabase)로 저장하고,
 * project id 로 다시 읽어 액션 전투 계약이 왕복을 견뎠는지 검증한다.
 * 실행: npm run content:action:save   (project id 는 OPRN_ACTION_PROJECT_ID 로 덮어쓸 수 있다)
 * scripts/save-stardew-demo.mts 와 같은 패턴 — 로컬 저장은 쓰지 않는다.
 */
import fs from "node:fs";
import path from "node:path";

import {
  ACTION_DEMO_AMMO_ITEM_ID,
  ACTION_DEMO_DASH_ENEMY_ID,
  ACTION_DEMO_MAP_ID,
  ACTION_DEMO_PROJECT_ID,
  ACTION_DEMO_SKILL_IDS,
  ACTION_DEMO_WEAPON_ID,
  createActionCombatDemoProject,
} from "../src/project/defaults/actionCombatDemoProject.ts";
import { isActionCombatMap, normalizeEnemyActionProfile } from "../src/project/actionCombat.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types.ts";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

function loadEnvFiles(filePaths: readonly string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      const key = match?.[1];
      const rawValue = match?.[2];
      if (!key || rawValue === undefined) continue;
      env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

/** 액션 전투 데모 계약. 저작본과 재로드본에 같은 함수를 물려 왕복 손실을 잡는다. */
function inspectActionDemo(project: Project) {
  const map = project.maps[ACTION_DEMO_MAP_ID];
  const combat = project.system.actionCombat;
  const troops = new Map(project.database.troops.map((troop) => [troop.id, troop]));
  const enemies = new Map(project.database.enemies.map((enemy) => [enemy.id, enemy]));
  const spawnedProfiles = (map?.fieldSpawns ?? [])
    .flatMap((spawn) => troops.get(spawn.troopId)?.enemyIds ?? [])
    .map((enemyId) => normalizeEnemyActionProfile(enemies.get(enemyId)?.actionProfile))
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile?.attack));
  const attackKinds = [...new Set(spawnedProfiles.map((profile) => profile.attack!.kind))].sort();
  const hero = project.database.actors.find((actor) => actor.id === "actor_hero");
  const heroLearned = (hero?.learnedSkills ?? []).filter((entry) => entry.level <= (hero?.initialLevel ?? 1)).map((entry) => entry.skillId);
  const actionSkillIds = heroLearned.filter((skillId) => project.database.skills.find((skill) => skill.id === skillId)?.actionSkill != null);
  const flameBolt = project.database.skills.find((skill) => skill.id === ACTION_DEMO_SKILL_IDS[1]);

  const facts = {
    title: project.meta.title,
    startMapId: project.startMapId,
    systemEnabled: combat?.enabled === true,
    dodgeStaminaCost: combat?.dodgeStaminaCost ?? null,
    dodgeIframesMs: combat?.dodgeIframesMs ?? null,
    guardDamageReductionPercent: combat?.guardDamageReductionPercent ?? null,
    guardStaminaDrainPerSec: combat?.guardStaminaDrainPerSec ?? null,
    playerIframesMs: combat?.playerIframesMs ?? null,
    swingCooldownMs: combat?.swingCooldownMs ?? null,
    hudHearts: combat?.hud?.hearts === true,
    hudStamina: combat?.hud?.stamina === true,
    hudEnemyHpBars: combat?.hud?.enemyHpBars ?? null,
    mapOptIn: map?.actionCombat === true,
    actionCombatRoutes: isActionCombatMap(project, map),
    spawnCount: map?.fieldSpawns?.length ?? 0,
    authoredAttackKinds: attackKinds,
    dashEnemyAttack: normalizeEnemyActionProfile(enemies.get(ACTION_DEMO_DASH_ENEMY_ID)?.actionProfile)?.attack?.kind ?? null,
    actionSkillSlotIds: actionSkillIds,
    flameBoltItemCost: flameBolt?.actionSkill?.itemCost?.itemId ?? null,
    ammoInInventory: project.session.inventory?.[ACTION_DEMO_AMMO_ITEM_ID] ?? 0,
    heroWeapon: hero?.initialEquipment?.weapon ?? null,
    weaponSwingBonus: project.database.equipment.find((entry) => entry.id === ACTION_DEMO_WEAPON_ID)?.actionWeapon?.swingDamageBonus ?? null,
  };

  const failures: string[] = [];
  const require = (ok: boolean, label: string) => { if (!ok) failures.push(label); };
  require(facts.systemEnabled, "system.actionCombat.enabled");
  require(facts.mapOptIn, `${ACTION_DEMO_MAP_ID}.actionCombat`);
  require(facts.actionCombatRoutes, "isActionCombatMap");
  require(facts.startMapId === ACTION_DEMO_MAP_ID, "startMapId");
  require(facts.dodgeStaminaCost === 20, "dodgeStaminaCost=20");
  require(facts.dodgeIframesMs === 320, "dodgeIframesMs=320");
  require(facts.guardDamageReductionPercent === 60, "guardDamageReductionPercent=60");
  require(facts.guardStaminaDrainPerSec === 18, "guardStaminaDrainPerSec=18");
  require(facts.playerIframesMs === 700, "playerIframesMs=700");
  require(facts.swingCooldownMs === 300, "swingCooldownMs=300");
  require(facts.hudHearts && facts.hudStamina && facts.hudEnemyHpBars === "damaged", "hud(hearts,stamina,enemyHpBars)");
  require(facts.authoredAttackKinds.length >= 2, "authored attack kinds >= 2");
  require(facts.authoredAttackKinds.includes("melee"), "melee attack");
  require(facts.authoredAttackKinds.includes("projectile"), "projectile attack");
  require(facts.dashEnemyAttack === "dash", "dash attack");
  require(facts.actionSkillSlotIds.length >= 2, "action skills >= 2");
  require(facts.actionSkillSlotIds[0] === ACTION_DEMO_SKILL_IDS[0], `slot1=${ACTION_DEMO_SKILL_IDS[0]}`);
  require(facts.actionSkillSlotIds[1] === ACTION_DEMO_SKILL_IDS[1], `slot2=${ACTION_DEMO_SKILL_IDS[1]}`);
  require(facts.flameBoltItemCost === ACTION_DEMO_AMMO_ITEM_ID, "flame bolt item cost");
  require(facts.ammoInInventory >= 12, "starting ammo >= 12");
  require(facts.heroWeapon === ACTION_DEMO_WEAPON_ID, "hero action weapon");
  require((facts.weaponSwingBonus ?? 0) > 0, "weapon swingDamageBonus");
  return { facts, failures };
}

const lines: string[] = [];
function say(text: string): void {
  lines.push(text);
  console.log(text);
}

const fileEnv = loadEnvFiles([".env", ".env.local"]);
const config = {
  url: (process.env.VITE_SUPABASE_URL ?? fileEnv.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: process.env.VITE_SUPABASE_ANON_KEY ?? fileEnv.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: process.env.OPRN_ACTION_PROJECT_ID ?? ACTION_DEMO_PROJECT_ID,
};
if (!config.url || !config.anonKey) throw new Error("Supabase URL and anon key are required in .env or .env.local");

const transcriptPath = path.join(".omo", "evidence", "action-battle", "p5-demo", "supabase-save-reload.txt");
say(`# action combat demo — supabase save/reload`);
say(`when: ${new Date().toISOString()}`);
say(`project id: ${config.projectId}`);
say(`supabase host: ${new URL(config.url).host}`);
say(`remote persistence: ENABLED (saveProjectToSupabase / loadProjectFromSupabase)`);

const authored = createActionCombatDemoProject();
const authoredReport = inspectActionDemo(authored);
say(`authored facts: ${JSON.stringify(authoredReport.facts, null, 2)}`);
if (authoredReport.failures.length > 0) throw new Error(`authored demo contract broken: ${authoredReport.failures.join(", ")}`);
say(`authored contract: OK`);

say(`saving…`);
const saved = await saveProjectToSupabase(authored, config);
say(`save result: kind=${saved.kind} sha256=${saved.sha256 ?? "-"}`);
if (saved.kind !== "saved") throw new Error(`Supabase save failed: ${saved.kind}`);

say(`reloading by project id…`);
const reloaded = await loadProjectFromSupabase(config);
if (!reloaded) throw new Error(`Supabase reload failed: ${config.projectId}`);
const reloadedReport = inspectActionDemo(reloaded);
say(`reloaded facts: ${JSON.stringify(reloadedReport.facts, null, 2)}`);
if (reloadedReport.failures.length > 0) throw new Error(`reloaded demo contract broken: ${reloadedReport.failures.join(", ")}`);
say(`reload contract: OK`);
say(`RELOAD PROOF OK — project: ${config.projectId} map: ${ACTION_DEMO_MAP_ID}`);

fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });
fs.writeFileSync(transcriptPath, `${lines.join("\n")}\n`, "utf8");
console.log(`transcript: ${transcriptPath}`);
