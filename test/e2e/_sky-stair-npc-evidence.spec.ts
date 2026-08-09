// 진단·증빙용(`_` = 기본 스위트 제외). 재배치된 NPC 와 얼굴이 화면에 실제로 있는지
// 스크린샷으로 남긴다.
import { expect, test } from "@playwright/test";
import { createSkyStairProject, SKY_MAP } from "@/editor/content/skyStairGame";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(300_000);
test.use({ serviceWorkers: "block" });

const SHOTS: readonly {
  readonly name: string;
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly talkTo?: string;
}[] = [
  { name: "harbor-npcs", mapId: SKY_MAP.harbor, x: 15, y: 15 },
  { name: "harbor-merchant-face", mapId: SKY_MAP.harbor, x: 15, y: 15, talkTo: "ev_sky_h_oil" },
  { name: "harbor-kid-face", mapId: SKY_MAP.harbor, x: 16, y: 13, talkTo: "ev_sky_h_kid_a" },
  { name: "wheat-farmer-face", mapId: SKY_MAP.wheat, x: 15, y: 13, talkTo: "ev_sky_w_farmer" },
  { name: "shrine-seals", mapId: SKY_MAP.shrine, x: 15, y: 12 },
  { name: "shrine-keeper-face", mapId: SKY_MAP.shrine, x: 15, y: 19, talkTo: "ev_sky_s_keeper" },
  { name: "mistwood-npcs", mapId: SKY_MAP.mistwood, x: 15, y: 26 },
];

test("재배치된 NPC 와 얼굴 증빙 스크린샷", async ({ browser }) => {
  for (const shot of SHOTS) {
    const page = await browser.newPage();
    try {
      const project = createSkyStairProject();
      project.startMapId = shot.mapId;
      project.startPos = { x: shot.x, y: shot.y };
      await page.addInitScript(() => {
        window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await seedProjectFromSupabaseCanonical(page, project);
      await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("mode-play").click({ force: true });
      await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
      await startNewGameFromTitle(page);
      await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(2400);
      if (shot.talkTo) {
        await page.getByTestId(`event-${shot.talkTo}`).click({ force: true });
        await expect(page.getByTestId("dialogue-box")).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(2600);
      }
      await page.getByTestId("play-stage").screenshot({ path: `report-assets/shots/sky-${shot.name}.png` });
    } finally {
      await page.close();
    }
  }
});
