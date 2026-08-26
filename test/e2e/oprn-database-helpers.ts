import { expect, type Locator, type Page } from "@playwright/test";

export type DatabaseTabSpec = {
  readonly label: string;
  readonly slug: string;
  readonly testId: string;
};

export const DATABASE_TAB_SPECS = [
  { label: "Overview", slug: "overview", testId: "db-tab-overview" },
  { label: "Actors", slug: "actors", testId: "db-tab-actors" },
  { label: "Classes", slug: "classes", testId: "db-tab-classes" },
  { label: "Skills", slug: "skills", testId: "db-tab-skills" },
  { label: "Items", slug: "items", testId: "db-tab-items" },
  { label: "Equipment", slug: "equipment", testId: "db-tab-equipment" },
  { label: "Enemies", slug: "enemies", testId: "db-tab-enemies" },
  { label: "Monster Species", slug: "monster-species", testId: "db-tab-monster-species" },
  { label: "Troops", slug: "troops", testId: "db-tab-troops" },
  { label: "Elements", slug: "elements", testId: "db-tab-elements" },
  { label: "States", slug: "states", testId: "db-tab-states" },
  { label: "Animations", slug: "animations", testId: "db-tab-animations" },
  { label: "Battle Screen", slug: "battle-screen", testId: "db-tab-battle-screen" },
  { label: "Battle Commands", slug: "battle-commands", testId: "db-tab-battle-commands" },
  { label: "Terrain", slug: "terrain", testId: "db-tab-terrain" },
  { label: "Crops", slug: "crops", testId: "db-tab-crops" },
  { label: "Characters", slug: "characters", testId: "db-tab-characters" },
  { label: "Life Crafting", slug: "life-crafting", testId: "db-tab-life-crafting" },
  { label: "Daily Weather", slug: "daily-weather", testId: "db-tab-daily-weather" },
  { label: "Farm Animals", slug: "farm-animals", testId: "db-tab-farm-animals" },
  { label: "Farm Spatial", slug: "farm-spatial", testId: "db-tab-farm-spatial" },
  { label: "Life Collections", slug: "life-collections", testId: "db-tab-life-collections" },
  { label: "Tilesets", slug: "tilesets", testId: "db-tab-tilesets" },
  { label: "Structure Kits", slug: "structure-kits", testId: "db-tab-structure-kits" },
  { label: "Common Events", slug: "common-events", testId: "db-tab-common-events" },
  { label: "System", slug: "system", testId: "db-tab-system" },
  { label: "Terms", slug: "terms", testId: "db-tab-terms" },
  { label: "Switches", slug: "switches", testId: "db-tab-switches" },
  { label: "Variables", slug: "variables", testId: "db-tab-variables" },
] as const satisfies readonly DatabaseTabSpec[];

export type DatabaseShellMetrics = {
  readonly bodyTop: number;
  readonly modalBodyScrollTop: number;
  readonly modalHeight: number;
  readonly modalWidth: number;
  readonly tabsTop: number;
  readonly tabsWidth: number;
};

export type ExportedProject = {
  database: {
    actors: {
      name: string;
      nickname: string;
      classId: string;
      parameterCurves: Record<string, number[]>;
      expCurve: { base: number; extra: number; acceleration: number };
      initialEquipment: Record<string, string | undefined>;
      learnedSkills: { level: number; skillId: string }[];
      options: { autoBattle?: boolean; dualWield: boolean; fixedEquipment?: boolean; mightyGuard?: boolean };
      faceResourceId?: string;
      characterResourceId?: string;
      battleCharacterResourceId?: string;
      characterTransparent: boolean;
      stateRates: Record<string, string>;
      elementRates?: Record<string, string>;
    }[];
    classes: {
      name: string;
      learnedSkills: { level: number; skillId: string }[];
      battleCommands: { name: string; kind: string }[];
      parameterCurves: Record<string, number[]>;
      expCurve: { base: number; extra: number; acceleration: number };
      options?: { dualWield: boolean; autoBattle: boolean; fixedEquipment: boolean; mightyGuard: boolean };
      animationId?: string;
      equipmentPermissions?: { actorIds: string[]; classIds: string[]; equipmentIds: string[] };
      stateRates: Record<string, string>;
      elementRates: Record<string, string>;
    }[];
    skills: { id: string; name: string; description: string; mpCost: { flat: number; percentMax: number }; successRate: number }[];
    items: {
      id: string;
      name: string;
      price: number;
      skillId?: string;
      switchId?: string;
      description: string;
      type: string;
      occasion: string;
      consumable: boolean;
      consumptionLimit?: number;
      scope?: string;
      hpRecovery?: { percentMax: number; flat: number };
      mpRecovery?: { percentMax: number; flat: number };
      onlyUsableInMenu?: boolean;
      usageMessage?: string;
      equipmentProfile?: {
        twoHanded?: boolean;
        mpCost?: number;
        accuracy?: number;
        statBonuses?: { attack?: number; defense?: number; mind?: number; agility?: number };
        equippableActorIds?: string[];
        attackElementIds?: string[];
        stateInflictIds?: string[];
      };
    }[];
    equipment: { name: string; description: string; statBonuses: { attack: number; defense: number }; cursed: boolean; usableAsItemSkillId?: string }[];
    enemies: {
      id: string;
      name: string;
      monsterResourceId?: string;
      transparent?: boolean;
      flying?: boolean;
      criticalHit?: { enabled: boolean; oneIn: number };
      attackOptions?: { normalAttacksMiss: boolean };
      stats: { maxHp: number; maxMp?: number; attack: number; defense?: number; mind?: number; agility?: number };
      rewards: { exp: number; gold?: number; dropItemId?: string; dropRatePercent?: number };
      actions: {
        skillId: string;
        priority?: number;
        condition?: { kind: string; start?: number; interval?: number };
        switchOnAfterAction?: { enabled: boolean; switchId?: string };
        switchOffAfterAction?: { enabled: boolean; switchId?: string };
      }[];
      stateRates?: Record<string, string>;
      elementRates?: Record<string, string>;
    }[];
    troops: {
      id: string;
      name: string;
      enemyIds: string[];
      members?: { enemyId: string; x: number; y: number; hidden?: boolean }[];
      previewBackgroundResourceId?: string;
      battleEventPages?: { conditions: { kind: string; actorId?: string; commandId?: string }[]; commands: { kind: string; commandId?: string; fields?: Record<string, unknown> }[] }[];
    }[];
    elements?: { id: string; name: string; kind: string; rateLabels: string[]; damageMultipliers: Record<string, number> }[];
    states: { name: string }[];
    terrains?: {
      id: string;
      name: string;
      damage: number;
      encounterRatePercent: number;
      battleBackgroundResourceId?: string;
      characterDisplay: string;
      footstepSoundResourceId?: string;
      vehiclePassage: { airshipLand: boolean; boat: boolean; ship: boolean };
    }[];
    battleAnimations: {
      large?: boolean;
      name: string;
      resourceId?: string;
      sheet?: { frameWidth: number; frameHeight: number; columns: number };
      scope?: string;
      position?: string;
    }[];
    battleCommands?: { id: string; name: string; kind: string; skillId?: string; skillSubsetName?: string }[];
  };
  commonEvents: {
    id: string;
    name: string;
    trigger: string;
    conditionSwitchId?: string;
    commands: { kind: string; body?: string }[];
  }[];
  meta: { terms: { attack?: string; gold: string; hp?: string; item?: string; level?: string; mp?: string; skill?: string } };
  session: { partyActorIds: string[]; switches: Record<string, boolean>; variables: Record<string, number> };
  switches: { id: string; name: string }[];
  system: {
    battleSystemResourceId?: string;
    initialTroopId?: string;
    startActorIds: string[];
    systemResourceId?: string;
    titleResourceId?: string;
    titleScreen?: {
      backgroundResourceId?: string;
      layout: { menuX: number; menuY: number; titleX: number; titleY: number };
      menuLabels: { continueGame: string; newGame: string; quit: string };
      title: string;
    };
  };
  tilesets: Record<string, {
    name: string;
    terrain: number[];
    tileMeta?: { label?: string; description?: string; source?: string }[];
  }>;
  variables: { id: string; name: string }[];
};

export async function exportedProject(page: Page): Promise<ExportedProject> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export json");
  const debug = JSON.parse(text) as { project: ExportedProject };
  return debug.project;
}

export async function openDatabase(page: Page): Promise<void> {
  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
}

export async function closeAndReopenDatabase(page: Page): Promise<void> {
  await page.getByTestId("database-modal-close").click();
  await expect(page.getByTestId("database-modal")).toBeHidden();
  await openDatabase(page);
}

export async function applyDatabaseChanges(page: Page): Promise<void> {
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await expect(page.getByTestId("database-footer-apply")).toBeVisible();
  await page.getByTestId("database-footer-apply").click();
  await expect(page.getByTestId("db-footer-status")).toContainText("적용했습니다");
}

export async function switchDatabaseTab(page: Page, tab: DatabaseTabSpec): Promise<void> {
  await page.getByTestId(tab.testId).click({ force: true });
  await expect(page.getByTestId(tab.testId)).toHaveClass(/active/);
}

export async function captureDatabaseShellMetrics(page: Page): Promise<DatabaseShellMetrics> {
  return page.evaluate(() => {
    const modal = document.querySelector('[data-testid="database-modal"]');
    const modalBody = document.querySelector(".database-modal-body");
    const tabs = document.querySelector(".database-modal-body .db-tabs");
    const body = document.querySelector(".database-modal-body .db-body");

    if (
      !(modal instanceof HTMLElement) ||
      !(modalBody instanceof HTMLElement) ||
      !(tabs instanceof HTMLElement) ||
      !(body instanceof HTMLElement)
    ) {
      throw new Error("Database shell is missing required layout elements");
    }

    const modalRect = modal.getBoundingClientRect();

    return {
      bodyTop: Math.round(body.getBoundingClientRect().top),
      modalBodyScrollTop: Math.round(modalBody.scrollTop),
      modalHeight: Math.round(modalRect.height),
      modalWidth: Math.round(modalRect.width),
      tabsTop: Math.round(tabs.getBoundingClientRect().top),
      tabsWidth: Math.round(tabs.getBoundingClientRect().width),
    };
  });
}

export async function expectReadableControl(locator: Locator, label: string): Promise<void> {
  await expect(locator, label).toBeVisible();
  const metrics = await locator.evaluate((node) => {
    if (!(node instanceof HTMLElement)) throw new Error("readability target must be an element");
    return {
      text: node.textContent?.trim() ?? "",
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
    };
  });
  expect(metrics.text.length, `${label} text`).toBeGreaterThan(0);
  expect(metrics.clientWidth, `${label} width`).toBeGreaterThan(20);
  expect(metrics.scrollWidth, `${label} horizontal clipping`).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.scrollHeight, `${label} vertical clipping`).toBeLessThanOrEqual(metrics.clientHeight + 1);
}
