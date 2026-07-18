import { expect, type Locator, type Page } from "@playwright/test";

type Root = Page | Locator;

function rootLocator(root: Root, testId: string): Locator {
  return root.getByTestId(testId);
}

/** Expand a folded event-editor details section when closed (Disposition B progressive disclosure). */
async function expandDetailsSection(root: Root, testId: string): Promise<Locator> {
  const section = rootLocator(root, testId);
  await expect(section).toBeVisible();
  const isOpen = await section.evaluate((node) => node instanceof HTMLDetailsElement && node.open);
  if (!isOpen) {
    await section.locator("summary").first().click();
  }
  await expect
    .poll(async () => section.evaluate((node) => node instanceof HTMLDetailsElement && node.open))
    .toBe(true);
  return section;
}

/** Expand `event-classic-conditions` so condition grid controls are interactable. */
export async function expandEventConditions(root: Root): Promise<Locator> {
  return expandDetailsSection(root, "event-classic-conditions");
}

/** Expand `event-classic-movement-section` so movement/trigger/priority/speed controls are interactable. */
export async function expandEventMovementSection(root: Root): Promise<Locator> {
  return expandDetailsSection(root, "event-classic-movement-section");
}
