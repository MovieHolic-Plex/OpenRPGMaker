import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { ActorRecord, Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

type CompanionEntry = {
  readonly commandId: string;
  readonly label: string;
  readonly selectable: boolean;
};

type SweepResult =
  | { readonly commandId: string; readonly outcome: "dialog-opened"; readonly evidence: string }
  | { readonly commandId: string; readonly outcome: "informational"; readonly evidence: string };

const EVIDENCE_DIR = ".omo/evidence/companion-sweep";

test.setTimeout(600_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-companion-sweep");
    window.localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
    window.localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    window.localStorage.setItem("oprn:standard-welcome-seen", "1");
    window.localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
});

test("동료·전투 탭을 전수 클릭하고 DB 동료가 이미지로 나온다", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1586, height: 992 });
  const project = companionProject();
  await seedProjectFromSupabaseCanonical(page, project);
  const eventId = await page.evaluate(async (mapId) => {
    // dev 서버 절대 URL 동적 import — 정적 분석(TS2307) 회피를 위해 변수 경로로 우회한다.
    const specifier = ["/src/editor/panels", "eventEditor", "modal.ts"].join("/");
    const modalModule = (await import(/* @vite-ignore */ specifier)) as unknown as {
      openNewEventEditorModal: (mapId: string, x: number, y: number) => Promise<string>;
    };
    return modalModule.openNewEventEditorModal(mapId, 5, 5);
  }, project.startMapId) as unknown as string;
  expect(eventId).toBeTruthy();

  let picker = await openCompanionTab(page);
  const entries = await readCompanionEntries(picker);
  expect(entries.length).toBeGreaterThan(10);
  await picker.screenshot({ path: `${EVIDENCE_DIR}/00-companion-tab.png` });

  const evidence: SweepResult[] = [];
  for (const entry of entries) {
    picker = await openCompanionTab(page);
    const button = companionButton(picker, entry.commandId);
    const shot = `${entry.commandId.replace(/[^a-z0-9]+/gi, "-")}.png`;
    if (!entry.selectable) {
      await expect(button).toHaveAttribute("aria-disabled", "true");
      evidence.push({ commandId: entry.commandId, outcome: "informational", evidence: shot });
      continue;
    }
    const rowCountBefore = await rootCommandRows(page);
    await button.scrollIntoViewIfNeeded();
    await button.click();
    const dialog = page.getByTestId("event-command-edit-dialog");
    try {
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      await dialog.screenshot({ path: `${EVIDENCE_DIR}/${shot}` });
      evidence.push({ commandId: entry.commandId, outcome: "dialog-opened", evidence: shot });
      await dialog.getByTestId("event-command-edit-cancel").click();
      await expect(dialog).toHaveCount(0);
    } catch {
      // 다이얼로그 대신 곧바로 삽입되는 종류는 목록 행 증가로 확인한다.
      const grew = (await rootCommandRows(page)) > rowCountBefore;
      if (!grew) throw new Error(`${entry.commandId}: 클릭 후 다이얼로그도 행 증가도 없음`);
      await picker.screenshot({ path: `${EVIDENCE_DIR}/${shot}` });
      evidence.push({ commandId: entry.commandId, outcome: "dialog-opened", evidence: shot });
    }
  }
  expect(evidence).toHaveLength(entries.length);

  // 탭2 자체에 DB 동료 전원 로스터 + 초상화 이미지 계약.
  picker = await openCompanionTab(page);
  const roster = picker.getByTestId("companion-roster");
  await expect(roster).toBeVisible();
  const cards = roster.locator("[data-testid^='companion-card-']");
  await expect(cards).toHaveCount(project.database.actors.length);
  for (const actor of project.database.actors) {
    const card = roster.getByTestId(`companion-card-${actor.id}`);
    await expect(card).toContainText(actor.name);
    const thumb = card.getByTestId(`companion-thumb-${actor.id}`);
    const backgroundImage = await thumb.evaluate((node) => getComputedStyle(node).backgroundImage);
    expect(backgroundImage, `${actor.name} 썸네일 배경 이미지`).toContain("url(");
    // CSS 가 실제로 박스를 만드는지 — inline-block 부모 안에서의 collapse 방지 계약.
    const box = await thumb.boundingBox();
    expect(box?.height ?? 0, `${actor.name} 초상화 렌더 높이`).toBeGreaterThanOrEqual(30);
  }

  // 카드 클릭은 표준 편집 다이얼로그(addFollower 프리필)로 이어진다.
  await cards.first().click();
  const addDialog = page.getByTestId("event-command-edit-dialog");
  await expect(addDialog).toBeVisible();
  await addDialog.screenshot({ path: `${EVIDENCE_DIR}/companion-card-add-dialog.png` });
  // 보조 도구 > 동료 프리셋에도 DB 동료 전원 칩 + 초상화.
  await addDialog.getByTestId("event-command-edit-cancel").click();
  await expect(addDialog).toHaveCount(0);
  const pickerHost = page.getByTestId("event-command-picker");
  if (!(await pickerHost.isVisible().catch(() => false))) {
    await page.keyboard.press("Escape");
    await expect(pickerHost).toBeVisible();
    await pickerHost.getByTestId("event-command-picker-tab-2").click();
  }
  await pickerHost.screenshot({ path: `${EVIDENCE_DIR}/99-companion-roster.png` });
  await closePickerOverlay(pickerHost);

  const auxTools = page.getByTestId("event-editor-aux-tools").locator("summary").first();
  await auxTools.click({ force: true });
  await expect(page.getByTestId("event-editor-aux-tools")).toHaveAttribute("open", /.*/);
  const presetBar = page.getByTestId("follower-preset-bar");
  await presetBar.locator("summary").click({ force: true }); // 기본 접힘 bar 를 펼친다
  await expect(presetBar).toHaveAttribute("open", /.*/);
  for (const actor of project.database.actors) {
    const chip = presetBar.locator("[data-testid^='follower-preset-chip-']").filter({ hasText: actor.name });
    await expect(chip).toHaveCount(1);
  }
  await presetBar.screenshot({ path: `${EVIDENCE_DIR}/follower-presets.png` });
});

async function closePickerOverlay(picker: Locator): Promise<void> {
  if (!(await picker.isVisible().catch(() => false))) return;
  await picker.getByTestId("event-command-picker-cancel").click({ force: true });
  await expect(picker).toHaveCount(0);
}

async function openCompanionTab(page: Page): Promise<Locator> {
  const open = page.getByTestId("event-command-picker");
  if (!(await open.isVisible().catch(() => false))) {
    await page.keyboard.press("Control+K");
  }
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("event-command-picker-tab-2").click();
  await expect(picker.getByTestId("event-command-picker-tab-2")).toHaveAttribute("aria-selected", "true");
  return picker;
}

async function readCompanionEntries(picker: Locator): Promise<CompanionEntry[]> {
  return picker.locator(".event-command-picker-command-wrap[data-command-id]").evaluateAll((nodes) =>
    nodes.map((node) => {
      const commandId = node.getAttribute("data-command-id");
      if (!commandId) throw new Error("동료 탭 항목에 command id 없음");
      const button = node.querySelector<HTMLElement>(".event-command-picker-command");
      if (!button) throw new Error(`${commandId}: 버튼 누락`);
      return {
        commandId,
        label: button.getAttribute("aria-label") ?? commandId,
        selectable: button.getAttribute("aria-disabled") !== "true",
      };
    }),
  );
}

function companionButton(picker: Locator, commandId: string): Locator {
  return picker
    .locator(`.event-command-picker-command-wrap[data-command-id="${commandId}"]`)
    .locator(".event-command-picker-command")
    .first();
}

async function rootCommandRows(page: Page): Promise<number> {
  return page.locator('.cmd-item[data-cmd-depth="0"]').count();
}

function companionProject(): Project {
  const project = createBlankProject();
  const template = project.database.actors[0];
  if (!template) throw new Error("기본 액터 fixture 없음");
  project.database.actors = [
    companionActor(template, "actor-companion-a", "세라"),
    companionActor(template, "actor-companion-b", "루카"),
    companionActor(template, "actor-companion-c", "미나"),
    companionActor(template, "actor-companion-d", "가온"),
  ];
  return project;
}

function companionActor(template: ActorRecord, id: ActorRecord["id"], name: string): ActorRecord {
  return {
    ...structuredClone(template),
    id,
    name,
    nickname: name,
    faceResourceId: "easyrpg-faceset-actor1-03",
    characterResourceId: "easyrpg-charset-actor1",
    characterIndex: 1,
  };
}
