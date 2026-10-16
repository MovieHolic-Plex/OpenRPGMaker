// 별명·성별·색이 다른 개체: 요약 → 관리 쪽 → 별명 바꾸기(입력) → 확정/취소. QA_PROJECT_PATCH=/tmp/psc/identity.patch.mjs (femaleRate·shinyRate)
export default async function identity({ page, key, shot, choose, railOpen, log }) {
  const state = () => page.evaluate(() => { const s = window.__oprnHooksScene.getSession(); return s.monsterParty.slice(0, 3).map((id) => { const m = s.monsterInstances[id]; return [m.nickname ?? null, m.gender ?? null, m.shiny ?? null]; }); });
  log.identity = await state();
  await railOpen(); await choose('status-menu-command-monsters'); await shot('80-party-with-gender-shiny');
  // 둘째 줄 몬스터(색이 다른 개체가 있도록 패치에서 shinyRate=2)를 요약으로 연다.
  await key('Enter'); await page.waitForTimeout(300); await shot('81-summary-stats-gender');
  await choose('status-menu-monster-page'); await page.waitForTimeout(150); await choose('status-menu-monster-page'); await shot('82-summary-manage-rename-row');
  await choose(await page.evaluate(() => document.querySelector('[data-testid^="status-menu-monster-rename-"]').dataset.testid)); await page.waitForTimeout(400); await shot('83-rename-input-open');
  await page.keyboard.type('불꽃이'); await page.waitForTimeout(150); await shot('84-rename-typed');
  await key('Enter'); await page.waitForTimeout(500); await shot('85-rename-done');
  log.afterRename = await state();
  await choose(await page.evaluate(() => document.querySelector('[data-testid^="status-menu-monster-rename-"]').dataset.testid)); await page.waitForTimeout(300);
  await page.keyboard.press('Control+A'); await page.keyboard.type('아주아주긴이름이에요'); await page.waitForTimeout(150); await shot('86-rename-too-long');
  await key('Escape'); await page.waitForTimeout(400); await shot('87-rename-cancelled');
  log.afterCancel = await state();
}
