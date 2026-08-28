import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createBlankProject } from "@/project/defaults";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import type { EnemyActionProfile, Project } from "@/project/types";

test.setTimeout(300_000);
test.use({
  serviceWorkers: "block",
  // 프레임 단위 스크린샷은 Phaser 의 rAF 를 멈춰 세워 고유 프레임이 1/4 밖에 안 남는다.
  // 녹화로 바꾸면 실제 60fps 진행을 그대로 받아 고fps GIF 를 만들 수 있다.
  video: { mode: "on", size: { width: 1280, height: 900 } },
});

const EVIDENCE_DIR = resolve(process.cwd(), ".omo/evidence/faction-npc-combat");
const VIDEO_PATH = resolve(EVIDENCE_DIR, "faction-war.webm");
const SAMPLE_INTERVAL_MS = 100;
const SAMPLE_COUNT = 220;
const EXPECTED_COMBATANTS = 8;

const PLAYER_COMBATANT_ID = "__player__";

type ActionEnemyDebug = {
  readonly eventId: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly mode: string;
  readonly factionId: string;
  readonly targetId: string | null;
};

type Side = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly charset: string;
  readonly area: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly damage: number;
  readonly contactDamage: number;
  readonly maxAlive: number;
  readonly maxHp: number;
};

// 야수 피해는 야하게 낮춘다. 플레이어에게만 적대한 진영이라 증거로는 HP 감소만 필요하고,
// 이걸 높게 두면 26초 캡처 도중 파티가 전멸해 HUD 가 사라지고 캡처가 멈춘다(실측으로 그랬다).
const SIDES: readonly Side[] = [
  { id: "bandit", name: "산적", color: "#e0705a", charset: "tex_easyrpg_charset_monster1", area: { x: 4, y: 7, w: 2, h: 3 }, damage: 17, contactDamage: 6, maxAlive: 3, maxHp: 150 },
  { id: "guard", name: "경비병", color: "#6f9fe0", charset: "tex_easyrpg_charset_people1", area: { x: 14, y: 7, w: 2, h: 3 }, damage: 15, contactDamage: 6, maxAlive: 3, maxHp: 160 },
  { id: "beast", name: "야수", color: "#8fd36b", charset: "tex_easyrpg_charset_animal", area: { x: 9, y: 1, w: 3, h: 2 }, damage: 2, contactDamage: 1, maxAlive: 2, maxHp: 130 },
];

function brawler(side: Side): EnemyActionProfile {
  return {
    contactDamage: side.contactDamage,
    moveIntervalMs: 140,
    aggroRange: 20,
    knockbackResist: 1,
    attack: { kind: "melee", windupMs: 240, recoverMs: 160, damage: side.damage, range: 1, cooldownMs: 380 },
  };
}

function buildThreeWayWarProject(): Project {
  const project = createBlankProject();
  project.system.actionCombat = { enabled: true, hud: { stamina: true, enemyHpBars: "always" } };
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("start map missing");
  map.actionCombat = true;
  map.safeZones = [];

  const enemyTemplate = project.database.enemies[0];
  const troopTemplate = project.database.troops[0];
  if (!enemyTemplate || !troopTemplate) throw new Error("database fixture missing");

  map.fieldSpawns = [];
  for (const side of SIDES) {
    project.database.enemies.push({
      ...structuredClone(enemyTemplate),
      id: `enemy_ev_${side.id}`,
      name: side.name,
      factionId: side.id,
      stats: { maxHp: side.maxHp, maxMp: 0, attack: 22, defense: 0, mind: 0, agility: 10 },
      rewards: { ...enemyTemplate.rewards, exp: 5, gold: 5 },
      actionProfile: brawler(side),
    });
    project.database.troops.push({
      ...structuredClone(troopTemplate),
      id: `troop_ev_${side.id}`,
      name: side.name,
      enemyIds: [`enemy_ev_${side.id}`],
      members: [{ enemyId: `enemy_ev_${side.id}`, x: 0, y: 0 }],
    });
    map.fieldSpawns.push({
      id: `spawn_ev_${side.id}`,
      troopId: `troop_ev_${side.id}`,
      area: side.area,
      maxAlive: side.maxAlive,
      respawnSec: 4,
      chase: true,
      factionId: side.id,
      graphic: { sprite: { type: "bundled", id: side.charset }, direction: "down", pattern: 1 },
    });
  }

  // 3자 상호 적대 + 야수만 플레이어에게도 적대.
  // 2팀 태그로는 표현할 수 없는 구조이고, 동시에 행렬이 대상을 **골라서** 적대함을 한 장면에서 증명한다.
  project.factions = {
    defs: SIDES.map((side) => ({ id: side.id, name: side.name, color: side.color })),
    relations: [
      { a: "bandit", b: "guard", stance: -1 },
      { a: "guard", b: "beast", stance: -1 },
      { a: "beast", b: "bandit", stance: -1 },
      { a: "beast", b: "player", stance: -1 },
    ],
  };
  return project;
}

async function actionEnemies(page: Page): Promise<readonly ActionEnemyDebug[]> {
  return page.evaluate(() => (
    (window as unknown as { __oprnActionCombat?: () => { enemies: readonly ActionEnemyDebug[] } | null })
      .__oprnActionCombat?.()?.enemies ?? []
  ));
}

async function playerHpText(page: Page): Promise<string | null> {
  try {
    return await page.getByTestId("action-hud-hp-text").textContent({ timeout: 1500 });
  } catch {
    return null;
  }
}

function hpNumber(text: string): number {
  return Number(text.split("/")[0] ?? "0");
}

test("faction evidence: a three-way NPC war where only one faction is hostile to the player", async ({ page }) => {
  rmSync(EVIDENCE_DIR, { recursive: true, force: true });
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const video = page.video();
  page.on("pageerror", (error) => console.log(`[pageerror] ${error.message}`));

  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, buildThreeWayWarProject());

  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("action-hud")).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => (await actionEnemies(page)).length, { timeout: 20_000 }).toBe(EXPECTED_COMBATANTS);

  const initialHpText = await playerHpText(page);
  expect(initialHpText, "action HUD must be mounted before sampling").not.toBeNull();
  const initialHp = hpNumber(initialHpText ?? "");
  const timeline: { sample: number; atMs: number; playerHp: number; enemies: readonly ActionEnemyDebug[] }[] = [];
  const started = Date.now();

  for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
    const [enemies, hpText] = await Promise.all([actionEnemies(page), playerHpText(page)]);
    // HUD 가 사라지면 파티가 전멸해 게임오버 화면이 뜬 것이다. 300초 토타임아웃을 기다리지 않고 여기서 끝낸다.
    if (hpText === null) throw new Error(`action HUD disappeared at sample ${sample} — the party was wiped, lower beast damage`);
    timeline.push({ sample, atMs: Date.now() - started, playerHp: hpNumber(hpText), enemies });
    await page.waitForTimeout(SAMPLE_INTERVAL_MS);
  }

  const factionOf = new Map<string, string>();
  for (const tick of timeline) for (const enemy of tick.enemies) factionOf.set(enemy.eventId, enemy.factionId);

  const hostilePairs = new Set<string>();
  let beastTargetedPlayer = false;
  const peacefulTowardPlayer = new Set(["bandit", "guard"]);
  const wrongTargeting: string[] = [];

  for (const tick of timeline) {
    for (const enemy of tick.enemies) {
      if (enemy.targetId === null) continue;
      if (enemy.targetId === PLAYER_COMBATANT_ID) {
        if (enemy.factionId === "beast") beastTargetedPlayer = true;
        else if (peacefulTowardPlayer.has(enemy.factionId)) wrongTargeting.push(`${enemy.factionId}->player@${tick.atMs}ms`);
        continue;
      }
      const targetFaction = factionOf.get(enemy.targetId);
      if (targetFaction === undefined || targetFaction === enemy.factionId) continue;
      hostilePairs.add([enemy.factionId, targetFaction].sort().join("|"));
    }
  }

  const aliveCounts = timeline.map((tick) => tick.enemies.length);
  const finalHp = hpNumber((await playerHpText(page)) ?? "0");
  const deaths = timeline.reduce((total, tick, index) => {
    const previous = timeline[index - 1];
    if (!previous) return total;
    const gone = previous.enemies.filter((enemy) => !tick.enemies.some((entry) => entry.eventId === enemy.eventId));
    return total + gone.length;
  }, 0);

  writeFileSync(resolve(EVIDENCE_DIR, "timeline.json"), JSON.stringify({
    capturedAt: new Date().toISOString(),
    sampleCount: SAMPLE_COUNT,
    sampleIntervalMs: SAMPLE_INTERVAL_MS,
    sides: SIDES,
    relations: [
      { a: "bandit", b: "guard", stance: -1 },
      { a: "guard", b: "beast", stance: -1 },
      { a: "beast", b: "bandit", stance: -1 },
      { a: "beast", b: "player", stance: -1 },
    ],
    initialHp,
    finalHp,
    deaths,
    hostilePairs: [...hostilePairs].sort(),
    beastTargetedPlayer,
    wrongTargeting,
    maxAlive: Math.max(...aliveCounts),
    minAlive: Math.min(...aliveCounts),
    timeline,
  }, null, 2));

  // 1) 세 개의 적대 쌍이 모두 실제로 교전했다 — 2팀 태그로는 만들 수 없는 상태.
  expect([...hostilePairs].sort()).toEqual(["bandit|beast", "bandit|guard", "beast|guard"]);
  expect(deaths).toBeGreaterThan(0);
  // 3) 야수는 플레이어를 노렸고 실제로 깎았다.
  expect(beastTargetedPlayer).toBe(true);
  expect(finalHp).toBeLessThan(initialHp);
  // 4) 산적·경비병은 캡처 전체에서 단 한 번도 플레이어를 노리지 않았다 — 행렬이 대상을 고른다.
  expect(wrongTargeting).toEqual([]);

  await page.close();
  if (video) await video.saveAs(VIDEO_PATH);
});
