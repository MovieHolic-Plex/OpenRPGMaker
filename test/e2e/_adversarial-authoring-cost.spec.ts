/**
 * 적대적 분석 2부: 저작 흐름의 비용을 실측한다.
 *
 * 런타임 커맨드 커버리지는 이미 확인했다(화면효과 5종 전부 동작).
 * 남은 질문은 UI/UX 다: "만들 수 있다" 와 "만들기 좋다" 는 다르다.
 *
 * 측정 대상:
 *   A. 신규 프로젝트에서 첫 대사 한 줄을 넣기까지 필요한 클릭 수
 *   B. 기본 모드 / 전문가 모드가 감추는 기능
 *   C. 메인 피커에 없는 커맨드에 도달하는 경로 비용
 *   D. 접근성: 키보드 도달 가능성, 포커스 표시, aria 라벨
 */
import { expect, test } from "@playwright/test";
import { mkdir, rm, writeFile } from "node:fs/promises";

const DIR = "output/evidence/adversarial-ui-ux";

test.setTimeout(240_000);

test("적대적: 저작 흐름 비용과 모드별 기능 노출을 실측한다", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  const findings: Record<string, unknown> = {};

  await page.goto("/?blankProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: `${DIR}/flow-01-first-open.png` });

  // A. 첫 화면에 온보딩 모달이 있는가. 있으면 저작 전 필수 클릭이 늘어난다.
  const onboarding = page.getByRole("dialog");
  const onboardingCount = await onboarding.count();
  findings.onboardingDialogOnFirstOpen = onboardingCount;
  if (onboardingCount > 0) {
    findings.onboardingText = (await onboarding.first().textContent())?.slice(0, 200);
    const skip = page.getByRole("button", { name: "건너뛰기" });
    if (await skip.count()) await skip.click();
  }

  // B. 기본 모드에서 보이는 것과 전문가 모드에서 보이는 것을 비교한다.
  async function surfaceInventory() {
    return page.evaluate(() => {
      const testIds = [...document.querySelectorAll("[data-testid]")]
        .map((el) => (el as HTMLElement).dataset.testid)
        .filter((v): v is string => Boolean(v));
      const buttons = [...document.querySelectorAll("button")].filter(
        (b) => (b as HTMLElement).offsetParent !== null
      );
      return {
        visibleButtons: buttons.length,
        testIdCount: new Set(testIds).size,
        hasTestPlay: testIds.includes("topbar-test-play"),
        // 접근성: 보이는 버튼 중 접근 가능한 이름이 없는 것
        buttonsWithoutName: buttons.filter((b) => {
          const t = (b.textContent ?? "").trim();
          const aria = b.getAttribute("aria-label") ?? b.getAttribute("title") ?? "";
          return !t && !aria;
        }).length,
      };
    });
  }

  const basicSurface = await surfaceInventory();
  await page.screenshot({ path: `${DIR}/flow-02-basic-mode.png` });

  const expert = page.getByRole("button", { name: "전문가 모드" });
  if (await expert.count()) await expert.click();
  await page.waitForTimeout(600);
  const expertSurface = await surfaceInventory();
  await page.screenshot({ path: `${DIR}/flow-03-expert-mode.png` });

  findings.basicMode = basicSurface;
  findings.expertMode = expertSurface;
  findings.testPlayVisibleInBothModes = basicSurface.hasTestPlay && expertSurface.hasTestPlay;

  // C. 신규 프로젝트에서 첫 대사 한 줄까지의 클릭 비용을 센다.
  //    정식 경로는 test/e2e/eventEditorCertEvidence.ts 의 openEventEditor 와 같다.
  let clicks = onboardingCount > 0 ? 1 : 0;
  // 기본 모드로 돌아가 초보자 경로를 측정한다.
  const basicBtn = page.getByRole("button", { name: "기본 모드" });
  if (await basicBtn.count()) { await basicBtn.click(); clicks += 1; }
  await page.waitForTimeout(400);
  await page.getByTestId("layer-event").click();
  clicks += 1;
  await page.screenshot({ path: `${DIR}/flow-04-event-layer.png` });

  const canvas = page.getByTestId("edit-canvas").locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  clicks += 1;
  await expect(page.getByTestId("basic-create-selected-event")).toBeVisible();
  findings.pendingEventCtaVisible = true;
  findings.newEventModalBeforeCta = await page.getByTestId("event-editor-modal").count();
  await page.getByTestId("basic-create-selected-event").click();
  clicks += 1;
  await expect(page.getByTestId("event-editor-modal")).toBeVisible({ timeout: 20_000 });
  findings.eventEditorReached = true;
  await page.screenshot({ path: `${DIR}/flow-05-after-canvas-click.png` });
  await page.screenshot({ path: `${DIR}/flow-06-event-editor.png` });

  await page.getByTestId("event-command-empty-line").dblclick();
  clicks += 1;
  await expect(page.getByTestId("event-command-picker")).toBeVisible();
  findings.commandPicker = await page.evaluate(() => ({
    selectable: document.querySelectorAll("[data-testid^='command-picker-add-']").length,
    informational: document.querySelectorAll("[data-testid^='command-picker-info-']").length,
    tabs: document.querySelectorAll("[data-testid^='event-command-picker-tab-']").length,
  }));
  await page.screenshot({ path: `${DIR}/flow-07-command-picker.png` });
  findings.clicksToFirstCommandPicker = clicks;

  // D. 키보드 도달성: Tab 을 20번 눌러 포커스가 실제로 이동하는지 본다.
  await page.keyboard.press("Escape");
  const focusTrail: string[] = [];
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      if (!a || a === document.body) return "(body)";
      const name = (a.textContent ?? "").trim().slice(0, 24) || a.getAttribute("aria-label") || "";
      return `${a.tagName.toLowerCase()}:${a.dataset.testid ?? ""}:${name}`;
    });
    focusTrail.push(label);
  }
  findings.focusTrail = focusTrail;
  findings.focusStuckOnBody = focusTrail.filter((f) => f === "(body)").length;
  findings.uniqueFocusStops = new Set(focusTrail).size;

  await writeFile(`${DIR}/authoring-cost.json`, JSON.stringify(findings, null, 2));

  console.log("=== 저작 비용 실측 ===");
  console.log("  첫 화면 온보딩 모달:", findings.onboardingDialogOnFirstOpen);
  console.log("  기본 모드 보이는 버튼:", basicSurface.visibleButtons, "/ testId", basicSurface.testIdCount);
  console.log("  전문가 모드 보이는 버튼:", expertSurface.visibleButtons, "/ testId", expertSurface.testIdCount);
  console.log("  양쪽 모드 테스트 플레이 노출:", findings.testPlayVisibleInBothModes);
  console.log("  이름 없는 버튼(기본/전문가):", basicSurface.buttonsWithoutName, "/", expertSurface.buttonsWithoutName);
  console.log("  이벤트 편집기 도달:", findings.eventEditorReached === true);
  console.log("  선택 좌표 CTA / 모달 전 상태:", findings.pendingEventCtaVisible, "/", findings.newEventModalBeforeCta);
  console.log("  첫 커맨드 피커까지 클릭 수:", findings.clicksToFirstCommandPicker);
  console.log("  커맨드 피커:", JSON.stringify(findings.commandPicker ?? "미노출"));
  console.log("  Tab 20회 중 body 고립:", findings.focusStuckOnBody, "/ 고유 정지점", findings.uniqueFocusStops);

  expect(Object.keys(findings).length, "관측이 비어 있다").toBeGreaterThan(5);
});
