import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  C001_SCREENSHOT,
  C003_SCREENSHOT,
  COMMAND_LABELS,
  COMMAND_SCREENSHOTS,
  chooseDetailRow,
  doesMenuFillPlayStage,
  focusRailEntry,
  isMenuInsidePlayStage,
  openTestPlayWindow,
  saveSnapshot,
  screenshotMenu,
  seedDefaultProject,
  selectCommand,
  startActualPlay,
} from "./oprnPlayerStatusMenuHelpers";

test("Korean command panels work from the X-key actual play menu", async ({ page }) => {
  // 명령 패널 전 항목 + 스크린샷 캡처를 순회하는 롱 스펙 — swiftshader에서 30초 기본 한도를 넘는다.
  test.setTimeout(90_000);
  await startActualPlay(page);

  await page.keyboard.press("X");
  const menu = page.getByTestId("main-menu");
  await expect(menu).toBeVisible();
  await expect(menu).toHaveClass(/oprn-status-menu/);
  await expect(page.getByTestId("status-menu-gold")).toHaveText("돈 0G");
  await expect(page.getByTestId("status-menu-time")).toBeVisible();
  await expect(page.getByTestId("status-menu-slots")).toHaveCount(0);
  for (const [commandId, label] of COMMAND_LABELS) {
    // 그룹 입구는 `파티 ▸` 처럼 화살표가 붙을 수 있어 부분 일치로 본다.
    await expect(page.getByTestId(`status-menu-command-${commandId}`)).toContainText(label);
  }
  expect(await statusMenuCommandsFullyVisible(page)).toBe(true);
  // 저장·타이틀은 레일이 아니라 시스템 트레이 안에 있다.
  await expect(page.getByTestId("status-menu-command-save")).toHaveCount(0);
  await focusRailEntry(page, "system-menu");
  // 트레이는 레일에서 고르면 미리보기(inert)로 펼쳐진다 — 확인키로 들어가야 보인다.
  await page.keyboard.press("z");
  await expect(page.getByTestId("status-menu-group-command-save")).toBeVisible();
  await expect(page.getByTestId("status-menu-group-command-to-title")).toBeVisible();
  await focusRailEntry(page, "items");
  await expectClassicStatusMenuGone(page);
  for (let index = 0; index < 4; index += 1) {
    const row = page.getByTestId(`status-menu-party-row-${index}`);
    await expect(row).toBeVisible();
    const face = page.getByTestId(`status-menu-face-${index}`);
    await expect(face).toBeVisible();
    await expect(face).not.toHaveClass(/missing/);
    await expect(face).not.toHaveText("Face");
    // 좁은 파티 셀에서는 접두사를 뺀 숫자만 보인다(playerStatusMenuModel.ts: 52px 셀에
    // `HP 514/514` 가 안 들어간다). HP/MP 구분은 접근성 라벨과 게이지 색이 담당한다.
    await expect(row).toContainText(/\d+\/\d+/);
    await expect(row).toHaveAttribute("aria-label", /HP \d+\/\d+/);
    await expect(row).toHaveAttribute("aria-label", /MP \d+\/\d+/);
  }
  expect(await partyRowsKeepFacesClearOfText(page)).toBe(true);
  expect(await statusMenuUsesWindowFillInsteadOfSystemSheet(page)).toBe(true);
  expect(await statusMenuCommandRailUsesBottomDock(page)).toEqual([]);
  expect(await isMenuInsidePlayStage(page)).toBe(true);
  expect(await doesMenuFillPlayStage(page)).toBe(true);

  await selectCommand(page, "items", "아이템");
  await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();
  // 창 크롬은 패널에 들어간 뒤에만 입혀진다 — main 모드의 상세는 inert 미리보기라 채움이 없다.
  expect(await statusMenuUsesRuntimeWindowChrome(page)).toEqual([]);
  await expect(page.getByTestId("status-menu-detail")).toContainText("회복약");
  await expect(page.getByTestId("status-menu-detail")).toContainText("2개");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.items);

  await selectCommand(page, "skills", "스킬");
  await expect(page.getByTestId("status-menu-detail")).toContainText("주인공");
  await chooseDetailRow(page, "status-menu-skill-actor-actor_hero");
  await expect(page.getByTestId("status-menu-detail-title")).toContainText("스킬: 주인공");
  await expect(page.getByTestId("status-menu-detail")).toContainText("공격");
  expect(await detailRowsStayInsidePanel(page)).toBe(true);
  await screenshotMenu(page, COMMAND_SCREENSHOTS.skills);

  await selectCommand(page, "equipment", "장비");
  await chooseDetailRow(page, "status-menu-equipment-actor-actor_hero");
  await expect(page.getByTestId("status-menu-detail")).toContainText("무기");
  await expect(page.getByTestId("status-menu-detail")).toContainText("청동 검");
  await chooseDetailRow(page, "status-menu-equipment-slot-weapon");
  // 능력치 증감은 상세 목록이 아니라 사이드바의 "변화" 패널에 뜬다(playerStatusMenu.ts:114 —
  // 후보를 고르는 동안 파티 패널 자리를 이 패널이 대신한다). 목록 행은 1줄로 압축돼 이름·소지 수만 남는다.
  await expect(page.getByTestId("status-menu-stat-delta")).toContainText(/공격|방어|정신|민첩/);
  await screenshotMenu(page, COMMAND_SCREENSHOTS.equipment);

  await selectCommand(page, "status", "상태");
  await expect(page.getByTestId("status-menu-detail")).toContainText(/HP \d+\/\d+/);
  await expect(page.getByTestId("status-menu-detail")).toContainText(/MP \d+\/\d+/);
  await screenshotMenu(page, COMMAND_SCREENSHOTS.status);

  await selectCommand(page, "row", "열 바꾸기");
  await expect(page.getByTestId("status-menu-detail")).toContainText("전열");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.row);

  await selectCommand(page, "formation", "진형");
  await expect(page.getByTestId("status-menu-detail")).toContainText("1.");
  await chooseDetailRow(page, "status-menu-formation-actor-actor_guardian");
  // 행 설명("이동 중")은 압축된 목록 행이 아니라 푸터 힌트로 나간다(playerStatusMenu.ts 의
  // selectedEntryDescription / formationDetail.hint) — 메뉴 전체에서 이동 상태를 확인한다.
  await expect(page.getByTestId("main-menu")).toContainText(/이동 중|이동할 위치를 선택/);
  await expect(page.getByTestId("status-menu-formation-move-up")).toHaveCount(0);
  await expect(page.getByTestId("status-menu-formation-move-down")).toHaveCount(0);
  await screenshotMenu(page, COMMAND_SCREENSHOTS.formation);

  await selectCommand(page, "save", "저장");
  await expect(page.getByTestId("save-slot-1")).toContainText("1번 저장");
  await expect(page.getByTestId("save-slot-1")).toContainText("비어 있음");
  await expect(page.getByTestId("save-slot-1")).toHaveClass(/selected/);
  await expect(page.getByTestId("status-menu-classic-save-party-faces")).toHaveCount(0);
  await screenshotMenu(page, COMMAND_SCREENSHOTS.save);

  await selectCommand(page, "load", "로드");
  await expect(page.getByTestId("load-slot-1")).toContainText("비어 있음");

  await selectCommand(page, "quests", "임무");
  await expect(page.getByTestId("status-menu-detail")).toContainText("등록된 임무가 없습니다");

  await selectCommand(page, "wait", "전투 대기");
  await expect(page.getByTestId("status-menu-detail")).toContainText("명령 입력 중에도 시간이 흐릅니다");
  // 대기 토글 라벨은 레일이 아니라 시스템 트레이 안의 칸에 붙는다.
  await focusRailEntry(page, "system-menu");
  await page.keyboard.press("z");
  await expect(page.getByTestId("status-menu-group-command-wait")).toContainText("대기 OFF");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.wait);

  await expectClassicStatusMenuGone(page);
  await menu.screenshot({ path: C001_SCREENSHOT });
});

test("status menu layout keeps actor faces and detail rows readable at compact viewport", async ({ page }) => {
  // 키보드 이동(방향키 + 확인키)으로 화면을 오가므로 기본 30초로는 빡빡하다.
  test.setTimeout(90_000);
  await startActualPlay(page);
  await page.setViewportSize({ width: 800, height: 760 });

  await page.keyboard.press("X");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  expect(await statusMenuCommandsFullyVisible(page)).toBe(true);
  expect(await partyRowsKeepFacesClearOfText(page)).toBe(true);
  expect(await statusMenuUsesWindowFillInsteadOfSystemSheet(page)).toBe(true);
  expect(await statusMenuCommandRailUsesBottomDock(page)).toEqual([]);

  await selectCommand(page, "status", "상태");
  expect(await statusMenuUsesRuntimeWindowChrome(page)).toEqual([]);
  expect(await detailRowsStayInsidePanel(page)).toBe(true);
  expect(await importantStatusMenuTextFits(page)).toEqual([]);

  await mkdir("evidence/browser-screenshots", { recursive: true });
  await page.getByTestId("main-menu").screenshot({
    path: "evidence/browser-screenshots/rm2k3-status-menu-compact-layout.png",
  });
});

async function closeStatusMenu(page: Page): Promise<void> {
  for (let guard = 0; guard < 6; guard += 1) {
    if ((await page.getByTestId("main-menu").count()) === 0) return;
    await page.keyboard.press("X");
    await page.waitForTimeout(220);
  }
  if ((await page.getByTestId("main-menu").count()) > 0) {
    const state = await page.evaluate(() => ({
      title: document.querySelector("[data-testid='status-menu-detail-title']")?.textContent ?? null,
      hidden: document.querySelector("[data-testid='status-menu-detail']")?.getAttribute("aria-hidden") ?? null,
      message: document.querySelector("[data-testid='status-menu-message']")?.textContent ?? null,
    }));
    throw new Error(`취소키 6번으로도 메뉴가 닫히지 않았다: ${JSON.stringify(state)}`);
  }
}

async function partyRowsKeepFacesClearOfText(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='status-menu-party-row-']"));
    const tolerance = 1;
    return rows.every((row) => {
      const face = row.querySelector<HTMLElement>(".status-menu-face");
      const info = row.querySelector<HTMLElement>(".status-menu-party-info");
      if (!face || !info) return false;
      const faceRect = face.getBoundingClientRect();
      const infoRect = info.getBoundingClientRect();
      return faceRect.right <= infoRect.left + tolerance;
    });
  });
}

async function detailRowsStayInsidePanel(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("[data-testid='status-menu-detail']");
    if (!panel) return false;
    const panelRect = panel.getBoundingClientRect();
    const tolerance = 1;
    const rows = Array.from(panel.querySelectorAll<HTMLElement>(".status-menu-detail-row"));
    if (rows.length === 0) return false;
    return rows.every((row) => {
      const rowRect = row.getBoundingClientRect();
      return rowRect.left >= panelRect.left - tolerance && rowRect.right <= panelRect.right + tolerance;
    });
  });
}

async function statusMenuUsesWindowFillInsteadOfSystemSheet(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>("[data-testid='main-menu']");
    if (!menu) return false;
    const backgroundImage = window.getComputedStyle(menu).backgroundImage;
    return !backgroundImage.includes("url(");
  });
}

async function statusMenuUsesRuntimeWindowChrome(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const firstCommand = document.querySelector<HTMLElement>("[data-testid='status-menu-command-items']");
    const selectedCommand = document.querySelector<HTMLElement>(".status-menu-command.selected");
    const unselected = Array.from(document.querySelectorAll<HTMLElement>(".status-menu-command"))
      .find((node) => !node.classList.contains("selected"));
    const detail = document.querySelector<HTMLElement>("[data-testid='status-menu-detail']");
    if (!firstCommand || !selectedCommand || !unselected || !detail) return ["레일/상세 요소를 찾지 못했다"];
    const firstStyle = window.getComputedStyle(firstCommand);
    const selectedStyle = window.getComputedStyle(selectedCommand);
    const unselectedStyle = window.getComputedStyle(unselected);
    const detailStyle = window.getComputedStyle(detail);
    const violations: string[] = [];
    // 편집기 버튼 크롬(흰 배경/검은 글자)이 런타임 표면에 새면 안 된다.
    if (firstStyle.backgroundColor === "rgb(248, 245, 236)" || firstStyle.color === "rgb(35, 35, 35)") {
      violations.push(`편집기 버튼 크롬이 보인다 bg=${firstStyle.backgroundColor} color=${firstStyle.color}`);
    }
    /* 상세는 런타임 창 표면을 입는다. 도크에서는 배경이 아니라 `border-image`(24 fill) 로
     * 스킨을 깔고 background 는 transparent 로 둔다(statusMenuEdgeDock.css) — 그래서
     * background 만 보던 예전 검사는 항상 실패했다. 셋 중 하나면 통과로 본다. */
    const hasFill = detailStyle.borderImageSource !== "none"
      || detailStyle.backgroundImage !== "none"
      || !/rgba\(0, 0, 0, 0\)|transparent/.test(detailStyle.backgroundColor);
    if (!hasFill) {
      violations.push(`상세에 창 채움이 없다 border-image=${detailStyle.borderImageSource} image=${detailStyle.backgroundImage} bg=${detailStyle.backgroundColor}`);
    }
    /* 재설계 도크는 선택 칸을 그라디언트가 아니라 테두리·배경 대비로 표시한다(P0-3 포커스 모델).
     * 예전 검사는 `linear-gradient` 또는 특정 파란색만 인정해서, 어떤 표시를 쓰든 실패했다. */
    const differs = selectedStyle.backgroundColor !== unselectedStyle.backgroundColor
      || selectedStyle.backgroundImage !== unselectedStyle.backgroundImage
      || selectedStyle.borderColor !== unselectedStyle.borderColor
      || selectedStyle.outlineColor !== unselectedStyle.outlineColor
      || selectedStyle.boxShadow !== unselectedStyle.boxShadow;
    if (!differs) violations.push("선택된 명령이 비선택과 시각적으로 구분되지 않는다");
    return violations;
  });
}

async function statusMenuCommandRailUsesBottomDock(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>("[data-testid='status-menu-command-rail']");
    const stage = document.querySelector<HTMLElement>("[data-testid='play-stage']");
    if (!rail || !stage) return ["레일 또는 스테이지를 찾지 못했다"];
    const rail_ = rail.getBoundingClientRect();
    const stage_ = stage.getBoundingClientRect();
    const round = (value: number): number => Math.round(value * 10) / 10;
    const violations: string[] = [];
    // 재설계로 명령은 좌측 열이 아니라 화면 아래 가로 도크에 앉는다.
    if (rail_.width <= rail_.height) violations.push(`가로 도크가 아니다 ${round(rail_.width)}x${round(rail_.height)}`);
    if (rail_.top <= stage_.top + stage_.height / 2) {
      violations.push(`아래 절반이 아니다 top=${round(rail_.top)} 기준=${round(stage_.top + stage_.height / 2)}`);
    }
    if (rail_.left < stage_.left - 1 || rail_.right > stage_.right + 1) {
      violations.push(`좌우가 스테이지를 벗어났다 ${round(rail_.left)}~${round(rail_.right)} vs ${round(stage_.left)}~${round(stage_.right)}`);
    }
    return violations;
  });
}

async function statusMenuCommandsFullyVisible(page: Page): Promise<boolean> {
  return page.evaluate((expectedCount) => {
    const rail = document.querySelector<HTMLElement>("[data-testid='status-menu-command-rail']");
    if (!rail) return false;
    const railRect = rail.getBoundingClientRect();
    // 레일 안에는 그룹 구분자(`status-menu-command-group-action`)와 칸마다 아이콘
    // (`status-menu-command-icon-items`)도 같은 접두사로 들어 있다 — 실측 13개.
    // 명령 칸만 세려면 role=menuitem 으로 좁힌다.
    const buttons = Array.from(rail.querySelectorAll<HTMLElement>("[data-testid^='status-menu-command-'][role='menuitem']"));
    if (buttons.length !== expectedCount) return false;
    const tolerance = 1;
    return buttons.every((button) => {
      const rect = button.getBoundingClientRect();
      return button.offsetParent !== null
        && rect.height > 0
        && rect.top >= railRect.top - tolerance
        && rect.bottom <= railRect.bottom + tolerance;
    });
  }, COMMAND_LABELS.length);
}

async function importantStatusMenuTextFits(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>("[data-testid='main-menu']");
    if (!menu) return ["missing main menu"];
    return Array.from(menu.querySelectorAll<HTMLElement>([
      ".status-menu-command",
      ".status-menu-actor-name",
      ".status-menu-actor-subline",
      ".status-menu-actor-vitals",
      ".status-menu-detail-label",
      ".status-menu-detail-value",
      ".status-menu-detail-description",
    ].join(",")))
      .filter((node) => node.offsetParent !== null && node.textContent?.trim())
      .filter((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)
      .map((node) => node.textContent?.trim() ?? node.className);
  });
}

async function expectClassicStatusMenuGone(page: Page): Promise<void> {
  await expect(page.locator("[data-testid^='status-menu-classic-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='status-menu-fullscreen-']")).toHaveCount(0);
}

test("does not open status menu on title screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedDefaultProject(page);
  await openTestPlayWindow(page);
  // 테스트 플레이 창은 자동 시작이 기본이라 타이틀을 건너뛴다(testPlayModal.ts 의
  // test-play-auto-start). localStorage 선호를 미리 심는 방법은 못 쓴다 —
  // 프로젝트 시딩이 저장소를 비운다(projectSeed.ts). 창의 "타이틀부터" 로 되돌린다.
  await page.getByTestId("test-play-title").click();
  await expect(page.getByTestId("title-screen")).toBeVisible({ timeout: 30_000 });

  await page.keyboard.press("X");

  await expect(page.getByTestId("main-menu")).toHaveCount(0);
  await expect(page.getByTestId("title-screen")).toBeVisible();
});

test("saves and closes from the status menu", async ({ page }) => {
  await startActualPlay(page);

  await page.keyboard.press("X");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  // 저장은 시스템 트레이 안이다 — selectCommand 가 트레이를 열고 패널까지 들어간다.
  await selectCommand(page, "save", "저장");
  await chooseDetailRow(page, "save-slot-1");
  await expect(page.getByTestId("status-menu-message")).toContainText("1번 저장 칸에 저장했습니다");
  const snapshot = await saveSnapshot(page, 1);
  expect(snapshot.session.actorRows.actor_hero).toBe("front");
  expect(snapshot.session.partyActorIds).toEqual(["actor_hero", "actor_guardian", "actor_mage", "actor_scout"]);
  expect(snapshot.session.actorEquipment.actor_hero?.weapon).toBe("equip_sword");
  await page.getByTestId("main-menu").screenshot({ path: C003_SCREENSHOT });

  // 저장 흐름이 상세 패널 안에서 끝나므로 X 한 번은 패널 이탈에 쓰인다 — 레일까지 나온 뒤
  // 닫아야 메뉴가 실제로 사라진다.
  await closeStatusMenu(page);
  await page.keyboard.press("X");
  await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();
  await closeStatusMenu(page);
  await expect(page.getByTestId("play-stage")).toBeVisible();

  await page.keyboard.press("X");
  // 타이틀 복귀는 파괴적이라 확인 행을 한 번 더 골라야 한다(playerStatusMenuDetails.ts).
  await selectCommand(page, "to-title", "타이틀로 돌아가기");
  await chooseDetailRow(page, "status-menu-confirm-to-title");
  await expect(page.getByTestId("title-screen")).toBeVisible();
  // 장면 전환이 끝나기 전에 X 를 누르면 아직 살아 있는 맵 장면이 메뉴를 다시 연다.
  await expect(page.getByTestId("main-menu")).toHaveCount(0);
  await page.keyboard.press("X");
  await expect(page.getByTestId("main-menu")).toHaveCount(0);
});
