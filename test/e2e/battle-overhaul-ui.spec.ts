import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { confirmBattleTarget, seedReferenceBattleProject } from "./battleReferenceProject";

const OUT = "output/evidence/battle-overhaul-ui";

test("RM2003 battle overhaul remains keyboard-accessible and unclipped", async ({ page }) => {
  test.setTimeout(90_000);
  await mkdir(OUT, { recursive: true });
  await page.setViewportSize({ width: 360, height: 260 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedReferenceBattleProject(page);
  await mountBattleHarness(page, "gauge");

  const scene = page.getByTestId("battle-scene");
  await expect(scene).toHaveAttribute("data-battle-flow", "gauge");
  await expect(page.locator(".battle-actor-gauge").first()).toBeVisible();
  await expect(page.locator(".battle-key-prompts")).toBeVisible();

  const actorIdentity = await page.evaluate(() => {
    const runtime = (window as typeof window & {
      __battleOverhaulRuntime?: { snapshot(): { actors: readonly { recordId: string; battleCharacterResourceId?: string; faceResourceId?: string }[] } };
    }).__battleOverhaulRuntime;
    return (runtime?.snapshot().actors ?? []).map((actor) => {
      const field = document.querySelector<HTMLElement>(`[data-testid='battle-actor-${actor.recordId}']`);
      const face = document.querySelector<HTMLElement>(`[data-testid='battle-actor-face-${actor.recordId}']`);
      return {
        recordId: actor.recordId,
        runtimeBattle: actor.battleCharacterResourceId,
        fieldBattle: field?.dataset.battleCharsetResourceId,
        authored: field?.dataset.authoredBattler,
        runtimeFace: actor.faceResourceId,
        hudFace: face?.dataset.faceResourceId,
      };
    });
  });
  expect(actorIdentity).toEqual([
    {
      recordId: "actor_hero",
      runtimeBattle: "generated-actor-hero-01-battle",
      fieldBattle: "generated-actor-hero-01-battle",
      authored: "true",
      runtimeFace: "generated-actor-hero-01-face",
      hudFace: "generated-actor-hero-01-face",
    },
    {
      recordId: "actor_guardian",
      runtimeBattle: "generated-actor-hero-02-battle",
      fieldBattle: "generated-actor-hero-02-battle",
      authored: "true",
      runtimeFace: "generated-actor-hero-02-face",
      hudFace: "generated-actor-hero-02-face",
    },
  ]);
  await expect(page.getByTestId("battle-actor-face-actor_hero")).toBeVisible();
  await expect(page.getByTestId("battle-actor-face-actor_guardian")).toBeVisible();

  const mpContract = await page.evaluate(async () => {
    const commandModuleSource = await (await fetch("/src/player/battleCommandDom.ts")).text();
    const storeModuleUrl = /from\s+"([^"]*\/src\/project\/store\.ts)"/.exec(commandModuleSource)?.[1];
    if (!storeModuleUrl) throw new Error("canonical battle store module URL was not found");
    const [{ store }, { battleSkillMpCost, battleSkillUseFailure }] = await Promise.all([
      import(/* @vite-ignore */ storeModuleUrl),
      import("/src/battle/battleSkillUse.ts"),
    ]);
    const runtime = (window as typeof window & {
      __battleOverhaulRuntime?: { snapshot(): { actors: readonly { recordId: string; mp: number; maxMp: number; skillIds: readonly string[] }[]; activeActorId?: string } };
    }).__battleOverhaulRuntime;
    const snapshot = runtime?.snapshot();
    const actor = snapshot?.actors.find((entry) => entry.recordId === snapshot.activeActorId);
    const skill = store.getCurrent().database.skills.find((entry) => entry.id === "skill_fire");
    return {
      actorMp: actor?.mp,
      cost: actor && skill ? battleSkillMpCost(skill, actor.maxMp) : undefined,
      costFlat: skill?.mpCost.flat,
      costPercent: skill?.mpCost.percentMax,
      failure: actor ? battleSkillUseFailure(store.getCurrent(), actor, "skill_fire") : undefined,
    };
  });
  expect(mpContract).toEqual({ actorMp: 0, cost: 999, costFlat: 999, costPercent: 0, failure: "insufficientMp" });

  await page.getByTestId("actor-command-skill").click();
  await expect(page.getByTestId("actor-skill-skill_fire").locator("xpath=ancestor::*[@data-testid='battle-overhaul-host']")).toHaveCount(1);
  const unavailable = page.getByTestId("actor-skill-skill_fire");
  await expect(unavailable).toBeDisabled();
  await expect(unavailable).toHaveAttribute("title", /MP 부족/);
  await expect(unavailable).toHaveAttribute("aria-label", /MP 부족/);
  await page.screenshot({ path: `${OUT}/01-gauge-disabled-skill.png` });

  await page.getByTestId("actor-skill-skill_ally_heal").click();
  await expect(scene).toHaveAttribute("data-battle-phase", "targetSelect");
  await expect(page.locator(".battle-actor[data-battle-targetable='true']")).toHaveCount(2);
  await expect(page.locator(".battle-target-menu [data-battle-target-id]")).toHaveCount(2);
  const firstTarget = await selectedTargetId(page);
  await page.keyboard.press("ArrowRight");
  const secondTarget = await selectedTargetId(page);
  expect(secondTarget).toBeTruthy();
  expect(secondTarget).not.toBe(firstTarget);
  await expect(page.locator(":focus")).toHaveAttribute("data-battle-target-id", secondTarget as string);
  await page.screenshot({ path: `${OUT}/02-ally-target-focus.png` });

  await page.keyboard.press("Escape");
  await expect(scene).toHaveAttribute("data-battle-phase", "actorCommand");
  await expect(page.getByTestId("actor-skill-skill_ally_heal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("actor-command-attack")).toBeVisible();

  // Capture actual combat feedback, not only menu-state contracts. Normal motion
  // keeps the authored attack pose/lunge and damage popup visible long enough to audit.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByTestId("actor-command-attack").click();
  await expect(scene).toHaveAttribute("data-battle-phase", "targetSelect");
  await confirmBattleTarget(page);
  const damagePopup = page.getByTestId("battle-damage-popup");
  await expect(damagePopup).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${OUT}/04-authored-actor-impact.png` });
  await expect(scene).toHaveAttribute("data-battle-sequence-busy", "false", { timeout: 5_000 });
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 5_000 });
  await page.emulateMedia({ reducedMotion: "reduce" });

  const actorEntriesBefore = await actorTimelineCount(page);
  await page.getByTestId("battle-auto-btn").click();
  await expect(page.getByTestId("battle-auto-btn")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => actorTimelineCount(page), { timeout: 5_000 }).toBeGreaterThan(actorEntriesBefore);
  await page.getByTestId("battle-auto-btn").click();
  await expect(page.getByTestId("battle-auto-btn")).toHaveAttribute("aria-pressed", "false");
  await expect(scene).toHaveAttribute("data-battle-sequence-busy", "false", { timeout: 5_000 });

  const gaugeLayout = await layoutDiagnostics(page);
  expect(gaugeLayout.sceneWithinViewport).toBe(true);
  expect(gaugeLayout.commandHorizontalOverflow).toBe(false);
  expect(gaugeLayout.keyPromptWithinPanel).toBe(true);

  await mountBattleHarness(page, "strict");
  await expect(scene).toHaveAttribute("data-battle-flow", "strict");
  await expect(page.getByTestId("battle-strict-flow-status")).toBeVisible();
  await expect(page.locator(".battle-strict-order")).toHaveCount(2);
  await expect(page.locator(".battle-actor-gauge").first()).toBeHidden();
  await expect(page.locator(".battle-key-prompts")).toBeVisible();
  const strictLayout = await layoutDiagnostics(page);
  expect(strictLayout.sceneWithinViewport).toBe(true);
  expect(strictLayout.commandHorizontalOverflow).toBe(false);
  expect(strictLayout.keyPromptWithinPanel).toBe(true);
  expect(strictLayout.strictRowsOrdered).toBe(true);
  await page.screenshot({ path: `${OUT}/03-strict-order-small-viewport.png` });

  await writeFile(
    `${OUT}/layout.json`,
    `${JSON.stringify({ gauge: gaugeLayout, strict: strictLayout, reducedMotion: true, viewport: { width: 360, height: 260 } }, null, 2)}\n`,
    "utf8",
  );
});

async function mountBattleHarness(page: Page, battleFlow: "gauge" | "strict"): Promise<void> {
  await page.evaluate(async (flow) => {
    const commandModuleSource = await (await fetch("/src/player/battleCommandDom.ts")).text();
    const storeModuleUrl = /from\s+"([^"]*\/src\/project\/store\.ts)"/.exec(commandModuleSource)?.[1];
    if (!storeModuleUrl) throw new Error("canonical battle store module URL was not found");
    const [{ store }, { createBattleRuntime }, { mountBattleScene }] = await Promise.all([
      import(/* @vite-ignore */ storeModuleUrl),
      import("/src/battle/runtime.ts"),
      import("/src/player/battleDom.ts"),
    ]);
    const previous = (window as typeof window & { __battleOverhaulController?: { destroy(): void } }).__battleOverhaulController;
    previous?.destroy();

    const project = structuredClone(store.getCurrent());
    const hero = project.database.actors[0];
    const ally = project.database.actors[1];
    const fire = project.database.skills.find((skill) => skill.id === "skill_fire");
    const enemy = project.database.enemies.find((entry) => entry.id === "enemy_slime");
    if (!hero || !ally || !fire || !enemy) throw new Error("battle harness fixture is incomplete");

    project.system.battleUiStyle = "retro2003";
    project.system.startActorIds = [hero.id, ally.id];
    project.session.partyActorIds = [hero.id, ally.id];
    for (const actor of project.database.actors) actor.learnedSkills = [];
    for (const klass of project.database.classes) klass.learnedSkills = [];
    fire.mpCost = { flat: 999, percentMax: 0 };
    project.database.skills = project.database.skills.filter((skill) => skill.id !== "skill_ally_heal");
    project.database.skills.push({
      ...structuredClone(fire),
      id: "skill_ally_heal",
      name: "동료 치유",
      scope: "ally",
      power: 40,
      mpCost: { flat: 0, percentMax: 0 },
      effect: { kind: "healing", statistic: "mind", affects: "hp" },
      stateEffects: [],
    });
    enemy.stats = { ...enemy.stats, maxHp: 9_999, attack: 1, agility: 1 };
    store.replace(project, { preserveEventDrafts: false });

    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      battleFlow: flow,
      activeSlots: 2,
      party: {
        levels: { [hero.id]: 1, [ally.id]: 1 },
        experience: {},
        vitals: { [hero.id]: { hp: 1, mp: 0 }, [ally.id]: { hp: 999, mp: 0 } },
        skillIds: { [hero.id]: ["skill_ally_heal", "skill_fire"], [ally.id]: [] },
        partyActorIds: [hero.id, ally.id],
      },
      rng: () => 0.5,
    });
    for (let index = 0; index < 200 && runtime.snapshot().phase !== "actorCommand" && !runtime.snapshot().result; index += 1) {
      runtime.tick(1_000);
    }
    if (runtime.snapshot().phase !== "actorCommand") throw new Error("battle harness did not reach actor command");

    document.querySelector("[data-testid='battle-overhaul-host']")?.remove();
    const host = document.createElement("div");
    host.dataset.testid = "battle-overhaul-host";
    Object.assign(host.style, {
      background: "#000",
      height: "100vh",
      inset: "0",
      overflow: "hidden",
      position: "fixed",
      width: "100vw",
      zIndex: "99999",
    });
    document.body.append(host);
    const controller = mountBattleScene({ host, runtime, introHold: false, onResult: () => undefined });
    const exposed = window as typeof window & {
      __battleOverhaulController?: { destroy(): void };
      __battleOverhaulRuntime?: typeof runtime;
    };
    exposed.__battleOverhaulController = controller;
    exposed.__battleOverhaulRuntime = runtime;
  }, battleFlow);
}

async function selectedTargetId(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const runtime = (window as typeof window & {
      __battleOverhaulRuntime?: { snapshot(): { targetSelection?: { selectedTargetId?: string } } };
    }).__battleOverhaulRuntime;
    return runtime?.snapshot().targetSelection?.selectedTargetId;
  });
}

async function actorTimelineCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const runtime = (window as typeof window & {
      __battleOverhaulRuntime?: { snapshot(): { timeline: readonly { side?: string }[] } };
    }).__battleOverhaulRuntime;
    return runtime?.snapshot().timeline.filter((entry) => entry.side === "actor").length ?? 0;
  });
}

async function layoutDiagnostics(page: Page) {
  return page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
    const panel = document.querySelector<HTMLElement>(".battle-command-panel");
    const status = document.querySelector<HTMLElement>(".battle-flow-status");
    const menu = panel?.querySelector<HTMLElement>(".battle-command-menu");
    const prompt = panel?.querySelector<HTMLElement>(".battle-key-prompts");
    if (!scene || !panel || !menu || !prompt) throw new Error("battle layout nodes are missing");
    const sceneRect = scene.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const statusRect = status?.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const promptRect = prompt.getBoundingClientRect();
    return {
      scene: rect(sceneRect),
      panel: rect(panelRect),
      status: statusRect ? rect(statusRect) : null,
      menu: rect(menuRect),
      prompt: rect(promptRect),
      sceneWithinViewport:
        sceneRect.left >= -0.5 && sceneRect.top >= -0.5
        && sceneRect.right <= window.innerWidth + 0.5 && sceneRect.bottom <= window.innerHeight + 0.5,
      commandHorizontalOverflow: panel.scrollWidth > panel.clientWidth + 1,
      keyPromptWithinPanel: promptRect.left >= panelRect.left - 0.5 && promptRect.right <= panelRect.right + 0.5
        && promptRect.bottom <= panelRect.bottom + 0.5,
      strictRowsOrdered: !statusRect || (statusRect.bottom <= menuRect.top + 1 && menuRect.bottom <= promptRect.top + 1),
    };

    function rect(value: DOMRect) {
      return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
    }
  });
}
