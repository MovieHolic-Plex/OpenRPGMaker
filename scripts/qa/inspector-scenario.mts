import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page } from "playwright";
import { placeCompilerFixture } from "../../test/support/spatialPlaceCompilerFixture";

/** Geometry evidence only; visibility means viewport/overflow clipping, not a visual verdict. */
async function measureInspector(page: Page) {
  return page.evaluate(() => {
    const required = <T extends HTMLElement>(selector: string, constructor: { new(): T }) => {
      const matches = document.querySelectorAll(selector);
      const element = matches.item(0);
      if (matches.length !== 1 || !(element instanceof constructor)) {
        throw new Error(`Required unique inspector evidence element: ${selector} (${matches.length})`);
      }
      return element;
    };
    const inspector = required('[data-testid="spatial-inspector"].spatial-object-inspector', HTMLElement);
    const modal = required('[data-testid="database-modal"] .database-modal-window', HTMLElement);
    const footer = required('[data-testid="database-modal"] .database-modal-footer', HTMLElement);
    const field = required('[data-testid="spatial-object-chip-custom"]', HTMLInputElement);
    const label = required('.spatial-object-field:has(> [data-testid="spatial-object-chip-custom"]) > span', HTMLElement);
    const labelContainer = required('.spatial-object-field:has(> [data-testid="spatial-object-chip-custom"])', HTMLLabelElement);
    const close = required('[data-testid="database-footer-ok"]', HTMLButtonElement);
    const save = required('[data-testid="database-footer-apply"]', HTMLButtonElement);
    const help = required('.database-modal-footer > button.tertiary', HTMLButtonElement);
    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height,
        top: box.top, right: box.right, bottom: box.bottom, left: box.left };
    };
    const intersection = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => {
      const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return { intersects: width > 0 && height > 0, width, height, area: width * height };
    };
    const measure = (element: HTMLElement) => {
      const box = rect(element);
      const style = getComputedStyle(element);
      let left = Math.max(0, box.left), top = Math.max(0, box.top);
      let right = Math.min(innerWidth, box.right), bottom = Math.min(innerHeight, box.bottom);
      let displayed = true;
      const clippingAncestors: { readonly classes: string; readonly overflowX: string; readonly overflowY: string }[] = [];
      for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
        const computed = getComputedStyle(ancestor);
        displayed &&= computed.display !== "none" && computed.visibility === "visible" && Number(computed.opacity) > 0;
        if (ancestor === element) continue;
        const bounds = rect(ancestor);
        const clipsX = computed.overflowX !== "visible";
        const clipsY = computed.overflowY !== "visible";
        if (clipsX || clipsY) clippingAncestors.push({ classes: ancestor.className,
          overflowX: computed.overflowX, overflowY: computed.overflowY });
        if (clipsX) {
          left = Math.max(left, bounds.left + ancestor.clientLeft);
          right = Math.min(right, bounds.left + ancestor.clientLeft + ancestor.clientWidth);
        }
        if (clipsY) {
          top = Math.max(top, bounds.top + ancestor.clientTop);
          bottom = Math.min(bottom, bounds.top + ancestor.clientTop + ancestor.clientHeight);
        }
      }
      const visibleWidth = Math.max(0, right - left), visibleHeight = Math.max(0, bottom - top);
      const center = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return {
        tag: element.tagName, id: element.id, classes: element.className, rect: box,
        matchesShellHeightSelector: element.matches('.database-modal-backdrop .db-map-content > .spatial-shell'),
        computed: { display: style.display, height: style.height, minHeight: style.minHeight,
          maxHeight: style.maxHeight, overflow: style.overflow, overflowX: style.overflowX,
          overflowY: style.overflowY, flex: style.flex, flexGrow: style.flexGrow,
          flexShrink: style.flexShrink, flexBasis: style.flexBasis, flexDirection: style.flexDirection,
          visibility: style.visibility, opacity: style.opacity, position: style.position },
        clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop,
        scrollLeft: element.scrollLeft, maxScrollTop: Math.max(0, element.scrollHeight - element.clientHeight),
        visibility: { displayed, clippingAncestors, visibleRect: { left, top, width: visibleWidth, height: visibleHeight },
          geometryFullyVisible: displayed && box.width > 0 && box.height > 0 &&
            visibleWidth >= box.width && visibleHeight >= box.height,
          centerHitWithinElement: center !== null && element.contains(center),
          centerHit: center ? { tag: center.tagName, classes: center.className } : null },
      };
    };
    const ancestors = [];
    for (let element: HTMLElement | null = inspector; element; element = element.parentElement) {
      ancestors.push(measure(element));
      if (element === modal) break;
    }
    if (!modal.contains(inspector)) throw new Error("Inspector must descend from the Database modal");
    if (!inspector.contains(field) || !inspector.contains(label)) throw new Error("Required direct input must be inside inspector");
    const requiredAncestorChain = [".db-body", ".db-map-content", ".spatial-shell", ".spatial-body", ".spatial-stage", ".spatial-inspector"]
      .map(selector => {
        const element = required(`[data-testid="database-modal"] ${selector}`, HTMLElement);
        if (!element.contains(inspector)) throw new Error(`Required inspector ancestor: ${selector}`);
        return { selector, ...measure(element) };
      });
    const targets = { label, labelContainer, field };
    const footerTargets = { footer, close, save, help };
    return {
      viewport: { width: innerWidth, height: innerHeight }, pageScroll: { x: scrollX, y: scrollY },
      inspector: measure(inspector), ancestors, requiredAncestorChain,
      directInput: { label: measure(label), labelContainer: measure(labelContainer), field: measure(field),
        labelText: label.textContent, fieldValue: field.value, disabled: field.disabled },
      footer: { root: measure(footer), close: measure(close), save: measure(save), help: measure(help) },
      intersections: Object.fromEntries(Object.entries(targets).map(([name, element]) => [name,
        Object.fromEntries(Object.entries(footerTargets).map(([target, footerElement]) =>
          [target, intersection(rect(element), rect(footerElement))]))])),
    };
  });
}

/** Given the review fixture, capture the actual inspector before/after its sole scroll action. */
export async function runInspectorScenario(page: Page, out: string) {
  // Given: the same fixture and blank, nonpersistent editor as the default surface scenario.
  assert.deepEqual(page.viewportSize(), { width: 1280, height: 800 });
  page.setDefaultTimeout(30000);
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.goto(`http://127.0.0.1:${process.env.QA_PORT ?? 19873}/?blankProject=1&aiBridge=0`,
    { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 120000 });
  await page.evaluate(async (fixture) => {
    const { store }: typeof import("../../src/project/store") = await import("/src/" + "project/store.ts");
    const { editorState }: typeof import("../../src/editor/editorState") = await import("/src/" + "editor/editorState.ts");
    if (store.isRemotePersistenceEnabled()) throw new Error("QA requires local persistence");
    store.replace(fixture, { preserveEventDrafts: false });
    editorState.set({ currentMapId: fixture.startMapId });
  }, placeCompilerFixture(7));
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor({ state: "visible" });
  assert.equal(await page.getByTestId("db-tab-group-world").getAttribute("aria-expanded"), "false");
  await page.getByTestId("db-tab-group-world").click();
  await page.getByTestId("db-tab-spatial-objects").click();
  await page.getByTestId("spatial-shell-objects").waitFor({ state: "visible" });
  const bed = page.getByTestId("spatial-card-bed_h");
  await bed.click();
  assert.equal(await bed.evaluate(element => element.classList.contains("is-selected")), true);
  assert.equal(await page.getByTestId("spatial-object-name").inputValue(), "침대(가로)");
  const inspector = page.locator('[data-testid="spatial-inspector"].spatial-object-inspector');
  await inspector.waitFor({ state: "visible" });
  const resting = await measureInspector(page);
  assert.equal(resting.inspector.scrollTop, 0, "Resting inspector must start at scrollTop=0");
  const restingFile = "1280x800-objects.png";
  const scrolledFile = "1280x800-objects-inspector-scrolled.png";
  const metricsFile = "1280x800-objects-inspector-metrics.json";
  await page.screenshot({ path: resolve(out, restingFile) });

  // When: assign only this inspector's scrollTop; do not scrollIntoView, click footer, or change CSS.
  const requestedScrollTop = await inspector.evaluate(element => {
    const maximum = Math.max(0, element.scrollHeight - element.clientHeight);
    element.scrollTop = maximum;
    return maximum;
  });

  // Then: record observed geometry, not an assumption that the requested scroll succeeded.
  const scrolled = await measureInspector(page);
  await page.screenshot({ path: resolve(out, scrolledFile) });
  const scroll = {
    requestedScrollTop, actualScrollTop: scrolled.inspector.scrollTop,
    maxIsZero: requestedScrollTop === 0,
    moved: scrolled.inspector.scrollTop !== resting.inspector.scrollTop,
    reachedRequestedMaximum: scrolled.inspector.scrollTop === requestedScrollTop,
    pageStayedStill: scrolled.pageScroll.x === resting.pageScroll.x && scrolled.pageScroll.y === resting.pageScroll.y,
  };
  await writeFile(resolve(out, metricsFile), JSON.stringify({
    schema: "tile-to-world.inspector-metrics.v1", scenario: "inspector-metrics",
    fixture: "placeCompilerFixture(7)", selectedCard: "bed_h", screenshots: { resting: restingFile, scrolled: scrolledFile },
    visibilityBasis: "Computed display/visibility/opacity, viewport and ancestor overflow clipping; center hit only, not full paint proof",
    verdict: "evidence-only", scroll, resting, scrolled,
  }, null, 2));
  await page.close();
  return { metricsFile, screenshots: [restingFile, scrolledFile], scroll };
}
