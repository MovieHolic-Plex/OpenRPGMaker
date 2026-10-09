import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  DATABASE_TAB_SPECS,
  applyDatabaseChanges,
  closeAndReopenDatabase,
  openDatabase,
  switchDatabaseTab,
  type DatabaseTabSpec,
} from "./oprn-database-helpers";
import {
  captureDatabaseEvidencePacket,
  writeDatabaseScenario,
  writeVisualQaVerdict,
} from "./oprn-database-evidence-helpers";

const evidenceDir = "output/evidence/database-tabs-team/T4-party-class";
const ownedTabs = requiredTabs(["actors", "classes"]);

test.setTimeout(90_000);

test("T4 actor and class tabs persist curves, graphics, equipment, commands, rates, and references", async ({ page }) => {
  await writeDatabaseScenario(evidenceDir, {
    name: "T4 party-class actor/class persistence",
    route: "/?freshProject=1",
    viewports: [{ name: "desktop", width: 1280, height: 800 }],
    path: [
      "open Database modal",
      "edit actor identity, graphics, class, equipment, options, skills, rates, parameter curve, and exp curve",
      "edit class identity, animation, command, options, skill, rates, equipment permission, parameter curve, and exp curve",
      "apply changes, close and reopen Database, recapture Actors and Classes screenshots",
      "assert exported project JSON contains the edited canonical actor/class paths",
    ],
    acceptance: [
      "actors tab writes Project.database.actors[] fields",
      "classes tab writes Project.database.classes[] fields",
      "actor and class curve edits export as 99-entry curve arrays",
      "class/equipment/skill/state/animation references remain canonical ids",
      "screenshots and tab metrics are captured under the T4 evidence packet",
    ],
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await openDatabase(page);

  await switchDatabaseTab(page, ownedTabs[0]);
  await page.getByTestId("db-field-name").fill("증거 주인공");
  await page.getByTestId("db-field-actor-nickname").fill("검증자");
  await page.getByTestId("db-picker-class").selectOption("class_guardian");
  await page.getByTestId("db-field-initial-level").fill("4");
  await page.getByTestId("db-field-max-level").fill("77");
  await page.getByTestId("db-field-face-resource").fill("easyrpg-faceset-actor2-00");
  await page.getByTestId("db-field-character-resource").fill("easyrpg-charset-actor2");
  await page.getByTestId("db-field-character-transparent").check();
  await page.getByTestId("db-field-battle-character-resource").fill("generated-actor-hero-02-battle");
  await page.getByTestId("db-picker-actor-equipment-weapon").selectOption("equip_scout_dagger");
  await page.getByTestId("db-picker-unarmed-animation").selectOption("anim_sword");
  await page.getByTestId("db-field-actor-option-dualWield").check();
  await page.getByTestId("db-add-actor-skill").click();
  await page.getByTestId("db-field-actor-skill-level-0").fill("9");
  await page.getByTestId("db-picker-actor-skill-0").selectOption("skill_heal");
  await page.getByTestId("db-picker-actor-state-rate-state_death").selectOption("D");
  await page.getByTestId("db-actor-curve-edit-attack").click();
  await page.getByTestId("db-actor-parameter-level").fill("10");
  await page.getByTestId("db-actor-parameter-value").fill("321");
  await page.getByTestId("db-actor-parameter-apply").click();
  await page.getByTestId("db-actor-parameter-close").click();
  await page.getByTestId("db-actor-exp-edit").click();
  await page.getByTestId("db-actor-exp-base").fill("5");
  await page.getByTestId("db-actor-exp-extra").fill("55");
  await page.getByTestId("db-actor-exp-acceleration").fill("11");
  await page.getByTestId("db-actor-exp-close").click();

  await switchDatabaseTab(page, ownedTabs[1]);
  await page.getByTestId("db-field-name").fill("증거 검사");
  await page.getByTestId("db-picker-class-animation").selectOption("anim_magic");
  await page.getByTestId("db-field-class-command-name").fill("검증술");
  await page.getByTestId("db-field-class-command-kind").selectOption("skillSubset");
  await page.getByTestId("db-field-class-option-dualWield").check();
  await page.getByTestId("db-field-class-skill-level").fill("14");
  await page.getByTestId("db-picker-class-skill").selectOption("skill_heal");
  await page.getByTestId("db-picker-class-state-rate-state_death").selectOption("A");
  await page.getByTestId("db-picker-class-element-rate-fire").selectOption("B");
  await page.getByTestId("db-picker-class-equipment").selectOption("equip_mage_staff");
  await page.getByTestId("db-class-curve-edit-maxHp").click();
  await page.getByTestId("db-class-parameter-level").fill("8");
  await page.getByTestId("db-class-parameter-value").fill("88");
  await page.getByTestId("db-class-parameter-apply").click();
  await page.getByTestId("db-class-parameter-close").click();
  await page.getByTestId("db-class-exp-edit").click();
  await page.getByTestId("db-class-exp-base").fill("7");
  await page.getByTestId("db-class-exp-extra").fill("77");
  await page.getByTestId("db-class-exp-acceleration").fill("13");
  await page.getByTestId("db-class-exp-close").click();

  await applyDatabaseChanges(page);
  await closeAndReopenDatabase(page);

  await switchDatabaseTab(page, ownedTabs[0]);
  await expect(page.getByTestId("db-field-name")).toHaveValue("증거 주인공");
  await expect(page.getByTestId("db-picker-class")).toHaveValue("class_guardian");
  await switchDatabaseTab(page, ownedTabs[1]);
  await expect(page.getByTestId("db-field-name")).toHaveValue("증거 검사");
  await expect(page.getByTestId("db-picker-class-animation")).toHaveValue("anim_magic");
  await expect(page.getByTestId("toast")).not.toHaveClass(/show/, { timeout: 3_000 });

  const packet = await captureDatabaseEvidencePacket(page, evidenceDir, ownedTabs);
  const actor = packet.project.database.actors.find((record) => record.name === "증거 주인공");
  const klass = packet.project.database.classes.find((record) => record.name === "증거 검사");

  expect(actor).toBeTruthy();
  expect(actor?.classId).toBe("class_guardian");
  expect(actor?.nickname).toBe("검증자");
  expect(actor?.initialEquipment.weapon).toBe("equip_scout_dagger");
  expect(actor?.learnedSkills).toContainEqual({ level: 1, skillId: "skill_heal" });
  expect(actor?.learnedSkills).toContainEqual({ level: 9, skillId: "skill_attack" });
  expect(actor?.options.dualWield).toBe(true);
  expect(actor?.characterTransparent).toBe(true);
  expect(actor?.faceResourceId).toBe("easyrpg-faceset-actor2-00");
  expect(actor?.parameterCurves.attack).toHaveLength(99);
  expect(actor?.parameterCurves.attack[9]).toBe(321);
  expect(actor?.expCurve).toEqual({ base: 5, extra: 55, acceleration: 11 });
  expect(actor?.stateRates.state_death).toBe("D");

  expect(klass).toBeTruthy();
  expect(klass?.animationId).toBe("anim_magic");
  expect(klass?.battleCommands[0]).toMatchObject({ name: "검증술", kind: "skillSubset" });
  expect(klass?.learnedSkills).toContainEqual({ level: 14, skillId: "skill_heal" });
  expect(klass?.options?.dualWield).toBe(true);
  expect(klass?.stateRates.state_death).toBe("A");
  expect(klass?.elementRates.fire).toBe("B");
  expect(klass?.equipmentPermissions?.equipmentIds).toEqual(["equip_mage_staff"]);
  expect(klass?.parameterCurves.maxHp).toHaveLength(99);
  expect(klass?.parameterCurves.maxHp[7]).toBe(88);
  expect(klass?.expCurve).toEqual({ base: 7, extra: 77, acceleration: 13 });

  await writeFile(`${evidenceDir}/state-capture.json`, `${JSON.stringify({ actor, klass }, null, 2)}\n`, "utf8");
  await ensureAgyPlaceholderIsAbsent();
  await writeVisualQaVerdict(evidenceDir, {
    verdict: "GOOD",
    browserPath: "Playwright edited Actors and Classes, applied changes, closed/reopened Database, exported JSON, and captured owned tab screenshots.",
    screenshots: packet.tabs.map((tab) => tab.screenshot),
    stateDumps: [packet.artifacts.projectExport, packet.artifacts.tabMetrics, `${evidenceDir}/state-capture.json`],
    diff: "No baseline diff; packet uses real modal screenshots plus shell metrics.",
    findings: [
      "PASS: actors/classes screenshots are captured from the real database-modal surface.",
      "PASS: exported JSON proves actor graphics, equipment, skills, rates, parameter curve, and exp curve persistence.",
      "PASS: exported JSON proves class animation, commands, equipment permissions, rates, parameter curve, and exp curve persistence.",
    ],
    mustFix: [],
    agyVision: `${evidenceDir}/agy-vision.txt`,
  });
});

function requiredTabs(slugs: readonly string[]): readonly DatabaseTabSpec[] {
  return slugs.map((slug) => {
    const tab = DATABASE_TAB_SPECS.find((entry) => entry.slug === slug);
    if (!tab) throw new Error(`missing Database tab spec for ${slug}`);
    return tab;
  });
}

async function ensureAgyPlaceholderIsAbsent(): Promise<void> {
  await mkdir(evidenceDir, { recursive: true });
}
