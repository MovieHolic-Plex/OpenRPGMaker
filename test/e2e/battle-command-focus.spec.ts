import { expect, test } from "@playwright/test";
import { waitForEditorProject } from "../../scripts/lib/waitForEditorProject.mjs";

test.use({ browserName: "firefox", launchOptions: {}, trace: "off", screenshot: "off" });
test.setTimeout(240_000);

for (const [spelling, id] of [["quote", 'cmd_"quoted'], ["backslash", "cmd_\\backslash"]] as const) {
  for (const action of ["add", "move"] as const) {
    test(`${action} restores exact focus for a ${spelling} command ID`, async ({ page }, testInfo) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
        localStorage.setItem("oprn:database.activeTab", "battleCommands");
      });
      await page.goto("/?blankProject=1");
      await expect(page.getByTestId("toolbar-database")).toBeVisible({ timeout: 45_000 });
      await waitForEditorProject(page);
      const before = await page.evaluate(async ({ id, action }) => {
        const path = "/src/project/store.ts";
        const { store } = await import(path);
        const project = structuredClone(store.getCurrent());
        const command = { id, name: "Custom command", kind: "attack" };
        const anchor = { id: "focus_anchor", name: "Anchor", kind: "item" };
        const footer = { id: "cmd_change", name: "\uad50\uccb4", kind: "switch" };
        project.database.classes = [{
          ...project.database.classes[0], id: "focus_class",
          battleCommands: action === "add" ? [anchor, footer] : [command, anchor, footer],
        }];
        project.database.battleCommands = [command, anchor];
        store.replace(project, { change: { scope: "project", label: "Focus regression fixture", origin: "system" } });
        return { command, anchor, footer, catalog: structuredClone(project.database.battleCommands) };
      }, { id, action });
      await page.getByTestId("toolbar-database").click();
      const control = page.getByTestId(`db-command-${action === "add" ? "place" : "down"}-${id}`);
      await expect(control).toBeEnabled();
      // Subscribe in the browser before the real control's click handler runs. A missing
      // match fails at the bound; a selector exception fails on the exact error event.
      const outcome = await control.evaluate((node, targetId) => new Promise<{
        event: string; error?: string; activeId: string | null; activeTag: string | null;
      }>((resolve) => {
        const finish = (event: string, error?: string): void => {
          clearTimeout(timeout);
          document.removeEventListener("focusin", onFocus);
          window.removeEventListener("error", onError);
          resolve({ event, error, activeId: (document.activeElement as HTMLElement | null)?.dataset.testid ?? null,
            activeTag: document.activeElement?.tagName ?? null });
        };
        const onFocus = (event: FocusEvent): void => {
          if (event.target instanceof HTMLElement && event.target.dataset.testid === targetId) finish("focusin");
        };
        const onError = (event: ErrorEvent): void => finish("error", event.message);
        const timeout = window.setTimeout(() => finish("timeout"), 5_000);
        document.addEventListener("focusin", onFocus);
        window.addEventListener("error", onError);
        (node as HTMLButtonElement).focus();
        (node as HTMLButtonElement).click();
      }), `db-command-remove-${id}`);
      const after = await page.evaluate(async () => {
        const path = "/src/project/store.ts";
        const { store } = await import(path);
        return { commands: store.getCurrent().database.classes[0].battleCommands,
          catalog: store.getCurrent().database.battleCommands,
          activeId: (document.activeElement as HTMLElement | null)?.dataset.testid ?? null };
      });
      const evidence = { spelling, id, action, outcome, after, pageErrors };
      console.log(JSON.stringify(evidence));
      await testInfo.attach("focus-observation", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
      // Both paths must commit the exact ID and order, not reject or sanitize it.
      expect(after.commands).toEqual([before.anchor, before.command, before.footer]);
      expect(after.catalog).toEqual(before.catalog);
      expect(outcome).toEqual({ event: "focusin", error: undefined, activeId: `db-command-remove-${id}`, activeTag: "BUTTON" });
      expect(after.activeId).toBe(`db-command-remove-${id}`);
      expect(pageErrors).toEqual([]);
    });
  }
}

test("shared focus helper remains deferred and follows a second DOM replacement", async ({ page }) => {
  await page.goto("/?blankProject=1");
  await expect(page.getByTestId("toolbar-database")).toBeVisible({ timeout: 45_000 });
  const result = await page.evaluate(async () => {
    const path = "/src/editor/panels/databaseWorkspace.ts";
    const { restoreFocusAfterRerender } = await import(path);
    const host = document.createElement("div");
    const first = document.createElement("button");
    first.dataset.testid = "focus-helper-contract";
    const second = first.cloneNode() as HTMLButtonElement;
    host.append(first);
    document.body.append(host);
    return new Promise<{ deferred: boolean; restoredReplacement: boolean }>((resolve, reject) => {
      let deferred = false;
      const cleanup = (): void => {
        clearTimeout(timeout);
        document.removeEventListener("focusin", onFocus);
        window.removeEventListener("error", onError);
        host.remove();
      };
      const onError = (event: ErrorEvent): void => { cleanup(); reject(new Error(event.message)); };
      const onFocus = (event: FocusEvent): void => {
        if (event.target === first) first.replaceWith(second);
        else if (event.target === second) {
          const restoredReplacement = document.activeElement === second;
          cleanup();
          resolve({ deferred, restoredReplacement });
        }
      };
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error("Focus replacement event missing")); }, 5_000);
      document.addEventListener("focusin", onFocus);
      window.addEventListener("error", onError);
      restoreFocusAfterRerender(first.dataset.testid);
      deferred = document.activeElement !== first;
    });
  });
  expect(result).toEqual({ deferred: true, restoredReplacement: true });
});
