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
