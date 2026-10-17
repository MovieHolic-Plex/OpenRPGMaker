// 이어하기/불러오기: 저장 후 새로고침 → 타이틀 메뉴 → 불러오기 패널의 칸 카드(몬스터 요약 줄).
export default async function load({ page, key, shot, choose, railOpen, log }) {
  await page.evaluate(() => {
    const s = window.__oprnHooksScene.getSession();
    s.switches['mx_badge_1'] = true; s.switches['mx_badge_2'] = true; s.playTimeSeconds = 3725;
  });
  await railOpen(); await choose('status-menu-command-save'); await key('Enter'); await page.waitForTimeout(600);
  log.keysBefore = await page.evaluate(() => Object.keys(localStorage));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('title-screen').waitFor({ timeout: 240000 });
  await page.waitForTimeout(1500); await shot('63-title-with-save');
  log.keysAfter = await page.evaluate(() => Object.keys(localStorage));
  log.titleButtons = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="title-"]')].map((n) => n.getAttribute('data-testid')));
  await key('ArrowDown'); await page.waitForTimeout(250); await key('Enter'); await page.waitForTimeout(900); await shot('64-load-panel');
}
