// 설산 관문을 **런타임 화면**으로 찍는다.
// 지금까지의 그림은 전부 제가 타일 배열을 합성한 것이라 조명·날씨·캔버스 배경을
// 통과한 실제 화면이 아니었다(감독 질문 10 의 답: "런타임 스크린샷").
import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createSkyStairProject, SKY_MAP } from "@/editor/content/skyStairGame";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(240_000);
test.use({ serviceWorkers: "block" });

const OUT = "C:/Users/USER/AppData/Local/Temp/claude/C--Users-USER-Downloads-rpg-zzu/ce2327ea-b28d-400e-949d-caef7b21edab/scratchpad/";

const SHOTS = [
  { name: "arrival", label: "저수지 도착", x: 15, y: 20 },
  { name: "pass-a", label: "능선 A 통로 · 관문 지기", x: 15, y: 17 },
  { name: "bridge", label: "크레바스 다리", x: 15, y: 13 },
  { name: "pass-b", label: "능선 B 통로", x: 8, y: 11 },
  { name: "crystal", label: "수정 단 · 은자", x: 22, y: 8 },
  { name: "summit", label: "정상", x: 15, y: 2 },
];

for (const shot of SHOTS) {
  test(`설산 관문 런타임 — ${shot.label}`, async ({ browser }) => {
    const page = await browser.newPage();
    try {
      const project = createSkyStairProject();
      project.startMapId = SKY_MAP.snowgate;
      project.startPos = { x: shot.x, y: shot.y };
      await page.addInitScript(() => {
        window.localStorage.setItem("oprn:editor-ui-mode", "expert");
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await seedProjectFromSupabaseCanonical(page, project);
      await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("mode-play").click({ force: true });
      await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
      await startNewGameFromTitle(page);
      await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(2500);

      const runtime = await page.evaluate(() => {
        const node = document.querySelector("[data-testid='runtime-state-json']");
        if (!node?.textContent) return null;
        try {
          return JSON.parse(node.textContent) as { mapId?: string; player?: { x?: number; y?: number } };
        } catch {
          return null;
        }
      });
      expect(runtime?.mapId, `${shot.label}: 런타임이 설산 관문에 없다`).toBe(SKY_MAP.snowgate);
      // 시작 지점이 통행 불가면 런타임이 다른 칸으로 밀어낸다 — 그건 지형 결함이다.
      expect(runtime?.player, `${shot.label}: 플레이어 좌표를 못 읽었다`).toBeTruthy();
      expect(
        { x: runtime?.player?.x, y: runtime?.player?.y },
        `${shot.label}: (${shot.x},${shot.y}) 에 설 수 없어 런타임이 옮겼다`,
      ).toEqual({ x: shot.x, y: shot.y });

      const buffer = await page.getByTestId("play-stage").screenshot();
      writeFileSync(`${OUT}rt-snowgate-${shot.name}.png`, buffer);
    } finally {
      await page.close();
    }
  });
}
