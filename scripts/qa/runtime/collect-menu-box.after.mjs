// 보관함(PC) 화면: 격자·상자 넘기기·옮기기·놓아주기 확인·파티로 데려가기를 실제 키로 밟는다.
export default async function box({ page, key, shot, choose, railOpen, log }) {
  const counts = () => page.evaluate(() => { const s = window.__oprnHooksScene.getSession(); return { party: s.monsterParty.length, box: s.monsterBox.length, slots: s.monsterBox.map(id => s.monsterInstances[id].boxSlot ?? null) }; });
  log.boxBefore = await counts();
  await railOpen(); await choose('status-menu-command-monsters'); await choose('status-menu-monster-toggle');
  await shot('40-box-grid');
  // 두 번째 칸으로(↓ 한 줄, → 한 칸)
  await key('ArrowDown'); await key('ArrowRight'); await shot('41-box-cursor-cell');
  await key('Enter'); await shot('42-box-monster-manage');
  await choose(await page.evaluate(() => document.querySelector('[data-testid^="status-menu-monster-boxmove-"]')?.dataset.testid));
  await key('ArrowDown'); await key('ArrowRight', 2); await shot('43-box-move-pick-target');
  await key('Enter'); await shot('44-box-moved');
  log.boxAfterMove = await counts();
  // 다음 상자
  await key('ArrowUp', 5); await key('ArrowRight'); await key('ArrowRight'); await key('Enter'); await shot('45-box-next');
  await key('ArrowLeft'); await key('ArrowLeft'); await key('Enter'); await shot('46-box-back-to-first');
  // 놓아주기 확인
  await key('ArrowDown'); await key('Enter');
  await choose(await page.evaluate(() => document.querySelector('[data-testid^="status-menu-monster-release-"]')?.dataset.testid));
  await shot('47-box-release-confirm');
  await key('Escape'); await shot('48-box-release-cancelled');
  await choose(await page.evaluate(() => document.querySelector('[data-testid^="status-menu-monster-release-"]')?.dataset.testid));
  await choose(await page.evaluate(() => document.querySelector('[data-testid^="status-menu-monster-release-"]')?.dataset.testid));
  await shot('49-box-released');
  log.boxAfterRelease = await counts();
}
