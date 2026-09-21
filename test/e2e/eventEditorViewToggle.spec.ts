// 목록 / 스토리 / 미리보기 3뷰 토글의 브라우저 회귀. 여기 있는 것들은 happy-dom 이
// 잡을 수 없다 — 쌓임 문맥과 실제 히트 테스트가 걸려 있기 때문이다.
import { expect, test } from "@playwright/test";
import { mockupProject } from "./mockupProbeSeeds";
import { seedProjectForEditor } from "./projectSeed";

test.setTimeout(120_000);

async function commandKinds(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(async () => {
    const s = await import("/src/project/store.ts");
    const cur = s.store.getCurrent();
    const ev = cur.maps[cur.startMapId]?.events?.[0];
    return (ev?.pages?.[0]?.commands ?? []).map((c: { kind: string }) => c.kind);
  });
}

test("스토리 보기에서 고른 명령이 인스펙터·툴바에 그대로 이어진다", async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 1000 });
  const { project, eventId } = mockupProject();
  await seedProjectForEditor(page, project);
  await page.evaluate(
    async ({ mapId, id }) => {
      const m = await import("/src/editor/panels/eventEditor/modal.ts");
      m.openEventEditorModal(mapId, id);
    },
    { mapId: project.startMapId, id: eventId },
  );
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();

  await editor.getByTestId("event-view-toggle-storyboard").click();
  const cards = editor.locator(".event-storyboard > [data-cmd-path]");
  await expect(cards.nth(1)).toBeVisible();

  // D2 — 카드 한 번 클릭은 선택이다. 편집 창이 튀어나오지 않고 인스펙터가 채워진다.
  await cards.nth(1).click();
  const inspector = editor.getByTestId("event-editor-inspector");
  await expect(inspector).toBeVisible();
  await expect(inspector).toHaveAttribute("data-command-path", "[1]");
  await expect(page.getByTestId("event-command-edit-dialog")).toHaveCount(0);

  const before = await commandKinds(page);
  expect(before.length).toBeGreaterThan(1);

  // D3 — 편집 팝오버가 무엇에 적용되는지 말하고, 그 버튼이 실제로 눌린다.
  await editor.getByTestId("event-command-edit-menu").locator(":scope > summary").click();
  const editTarget = editor.getByTestId("event-command-edit-target");
  await expect(editTarget).toHaveAttribute("data-state", "selected");
  await expect(editTarget).toContainText("2번째");

  const moveUp = editor.getByTestId("event-command-toolbar-move-up");
  await expect(moveUp).toBeEnabled();
  // 팝오버가 스토리 카드에 가려지면 이 클릭이 타임아웃한다(툴바가 쌓임 문맥을 만들던 결함).
  await moveUp.click({ timeout: 5000 });
  await expect.poll(() => commandKinds(page)).toEqual([before[1], before[0], ...before.slice(2)]);
});

test("미리보기는 편집을 견디고, 검색은 못 하는 척하지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 1000 });
  const { project, eventId } = mockupProject();
  await seedProjectForEditor(page, project);
  await page.evaluate(
    async ({ mapId, id }) => {
      const m = await import("/src/editor/panels/eventEditor/modal.ts");
      m.openEventEditorModal(mapId, id);
    },
    { mapId: project.startMapId, id: eventId },
  );
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();

  // D4 — 검색은 목록과 스토리 양쪽에 걸린다.
  const search = editor.getByTestId("event-command-search");
  await search.fill("선택지");
  await expect(editor.getByTestId("event-command-search-count")).toContainText("일치");
  const hiddenInList = await editor.evaluate(
    (root) => Array.from(root.querySelectorAll<HTMLElement>(".cmd-list [data-cmd-path]")).filter((n) => n.hidden).length,
  );
  const hiddenInStory = await editor.evaluate(
    (root) =>
      Array.from(root.querySelectorAll<HTMLElement>(".event-storyboard [data-cmd-path]")).filter((n) => n.hidden).length,
  );
  expect(hiddenInList).toBeGreaterThan(0);
  expect(hiddenInStory).toBe(hiddenInList);
  await editor.getByTestId("event-command-search-clear").click();
  await expect(search).toHaveValue("");

  // D1 — 미리보기 중에 명령이 늘어도 미리보기에 남는다.
  await editor.getByTestId("event-view-toggle-preview").click();
  await expect(editor.getByTestId("event-page-preview")).toBeVisible();
  // D4 — 미리보기에서는 검색칸이 정직하게 꺼진다.
  await expect(search).toBeDisabled();
  await expect(search).toHaveAttribute("title", /미리보기/);

  await page.evaluate(async () => {
    const s = await import("/src/project/store.ts");
    const p = await import("/src/editor/eventPages.ts");
    const cur = s.store.getCurrent();
    const mapId = cur.startMapId;
    const ev = cur.maps[mapId]?.events?.[0];
    const pageId = ev?.pages?.[0]?.id;
    if (!ev || !pageId) throw new Error("seed shape changed");
    p.addEventPageCommand(mapId, ev.id, pageId, { kind: "text", body: "미리보기 유지 확인" });
  });

  // 보기 세그먼트는 tablist 다 — 「여럿 중 하나」라 선택 상태는 aria-selected 로 말한다.
  // (예전엔 aria-pressed 였는데 그건 각자 켜지고 꺼지는 토글 버튼의 속성이다.)
  await expect(editor.getByTestId("event-view-toggle-preview")).toHaveAttribute("aria-selected", "true");
  await expect(editor.getByTestId("event-page-preview")).toBeVisible();
});
