import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  openTestPlayWindow,
  screenshotMenu,
  seededStatusMenuProject,
  selectCommand,
} from "./oprnPlayerStatusMenuHelpers";
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

  // P0-2 / edge dock — legacy section labels stay in the DOM for compatibility,
  // while the compact six-command dock hides them from presentation.
  await expect(page.getByTestId("status-menu-command-group-action")).toBeHidden();
  for (const entryId of ["party-menu", "record-menu", "system-menu"]) {
    await expect(page.getByTestId(`status-menu-command-${entryId}`)).toBeVisible();
  }
  await expect(page.getByTestId("status-menu-command-items")).not.toHaveClass(/destructive/);
  // 그룹 라벨을 넣으면서 레일 높이를 넘겨 저장/로드/대기/타이틀이 화면 밖으로 밀린 적이 있다.
  // toBeVisible 은 overflow:hidden 으로 잘린 자식도 통과시키므로 레일 안에 실제로 들어왔는지 본다.
  expect(await commandsOutsideRail(page)).toEqual([]);

  // P0-1 — 파티 4명 전원에게 HP 게이지가 있고, 채워진 폭이 0 이 아니다.
  // B안 사이드바는 1줄/1명이라 MP 게이지와 정확한 수치는 "상태" 화면이 맡는다.
  // 화면에서 빠지는 값이므로 접근성 라벨에는 남아 있어야 한다.
  for (let index = 0; index < 4; index += 1) {
    await expect(page.getByTestId(`status-menu-hp-gauge-${index}`)).toBeVisible();
    expect(await filledGaugeWidth(page, `status-menu-hp-gauge-${index}`)).toBeGreaterThan(0);
    await expect(page.getByTestId(`status-menu-party-row-${index}`)).toHaveAttribute("aria-label", /HP \d+\/\d+ MP \d+\/\d+/);
  }
  // 레일과 같은 사고가 파티에서도 났다 — 얼굴 크기 때문에 4명 중 뒤 2명이 통째로 잘렸다.
  expect(await clippedOutOf(page, "status-menu-party", ".status-menu-party-row")).toEqual([]);
  // 좁은 열에서 설명이 이름 위로 삐져나와 글자가 겹친 적이 있다.
  expect(await overlappingCompactCells(page)).toEqual([]);

  // P0-4 — 아이템 목록의 모든 행이 1줄로 압축돼 잘리지 않는다.
  await selectCommand(page, "items", "아이템");
  expect(await clippedMenuText(page)).toEqual([]);
  const compactRows = page.locator(".status-menu-detail-action.status-menu-detail-row-compact");
  expect(await compactRows.count()).toBeGreaterThan(0);
  // B안의 요점 — 넓어진 작업 영역에서 이름 + 효과 + 개수가 **한 줄**에 들어간다.
  // 설명이 둘째 줄로 내려가면 행 높이가 두 배가 되고 목록에 들어가는 항목 수가 반으로 준다.
  expect(await multiLineCompactRows(page)).toEqual([]);
  await screenshotMenu(page, `${EVIDENCE_DIR}/items-grouped-rail-and-gauges.png`);

  // P0-3 — 상세 패널로 들어가면 레일이 감광되고, 활성 커서는 상세 쪽에만 남는다.
  await expect(page.getByTestId("main-menu")).toHaveAttribute("data-status-menu-screen", "function");
  expect(await panelOpacity(page, "status-menu-command-rail")).toBeLessThan(1);
  expect(await panelOpacity(page, "status-menu-detail")).toBe(1);

  await selectCommand(page, "equipment", "장비");
  expect(await clippedMenuText(page)).toEqual([]);
  await screenshotMenu(page, `${EVIDENCE_DIR}/equipment-grouped-rail-and-gauges.png`);

  // 목업 C — 장비 후보로 들어가면 사이드바가 "변화" 블록으로 바뀌고 증감이 보인다.
  await page.getByTestId("status-menu-equipment-actor-actor_hero").click();
  await page.getByTestId("status-menu-equipment-slot-weapon").click();
  await expect(page.getByTestId("status-menu-stat-delta")).toBeVisible();
  // 파티 대신 뜬다 — 둘 다 넣으면 사이드바를 넘긴다.
  await expect(page.getByTestId("status-menu-party")).toHaveCount(0);
  for (const stat of ["공격", "방어", "정신", "민첩"]) {
    await expect(page.getByTestId(`status-menu-stat-delta-${stat}`)).toBeVisible();
  }
  // 실제로 바뀌는 값이 하나라도 화살표로 표시돼야 한다.
  expect(await page.locator(".status-menu-stat-delta-row.up, .status-menu-stat-delta-row.down").count())
    .toBeGreaterThan(0);
  expect(await clippedMenuText(page)).toEqual([]);
  // 커서를 실제 후보로 옮기면 "변화" 블록이 그 후보 기준으로 갱신된다.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".status-menu-stat-delta-row.up")).toHaveCount(1);
  expect(await clippedMenuText(page)).toEqual([]);
  await screenshotMenu(page, `${EVIDENCE_DIR}/equipment-stat-delta.png`);
  await page.keyboard.press("x");
  await page.keyboard.press("x");

  // B안 — 접힌 시스템 그룹이 작업 영역에 펼쳐지고, 타이틀은 거기서 파괴적으로 표시된다.
  await page.getByTestId("status-menu-command-system-menu").click();
  await expect(page.getByTestId("status-menu-detail-title")).toHaveText("시스템");
  for (const commandId of ["save", "load", "wait", "to-title"]) {
    await expect(page.getByTestId(`status-menu-group-command-${commandId}`)).toBeVisible();
  }
  expect(await clippedMenuText(page)).toEqual([]);
  expect(await commandsOutsideRail(page)).toEqual([]);
  await screenshotMenu(page, `${EVIDENCE_DIR}/system-group-expanded.png`);
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

/** 컨테이너의 보이는 영역을 벗어난 자식들. */
async function clippedOutOf(page: Page, containerTestId: string, childSelector: string): Promise<readonly string[]> {
  return page.evaluate(({ containerTestId: id, childSelector: sel }) => {
    const box = document.querySelector<HTMLElement>(`[data-testid='${id}']`);
    if (!box) return [`missing ${id}`];
    const boxRect = box.getBoundingClientRect();
    return Array.from(box.querySelectorAll<HTMLElement>(sel))
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.bottom > boxRect.bottom + 1 || rect.top < boxRect.top - 1 || rect.height <= 0;
      })
      .map((node) => node.getAttribute("aria-label") ?? node.textContent?.trim() ?? node.className);
  }, { containerTestId, childSelector });
}

/** 한 행 안에서 이름/설명/개수 칸이 서로 겹친 경우 — 좁은 열에서 글자가 포개져 읽을 수 없다. */
async function overlappingCompactCells(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const overlaps: string[] = [];
    for (const row of Array.from(document.querySelectorAll<HTMLElement>(".status-menu-detail-row-compact"))) {
      const cells = Array.from(row.querySelectorAll<HTMLElement>(
        ".status-menu-detail-label, .status-menu-detail-description, .status-menu-detail-value"
      )).map((cell) => ({ cell, rect: cell.getBoundingClientRect() }));
      for (let i = 0; i < cells.length; i += 1) {
        for (let j = i + 1; j < cells.length; j += 1) {
          const a = cells[i]!.rect;
          const b = cells[j]!.rect;
          if (a.right > b.left + 1 && b.right > a.left + 1) {
            overlaps.push(row.textContent?.trim() ?? row.className);
          }
        }
      }
    }
    return Array.from(new Set(overlaps));
  });
}

/** 레일의 보이는 영역을 벗어난 명령들. 잘려 나간 항목은 조작 자체가 불가능하다. */
async function commandsOutsideRail(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>("[data-testid='status-menu-command-rail']");
    if (!rail) return ["missing rail"];
    const railRect = rail.getBoundingClientRect();
    // The logical 1px dock border is integer-scaled with the 320x240 stage,
    // so allow the transformed border width while still rejecting clipped rows.
    const tolerance = 4;
    return Array.from(rail.querySelectorAll<HTMLElement>(".status-menu-command:not(.selected)"))
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.bottom > railRect.bottom + tolerance || rect.top < railRect.top - tolerance || rect.height <= 0;
      })
      .map((node) => node.textContent?.trim() ?? node.className);
  });
}

/** 한 줄을 넘긴 압축 행 — 설명이 아래로 접혔다는 뜻이다. */
async function multiLineCompactRows(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    // getBoundingClientRect 는 스테이지 스케일이 곱해진 값이고 lineHeight 는 CSS px 다.
    // 둘을 섞으면 항상 "2줄" 로 오판한다 — clientHeight(비스케일)로 비교한다.
    return Array.from(document.querySelectorAll<HTMLElement>(".status-menu-detail-row-compact"))
      .filter((row) => {
        const cells = Array.from(row.querySelectorAll<HTMLElement>(
          ".status-menu-detail-label, .status-menu-detail-description, .status-menu-detail-value"
        ));
        const tops = cells.map((cell) => cell.getBoundingClientRect().top);
        return tops.length > 1 && Math.max(...tops) - Math.min(...tops) > 2;
      })
      .map((row) => row.textContent?.trim() ?? row.className);
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

/** 표시 없이 잘린 텍스트만 결함으로 본다.
    스크롤 컨테이너와 말줄임(text-overflow: ellipsis)은 "더 있다"는 신호가 있으므로 제외한다 —
    말줄임된 아이템 효과의 전문은 푸터가 보여준다. 신호 없이 글자가 잘리는 것만 잡는다. */
async function clippedMenuText(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>("[data-testid='main-menu']");
    if (!menu) return ["missing main menu"];
    const scrollers = new Set(Array.from(menu.querySelectorAll(".status-menu-detail-list, .status-menu-scene-list")));
    return Array.from(menu.querySelectorAll<HTMLElement>("*"))
      .filter((node) => !scrollers.has(node))
      .filter((node) => node.childElementCount === 0 && node.offsetParent !== null && node.textContent?.trim())
      .filter((node) => getComputedStyle(node).textOverflow !== "ellipsis")
      .filter((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)
      .map((node) => `${node.className}: ${node.textContent?.trim() ?? ""}`);
  });
}
