// 전투에 들어가도 음악이 계속 나는지 브라우저에서 증명한다.
//
// 실측 배경(2026-07-26): 출하되는 샘플 데모의 battleBgmResourceId 가 `easyrpg-music-battle-1`
// (.mid) 였다. 브라우저는 MIDI 를 재생하지 못하므로 전투 진입 시 필드 음악이 멈춘 뒤
// **아무 소리도 나지 않았다.** 실패는 콘솔 경고 한 줄뿐이라 눈에 띄지 않는다.
import { expect, test } from "@playwright/test";
import { createSampleAdventureProject } from "@/project/defaults/defaultProject";

test.setTimeout(120_000);
test.use({ serviceWorkers: "block" });

test("샘플 게임은 전투 BGM 으로 재생 가능한 곡을 가리킨다", async () => {
  // 프로젝트 수준 계약 — 브라우저를 켜기 전에 확인할 수 있고, 깨지면 아래 재생 검증도 무의미하다.
  const project = createSampleAdventureProject();
  expect(project.system.battleBgmResourceId).toBe("cc0-bgm-battle");
});

test("전투에 들어가면 MIDI 를 틀려 하지 않는다", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __sfx: string[] }).__sfx = [];
    const Native = window.Audio;
    window.Audio = function (this: unknown, src?: string) {
      const audio = new Native(src);
      const play = audio.play.bind(audio);
      audio.play = () => {
        (window as unknown as { __sfx: string[] }).__sfx.push(audio.src);
        return play();
      };
      return audio;
    } as unknown as typeof window.Audio;
    window.Audio.prototype = Native.prototype;
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 800 });

  const { seedProjectFromSupabaseCanonical } = await import("./supabaseProjectSeed");
  const { startNewGameFromTitle } = await import("./runtimeInput");
  await seedProjectFromSupabaseCanonical(page, createSampleAdventureProject());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2000);

  const attempts = await page.evaluate(() => (window as unknown as { __sfx: string[] }).__sfx);
  // MIDI 재생 시도가 있으면 그 슬롯은 무음이다 — 필드든 전투든 마찬가지다.
  expect(
    attempts.filter((url) => url.toLowerCase().endsWith(".mid")),
    `재생 시도: ${JSON.stringify(attempts)}`,
  ).toEqual([]);
});
