import { expect, type Page } from "@playwright/test";

/**
 * 2026-11 톱바 개편 뒤의 진입 경로.
 *
 * 톱바에 남은 것: 프로젝트 메뉴 · 편집 칸(지형/바닥/상위/이벤트) · 자료집 · 소재 · 조수 · 저장 글자 · ▷ 테스트 실행.
 * ⋯ 더 보기는 시안에 없어 걷었다 — 도움말 · 언어 · AI 설정과 세계관·음악·찾기·랜덤 전투·AI 스튜디오·패널 보기·저장 기록·
 * 편집 이름·전체화면은 ⌘K 명령으로만 닿는다. 스펙은 예전 단추 대신 이 두 길을 쓴다.
 */

/** Ctrl+K → 명령 이름 입력 → 그 명령 행을 Enter 로 실행한다. 행 testid 는 `command-palette-item-command-<id>`. */
export async function runPaletteCommand(page: Page, label: string, commandId: string): Promise<void> {
  // 캔버스에 초점이 있어야 전역 단축키가 잡힌다 — 입력칸에 초점이 있으면 Ctrl+K 가 다른 곳으로 간다.
  await page.locator("body").press("Control+K");
  const search = page.getByTestId("command-palette-search");
  await expect(search).toBeVisible();
  await search.fill(label);
  const row = page.getByTestId(`command-palette-item-command-${commandId}`);
  await expect(row).toBeVisible();
  // 결과 첫 행이 Enter 대상이다. 다른 명령이 앞서면 그 행을 가리켜 Enter 대상으로 만든다.
  await row.hover();
  await search.press("Enter");
  await expect(page.getByTestId("command-palette")).toHaveCount(0);
}

export async function openTopbarAiSettings(page: Page): Promise<void> {
  await runPaletteCommand(page, "AI 설정", "topbar-ai-settings");
}

/** 도움말은 ⌘K 「도움말: 단축키 보기」(help-shortcuts) 명령이 단축키 절 도움말 창을 연다. */
export async function openHelpShortcuts(page: Page): Promise<void> {
  await runPaletteCommand(page, "단축키 보기", "help-shortcuts");
}
