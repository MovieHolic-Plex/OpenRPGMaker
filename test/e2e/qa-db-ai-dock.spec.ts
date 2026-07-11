import { expect, test, type Page } from "@playwright/test";

// DB 3파 — M7(모달 안 AI 연결) · M8(사이드 도킹) E2E.
// 실 LLM 호출은 하지 않는다: 전송 함수 도달은 window.__rpgzzuDbAiLastRequest 훅과
// 토스트로 검증한다(API 키 미설정 환경에서는 채팅 파이프라인이 설정 모달을 연다 —
// 그것 자체가 파이프라인 도달의 증거다).

async function gotoExpertEditor(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
}

async function openDatabase(page: Page): Promise<void> {
  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
}

test.describe("QA — DB 모달 AI 바 (M7)", () => {
  test("AI 버튼 → 바 표시 → 입력 → 실행 → 훅/토스트", async ({ page }) => {
    await gotoExpertEditor(page);
    await openDatabase(page);
    await page.getByTestId("db-tab-enemies").click();

    await expect(page.getByTestId("database-ai-bar")).toBeHidden();
    await page.getByTestId("database-ai-toggle").click();
    await expect(page.getByTestId("database-ai-bar")).toBeVisible();

    await page.getByTestId("database-ai-input").fill("이 몬스터 스탯을 중반 밸런스로 맞춰줘");
    await page.getByTestId("database-ai-run").click();

    // 전송 함수 도달 훅: 사용자 텍스트 + 컨텍스트 풋터(탭 라벨/선택 레코드) 한 줄.
    const message = await page.evaluate(
      () => (window as { __rpgzzuDbAiLastRequest?: { message: string } }).__rpgzzuDbAiLastRequest?.message ?? ""
    );
    expect(message).toContain("이 몬스터 스탯을 중반 밸런스로 맞춰줘");
    expect(message).toContain("[컨텍스트] 데이터베이스 DB 탭: 몬스터");
    expect(message).toContain("선택 레코드:");

    // 토스트: 전달 안내(키 미설정 환경에서는 실패 안내로 덮일 수 있다 — 둘 다 도달 증거).
    await expect(page.getByTestId("toast")).toContainText(/AI에게 전달했습니다|AI 전달 실패/);

    // 입력은 비워지고 바는 열려 있다. 닫기 버튼으로 접힌다.
    await expect(page.getByTestId("database-ai-input")).toHaveValue("");
    await page.getByTestId("database-ai-close").click();
    await expect(page.getByTestId("database-ai-bar")).toBeHidden();
  });
});

test.describe("QA — DB 모달 사이드 도킹 (M8)", () => {
  test("도크 전환 → 맵 캔버스가 포인터를 받는다 → 창 모드 복원", async ({ page }) => {
    await gotoExpertEditor(page);
    await openDatabase(page);

    const windowEl = page.locator(".database-modal-window");
    await expect(windowEl).toHaveAttribute("aria-modal", "true");

    await page.getByTestId("database-dock-toggle").click();
    await expect(page.getByTestId("database-modal")).toHaveClass(/is-docked/);
    await expect(windowEl).toHaveAttribute("role", "complementary");
    expect(await windowEl.getAttribute("aria-modal")).toBeNull();

    // 왼쪽 노출 영역에서 맵 캔버스가 최상위다(백드롭이 포인터를 가로채지 않는다).
    const canvas = page.locator("[data-testid='edit-canvas'] canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("missing editor canvas");
    const px = Math.floor(box.x + Math.min(box.width * 0.2, 160));
    const py = Math.floor(box.y + box.height / 2);
    const topElement = await page.evaluate(([x, y]) => {
      const hit = document.elementFromPoint(x ?? 0, y ?? 0);
      return {
        isCanvas: hit instanceof HTMLCanvasElement,
        inEditCanvas: Boolean(hit?.closest("[data-testid='edit-canvas']")),
      };
    }, [px, py]);
    expect(topElement.isCanvas || topElement.inEditCanvas).toBe(true);

    // Phaser 입력 도달: 캔버스 호버로 상태줄 좌표가 "outside" → 실제 좌표로 바뀐다.
    await page.mouse.move(px, py);
    await page.mouse.move(px + 40, py + 24);
    await expect.poll(async () => (await page.getByTestId("cursor-position").textContent()) ?? "").not.toBe("outside");

    // 캔버스 클릭도 도크를 닫지 않는다(도크에서 바깥 클릭 닫기 비활성).
    await page.mouse.click(px, py);
    await expect(page.getByTestId("database-modal")).toBeVisible();
    await expect(page.getByTestId("database-modal")).toHaveClass(/is-docked/);

    // 창 모드 복원: aria/클래스 원상 + 백드롭이 다시 포인터를 가로챈다.
    await page.getByTestId("database-dock-toggle").click();
    await expect(page.getByTestId("database-modal")).not.toHaveClass(/is-docked/);
    await expect(windowEl).toHaveAttribute("role", "dialog");
    await expect(windowEl).toHaveAttribute("aria-modal", "true");
    const blockedByBackdrop = await page.evaluate(([x, y]) => {
      const hit = document.elementFromPoint(x ?? 0, y ?? 0);
      return Boolean(hit?.closest("[data-testid='database-modal']"));
    }, [px, py]);
    expect(blockedByBackdrop).toBe(true);
  });

  test("도크 상태는 localStorage 에 저장되어 다음 오픈에 복원된다", async ({ page }) => {
    await gotoExpertEditor(page);
    await openDatabase(page);
    await page.getByTestId("database-dock-toggle").click();
    await expect(page.getByTestId("database-modal")).toHaveClass(/is-docked/);

    // Escape 는 도크에서도 닫기로 동작한다.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("database-modal")).toBeHidden();

    await openDatabase(page);
    await expect(page.getByTestId("database-modal")).toHaveClass(/is-docked/);
    await expect(page.locator(".database-modal-window")).toHaveAttribute("role", "complementary");
  });
});
