/**
 * 조수 채팅창 변경 카드(before/after) + 넓은 비교 뷰어 — 실 브라우저 증거.
 *
 * 라이브 LLM 없이 프로덕션 렌더 경로만으로 증명한다:
 *  1) 대화 기록(oprn:ai-conversations)에 사용자·조수·툴 항목이 든 레코드를 심고 새로 고치면
 *     패널이 스스로 복원해(renderConversationEntry) 실제 턴과 같은 로그를 그린다.
 *  2) 실제 프로젝트(store)에서 before 를 읽고 타일을 실제로 바꾼 after 로 변경 카드를 붙인다.
 * 주입하는 것은 "AI 가 방금 이걸 했다"는 사실뿐이고, 렌더·캔버스·뷰어는 전부 제품 코드다.
 *
 * 실행:
 *   DEV_SERVER_PORT=9187 npx playwright test test/e2e/assistant-change-preview.spec.ts --project=chromium
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const EVIDENCE = path.resolve(".omo/evidence/assistant-modern");
const UI_MODE_KEY = "oprn:editor-ui-mode";
const COACH_KEY = "oprn:coachmarks-basic-v1";
const CONVERSATION_KEY = "oprn:ai-conversations";
const WIDE = { width: 1920, height: 1080 } as const;

mkdirSync(EVIDENCE, { recursive: true });

async function bootEditor(page: Page): Promise<void> {
  await page.goto("/?freshProject=1");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  const welcome = page.getByTestId("standard-welcome-start");
  if (await welcome.isVisible({ timeout: 3_000 }).catch(() => false)) await welcome.click();
}

async function seedConversationRecord(page: Page, storageKey: string): Promise<string> {
  return await page.evaluate(async (key) => {
    const load = async <T>(url: string): Promise<T> => (await import(/* @vite-ignore */ url)) as T;
    const { store } = await load<typeof import("@/project/store")>("/src/project/store.ts");
    const { conversationScopeKey } = await load<typeof import("@/ai/conversationStore")>(
      "/src/ai/conversationStore.ts",
    );
    const contextKey = conversationScopeKey(store.getProjectIdentity(), store.getCurrent());
    const record = {
      id: "qa-change-preview",
      title: "광장에 길을 이어줘",
      model: "qa-fixture",
      savedAt: Date.now(),
      projectContextKey: contextKey,
      entries: [
        { kind: "user", text: "마을 중앙에 광장을 만들고 길을 이어줘" },
        { kind: "tool", name: "get_map_info", args: {}, ok: true, summary: "맵 100×100 · 이벤트 20" },
        { kind: "tool", name: "build_plaza", args: {}, ok: true, summary: "광장 8×6 · 타일 48칸" },
        { kind: "tool", name: "connect_road", args: {}, ok: true, summary: "길 14칸 연결" },
        { kind: "assistant", text: "마을 중앙에 광장을 깔고 남쪽 길과 이었습니다." },
      ],
    };
    localStorage.setItem(key, JSON.stringify([record]));
    return contextKey;
  }, storageKey);
}

async function mountRealChangeCard(page: Page): Promise<{ mounted: boolean; region: string; reason: string }> {
  return await page.evaluate(async () => {
    const load = async <T>(url: string): Promise<T> => (await import(/* @vite-ignore */ url)) as T;
    const [{ store }, preview] = await Promise.all([
      load<typeof import("@/project/store")>("/src/project/store.ts"),
      load<typeof import("@/editor/panels/aiChangePreview")>("/src/editor/panels/aiChangePreview.ts"),
    ]);
    const before = store.getCurrent();
    const mapId = before.startMapId ?? Object.keys(before.maps)[0];
    const map = before.maps[mapId];
    if (!map) return { mounted: false, region: "", reason: "no map" };

    // 눈에 보이는 차이를 만든다: 맵에서 가장 흔한 하단 타일을 중앙 8x6 사각형에 칠한다
    // (그 영역이 이미 그 타일이면 그다음으로 흔한 타일).
    const counts = new Map<number, number>();
    for (const tile of map.lowerTiles) if (tile > 0) counts.set(tile, (counts.get(tile) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tile]) => tile);
    if (ranked.length === 0) return { mounted: false, region: "", reason: "empty map" };
    const rectW = Math.min(8, map.width);
    const rectH = Math.min(6, map.height);
    const x0 = Math.max(0, Math.floor((map.width - rectW) / 2));
    const y0 = Math.max(0, Math.floor((map.height - rectH) / 2));
    const centerTile = map.lowerTiles[y0 * map.width + x0];
    const paint = ranked.find((tile) => tile !== centerTile) ?? ranked[0];
    const after = structuredClone(before);
    const afterMap = after.maps[mapId];
    for (let y = y0; y < y0 + rectH; y += 1) {
      for (let x = x0; x < x0 + rectW; x += 1) afterMap.lowerTiles[y * map.width + x] = paint;
    }

    const region = preview.changePreviewRegion(before, after, mapId);
    const card = preview.renderChangePreviewCard({
      before,
      after,
      mapId,
      title: `광장 바닥 ${rectW}×${rectH} · 길 14칸`,
      detail: "build_plaza · connect_road",
      chips: preview.changePreviewChips({
        tilesChanged: rectW * rectH + 14,
        eventsAdded: 1,
        eventsModified: 0,
        eventsRemoved: 0,
        mapsAdded: 0,
        mapsRemoved: 0,
        dbRecordsChanged: 0,
        tilesetsChanged: 0,
        switchesAdded: 0,
        variablesAdded: 0,
        worldEntitiesAdded: 0,
        worldEntitiesModified: 0,
        palettePresetsAdded: 0,
        palettePresetsModified: 0,
        endingsChanged: 0,
        sessionChanged: false,
        systemChanged: false,
        warnings: [],
      }),
      onUndo: () => {},
    });
    const log = [...document.querySelectorAll(".ai-chat-log")].find((node) => node.getClientRects().length > 0)
      ?? document.querySelector(".ai-chat-log");
    if (!log) return { mounted: false, region: "", reason: "no chat log" };
    log.append(card);
    card.scrollIntoView();
    return { mounted: true, region: region ? `${region.width}x${region.height}` : "", reason: "ok" };
  });
}

/**
 * 지도 그림이 **같아지는** 변경(맵 밖 — 프로젝트 정보·퀘스트·설정)의 카드.
 * 두 캔버스는 타일과 이벤트 좌표만 그리므로 그런 변경에서는 같은 그림 두 장이 된다 —
 * 그때 카드는 「지금 / 적용 후」 대신 사실 한 줄과 영역 이름을 보여준다.
 */
async function mountNonMapChangeCard(page: Page): Promise<{ mounted: boolean; reason: string }> {
  return await page.evaluate(async () => {
    const load = async <T>(url: string): Promise<T> => (await import(/* @vite-ignore */ url)) as T;
    const [{ store }, preview, areas] = await Promise.all([
      load<typeof import("@/project/store")>("/src/project/store.ts"),
      load<typeof import("@/editor/panels/aiChangePreview")>("/src/editor/panels/aiChangePreview.ts"),
      load<typeof import("@/project/changeAreas")>("/src/project/changeAreas.ts"),
    ]);
    const before = store.getCurrent();
    const mapId = before.startMapId ?? Object.keys(before.maps)[0];
    if (!mapId) return { mounted: false, reason: "no map" };
    const after = structuredClone(before);
    after.meta = { ...after.meta, title: `${after.meta?.title ?? "게임"} (개정)` };

    const card = preview.renderChangePreviewCard({
      before,
      after,
      mapId,
      title: "게임 제목을 바꿨습니다",
      chips: preview.changeChipsWithAreas(undefined, areas.changedAreaLabels(before, after)),
    });
    const log = [...document.querySelectorAll(".ai-chat-log")].find((node) => node.getClientRects().length > 0)
      ?? document.querySelector(".ai-chat-log");
    if (!log) return { mounted: false, reason: "no chat log" };
    log.append(card);
    card.scrollIntoView();
    return { mounted: true, reason: "ok" };
  });
}

test.describe("조수 변경 카드 + 넓은 비교 뷰어", () => {
  test.describe.configure({ timeout: 180_000 });

  test("적용된 변경이 before/after 카드로 보이고 넓은 화면으로 열린다", async ({ page }) => {
    await page.setViewportSize({ width: WIDE.width, height: WIDE.height });
    await page.addInitScript(({ uiModeKey, coachKey }) => {
      localStorage.setItem(uiModeKey, "standard");
      localStorage.setItem(coachKey, "1");
    }, { uiModeKey: UI_MODE_KEY, coachKey: COACH_KEY });

    await bootEditor(page);
    const contextKey = await seedConversationRecord(page, CONVERSATION_KEY);
    expect(contextKey.length).toBeGreaterThan(0);

    await bootEditor(page);

    // 접혀 부팅했으면 복귀 알약으로 펼친다. (구 유리 카드의 본문 접힘 `is-glass-folded` 은
    // 도크 축과 함께 2026-08-31 에 삭제됐다 — 접힘 축은 `is-collapsed` 하나다.)
    const restore = page.getByTestId("ai-collapsed-restore");
    if (await restore.isVisible().catch(() => false)) await restore.click();
    await expect(page.getByTestId("ai-panel")).not.toHaveClass(/is-collapsed/);

    // 펼친 뒤 복원된 대화는 추가 조작 없이 보여야 한다 — 이전엔 패널이 유휴 상태로
    // 남아 .ai-glass-log 가 display:none 이라 복원된 대화가 보이지 않았다.
    const userRow = page.getByTestId("ai-command-row-user").first();
    await expect(userRow).toBeVisible({ timeout: 20_000 });

    // 스킬 표면이 제품에서 사라졌다는 실 브라우저 증거.
    expect(await page.locator("[data-testid='ai-skill-drawer']").count()).toBe(0);
    expect(await page.locator("[data-testid='ai-skill-toggle']").count()).toBe(0);
    await page.getByTestId("ai-input").fill("/");
    expect(await page.locator("[data-testid='ai-slash-list']").count()).toBe(0);
    await page.getByTestId("ai-input").fill("");

    // 툴 호출은 접힌 한 줄 요약이어야 한다(펼치기 어포던스는 있다).
    const toolToggle = page.getByTestId("ai-tool-activity-toggle").first();
    await expect(toolToggle).toBeVisible();
    await expect(page.locator(".ai-tool-activity-list").first()).toBeHidden();

    const mount = await mountRealChangeCard(page);
    expect(mount.reason).toBe("ok");
    expect(mount.mounted).toBe(true);

    const card = page.getByTestId("ai-change-card");
    await expect(card).toBeVisible();
    const beforeShot = page.getByTestId("ai-change-shot-before").locator("canvas");
    const afterShot = page.getByTestId("ai-change-shot-after").locator("canvas");
    await expect(beforeShot).toBeVisible();
    await expect(afterShot).toBeVisible();
    await expect(page.getByTestId("ai-change-undo")).toBeVisible();

    // 두 캔버스가 실제로 다른 그림이어야 한다 — 같으면 before/after 가 증거가 아니다.
    const [beforePng, afterPng] = await Promise.all([
      beforeShot.evaluate((node: HTMLCanvasElement) => node.toDataURL("image/png")),
      afterShot.evaluate((node: HTMLCanvasElement) => node.toDataURL("image/png")),
    ]);
    expect(beforePng.length).toBeGreaterThan(1_000);
    expect(afterPng).not.toBe(beforePng);

    // 변경 카드가 툴 활동보다 큰 면적을 차지해야 한다 — "무엇이 바뀌었나"가 주인공.
    const cardBox = await card.boundingBox();
    const toolBox = await page.locator(".ai-tool-activity").first().boundingBox();
    expect((cardBox?.height ?? 0)).toBeGreaterThan((toolBox?.height ?? 0) * 2);

    await page.screenshot({ path: path.join(EVIDENCE, "change-card-inline-1920.png"), animations: "disabled" });

    // 넓게 보기 — 좁은 패널을 벗어난 전체 화면 비교.
    await page.getByTestId("ai-change-expand").click();
    const wide = page.getByTestId("ai-change-wide");
    await expect(wide).toBeVisible();
    const wideBox = await wide.boundingBox();
    expect(wideBox?.width ?? 0).toBeGreaterThan(WIDE.width * 0.9);
    await expect(wide.locator(".ai-change-wide-body[data-mode='side']")).toHaveCount(1);
    await page.screenshot({ path: path.join(EVIDENCE, "change-wide-side-1920.png"), animations: "disabled" });

    await page.getByTestId("ai-change-wide-mode-overlay").click();
    await expect(wide.locator(".ai-change-wide-body[data-mode='overlay']")).toHaveCount(1);
    await page.getByTestId("ai-change-wide-slider").fill("35");
    await page.screenshot({ path: path.join(EVIDENCE, "change-wide-overlay-1920.png"), animations: "disabled" });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("ai-change-wide")).toHaveCount(0);
    await expect(card).toBeVisible();
  });

  test("지도 밖 변경은 같은 그림 두 장 대신 사실 한 줄과 영역 이름으로 보인다", async ({ page }) => {
    await page.setViewportSize({ width: WIDE.width, height: WIDE.height });
    await page.addInitScript(({ uiModeKey, coachKey }) => {
      localStorage.setItem(uiModeKey, "standard");
      localStorage.setItem(coachKey, "1");
    }, { uiModeKey: UI_MODE_KEY, coachKey: COACH_KEY });

    await bootEditor(page);
    // 대화 기록을 심고 다시 부팅한다 — 빈 대화에서는 패널이 유휴라 로그가 display:none 이고,
    // 그래서 카드도 "숨김" 이 된다(첫 테스트와 같은 조건을 만든다).
    expect((await seedConversationRecord(page, CONVERSATION_KEY)).length).toBeGreaterThan(0);
    await bootEditor(page);
    const restore = page.getByTestId("ai-collapsed-restore");
    if (await restore.isVisible().catch(() => false)) await restore.click();
    await expect(page.getByTestId("ai-panel")).not.toHaveClass(/is-collapsed/);

    const mount = await mountNonMapChangeCard(page);
    expect(mount.reason).toBe("ok");
    expect(mount.mounted).toBe(true);

    const card = page.getByTestId("ai-change-card");
    await expect(card).toBeVisible();
    // 캔버스를 아예 만들지 않는다 — 같은 그림을 두 번 그리면 "아무 일도 없었다" 로 읽힌다.
    expect(await card.locator("canvas").count()).toBe(0);
    expect(await page.getByTestId("ai-change-pair").count()).toBe(0);
    expect(await page.getByTestId("ai-change-expand").count()).toBe(0);
    await expect(page.getByTestId("ai-change-word-diff")).toBeVisible();
    // 무엇이 바뀌었는지는 이름이 나른다 — 카운터 목록에 축이 없는 영역도 여기 남는다.
    await expect(card.locator(".ai-change-chip").first()).toHaveText("프로젝트 정보");

    await page.screenshot({ path: path.join(EVIDENCE, "change-card-non-map-1920.png"), animations: "disabled" });
  });
});
