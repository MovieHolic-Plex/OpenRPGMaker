// 게임을 켜면 실제로 음악이 나는지 브라우저에서 증명한다.
//
// 배경(2026-07-26 실측): GameMap.bgm 타입과 에디터 UI 는 있었지만 플레이어가 그 값을 읽는 곳이
// 한 군데도 없었고, 등록된 음악 30곡은 전부 .mid(브라우저 재생 불가)였다. 즉 게임은 완전 무음이었다.
// 단위 테스트는 해석 규칙만 지킬 수 있어서, "정말 소리가 나는가" 는 여기서 확인한다.
//
// 계측 방식: Audio 생성자를 감싸 src 와 play() 호출을 기록한다. 헤드리스에서 자동재생이
// 거부될 수 있으므로 "재생 시도된 URL" 을 근거로 삼는다(엔진이 무엇을 틀려 했는지가 관심사다).
import { expect, test } from "@playwright/test";
import { createSampleAdventureProject } from "@/project/defaults/defaultProject";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

declare global {
  interface Window {
    __audioAttempts?: string[];
  }
}

test.setTimeout(90_000);
test.use({ serviceWorkers: "block" });

test("게임을 시작하면 재생 가능한 BGM 이 실제로 요청된다", async ({ page }) => {
  await page.addInitScript(() => {
    window.__audioAttempts = [];
    const NativeAudio = window.Audio;
    // 생성 시점의 src 를 기록한다. loop 여부까지 보려면 인스턴스를 봐야 하므로 프록시로 감싼다.
    window.Audio = function PatchedAudio(this: unknown, src?: string) {
      const audio = new NativeAudio(src);
      const originalPlay = audio.play.bind(audio);
      audio.play = () => {
        window.__audioAttempts?.push(audio.src);
        return originalPlay();
      };
      return audio;
    } as unknown as typeof window.Audio;
    window.Audio.prototype = NativeAudio.prototype;
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  await seedProjectFromSupabaseCanonical(page, createSampleAdventureProject());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });

  // 언락(첫 포인터 입력)이 이미 지나갔으므로 큐가 방출되어 있어야 한다.
  const attempts = await expect
    .poll(async () => await page.evaluate(() => window.__audioAttempts ?? []), { timeout: 15_000 })
    .not.toEqual([])
    .then(async () => await page.evaluate(() => window.__audioAttempts ?? []));

  // 핵심 회귀: MIDI 를 틀려고 하면 안 된다 — 브라우저가 재생하지 못한다.
  expect(attempts.filter((url) => url.toLowerCase().endsWith(".mid"))).toEqual([]);

  // 반드시 BGM 디렉터리의 곡이어야 한다.
  // (초기 버전은 .wav 도 음악으로 인정했는데, UI 클릭음 Decision1.wav 가 조건을 만족해
  //  배선을 완전히 껐을 때도 테스트가 통과했다 — 네거티브 컨트롤로 잡은 실제 구멍이다.)
  const music = attempts.filter((url) => /\/assets\/cc0\/audio\/bgm\/.+\.(mp3|ogg)$/i.test(url));
  expect(music.length, `재생 시도 목록: ${JSON.stringify(attempts)}`).toBeGreaterThan(0);
});
