// Dedicated export-player harness; the editor shell never participates in runtime QA.
import { chromium, firefox } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { runRuntimeQa, startPlayerQaServer } from '../lib/runtimeQaRun.mjs';
const out='verify-shots/runtime-qa/growth-tree';
await mkdir(out,{recursive:true});
const p=JSON.parse(await readFile('test/fixtures/projects/editor-authored-demo-v3.json','utf8'));
// Minimal contract fixture derived from the existing runtime harness fixture, never product content.
const hero=p.database.actors.find(a=>a.id===p.session.partyActorIds[0]) ?? p.database.actors[0];
const klass=p.database.classes.find(c=>c.id===hero.classId);
const next={...structuredClone(klass),id:'qa-growth-next',name:'수호 기사',promotions:[]};p.database.classes.push(next);
klass.promotions=[{toClassId:next.id,requires:{level:1}}];
p.growth={initialPoints:5,pointsPerLevel:1,classPositions:{},skillTrees:[{id:'qa-tree',name:'수호자의 길',description:'성장 저장 계약',classIds:[klass.id],allowReset:true,nodes:[
  {id:'qa-defense',name:'방패 숙련',description:'방어력 강화',cost:2,maxRank:3,level:1,prerequisites:[],x:60,y:60,effect:{kind:'parameter',parameter:'defense',amount:7}},
  {id:'qa-skill',name:'방패 밀치기',description:'선행 능력 뒤 습득',cost:1,maxRank:1,level:1,prerequisites:['qa-defense'],x:300,y:60,effect:{kind:'skill',skillId:p.database.skills[1].id}},
]}]};
const fixture=`${out}/contract-project.json`;await writeFile(fixture,JSON.stringify(p));
const server=await startPlayerQaServer();
const browserType=process.env.GROWTH_QA_BROWSER==='chromium'?chromium:firefox;
const browser=await browserType.launch({headless:true});
const page=await browser.newPage();page.setDefaultTimeout(45000);
try {
  console.log('Booting shipped player');
  const report=await runRuntimeQa(page,{id:'growth-tree',projectFixture:fixture,viewport:{width:1280,height:960},beats:[
    {id:'title',note:'내보내기 플레이어 타이틀',expect:{testidPresent:['title-screen']}},
    {id:'field',note:'성장 데이터가 포함된 기존 v3 프로젝트를 이전하여 플레이',ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{testidAbsent:['title-screen'],playerSpriteTextureLoaded:true},shot:true},
    {id:'menu',note:'성장 메뉴 진입',ops:[{kind:'key',key:'Escape'},{kind:'waitForVisible',testid:'main-menu'}],expect:{testidPresent:['main-menu']},shot:true},
  ]},{serverUrl:server.url,outDir:out});
  assert.equal(report.beats.filter(b=>b.failures.length).length,0,JSON.stringify(report.beats.map(b=>b.failures)));
  console.log('Investing through actual runtime menu');
  // Shipped menus are keyboard-only; real mouse clicks are intentionally blocked.
  await page.keyboard.press('ArrowDown', {delay:80}); await page.keyboard.press('Enter', {delay:80});
  const activate = async testid => {
    await page.getByTestId(testid).waitFor();
    for(let i=0;i<60;i++) {
      const selected=await page.locator('.status-menu-detail-action.selected').first().getAttribute('data-testid');
      if(selected===testid) { await page.keyboard.press('Enter',{delay:80}); return; }
      await page.keyboard.press('ArrowDown',{delay:80});
    }
    throw new Error(`Keyboard could not reach ${testid}`);
  };
  await activate(`status-menu-skill-actor-${hero.id}`);
  await activate('growth-menu-tab-tree');
  assert.equal(await page.getByTestId('growth-menu-node-qa-skill').isDisabled(),true);
  await activate('growth-menu-node-qa-defense');
  assert.match(await page.getByTestId('status-menu-detail-title').innerText(),/3 P/);
  await activate('growth-menu-node-qa-skill');
  assert.match(await page.getByTestId('status-menu-detail-title').innerText(),/2 P/);
  const tabs = await page.locator('.life-ledger-tab').evaluateAll(nodes => nodes.map(n => ({ text: n.textContent, clipped: n.scrollWidth > n.clientWidth + 1 })));
  assert.ok(tabs.every(t => !t.clipped), JSON.stringify(tabs));
  await page.screenshot({path:`${out}/growth-invested.png`});
  await activate('growth-menu-tab-promotion');
  await activate(`growth-menu-promote-${next.id}`);
  await activate('growth-menu-tab-tree');
  assert.equal(await page.getByTestId('growth-menu-node-qa-defense').count(),0);
  await activate('growth-menu-reset-qa-tree');
  assert.match(await page.getByTestId('status-menu-detail-title').innerText(),/5 P/);
  await page.screenshot({path:`${out}/growth-promoted-refunded.png`});
  await writeFile(`${out}/interaction-report.json`,JSON.stringify({checks:['v3-migrate-play','locked-prerequisite','spend-points','learn-node','promote','deactivate-class-tree','refund-inactive-tree'],errors:report.errors},null,2));
  await writeFile(`${out}/SUMMARY.md`,`${await readFile(`${out}/SUMMARY.md`,'utf8')}\n## 성장 UI 계약\n실제 키보드 조작: 선행 잠금 → 방어 투자(3P) → 스킬 습득(2P) → 승급 → 직업 트리 비활성화 → 초기화(5P).\n즉시 확인: growth-invested.png, growth-promoted-refunded.png\n`);
  assert.equal(report.errors.length,0,report.errors.join('\n'));
  console.log('Runtime growth QA passed');
} catch(e) { await page.screenshot({path:`${out}/interaction-failure.png`,timeout:10000}).catch(()=>{});throw e; }
finally {await browser.close();await server.close();}
