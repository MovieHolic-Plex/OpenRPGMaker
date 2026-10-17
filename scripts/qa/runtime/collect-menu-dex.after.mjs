// 도감 쪽 넘기기(생태→능력→기술)와 야생 종 상세(분포)를 찍는다. collect-menu.probe.mjs 의 QA_AFTER 로 건다.
export default async function dexPages({ page, key, shot, choose, railOpen, log }) {
  await railOpen(); await choose('status-menu-command-monster-dex');
  await key('Enter'); await shot('30-dex-info');
  await key('ArrowDown'); await key('Enter'); await shot('31-dex-stats');
  await key('Enter'); await shot('32-dex-moves');
  await key('Escape'); await page.waitForTimeout(200);
  // 야생에서 만난 종(포획 표시가 있고 새싹토·숯비늘이 아닌 첫 줄)으로 내려간다.
  const wild = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="campaign-dex-"][data-dex-caught="true"]')].map(e => e.dataset.testid));
  log.dexCaughtRows = wild;
  if (wild[3]) { await choose(wild[3]); await shot('34-dex-wild-info'); }
  await key('Escape');
}
