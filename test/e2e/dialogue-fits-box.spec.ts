// 대사창이 **담을 수 있는 만큼만 페이지에 넣는지** 실제 픽셀로 지킨다.
//
// ── 있었던 결함(2026-07-27 실측) ─────────────────────────────────────────────
// `DIALOGUE_LINES_PER_PAGE = 4` 는 상수였는데 실제로 들어가는 줄 수는 화자 이름표
// 유무에 따라 달랐다:
//     이름표 없음 → 상자 안쪽 42.8px / 줄 10.8px = 3.96줄  ≈ 4  (상수가 맞음)
//     이름표 있음 → padding-top 18.9px 를 빼면 23.9px = 2.2줄 ≈ 2  (상수가 두 배 큼)
// NPC 대사는 항상 이름표가 있으므로 3·4번째 줄이 늘 잘렸다. `.body { overflow: auto }`
// 라서 잘린 줄은 스크롤 영역에 남아 있었고, 화면에는 그냥 문장이 사라진 것으로 보였다.
// padding-top 이 18.9px 이었던 이유는 값이 `1.35em` 이고 `.dialogue-box` 에 font-size
// 선언이 없어 **상속된 14px** 로 풀렸기 때문이다(본문 글꼴은 9px).
//
// ── 지키는 것 ────────────────────────────────────────────────────────────────
//   ① 본문이 넘치지 않는다(scrollHeight <= clientHeight) — 잘린 줄이 없다.
//   ② 화자 이름표가 본문 첫 줄을 덮지 않는다.
//   ③ 얼굴이 본문 글자 영역을 침범하지 않고, 창 밖으로도 나가지 않는다.
// 상수를 다시 박아 넣거나 padding 을 em 으로 되돌리면 ①이 깨진다.
import { expect, test } from "@playwright/test";
import { createSkyStairProject, SKY_MAP } from "@/editor/content/skyStairGame";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(180_000);
test.use({ serviceWorkers: "block" });

type Boxes = {
  readonly bodyClientH: number;
  readonly bodyScrollH: number;
  readonly lineHeight: number;
  readonly body: readonly number[];
  readonly box: readonly number[];
  readonly speaker: readonly number[] | null;
  readonly face: readonly number[] | null;
  readonly faceBg: string;
};

test("대사창이 담을 수 있는 만큼만 넣는다 — 잘린 줄·가려진 첫 줄·삐져나온 얼굴 없음", async ({ page }) => {
  const project = createSkyStairProject();
  project.startMapId = SKY_MAP.harbor;
  project.startPos = { x: 15, y: 15 };

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
  await page.waitForTimeout(2000);

  // 부두 상인 나루 — 화자 이름표 + 얼굴이 모두 붙는 NPC 다(이 조합이 결함이 났던 조합).
  await page.getByTestId("event-ev_sky_h_oil").click({ force: true });
  await expect(page.getByTestId("dialogue-box")).toBeVisible({ timeout: 15_000 });

  const read = async (): Promise<Boxes> => await page.evaluate(() => {
    const box = document.querySelector("[data-testid='dialogue-box']") as HTMLElement;
    const body = box.querySelector(".body") as HTMLElement;
    const speaker = box.querySelector(".speaker") as HTMLElement | null;
    const face = box.querySelector(".dialogue-face") as HTMLElement | null;
    const rect = (el: Element | null): number[] | null => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return [b.left, b.top, b.right, b.bottom];
    };
    const cs = getComputedStyle(body);
    const lh = parseFloat(cs.lineHeight);
    return {
      bodyClientH: body.clientHeight,
      bodyScrollH: body.scrollHeight,
      lineHeight: Number.isFinite(lh) ? lh : parseFloat(cs.fontSize) * 1.2,
      body: rect(body) as number[],
      box: rect(box) as number[],
      speaker: rect(speaker),
      face: rect(face),
      faceBg: face ? getComputedStyle(face).backgroundImage : "",
    };
  });

  // 페이지를 넘기며 매 페이지를 검사한다 — 첫 페이지만 보면 두 번째 페이지의 넘침을 놓친다.
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    await page.waitForTimeout(2200); // 타이핑이 끝나 한 페이지가 다 찍히기를 기다린다.
    const m = await read();
    const where = `page#${pageIndex}`;

    // ① 잘린 줄이 없다. 서브픽셀 반올림 1px 만 허용한다.
    expect(
      m.bodyScrollH,
      `${where}: 본문이 넘쳤다 — scrollHeight ${m.bodyScrollH} > clientHeight ${m.bodyClientH}. `
      + `줄 높이 ${m.lineHeight}px 이므로 담을 수 있는 줄은 `
      + `${Math.floor(m.bodyClientH / m.lineHeight)}줄이다. maxLines 를 상자에서 유도하는지 확인하라.`,
    ).toBeLessThanOrEqual(m.bodyClientH + 1);

    // ② 이름표가 본문 첫 줄을 덮지 않는다.
    if (m.speaker) {
      expect(
        m.speaker[3],
        `${where}: 화자 이름표(bottom ${m.speaker[3]})가 본문(top ${m.body[1]})을 덮는다`,
      ).toBeLessThanOrEqual(m.body[1] + 1);
    }

    // ③ 얼굴은 글자를 가리지 않고, 창 밖으로도 나가지 않는다.
    if (m.face) {
      expect(m.faceBg, `${where}: 얼굴에 이미지가 없다 — 페이스셋 렌더 경로가 끊겼다`)
        .toContain("url(");
      expect(m.face[2], `${where}: 얼굴이 본문 글자 영역을 침범한다`).toBeLessThanOrEqual(m.body[0] + 1);
      expect(m.face[3], `${where}: 얼굴이 창 아래 테두리를 뚫고 나갔다`).toBeLessThanOrEqual(m.box[3] + 1);
    }

    await page.getByTestId("dialogue-box").click({ force: true });
    if (!(await page.getByTestId("dialogue-box").isVisible())) break;
  }
});
