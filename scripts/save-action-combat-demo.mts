/** 액션 전투 데모 맵을 저작해 Supabase에 저장하고 재로드로 검증한다. */
import fs from "node:fs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { TILE } from "../src/project/defaults/constants.ts";
import { normalizeEquipmentRecord, normalizeItemRecord, normalizeSkillRecord } from "../src/project/databaseRecordModel.ts";
import type { GameMap, Project } from "../src/project/types.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const MAP_ID = "map_action_demo";
const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID!,
};

const project = await loadProjectFromSupabase(config);
if (!project) throw new Error("project load failed");
console.log("loaded", project.meta?.title);

project.system.actionCombat = {
  enabled: true,
  hud: { stamina: true, enemyHpBars: "damaged" },
};

const slime = project.database.enemies.find((e) => e.id === "enemy_slime");
if (slime) {
  slime.actionProfile = {
    contactDamage: 4,
    attack: { kind: "melee", windupMs: 500, recoverMs: 600, damage: 6, range: 1, cooldownMs: 1500 },
  };
}
const meadow = project.database.enemies.find((e) => e.id === "enemy_meadow_slime");
if (meadow) {
  meadow.actionProfile = {
    contactDamage: 3,
    attack: { kind: "projectile", windupMs: 600, recoverMs: 500, damage: 4, range: 8, cooldownMs: 2000, projectileSpeedTilesPerSec: 6 },
  };
  meadow.stats = { ...meadow.stats, maxHp: 150 };
}
const bat = project.database.enemies.find((e) => e.id === "enemy_cave_bat");
if (bat) {
  bat.actionProfile = {
    contactDamage: 3,
    attack: { kind: "dash", windupMs: 450, recoverMs: 700, damage: 5, range: 5, cooldownMs: 1800 },
  };
  bat.stats = { ...bat.stats, maxHp: 90 };
}

const WEAPON_ID = "equip_action_wood_sword";
project.database.items = (project.database.items ?? []).filter((i) => i.id !== "item_action_wood_sword");
if (!project.database.equipment.some((e) => e.id === WEAPON_ID)) {
  project.database.equipment.push(normalizeEquipmentRecord({
    id: WEAPON_ID,
    name: "연습용 목검",
    slot: "weapon",
    description: "액션 전투용 연습 무기. 스윙 데미지가 조금 오른다.",
    statBonuses: { attack: 3, defense: 0, mind: 0, agility: 0 },
    actionWeapon: { swingDamageBonus: 2 },
  }));
}
const hero = project.database.actors.find((a) => a.id === "actor_hero");
if (hero && project.database.equipment.some((e) => e.id === WEAPON_ID)) {
  hero.initialEquipment = { ...hero.initialEquipment, weapon: WEAPON_ID };
}

const SKILL_ID = "skill_action_wind_shot";
if (!project.database.skills.some((s) => s.id === SKILL_ID)) {
  project.database.skills.push(normalizeSkillRecord({
    id: SKILL_ID,
    name: "바람 탄환",
    description: "전방으로 바람 탄환을 쏜다. (액션 스킬 — Q키)",
    mpCost: { flat: 4, percentMax: 0 },
    actionSkill: { kind: "projectile", damage: 8, range: 8, speedTilesPerSec: 7 },
  }));
}

// 탄약 경제 데모: 9mm 탄환 + 권총 사격(발당 탄환 1발 소모). Q는 첫 번째 습득 액션 스킬을 쏜다.
const AMMO_ID = "item_action_9mm";
if (!project.database.items.some((i) => i.id === AMMO_ID)) {
  project.database.items.push(normalizeItemRecord({
    id: AMMO_ID,
    name: "9mm 탄환",
    description: "권총 탄환. 권총 사격 시 1발 소모.",
    scope: "none",
    price: 2,
    type: "normal",
    occasion: "never",
    consumable: false,
  }));
}
const GUN_SKILL_ID = "skill_action_handgun";
if (!project.database.skills.some((s) => s.id === GUN_SKILL_ID)) {
  project.database.skills.push(normalizeSkillRecord({
    id: GUN_SKILL_ID,
    name: "권총 사격",
    description: "전방으로 총을 쏜다. 9mm 탄환 1발 소모. (액션 스킬 — Q키)",
    mpCost: { flat: 0, percentMax: 0 },
    actionSkill: { kind: "projectile", damage: 12, range: 8, speedTilesPerSec: 9, itemCost: { itemId: AMMO_ID, amount: 1 } },
  }));
}
if (hero && project.database.skills.some((s) => s.id === GUN_SKILL_ID)) {
  const rest = hero.learnedSkills.filter((entry) => entry.skillId !== GUN_SKILL_ID && entry.skillId !== SKILL_ID);
  hero.learnedSkills = [{ level: 1, skillId: GUN_SKILL_ID }, ...rest, { level: 1, skillId: SKILL_ID }];
}
// 시작 인벤토리에 탄환 지급.
project.session.inventory = { ...(project.session.inventory ?? {}), [AMMO_ID]: 12 };
// 킬 스위치 선언.
if (!project.switches.some((sw) => sw.id === "sw_demo_first_kill")) {
  project.switches.push({ id: "sw_demo_first_kill", name: "첫 슬라임 처치" });
}

const width = 24;
const height = 18;
const reference = project.maps["map_lake_village"];
const demoMap: GameMap = {
  id: MAP_ID,
  name: "슬라임 시험 초원",
  width,
  height,
  tilesetId: reference?.tilesetId ?? "easyrpg_chipset_combined_town",
  tileSize: reference?.tileSize ?? 48,
  lowerTiles: new Array(width * height).fill(TILE.GRASS),
  upperTiles: new Array(width * height).fill(-1),
  events: [
    {
      id: `${MAP_ID}_checkpoint_auto`,
      x: 0,
      y: 0,
      trigger: { kind: "auto" as const },
      commands: [],
      pages: [
        {
          id: `${MAP_ID}_checkpoint_auto_page`,
          name: "진입 체크포인트",
          conditions: [{ kind: "selfSwitch" as const, key: "A" as const, value: false }],
          graphic: { transparent: true },
          trigger: { kind: "auto" as const },
          priority: "below" as const,
          overlapForbidden: false,
          animationType: "fixedGraphic" as const,
          movement: { type: "fixed" as const, speed: 3, frequency: 3 },
          commands: [
            { kind: "setSelfSwitch" as const, key: "A" as const, value: true },
            { kind: "checkpointSave" as const, label: "map-entry" },
          ],
        },
      ],
    },
    {
      id: `${MAP_ID}_typewriter`,
      x: 2,
      y: 2,
      trigger: { kind: "action" as const },
      commands: [],
      pages: [
        {
          id: `${MAP_ID}_typewriter_page`,
          name: "타자기(세이브 포인트)",
          conditions: [],
          graphic: { sprite: { type: "bundled" as const, id: "tex_easyrpg_charset_monster1" }, direction: "down" as const, pattern: 36 },
          trigger: { kind: "action" as const },
          priority: "same" as const,
          overlapForbidden: true,
          animationType: "fixedGraphic" as const,
          movement: { type: "fixed" as const, speed: 3, frequency: 3 },
          commands: [
            { kind: "text" as const, body: "타자기다. 진행 상황을 기록한다." },
            { kind: "openSaveMenu" as const },
          ],
        },
      ],
    },
  ],
  encounterRate: 0,
  actionCombat: true,
  fieldSpawns: [
    { id: "spawn_slime_a", troopId: "troop_slime", area: { x: 4, y: 4, w: 6, h: 5 }, maxAlive: 3, respawnSec: 8, chase: true, graphic: { sprite: { type: "bundled" as const, id: "tex_easyrpg_charset_monster1" }, direction: "down" as const, pattern: 1 } },
    { id: "spawn_slime_b", troopId: "troop_slime_pair", area: { x: 14, y: 9, w: 6, h: 5 }, maxAlive: 2, respawnSec: 10, chase: true, persistKill: true, onKillSwitchId: "sw_demo_first_kill", graphic: { sprite: { type: "bundled" as const, id: "tex_easyrpg_charset_monster1" }, direction: "down" as const, pattern: 13 } },
    { id: "spawn_bat_c", troopId: "troop_bat_swarm", area: { x: 4, y: 11, w: 6, h: 4 }, maxAlive: 2, respawnSec: 12, chase: true, graphic: { sprite: { type: "bundled" as const, id: "tex_easyrpg_charset_monster1" }, direction: "down" as const, pattern: 25 } },
  ],
};
project.maps[MAP_ID] = demoMap;
project.startMapId = MAP_ID;
project.startPos = { x: 12, y: 14 };

const tree = project.mapTree as { mapId: string; children: { mapId: string; children: unknown[] }[] };
if (!tree.children.some((node) => node.mapId === MAP_ID)) {
  tree.children.push({ mapId: MAP_ID, children: [] });
}

console.log("saving actionCombat demo…");
const saved = await saveProjectToSupabase(project as Project, config);
console.log("saved:", saved);

const verify = await loadProjectFromSupabase(config);
const map = verify?.maps[MAP_ID];
const checks = {
  systemEnabled: verify?.system.actionCombat?.enabled === true,
  staminaHud: verify?.system.actionCombat?.hud?.stamina === true,
  enemyHpBars: verify?.system.actionCombat?.hud?.enemyHpBars === "damaged",
  mapExists: !!map,
  mapOptIn: map?.actionCombat === true,
  spawnCount: map?.fieldSpawns?.length ?? 0,
  slimeAttack: verify?.database.enemies.find((e) => e.id === "enemy_slime")?.actionProfile?.attack?.kind,
  meadowAttack: verify?.database.enemies.find((e) => e.id === "enemy_meadow_slime")?.actionProfile?.attack?.kind,
  batAttack: verify?.database.enemies.find((e) => e.id === "enemy_cave_bat")?.actionProfile?.attack?.kind,
  heroWeapon: verify?.database.actors.find((a) => a.id === "actor_hero")?.initialEquipment?.weapon,
  heroSkill: verify?.database.actors.find((a) => a.id === "actor_hero")?.learnedSkills?.some((s) => s.skillId === "skill_action_wind_shot") === true,
  weaponProfile: verify?.database.equipment.find((e) => e.id === "equip_action_wood_sword")?.actionWeapon?.swingDamageBonus ?? 0,
  strayItem: (verify?.database.items ?? []).some((i) => i.id === "item_action_wood_sword"),
  slimeProfile: verify?.database.enemies.find((e) => e.id === "enemy_slime")?.actionProfile?.contactDamage ?? 0,
  ammoItem: (verify?.database.items ?? []).some((i) => i.id === "item_action_9mm"),
  gunSkillItemCost: verify?.database.skills.find((s) => s.id === "skill_action_handgun")?.actionSkill?.itemCost?.itemId ?? "",
  heroGunFirst: verify?.database.actors.find((a) => a.id === "actor_hero")?.learnedSkills?.[0]?.skillId === "skill_action_handgun",
  startingAmmo: verify?.session.inventory?.["item_action_9mm"] ?? 0,
  persistKillSpawn: map?.fieldSpawns?.some((s) => s.id === "spawn_slime_b" && s.persistKill === true && s.onKillSwitchId === "sw_demo_first_kill") === true,
  typewriter: map?.events.some((e) => e.id === `${MAP_ID}_typewriter` && e.pages?.[0]?.commands?.some((c) => c.kind === "openSaveMenu")) === true,
  killSwitch: verify?.switches.some((sw) => sw.id === "sw_demo_first_kill") === true,
  inTree: JSON.stringify(verify?.mapTree).includes(MAP_ID),
  startMap: verify?.startMapId,
};
console.log("verify:", JSON.stringify(checks, null, 2));
const ok = checks.systemEnabled && checks.mapExists && checks.mapOptIn && checks.spawnCount === 3 && checks.slimeProfile === 4 && checks.inTree && checks.startMap === MAP_ID
  && checks.slimeAttack === "melee" && checks.meadowAttack === "projectile" && checks.batAttack === "dash"
  && checks.heroWeapon === "equip_action_wood_sword" && checks.heroSkill && checks.weaponProfile === 2 && !checks.strayItem
  && checks.ammoItem && checks.gunSkillItemCost === "item_action_9mm" && checks.heroGunFirst && checks.startingAmmo >= 12
  && checks.persistKillSpawn && checks.typewriter && checks.killSwitch;
if (!ok) process.exit(1);
console.log("RELOAD PROOF OK — project:", config.projectId);
