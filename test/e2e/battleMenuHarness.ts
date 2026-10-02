// 전투 하네스: 진단 스펙 여러 개가 같은 마운트 경로(정본 store/runtime/battleDom)를 공유한다.
import { expect, type Page } from "@playwright/test";

export interface BattleHarnessOptions {
  readonly skillCount: number;
  readonly enemyMaxHp?: number;
  readonly battleUiStyle?: string;
}

export async function mountBattleHarness(page: Page, options: number | BattleHarnessOptions): Promise<void> {
  const settings = typeof options === "number" ? { skillCount: options } : options;
  await page.evaluate(async ({ skillCount: count, enemyMaxHp, battleUiStyle }) => {
    const commandModuleSource = await (await fetch("/src/player/battleCommandDom.ts")).text();
    const storeModuleUrl = /from\s+"([^"]*\/src\/project\/store\.ts)"/.exec(commandModuleSource)?.[1];
    if (!storeModuleUrl) throw new Error("canonical battle store module URL was not found");
    const runtimeModuleUrl = "/src/battle/runtime.ts";
    const domModuleUrl = "/src/player/battleDom.ts";
    const [{ store }, { createBattleRuntime }, { mountBattleScene }] = await Promise.all([
      import(/* @vite-ignore */ storeModuleUrl),
      import(/* @vite-ignore */ runtimeModuleUrl),
      import(/* @vite-ignore */ domModuleUrl),
    ]);
    const previous = (window as typeof window & { __battleMenuController?: { destroy(): void } }).__battleMenuController;
    previous?.destroy();

    const project = structuredClone(store.getCurrent());
    const hero = project.database.actors[0];
    const ally = project.database.actors[1];
    const base = project.database.skills.find((skill: { id: string }) => skill.id === "skill_fire");
    const enemy = project.database.enemies.find((entry: { id: string }) => entry.id === "enemy_slime");
    if (!hero || !ally || !base || !enemy) throw new Error("battle harness fixture is incomplete");

    project.system.battleUiStyle = battleUiStyle ?? "retro2003";
    project.system.startActorIds = [hero.id, ally.id];
    project.session.partyActorIds = [hero.id, ally.id];
    for (const actor of project.database.actors) actor.learnedSkills = [];
    for (const klass of project.database.classes) klass.learnedSkills = [];

    const probeIds: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const id = `skill_menu_probe_${index}`;
      probeIds.push(id);
      project.database.skills.push({
        ...structuredClone(base),
        id,
        name: `탐침 기술 ${index + 1}`,
        scope: "enemy",
        power: 12,
        mpCost: { flat: 0, percentMax: 0 },
        stateEffects: [],
      });
    }
    enemy.stats = { ...enemy.stats, maxHp: enemyMaxHp ?? 9_999, attack: 1, agility: 1 };
    store.replace(project, { preserveEventDrafts: false });

    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
      activeSlots: 2,
      party: {
        levels: { [hero.id]: 1, [ally.id]: 1 },
        experience: {},
        vitals: { [hero.id]: { hp: 500, mp: 50 }, [ally.id]: { hp: 500, mp: 50 } },
        skillIds: { [hero.id]: probeIds, [ally.id]: [] },
        partyActorIds: [hero.id, ally.id],
      },
      rng: () => 0.5,
    });
    for (let index = 0; index < 200 && runtime.snapshot().phase !== "actorCommand" && !runtime.snapshot().result; index += 1) {
      runtime.tick(1_000);
    }
    if (runtime.snapshot().phase !== "actorCommand") throw new Error("battle harness did not reach actor command");

    document.querySelector("[data-testid='battle-menu-host']")?.remove();
    const host = document.createElement("div");
    host.dataset.testid = "battle-menu-host";
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
    (window as typeof window & { __battleMenuController?: unknown }).__battleMenuController = controller;
  }, { skillCount: settings.skillCount, enemyMaxHp: settings.enemyMaxHp, battleUiStyle: settings.battleUiStyle });
  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("actor-command-attack")).toBeVisible();
}
