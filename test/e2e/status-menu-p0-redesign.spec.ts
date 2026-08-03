import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  openTestPlayWindow,
  screenshotMenu,
  seededStatusMenuProject,
  selectCommand,
} from "./rm2k3PlayerStatusMenuHelpers";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIR = "evidence/browser-screenshots/status-menu-p0-redesign";

// docs/2026-08-03-ingame-menu-uiux-proposal.html 의 P0 4건에 대한 실측 증거.
//   P0-1 HP/MP 게이지 + 임계 색상
//   P0-2 명령 레일 그룹화 + 파괴적 액션 분리
//   P0-3 포커스 모델(활성 하나 / 비활성 감광)
//   P0-4 리스트 클리핑 제거 + 스크롤 어포던스
test("keeps the redesigned status menu readable without clipping any text", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await startPlayOnMap(page);
  await openStatusMenu(page);

  // P0-2 — 그룹 라벨 4개가 실제로 렌더되고, 타이틀만 파괴적으로 표시된다.
  for (const groupId of ["action", "party", "record", "system"]) {
    await expect(page.getByTestId(`status-menu-command-group-${groupId}`)).toBeVisible();
  }
  await expect(page.getByTestId("status-menu-command-to-title")).toHaveClass(/destructive/);
  await expect(page.getByTestId("status-menu-command-items")).not.toHaveClass(/destructive/);
  // 그룹 라벨을 넣으면서 레일 높이를 넘겨 저장/로드/대기/타이틀이 화면 밖으로 밀린 적이 있다.
  // toBeVisible 은 overflow:hidden 으로 잘린 자식도 통과시키므로 레일 안에 실제로 들어왔는지 본다.
  expect(await commandsOutsideRail(page)).toEqual([]);

  // P0-1 — 파티 4명 전원에게 HP/MP 게이지가 있고, 채워진 폭이 0 이 아니다.
  for (let index = 0; index < 4; index += 1) {
    const hp = page.getByTestId(`status-menu-hp-gauge-${index}`);
    await expect(hp).toBeVisible();
    expect(await filledGaugeWidth(page, `status-menu-hp-gauge-${index}`)).toBeGreaterThan(0);
    await expect(page.getByTestId(`status-menu-mp-gauge-${index}`)).toBeVisible();
  }

  // P0-4 — 아이템 목록의 모든 행이 1줄로 압축돼 잘리지 않는다.
  await selectCommand(page, "items", "아이템");
  expect(await clippedMenuText(page)).toEqual([]);
  const compactRows = page.locator(".status-menu-detail-action.status-menu-detail-row-compact");
  expect(await compactRows.count()).toBeGreaterThan(0);
  await screenshotMenu(page, `${EVIDENCE_DIR}/items-grouped-rail-and-gauges.png`);

  // P0-3 — 상세 패널로 들어가면 레일이 감광되고, 활성 커서는 상세 쪽에만 남는다.
  await expect(page.getByTestId("main-menu")).toHaveAttribute("data-status-menu-screen", "function");
  expect(await panelOpacity(page, "status-menu-command-rail")).toBeLessThan(1);
  expect(await panelOpacity(page, "status-menu-detail")).toBe(1);

  await selectCommand(page, "equipment", "장비");
  expect(await clippedMenuText(page)).toEqual([]);
  await screenshotMenu(page, `${EVIDENCE_DIR}/equipment-grouped-rail-and-gauges.png`);
});

/** startActualPlay 와 달리 runtime-state-json 을 기다리지 않는다 — 이 스펙은 상태 덤프가
    필요 없고, 그 대기는 이 환경에서 메뉴 스펙 전반을 막고 있다(main 에서도 동일하게 실패). */
async function startPlayOnMap(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, seededStatusMenuProject());
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page, { waitForRuntimeState: false });
  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 15000 });
}

/** X 키는 스테이지가 포커스를 가진 뒤에만 먹는다. 부팅 직후엔 아직 포커스가 없을 수 있어
    스테이지를 한 번 클릭하고, 첫 입력이 유실되면 한 번 더 시도한다. */
async function openStatusMenu(page: Page): Promise<void> {
  const rail = page.getByTestId("status-menu-command-rail");
  await page.getByTestId("play-stage").click({ position: { x: 5, y: 5 } });
  // player.ts 는 `key === "x"` 소문자로 비교한다 — press("X") 는 key 를 "X" 로 보내 안 먹는다.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.keyboard.press("x");
    try {
      await expect(rail).toBeVisible({ timeout: 3000 });
      return;
    } catch {
      /* 다음 시도 */
    }
  }
  await expect(rail).toBeVisible({ timeout: 5000 });
}

/** 레일의 보이는 영역을 벗어난 명령들. 잘려 나간 항목은 조작 자체가 불가능하다. */
async function commandsOutsideRail(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>("[data-testid='status-menu-command-rail']");
    if (!rail) return ["missing rail"];
    const railRect = rail.getBoundingClientRect();
    return Array.from(rail.querySelectorAll<HTMLElement>(".status-menu-command"))
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.bottom > railRect.bottom + 1 || rect.top < railRect.top - 1 || rect.height <= 0;
      })
      .map((node) => node.textContent?.trim() ?? node.className);
  });
}

/** 게이지 채움 span 의 실제 렌더 폭(px). 0 이면 비율 계산이 깨졌다는 뜻. */
async function filledGaugeWidth(page: Page, testId: string): Promise<number> {
  return page.evaluate((id) => {
    const fill = document
      .querySelector(`[data-testid='${id}']`)
      ?.querySelector<HTMLElement>(".status-menu-vital-gauge-fill");
    return fill ? fill.getBoundingClientRect().width : 0;
  }, testId);
}

async function panelOpacity(page: Page, testId: string): Promise<number> {
  return page.evaluate((id) => {
    const node = document.querySelector(`[data-testid='${id}']`);
    if (!node) return -1;
    return Number.parseFloat(getComputedStyle(node).opacity);
  }, testId);
}

/** 텍스트를 직접 담은 리프 요소 중 자기 박스를 넘긴 것 — 스크롤 컨테이너의 의도된 overflow 는 제외. */
async function clippedMenuText(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>("[data-testid='main-menu']");
    if (!menu) return ["missing main menu"];
    const scrollers = new Set(Array.from(menu.querySelectorAll(".status-menu-detail-list, .status-menu-scene-list")));
    return Array.from(menu.querySelectorAll<HTMLElement>("*"))
      .filter((node) => !scrollers.has(node))
      .filter((node) => node.childElementCount === 0 && node.offsetParent !== null && node.textContent?.trim())
      .filter((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)
      .map((node) => `${node.className}: ${node.textContent?.trim() ?? ""}`);
  });
}
