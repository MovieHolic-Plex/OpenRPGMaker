// 진단용(`_` 접두사 = 기본 스위트 제외). 대사창의 **실제 픽셀 치수**를 재서
// dialogue.css / dialoguePagination.ts 의 상수가 화면과 맞는지 확인한다.
// 추측으로 CSS 를 만지지 않기 위한 계측기다.
import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { createSkyStairProject, SKY_MAP } from "@/editor/content/skyStairGame";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(180_000);
test.use({ serviceWorkers: "block" });

test("대사창 실측", async ({ page }) => {
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(`[${m.type()}] ${m.text()}`); });
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
  const project = createSkyStairProject();
  project.startMapId = SKY_MAP.harbor;
  project.startPos = { x: 15, y: 15 };

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
  await page.waitForTimeout(2000);

  // 화자 이름표가 있는 NPC 대사(부두 상인 나루)를 띄운다.
  await page.getByTestId("event-ev_sky_h_oil").click({ force: true });
  await expect(page.getByTestId("dialogue-box")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500);

  const measured = await page.evaluate(() => {
    const box = document.querySelector("[data-testid='dialogue-box']") as HTMLElement | null;
    if (!box) return { error: "no dialogue-box" };
    const body = box.querySelector(".body") as HTMLElement | null;
    const content = box.querySelector(".dialogue-content") as HTMLElement | null;
    const face = box.querySelector(".dialogue-face") as HTMLElement | null;
    const speaker = box.querySelector(".speaker") as HTMLElement | null;
    const cursor = box.querySelector(".dialogue-page-cursor") as HTMLElement | null;
    const stage = document.querySelector(".play-stage") as HTMLElement | null;
    const cs = (el: Element | null) => (el ? getComputedStyle(el) : null);
    const boxCs = cs(box)!;
    const bodyCs = cs(body);

    // 한 줄의 실측 높이: 본문 안에 임시로 한 줄/두 줄을 넣어 높이 차를 잰다.
    let oneLine = 0;
    let twoLine = 0;
    if (body) {
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;";
      probe.className = body.className;
      const s = getComputedStyle(body);
      probe.style.font = s.font;
      probe.style.fontFamily = s.fontFamily;
      probe.style.fontSize = s.fontSize;
      probe.style.lineHeight = s.lineHeight;
      probe.style.width = `${body.clientWidth}px`;
      body.parentElement?.appendChild(probe);
      probe.textContent = "가";
      oneLine = probe.getBoundingClientRect().height;
      probe.textContent = "가\n나";
      twoLine = probe.getBoundingClientRect().height;
      probe.remove();
    }

    const r = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
    };
    const scale = stage ? stage.getBoundingClientRect().width / 320 : 1;
    return {
      scale: +scale.toFixed(3),
      stageRect: r(stage),
      boxRect: r(box),
      boxClient: { w: box.clientWidth, h: box.clientHeight },
      boxClass: box.className,
      boxFontSize: boxCs.fontSize,
      boxPaddingTop: boxCs.paddingTop,
      boxPaddingLeft: boxCs.paddingLeft,
      boxPaddingRight: boxCs.paddingRight,
      boxBorderWidth: boxCs.borderTopWidth,
      boxMinHeight: boxCs.minHeight,
      contentRect: r(content),
      contentClass: content?.className ?? null,
      bodyRect: r(body),
      bodyClient: body ? { w: body.clientWidth, h: body.clientHeight, scrollH: body.scrollHeight } : null,
      bodyFontSize: bodyCs?.fontSize ?? null,
      bodyLineHeight: bodyCs?.lineHeight ?? null,
      bodyOverflow: bodyCs?.overflow ?? null,
      bodyText: body?.textContent ?? null,
      oneLineHeightPx: +oneLine.toFixed(2),
      twoLineHeightPx: +twoLine.toFixed(2),
      derivedLineHeightPx: +(twoLine - oneLine).toFixed(2),
      speakerRect: r(speaker),
      speakerText: speaker?.textContent ?? null,
      cursorRect: r(cursor),
      faceRect: r(face),
      faceClass: face?.className ?? null,
      faceStyle: face ? { bg: getComputedStyle(face).backgroundImage, w: getComputedStyle(face).width, h: getComputedStyle(face).height } : null,
      overlayRect: r(document.querySelector(".dialogue-overlay")),
    };
  });

  writeFileSync("report-assets/dialogue-measure.json", JSON.stringify(measured, null, 2), "utf8");
  console.log("MEASURED " + JSON.stringify(measured));
  await page.getByTestId("play-stage").screenshot({ path: "report-assets/shots/dialogue-measure-stage.png" });
  await page.getByTestId("test-play-window").screenshot({ path: "report-assets/shots/dialogue-measure-window.png" });
  expect(measured).toBeTruthy();
});
