import { expect, test, type Locator } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { emptyEventProject, mockupProject } from "./mockupProbeSeeds";
import { openEventEditor } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

// 목업대로 바꾼 이벤트 에디터 화면을 조각별로 캡처한다.
// 실행: npx playwright test eventEditorMockupShots.spec.ts
const DIR = "output/evidence/event-editor-simplified-hierarchy";

async function selectFirstStoryboardCommand(modal: Locator): Promise<void> {
  await selectView(modal, "Storyboard");
  const card = modal.locator("[data-testid^='event-storyboard-card-']").first();
  await expect(card).toBeVisible();
  await card.click();
}

async function selectView(modal: Locator, label: "Storyboard" | "List"): Promise<void> {
  const mode = label === "List" ? "list" : "storyboard";
  await modal.getByTestId(`event-view-toggle-${mode}`).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test.setTimeout(120_000);

test("event editor matches the approved mockup", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1500, height: 1000 });

  const { project, eventId } = mockupProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);

  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();
  await page.waitForTimeout(600);

  // 1) 전체 — 목업의 셸 대조용
  await modal.screenshot({ path: `${DIR}/01-shell.png` });

  // 2) 명령 리스트 = 블록 캔버스
  await selectView(modal, "List");
  const list = modal.locator(".cmd-list").first();
  await expect(list).toBeVisible();
  await list.screenshot({ path: `${DIR}/02-block-canvas.png` });

  // 거터가 카테고리별로 실제 다른 색을 물었는지 (폴백 회색만 나오면 매핑 실패)
  const gutters = await list.evaluate((root) => {
    const out: Record<string, string> = {};
    for (const item of root.querySelectorAll<HTMLElement>(".cmd-item[data-command-category]")) {
      const category = item.dataset.commandCategory ?? "?";
      const prefix = item.querySelector<HTMLElement>(":scope > .cmd-head > .cmd-prefix");
      if (!prefix || out[category]) continue;
      out[category] = getComputedStyle(prefix).backgroundColor;
    }
    return out;
  });
  // eslint-disable-next-line no-console
  console.log("[gutters]", JSON.stringify(gutters));
  expect(new Set(Object.values(gutters)).size).toBeGreaterThan(2);
  await selectView(modal, "Storyboard");

  // 3) 좌측 설정 컬럼 (레일)
  const settings = modal.locator(".event-editor-settings-column").first();
  if (await settings.count()) {
    await settings.screenshot({ path: `${DIR}/03-rail.png` });
  }

  // 4) 페이지 탭 — 이름 + 조건 요약이 보여야 한다
  const tabStrip = modal.locator("[data-testid='event-classic-page-tabs']").first();
  await expect(tabStrip).toBeVisible();
  await expect(tabStrip.locator("[data-testid='event-page-tab-cond-1']")).toHaveText("조건 없음");
  await tabStrip.screenshot({ path: `${DIR}/04-page-tabs.png` });

  // 5) 인라인 인스펙터 — 명령을 클릭하면 모달 없이 우측에서 편집된다
  const inspector = modal.getByTestId("event-editor-inspector");
  await expect(inspector).toBeHidden();
  const initialCanvasWidth = (await modal.locator(".event-editor-commands-column").boundingBox())?.width ?? 0;
  await modal.screenshot({ path: `${DIR}/1500x1000-initial.png` });

  await selectFirstStoryboardCommand(modal);
  await expect(inspector).toBeVisible();
  await expect(inspector.getByTestId("event-inspector-body")).toBeVisible();
  const selectedCanvasWidth = (await modal.locator(".event-editor-commands-column").boundingBox())?.width ?? 0;
  expect(initialCanvasWidth).toBeGreaterThan(selectedCanvasWidth);
  // 모달이 새로 열리지 않아야 한다 — 이게 "모달 3겹 제거"의 핵심.
  await expect(page.locator("[data-testid='event-command-edit-dialog']")).toHaveCount(0);
  // eslint-disable-next-line no-console
  console.log("[inspector]", (await inspector.locator(".event-inspector-kind").innerText()).trim());
  await inspector.screenshot({ path: `${DIR}/05-inspector.png` });
  await modal.screenshot({ path: `${DIR}/1500x1000-selected.png` });

  // 6) 커맨드 팔레트 — 검색 우선 + 키보드 후보
  await modal.getByTestId("event-command-toolbar-add").first().click();
  const picker = page.getByTestId("event-command-picker-search");
  await expect(picker).toBeVisible();
  await picker.fill("소지금");
  await page.waitForTimeout(250);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);

  const active = page.locator(".event-command-picker-command.keyboard-active");
  await expect(active).toHaveCount(1);
  // eslint-disable-next-line no-console
  console.log("[palette] keyboard candidate:", (await active.first().innerText()).replace(/\s+/g, " ").trim());

  const dialog = page.getByTestId("event-command-picker").first();
  await dialog.screenshot({ path: `${DIR}/06-palette.png` });
});

// 사용자가 실제로 만나는 상태: 명령이 하나도 없는 새 이벤트 + 넓은 창.
// 앞선 캡처는 명령 11개 · 페이지 3개 · 1500px 였어서 잘림/여백 문제를 놓쳤다.
test("empty event on a wide viewport stays clean", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1950, height: 1200 });

  const { project, eventId } = emptyEventProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);

  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();
  await page.waitForTimeout(600);

  const probe = await modal.evaluate((root) => {
    const measure = (selector: string) => {
      const node = root.querySelector<HTMLElement>(selector);
      if (!node) return null;
      return {
        clientH: node.clientHeight,
        scrollH: node.scrollHeight,
        clientW: node.clientWidth,
        scrollW: node.scrollWidth,
        clipped: node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1,
      };
    };
    const confirm = root.querySelector<HTMLElement>("[data-testid='event-editor-confirm']");
    return {
      tab: measure(".event-page-tab-rich"),
      tabStrip: measure(".event-page-number-tabs"),
      graphic: measure(".event-page-graphic-section, .event-graphic-field"),
      confirmBg: confirm ? getComputedStyle(confirm).backgroundColor : null,
    };
  });
  // eslint-disable-next-line no-console
  console.log("[empty]", JSON.stringify(probe));

  await modal.screenshot({ path: `${DIR}/07-empty-wide.png` });

  // 근접 캡처 — 채점표 A(카드 밀도)와 E(선택 없는 인스펙터)는 전체 셸 샷으로는 못 본다.
  await modal.locator(".event-editor-card").screenshot({ path: `${DIR}/08-card.png` });
  await expect(modal.getByTestId("event-editor-inspector")).toBeHidden();

  // 탭 내용이 잘리면 안 된다 (이름 + 조건 요약 두 줄이 다 보여야 한다).
  expect(probe.tab?.clipped, "page tab clips its content").toBeFalsy();
  // 카드 안 이름/캐릭터 ID 는 312px 레일에서 겹치지 않고 각자 한 줄을 쓴다.
  const card = await modal.locator(".event-editor-card").evaluate((root) => {
    const name = root.querySelector<HTMLElement>('[data-testid="event-page-name-input"]');
    const charLabel = root.querySelector<HTMLElement>(".event-character-id-label > span");
    if (!name || !charLabel) return null;
    const a = name.getBoundingClientRect();
    const b = charLabel.getBoundingClientRect();
    return { overlap: a.bottom > b.top + 1 && a.top < b.bottom - 1 && a.right > b.left && a.left < b.right };
  });
  expect(card?.overlap, "name input overlaps the character-id label").toBe(false);
});


test("diagnose page tab strip geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1950, height: 1200 });
  const { project, eventId } = emptyEventProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);
  const modal = page.getByTestId("event-editor-modal");
  await page.waitForTimeout(500);
  const info = await modal.evaluate((root) => {
    const section = root.querySelector<HTMLElement>(".event-editor");
    const kids = section ? [...section.children].map((c) => ({
      cls: (c as HTMLElement).className.slice(0, 46),
      mt: getComputedStyle(c as HTMLElement).marginTop,
      mb: getComputedStyle(c as HTMLElement).marginBottom,
      order: getComputedStyle(c as HTMLElement).order,
      gridRow: getComputedStyle(c as HTMLElement).gridRowStart,
      pos: getComputedStyle(c as HTMLElement).position,
      h: Math.round((c as HTMLElement).getBoundingClientRect().height),
      y: Math.round((c as HTMLElement).getBoundingClientRect().top),
    })) : [];
    const ts = root.querySelector<HTMLElement>(".event-editor-top-strip");
    const tsKids = ts ? [...ts.children].map((c) => {
      const e = c as HTMLElement; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return { cls: e.className.slice(0,44), h: Math.round(r.height), w: Math.round(r.width), minH: cs.minHeight, disp: cs.display };
    }) : [];
    const tsCss = ts ? { display: getComputedStyle(ts).display, minHeight: getComputedStyle(ts).minHeight, alignItems: getComputedStyle(ts).alignItems, gap: getComputedStyle(ts).gap, padding: getComputedStyle(ts).padding, rows: getComputedStyle(ts).gridTemplateRows, cols: getComputedStyle(ts).gridTemplateColumns, alignContent: getComputedStyle(ts).alignContent } : null;
    const ok = root.querySelector<HTMLElement>("[data-testid='event-editor-ok']");
    const okInfo = ok ? { cls: ok.className, bg: getComputedStyle(ok).backgroundColor, parent: (ok.parentElement as HTMLElement)?.className } : null;
    const strip = root.querySelector<HTMLElement>(".event-page-number-tabs");
    if (!strip) return { error: "no strip", kids, okInfo };
    const cs = getComputedStyle(strip);
    const parent = strip.parentElement as HTMLElement | null;
    return {
      kids, okInfo, tsKids, tsCss,
      stripRect: strip.getBoundingClientRect().toJSON(),
      stripCss: { height: cs.height, minHeight: cs.minHeight, alignItems: cs.alignItems, overflowX: cs.overflowX, padding: cs.padding },
      parentClass: parent?.className,
      sectionCss: section ? { gap: getComputedStyle(section).gap, alignContent: getComputedStyle(section).alignContent, display: getComputedStyle(section).display, rows: getComputedStyle(section).gridTemplateRows, flow: getComputedStyle(section).gridAutoFlow } : null,
      parentCss: parent ? { display: getComputedStyle(parent).display, height: getComputedStyle(parent).height, gridTemplate: getComputedStyle(parent).gridTemplateColumns } : null,
      children: [...strip.children].map((c) => ({
        cls: (c as HTMLElement).className,
        w: Math.round((c as HTMLElement).getBoundingClientRect().width),
        h: Math.round((c as HTMLElement).getBoundingClientRect().height),
      })),
    };
  });
  // eslint-disable-next-line no-console
  console.log("[geom]", JSON.stringify(info, null, 1));
});

test("secondary controls remain reachable through disclosures", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1500, height: 1000 });
  const { project, eventId } = mockupProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);

  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();

  const pageActions = modal.getByTestId("event-page-tabs");
  await pageActions.locator(":scope > summary").click();
  await expect(modal.getByTestId("event-page-tab-add")).toBeVisible();
  await expect(modal.getByTestId("event-page-copy")).toBeVisible();
  await modal.getByTestId("event-page-copy").click();

  await selectView(modal, "List");
  await modal.locator(".cmd-item .cmd-head").first().click();
  const editMenu = modal.getByTestId("event-command-edit-menu");
  await editMenu.locator(":scope > summary").click();
  await expect(modal.getByTestId("event-command-toolbar-undo")).toBeVisible();
  await expect(modal.getByTestId("event-command-toolbar-move-down")).toBeVisible();
  await expect(modal.getByTestId("event-command-toolbar-field-monster")).toBeVisible();
  await modal.getByTestId("event-command-toolbar-copy").click();

  const auxTools = modal.getByTestId("event-editor-aux-tools");
  await auxTools.locator(":scope > summary").click();
  await expect(modal.getByTestId("ai-event-assist").locator(":scope > summary")).toBeVisible();
  await expect(modal.getByTestId("event-script-live-preview").locator(":scope > summary")).toBeVisible();
  await expect(modal.getByTestId("event-script-flowchart").locator(":scope > summary")).toBeVisible();

  const preview = modal.getByTestId("event-script-live-preview");
  await preview.locator(":scope > summary").click();
  const previewPosition = preview.locator(".event-script-live-position");
  await expect(previewPosition).toHaveText(/1\/\d+/);
  await preview.getByTestId("event-script-live-next").click();
  await expect(previewPosition).toHaveText(/2\/\d+/);

  const flow = modal.getByTestId("event-script-flowchart");
  await flow.locator(":scope > summary").click();
  await expect(flow.getByTestId("event-flowchart-body")).toBeVisible();
  await expect(flow.locator("[data-testid^='event-flow-node-']").first()).toBeVisible();

  const ai = modal.getByTestId("ai-event-assist");
  await ai.locator(":scope > summary").click();
  await ai.getByTestId("ai-event-input").fill("선택지를 하나 추가해 줘");
  await expect(ai.getByTestId("ai-event-input")).toHaveValue("선택지를 하나 추가해 줘");
  await ai.locator(":scope > summary").click();

  const legend = modal.getByTestId("event-command-legend");
  await legend.locator(":scope > summary").click();
  await expect(legend.locator(".event-command-legend-item")).toHaveCount(6);
  await expect(legend.locator(".event-command-legend-label")).toContainText([
    "대사",
    "흐름",
    "데이터",
    "맵",
    "연출",
    "시스템",
  ]);

  const validation = modal.getByTestId("event-draft-validation");
  await validation.locator(":scope > summary").click();
  const firstIssue = validation.locator("[data-testid^='event-draft-validation-issue-']").first();
  await expect(firstIssue).toBeVisible();
  await firstIssue.click();
  await expect(modal).toBeVisible();

  const footerMore = modal.locator(".event-editor-footer-more");
  await footerMore.locator(":scope > summary").click();
  await expect(modal.getByTestId("event-editor-test")).toBeVisible();
  await expect(modal.getByTestId("event-editor-help")).toBeVisible();
  await expect(modal.getByTestId("event-delete")).toBeVisible();
  await modal.screenshot({ path: `${DIR}/10-disclosures-reachable.png` });

  await modal.getByTestId("event-editor-help").click();
  await expect(page.getByTestId("event-editor-help-modal")).toBeVisible();
  await page.getByTestId("event-editor-help-dismiss").click();
  await expect(page.getByTestId("event-editor-help-modal")).toBeHidden();
  await expect(modal).toBeVisible();
});

// 목업 대비 구조 체크리스트. 항목이 실제로 존재/작동하는지 기계적으로 센다.
test("mockup parity checklist", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const { project, eventId } = mockupProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);
  const modal = page.getByTestId("event-editor-modal");
  await page.waitForTimeout(600);
  await selectView(modal, "List");

  const result = await modal.evaluate((root) => {
    const has = (sel: string) => !!root.querySelector(sel);
    const rect = (sel: string) => {
      const n = root.querySelector<HTMLElement>(sel);
      return n ? n.getBoundingClientRect() : null;
    };
    const tabs = rect(".event-page-number-tabs");
    const rail = rect(".event-editor-settings-column");
    const canvas = rect(".event-editor-commands-column");
    const inspector = root.querySelector<HTMLElement>(".event-editor-inspector-column");
    const card = rect(".event-editor-card");
    const val = rect(".event-draft-validation");
    const gutters = new Set<string>();
    for (const item of root.querySelectorAll<HTMLElement>(".cmd-item[data-command-category]")) {
      const p = item.querySelector<HTMLElement>(":scope > .cmd-head > .cmd-prefix");
      if (p) gutters.add(getComputedStyle(p).backgroundColor);
    }
    const okBtn = root.querySelector<HTMLElement>(".btn.event-editor-footer-button.primary");
    const legend = rect(".event-command-legend");
    const list = rect(".cmd-list");
    const pagebar = rect(".event-editor-pagebar");
    const commandHeader = rect(".event-editor-pagebar > .event-editor-command-header");
    const toolbar = rect(".event-editor-command-toolbar");
    const commandHeaderText = root.querySelector(".event-editor-command-header > .event-contents-legend")?.textContent ?? "";
    const categoryLabels = new Set(
      [...root.querySelectorAll<HTMLElement>(".cmd-cat-icon[data-label]")]
        .map((badge) => badge.dataset.label)
        .filter(Boolean),
    );
    return {
      "가로 페이지 탭": !!tabs && tabs.width > 400 && tabs.height < 80,
      "탭 조건 요약": has("[data-testid='event-page-tab-cond-1']"),
      "이벤트 카드": has(".event-editor-card") && has(".event-editor-card-sprite"),
      "카드가 레일 최상단": !!card && !!rail && card.top - rail.top < 24,
      "초기 2열 배치": !!rail && !!canvas && rail.right <= canvas.left + 24,
      "초기 인스펙터 숨김": inspector?.hidden === true,
      "설정 열 폭 312": !!rail && Math.abs(rail.width - 312) <= 2,
      "블록 캔버스 거터 다색": gutters.size >= 3,
      "명령 카테고리 라벨": categoryLabels.size >= 3,
      "인라인 인스펙터": has(".event-editor-inspector-column"),
      "카테고리 범례 접힘": has(".event-command-legend") && root.querySelector<HTMLDetailsElement>(".event-command-legend")?.open === false,
      "범례가 캔버스 아래": !!legend && !!list && legend.top >= list.bottom - 4,
      "하단 검증 스트립": !!val && !!canvas && val.top >= canvas.bottom - 8,
      "황동 확인 버튼": !!okBtn && getComputedStyle(okBtn).backgroundColor === "rgb(217, 164, 65)",
      "명령 헤더가 페이지바 안": !!commandHeader && !!pagebar && commandHeader.top >= pagebar.top && commandHeader.bottom <= pagebar.bottom + 1,
      "툴바가 캔버스 최상단": !!toolbar && !!list && toolbar.bottom <= list.top + 2 && toolbar.height <= 34,
      "명령 보드 전폭": !!list && !!canvas && list.width >= canvas.width - 32,
      "편집 도구 접힘": root.querySelector<HTMLDetailsElement>(".event-editor-command-edit-menu")?.open === false,
      "보조 도구 접힘": root.querySelector<HTMLDetailsElement>(".event-editor-aux-tools-shell")?.open === false,
      // 상단 헤더 문구: "실행 내용 · N개".
      "헤더 명령 수": /실행 내용\s*·\s*\d+개/.test(commandHeaderText),
    };
  });
  const pass = Object.values(result).filter(Boolean).length;
  const total = Object.keys(result).length;
  // eslint-disable-next-line no-console
  console.log("[parity]", JSON.stringify(result), `=> ${pass}/${total}`);
  expect(pass, JSON.stringify(result)).toBe(total);

  await selectView(modal, "Storyboard");
  await selectFirstStoryboardCommand(modal);
  await expect(modal.getByTestId("event-editor-inspector")).toBeVisible();
  await expect(modal.getByTestId("event-inspector-body")).toBeVisible();
  const selectedGeometry = await modal.evaluate((root) => {
    const rail = root.querySelector<HTMLElement>(".event-editor-settings-column")?.getBoundingClientRect();
    const canvas = root.querySelector<HTMLElement>(".event-editor-commands-column")?.getBoundingClientRect();
    const inspector = root.querySelector<HTMLElement>(".event-editor-inspector-column")?.getBoundingClientRect();
    return {
      hasInspectorState: root.querySelector(".event-editor-workbench")?.classList.contains("has-command-inspector") === true,
      orderedColumns: !!rail && !!canvas && !!inspector && rail.right <= canvas.left + 24 && canvas.right <= inspector.left + 2,
      inspectorWidth: inspector?.width ?? 0,
    };
  });
  expect(selectedGeometry.hasInspectorState).toBe(true);
  expect(selectedGeometry.orderedColumns).toBe(true);
  expect(selectedGeometry.inspectorWidth).toBeGreaterThanOrEqual(346);
});


test("storyboard targets every displayed command path and remains secondary to the full list", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { project, eventId } = mockupProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);
  const modal = page.getByTestId("event-editor-modal");

  await expect(modal.locator(".cmd-list")).toBeVisible();
  await expect(modal.getByTestId("event-storyboard")).toBeHidden();
  await selectView(modal, "Storyboard");

  const targets = modal.locator(
    ".event-storyboard-card[data-cmd-path], .event-storyboard-branch-command[data-cmd-path]",
  );
  const topLevelCount = await modal.locator(".event-storyboard-card[data-cmd-path]").count();
  const nestedCount = await modal.locator(".event-storyboard-branch-command[data-cmd-path]").count();
  expect(topLevelCount).toBeGreaterThan(0);
  expect(nestedCount).toBeGreaterThan(0);

  for (let index = 0; index < await targets.count(); index += 1) {
    const target = targets.nth(index);
    const commandPath = await target.getAttribute("data-cmd-path");
    expect(commandPath).toBeTruthy();
    await target.scrollIntoViewIfNeeded();
    await target.click();
    await expect(modal.getByTestId("event-editor-inspector")).toHaveAttribute("data-command-path", commandPath!);
    await expect(target).toHaveAttribute("aria-current", "step");
  }
});


// 뷰포트 매트릭스 — 목업 불변식(3열 312/유연/348, 단일 행 탭, 하단 스트립)이
// 실제 사용자가 쓰는 창 크기에서 깨지지 않는지 기계적으로 확인한다.
const VIEWPORTS = [
  { width: 1586, height: 992 },
  { width: 1440, height: 900 },
  { width: 1280, height: 900 },
  { width: 1024, height: 768 },
  { width: 960, height: 900 },
];

for (const vp of VIEWPORTS) {
  test(`mockup invariants hold at ${vp.width}x${vp.height}`, async ({ page }) => {
    const browserIssues: string[] = [];
    page.on("pageerror", (error) => browserIssues.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") browserIssues.push(`console: ${message.text()}`);
    });
    await page.setViewportSize(vp);
    const { project, eventId } = mockupProject();
    await seedProjectFromSupabaseCanonical(page, project);
    await openEventEditor(page, eventId);
    const modal = page.getByTestId("event-editor-modal");
    await expect(modal).toBeVisible();
    await page.waitForTimeout(600);

    const initial = await modal.evaluate((root) => {
      const rect = (sel: string) => {
        const n = root.querySelector<HTMLElement>(sel);
        return n ? n.getBoundingClientRect() : null;
      };
      const modalRect = root.getBoundingClientRect();
      const tabs = rect(".event-page-number-tabs");
      const rail = rect(".event-editor-settings-column");
      const canvas = rect(".event-editor-commands-column");
      const inspector = root.querySelector<HTMLElement>(".event-editor-inspector-column");
      const val = rect(".event-draft-validation");
      const list = rect(".cmd-list");
      const legend = rect(".event-command-legend");
      const storyboardHost = rect(".event-storyboard-host");
      const storyboardCard = rect(".event-storyboard-card");
      const bench = root.querySelector<HTMLElement>(".event-editor-workbench");
      const inX = (r: DOMRect | null) => !!r && r.left >= modalRect.left - 1 && r.right <= modalRect.right + 1;
      return {
        inspectorHidden: inspector?.hidden === true,
        twoColumnOrder: !!rail && !!canvas && rail.right <= canvas.left + 24,
        canvasWidth: canvas?.width ?? 0,
        "탭 단일 행": !!tabs && tabs.height < 80 && tabs.width > 400,
        "열이 모달 안에": inX(rail) && inX(canvas),
        "검증 스트립 하단": !!val && !!canvas && val.top >= canvas.bottom - 8,
        "범례가 캔버스 아래": !!legend && !!list && legend.top >= list.bottom - 4,
        "이벤트 카드가 레일 안": root.querySelector(".event-editor-settings-column > .event-editor-card") !== null,
        "편집 도구 접힘": root.querySelector<HTMLDetailsElement>(".event-editor-command-edit-menu")?.open === false,
        "보조 도구 접힘": root.querySelector<HTMLDetailsElement>(".event-editor-aux-tools-shell")?.open === false,
        "검사 상세 접힘": root.querySelector<HTMLDetailsElement>(".event-draft-validation")?.open === false,
        "스토리보드 카드 잘림 없음": !!storyboardHost && !!storyboardCard && storyboardCard.bottom <= storyboardHost.bottom + 1,
        "가로 스크롤 없음": !bench || bench.scrollWidth <= bench.clientWidth + 1,
        "레일 gfx/trig 겹침 없음": (() => {
          const gfx = rect('[data-testid="event-classic-graphic"]');
          const trig = rect(".event-page-trigger-priority-stack");
          return !!gfx && !!trig && trig.top >= gfx.bottom - 2;
        })(),
      };
    });
    expect(initial.inspectorHidden).toBe(true);
    expect(initial.twoColumnOrder).toBe(true);
    expect(initial.canvasWidth).toBeGreaterThan(300);
    expect(initial["스토리보드 카드 잘림 없음"]).toBe(true);
    await modal.screenshot({ path: `${DIR}/${vp.width}x${vp.height}-initial.png` });

    await selectFirstStoryboardCommand(modal);
    const inspector = modal.getByTestId("event-editor-inspector");
    await expect(inspector).toBeVisible();
    await expect(inspector.getByTestId("event-inspector-body")).toBeVisible();
    await expect(page.getByTestId("event-command-edit-dialog")).toHaveCount(0);

    const selected = await modal.evaluate((root, desktop) => {
      const rect = (selector: string) => root.querySelector<HTMLElement>(selector)?.getBoundingClientRect() ?? null;
      const modalRect = root.getBoundingClientRect();
      const canvas = rect(".event-editor-commands-column");
      const inspectorRect = rect(".event-editor-inspector-column");
      const bench = root.querySelector<HTMLElement>(".event-editor-workbench");
      return {
        inspectorState: bench?.classList.contains("has-command-inspector") === true,
        inspectorWidth: inspectorRect?.width ?? 0,
        canvasWidth: canvas?.width ?? 0,
        desktopOrdered: !desktop || (!!canvas && !!inspectorRect && canvas.right <= inspectorRect.left + 2),
        compactOverlay: desktop || (!!canvas && !!inspectorRect && inspectorRect.left < canvas.right),
        inspectorInsideModal: !!inspectorRect && inspectorRect.left >= modalRect.left - 1 && inspectorRect.right <= modalRect.right + 1,
        noHorizontalOverflow: !bench || bench.scrollWidth <= bench.clientWidth + 1,
      };
    }, vp.width > 1180);
    const checks = { ...initial, ...selected };
    const pass = Object.entries(checks).filter(([key, value]) => key === "canvasWidth" || Boolean(value)).length;
    const total = Object.keys(checks).length;
    // eslint-disable-next-line no-console
    console.log(`[parity ${vp.width}x${vp.height}]`, JSON.stringify(checks), `=> ${pass}/${total}`);
    expect(selected.inspectorState).toBe(true);
    expect(selected.inspectorWidth).toBeGreaterThanOrEqual(346);
    expect(selected.canvasWidth).toBeGreaterThan(300);
    expect(selected.desktopOrdered).toBe(true);
    expect(selected.compactOverlay).toBe(true);
    expect(selected.inspectorInsideModal).toBe(true);
    expect(selected.noHorizontalOverflow).toBe(true);

    await modal.screenshot({ path: `${DIR}/${vp.width}x${vp.height}-selected.png` });
    await writeFile(
      `${DIR}/${vp.width}x${vp.height}-metrics.json`,
      `${JSON.stringify({ viewport: vp, initial, selected }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      `${DIR}/${vp.width}x${vp.height}-browser-issues.json`,
      `${JSON.stringify(browserIssues, null, 2)}\n`,
      "utf8"
    );
  });
}
