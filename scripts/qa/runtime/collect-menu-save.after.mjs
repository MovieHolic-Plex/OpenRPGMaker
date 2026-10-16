// 저장·불러오기 칸 요약: 저장 한 번 → 저장 화면(칸 1 선택 시 안내창에 상세) → 불러오기 화면(카드의 요약 줄).
export default async function save({ page, key, shot, choose, railOpen, log }) {
  await page.evaluate(() => {
    const s = window.__oprnHooksScene.getSession();
    s.switches['mx_badge_1'] = true; s.switches['mx_badge_2'] = true;
    s.playTimeSeconds = 3725;
  });
  await railOpen(); await choose('status-menu-command-save'); await shot('60-save-before');
  await key('Enter'); await page.waitForTimeout(500);
  await page.waitForTimeout(300); await shot('61-save-written-cursor-slot1');
  log.slotText = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="save-slot-"]')].map((n) => n.textContent));
  await key('Escape'); await page.waitForTimeout(300);
  // 불러오기: 메뉴의 로드 항목이 있으면 거기서, 없으면 플레이어 불러오기 패널을 직접 연다.
  const loadCmd = await page.getByTestId('status-menu-command-load').count();
  log.hasLoadCommand = loadCmd;
  if (loadCmd) { await railOpen(); await choose('status-menu-command-load'); await shot('62-load-slots'); }
}
