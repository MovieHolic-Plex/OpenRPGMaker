/**
 * clear_map 사용자 허가 모달 증거 (실제 에디터 표면, 실측 수치).
 *
 * 무엇을 증명하나:
 *  - 파괴적 맵 청소를 적용하려 할 때 **적용 직전에 사용자 허가 모달이 뜬다** — 2026-09
 *    "변경 확인 팝업 없음" 정책에서 맵 규모 파괴만 예외로 둔 표면이다
 *    (근거: src/ai/mapDestructionConfirm.ts 머리말).
 *  - 모달 문안의 맵 이름·칸 수는 **모델 문장이 아니라 툴 실행 결과**에서 온다 — 여기서는
 *    실제 `clear_map` 을 드라이런으로 돌린 결과를 그대로 넣는다(프로젝트는 안 바뀐다).
 *  - **[그만두기] 는 프로젝트를 건드리지 않는다** — 모달 문구가 아니라 타일 값으로 확인한다.
 *    취소는 되돌리기가 아니라 "아무 일도 일어나지 않음"이다.
 *  - 확정 버튼은 위험색(danger)이고 초점을 받는다 — 실수로 누르는 경로를 줄이는 표시.
 *
 * 하지 않는 것: AI 턴 전체(플래너 → 툴 → 검수 → 적용)의 대본화. 그 경로는 수용 기준
 * (request coverage)과 독립 검수 증거를 함께 스크립트해야 하는데, 저장소의 기존 e2e 에
 * 그 프로토콜을 태우는 스펙이 없다(정본은 vitest 하네스다). 여기서는 **패널이 아닌 표면**을
 * 검증하고, 패널 ↔ 모달 배선은 `test/clearMapPanelApproval.test.ts` 가, 승인 없는 적용
 * 거부는 `test/clearMapApproval.test.ts` 가 각각 실제 코드 경로로 지킨다.
 *
 * 실행:
 *   DEV_SERVER_PORT=$(grep '^DEV_SERVER_PORT=' .env.local | cut -d= -f2) \
 *     npx playwright test test/e2e/clear-map-approval.spec.ts --project=chromium
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const EVIDENCE = path.resolve(".omo/evidence/clear-map-approval");
const CONFIRM_MODAL = "[data-testid='app-confirm-modal']";
const CONFIRM_MESSAGE = "[data-testid='app-confirm-modal'] .app-modal-message";
const CONFIRM_BUTTON = "[data-testid='app-modal-confirm']";
const CANCEL_BUTTON = "[data-testid='app-modal-cancel']";

/** 빈 프로젝트 맵의 기본 바닥(잔디). 청소 결과가 돌아오는 값. */
const GRASS = 240;
const PATCH = { from: { x: 5, y: 5 }, to: { x: 9, y: 9 } };
const CENTER = { x: 7, y: 7 };

mkdirSync(EVIDENCE, { recursive: true });

type HarnessWindow = Window & {
  __oprnEditorTool?: (name: string, args: Record<string, unknown>) => { ok: boolean; summary: string };
  __oprnRegionTaskHarness?: {
    currentMapId: () => string;
    readCell: (mapId: string, layer: string, x: number, y: number) => number | null;
  };
};

async function bootEditor(page: Page): Promise<string> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  // 워크트리들이 node_modules/.vite 캐시를 공유해서, 다른 세션이 dev 서버를 띄우면 이쪽 서버가
  // 의존성을 재최적화하며 모듈 요청을 끊는다 — 그때는 캔버스가 안 붙으므로 다시 로드한다.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible().catch(() => false)) await guest.click();
    await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 15_000 });
    const booted = await page
      .getByTestId("edit-canvas")
      .waitFor({ state: "visible", timeout: attempt === 3 ? 60_000 : 25_000 })
      .then(() => true)
      .catch(() => false);
    if (booted) break;
    if (attempt === 3) throw new Error("dev 서버가 세 번 시도해도 편집 캔버스를 띄우지 못했다");
    await page.waitForTimeout(4_000);
  }
  const mapId = await page.evaluate(() => (window as unknown as HarnessWindow).__oprnRegionTaskHarness?.currentMapId());
  expect(mapId, "편집 하네스가 현재 맵을 노출해야 한다").toBeTruthy();
  return String(mapId);
}

/** 청소 여부가 눈에 보이도록 맵 가운데를 칠한다(편집기 훅 = 실제 store 반영 경로). */
async function paintPatch(page: Page, mapId: string): Promise<void> {
  const result = await page.evaluate(({ id, from, to }) => {
    const hook = (window as unknown as HarnessWindow).__oprnEditorTool;
    if (!hook) throw new Error("window.__oprnEditorTool 미등록");
    return hook("paint_tiles", { mapId: id, layer: "lower", mode: "rect", from, to, tile: 360 });
  }, { id: mapId, from: PATCH.from, to: PATCH.to });
  expect(result.ok, `흙길 사전 칠 실패: ${result.summary}`).toBe(true);
}

function readCell(page: Page, mapId: string, x: number, y: number): Promise<number | null> {
  return page.evaluate(({ id, cx, cy }) => {
    const harness = (window as unknown as HarnessWindow).__oprnRegionTaskHarness;
    return harness ? harness.readCell(id, "lower", cx, cy) : null;
  }, { id: mapId, cx: x, cy: y });
}

/**
 * 실제 툴(드라이런) → 실제 허가 페이로드 → 실제 모달. 프로젝트는 건드리지 않는다.
 * 모달이 resolve 될 때까지 기다리지 않고 즉시 반환한다 — 스펙이 버튼을 눌러 결과를 본다.
 */
async function openApprovalModal(page: Page, mapId: string): Promise<void> {
  await page.evaluate(async ({ id }) => {
    const load = async (specifier: string): Promise<Record<string, unknown>> =>
      (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
    const changeset = await load("/src/editor/tools/applyChangesetToStore.ts");
    const confirm = await load("/src/ai/mapDestructionConfirm.ts");
    const modal = await load("/src/editor/ui/modal.ts");

    const previewTool = changeset.previewTool as (
      name: string,
      args: Record<string, unknown>,
    ) => { ok: boolean; summary: string; issues?: readonly { message: string }[] };
    const request = confirm.mapDestructionConfirmRequest as (
      calls: readonly unknown[],
    ) => { title: string; message: string; confirmLabel: string } | null;
    const showConfirm = modal.showConfirm as (options: Record<string, unknown>) => Promise<boolean>;

    // 드라이런 — 실제 clear_map 실행 결과(맵 이름·칸 수)를 근거로 쓴다.
    const result = previewTool("clear_map", { mapId: id, confirmDestroy: true });
    if (!result.ok) throw new Error(`clear_map 드라이런 실패: ${result.summary}`);
    const call = { name: "clear_map", args: { mapId: id, confirmDestroy: true }, summary: result.summary, result, destructive: true };
    const payload = request([call]);
    if (!payload) throw new Error("허가 요청이 만들어지지 않았다");
    void showConfirm({ ...payload, cancelLabel: "그만두기", danger: true });
  }, { id: mapId });
}

test.describe("clear_map 사용자 허가 모달", () => {
  test.describe.configure({ timeout: 240_000 });

  test("실제 툴 결과로 문안을 만들고, [그만두기] 는 프로젝트를 건드리지 않는다", async ({ page }) => {
    const mapId = await bootEditor(page);
    await paintPatch(page, mapId);
    const before = await readCell(page, mapId, CENTER.x, CENTER.y);
    // 흙길(360)은 오토타일 그룹이라 결과 타일이 변형된다 — 값이 아니라 "잔디가 아님"을 고정한다.
    expect(before, "사전 칠이 실제 타일로 반영돼야 한다").not.toBe(GRASS);
    expect(before).not.toBeNull();

    await openApprovalModal(page, mapId);

    await expect(page.locator(CONFIRM_MODAL)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`${CONFIRM_MODAL} .app-modal-card`)).toHaveAttribute("aria-modal", "true");
    const message = await page.locator(CONFIRM_MESSAGE).innerText();
    expect(message).toContain("맵 하나의 타일을 전부 비우려 합니다");
    expect(message).toContain("칸");
    // 확정 버튼은 위험색이다 — 실수로 누르는 경로를 줄이는 표시.
    await expect(page.locator(CONFIRM_BUTTON)).toHaveClass(/is-danger/);
    // 기본 초점은 취소다(showConfirm 은 첫 버튼에 초점을 준다) — Enter 연타가 파괴로 이어지지 않는다.
    await expect(page.locator(CANCEL_BUTTON)).toBeFocused();
    await page.screenshot({ path: path.join(EVIDENCE, "01-approval-modal.png"), animations: "disabled" });

    await page.locator(CANCEL_BUTTON).click();
    await expect(page.locator(CONFIRM_MODAL)).toHaveCount(0);
    // 취소는 되돌리기가 아니라 무변경이다 — 타일 값으로 확인한다.
    expect(await readCell(page, mapId, CENTER.x, CENTER.y)).toBe(before);
    await page.screenshot({ path: path.join(EVIDENCE, "02-cancelled-unchanged.png"), animations: "disabled" });
  });

  test("확정 버튼은 실제로 resolve 되고, 그때도 모달 자체는 아무것도 바꾸지 않는다", async ({ page }) => {
    const mapId = await bootEditor(page);
    await paintPatch(page, mapId);
    const before = await readCell(page, mapId, CENTER.x, CENTER.y);

    await openApprovalModal(page, mapId);
    await expect(page.locator(CONFIRM_MODAL)).toBeVisible({ timeout: 30_000 });
    await page.locator(CONFIRM_BUTTON).click();
    await expect(page.locator(CONFIRM_MODAL)).toHaveCount(0);

    // 모달은 승낙만 받는다 — 실제 변경은 허가 뒤 적용 경로가 한다(이 스펙은 그 경계를 고정한다).
    expect(await readCell(page, mapId, CENTER.x, CENTER.y)).toBe(before);
    await page.screenshot({ path: path.join(EVIDENCE, "03-confirmed-no-implicit-change.png"), animations: "disabled" });
  });
});
