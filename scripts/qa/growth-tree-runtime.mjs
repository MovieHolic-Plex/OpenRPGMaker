// Dedicated export-player harness; the editor shell never participates in runtime QA.
import { chromium, firefox } from 'playwright';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { runRuntimeQa, startPlayerQaServer } from '../lib/runtimeQaRun.mjs';
import { armDomState, finishDomState, inspectGrowthImages, inspectGrowthLayout, blockRemoteWrites, growthEvidenceRoot, growthViewports } from './growth-tree-evidence.mjs';
const out=`${growthEvidenceRoot}/runtime`;
await mkdir(out,{recursive:true});
const p=JSON.parse(await readFile('test/fixtures/projects/editor-authored-demo-v3.json','utf8'));
// Minimal contract fixture derived from the existing runtime harness fixture, never product content.
const hero=p.database.actors.find(a=>a.id===p.session.partyActorIds[0]) ?? p.database.actors[0];
const klass=p.database.classes.find(c=>c.id===hero.classId);
const next={...structuredClone(klass),id:'qa-growth-next',name:'Zzq Custom',promotions:[],learnedSkills:[],skillIds:[],options:{...klass.options,mightyGuard:false,dualWield:false}};p.database.classes.push(next);
klass.promotions=[{toClassId:next.id,requires:{level:1}}];
p.growth={initialPoints:5,pointsPerLevel:1,classPositions:{},skillTrees:[{id:'qa-tree',name:'수호자의 길',description:'성장 저장 계약',classIds:[klass.id],allowReset:true,nodes:[
  {id:'qa-defense',name:'방패 숙련',description:'방어력 강화',cost:2,maxRank:3,level:1,prerequisites:[],x:60,y:60,effect:{kind:'parameter',parameter:'defense',amount:7}},
  {id:'qa-skill',name:'방패 밀치기',description:'선행 능력 뒤 습득',cost:1,maxRank:1,level:1,prerequisites:['qa-defense'],x:300,y:60,effect:{kind:'skill',skillId:p.database.skills[1].id}},
]}]};
const fixture=`${growthEvidenceRoot}/runtime-contract-project.json`;await writeFile(fixture,JSON.stringify(p));
const server=await startPlayerQaServer();
const browserType=process.env.GROWTH_QA_BROWSER==='chromium'?chromium:firefox;
const browser=await browserType.launch({headless:true});
const page=await browser.newPage();page.setDefaultTimeout(45000);
const remoteWrites=await blockRemoteWrites(page);
const imageEvidence=[], screenshots=[], measurements=[], errors=[];
page.on('pageerror', error => errors.push(error.message));
try {
  console.log('Booting shipped player');
  const report=await runRuntimeQa(page,{id:'growth-tree',projectFixture:fixture,viewport:{width:1280,height:800},beats:[
    {id:'title',note:'내보내기 플레이어 타이틀',expect:{testidPresent:['title-screen']}},
    {id:'field',note:'성장 데이터가 포함된 기존 v3 프로젝트를 이전하여 플레이',ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{testidAbsent:['title-screen'],playerSpriteTextureLoaded:true},shot:true},
    {id:'menu',note:'성장 메뉴 진입',ops:[{kind:'key',key:'Escape'},{kind:'waitForVisible',testid:'main-menu'}],expect:{testidPresent:['main-menu']},shot:true},
  ]},{serverUrl:server.url,outDir:out});
  assert.equal(report.beats.filter(b=>b.failures.length).length,0,JSON.stringify(report.beats.map(b=>b.failures)));
  console.log('Investing through actual runtime menu');
  // Shipped menus are keyboard-only; real mouse clicks are intentionally blocked.
  assert.equal(new URL(page.url()).pathname, '/player.html');
  assert.equal(await page.getByTestId('toolbar-database').count(), 0);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  const activate = async testid => {
    await page.getByTestId(testid).waitFor();
    for(let i=0;i<60;i++) {
      const selected=await page.locator('.status-menu-detail-action.selected').first().getAttribute('data-testid');
      if(selected===testid) {
        const before = await page.getByTestId('main-menu').innerHTML();
        await armDomState(page, before => document.querySelector('[data-testid="main-menu"]').innerHTML !== before, before);
        await page.keyboard.press('Enter'); await finishDomState(page); return;
      }
      await armDomState(page, previous => document.querySelector('.status-menu-detail-action.selected')?.getAttribute('data-testid') !== previous, selected);
      await page.keyboard.press('ArrowDown'); await finishDomState(page);
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
  const capture = async (kind, count) => {
    for (const [width, height] of growthViewports) {
      await page.setViewportSize({ width, height });
      imageEvidence.push({ kind, width, ...await inspectGrowthImages(page, '[data-testid^="growth-menu-art-"]', count) });
      measurements.push({ kind, width, boxes: await inspectGrowthLayout(page, ['[data-testid="main-menu"]', '[data-testid="status-menu-detail-title"]', '.life-ledger-tab']) });
      const path = `${out}/${kind}-${width}.png`;
      await page.screenshot({ path }); screenshots.push(path);
    }
  };
  await capture('growth-invested', 3);
  await activate('growth-menu-tab-promotion');
  await capture('growth-custom-promotion', 1);
  // The shared background-image row keeps its readable name and keyboard action
  // when art is unavailable; unlike the editor it does not promise a text badge.
  const customArtUrl = imageEvidence.find(group => group.kind === 'growth-custom-promotion').images[0].url;
  const missingUrl = `${server.url}/__growth-qa-missing.png`;
  const failImage = route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'QA missing image' });
  await page.route(missingUrl, failImage);
  await page.evaluate(async ({ key, missingUrl }) => {
    const { registerInlineAssets } = await import('/src/assets/inlineAssetStore.ts');
    registerInlineAssets({ [key]: missingUrl });
  }, { key: new URL(customArtUrl).pathname.slice(1), missingUrl });
  await activate('growth-menu-tab-tree');
  const missingResponse = page.waitForResponse(response => response.url() === missingUrl, { timeout: 15000 });
  await activate('growth-menu-tab-promotion');
  assert.equal((await missingResponse).status(), 404);
  const fallback = await page.getByTestId(`growth-menu-promote-${next.id}`).evaluate(row => ({ text: row.textContent, disabled: row.disabled, rect: row.getBoundingClientRect().toJSON() }));
  assert.ok(fallback.text.includes(next.name)); assert.equal(fallback.disabled, false);
  await page.screenshot({ path: `${out}/growth-missing-art-1440.png` }); screenshots.push(`${out}/growth-missing-art-1440.png`);
  await writeFile(`${out}/missing-art-report.json`, JSON.stringify({ status: 404, fallback, contract: 'readable keyboard-operable row; no replacement image promised' }, null, 2));
  // Promotion is deliberately activated while its artwork is missing.
  await activate(`growth-menu-promote-${next.id}`);
  await page.evaluate(async () => (await import('/src/assets/inlineAssetStore.ts')).registerInlineAssets(null));
  await page.unroute(missingUrl, failImage);
  await activate('growth-menu-tab-tree');
  assert.equal(await page.getByTestId('growth-menu-node-qa-defense').count(),0);
  await activate('growth-menu-reset-qa-tree');
  assert.match(await page.getByTestId('status-menu-detail-title').innerText(),/5 P/);
  const path = `${out}/growth-promoted-refunded.png`;
  await page.screenshot({path}); screenshots.push(path);
  await writeFile(`${out}/interaction-report.json`,JSON.stringify({imageEvidence,screenshots,measurements,remoteWrites,checks:['http-404-readable-keyboard-fallback','loaded-node-art','loaded-reset-art','custom-class-book','responsive','v3-migrate-play','locked-prerequisite','spend-points','learn-node','promote','deactivate-class-tree','refund-inactive-tree'],errors},null,2));
  await writeFile(`${out}/SUMMARY.md`,`${await readFile(`${out}/SUMMARY.md`,'utf8')}\n## 성장 UI 계약\n실제 키보드 조작: 선행 잠금 → 방어 투자(3P) → 스킬 습득(2P) → 승급 → 직업 트리 비활성화 → 초기화(5P).\n즉시 확인: growth-invested-1024.png, growth-custom-promotion-1024.png, growth-promoted-refunded.png\n`);
  const exportAudit = await page.evaluate(async project => {
    const { collectWebExportAssets } = await import('/src/project/webExportAssets.ts');
    return collectWebExportAssets(project).map(asset => asset.zipPath);
  }, p);
  const renderedPaths = [...new Set(imageEvidence.flatMap(group => group.images.map(image => new URL(image.url).pathname.slice(1))))];
  const missing = renderedPaths.filter(path => !exportAudit.includes(path));
  await writeFile(`${out}/export-asset-audit.json`, JSON.stringify({ renderedPaths, missing, plannedAssetCount: exportAudit.length }, null, 2));
  assert.deepEqual(missing, [], 'Rendered growth art must be included in the actual export asset plan');
  assert.equal(errors.length,0,errors.join('\n'));
  assert.equal(remoteWrites.length, 0, JSON.stringify(remoteWrites));
  console.log('Runtime growth QA passed');
} catch(e) { await page.screenshot({path:`${out}/interaction-failure.png`,timeout:10000}).catch(()=>{});throw e; }
finally {await browser.close();await server.close();await rm(fixture, {force:true});await writeFile(`${out}/cleanup.json`,JSON.stringify({browserClosed:!browser.isConnected(),playerServerClosed:true,fixtureRemoved:true,remoteWrites}));}
