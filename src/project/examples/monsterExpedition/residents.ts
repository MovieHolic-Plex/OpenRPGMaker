import type {Project,Dir} from '@/project/types';
import {canMove} from '@/project/collision';
import patrolData from './residentPatrols.json';
// Reviewed for these bundled town templates; never apply this layout to other games.
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

export function repairExpeditionResidents(project:Project):void {
 let resident=0;
 for(const [i,row] of patrolData.entries()){
  const map=project.maps[row.map];if(!map)continue;
  const existing=map.events.find(e=>e.id===row.event);
  if(existing&&row.sourcePosition&&(existing.x!==row.sourcePosition.x||existing.y!==row.sourcePosition.y))continue;
  const delta:Record<Dir,readonly[number,number]>={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  let at=row.position;let safe=true;
  for(const dir of row.directions as Dir[]){const [dx,dy]=delta[dir],next={x:at.x+dx,y:at.y+dy};if(!canMove(project,map,at.x,at.y,next.x,next.y)||!canMove(project,map,next.x,next.y,at.x,at.y))safe=false;at=next;}
  if(!safe)continue;
  let event=existing;
  if(!event){
   const template=map.events.find(e=>e.id===row.map+'_local');if(!template)continue;
   event=structuredClone(template);event.id=row.event;event.x=row.position.x;event.y=row.position.y;
   const character=[0,1,2,3,4,5,0,3,2,5,4,7,6,5,2,7,4,3][resident]??0;
   event.pages=[{...event.pages![0],id:row.event+'_page',name:'산책 주민',conditions:[],graphic:{...event.pages![0].graphic,pattern:25+(character%4)*3+Math.floor(character/4)*48},commands:[{kind:'text',speaker:resident%2?'마을 친구':'산책 주민',body:texts[Math.floor(resident/2)]![resident%2]!}]}];
   map.events.push(event);resident++;
  }
  if(event.pages?.length!==1||event.pages[0]!.commands.some(command=>command.kind!=='text'))continue;
  event.x=row.position.x;event.y=row.position.y;
  event.pages[0]!.movement={type:'custom',speed:2,frequency:2,moveIntervalMs:1400+(i%4)*250,route:{repeat:true,skippable:false,moves:[...(row.directions as Dir[]).map(dir=>({kind:'move' as const,dir})),{kind:'wait'}]}};
 }
 // Inspected People1 roles: professor, mother, merchants and field trainers.
 for(const map of Object.values(project.maps))for(const event of map.events){
  let index:number|undefined;
  if(event.id.endsWith('_professor'))index=6;
  else if(event.id.endsWith('_mom'))index=5;
  else if(event.id.endsWith('_shop'))index=4;
  else if(event.id.includes('_trainer_'))index=event.id.endsWith('_0')?0:event.id.endsWith('_1')?2:4;
  else if(event.id.endsWith('_researcher'))index=2;
  if(index!==undefined)for(const page of event.pages??[])if(page.graphic.sprite?.id==='tex_easyrpg_charset_people1')page.graphic.pattern=25+(index%4)*3+Math.floor(index/4)*48;
 }
}
