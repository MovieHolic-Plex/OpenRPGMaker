// 마을 사람이 퀘스트 진행에 반응하는지 브라우저에서 증명한다.
//
// 실측 배경(2026-07-26): 장로만 퀘스트 체인을 갖고 나머지 주민은 1페이지 고정 대사였다.
// 종을 되살려도(sw_0006) 아무도 그 사실을 몰랐다 — 마을이 배경 그림처럼 느껴지는 직접적 원인이다.
//
// 검증 방식: 같은 NPC 를 두 번 말 걸어 대사가 달라지는지 본다. 첫 번째는 퀘스트 미수락,
// 두 번째는 종 복원 스위치를 켠 뒤. 대사가 같으면 층이 작동하지 않는 것이다.
import { expect, test, type Page } from "@playwright/test";
import { createSampleAdventureProject } from "@/project/defaults";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

type DebugWindow = {
  __oprnDebug?: { setSwitch?(id: string, value: boolean): void; readState(): { switches: Record<string, boolean> } };
};

test.setTimeout(120_000);
test.use({ serviceWorkers: "block" });

/**
 * NPC 이벤트 마커를 눌러 대화창 텍스트를 읽고 완전히 닫는다.
 *
 * 두 가지를 반드시 처리해야 한다(실측):
 *  1. 대화창은 **타자기 효과**로 글자를 점진 출력한다 — 즉시 읽으면 "종소리" 처럼 앞부분만 잡힌다.
 *     그래서 텍스트가 더 자라지 않을 때까지 기다린다.
 *  2. 닫기를 확인하지 않으면 다음 마커 클릭이 이전 대화를 이어받아 **같은 페이지가 재실행**된다.
 *     그러면 조건이 바뀌었는데도 옛 대사가 나와 테스트가 거짓 결과를 낸다.
 */
async function talkTo(page: Page, eventId: string): Promise<string> {
  const box = page.getByTestId("dialogue-box");
  await page.getByTestId(`event-${eventId}`).click({ force: true });
  await expect(box).toBeVisible({ timeout: 10_000 });

  // 타자기 출력이 멈출 때까지 기다린다.
  let text = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.waitForTimeout(150);
    const next = (await box.textContent()) ?? "";
    if (next === text && next.length > 0) break;
    text = next;
  }

  // 확실히 닫는다 — 여러 페이지/선택지가 남아 있을 수 있으므로 사라질 때까지 누른다.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if ((await box.count()) === 0 || !(await box.isVisible())) break;
    await box.click({ force: true });
    await page.waitForTimeout(200);
  }
  await expect(box).toBeHidden({ timeout: 5_000 });
  return text;
}

test("종을 되살리면 마을 사람 대사가 바뀐다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  const project = createSampleAdventureProject();
  // 이 테스트가 의미를 가지려면 층이 실제로 쌓여 있어야 한다.
  const kid = project.maps[project.startMapId]!.events.find((event) => event.id === "ev_kid");
  expect(kid?.pages?.length, "ev_kid 에 대사 층이 없다").toBeGreaterThan(1);

  await seedProjectFromSupabaseCanonical(page, project);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });

  const before = await talkTo(page, "ev_kid");
  expect(before.trim().length).toBeGreaterThan(0);

  // 종 복원 스위치를 켠다.
  const applied = await page.evaluate(() => {
    const debug = (window as unknown as DebugWindow).__oprnDebug;
    if (!debug?.setSwitch) return false;
    debug.setSwitch("sw_0006", true);
    return debug.readState().switches.sw_0006 === true;
  });
  expect(applied, "sw_0006 를 켤 수 없다 — 테스트 훅 setSwitch 부재").toBe(true);
  await page.waitForTimeout(600);

  const after = await talkTo(page, "ev_kid");
  expect(after).not.toBe(before);
  expect(after).toContain("종소리");
});
