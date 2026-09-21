// `_` 접두 진단 스펙은 기본 스위트에서 제외된다(playwright.config.ts testIgnore).
// 실행: DEV_SERVER_PORT=<port> npx playwright test test/e2e/_battle-menu-fixed.spec.ts
//
// 전투 씬을 battle-overhaul 하네스와 같은 방식으로 실제 DOM/CSS 그대로 마운트한다.
// .battle-scene 그리드가 HUD 높이(--battle-hud-height)를 소유하므로 커맨드 패널 레이아웃
// 계약은 시연 창 없이도 그대로 재현된다.
import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { seedReferenceBattleProject } from "./battleReferenceProject";
import { mountBattleHarness } from "./battleMenuHarness";

const OUT = "evidence/battle-menu-fixed";
const label = process.env.BATTLE_MENU_LABEL ?? "shot";

interface PanelMeasurement {
  readonly step: string;
  readonly panelHeight: number;
  readonly panelWidth: number;
  readonly menuScrollHeight: number;
  readonly menuClientHeight: number;
  readonly menuOverflowY: string;
  readonly panelGridRows: string;
  readonly panelChildren: readonly string[];
  readonly menuGridRows: string;
  readonly menuAutoRows: string;
  readonly rows: number;
  readonly rowHeights: readonly number[];
  readonly rowsHitTestable: readonly boolean[];
  readonly menuOverflowsPanel: boolean;
  readonly clippedLabels: readonly string[];
  readonly keyPromptClipped: boolean;
  readonly rootMenu: boolean;
  readonly details: readonly string[];
  readonly cursorVisible: boolean | null;
  readonly cursorMarker: string | null;
  readonly hitDiagnostics: readonly Record<string, unknown>[];
}

async function measurePanel(page: Page, step: string): Promise<PanelMeasurement> {
  return page.evaluate((currentStep) => {
    const panel = document.querySelector<HTMLElement>(".battle-command-panel");
    if (!panel) throw new Error("battle-command-panel is missing");
    const menu = document.querySelector<HTMLElement>(".battle-command-menu");
    const panelBox = panel.getBoundingClientRect();
    const menuRows = [...document.querySelectorAll<HTMLElement>(".battle-command-menu button.battle-command")];
    const hitFor = (node: HTMLElement): Element | null => {
      const box = node.getBoundingClientRect();
      return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    };
    const cursor = document.querySelector<HTMLElement>("button.battle-command[data-battle-command-cursor='true']");
    const cursorVisible = cursor && menu
      ? (() => {
          const cursorBox = cursor.getBoundingClientRect();
          const menuBox = menu.getBoundingClientRect();
          return cursorBox.top >= menuBox.top - 1 && cursorBox.bottom <= menuBox.bottom + 1;
        })()
      : null;
    return {
      step: currentStep,
      panelHeight: Math.round(panelBox.height * 100) / 100,
      panelWidth: Math.round(panelBox.width * 100) / 100,
      menuScrollHeight: menu?.scrollHeight ?? 0,
      menuClientHeight: menu?.clientHeight ?? 0,
      menuOverflowY: menu ? getComputedStyle(menu).overflowY : "none",
      panelGridRows: getComputedStyle(panel).gridTemplateRows,
      panelChildren: [...panel.children].map((node) => {
        const css = getComputedStyle(node);
        return `${String(node.className).split(" ")[0]}@row${css.gridRowStart}:h${Math.round(node.getBoundingClientRect().height)}`;
      }),
      menuGridRows: menu ? getComputedStyle(menu).gridTemplateRows : "none",
      menuAutoRows: menu ? getComputedStyle(menu).gridAutoRows : "none",
      rows: menuRows.length,
      rowHeights: menuRows.map((node) => Math.round(node.getBoundingClientRect().height * 100) / 100),
      rowsHitTestable: menuRows.map((node) => {
        const hit = hitFor(node);
        return node === hit || node.contains(hit);
      }),
      // 접힌 행의 rect 는 스크롤 컨테이너 밖으로 나가도 overflow 로 잘린다. 문제가 되는 것은
      // 메뉴 박스 자체가 패널을 넘는 경우뿐이다.
      menuOverflowsPanel: menu
        ? menu.getBoundingClientRect().bottom > panelBox.bottom + 1 || menu.getBoundingClientRect().top < panelBox.top - 1
        : false,
      clippedLabels: menuRows
        .map((node) => {
          const strong = node.querySelector<HTMLElement>(".battle-command-text strong");
          if (!strong) return null;
          const menuBox = menu?.getBoundingClientRect();
          const strongBox = strong.getBoundingClientRect();
          // 세로로 넘친 줄, 또는 생략부호 없이 통째로 잘린 가로 넘침만 계약 위반이다.
          // ellipsis 는 고정 행에서 허용되는 축약이다.
          const css = getComputedStyle(strong);
          const verticalCut = strong.scrollHeight > strong.clientHeight + 1;
          const horizontalOverflow = strong.scrollWidth > strong.clientWidth + 1;
          const hardCut = horizontalOverflow && css.textOverflow !== "ellipsis";
          const spilled = menuBox ? strongBox.right > menuBox.right + 1 || strongBox.left < menuBox.left - 1 : false;
          if (!verticalCut && !hardCut && !spilled) return null;
          const how = verticalCut ? "vertical-cut" : hardCut ? "hard-cut" : "spilled";
          return `${node.dataset.testid}:${how}:${(strong.textContent ?? "").trim()}:${strong.clientWidth}x${strong.clientHeight}/${strong.scrollWidth}x${strong.scrollHeight}`;
        })
        .filter((entry): entry is string => entry !== null),
      keyPromptClipped: (() => {
        const prompt = document.querySelector<HTMLElement>(".battle-key-prompts");
        if (!prompt || getComputedStyle(prompt).display === "none") return false;
        return prompt.scrollWidth > prompt.clientWidth + 1;
      })(),
      rootMenu: Boolean(menu && !menu.querySelector(":scope > .battle-submenu-header")),
      details: [...document.querySelectorAll<HTMLElement>(".battle-command-text small")]
        .filter((node) => node.offsetParent !== null && getComputedStyle(node).display !== "none")
        .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim()),
      cursorVisible,
      // 대상 선택 창은 키보드 커서 속성 대신 .battle-target-selected 로 현재 행을 표시한다.
      cursorMarker: (() => {
        const marked = cursor ?? menu?.querySelector<HTMLElement>(".battle-target-selected") ?? null;
        return marked ? getComputedStyle(marked, "::before").content : null;
      })(),
      hitDiagnostics: menuRows.map((node) => {
        const box = node.getBoundingClientRect();
        const hit = hitFor(node);
        const menuBox = menu?.getBoundingClientRect();
        return {
          testid: node.dataset.testid,
          row: [Math.round(box.top), Math.round(box.bottom), Math.round(box.height)],
          hit: hit ? `${hit.tagName.toLowerCase()}.${String(hit.className)}`.slice(0, 90) : null,
          menu: menuBox ? [Math.round(menuBox.top), Math.round(menuBox.bottom)] : null,
          menuScrollTop: menu?.scrollTop ?? null,
          panel: [Math.round(panelBox.top), Math.round(panelBox.bottom)],
        };
      }),
    };
  }, step);
}

async function openMenu(page: Page, testId: string): Promise<void> {
  // 히트테스트 계약은 rowsHitTestable 로 따로 검증한다. 이동 자체는 요소에 직접
  // click 이벤트를 보내서, 레이아웃 결함이 있어도 측정을 계속할 수 있게 한다.
  await page.getByTestId(testId).dispatchEvent("click");
}

test.describe("turn-based battle command panel is fixed-size and scrollable", () => {
  test.describe.configure({ timeout: 300_000 });
  test.use({ actionTimeout: 10_000 });

  test.beforeEach(async ({ page }) => {
    await mkdir(OUT, { recursive: true });
    await page.setViewportSize({ width: 1360, height: 768 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    // seedProjectForEditor 은 edit-canvas 를 15초 안에 요구한다. 차가운 dev 서버는
    // 모듈 변환에 그보다 오래 걸려 시드가 타이밍 운에 걸린다. 먼저 한 번 띄워 변환을 데운다.
    // 부하가 높은 머신에서는 첫 부팅이 통째로 실패하기도 해서(실측: 3회 중 2회) 재시도로 감싼다.
    let booted = false;
    for (let attempt = 0; attempt < 3 && !booted; attempt += 1) {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      booted = await page
        .getByTestId("edit-canvas")
        .waitFor({ state: "visible", timeout: 60_000 })
        .then(() => true, () => false);
    }
    expect(booted, "editor shell must boot before the battle harness mounts").toBe(true);
    await seedReferenceBattleProject(page);
  });

  test("panel height and row height stay identical across root, submenu, and target select", async ({ page }) => {
    await mountBattleHarness(page, 3);
    const measurements: PanelMeasurement[] = [];

    measurements.push(await measurePanel(page, "root"));
    await page.screenshot({ path: `${OUT}/${label}-01-root.png` });

    await openMenu(page, "actor-command-skill");
    await expect(page.locator(".battle-command-menu > .battle-submenu-header")).toBeVisible();
    measurements.push(await measurePanel(page, "skill-submenu"));
    await page.screenshot({ path: `${OUT}/${label}-02-skill.png` });

    await openMenu(page, "actor-command-back");
    await expect(page.getByTestId("actor-command-attack")).toBeVisible();
    measurements.push(await measurePanel(page, "root-again"));

    const itemButton = page.getByTestId("actor-command-item");
    if ((await itemButton.count()) > 0 && !(await itemButton.isDisabled())) {
      await openMenu(page, "actor-command-item");
      await expect(page.locator(".battle-command-menu > .battle-submenu-header")).toBeVisible();
      measurements.push(await measurePanel(page, "item-submenu"));
      await page.screenshot({ path: `${OUT}/${label}-03-item.png` });
      await openMenu(page, "actor-command-back");
      await expect(page.getByTestId("actor-command-attack")).toBeVisible();
    }

    await openMenu(page, "actor-command-attack");
    await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "targetSelect");
    measurements.push(await measurePanel(page, "target-select"));
    await page.screenshot({ path: `${OUT}/${label}-04-target.png` });

    await writeFile(`${OUT}/${label}-fixed-height.json`, `${JSON.stringify(measurements, null, 2)}\n`, "utf8");

    const heights = measurements.map((entry) => entry.panelHeight);
    expect(
      Math.max(...heights) - Math.min(...heights),
      `panel height must not change between menus: ${JSON.stringify(measurements.map((entry) => [entry.step, entry.panelHeight]))}`,
    ).toBeLessThanOrEqual(1);

    const rowHeights = measurements.flatMap((entry) => entry.rowHeights);
    expect(
      Math.max(...rowHeights) - Math.min(...rowHeights),
      `menu row height must be fixed: ${JSON.stringify(measurements.map((entry) => [entry.step, entry.rowHeights]))}`,
    ).toBeLessThanOrEqual(1);

    expect(
      measurements.filter((entry) => entry.menuOverflowsPanel).map((entry) => entry.step),
      "the menu box must stay inside the panel",
    ).toEqual([]);
    expect(
      measurements.filter((entry) => entry.menuClientHeight < Math.max(...entry.rowHeights)).map((entry) => entry.step),
      "the menu must keep a real box: at least one row tall, never collapsed to 0",
    ).toEqual([]);

    expect(
      measurements.filter((entry) => entry.clippedLabels.length > 0).map((entry) => [entry.step, entry.clippedLabels]),
      "no command row label may be cut off",
    ).toEqual([]);
    expect(
      measurements.filter((entry) => entry.keyPromptClipped).map((entry) => entry.step),
      "the key prompt line must fit the panel width",
    ).toEqual([]);

    expect(
      measurements.filter((entry) => entry.rootMenu).flatMap((entry) => entry.details),
      "root command rows must not show explanatory copy",
    ).toEqual([]);
    const submenuDetails = measurements.filter((entry) => !entry.rootMenu).flatMap((entry) => entry.details);
    expect(
      measurements.filter((entry) => entry.step === "target-select").flatMap((entry) => entry.details),
      "target rows stay a single line: HP detail belongs to the stage popup",
    ).toEqual([]);
    expect(
      measurements.filter((entry) => !entry.cursorMarker || entry.cursorMarker === "none" || entry.cursorMarker === '""')
        .map((entry) => [entry.step, entry.cursorMarker]),
      "every menu marks its cursor row with the same visible marker",
    ).toEqual([]);
    expect(
      submenuDetails.filter((detail) => detail.includes("·")),
      "submenu rows must not stack multiple facts into one detail line",
    ).toEqual([]);
    expect(
      submenuDetails.filter((detail) => [...detail].length > 14),
      "submenu row detail must stay a single short token",
    ).toEqual([]);
  });

  test("overflowing skill list scrolls inside the fixed panel", async ({ page }) => {
    await mountBattleHarness(page, 15);

    const root = await measurePanel(page, "root");
    await openMenu(page, "actor-command-skill");
    await expect(page.locator(".battle-command-menu > .battle-submenu-header")).toBeVisible();
    const overflow = await measurePanel(page, "skill-submenu-15");
    await page.screenshot({ path: `${OUT}/${label}-05-overflow.png` });

    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press("ArrowDown");
    }
    const scrolled = await measurePanel(page, "skill-submenu-15-cursor-12");
    await page.screenshot({ path: `${OUT}/${label}-06-overflow-cursor.png` });
    const scrollTop = await page.evaluate(
      () => document.querySelector<HTMLElement>(".battle-command-menu")?.scrollTop ?? -1,
    );

    await writeFile(
      `${OUT}/${label}-overflow.json`,
      `${JSON.stringify({ root, overflow, scrolled, scrollTop }, null, 2)}\n`,
      "utf8",
    );

    expect(
      Math.abs(overflow.panelHeight - root.panelHeight),
      `15 skills must not grow the panel: root ${root.panelHeight} vs submenu ${overflow.panelHeight}`,
    ).toBeLessThanOrEqual(1);
    expect(overflow.rows, "all 15 skills stay in the DOM").toBeGreaterThanOrEqual(15);
    expect(
      Math.max(...overflow.rowHeights) - Math.min(...overflow.rowHeights),
      `rows keep a fixed height when the list overflows: ${JSON.stringify(overflow.rowHeights)}`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(Math.max(...overflow.rowHeights) - Math.max(...root.rowHeights)),
      `a 15-item list must not shrink rows: root ${Math.max(...root.rowHeights)} vs submenu ${Math.max(...overflow.rowHeights)}`,
    ).toBeLessThanOrEqual(1);
    expect(["auto", "scroll"], `menu overflow-y was ${overflow.menuOverflowY}`).toContain(overflow.menuOverflowY);
    expect(
      overflow.menuScrollHeight,
      `menu must overflow: scroll ${overflow.menuScrollHeight} vs client ${overflow.menuClientHeight}`,
    ).toBeGreaterThan(overflow.menuClientHeight + 2);
    expect(overflow.menuOverflowsPanel, "an overflowing menu box must stay inside the panel").toBe(false);
    expect(
      overflow.menuClientHeight,
      "the overflowing menu must keep a real box instead of collapsing",
    ).toBeGreaterThanOrEqual(Math.max(...overflow.rowHeights));
    expect(scrolled.cursorVisible, "the keyboard cursor must scroll into the visible menu box").toBe(true);
    expect(scrollTop, "the menu itself scrolled, not the page").toBeGreaterThan(0);
  });

  test("panel keeps its height until the result window replaces it", async ({ page }) => {
    await mountBattleHarness(page, { skillCount: 3, enemyMaxHp: 1 });
    const root = await measurePanel(page, "root");

    await openMenu(page, "actor-command-attack");
    await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "targetSelect");
    const target = await measurePanel(page, "target-select");
    await page.locator(".battle-target-menu button.battle-command").first().dispatchEvent("click");

    const resolve = await measurePanel(page, "round-resolve");
    await page.screenshot({ path: `${OUT}/${label}-07-resolve.png` });
    await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "resolved", { timeout: 30_000 });
    await expect(page.getByTestId("battle-result-panel")).toBeVisible();
    // resolved 단계에서는 HUD 자체가 사라지고 승리 창이 들어오므로 커맨드 매니가 남지 않는지를 본다.
    const resolvedMenus = await page.locator(".battle-command-menu").count();

    await writeFile(
      `${OUT}/${label}-result.json`,
      `${JSON.stringify({ root, target, resolve, resolvedMenus }, null, 2)}\n`,
      "utf8",
    );
    await page.screenshot({ path: `${OUT}/${label}-08-resolved.png` });

    for (const step of [target, resolve]) {
      expect(
        Math.abs(step.panelHeight - root.panelHeight),
        `panel height must survive ${step.step}: root ${root.panelHeight} vs ${step.panelHeight}`,
      ).toBeLessThanOrEqual(1);
      expect(step.clippedLabels, `${step.step} must not hard-cut labels`).toEqual([]);
    }
    expect(resolvedMenus, "the command menu hands the screen over to the result window").toBe(0);
  });

  test("pokemon skin keeps a fixed command panel too", async ({ page }) => {
    await mountBattleHarness(page, { skillCount: 15, battleUiStyle: "pokemon" });

    const root = await measurePanel(page, "pokemon-root");
    await page.screenshot({ path: `${OUT}/${label}-09-pokemon-root.png` });
    await openMenu(page, "actor-command-skill");
    const submenu = await measurePanel(page, "pokemon-skill-submenu-15");
    await page.screenshot({ path: `${OUT}/${label}-10-pokemon-skill.png` });

    await writeFile(`${OUT}/${label}-pokemon.json`, `${JSON.stringify({ root, submenu }, null, 2)}\n`, "utf8");

    expect(
      Math.abs(submenu.panelHeight - root.panelHeight),
      `pokemon panel must not grow: root ${root.panelHeight} vs submenu ${submenu.panelHeight}`,
    ).toBeLessThanOrEqual(1);
    expect(submenu.menuOverflowsPanel, "pokemon menu box must stay inside its panel").toBe(false);
    expect(submenu.clippedLabels, "pokemon rows must not hard-cut labels").toEqual([]);
  });
});
