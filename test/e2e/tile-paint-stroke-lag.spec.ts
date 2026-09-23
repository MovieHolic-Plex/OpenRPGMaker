import { expect, test, type Page } from "@playwright/test";

/*
 * 칠하기 드래그 렉 회귀(2026-09-23, 기본 100×100 「이슬 장터 마을」).
 *
 * 원인은 붓이 아니라 스트로크에 딸려 도는 후속 작업이었다:
 *  - 규칙 감사 배지가 cluster-rule 몇 건을 세려고 projectLint 전체(직렬화 왕복)를 돌렸다 — 한 번 ~800ms.
 *  - 도구막대 store 구독이 선행 스로틀이라 드래그 중 120ms 마다 좌측 팔레트를 통째로 다시 지었다.
 *  - 숨은 project-export-json 미러가 칸 사이가 500ms 를 넘는 느린 드래그에서 도중에 직렬화됐다.
 * 결과: 이동 한 번 370ms, 스트로크 중 0.8~1.0초 긴 태스크가 250ms 마다(수정 전 실측).
 *
 * 이 스펙은 시간 창이 아니라 «손을 떼기 전에는 안 한다» 를 잰다 — 천천히 끄는 스트로크
 * (칸 사이 300ms) 동안 도구막대 노드가 그대로이고 미러가 안 바뀌며, 떼면 둘 다 따라온다.
 * 긴 태스크 상한은 소프트웨어 GL(swiftshader) 부하를 넉넉히 감안한 값이다 — 옛 ~800ms 만 잡는다.
 */

test.setTimeout(120_000);

async function exportText(page: Page): Promise<string> {
  return (await page.getByTestId("project-export-json").textContent()) ?? "";
}

test("느린 칠하기 스트로크 동안 팔레트 재구축·직렬화·긴 멈춤이 없다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const longs: number[] = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longs.push(entry.duration);
    }).observe({ type: "longtask", buffered: true });
    (window as unknown as { __strokeLongTasks: number[] }).__strokeLongTasks = longs;
  });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => exportText(page), { timeout: 30_000 }).not.toBe("");

  await page.evaluate(async () => {
    // 변수 지정자 — TS 가 정적 해석하지 않게(이 모듈은 vite dev 서버만 안다).
    const modulePath = "/src/editor/editorState.ts";
    const mod = (await import(/* @vite-ignore */ modulePath)) as {
      editorState: { set: (patch: Record<string, unknown>) => void };
    };
    mod.editorState.set({ tool: "paint", layer: "lower", selectedTile: 6, paintShape: "pen", activePaletteStamp: null, brushSize: 1 });
  });
  // 도구 전환이 부른 팔레트 재구축이 가라앉을 때까지 기다린다.
  await page.waitForTimeout(800);

  const box = await page.getByTestId("edit-canvas").locator("canvas").boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const startX = box.x + box.width * 0.2;
  const y = box.y + box.height * 0.45;
  await page.mouse.move(startX, y);

  const before = await exportText(page);
  await page.evaluate(() => {
    const win = window as unknown as { __strokeToolbar: Element | null; __strokeLongTasks: number[] };
    win.__strokeToolbar = document.querySelector('[data-testid="oprn-tile-toolbar"]');
    win.__strokeLongTasks.length = 0;
  });

  await page.mouse.down();
  // 칸(2x 줌 = 32px)마다 하나씩, 칸 사이 300ms — 디바운스 창(120·250·500ms)을 모두 넘기는 느린 드래그.
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(startX + step * 32, y, { steps: 2 });
    await page.waitForTimeout(300);
  }

  const during = await page.evaluate(() => {
    const win = window as unknown as { __strokeToolbar: Element | null; __strokeLongTasks: number[] };
    return {
      toolbarKept: win.__strokeToolbar !== null && win.__strokeToolbar.isConnected,
      maxLongTaskMs: Math.round(Math.max(0, ...win.__strokeLongTasks)),
    };
  });
  const exportDuring = await exportText(page);
  await page.mouse.up();

  expect(during.toolbarKept, "스트로크 도중 도구막대(좌측 팔레트)를 다시 지으면 안 된다").toBe(true);
  expect(exportDuring, "스트로크 도중 프로젝트 전체를 직렬화하면 안 된다").toBe(before);
  expect(during.maxLongTaskMs, "스트로크 중 긴 멈춤").toBeLessThan(500);

  // 떼면 미러와 도구막대가 따라온다 — 결과가 사라진 게 아니라 미뤄졌을 뿐임을 확인한다.
  await expect.poll(() => exportText(page), { timeout: 10_000 }).not.toBe(before);
  await expect.poll(() => page.evaluate(() => {
    const win = window as unknown as { __strokeToolbar: Element | null };
    return win.__strokeToolbar?.isConnected ?? false;
  }), { timeout: 10_000 }).toBe(false);
});
