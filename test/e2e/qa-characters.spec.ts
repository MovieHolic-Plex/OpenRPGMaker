import { expect, test, type Page } from "@playwright/test";
import {
  BOUNDARY_INPUTS,
  bootDbLane,
  collectConsoleErrors,
  dirtyGuardOracle,
  switchTabAnyMode,
} from "./dbAuditHelpers";
import { exportedProject, type DatabaseTabSpec } from "./rm2k3-database-helpers";

const CHARACTERS_TAB: DatabaseTabSpec = {
  label: "Characters",
  slug: "characters",
  testId: "db-tab-characters",
};
const ITEMS_TAB: DatabaseTabSpec = {
  label: "Items",
  slug: "items",
  testId: "db-tab-items",
};

type CharacterProfileExport = {
  readonly displayName?: string;
  readonly birthday?: { readonly season: string; readonly day: number };
  readonly giftPrefs?: {
    readonly loved?: readonly string[];
    readonly liked?: readonly string[];
    readonly disliked?: readonly string[];
  };
  readonly giftResponses?: {
    readonly loved?: string;
    readonly liked?: string;
    readonly neutral?: string;
    readonly disliked?: string;
    readonly alreadyGifted?: string;
    readonly noItems?: string;
  };
};

type ExportedWithCharacters = Awaited<ReturnType<typeof exportedProject>> & {
  readonly characters?: Record<string, CharacterProfileExport>;
};

const ORPHAN_HINT = "이벤트에서 쓰이는 characterId이지만 프로필이 없습니다. 표시 이름을 넣고 프로필을 만들 수 있습니다.";
const USAGE_EMPTY_HINT = "이 characterId를 쓰는 맵 이벤트가 없습니다.";
const FRESH_ORPHAN_IDS = ["char_lu", "char_merchant", "char_noah"] as const;

async function waitForExportTick(page: Page): Promise<void> {
  // Timing contract: editor.ts updateProjectExport uses a 150ms trailing debounce.
  // Poll the hidden oracle itself instead of sleeping that window.
  await expect
    .poll(async () => page.getByTestId("project-export-json").textContent(), { timeout: 2_000 })
    .not.toBe("");
}

async function exportedCharacters(page: Page): Promise<Record<string, CharacterProfileExport>> {
  await waitForExportTick(page);
  const project = (await exportedProject(page)) as ExportedWithCharacters;
  return project.characters ?? {};
}

async function selectedCharacterId(page: Page): Promise<string> {
  const row = page.locator("[data-testid='db-characters-list'] .db-list-row.active");
  await expect(row).toBeVisible();
  const id = await row.getAttribute("data-record-id");
  if (!id) throw new Error("selected character row has no data-record-id");
  return id;
}

async function addCharacterProfile(page: Page): Promise<string> {
  const before = Object.keys(await exportedCharacters(page));
  await page.getByTestId("db-character-add").click();
  await expect
    .poll(async () => Object.keys(await exportedCharacters(page)).length, { timeout: 5_000 })
    .toBe(before.length + 1);
  return selectedCharacterId(page);
}

function actorFaceIds(project: ExportedWithCharacters): string[] {
  return project.database.actors
    .map((actor) => actor.faceResourceId?.trim())
    .filter((id): id is string => Boolean(id));
}

async function assertNoActorFacesetOnThumb(page: Page, rowTestId: string, faceIds: readonly string[]): Promise<void> {
  const thumb = page.getByTestId(rowTestId).locator(".db-list-thumb");
  await expect(thumb).toBeVisible();
  const html = await thumb.evaluate((node) => node.outerHTML);
  for (const faceId of faceIds) {
    expect(html, "character list thumb must not use an Actor faceset").not.toContain(faceId);
  }
}

test.describe("QA — characters tab (db-tab-characters)", () => {
  test("fresh orphan empty-profile, create+round-trip, unused usage, charset thumb, dirty discard", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await switchTabAnyMode(page, CHARACTERS_TAB);

    await expect(page.getByTestId("db-characters-workspace")).toBeVisible();
    await expect(page.getByTestId("db-characters-intro")).toBeVisible();
    await expect(page.getByTestId("db-characters-list")).toBeVisible();
    await expect(page.getByTestId("db-characters-list").locator(".db-list-row")).toHaveCount(FRESH_ORPHAN_IDS.length);
    expect(Object.keys(await exportedCharacters(page))).toEqual([]);

    for (const orphanId of FRESH_ORPHAN_IDS) {
      await expect(page.getByTestId(`db-character-row-${orphanId}`)).toBeVisible();
    }

    await expect(page.getByTestId("db-character-orphan-create")).toBeVisible();
    await expect(page.getByTestId("db-character-orphan-create").locator(".empty-hint")).toHaveText(ORPHAN_HINT);
    await expect(page.getByTestId("db-character-create-profile")).toBeVisible();
    await expect(page.getByTestId("db-character-status")).toContainText("프로필 없음 (고아 ID)");

    const baselineExport = (await exportedProject(page)) as ExportedWithCharacters;
    const faceIds = actorFaceIds(baselineExport);
    for (const orphanId of FRESH_ORPHAN_IDS) {
      const thumb = page.getByTestId(`db-character-row-${orphanId}`).locator(".db-list-thumb");
      await expect(thumb).toBeVisible();
      await expect(thumb).toHaveClass(/db-list-thumb-crop/);
      await expect(thumb.locator(".db-list-thumb-probe")).toHaveCount(1);
      await assertNoActorFacesetOnThumb(page, `db-character-row-${orphanId}`, faceIds);
    }

    const unusedId = await addCharacterProfile(page);
    expect(FRESH_ORPHAN_IDS.includes(unusedId as (typeof FRESH_ORPHAN_IDS)[number])).toBe(false);
    await expect(page.getByTestId("db-character-id")).toHaveText(unusedId);
    await expect(page.getByTestId("db-character-display-name")).toHaveValue("새 캐릭터");
    await expect(page.getByTestId("db-character-usage-empty")).toHaveText(USAGE_EMPTY_HINT);

    const unusedThumb = page.getByTestId(`db-character-row-${unusedId}`).locator(".db-list-thumb");
    await expect(unusedThumb).toBeVisible();
    await expect(unusedThumb).toHaveClass(/empty/);
    await expect(unusedThumb.locator("img")).toHaveCount(0);
    const unusedBg = await unusedThumb.evaluate((node) => getComputedStyle(node).backgroundImage);
    expect(unusedBg === "none" || unusedBg === "").toBe(true);
    await assertNoActorFacesetOnThumb(page, `db-character-row-${unusedId}`, faceIds);

    await page.getByTestId("db-character-display-name").fill("QA호감인물");
    await page.getByTestId("db-character-birthday-enabled").check();
    await expect(page.getByTestId("db-character-birthday-season")).toBeEnabled();
    await page.getByTestId("db-character-birthday-season").selectOption("summer");
    await page.getByTestId("db-character-birthday-day").fill("12");
    await page.getByTestId("db-character-birthday-day").blur();

    const lovedPicker = page.getByTestId("db-character-gift-loved-picker");
    const lovedItemId = await lovedPicker.locator("option").nth(1).getAttribute("value");
    expect(lovedItemId, "fresh project ships items for the gift picker").toBeTruthy();
    await lovedPicker.selectOption(lovedItemId!);
    await page.getByTestId("db-character-gift-loved-add").click();
    await expect(page.getByTestId(`db-character-gift-loved-row-${lovedItemId}`)).toBeVisible();

    await page.getByTestId("db-character-response-loved").fill("고마워!");
    await page.getByTestId("db-character-response-neutral").fill("받았어.");

    await switchTabAnyMode(page, ITEMS_TAB);
    await switchTabAnyMode(page, CHARACTERS_TAB);
    await page.getByTestId(`db-character-row-${unusedId}`).click();

    await expect(page.getByTestId("db-character-display-name")).toHaveValue("QA호감인물");
    await expect(page.getByTestId("db-character-birthday-enabled")).toBeChecked();
    await expect(page.getByTestId("db-character-birthday-season")).toHaveValue("summer");
    await expect(page.getByTestId("db-character-birthday-day")).toHaveValue("12");
    await expect(page.getByTestId(`db-character-gift-loved-row-${lovedItemId}`)).toBeVisible();
    await expect(page.getByTestId("db-character-response-loved")).toHaveValue("고마워!");
    await expect(page.getByTestId("db-character-response-neutral")).toHaveValue("받았어.");
    await expect(page.getByTestId("db-character-usage-empty")).toBeVisible();

    const afterRoundTrip = await exportedCharacters(page);
    expect(afterRoundTrip[unusedId]).toEqual({
      displayName: "QA호감인물",
      birthday: { season: "summer", day: 12 },
      giftPrefs: { loved: [lovedItemId] },
      giftResponses: { loved: "고마워!", neutral: "받았어." },
    });

    await page.getByTestId("db-character-display-name").fill("버릴이름");
    await expect
      .poll(async () => (await exportedCharacters(page))[unusedId]?.displayName, { timeout: 5_000 })
      .toBe("버릴이름");

    const guard = await dirtyGuardOracle(page, "escape");
    expect(guard.promptShown).toBe(true);
    expect(guard.buttons).toEqual([
      "database-dirty-save",
      "database-dirty-discard",
      "database-dirty-keep-editing",
    ]);
    await page.getByTestId("database-dirty-discard").click();
    await expect(page.getByTestId("database-modal")).toBeHidden();

    await expect
      .poll(async () => Object.keys(await exportedCharacters(page)), { timeout: 5_000 })
      .toEqual([]);
    expect((await exportedCharacters(page))[unusedId]).toBeUndefined();

    expect(errors, `unexpected console errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("malformed displayName inputs do not crash, inject DOM, or lose the exact stored value", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await switchTabAnyMode(page, CHARACTERS_TAB);
    const id = await addCharacterProfile(page);

    const cases: readonly { readonly label: string; readonly value: string; readonly stored: string | undefined }[] = [
      { label: "empty", value: BOUNDARY_INPUTS.empty, stored: undefined },
      { label: "whitespace", value: BOUNDARY_INPUTS.whitespace, stored: undefined },
      { label: "longCjk", value: BOUNDARY_INPUTS.longCjk, stored: BOUNDARY_INPUTS.longCjk },
      { label: "emojiZwj", value: BOUNDARY_INPUTS.emojiZwj, stored: BOUNDARY_INPUTS.emojiZwj },
      { label: "htmlInjection", value: BOUNDARY_INPUTS.htmlInjection, stored: BOUNDARY_INPUTS.htmlInjection },
    ];

    for (const entry of cases) {
      await page.getByTestId("db-character-display-name").fill(entry.value);
      await expect
        .poll(async () => (await exportedCharacters(page))[id]?.displayName, { timeout: 5_000 })
        .toBe(entry.stored);

      await switchTabAnyMode(page, ITEMS_TAB);
      await switchTabAnyMode(page, CHARACTERS_TAB);
      await page.getByTestId(`db-character-row-${id}`).click();

      await expect(page.getByTestId("db-characters-workspace")).toBeVisible();
      await expect(page.locator("img[src='x']")).toHaveCount(0);
      const injected = page.locator(
        "[data-testid='db-characters-list'] img[onerror], [data-testid='db-detail-form'] img[onerror]",
      );
      await expect(injected).toHaveCount(0);

      const listName = page.getByTestId(`db-character-row-${id}`).locator(".db-list-name");
      await expect(listName).toHaveText(entry.stored ?? id);
    }

    expect(errors, `unexpected console errors: ${errors.join(" | ")}`).toEqual([]);
  });
});
