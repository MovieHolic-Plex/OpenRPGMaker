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

/** 주인공 탭에 다시 들어오면 뷰가 새로 그려져 섹션이 "기본"으로 돌아간다 —
 *  결과 미리보기 링크를 누르려면 "결과" 섹션을 다시 열어야 한다. */
async function openPreviewSection(page: Page): Promise<void> {
  await page.getByTestId("db-actor-tab-preview").click();
  await expect(page.getByTestId("db-actor-build-preview")).toBeVisible();
}

async function openActorBuild(page: Page, actorId: string): Promise<void> {
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-actors").click();
  await page.getByTestId(`db-record-row-${actorId}`).click();
  // 배우 편집기는 섹션 탭으로 갈렸고 기본은 "기본"(identity) 뿐이다 — actorSection() 이
  // key !== "identity" 인 패널에 hidden 을 건다. 결과 미리보기는 "결과" 섹션에 있다.
  await openPreviewSection(page);
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
  // 주인공 목록은 선택 가능한 role=grid 표라 aria-selected 를 쓴다(다른 목록은 aria-pressed).
  await expect(page.getByTestId(`db-record-row-${actor.id}`)).toHaveAttribute("aria-selected", "true");
  await openPreviewSection(page);
  await page.getByTestId(`db-actor-build-open-equipment-${equipment.id}`).click();
  await expect(page.getByTestId("db-tab-items")).toHaveClass(/active/);
  await expect(page.getByTestId(`db-record-row-${equipment.id}`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("db-field-name")).toHaveValue(equipment.name);

  await page.getByTestId("db-tab-actors").click();
  await page.getByTestId(`db-record-row-${actor.id}`).click();
  await openPreviewSection(page);
  await page.getByTestId(`db-actor-build-open-skill-${skill.id}`).click();
  await expect(page.getByTestId("db-tab-skills")).toHaveClass(/active/);
  await expect(page.getByTestId(`db-record-row-${skill.id}`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("db-field-name")).toHaveValue(skill.name);
  await expect(modal).toHaveAttribute("data-party-build-instance", "same");
});

test("Party Studio folds to one/two columns without overlap or horizontal overflow in a 1024px dock", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const { project, actor } = partyBuildFixture();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await seedProjectFromSupabaseCanonical(page, project, "/?freshProject=1");
  await openActorBuild(page, actor.id);
  await page.getByTestId("database-dock-toggle").click();
  await expect(page.locator(".database-modal-backdrop.is-docked")).toBeVisible();

  const actorLayout = await page.evaluate(() => {
    type Rect = { top: number; right: number; bottom: number; left: number };
    const visibleRect = (element: Element): Rect | null => {
      const bounds = element.getBoundingClientRect();
      let rect: Rect = { top: bounds.top, right: bounds.right, bottom: bounds.bottom, left: bounds.left };
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        const ancestorBounds = ancestor.getBoundingClientRect();
        if (style.overflowX !== "visible") {
          rect.left = Math.max(rect.left, ancestorBounds.left);
          rect.right = Math.min(rect.right, ancestorBounds.right);
        }
        if (style.overflowY !== "visible") {
          rect.top = Math.max(rect.top, ancestorBounds.top);
          rect.bottom = Math.min(rect.bottom, ancestorBounds.bottom);
        }
      }
      return rect.right > rect.left && rect.bottom > rect.top ? rect : null;
    };
    const overlaps = (left: Rect | null, right: Rect | null): boolean => Boolean(
      left && right
      && left.left < right.right
      && left.right > right.left
      && left.top < right.bottom
      && left.bottom > right.top,
    );
    const contains = (outer: DOMRect, inner: DOMRect): boolean => (
      inner.left >= outer.left - 1
      && inner.right <= outer.right + 1
      && inner.top >= outer.top - 1
      && inner.bottom <= outer.bottom + 1
    );
    const modal = document.querySelector<HTMLElement>(".database-modal-window");
    const preview = document.querySelector<HTMLElement>(".actor-build-preview-grid");
    const listPane = document.querySelector<HTMLElement>(".oprn-record-actors .oprn-record-list-pane");
    const toolbar = listPane?.querySelector<HTMLElement>(".db-toolbar");
    const hero = document.querySelector<HTMLElement>('[data-testid="db-record-hero"]');
    const build = document.querySelector<HTMLElement>('[data-testid="db-actor-build-preview"]');
    if (!modal || !preview || !listPane || !toolbar || !hero || !build) return null;
    const panels = { recordList: listPane, header: hero, build };
    const panelEntries = Object.entries(panels) as Array<[string, HTMLElement]>;
    const panelOverlaps = panelEntries.flatMap(([leftName, left], index) => (
      panelEntries.slice(index + 1)
        .filter(([, right]) => overlaps(visibleRect(left), visibleRect(right)))
        .map(([rightName]) => `${leftName}:${rightName}`)
    ));
    const protectedTargets = { toolbar, header: hero, build };
    const listPreviewOverlaps = Array.from(listPane.querySelectorAll<HTMLElement>(".db-list-thumb"))
      .flatMap((thumb, index) => Object.entries(protectedTargets)
        .filter(([, target]) => overlaps(visibleRect(thumb), visibleRect(target)))
        .map(([targetName]) => `${index}:${targetName}`));
    const ownContainerEscapes = Array.from(document.querySelectorAll<HTMLElement>(
      ".oprn-record-actors .db-list-thumb img, .oprn-record-actors .actor-sheet-crop",
    )).flatMap((visual, index) => {
      const container = visual.closest<HTMLElement>(".db-list-thumb, .actor-graphic-preview");
      return container && contains(container.getBoundingClientRect(), visual.getBoundingClientRect())
        ? []
        : [index];
    });
    return {
      columns: getComputedStyle(preview).gridTemplateColumns.split(" ").filter(Boolean).length,
      modalOverflow: modal.scrollWidth - modal.clientWidth,
      previewOverflow: preview.scrollWidth - preview.clientWidth,
      panelOverlaps,
      listPreviewOverlaps,
      ownContainerEscapes,
    };
  });
  expect(actorLayout).toEqual({
    columns: 1,
    modalOverflow: 0,
    previewOverflow: 0,
    panelOverlaps: [],
    listPreviewOverlaps: [],
    ownContainerEscapes: [],
  });

  const actorScreenshot = testInfo.outputPath("docked-actor-1024.png");
  await page.getByTestId("database-modal").screenshot({ path: actorScreenshot });
  await testInfo.attach("docked-actor-1024", { path: actorScreenshot, contentType: "image/png" });

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
