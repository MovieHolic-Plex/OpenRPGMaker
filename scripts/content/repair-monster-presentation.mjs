// Prepare a detached canonical candidate using the same authoring tools as the assistant.
// Saving through the host, reloading, and native shipping QA are separate steps.
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {withTsModule} from '../ontology-ts-loader.mjs';
const [input,out,assistantOpening]=process.argv.slice(2);if(!input||!out)throw Error('Usage: input-canonical.json output-directory');
await fs.mkdir(out,{recursive:true});
let project=JSON.parse(await fs.readFile(input,'utf8'));
project=await withTsModule('src/project/cinematicWire.ts','wire.mjs',m=>m.decodeCinematicWire(project));
const before=structuredClone(project),evidence=[];
await withTsModule('src/editor/tools/openingStorybookTools.ts','book.mjs',m=>{
 const ids=['24bdab3a-66f7-441d-ad2d-230f1e7528c8','1dadbfd9-9a2d-441f-b24c-82367eec09d8','2d224c30-5581-46a7-9e51-80d3133939e8','45c0422c-d37c-4573-b663-821404d0f8f1'].map(id=>'opening_still_'+id);
 const slides=[
  ['world','별빛섬에서는 사람과 몬스터가\n함께 살아갔다.',ids[0]],
  ['world','서로를 돕겠다는 약속이 쌓이면\n등대에 작은 빛이 켜졌다.',ids[0]],
  ['rupture','어느 밤, 밤막회사가\n그 빛을 거두어 갔다.',ids[1]],
  ['stakes','등대가 어두워지자\n섬의 밤길은 조용해졌다.',ids[1]],
  ['invitation','다음 날 아침, 한 여행자가\n별싹마을에 도착했다.',ids[2]],
  ['invitation','「마을 북동쪽 연구소로 오렴.」',ids[3]],
  ['handoff','「너와 함께 걸을 친구가\n기다리고 있단다.」',ids[3]],
 ].map(([role,text,imageResourceId],i)=>({id:'starlight_book_'+(i+1),role,text,imageResourceId}));
 evidence.push(m.OPENING_STORYBOOK_TOOLS.find(t=>t.name==='make_opening_storybook').run(project,{slides,ink:'amber',progression:'confirm'}));
});
await withTsModule('src/editor/tools/gameSystemAuthoringTools.ts','shop.mjs',m=>evidence.push(m.GAME_SYSTEM_AUTHORING_TOOLS.find(t=>t.name==='configure_shop_presentation').run(project,{preset:'collector'})));
if(assistantOpening){const actual=JSON.parse(await fs.readFile(assistantOpening,'utf8'));if(actual.system.opening?.musicResourceId!==before.system.opening?.musicResourceId)throw Error('Assistant changed opening music');project.system.opening=actual.system.opening;project.meta.oprnOpeningBook=actual.meta.oprnOpeningBook;}
await withTsModule('src/project/examples/monsterExpedition/npcLayout.ts','layout.mjs',m=>evidence.push({relocated:m.repairExpeditionNpcLayout(project)}));
const locals=JSON.parse(await fs.readFile('verify-shots/monster-presentation-20261004/local-patrols.json','utf8')).rows.filter(r=>r.movement);
const residents=JSON.parse(await fs.readFile('verify-shots/monster-presentation-20261004/resident-patrols.json','utf8')).rows;
const texts=[
 ['연구소 친구가 기다릴 거예요.\n북동쪽 파란 지붕을 찾아보세요.','동료를 얻으면 풀숲을 걸어 봐요.\n여기 상점에서 회복약도 살 수 있어요.'],
 ['숲에서 돌아오면 동료를 쉬게 해 줘요.\n회복소는 언제든 문이 열려 있어요.','배지는 실력만의 증거가 아니에요.\n동료를 돌보며 함께 얻는 약속이죠.'],
 ['배가 들어오는 소리를 들으면\n동료도 바다 쪽으로 고개를 돌려요.','물가에서는 서로 다른 친구를 만나죠.\n도감에 어디서 만났는지도 남겨요.'],
 ['더운 길을 걷기 전에 회복약을 챙겨요.\n기술 횟수도 잊지 말고 확인하세요.','처음 만난 동료와 여기까지 걸었어요.\n다음 마을도 같이 가려고요.'],
 ['빛이 물결처럼 흩어지는 날이 있어요.\n등대도 다시 그렇게 빛나겠죠.','동료를 바꾸면 새로운 전략이 생겨요.\n보관함 친구들에게도 기회를 줘요.'],
 ['모래 길에서는 쉬어 가도 괜찮아요.\n여행은 먼저 도착하는 시합이 아니죠.','낯선 기술을 봤다면 이름을 기억해요.\n다음 대결에서 도움이 될 거예요.'],
 ['눈밭에서 돌아오면 따뜻하게 쉬어요.\n동료의 체력부터 확인하고요.','겨울에도 등대의 빛은 멀리 보였죠.\n다시 켜질 날을 기다리고 있어요.'],
 ['밤하늘을 보며 동료와 산책해요.\n서로를 믿으면 어둠도 덜 무섭죠.','밤막회사 소식이 걱정이에요.\n연구소 사람들도 힘을 모으고 있어요.'],
 ['산을 오르기 전에 가방을 살펴봐요.\n마지막 약속도 한 걸음씩 가는 거예요.','여기까지 함께 온 친구를 잊지 말아요.\n처음의 약속이 끝까지 힘이 돼요.'],
];
for(const [i,row] of residents.entries()){
 const map=project.maps[row.map],prototype=map.events.find(e=>e.id===row.map+'_local');
 if(!prototype)throw Error('Local NPC template missing '+row.map);
 if(map.events.some(e=>e.id===row.event))continue;
 const npc=structuredClone(prototype);npc.id=row.event;npc.x=row.position.x;npc.y=row.position.y;
 const character=[0,1,2,3,4,5,0,3,2,5,4,7,6,5,2,7,4,3][i];
 npc.pages=[{...npc.pages[0],id:row.event+'_page',name:'산책 주민',conditions:[],graphic:{...npc.pages[0].graphic,pattern:25+(character%4)*3+Math.floor(character/4)*48},commands:[{kind:'text',speaker:i%2?'마을 친구':'산책 주민',body:texts[Math.floor(i/2)][i%2]}]}];
 map.events.push(npc);
}
await withTsModule('src/editor/tools/npcPatrolTools.ts','patrol.mjs',m=>{
 const tool=m.NPC_PATROL_TOOLS.find(t=>t.name==='configure_npc_patrol');
 for(const [i,row] of [...locals,...residents].entries()){
  const position=row.position??row.origin;
  console.log('Patrol '+row.event);evidence.push(tool.run(project,{mapId:row.map,eventId:row.event,x:position.x,y:position.y,directions:row.movement.route.moves.filter(move=>move.kind==='move').map(move=>move.dir),intervalMs:1400+(i%4)*250}));
 }
});
// Actual People1 sheet inspected: down middle frame =25+3*(index%4)+48*floor(index/4).
const roles=[];
for(const map of Object.values(project.maps))for(const event of map.events){
 let index;
 if(event.id.endsWith('_professor'))index=6;
 else if(event.id.endsWith('_mom'))index=5;
 else if(event.id.endsWith('_shop'))index=4;
 else if(event.id.includes('_trainer_'))index=event.id.endsWith('_0')?0:event.id.endsWith('_1')?2:4;
 else if(event.id.endsWith('_researcher'))index=2;
 if(index!==undefined){for(const page of event.pages??[])if(page.graphic.sprite?.id==='tex_easyrpg_charset_people1')page.graphic.pattern=25+(index%4)*3+Math.floor(index/4)*48;roles.push({mapId:map.id,eventId:event.id,characterIndex:index});}
}
if(JSON.stringify(before.session)!==JSON.stringify(project.session)||JSON.stringify(before.database)!==JSON.stringify(project.database))throw Error('Presentation repair changed session/database');
await fs.writeFile(resolve(out,'candidate-decoded.json'),JSON.stringify(project));
await withTsModule('src/project/cinematicWire.ts','wire.mjs',m=>fs.writeFile(resolve(out,'candidate-wire.json'),JSON.stringify(m.encodeCinematicWire(project))));
await fs.writeFile(resolve(out,'preparation.json'),JSON.stringify({tools:evidence,roles,maps:Object.keys(project.maps).length,movingNpcs:locals.length+residents.length,sessionPreserved:true,databasePreserved:true,canonicalSaved:false,nativePlaybackVerified:false},null,2));
console.log('Prepared detached candidate: '+out);
