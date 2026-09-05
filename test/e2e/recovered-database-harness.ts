import { expect, type Page } from "@playwright/test";
import type { Project } from "../../src/project/types";

/** Mount the shipping database component without starting unrelated editor/game services. */
export async function openRecoveredDatabase(page: Page, baseURL: string): Promise<void> {
  const origin = new URL(baseURL).origin;
  await page.route(`${origin}/**`, async (route) => {
    if (new URL(route.request().url()).pathname === "/__recovered-database") {
      await route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="/src/styles/index.css"></head><body></body></html>` });
      return;
    }
    await route.fulfill({ response: await route.fetch({ maxRetries: 3 }) });
  });
  await page.goto(`${origin}/__recovered-database`);
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const [{ store, setDevProjectFactory }, { createBlankProject }, database] = await Promise.all([
      load("/src/project/store.ts"), load("/src/project/defaults.ts"), load("/src/editor/panels/databaseModal.ts"),
    ]);
    setDevProjectFactory(() => createBlankProject());
    await store.load(); // dev factory explicitly disables remote persistence for this test fixture.
    database.openDatabaseModal("items");
  });
  await expect(page.getByTestId("db-tab-items")).toBeVisible();
}

export async function recoveredDatabaseExport(page: Page): Promise<Project> {
  return page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const [{ store }, { serialize, deserialize }] = await Promise.all([
      load("/src/project/store.ts"), load("/src/project/io.ts"),
    ]);
    return deserialize(serialize(store.getCurrent()));
  });
}
