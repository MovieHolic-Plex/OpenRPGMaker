// 스타팅 고르기. QA_STARTER 로 연결(--lab 필요). 교수 대사를 넘기다 선택창이 뜨면(choice 창 감지) 장면 흐름대로 진행:
//   첫째 고르기 → 앞모습·설명 → 「정할까요?」 → 아니오(처음으로) → 둘째 고르기 → 예.
export default async function starter({ page, key, shot, drain, log }) {
  const choiceOpen = () => page.evaluate(() => !!document.querySelector('[data-testid*="choice"], .runtime-choice, .choice-window, [class*="choice"]'));
  let n = 0;
  const snap = async (name) => { n += 1; await shot(`${70 + n}-${name}`); };
  for (let i = 0; i < 12 && !(await choiceOpen()); i++) { await key('Enter'); await page.waitForTimeout(500); }
  log.choiceReached = await choiceOpen();
  await snap('starter-list');
  // 한 마리: 고르기 → 이름·속성 → 설명(여러 장일 수 있음) → 정할까요? 가 뜰 때까지 넘긴다.
  const pagesToConfirm = async (tag) => {
    await key('Enter'); await page.waitForTimeout(700); await snap(`${tag}-info`);
    for (let i = 0; i < 5; i++) {
      const asking = await page.evaluate(() => /정할까요/.test(document.body.innerText));
      if (asking) break;
      await key('Enter'); await page.waitForTimeout(600); await snap(`${tag}-page${i + 2}`);
    }
    await snap(`${tag}-confirm`);
  };
  await pagesToConfirm('first');
  await key('ArrowDown'); await page.waitForTimeout(200); await key('Enter'); await page.waitForTimeout(700); await snap('no-back-to-list');
  await key('ArrowDown'); await page.waitForTimeout(200);
  await pagesToConfirm('second');
  await key('Enter'); await page.waitForTimeout(900); await snap('given-1');
  await key('Enter'); await page.waitForTimeout(700); await snap('given-2');
  log.starterParty = await page.evaluate(() => window.__oprnHooksScene.getSession().monsterParty.length);
}
