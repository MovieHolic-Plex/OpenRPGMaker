import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { readStoredZipEntry } from "../../src/project/packageZip";

// Optional transport workaround for Chromium ERR_NETWORK_CHANGED; preserve server responses.
test.beforeEach(async ({ page, baseURL }) => {
  if (!process.env.ELEMENTS_QA_TRANSPORT) return;
  await page.route(`${baseURL}/**`, async (route) => {
    const response = await route.fetch({ timeout: 90_000 });
    await route.fulfill({ response });
  });
});

test("elements real editor: recognition, filtering, editing and project export", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await page.getByTestId("toolbar-database").click({ timeout: 90_000 });
  const shellBefore = await page.locator(".database-modal-window").boundingBox();
  await page.getByTestId("db-tab-group-battle").click();
  await page.getByTestId("db-tab-elements").click();
  expect(await page.locator(".database-modal-window").boundingBox()).toEqual(shellBefore);
  const name = page.getByTestId("db-field-element-name-selected");
  await expect(name).toHaveValue("Ice");
  await page.evaluate(() => document.fonts.ready);
  const imageSources = await page.getByTestId("db-elements-list").locator("img").evaluateAll(async (nodes) => {
    const images = nodes as HTMLImageElement[];
    await Promise.all(images.map((image) => image.decode()));
    return images.map((image) => ({ src: image.getAttribute("src"), width: image.naturalWidth }));
  });
  expect(new Set(imageSources.map((image) => image.src)).size).toBe(17);
  expect(imageSources.every((image) => image.width > 0)).toBe(true);
  const directory = "output/evidence/battle-rules-ux";
  await mkdir(directory, { recursive: true });
  for (const [width, height] of [[1024, 768], [1280, 800], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.getByTestId("db-elements-editor").locator(".db-ws-detail-body").evaluate((node) => { node.scrollTop = 0; });
    const geometry = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="db-elements-editor"]')!;
      const body = root.querySelector(".db-ws-detail-body")!;
      const first = root.querySelector('[data-testid="db-field-element-damage-A"]')!;
      const overlaps = [...root.querySelectorAll(".db-el-damage-row")].some((row) => {
        const children = [...row.children].map((child) => child.getBoundingClientRect());
        return children.slice(1).some((box, index) => box.left < children[index].right - 1);
      });
      return { overflow: document.documentElement.scrollWidth > innerWidth, firstTop: first.getBoundingClientRect().top, bottom: body.getBoundingClientRect().bottom, bodyOverflow: body.scrollWidth > body.clientWidth, overlaps };
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.bodyOverflow).toBe(false);
    expect(geometry.overlaps).toBe(false);
    expect(geometry.firstTop).toBeLessThan(geometry.bottom);
    await page.screenshot({ path: `${directory}/elements-after-${width}x${height}.png`, animations: "disabled" });
  }
  const search = page.getByTestId("db-elements-search");
  await search.fill("Fire");
  await expect(page.getByTestId("db-elements-list").locator(".db-ws-row")).toHaveCount(1);
  await expect(search).toBeFocused();
  await expect(name).toHaveValue("Ice");
  await search.fill("no-such-element");
  await expect(page.getByTestId("db-elements-search-clear")).toBeVisible();
  await expect(search).toBeFocused();
  await page.screenshot({ path: `${directory}/elements-no-results.png`, animations: "disabled" });
  await page.getByTestId("db-elements-search-clear").click();
  await expect(page.getByTestId("db-elements-list").locator(".db-ws-row")).toHaveCount(17);
  await name.fill("얼음의 이름을 길게 바꾼 사용자 속성");
  await expect(name).toBeFocused();
  await expect(page.getByTestId("db-elements-hero").locator("h3")).toHaveText(await name.inputValue());
  const physical = page.getByTestId("db-field-element-kind-physical");
  await physical.check();
  await physical.press("ArrowRight");
  await expect(page.getByTestId("db-field-element-kind-magical")).toBeChecked();
  await page.getByTestId("db-field-element-kind-magical").press("ArrowLeft");
  await expect(physical).toBeChecked();
  await page.getByTestId("db-elements-reference-damage").fill("150");
  await page.getByTestId("db-elements-preview-grade").selectOption("B");
  await expect(page.getByTestId("db-elements-example-result")).toHaveAttribute("data-value", "225");
  await page.getByTestId("db-elements-reference-damage").fill("100");
  await page.getByTestId("db-field-element-damage-E").fill("-50");
  await expect(page.getByTestId("db-elements-example-result")).toHaveAttribute("data-value", "-50");
  await expect(page.getByTestId("db-field-element-damage-E")).toBeFocused();
  await page.screenshot({ path: `${directory}/elements-custom-name.png`, animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("database-dirty-prompt")).toBeVisible();
  await page.getByTestId("database-dirty-save").click();
  await expect(name).not.toBeVisible();
  await page.getByTestId("menu-project").click();
  const downloadReady = page.waitForEvent("download", { timeout: 15_000 });
  await page.getByTestId("menu-project-export").click();
  const download = await downloadReady;
  const path = await download.path();
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(path!);
  const projectEntry = readStoredZipEntry(bytes, "project.json");
  expect(projectEntry).not.toBeNull();
  const exported = JSON.parse(new TextDecoder().decode(projectEntry!));
  const ice = exported.database.elements.find((element: { id: string }) => element.id === "ice");
  expect(ice.name).toBe("얼음의 이름을 길게 바꾼 사용자 속성");
  expect(ice.kind).toBe("physical");
  expect(ice.damageMultipliers.E).toBe(-50);
  expect(Object.keys(ice).sort()).toEqual(["damageMultipliers", "id", "kind", "name", "rateLabels"].sort());
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-elements-add").click();
  await expect(page.getByTestId("db-elements-hero").locator("[data-art-source]")).toHaveAttribute("data-art-source", "none");
  await name.fill("");
  await expect(name).toBeFocused();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: `${directory}/elements-custom-no-art.png`, animations: "disabled" });
  // Explicit image-network failure injection, not a fabricated app or database response.
  await page.route("**/assets/cc0/jetrel/icons/fire-bomb.png", (route) => route.abort("failed"));
  await page.getByTestId("db-elements-row-4").click();
  await expect(page.getByTestId("db-elements-hero").locator(".db-image-load-failed")).toBeVisible();
  await expect(name).toBeVisible();
  await page.screenshot({ path: `${directory}/elements-image-failure.png`, animations: "disabled" });
  expect(errors).toEqual([]);
});
