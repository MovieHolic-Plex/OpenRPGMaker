import { expect, test } from "@playwright/test";
import type { Command, GameEvent } from "@/project/types";
import { gotoWithRetry } from "../../scripts/lib/goto-retry.mjs";
import { startNewGameFromTitle } from "./runtimeInput";

test.use({ serviceWorkers: "block" });

const TARGET = "map_confirm_transfer";
const ARRIVAL = "도착하자마자 보이는 첫 대사.";
const AFTER_FADE = "화면이 다시 밝아진 뒤의 대사.";
const NEW_EVENT = "같은 맵의 다음 자동 이벤트.";

test("holding Enter advances consecutive text and pauses at transfers, fades, and new events", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await gotoWithRetry(page, "/?blankProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await page.evaluate(async ({ target, arrival, afterFade, newEvent }) => {
    const defaultsPath = "/src/project/defaults/blankProject.ts";
    const storePath = "/src/project/store.ts";
    const kitPath = "/src/project/flagship/maouKonbiniKit.ts";
    const { createBlankProject } = await import(defaultsPath) as typeof import("@/project/defaults/blankProject");
    const { store } = await import(storePath) as typeof import("@/project/store");
    const { fadeIn, fadeOut } = await import(kitPath) as typeof import("@/project/flagship/maouKonbiniKit");
    const autorun = (id: string, commands: Command[]): GameEvent => (
      { id, x: 0, y: 0, name: id, trigger: { kind: "auto" }, commands }
    );
    const project = createBlankProject();
    delete project.system.opening;
    const start = project.maps[project.startMapId]!;
    project.maps[target] = {
      ...structuredClone(start), id: target, name: "도착", events: [autorun("ev_arrival", [
        { kind: "text", body: arrival },
        ...fadeOut(200), ...fadeIn(200),
        { kind: "text", body: afterFade },
      ]), autorun("ev_followup", [{ kind: "text", body: newEvent }])],
    };
    project.mapTree.children = [{ mapId: target, children: [] }];
    start.events = [autorun("ev_departure", [
      { kind: "text", body: "출발 준비." },
      { kind: "text", body: "이제 이동한다." },
      { kind: "transfer", mapId: target, x: 4, y: 4, fade: "black" },
    ])];
    store.replaceProject(project);
  }, { target: TARGET, arrival: ARRIVAL, afterFade: AFTER_FADE, newEvent: NEW_EVENT });
  await page.getByTestId("mode-play").click({ force: true });
  await startNewGameFromTitle(page);
  const readyLine = page.locator('[data-testid="dialogue-box"].page-ready .body');

  await expect(readyLine).toHaveText("출발 준비.");
  await page.keyboard.down("Enter");
  await expect(readyLine).toHaveText("이제 이동한다.");
  // Playwright sends repeat=true on subsequent downs until keyup.
  await expect.poll(async () => {
    await page.keyboard.down("Enter");
    const live = await page.getByTestId("runtime-state-json").getAttribute("data-live-flags");
    return live?.split("|")[0];
  }).toBe(TARGET);

  await expect(readyLine).toHaveText(ARRIVAL);
  await page.keyboard.down("Enter");
  await expect(readyLine).toHaveText(ARRIVAL);
  await page.keyboard.up("Enter");
  await page.keyboard.down("Enter");
  await expect(readyLine).toHaveText(AFTER_FADE);
  await page.keyboard.down("Enter");
  await expect(readyLine).toHaveText(AFTER_FADE);
  await page.keyboard.up("Enter");
  await page.keyboard.down("Enter");
  await expect(readyLine).toHaveText(NEW_EVENT);
  // This event follows a plain text command, so allow time for the repeat throttle to expire.
  await page.waitForTimeout(160);
  await page.keyboard.down("Enter");
  await expect(readyLine).toHaveText(NEW_EVENT);
  await page.keyboard.up("Enter");
  await page.keyboard.press("Enter");
  await expect(readyLine).toHaveCount(0);
});
