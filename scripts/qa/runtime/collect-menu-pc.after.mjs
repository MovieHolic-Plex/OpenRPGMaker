// 필드의 PC 이벤트: 말을 걸면 보관함 화면이 단독으로 열리고, Esc 로 닫으면 이벤트가 이어진다. (QA_PROJECT_PATCH 로 PC 이벤트를 심은 프로젝트)
export default async function pc({ page, key, shot, log, drain }) {
  await page.evaluate(() => window.__oprnDebug.teleport('mx_map_lab', 7, 6)); await page.waitForTimeout(800);
  await page.evaluate(() => window.__oprnInput.face('right'));
  await key('z'); await page.waitForTimeout(400);
  await shot('50-pc-line');
  await key('z'); await page.waitForTimeout(900);
  log.pcMenuOpen = await page.getByTestId('main-menu').count();
  await shot('51-pc-box-opened');
  await key('Escape'); await page.waitForTimeout(700);
  log.pcMenuAfterEsc = await page.getByTestId('main-menu').count();
  await shot('52-pc-closed-event-continues');
  await key('z'); await page.waitForTimeout(300);
  await shot('53-pc-closing-line');
}
