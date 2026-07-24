import { expect, test } from "@playwright/test";
import { createHouseTemplateGalleryProject } from "@/project/defaults";
import { serialize } from "@/project/io";

// Adversarial QA for the map-edit-lock fix: scratch sessions (remotePersistenceEnabled=false)
// must NEVER touch the Supabase map_edit_locks table; remote-enabled sessions still must.

const STORAGE_KEY = "rpg-zzu:supabase-project-config";
const TEST_CONFIG = {
  anonKey: "test-anon-key",
  projectId: "initial-project",
  source: "custom",
  url: "http://dbserver:8100",
} as const;

const LOCK_ROUTE = "**/rest/v1/map_edit_locks**";

test("C1: scratch session (freshProject=1) never requests map locks, even with Supabase config present", async ({ page }) => {
  test.setTimeout(60_000);
  const lockRequests: string[] = [];
  await page.route(LOCK_ROUTE, async (route) => {
    lockRequests.push(`${route.request().method()} ${route.request().url()}`);
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: TEST_CONFIG }
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500); // boot-time ensureCurrentMapLock would have fired by now

  // Try a map switch via the map tree — another checkout path. Best-effort: the click
  // may be intercepted by overlays in some layouts; the boot-time checkout is the primary vector.
  const nodes = page.locator(".map-node, .map-root");
  const count = await nodes.count();
  if (count > 1) {
    await nodes.nth(1).dispatchEvent("click").catch(() => undefined);
    await page.waitForTimeout(1500);
  }

  expect(lockRequests, "scratch session must not touch map_edit_locks").toEqual([]);
});

test("C2: remote-enabled session still acquires a map lock", async ({ page }) => {
  test.setTimeout(60_000);
  const lockRequests: string[] = [];
  const canonicalProject = JSON.parse(serialize(createHouseTemplateGalleryProject()));

  await page.route("http://dbserver:8100/rest/v1/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes("/rest/v1/map_edit_locks")) {
      lockRequests.push(`${method} ${url}`);
      if (method === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      } else {
        await route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
      }
      return;
    }
    if (url.includes("/rest/v1/projects") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ current_json: canonicalProject, current_sha256: "test-sha" }]),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: TEST_CONFIG }
  );
  await page.setViewportSize({ width: 1280, height: 800 });

  const lockRequestSeen = page.waitForRequest(LOCK_ROUTE, { timeout: 20_000 });
  await page.goto("/?rm2k3Shell=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await lockRequestSeen;

  // The checkout flow must end in an upsert (POST) — i.e. the lock is actually taken.
  await expect
    .poll(() => lockRequests.some((entry) => entry.startsWith("POST")), { timeout: 10_000 })
    .toBe(true);
});
