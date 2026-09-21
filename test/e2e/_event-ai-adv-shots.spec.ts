import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";

/**
 * 「AI로 명령 만들기」 도크의 증거 스크린샷 수집기(진단 스펙 — 기본 스위트 제외).
 *
 *   SHOT_TAG=after DEV_SERVER_PORT=9873 npx playwright test test/e2e/_event-ai-adv-shots.spec.ts
 *
 * 결과: verify-shots/event-ai-adv/<tag>-<장면>.png
 */
const SHOT_DIR = "verify-shots/event-ai-adv";
const TAG = process.env.SHOT_TAG ?? "after";

const EXISTING_COMMANDS: readonly Command[] = [
  { kind: "text", body: "나무 상자를 열어본다.", speaker: "" } as Command,
  { kind: "text", body: "잠겨 있다.", speaker: "" } as Command,
];

const MOCK_FINAL: readonly Command[] = [
  { kind: "text", body: "나무 상자를 열어본다.", speaker: "" } as Command,
  { kind: "text", body: "상자가 열렸다. 회복약이 두 개 들어 있다.", speaker: "" } as Command,
  { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 } as Command,
  { kind: "setSelfSwitch", key: "A", value: true } as Command,
];

test.setTimeout(180_000);

function probeProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("blank project has no start map");
  const commands: Command[] = structuredClone(EXISTING_COMMANDS) as Command[];
  const eventPage: EventPage = {
    id: "p1",
    name: "상자",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  map.events = [{ id: "ev_ai_dock", x: 4, y: 4, pages: [eventPage], commands } as (typeof map.events)[number]];
  return project;
}

async function shoot(page: Page, name: string): Promise<void> {
  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOT_DIR}/${TAG}-${name}.png`, fullPage: false });
}

test("도크 생성 흐름을 장면별로 남긴다", async ({ page }) => {
  await page.route("**/v1/chat/completions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify(MOCK_FINAL) } }] }),
    });
  });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-event-ai-adv-shots");
    window.localStorage.setItem("oprn:editor-ui-mode", "standard");
    window.localStorage.setItem(
      "oprn:ai-config",
      JSON.stringify({ version: 2, authMode: "chatgpt", model: "gemini-3.7-flash", liteModel: "gemini-3.7-flash" }),
    );
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  const project = probeProject();
  await page.goto("/");
  await seedProjectForEditor(page, project);
  await page.evaluate(async (mapId) => {
    const modalPath = "/src/editor/panels/eventEditor/modal.ts";
    const modalModule = (await import(modalPath)) as typeof import("@/editor/panels/eventEditor/modal");
    modalModule.openEventEditorModal(mapId, "ev_ai_dock");
  }, project.startMapId);

  const editor = page.getByTestId("event-editor-modal");
  await editor.waitFor({ state: "visible" });
  await shoot(page, "01-editor-default-view");

  await editor.getByTestId("ai-event-assist").locator("summary").first().click();
  await editor.getByTestId("ai-event-input").waitFor({ state: "visible" });
  await shoot(page, "02-dock-open");

  await editor.getByTestId("ai-event-input").fill("상자를 열면 회복약 2개를 주고 기억 A를 켜 줘");
  await editor.getByTestId("ai-event-generate").click();
  await editor.getByTestId("ai-event-result").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const status = document.querySelector<HTMLElement>('[data-testid="ai-event-status"]');
    return Boolean(status && !status.classList.contains("busy"));
  });
  await shoot(page, "03-draft-in-default-view");

  await editor.getByTestId("ai-event-apply").click();
  await page.waitForFunction(() => {
    const host = document.querySelector<HTMLElement>('[data-testid="ai-event-staged-host"]');
    return Boolean(host && host.hidden);
  });
  await shoot(page, "04-applied");
});
