// 진단용: 3뷰 토글 결함 증거 캡처. 보고서용 스크린샷을 만든다.
import { mkdir } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mockupProject } from "./mockupProbeSeeds";
import { seedProjectForEditor } from "./projectSeed";

test.setTimeout(180_000);

const PHASE = process.env.EVIDENCE_PHASE ?? "before";
const OUT = `output/evidence/event-view-toggle/${PHASE}`;

async function openEditor(page: Page): Promise<Locator> {
  const { project, eventId } = mockupProject();
  await seedProjectForEditor(page, project);
  await page.evaluate(async ({ mapId, id }) => {
    const m = await import("/src/editor/panels/eventEditor/modal.ts");
    m.openEventEditorModal(mapId, id);
  }, { mapId: project.startMapId, id: eventId });
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  return editor;
}

test("evidence: 3뷰 토글 상태 캡처", async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 1000 });
  const editor = await openEditor(page);
  await mkdir(OUT, { recursive: true });
  const facts: Record<string, unknown> = { phase: PHASE };

  const shot = (name: string) => editor.screenshot({ path: `${OUT}/${name}.png` });

  // 01 목록
  await editor.getByTestId("event-view-toggle-list").click();
  await page.waitForTimeout(500);
  await shot("01-list");

  // 02 스토리 — 카드 선택 후 인스펙터 칼럼 상태
  await editor.getByTestId("event-view-toggle-storyboard").click();
  await page.waitForTimeout(500);
  await shot("02-storyboard");

  // 두 번째 카드를 고른다 — 첫 카드는 「위로 이동」이 정당하게 막히므로 이동 검증에 못 쓴다.
  const cards = editor.locator(".event-storyboard > [data-cmd-path]");
  const card = cards.nth(Math.min(1, (await cards.count()) - 1));
  await card.click();
  const dlg = page.getByTestId("event-command-edit-dialog");
  const dlgOpened = await dlg.waitFor({ state: "visible", timeout: 2000 }).then(() => true).catch(() => false);
  facts.cardClickOpensModalDialog = dlgOpened;
  if (dlgOpened) {
    await shot("03-storyboard-card-opens-modal");
    const cancel = dlg.getByRole("button", { name: /^(취소|닫기)$/ }).first();
    if (await cancel.count()) await cancel.click();
    await page.waitForTimeout(400);
  }
  facts.inspectorAfterCardClick = await editor.evaluate((root) => {
    const column = root.querySelector<HTMLElement>('[data-testid="event-editor-inspector"]');
    return {
      hidden: column?.hidden ?? null,
      commandPath: column?.dataset.commandPath ?? null,
      text: (column?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 90),
    };
  });
  await shot("04-storyboard-selected-inspector");

  // 05 툴바 편집 팝오버 (스토리 모드에서 죽은 버튼들)
  await editor.getByTestId("event-command-edit-menu").locator(":scope > summary").click();
  await page.waitForTimeout(400);
  await shot("05-storyboard-edit-popover");
  const orderBefore = await editor.evaluate((root) =>
    Array.from(root.querySelectorAll<HTMLElement>(".event-storyboard > .event-storyboard-card"))
      .map((n) => (n.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 26)));
  const up = editor.getByTestId("event-command-toolbar-move-up");
  facts.moveUpVisible = await up.isVisible().catch(() => false);
  // disabled 버튼을 click() 하면 Playwright 가 활성화를 기다리다 타임아웃한다 — 상태를 먼저 기록한다.
  facts.moveUpEnabled = await up.isEnabled().catch(() => false);
  facts.editTargetText = await editor.evaluate((root) =>
    root.querySelector('[data-testid="event-command-edit-target"]')?.textContent ?? null);
  if (facts.moveUpVisible && facts.moveUpEnabled) await up.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);
  const orderAfter = await editor.evaluate((root) =>
    Array.from(root.querySelectorAll<HTMLElement>(".event-storyboard > .event-storyboard-card"))
      .map((n) => (n.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 26)));
  facts.moveUpChangedOrder = JSON.stringify(orderBefore) !== JSON.stringify(orderAfter);
  facts.orderBefore = orderBefore;
  facts.orderAfter = orderAfter;
  await shot("06-after-move-up-attempt");
  // 팝오버 닫기 (Escape 는 모달을 닫으므로 summary 재클릭)
  const menu = editor.getByTestId("event-command-edit-menu");
  if (await menu.evaluate((n) => n instanceof HTMLDetailsElement && n.open)) {
    await menu.locator(":scope > summary").click();
  }
  await page.waitForTimeout(300);

  // 07 미리보기
  await editor.getByTestId("event-view-toggle-preview").click();
  await page.waitForTimeout(700);
  facts.previewBefore = await editor.evaluate((root) => ({
    selected: root.querySelector('[data-testid="event-view-toggle-preview"]')?.getAttribute("aria-selected"),
    pos: root.querySelector(".event-script-live-position")?.textContent ?? null,
  }));
  await shot("07-preview");

  // 08 미리보기 중 편집 → 모드 유지되는가
  await page.evaluate(async () => {
    const s = await import("/src/project/store.ts");
    const cur = s.store.getCurrent();
    const mapId = cur.startMapId;
    const ev = cur.maps[mapId]?.events?.[0];
    const pageId = ev?.pages?.[0]?.id;
    if (!ev || !pageId) return;
    s.store.update((p: any) => {
      p.maps[mapId].events.find((e: any) => e.id === ev.id)
        .pages.find((x: any) => x.id === pageId).commands.push({ kind: "wait", frames: 30 });
    });
  });
  await page.waitForTimeout(900);
  facts.previewAfterEdit = await editor.evaluate((root) => ({
    selectedPreview: root.querySelector('[data-testid="event-view-toggle-preview"]')?.getAttribute("aria-selected"),
    selectedStoryboard: root.querySelector('[data-testid="event-view-toggle-storyboard"]')?.getAttribute("aria-selected"),
    pos: root.querySelector(".event-script-live-position")?.textContent ?? null,
    previewPresent: !!root.querySelector('[data-testid="event-page-preview"]'),
  }));
  await shot("08-preview-after-edit");

  // 09 검색: 목록에서 필터 → 스토리 전환 → 미리보기 타이핑 → 목록 복귀
  await editor.getByTestId("event-view-toggle-list").click();
  await page.waitForTimeout(500);
  const search = editor.getByTestId("event-command-search");
  await search.fill("선택지");
  await page.waitForTimeout(500);
  facts.searchList = await editor.evaluate((root) => {
    const n = Array.from(root.querySelectorAll<HTMLElement>(".event-contents-fieldset > .cmd-list [data-cmd-path]"));
    return { box: root.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')?.value, total: n.length, hidden: n.filter((x) => x.hidden).length };
  });
  await shot("09-search-list-filtered");

  await editor.getByTestId("event-view-toggle-storyboard").click();
  await page.waitForTimeout(600);
  facts.searchStoryAfterSwitch = await editor.evaluate((root) => {
    const n = Array.from(root.querySelectorAll<HTMLElement>(".event-storyboard [data-cmd-path]"));
    return { box: root.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')?.value, total: n.length, hidden: n.filter((x) => x.hidden).length };
  });
  await shot("10-search-storyboard-unfiltered");

  await editor.getByTestId("event-view-toggle-preview").click();
  await page.waitForTimeout(600);
  // 미리보기에서 검색이 가능한가 — 비활성이면 fill 은 영원히 기다리므로 상태만 본다.
  facts.searchEnabledInPreview = await search.isEnabled().catch(() => false);
  facts.searchTitleInPreview = await search.getAttribute("title").catch(() => null);
  if (facts.searchEnabledInPreview) {
    await search.fill("없는단어zzz", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  await shot("11-search-in-preview");
  await editor.getByTestId("event-view-toggle-list").click();
  await page.waitForTimeout(600);
  facts.searchBackToList = await editor.evaluate((root) => {
    const n = Array.from(root.querySelectorAll<HTMLElement>(".event-contents-fieldset > .cmd-list [data-cmd-path]"));
    return {
      box: root.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')?.value,
      total: n.length,
      hidden: n.filter((x) => x.hidden).length,
      shown: n.filter((x) => !x.hidden).map((x) => (x.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 24)),
    };
  });
  await shot("12-search-back-to-list-mismatch");
  await search.fill("", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);

  // 13 Escape 가 팝오버 대신 모달을 닫는가
  await editor.getByTestId("event-command-edit-menu").locator(":scope > summary").click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  facts.escapeClosedWholeModal = !(await page.getByTestId("event-editor-modal").isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/13-escape-result.png` });

  console.log(`=== EVIDENCE ${PHASE} ===\n` + JSON.stringify(facts, null, 2));
});
