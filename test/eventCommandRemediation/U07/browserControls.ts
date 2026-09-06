import assert from "node:assert/strict";
import type { Locator, Page } from "@playwright/test";
import { observeEditorAction } from "../../e2e/eventCommandRemediationHarness";
import { VIEWPORTS } from "./editorFixture";

export const dialog = (page: Page) => page.getByTestId("event-command-edit-dialog");

export async function choose(scope: Locator, id: string, value: string) {
  const native = scope.getByTestId(id);
  const index = await native.evaluate((node, value) => {
    if (!(node instanceof HTMLSelectElement)) throw new Error("Expected select");
    return [...node.options].findIndex(option => option.value === value);
  }, value);
  assert.ok(index >= 0, `${id}: missing ${value}`);
  await scope.locator(`[data-custom-select-for="${id}"]`).click();
  await observeEditorAction(scope.page(), { timeoutMs: 15_000,
    event: { selector: `[data-testid="event-command-edit-dialog"] [data-testid="${id}"]`, type: "change" },
    observe: [{ source: "dom", selector: `[data-testid="event-command-edit-dialog"] [data-testid="${id}"]`, read: "property", name: "value", equals: value }],
  }, () => scope.page().locator(`.event-custom-select-popover button[data-option-index="${index}"]`).click());
}

export async function labeledInput(scope: Locator, id: string, value: string) {
  const input = scope.getByTestId(id);
  const label = input.locator("xpath=ancestor::*[contains(concat(' ',normalize-space(@class),' '),' field ')][1]/label");
  assert.equal(await label.evaluate(node => node instanceof HTMLLabelElement && node.control?.getAttribute("data-testid")), id);
  const name = await label.textContent(); assert.ok(name);
  await scope.getByLabel(name, { exact: true }).fill(value);
  await input.press("Tab");
}

export async function geometry(scope: Locator, focus: Locator, out: string) {
  const page = scope.page(); const observations = [];
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport); await focus.focus();
    const bounds = await scope.evaluate(node => ({
      overflow: node.scrollWidth > node.clientWidth,
      focused: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.getAttribute("data-custom-select-for"),
      controls: [...node.querySelectorAll('[data-testid="event-command-edit-ok"], [data-testid="event-command-edit-cancel"]')].map(control => {
        const r = control.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      }),
    }));
    assert.equal(bounds.overflow, false); assert.ok(bounds.focused);
    await page.screenshot({ path: `${out}-${viewport.width}.png` });
    // The existing subdialog body owns scrolling; actions are not a sticky footer.
    // Check actual keyboard reachability, not simultaneous visibility with the top input.
    const reachable = [];
    for (const id of ["event-command-edit-ok", "event-command-edit-cancel"]) {
      const action = scope.getByTestId(id); await action.focus(); await action.scrollIntoViewIfNeeded();
      const r = await action.boundingBox(); assert.ok(r);
      assert.ok(r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.x + r.width <= viewport.width && r.y + r.height <= viewport.height);
      assert.equal(await action.evaluate(node => node === document.activeElement), true); reachable.push({ id, ...r });
    }
    observations.push({ viewport, ...bounds, reachable });
    await focus.focus();
  }
  return observations;
}
