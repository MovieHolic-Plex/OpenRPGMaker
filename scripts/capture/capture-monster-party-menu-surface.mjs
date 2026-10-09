// Detached menu surface observation in the development player. No gameplay or canonical save claim.
// node scripts/capture/capture-monster-party-menu-surface.mjs <project.json> [dev origin] [out]
import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const [fixturePath, origin = 'http://127.0.0.1:9839', out = 'verify-shots/monster-party-menu-dogfood'] = process.argv.slice(2);
if (!fixturePath) throw new Error('A read-only exported project fixture path is required');
await mkdir(out,{recursive:true});
const project=JSON.parse(await readFile(fixturePath,'utf8'));
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:960,height:720},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__menu/proj.json',saveNamespace:'menu-detached',qaInstrumentation:true};});
await page.route('**/__menu/proj.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(project)}));
try {
 await page.goto(origin + '/player.html',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(1500);
 // Dynamic dev imports use the ordinary project store. The explicit fixture below owns this detached surface.
 const checks=await page.evaluate(async project=>{
  const [{startSession},{giveMonster},{renderPlayerStatusMenu},{createPlayerStatusMenuSnapshot},{createStatusMenuDetail},{recoveryPreview},{itemToGoods},{createSaveSnapshot},{monsterBoxUnavailableReason}]=await Promise.all([
    import('/src/project/session.ts'),import('/src/project/monsterCollection.ts'),import('/src/player/playerStatusMenu.ts'),import('/src/player/playerStatusMenuModel.ts'),import('/src/player/playerStatusMenuDetails.ts'),import('/src/player/shopPartyFit.ts'),import('/src/player/playSceneShopGoods.ts'),import('/src/player/saveSlots.ts'),import('/src/player/playerMonsterPartyModel.ts')]);
  const session=startSession(project);
  const skill=project.database.skills.find(s=>s.id==='mx_move_bump')??project.database.skills.find(s=>s.maxPp);
  const given=giveMonster(project,session,{speciesId:'mx_species_spriglet',level:5,currentHp:11,ivs:{hp:15,atk:0,def:0,spd:0},skillIds:[skill.id],skillPp:{[skill.id]:3}});
  if(!given.ok)throw Error('fixture give failed');
  const id=given.instance.instanceId;
  const row=createPlayerStatusMenuSnapshot(project,session).partyRows[0];
  if(row.actorId!==id||!row.hpValueLabel.startsWith('11/')||row.mpValueLabel!==`3/${skill.maxPp}`)throw Error(JSON.stringify(row));
  const detail=createStatusMenuDetail({project,session,selectedCommand:'monsters',slots:[],waitModeEnabled:true,monsterInstanceId:id});
  if(!detail.entries.some(e=>e.value===`PP 3/${skill.maxPp}`))throw Error('PP detail missing');
  const item=project.database.items.find(i=>i.id==='mx_item_potion')??project.database.items.find(i=>i.type==='medicine'&&i.hpRecovery.flat>0&&!i.usableActorIds.length);
  const recovery=recoveryPreview(project,session,itemToGoods(item));
  if(recovery?.[0].actorId!==id||recovery[0].current!==11||recovery[0].next<=11)throw Error(JSON.stringify(recovery));
  if(createSaveSnapshot(project,session).partyLevel!==5)throw Error('save meta');
  if(!monsterBoxUnavailableReason(project,session,id))throw Error('last member guard');
  const actions={onCommand(){},onOpenGroup(){},onSaveSlot(){},onLoadSlot(){},onSelectItemTarget(){},onUseItem(){},onSelectSkillActor(){},onSelectSkill(){},onSelectEquipmentActor(){},onSelectEquipmentSlot(){},onEquipItem(){},onUnequipItem(){},onToggleRow(){},onSelectFormationActor(){},onMoveFormationActor(){},onToggleMonsterView(){},onMoveMonster(){},onSelectMonster(){},onToggleWait(){},onToTitle(){}};
  const opts={project,session,slots:[],actions,selectedCommand:'party-menu',mode:'function'};
  document.querySelector('[data-testid="title-screen"]')?.remove();
  const stage=document.querySelector('[data-testid="play-stage"]')??document.body;
  window.__menuFixture={opts,id,render:renderPlayerStatusMenu,stage};
  stage.append(renderPlayerStatusMenu(opts));
  return {overview:row,recovery,lastMemberReason:monsterBoxUnavailableReason(project,session,id),saveLevel:createSaveSnapshot(project,session).partyLevel,detail};
 },project);
 await page.screenshot({path:out+'/01-overview-960.png'});
 await page.evaluate(()=>{document.querySelector('[data-testid="main-menu"]')?.remove();const f=window.__menuFixture;f.stage.append(f.render({...f.opts,selectedCommand:'monsters',monsterInstanceId:f.id}));});
 await page.screenshot({path:out+'/02-instance-detail-960.png'});
 await page.setViewportSize({width:640,height:480});
 await page.screenshot({path:out+'/03-instance-detail-640.png'});
 await writeFile(out+'/checks.json',JSON.stringify({kind:'detached runtime surface smoke; session seeded only in memory, no actual gameplay claim',checks,errors},null,2));
 console.log(JSON.stringify({out,errors,saveLevel:checks.saveLevel,overview:checks.overview.hpValueLabel,recovery:checks.recovery}));
}finally{await browser.close();}
