import { expect, test, type Page } from "@playwright/test";

// task21 — 여섯 공간 탭(타일·오브젝트·공간·장소·지역·세계) 브라우저 인수검사.
//
// 계획서 요구: 실제 액션 메뉴 진입을 쓰고 숨은 툴바 버튼을 가정하지 않는다.
// 세 뷰포트에서 주요 컨트롤이 잘리거나 덮이지 않는지, 콘솔 예외가 없는지 본다.
// 표본 세계 원격 공개(task19)에 의존하지 않는 범위만 다룬다 — DB 접속 없이 돌아간다.

// 실행 규약 (2026-09-09 실측, 동일 head·동일 호스트). 이 스펙은 편집기 전역을 띄우고 여섯
// 탭을 돌며 탭당 스크린샷을 찍는다. 두 가지를 지켜야 초록이 재현된다.
//
// 1) trace 를 끈다. 저장소 기본값 `retain-on-failure` 로는 스냅샷 기록이 지배적 비용이 되어
//    1024x768 이 `toolbar-database` 단계에서 540초 예산을 전부 태우고 실패했다. `--trace off`
//    에선 같은 테스트가 27~39초에 통과한다.
//
// 2) 저장소 기본 재시도(`retries: 1`)를 끄지 마라. 호스트 네트워크가 흔들리면 크로미움은
//    127.0.0.1 요청까지 포함해 진행 중 요청을 전부 취소하고(`net::ERR_NETWORK_CHANGED`),
//    그 실행은 `#app` 이 빈 채로 남아 상단이 렌더되지 않는다. 러너와 같은 컨텍스트로 5회
//    연속 부팅을 재면 3회는 4.4~4.6초에 뜨고 2회는 60초 안에 못 뜬다(실패 실행은
//    appHtmlLen=0, 미완료 요청 0, ERR_NETWORK_CHANGED 반복). playwright.config.ts 가 이
//    현상을 주석으로 설명하며 재시도로 흡수하게 해뒀다 — `E2E_RETRIES=0` 으로 끄면 호스트
//    잡음이 제품 실패처럼 보인다. 재시도까지 물리면 사설 네트워크 네임스페이스에서 서버와
//    브라우저를 함께 띄워 격리한다(memory: isolated-loopback-browser-qa).
//
// 증거는 뷰포트별로 프로세스를 나눠 로그를 분리해 모은다(각 24~32초):
//
//   for vp in 1024x768 1280x800 1440x900; do \
//     DEV_SERVER_PORT=$PORT npx playwright test test/e2e/spatial-authoring.spec.ts \
//       --workers=1 --trace off -g "$vp"; \
//   done
//
// 예산을 늘리거나 단정을 약하게 하지 않고 원인 쪽을 끈다. 실패 증거는 탭당 PNG 와
// Playwright 실패 스크린샷으로 남는다.
test.use({ trace: "off" });

const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

const SHOT_DIR = "output/evidence/tile-to-world/task-21";

// 로컬 codex 브리지 거부는 개발 환경 잡음이라 허용한다(기존 db-desktop-matrix 와 동일 규약).
const ALLOWED_CONSOLE_ERROR = "Failed to load resource: net::ERR_CONNECTION_REFUSED";

const SPATIAL_TABS = [
  { testid: "db-tab-spatial-tiles", label: "타일" },
  { testid: "db-tab-spatial-objects", label: "오브젝트" },
  { testid: "db-tab-spatial-spaces", label: "공간" },
  { testid: "db-tab-spatial-places", label: "장소" },
  { testid: "db-tab-spatial-regions", label: "지역" },
  { testid: "db-tab-spatial-worlds", label: "세계" },
] as const;

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (msg.text() === ALLOWED_CONSOLE_ERROR) return;
    errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return errors;
}

/** 가림 검출기 자체를 그 자리에서 증명한다 — 실제 요소를 덮어 covered 가 참이 되는지 본다.
 * 이 검사가 없으면 "covered: false" 는 검출기가 아무것도 못 보는 상태와 구분되지 않는다.
 * (2026-09-09: CSS 고의 결함 주입은 사이드바 클릭까지 막아 의도한 단정 대신 클릭 인터셉트로
 *  실패했다. 그래서 결함을 스펙 안으로 들여와 매 실행이 검출기를 재증명한다.) */
async function provesOcclusionDetection(page: Page, testid: string): Promise<{ withOverlay: boolean; afterRemoval: boolean }> {
  await page.evaluate((id) => {
    const target = document.querySelector(`[data-testid="${id}"]`);
    if (!target) throw new Error(`가림 자체검사 대상이 없다: ${id}`);
    const rect = target.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.dataset.testid = "occlusion-selfcheck-overlay";
    overlay.style.cssText = `position:fixed;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;z-index:2147483647;background:rgba(255,0,0,.2)`;
    document.body.append(overlay);
  }, testid);
  const withOverlay = (await reachable(page, testid)).covered;
  await page.evaluate(() => document.querySelector('[data-testid="occlusion-selfcheck-overlay"]')?.remove());
  const afterRemoval = (await reachable(page, testid)).covered;
  return { withOverlay, afterRemoval };
}

/** 컨트롤이 실제로 보이고, 창 밖으로 잘리지 않고, 다른 요소에 덮이지 않았는지. */
async function reachable(page: Page, testid: string): Promise<{ visible: boolean; clipped: boolean; covered: boolean }> {
  const locator = page.getByTestId(testid);
  const visible = await locator.isVisible();
  if (!visible) return { visible, clipped: false, covered: false };
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) return { visible, clipped: true, covered: false };
  const clipped = box.x < 0 || box.y < 0 || box.x + box.width > viewport.width || box.y + box.height > viewport.height;
  // 중심점의 실제 최상단 요소가 이 컨트롤(또는 그 자손)인지 확인한다.
  const covered = await locator.evaluate((node, point) => {
    const top = document.elementFromPoint(point.x, point.y);
    return !(top instanceof Element) || !(node.contains(top) || node === top);
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  return { visible, clipped, covered };
}

for (const { width, height } of VIEWPORTS) {
  const vp = `${width}x${height}`;

  test(`spatial six tabs ${vp}: every tab opens with reachable controls and a clean console`, async ({ page }) => {
    test.setTimeout(180_000);
    test.slow();
    const consoleErrors = watchConsole(page);

    await page.setViewportSize({ width, height });
    // DB 툴바는 expert chrome 에서만 노출된다.
    await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
    await page.goto("/?freshProject=1");

    // 실제 액션 메뉴 진입 — 숨은 버튼을 직접 부르지 않는다.
    // (이 클릭이 무한히 매달리면 상단 자체가 렌더되지 않은 상태다 — 위 실행 규약 2번을 보라.)
    await page.getByTestId("toolbar-database").click();
    await expect(page.getByTestId("database-modal")).toBeVisible();

    // 사이드바는 처음에 한 그룹만 펼친다(29개를 한 줄로 쏟지 않는 설계).
    // 공간 탭 여섯 개는 «맵» 그룹에 있으므로, 실제 사용자처럼 그 그룹 머리를 눌러 펼친다.
    const mapGroup = page.getByTestId("db-tab-group-world");
    await expect(mapGroup).toBeVisible();
    // 사이드바는 자체 스크롤 컨테이너다(1024 에서 내용 741px > 뷰 646px). 사용자는 목록을
    // 굴려서 그룹 머리를 화면 안으로 들인다. Playwright 의 자동 스크롤은 모달 본문 쪽을
    // 굴려 그룹이 본문 경계 밑에 남는 경우가 있어 클릭이 계속 가로막힌다(실측: 1024·1280
    // 에서 540초 예산 소진). 그래서 그 컨테이너를 명시적으로 굴린다 — 단정 완화가 아니다.
    await mapGroup.evaluate((node) => node.scrollIntoView({ block: "center" }));
    if ((await mapGroup.getAttribute("aria-expanded")) !== "true") await mapGroup.click();
    await expect(mapGroup).toHaveAttribute("aria-expanded", "true");

    for (const tab of SPATIAL_TABS) {
      // Given: 펼친 그룹 안에 그 탭이 실제로 보인다.
      const entry = page.getByTestId(tab.testid);
      await expect(entry, `${tab.label} 탭이 사이드바에 없다`).toBeVisible();

      // When: 사용자가 목록을 굴려 그 탭을 화면에 들인 뒤 누른다.
      await entry.evaluate((node) => node.scrollIntoView({ block: "center" }));
      await entry.click();

      // Then: 본문이 비어 있지 않고, 원자-우선 빈 상태로 떨어지지 않는다.
      const body = page.locator(".database-modal-body");
      await expect(body).toBeVisible();
      const text = (await body.innerText()).trim();
      expect(text.length, `${tab.label} 탭 본문이 비었다`).toBeGreaterThan(0);

      // 주요 컨트롤이 잘리거나 덮이지 않아야 한다. 갤러리는 여섯 탭 공통이고,
      // 무대 캔버스는 타일 탭이 자체 편집 화면을 쓰므로 있는 경우에만 본다.
      const gallery = await reachable(page, "spatial-gallery");
      expect({ tab: tab.label, ...gallery }).toEqual({ tab: tab.label, visible: true, clipped: false, covered: false });

      // 첫 탭에서 검출기를 증명한다: 덮으면 covered 가 참, 걷어내면 다시 거짓.
      if (tab === SPATIAL_TABS[0]) {
        expect(await provesOcclusionDetection(page, "spatial-gallery"))
          .toEqual({ withOverlay: true, afterRemoval: false });
      }
      if (await page.getByTestId("spatial-canvas").count() > 0) {
        const canvas = await reachable(page, "spatial-canvas");
        expect({ tab: tab.label, ...canvas }).toEqual({ tab: tab.label, visible: true, clipped: false, covered: false });
      }

      // 1024 바닥 계약: 모달 창에 가로 스크롤이 생기지 않는다.
      const overflow = await page.evaluate(() => {
        const node = document.querySelector(".database-modal-window");
        return node ? node.scrollWidth - node.clientWidth : 0;
      });
      expect({ tab: tab.label, overflow }).toEqual({ tab: tab.label, overflow: 0 });

      await page.getByTestId("database-modal").screenshot({ path: `${SHOT_DIR}/six-tabs-${vp}-${tab.testid}.png` });
    }

    // Escape 로 모달이 닫히고, 그 과정에서 예외가 없어야 한다.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("database-modal")).toBeHidden();
    expect(consoleErrors, `${vp} 콘솔 예외`).toEqual([]);
  });
}
