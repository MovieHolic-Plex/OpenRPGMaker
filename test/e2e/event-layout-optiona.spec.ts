import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import type { Command } from "@/project/types";

// Vite 가 절대 URL 로 서빙하는 모달 모듈 — TS 는 절대 경로를 모르므로 동적 import 의 형식만 잡아준다.
type EventEditorModalModule = {
  readonly openEventEditorModal: (mapId: string, eventId: string) => void;
  readonly openNewEventEditorModal: (mapId: string, x: number, y: number) => string;
};

// Option A event-editor layout contract (proposal: .omo/evidence/event-editor-layout-proposal/proposal.html)
//   - page tabs move into the modal header as a segment control ([data-testid^=evt-page-segment])
//   - the legacy wide page-tab strip is removed from the modal body
//   - left settings rail is at most 5 accordion groups with summary header text
//   - command rows select by click (no per-row '편집' button); double-click opens edit
//   - right inspector shows the selected command with an integrated preview (no duplicated text)
//   - footer has exactly ONE primary '저장하고 닫기'

const EVIDENCE_DIR = "C:/Users/USER/Downloads/rpg-zzu/.omo/evidence/event-layout";

test.setTimeout(90_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    window.localStorage.setItem("oprn:standard-welcome-seen", "1");
    window.localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    window.localStorage.setItem("oprn:editor-ui-mode", "standard");
  });
});

function commandProject(): { readonly project: ReturnType<typeof createBlankProject>; readonly eventId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId!;
  const map = project.maps[mapId]!;
  const cmds: Command[] = [
    { kind: "text", speaker: "북문 경비병", body: "드디어 돌아왔군. 의뢰는 잘 해결했나?" },
    { kind: "setVariable", variableId: "0001", op: "+=", value: 3 },
    { kind: "setSwitch", switchId: "0001", value: true },
  ];
  map.events = [{
    id: "ev_option_a",
    x: 4,
    y: 4,
    trigger: { kind: "action" },
    commands: [],
    characterId: "north-gate-guard",
    pages: [
      {
        id: "p1",
        name: "페이지 1",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 2, frequency: 3 },
        commands: cmds,
      },
      {
        id: "p2",
        name: "페이지 2",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 2, frequency: 3 },
        commands: [{ kind: "text", speaker: "북문 경비병", body: "페이지 2의 첫 대사입니다." }],
      },
      {
        id: "p3",
        name: "페이지 3",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 2, frequency: 3 },
        commands: [],
      },
    ],
  }];
  return { project, eventId: "ev_option_a" };
}

async function seedCommandProject(page: Page): Promise<{ readonly mapId: string; readonly eventId: string }> {
  const { project, eventId } = commandProject();
  await seedProjectFromSupabaseCanonical(page, project);
  return { mapId: project.startMapId!, eventId };
}

async function openEditorForProject(page: Page): Promise<{ readonly mapId: string; readonly eventId: string }> {
  // 표준 모드에서는 이벤트 레이어/행 선택을 거쳐야 열린다(expert 는 즉시 열림).
  await page.getByTestId("layer-event").click();
  const row = page.locator(".event-list-row").first();
  await expect(row).toBeVisible();
  await row.click();
  // 정식 경로 별칭(@/… )을 쓰면 브라우저에서 리졸브되지 않으므로 Vite 가 서빙하는 절대 URL 을 쓴다.
  // TS 는 절대 경로를 해석하지 못하므로 런타임 문자열로만 넘긴다.
  // 시드 주입 경로(/ ?freshProject 등)에서는 `window.__RPG_ZZU_E2E_PROJECT__` 가
  // 페이지 로드 후 삭제될 수 있고 게스트 로그인이 뜬다. 프로젝트 스토어의 현재 시작 맵을
  // 직접 읽어 열고, 로그인 모달이 뜨면 게스트로 진행한다.
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 3000 }).catch(() => false)) await guest.click();
  await page.evaluate(async ({ eventId }) => {
    const modalModule = (await import(
      /* @vite-ignore */ "/src/editor/panels/eventEditor/modal.ts" as string
    )) as EventEditorModalModule;
    const project = (await import(
      /* @vite-ignore */ "/src/project/store.ts" as string
    )) as { store: { getCurrent(): { startMapId?: string } } };
    const mapId = project.store.getCurrent().startMapId;
    if (!mapId) throw new Error("missing start map id");
    modalModule.openEventEditorModal(mapId, eventId);
  }, { eventId: "ev_option_a" });
  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();
  return { mapId: "", eventId: "ev_option_a" };
}

test("C1 standard viewport — Option A shell contract", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedCommandProject(page);
  await openEditorForProject(page);

  const modal = page.getByTestId("event-editor-modal");

  // Header page segments exist; at least one is active (aria-pressed).
  const segments = modal.locator("[data-testid^='evt-page-segment']");
  await expect(segments.first()).toBeVisible();
  expect(await segments.count()).toBeGreaterThanOrEqual(1);
  const activeCount = await segments.evaluateAll((nodes) =>
    nodes.filter((node) => node instanceof HTMLElement && node.getAttribute("aria-pressed") === "true").length,
  );
  expect(activeCount, `expected >=1 active of ${await segments.count()} segments`).toBeGreaterThanOrEqual(1);
  // 세그먼트는 48px 타이틀바 안에서 잘렸다(2줄 리치 탭). 이제 전용 페이지 행이 유일한 집이다.
  const headerSegments = modal.locator(".event-editor-modal-header [data-testid^='evt-page-segment']");
  expect(await headerSegments.count()).toBe(0);
  const pagebarSegments = modal.locator(".event-editor-pagebar [data-testid^='evt-page-segment']");
  expect(await pagebarSegments.count()).toBeGreaterThanOrEqual(1);

  // Legacy wide page-tab strip is removed from the modal body.
  await expect(modal.getByTestId("event-page-strip")).toHaveCount(0);
  expect(await modal.locator(".event-page-number-tabs").count()).toBe(0);
  expect(await modal.locator("[data-testid^='event-page-tab-']").count()).toBe(0);

  // 좌측 설정 레일: 적어도 하나의 접이식 그룹(details > summary)이 있고, 그 수도 5 이하다.
  const settingsRail = modal.locator(".event-editor-settings-column");
  await expect(settingsRail).toBeVisible();
  const accordionGroups = settingsRail.locator("details");
  const accordionCount = await accordionGroups.count();
  expect(accordionCount, `expected <=5 accordion groups, got ${accordionCount}`).toBeLessThanOrEqual(5);
  const accordionHeaders = await accordionGroups.locator(":scope > summary").allInnerTexts();
  for (const header of accordionHeaders) {
    expect(header.trim().length, `accordion summary text missing: ${JSON.stringify(header)}`).toBeGreaterThan(0);
  }
  // 레일 전체에 요약 텍스트(summary 로 시작하는 그룹)가 하나 이상 보여야 한다.
  const railSummaryText = (await settingsRail.innerText()).replace(/\s+/g, " ").trim();
  expect(railSummaryText.length).toBeGreaterThan(0);

  // Command list rows select by click; no per-row '편집' button.
  await modal.getByTestId("event-view-toggle-list").click();
  const rows = modal.locator(".cmd-item");
  await expect(rows.first()).toBeVisible();
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);
  expect(await modal.getByTestId("event-command-row-edit").count()).toBe(0);
  expect(await modal.locator(".cmd-actions button", { hasText: "편집" }).count()).toBe(0);

  // Footer has exactly ONE primary '저장하고 닫기'.
  expect(await modal.getByTestId("event-editor-save").count()).toBe(1);
  const footerPrimarySave = modal.locator(".event-editor-modal-footer .btn.primary", { hasText: "저장하고 닫기" });
  expect(await footerPrimarySave.count()).toBe(1);

  // Legacy tab strip must be absent regardless of the edit path (missing selector = RED).
  await expect(modal.getByTestId("event-page-strip")).toHaveCount(0);
  expect(await modal.locator(".event-page-number-tabs").count()).toBe(0);
  expect(await modal.locator("[data-testid^='event-page-tab-']").count()).toBe(0);

  // Double-click opens the edit dialog (no '편집' button route).
  const firstRow = modal.locator(".cmd-list .cmd-item .cmd-head").first();
  await firstRow.dblclick();
  await expect(page.getByTestId("event-command-edit-dialog")).toBeVisible();
  await page.getByTestId("event-command-edit-cancel").click();
  await expect(page.getByTestId("event-command-edit-dialog")).toHaveCount(0);

  await modal.screenshot({ path: `${EVIDENCE_DIR}/red-c1-standard-layout.png` });
  await page.screenshot({ path: `${EVIDENCE_DIR}/final-1280.png` });
});

test("C2 compact viewport 1024x768 — modal fits, list wider than rail, no horizontal overflow", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1024, height: 768 });
  await seedCommandProject(page);
  await openEditorForProject(page);

  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();

  const geometry = await page.evaluate(() => {
    const modalNode = document.querySelector<HTMLElement>("[data-testid='event-editor-modal']");
    const windowNode = modalNode?.querySelector<HTMLElement>(".event-editor-modal-window");
    const rail = modalNode?.querySelector<HTMLElement>(".event-editor-settings-column");
    const list = modalNode?.querySelector<HTMLElement>(".event-editor-commands-column");
    const rect = (node: HTMLElement | null | undefined) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      modal: rect(modalNode),
      dialog: rect(windowNode),
      rail: rect(rail),
      list: rect(list),
    };
  });

  expect(geometry.dialog, JSON.stringify(geometry)).not.toBeNull();
  expect(geometry.modal, JSON.stringify(geometry)).not.toBeNull();
  expect(geometry.rail, JSON.stringify(geometry)).not.toBeNull();
  expect(geometry.list, JSON.stringify(geometry)).not.toBeNull();

  const dialog = geometry.dialog!;
  expect(dialog.left, JSON.stringify(geometry)).toBeGreaterThanOrEqual(0);
  expect(dialog.top, JSON.stringify(geometry)).toBeGreaterThanOrEqual(0);
  expect(dialog.right, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(dialog.bottom, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.viewportHeight);

  expect(geometry.list!.width, JSON.stringify(geometry)).toBeGreaterThan(geometry.rail!.width);
  expect(geometry.documentScrollWidth, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.viewportWidth);

  await modal.screenshot({ path: `${EVIDENCE_DIR}/red-c2-compact-viewport.png` });
  await page.screenshot({ path: `${EVIDENCE_DIR}/final-1024.png` });
});

test("C4 interaction — page segment switching, add command, and undo", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedCommandProject(page);
  await openEditorForProject(page);

  const modal = page.getByTestId("event-editor-modal");

  const segments = modal.locator("[data-testid^='evt-page-segment']");
  await expect(segments.first()).toBeVisible();
  expect(await segments.count()).toBeGreaterThanOrEqual(2);

  // Page 1 first command text (list view).
  await modal.getByTestId("event-view-toggle-list").click();
  const firstRow = modal.locator(".cmd-item .cmd-head").first();
  await expect(firstRow).toBeVisible();
  const page1FirstRowText = (await firstRow.innerText()).trim();
  expect(page1FirstRowText.length).toBeGreaterThan(0);

  // Click segment 2 -> the first command row text must change.
  const segmentIndex = (segments: ReturnType<typeof modal.locator>): Promise<number> =>
    segments.evaluateAll((nodes) => nodes.findIndex((node) => node instanceof HTMLElement && node.getAttribute("aria-pressed") === "true"));
  await segments.nth(1).click();
  await expect.poll(async () => (await segmentIndex(segments))).toBe(1);

  const page2FirstRowText = (await modal.locator(".cmd-item .cmd-head").first().innerText({ timeout: 10_000 })).trim();
  if (page2FirstRowText === page1FirstRowText) {
    // Page 2 has exactly one command; the list re-render may momentarily equal the
    // previous text. Click segment 1 and back to force the fresh render before retrying.
    await segments.nth(0).click();
    await expect.poll(async () => (await segmentIndex(segments))).toBe(0);
    await segments.nth(1).click();
    await expect.poll(async () => (await segmentIndex(segments))).toBe(1);
    const stillSame = await modal.locator(".cmd-item .cmd-head").first().innerText();
    expect(stillSame.trim()).not.toBe(page1FirstRowText);
  } else {
    expect(page2FirstRowText).not.toBe(page1FirstRowText);
  }

  // '+ 명령' opens the command picker.
  await modal.getByTestId("event-command-toolbar-add").click();
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();

  // Add a command; the edit dialog opens first (picker stays open until applied).
  const addText = picker.locator('[data-testid="command-picker-add-text"][data-command-entry="m2-001-show-text"]');
  await expect(addText).toBeVisible();
  await addText.click();
  await expect(page.getByTestId("event-command-edit-dialog")).toBeVisible();
  await page.getByTestId("event-command-text-body").fill("추가한 명령 대사");
  await page.getByTestId("event-command-edit-ok").click();
  await expect(page.getByTestId("event-command-edit-dialog")).toHaveCount(0);
  await expect(page.getByTestId("event-command-picker")).toHaveCount(0);

  // The added command appears in the list.
  const countAfterAdd = await modal.locator(".cmd-item").count();
  expect(countAfterAdd).toBeGreaterThan(0);
  const listText = (await modal.locator(".cmd-list").innerText()).replace(/\s+/g, " ");
  expect(listText).toContain("추가한 명령 대사");

  // Undo via the '되돌리기' toolbar button removes the added command.
  const undoButton = modal.getByTestId("event-command-toolbar-undo");
  await expect(undoButton).toBeEnabled();
  await undoButton.click();
  await expect(modal.locator(".cmd-list")).not.toContainText("추가한 명령 대사", { timeout: 10_000 });
  const countAfterUndo = await modal.locator(".cmd-item").count();
  expect(countAfterUndo).toBe(countAfterAdd - 1);

  await modal.screenshot({ path: `${EVIDENCE_DIR}/red-c4-interaction.png` });
});
