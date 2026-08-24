import { expect, test, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

function partyBuildFixture() {
  const project = createBlankProject();
  const actor = project.database.actors[1];
  const klass = project.database.classes[1];
  const skill = project.database.skills[1];
  const equipment = project.database.equipment.find((entry, index) => index > 0 && entry.slot === "weapon");
  if (!actor || !klass || !skill || !equipment) throw new Error("Party Studio fixture needs non-first linked records");
  actor.classId = klass.id;
  actor.learnedSkills = [
    { level: 1, skillId: skill.id },
    { level: 1, skillId: "skill_missing_preview" },
  ];
  actor.initialEquipment = {
    weapon: equipment.id,
    accessory: "equip_missing_preview",
  };
  return { project, actor, klass, skill, equipment };
}

async function openActorBuild(page: Page, actorId: string): Promise<void> {
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-actors").click();
  await page.getByTestId(`db-record-row-${actorId}`).click();
  await expect(page.getByTestId("db-actor-build-preview")).toBeVisible();
}

test("Party Studio follows exact non-first records and keeps broken references inert", async ({ page }) => {
  test.setTimeout(120_000);
  const { project, actor, klass, skill, equipment } = partyBuildFixture();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await seedProjectFromSupabaseCanonical(page, project, "/?freshProject=1");
  await openActorBuild(page, actor.id);

  const modal = page.getByTestId("database-modal");
  await modal.evaluate((element) => { element.setAttribute("data-party-build-instance", "same"); });
  await page.getByTestId("db-actor-build-level").fill("99");
  await expect(page.getByTestId("db-actor-build-level")).toHaveValue("99");
  await expect(page.getByTestId("db-actor-build-result")).toHaveAttribute("aria-live", "polite");
  await expect(page.getByTestId("db-actor-build-growth-source")).toHaveAttribute("data-source", "actor-base");
  await expect(page.getByTestId("db-actor-build-warning-skill-skill_missing_preview")).toBeVisible();
  await expect(page.getByTestId("db-actor-build-warning-equipment-equip_missing_preview")).toBeVisible();
  await expect(page.getByTestId("db-actor-build-open-skill-skill_missing_preview")).toHaveCount(0);
  await expect(page.getByTestId("db-actor-build-open-equipment-equip_missing_preview")).toHaveCount(0);

  await page.getByTestId("db-actor-build-open-class").click();
  await expect(page.getByTestId("db-tab-classes")).toHaveClass(/active/);
  await expect(page.getByTestId(`db-record-row-${klass.id}`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("db-field-name")).toHaveValue(klass.name);
  await expect(modal).toHaveAttribute("data-party-build-instance", "same");

  await page.getByTestId(`db-class-build-open-actor-${actor.id}`).click();
  await expect(page.getByTestId(`db-record-row-${actor.id}`)).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId(`db-actor-build-open-equipment-${equipment.id}`).click();
  await expect(page.getByTestId("db-tab-equipment")).toHaveClass(/active/);
  await expect(page.getByTestId(`db-record-row-${equipment.id}`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("db-field-name")).toHaveValue(equipment.name);

  await page.getByTestId("db-tab-actors").click();
  await page.getByTestId(`db-record-row-${actor.id}`).click();
  await page.getByTestId(`db-actor-build-open-skill-${skill.id}`).click();
  await expect(page.getByTestId("db-tab-skills")).toHaveClass(/active/);
  await expect(page.getByTestId(`db-record-row-${skill.id}`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("db-field-name")).toHaveValue(skill.name);
  await expect(modal).toHaveAttribute("data-party-build-instance", "same");
});

test("Party Studio folds to one/two columns without horizontal overflow in a 1024px dock", async ({ page }) => {
  test.setTimeout(120_000);
  const { project, actor } = partyBuildFixture();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await seedProjectFromSupabaseCanonical(page, project, "/?freshProject=1");
  await openActorBuild(page, actor.id);
  await page.getByTestId("database-dock-toggle").click();
  await expect(page.locator(".database-modal-backdrop.is-docked")).toBeVisible();

  const actorLayout = await page.evaluate(() => {
    const modal = document.querySelector<HTMLElement>(".database-modal-window");
    const preview = document.querySelector<HTMLElement>(".actor-build-preview-grid");
    if (!modal || !preview) return null;
    return {
      columns: getComputedStyle(preview).gridTemplateColumns.split(" ").filter(Boolean).length,
      modalOverflow: modal.scrollWidth - modal.clientWidth,
      previewOverflow: preview.scrollWidth - preview.clientWidth,
    };
  });
  expect(actorLayout).toEqual({ columns: 1, modalOverflow: 0, previewOverflow: 0 });

  await page.getByTestId("db-actor-build-open-class").click();
  await expect(page.getByTestId("db-class-build-summary")).toBeVisible();
  const classLayout = await page.evaluate(() => {
    const modal = document.querySelector<HTMLElement>(".database-modal-window");
    const metrics = document.querySelector<HTMLElement>(".db-class-build-metrics");
    const workbench = document.querySelector<HTMLElement>(".db-class-bm88-workbench");
    if (!modal || !metrics || !workbench) return null;
    return {
      metricColumns: getComputedStyle(metrics).gridTemplateColumns.split(" ").filter(Boolean).length,
      workbenchColumns: getComputedStyle(workbench).gridTemplateColumns.split(" ").filter(Boolean).length,
      modalOverflow: modal.scrollWidth - modal.clientWidth,
      summaryOverflow: metrics.parentElement ? metrics.parentElement.scrollWidth - metrics.parentElement.clientWidth : 1,
    };
  });
  expect(classLayout).toEqual({ metricColumns: 2, workbenchColumns: 1, modalOverflow: 0, summaryOverflow: 0 });
});
