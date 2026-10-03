import { expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { deserialize } from "@/project/io";
import { reseedSessionRng } from "@/project/session";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import type { BattleAnimationRecord } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

type BattleProject = ReturnType<typeof deserialize>;
type ReferenceBattleSeedOptions = {
  readonly battleFlow?: BattleProject["system"]["battleFlow"];
  readonly battleUiStyle?: BattleProject["system"]["battleUiStyle"];
};

// 전투 애니메이션 앵커 회귀 가드용 탐침 애니메이션/스킬 id.
// 기존 픽스처의 anim_magic/skill_fire 를 건드리지 않고 별도 레코드를 심어,
// 셀 좌표 (0, 0) 이 곧 '대상 앵커 중심' 인 최소 애니메이션으로 앵커 위치만 검증한다.
const ANCHOR_ANIMATION_ID = "anim_anchor_probe";
const ANCHOR_SKILL_ID = "skill_anchor_probe";

const referenceActors = [
  // 고해상도 단일 초상(generated-face-actor1-bust, 1254×1254)을 얼굴로 쓰지 않는 이유.
  // 이 PNG 는 **이미 키잉돼 있다** — 직접 디코드한 결과 마젠타(#FF00FF) 픽셀 557,995개가 전부
  // 알파 0 이다(불투명 마젠타는 12px 뿐, 좌상단 알파 0). 즉 "크로마키가 안 된 원본" 이라는
  // 이전 주석은 사실이 아니었다. 실제 문제는 투명 픽셀의 RGB 가 여전히 #FF00FF 로 남아 있어서,
  // CSS 배경으로 확대 보간할 때 가장자리에 **마젠타 프린지**가 생긴다는 것이다(실측 스크린샷).
  // 그래서 얼굴 선명도는 48px faceset 해상도에 묶여 있다.
  { id: "actor_hero", name: "아린", battleResourceId: "generated-actor-hero-01-battle", faceResourceId: "generated-actor-hero-01-face-00" },
  { id: "actor_guardian", name: "수호자", battleResourceId: "generated-actor-hero-02-battle", faceResourceId: "generated-actor-hero-02-face-00" },
  // hero-03 은 얼굴 그림이 생성되지 않았다(등록만 있고 파일이 없어 404 였다 —
  // generatedAssetResourceResolver 주석 참조). 실제로 존재하는 RTP 낱장 얼굴을 쓴다.
  { id: "actor_mage", name: "마도사", battleResourceId: "generated-actor-hero-03-battle", faceResourceId: "easyrpg-faceset-actor2-00" },
  { id: "actor_scout", name: "정찰병", battleResourceId: "generated-actor-hero-04-battle", faceResourceId: "easyrpg-faceset-people2-00" },
] as const;

export async function seedReferenceBattleProject(
  page: Page,
  options: ReferenceBattleSeedOptions = {},
): Promise<void> {
  const fixture = await readFile(new URL("../fixtures/projects/battle-v3.json", import.meta.url), "utf8");
  const project = deserialize(fixture);
  prepareReferenceBattleProject(project);
  if (options.battleFlow !== undefined) project.system.battleFlow = options.battleFlow;
  if (options.battleUiStyle !== undefined) project.system.battleUiStyle = options.battleUiStyle;
  await seedProjectForEditor(page, project);
}

export async function seedPokemonLayoutBattleProject(page: Page): Promise<void> {
  const fixture = await readFile(new URL("../fixtures/projects/battle-v3.json", import.meta.url), "utf8");
  const project = deserialize(fixture);
  prepareReferenceBattleProject(project);
  project.system.battleUiStyle = "pokemon";
  const troop = project.database.troops.find((record) => record.id === "troop_slime");
  if (!troop) throw new Error("missing troop_slime fixture");
  troop.enemyIds = ["enemy_slime", "enemy_slime"];
  troop.members = [
    { enemyId: "enemy_slime", x: 105, y: 105, hidden: false },
    { enemyId: "enemy_slime", x: 185, y: 145, hidden: false },
  ];
  await seedProjectForEditor(page, project);
}

export async function seedLayoutResultBattleProject(
  page: Page,
  options: ReferenceBattleSeedOptions = {},
): Promise<void> {
  const fixture = await readFile(new URL("../fixtures/projects/battle-v3.json", import.meta.url), "utf8");
  const project = deserialize(fixture);
  prepareReferenceBattleProject(project);
  if (options.battleFlow !== undefined) project.system.battleFlow = options.battleFlow;
  if (options.battleUiStyle !== undefined) project.system.battleUiStyle = options.battleUiStyle;
  const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
  if (!enemy) throw new Error("missing enemy_slime fixture");
  enemy.stats.maxHp = 14;
  await seedProjectForEditor(page, project);
}

export function prepareReferenceBattleProject(project: BattleProject): void {
  project.system.battleUiStyle = "retro2003";
  project.meta.terms = {
    ...project.meta.terms,
    attack: "공격",
    skill: "스킬",
    item: "아이템",
  };
  setReferenceBattleback(project);
  setReferenceEnemy(project);
  ensureReferenceParty(project);
  reseedSessionRng(project.session as unknown as PlaySessionLike, 42_001);
}

// 애니메이션 앵커 검증용 프로젝트 시드. 참조 전투 준비에 더해, 셀 좌표 (0, 0) 한 개로
// 대상 중심에 찍히는 최소 애니메이션과 그 애니메이션을 쓰는 스킬을 선두 액터에 심는다.
// 기존 prepareReferenceBattleProject 는 그대로 두고 이 함수만 추가로 쓴다.
export async function seedAnimationAnchorBattleProject(page: Page): Promise<void> {
  const fixture = await readFile(new URL("../fixtures/projects/battle-v3.json", import.meta.url), "utf8");
  const project = deserialize(fixture);
  prepareReferenceBattleProject(project);
  ensureAnchorAnimationSkill(project);
  await seedProjectForEditor(page, project);
}

export function prepareAnimationAnchorBattleProject(project: BattleProject): void {
  prepareReferenceBattleProject(project);
  ensureAnchorAnimationSkill(project);
}

export async function startReferenceBattle(page: Page): Promise<void> {
  await page.getByTestId("mode-play").click();
  await page.waitForTimeout(250);
  if (!(await page.getByTestId("test-play-window").isVisible())) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("oprn:test-play-window")));
  }
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.locator('[data-testid="event-battle-start"]')).toBeVisible({ timeout: 5_000 });
  await page.click('[data-testid="event-battle-start"]');
  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 15_000 });
}

export async function confirmBattleTarget(page: Page, enemyId = "enemy-1"): Promise<void> {
  const scene = page.getByTestId("battle-scene");
  const fieldTarget = scene.locator(`.battle-enemy[data-testid='${enemyId}'][data-battle-targetable='true']`);
  if (await fieldTarget.count()) {
    await fieldTarget.click();
    return;
  }
  await scene.getByTestId(`battle-target-${enemyId}`).click();
}

export async function waitForActorCommand(page: Page): Promise<void> {
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "actorCommand", { timeout: 45_000 });
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 5_000 });
}

export async function performBattleAttack(page: Page, enemyId = "enemy-1"): Promise<void> {
  await waitForActorCommand(page);
  await page.getByTestId("actor-command-attack").click();
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "targetSelect");
  await confirmBattleTarget(page, enemyId);
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-director-step", /acting|impact|result/, { timeout: 10_000 });
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-sequence-busy", "false", { timeout: 20_000 });
}

export async function performBattleSkill(page: Page, enemyId = "enemy-1"): Promise<void> {
  await waitForActorCommand(page);
  await expect(page.getByTestId("actor-command-skill")).toBeVisible({ timeout: 5_000 });
  await page.getByTestId("actor-command-skill").click();
  const skillButton = page.getByTestId("actor-skill-skill_fire");
  if (await skillButton.count()) {
    await skillButton.click();
  }
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "targetSelect", { timeout: 10_000 });
  await confirmBattleTarget(page, enemyId);
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-director-step", /acting|impact|result/, { timeout: 10_000 });
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-sequence-busy", "false", { timeout: 20_000 });
}

function ensureReferenceParty(project: BattleProject): void {
  const hero = project.database.actors[0];
  if (!hero) throw new Error("missing actor fixture");
  project.database.actors = referenceActors.map((actor) => ({
    ...hero,
    id: actor.id,
    name: actor.name,
    faceResourceId: actor.faceResourceId,
    battleCharacterResourceId: actor.battleResourceId,
  }));
  project.session.partyActorIds = referenceActors.map((actor) => actor.id);
}

function setReferenceBattleback(project: BattleProject): void {
  const troop = project.database.troops.find((record) => record.id === "troop_slime");
  if (!troop) throw new Error("missing troop_slime fixture");
  troop.previewBackgroundResourceId = "easyrpg-backdrop-sky1";
  troop.enemyIds = ["enemy_slime"];
  troop.members = [{ enemyId: "enemy_slime", x: 112, y: 122, hidden: false }];
}

function setReferenceEnemy(project: BattleProject): void {
  const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
  if (!enemy) throw new Error("missing enemy_slime fixture");
  enemy.name = "달빛 숲 파수군";
  enemy.monsterResourceId = "generated-enemy-sylph-hornet";
  enemy.stats.maxHp = 220;
  enemy.stats.maxMp = 0;
  enemy.stats.attack = 12;
  enemy.stats.defense = 8;
  enemy.stats.mind = 9;
  enemy.stats.agility = 8;
  enemy.rewards = { ...enemy.rewards, exp: 12, gold: 7 };
}

// 앵커 탐침 애니메이션 + 스킬을 프로젝트에 심는다.
// 셀 좌표 (0, 0) 은 시트 중심 = 대상 앵커 중심을 뜻하므로, 셀 중심이 대상 스프라이트
// 앵커에서 크게 벗어나면 앵커 회귀(과거 +120, +120 어긋남)로 판정할 수 있다.
function ensureAnchorAnimationSkill(project: BattleProject): void {
  const anchorAnimation: BattleAnimationRecord = {
    id: ANCHOR_ANIMATION_ID,
    name: "앵커 탐침",
    // scarloxy-battle-anim-scratch 는 Scarloxy 팩에 등록돼 resolveAssetResourceUrl 이 URL 을
    // 돌려준다. URL 이 없으면 battleAnimationDom 가 셀 캔버스를 아예 만들지 않으므로,
    // 실제 존재하는 자산 id 를 써야 셀이 생성된다.
    resourceId: "scarloxy-battle-anim-scratch",
    sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
    scope: "singleTarget",
    position: "center",
    large: false,
    // 1프레임·1셀. x=0, y=0 이라 셀이 시트 중심(= 대상 앵커)에 놓인다.
    frames: [
      {
        cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }],
      },
    ],
  };
  const existingAnimation = project.database.battleAnimations.findIndex((record) => record.id === ANCHOR_ANIMATION_ID);
  if (existingAnimation >= 0) project.database.battleAnimations[existingAnimation] = anchorAnimation;
  else project.database.battleAnimations.push(anchorAnimation);

  const anchorSkill = {
    id: ANCHOR_SKILL_ID,
    name: "앵커 탐침",
    scope: "enemy" as const,
    power: 1,
    animationId: ANCHOR_ANIMATION_ID,
    description: "앵커 검증 전용 탐침 스킬",
    type: "normal" as const,
    // MP 0 소모 — 액터 MP 와 무관하게 항상 사용할 수 있어야 가드가 안정적이다.
    mpCost: { flat: 0, percentMax: 0 },
    successRate: 100,
    variance: 0,
    hitRate: 100,
    effect: { kind: "damage" as const, statistic: "mind" as const, affects: "hp" as const },
  };
  const existingSkill = project.database.skills.findIndex((record) => record.id === ANCHOR_SKILL_ID);
  if (existingSkill >= 0) project.database.skills[existingSkill] = anchorSkill;
  else project.database.skills.push(anchorSkill);

  // 액터가 이 스킬을 배우게 한다.
  // ActorRecord 에는 `skillIds` 가 없다(그건 ClassRecord 쪽 필드다) — 액터의 습득 스킬은
  // `learnedSkills: { level, skillId }[]` 다(src/project/types/database.ts).
  // 배틀러의 `skillIds` 는 battleBattlers.ts:120 → learnedSkillIds() 에서 만들어지고,
  // learnedSkillIds 는 `for (const entry of actor.learnedSkills) if (entry.level <= level)`
  // (battleBattlers.ts:135) 로 습득 스킬을 합집합에 넣는다. 세션의 actorSkillIds 는
  // 시드 집합일 뿐이라(runtime.ts:171 → overrides.skillIds) learnedSkills 는 항상 더해진다.
  // 따라서 level 1 로 심으면 전투 진입 즉시 battleCommandDom.ts:249 가 버튼을 그린다.
  //
  // 파티 전원에게 심는 이유: 참조 파티 4명은 스탯이 동일한 복제라 첫 입력 차례가 누구인지
  // 보장되지 않는다. 전원이 배우고 있으면 어느 액터가 먼저 입력해도 가드가 안정적이다.
  if (project.database.actors.length === 0) throw new Error("missing actor fixture");
  for (const actor of project.database.actors) {
    if (actor.learnedSkills.some((entry) => entry.skillId === ANCHOR_SKILL_ID)) continue;
    actor.learnedSkills = [...actor.learnedSkills, { level: 1, skillId: ANCHOR_SKILL_ID }];
  }
}
