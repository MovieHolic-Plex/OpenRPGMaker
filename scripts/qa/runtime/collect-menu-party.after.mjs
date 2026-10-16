// collect-menu.probe.mjs 의 QA_AFTER 모듈 — 파티 요약 쪽 넘기기와 자리 바꾸기를 실제 키로 밟는다.
export default async function party({ page, key, shot, choose, railOpen, log }) {
  const order = () => page.evaluate(() => window.__oprnHooksScene.getSession().monsterParty.slice());
  const state = () => page.evaluate(() => {
    const s = window.__oprnHooksScene.getSession();
    return s.monsterParty.map(id => `${s.monsterInstances[id].speciesId}:${s.monsterInstances[id].level}`);
  });
  // 지닌 도구 표시: 첫·셋째 몬스터에 도구를 쥐여 준다(세션만 바꾼다).
  log.held = await page.evaluate(() => {
    const project = window.__collectProject, s = window.__oprnHooksScene.getSession();
    const item = project.database.items.find(i => i.heldEffect);
    if (!item) return null;
    for (const id of [s.monsterParty[0], s.monsterParty[2]]) s.monsterInstances[id].heldItemId = item.id;
    return item.name;
  });
  await railOpen(); await choose('status-menu-command-monsters'); await shot('19-party-held');
  log.swapBefore = await state();
  // 요약 → 쪽 넘기기(능력치 → 기술 → 관리)
  await key('Enter'); await shot('20-summary-stats');
  await choose('status-menu-monster-page'); await shot('21-summary-moves');
  await choose('status-menu-monster-page'); await shot('22-summary-manage');
  // 관리 쪽에서 자리 바꾸기 → 목록으로 돌아가 다른 칸 고르기
  const swap = page.locator('[data-testid^="status-menu-monster-swap-"]');
  log.swapRowPresent = await swap.count();
  await choose(await swap.first().getAttribute('data-testid')); await shot('23-swap-pick-target');
  await key('ArrowDown', 2); await shot('24-swap-cursor-on-target');
  await key('Enter'); await shot('25-swap-done');
  log.swapAfter = await state();
  log.swapChanged = JSON.stringify(log.swapBefore) !== JSON.stringify(log.swapAfter);
  // 취소 경로: 시작 후 Esc
  await key('Enter'); await choose('status-menu-monster-page'); await choose('status-menu-monster-page');
  const swap2 = page.locator('[data-testid^="status-menu-monster-swap-"]');
  await choose(await swap2.first().getAttribute('data-testid')); await key('Escape'); await shot('26-swap-cancelled');
  log.afterCancel = await state();
}
