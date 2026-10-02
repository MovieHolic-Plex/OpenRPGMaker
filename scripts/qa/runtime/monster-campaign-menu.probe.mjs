// Engine-only native menu browser capture; start npm run dev:worktree first.
// OPRN_QA_URL=http://127.0.0.1:<worktree-port> node scripts/qa/runtime/monster-campaign-menu.probe.mjs
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const root = process.cwd();
const serverUrl = process.env.OPRN_QA_URL;
if (!serverUrl) throw new Error('Set OPRN_QA_URL to the running dev:worktree server.');
const base = JSON.parse(await readFile(`${root}/test/fixtures/projects/item-runtime-qa-v3.json`, 'utf8'));
await mkdir(`${root}/verify-shots/monster-campaign-menu`, {recursive:true});
const browser = await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
const page = await browser.newPage({viewport:{width:960,height:720}, hasTouch:true, reducedMotion:'reduce'});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
try {
await page.route('**/__campaign-menu-preview',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><link rel="stylesheet" href="/src/styles/tokens.css"><link rel="stylesheet" href="/src/styles/runtime/index.css"><style>html,body{margin:0;background:#101b2b}#stage{position:relative;width:320px;height:240px;transform:scale(3);transform-origin:top left;background:repeating-linear-gradient(0deg,#284a40 0 16px,#2d5746 16px 32px)}.main-menu{position:absolute;inset:0;width:320px;height:240px}</style></head><body><div id="stage"></div></body></html>`}));
await page.goto(`${serverUrl}/__campaign-menu-preview`);
const journal = await page.evaluate(async base=>{
 const [{store},{startSession},{createPlayerStatusMenuController},collection,trade,journal,rewards,slots] = await Promise.all([
 import('/src/project/store.ts'),import('/src/project/session.ts'),import('/src/player/playerStatusMenuController.ts'),
 import('/src/project/monsterCollection.ts'),import('/src/project/monsterTrade.ts'),import('/src/project/monsterJournal.ts'),
 import('/src/player/battleRewardsToSession.ts'),import('/src/player/saveSlots.ts')]);
 const project=base; project.system.menuUiStyle='pixel';
 const ids=Array.from({length:60},(_,i)=>`mx_species_probe_${i+1}`);
 const names=['이슬콩','별잎새','물방울새','안개날개','홍련꼬리','설빛늑대'];
 project.database.monsterSpecies=ids.map((id,i)=>({id,name:names[i]??`별빛생물${i+1}`,graphic:{monsterResourceId:'generated-enemy-slime-green',graphicHue:0,transparent:true,flying:false},types:[i%2?'풀':'물'],baseStats:{maxHp:45,maxMp:15,attack:18,defense:16,mind:20,agility:14},captureRate:0.45,skillsByLevel:[{level:1,skillId:project.database.skills[0].id}],evolutions:i===0?[{toSpeciesId:ids[1],requires:{level:2}}]:[]}));
 const mapId=project.startMapId, outdoor=project.maps[mapId];
 const towns=['이슬마을','별잎마을','산호항','구름고개','모래마을','눈꽃마을','불빛산','별빛 리그'];
 const locations=towns.map((name,i)=>({mapId:i===0?mapId:`probe_map_${i}`,name,x:1+(i%4)*3,y:1+Math.floor(i/4)*5,kind:i===7?'league':i===3?'dungeon':'town'}));
 for(const [i,loc] of locations.entries()){
  if(!project.maps[loc.mapId])project.maps[loc.mapId]={...structuredClone(outdoor),id:loc.mapId,name:loc.name,events:[]};
  project.maps[loc.mapId].events.push({id:`probe_exit_${i}`,x:2,y:2,pages:[{commands:[{kind:'transfer',mapId:locations[(i+1)%8].mapId,x:2,y:2}]}]});
 }
 project.system.monsterCampaign={id:'probe',name:'별빛섬 원정',speciesIds:ids,speciesNotes:Object.fromEntries(ids.map((id,i)=>[id,`${names[i]??'별빛생물'}은 이슬이 맺힌 숲에서 살아요. 잎사귀로 바람을 모으고 친구를 지켜요.`])),locations,badges:towns.map((name,i)=>({id:`probe_badge_${i}`,name:['새싹','산호','안개','번개','사막','눈꽃','홍련','별빛'][i]+' 배지',switchId:`probe_badge_${i}`,cityMapId:locations[i].mapId})),objectives:[{id:'starter',title:'연구소에서 첫 동료를 만나자',switchId:'probe_start'},{id:'gym',title:'별잎마을 체육관에서 새싹 배지를 얻자',switchId:'probe_badge_0',requiresSwitchId:'probe_start'},{id:'ruins',title:'안개 유적에서 사라진 빛을 찾자',switchId:'probe_ruins',requiresSwitchId:'probe_badge_0'}]};
 const session=startSession(project);session.currentMapId=mapId;session.switches.probe_start=true;session.switches.probe_badge_0=true;
 const first=collection.giveMonster(project,session,{speciesId:ids[0],level:5});
 const second=collection.giveMonster(project,session,{speciesId:ids[2],level:5});
 const evolved=collection.evolveMonster(project,session,{instanceId:first.instance.instanceId});
 collection.moveMonster(session,first.instance.instanceId,'box',project);
 const released=trade.removeMonster(project,session,first.instance.instanceId);
 journal.recordMonsterSeen(project,session,ids[3]);
 const before=Object.keys(session.monsterInstances).length;
 const outcome={eventState:{switches:{['mx_seen_'+ids[3]]:false},variables:{},inventory:{...session.inventory}},result:'defeat',canLose:true,rewards:{exp:0,gold:0,items:[]},capturedMonsters:[{speciesId:ids[4],level:3,caughtAt:{mapId,x:1,y:1}}]};
 rewards.applyBattleRewardsToSession(session,outcome,project);
 const noDefeatCapture=Object.keys(session.monsterInstances).length===before&&!session.switches['mx_caught_'+ids[4]];
 rewards.applyBattleRewardsToSession(session,{...outcome,result:'victory'},project);
 const staleSnapshotRetained=session.switches['mx_seen_'+ids[3]]===true;
 const victoryCapture=Object.keys(session.monsterInstances).length===before+1&&session.switches['mx_caught_'+ids[4]];
 const restored=slots.applySaveSnapshot(project,slots.createSaveSnapshot(project,session));
 const roundtrip=restored.switches['mx_caught_'+ids[0]]&&restored.switches['mx_caught_'+ids[1]]&&restored.switches['mx_seen_'+ids[3]];
 store.beginReadOnlyProjectSnapshot(project);
 const stage=document.querySelector('#stage');const scene={session,getSession:()=>session,refreshRuntimeSurfaces:()=>{},syncRuntimeState:()=>{}};
 const close=()=>stage.querySelector('[data-testid="main-menu"]')?.remove();
 const controller=createPlayerStatusMenuController({layout:stage,getActiveScene:()=>scene,getPlayStage:()=>stage,getPlayStartedAt:()=>0,closeMenu:close,closeMenuWithJuice:close,renderTitle:()=>{},emitMenuJuice:()=>{},menuCloseJuiceMs:0,loadSlot:()=>{}});
 window.__campaignProbe={controller,session,project};
 document.addEventListener('keydown',event=>{event.preventDefault();if(!stage.querySelector('[data-testid="main-menu"]')&&event.key==='Escape')controller.toggleMenu();else controller.handleKey(event.key)});
 return {evolved:evolved.ok,released:released.ok,sourceCaught:session.switches['mx_caught_'+ids[0]],evolvedCaught:session.switches['mx_caught_'+ids[1]],noDefeatCapture,victoryCapture,staleSnapshotRetained,roundtrip};
},base);
if(Object.values(journal).some(v=>!v))throw new Error('Journal receipts failed '+JSON.stringify(journal));
await page.keyboard.press('Escape');
for(let i=0;i<12;i++){if((await page.getByTestId('status-menu-command-record-menu').getAttribute('class')).includes('selected'))break;await page.keyboard.press('ArrowDown');}
await page.keyboard.press('Enter');
await page.keyboard.press('Enter');
await page.screenshot({path:`${root}/verify-shots/monster-campaign-menu/01-dex.png`});
const unknown=page.getByTestId('campaign-dex-mx_species_probe_6');
if(!(await unknown.innerText()).includes('???'))throw new Error('Unknown name leaked');
if(await unknown.locator('.status-menu-entry-icon').count())throw new Error('Unknown art leaked');
await page.getByTestId('campaign-dex-mx_species_probe_1').tap();
await page.screenshot({path:`${root}/verify-shots/monster-campaign-menu/02-species.png`});
await page.getByTestId('campaign-dex-back').tap();
if(await page.getByTestId('campaign-dex-mx_species_probe_1').getAttribute('data-dex-caught')!=='true')throw new Error('Released capture receipt lost');
await page.keyboard.press('Escape');
await page.getByTestId('status-menu-group-command-region-map').tap();
await page.keyboard.press('ArrowDown');
await page.screenshot({path:`${root}/verify-shots/monster-campaign-menu/03-map.png`});
await page.keyboard.press('Escape');
await page.getByTestId('status-menu-group-command-campaign-progress').tap();
await page.screenshot({path:`${root}/verify-shots/monster-campaign-menu/04-badges.png`});
const next=await page.getByTestId('campaign-next-objective').innerText();
if(!next.includes('안개 유적'))throw new Error('Live next objective missing');
await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.keyboard.press('Escape');
if(await page.getByTestId('main-menu').count())throw new Error('Cancel stack did not close');
if(errors.length)throw new Error(errors.join('\n'));
await writeFile(`${root}/verify-shots/monster-campaign-menu/SUMMARY.md`,`# Campaign menu browser probe\n\nEngine-only authored fixture with 60 placeholder species; original campaign/SQLite QA belongs to integration. Vite launched with npm run dev:worktree. No suites or typecheck.\n\n- Native playerStatusMenuController: ESC open, record group keyboard and native touch actions, ArrowDown focus, ESC cancel stack.\n- Unknown names/art hidden; released and evolved source records retained.\n- give/evolve/box/release + defeat capture rejection + victory capture + save snapshot roundtrip: ${JSON.stringify(journal)}\n- Live badge switch and prerequisite objective reflected.\n- Browser page errors: 0.\n\n## 즉시 확인\n\n- 01-dex.png\n- 02-species.png\n- 03-map.png\n- 04-badges.png\n`);
console.log(JSON.stringify({journal,errors,output:'verify-shots/monster-campaign-menu'}));
} finally {await browser.close();}
