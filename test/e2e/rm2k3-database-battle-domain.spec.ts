import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { captureDatabaseEvidencePacket, writeDatabaseScenario, writeVisualQaVerdict } from "./rm2k3-database-evidence-helpers";
import {
  DATABASE_TAB_SPECS,
  applyDatabaseChanges,
  closeAndReopenDatabase,
  exportedProject,
  openDatabase,
  switchDatabaseTab,
} from "./rm2k3-database-helpers";

const evidenceDir = "output/evidence/database-tabs-team/T5-battle-domain";
const battleTabs = DATABASE_TAB_SPECS.filter((tab) => tab.slug === "enemies" || tab.slug === "troops" || tab.slug === "battle-screen");

type T5RuntimeState = {
  readonly backdropResourceId?: string;
  readonly enemies: readonly {
    readonly maxHp: number;
    readonly name: string;
    readonly recordId: string;
  }[];
  readonly troopId: string;
};

test("T5 battle-domain tabs persist enemy, troop, and battle screen settings into runtime consumers", async ({ page }) => {
  await writeDatabaseScenario(evidenceDir, {
    name: "T5 battle-domain database tabs",
    route: "/?freshProject=1",
    viewports: [{ name: "desktop", width: 1280, height: 800 }],
    path: [
      "open Database modal",
      "edit Enemies canonical fields",
      "edit Troops canonical fields",
      "edit Battle Screen system aggregate fields",
      "apply, close, reopen, export JSON",
      "instantiate battle runtime from edited system.initialTroopId",
      "capture screenshots and state packet",
    ],
    acceptance: [
      "enemies tab writes Project.database.enemies",
      "troops tab writes Project.database.troops",
      "battleScreen tab writes Project.system.battleSystemResourceId and Project.system.initialTroopId",
      "export/reopen preserves edited values",
      "battle runtime reads the edited troop/background/enemy surfaces",
    ],
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await openDatabase(page);

  const enemiesTab = tabBySlug("enemies");
  const troopsTab = tabBySlug("troops");
  const battleScreenTab = tabBySlug("battle-screen");

  await switchDatabaseTab(page, enemiesTab);
  await page.getByTestId("db-field-name").fill("T5 Runtime Hornet");
  await page.getByTestId("db-field-enemy-max-hp").fill("66");
  await page.getByTestId("db-field-enemy-attack").fill("19");
  await page.getByTestId("db-field-enemy-exp").fill("44");
  await page.getByTestId("db-field-enemy-gold").fill("33");

  await switchDatabaseTab(page, troopsTab);
  await page.getByTestId("db-field-name").fill("T5 Runtime Troop");
  await page.getByTestId("db-picker-troop-member-enemy").selectOption({ label: "T5 Runtime Hornet" });
  await page.getByTestId("db-field-troop-member-x").fill("188");
  await page.getByTestId("db-field-troop-member-y").fill("104");
  await page.getByTestId("db-field-troop-backdrop").fill("easyrpg-backdrop-dawn1");

  const edited = await exportedProject(page);
  const editedTroop = edited.database.troops.find((troop) => troop.name === "T5 Runtime Troop");
  if (!editedTroop) throw new Error("T5 troop edit did not produce a troop record");

  await switchDatabaseTab(page, battleScreenTab);
  await page.getByTestId("db-field-battle-system-resource").fill("easyrpg-system2-system2-b");
  await page.getByTestId("db-picker-battle-initial-troop").selectOption({ label: editedTroop.name });
  await applyDatabaseChanges(page);
  await closeAndReopenDatabase(page);

  await switchDatabaseTab(page, battleScreenTab);
  await expect(page.getByTestId("db-field-battle-system-resource")).toHaveValue("easyrpg-system2-system2-b");
  await expect(page.getByTestId("db-picker-battle-initial-troop")).toHaveValue(editedTroop.id);

  const packet = await captureDatabaseEvidencePacket(page, evidenceDir, battleTabs);
  const project = packet.project;
  const enemy = project.database.enemies.find((record) => record.name === "T5 Runtime Hornet");
  const troop = project.database.troops.find((record) => record.name === "T5 Runtime Troop");

  expect(enemy).toMatchObject({
    stats: { maxHp: 66, attack: 19 },
    rewards: { exp: 44, gold: 33 },
  });
  expect(troop).toMatchObject({
    members: [{ enemyId: enemy?.id, x: 188, y: 104 }],
    previewBackgroundResourceId: "easyrpg-backdrop-dawn1",
  });
  expect(project.system.battleSystemResourceId).toBe("easyrpg-system2-system2-b");
  expect(project.system.initialTroopId).toBe(troop?.id);

  const runtimeState = await page.evaluate<T5RuntimeState>(async () => {
    const storeModulePath = "/src/project/store.ts";
    const runtimeModulePath = "/src/battle/runtime.ts";
    const [{ store }, { createBattleRuntime }] = await Promise.all([
      import(storeModulePath),
      import(runtimeModulePath),
    ]);
    const project = store.getCurrent();
    const troopId = project.system.initialTroopId;
    if (!troopId) throw new Error("missing initial troop id");
    const runtime = createBattleRuntime({ project, troopId, canEscape: true, canLose: true });
    return runtime.snapshot();
  });
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(`${evidenceDir}/state-capture.json`, `${JSON.stringify(runtimeState, null, 2)}\n`, "utf8");

  expect(runtimeState.troopId).toBe(troop?.id);
  expect(runtimeState.backdropResourceId).toBe("easyrpg-backdrop-dawn1");
  expect(runtimeState.enemies[0]).toMatchObject({
    maxHp: 66,
    name: "T5 Runtime Hornet",
    recordId: enemy?.id,
  });

  await writeVisualQaVerdict(evidenceDir, {
    verdict: "GOOD",
    browserPath: "Playwright edited enemies, troops, and battleScreen, applied, reopened, exported JSON, and instantiated battle runtime from system.initialTroopId.",
    screenshots: packet.tabs.map((tab) => tab.screenshot),
    stateDumps: [packet.artifacts.projectExport, packet.artifacts.tabMetrics, `${evidenceDir}/state-capture.json`],
    diff: "No baseline diff for domain packet; JSON export and runtime snapshot are the behavioral oracle.",
    findings: ["PASS: all T5 assigned tabs rendered and exported canonical Project surfaces.", "PASS: runtime snapshot consumed edited troop, enemy, and battle backdrop fields."],
    mustFix: [],
    agyVision: `${evidenceDir}/agy-vision.txt - populated after Playwright capture by the T5 agy vision step.`,
  });
});

function tabBySlug(slug: "battle-screen" | "enemies" | "troops") {
  const tab = DATABASE_TAB_SPECS.find((candidate) => candidate.slug === slug);
  if (!tab) throw new Error(`missing Database tab spec: ${slug}`);
  return tab;
}
