import { SHOP_UI_PRESETS, effectiveShopUiPreset, isShopUiPreset } from '@/project/shopUiPresets';
import type { ToolDefinition, JsonSchema } from './types';
import { ToolError } from './types';
import { FIELD_MENU_COMMANDS, collectorFieldMenu, validateFieldMenu, fieldMenu, type AuthoredFieldMenu } from '@/project/fieldMenu';
import { validateMonsterCampaign } from '@/project/io/shapeMonsterCampaign';
import { monsterCampaign } from '@/project/monsterJournal';
import { checkMonsterCampaignDefinition } from '@/project/monsterCampaignConsistency';
import { resizeCampaignGyms } from '@/project/examples/monsterExpedition/resizeGyms';
import { listStatusMenuCommandIds, listStatusMenuRailIds, statusMenuRailLabel } from '@/player/playerStatusMenuModel';
import type { Project } from '@/project/types';
import type { PlaySession } from '@/project/session';
const str:JsonSchema={type:'string'};
const schema=(properties:Record<string,JsonSchema>,required:string[]):JsonSchema=>({type:'object',additionalProperties:false,properties,required});
const tool=(name:string,description:string,mode:'read'|'write',parameters:JsonSchema,run:ToolDefinition['run']):ToolDefinition=>({name,description,mode,parameters,run,preservesAuthoredRaster:true});
function issues(p:Project):string[]{
  const errors:string[]=[],s=p.system,c=monsterCampaign(p),monsterParty=s.battleParty==='monsters'||s.monsterBattleParty===true;
  if(s.monsterCollection&&!monsterParty)errors.push('포획은 활성화됐지만 전투/공통 메뉴가 영웅 파티를 사용합니다.');
  if(monsterParty&&s.battleModel!=='gen1')errors.push('몬스터 파티와 전투 규칙이 다릅니다. gen1을 명시적으로 선택하세요.');
  if(monsterParty&&!fieldMenu(p))errors.push('수집 게임의 ESC 항목/순서가 저작되지 않았습니다. 기본 범용 메뉴가 표시됩니다.');
  if(fieldMenu(p)?.entries.some(e=>['monster-dex','region-map','campaign-progress'].includes(e.command))&&!c)errors.push('도감·지도·배지 항목에는 실제 캠페인 정의가 필요합니다.');
  if(monsterParty&&s.monsterCollection===undefined)errors.push('몬스터 전투는 활성화됐지만 포획 커맨드는 꺼져 있습니다. 포획 없는 대회형이면 configure_monster_system(enabled:true, capture:false) 로 포획 없음을 선언하세요.');
  if(s.opening?.musicResourceId&&!p.assets.uploaded[s.opening.musicResourceId]?.ref&&!p.assets.uploaded[s.opening.musicResourceId]?.dataUrl && s.opening.musicResourceId.startsWith('composed_music_'))errors.push('저작 음악의 실제 바이트가 없습니다.');
  return errors;
}
function systemView(p:Project){const c=monsterCampaign(p),session=p.session as PlaySession;const trainer=p.database.actors.find(a=>a.id===session.partyActorIds?.[0]);return {
  reference:{style:p.meta.oprnMonsterStyle??null,resolution:p.system.playResolution??null,cameraZoom:p.system.cameraZoom??1},
  player:{mapId:p.startMapId,x:p.startPos.x,y:p.startPos.y,positionSource:'authored-start',actorId:trainer?.id,name:trainer?.name,characterResourceId:trainer?.characterResourceId,characterIndex:trainer?.characterIndex??0,companions:(session.monsterParty??[]).length},
  battle:{collection:p.system.monsterCollection===true,party:p.system.battleParty??(p.system.monsterBattleParty?'monsters':'actors'),rules:p.system.battleModel??'rm2k3',skin:p.system.battleUiStyle},
  fieldMenu:{style:p.system.fieldHud?.menuStyle&&p.system.fieldHud.menuStyle!=='project'?p.system.fieldHud.menuStyle:p.system.menuUiStyle??'pixel',authored:fieldMenu(p)??null,effectiveCommands:listStatusMenuCommandIds(p,session),effectiveRail:listStatusMenuRailIds(p,session).map(command=>({command,label:statusMenuRailLabel(command,true,p)}))},
  shop:{sellPriceOverrides:p.system.sellPrices??[],projectPreset:p.meta.oprnShopPreset??null,eventPresetCounts:(()=>{const counts:Record<string,number>={};const walk=(commands:unknown[])=>{for(const raw of commands){if(!raw||typeof raw!=='object')continue;const command=raw as Record<string,unknown>;if(command.kind==='shop'){const preset=effectiveShopUiPreset(command as {shopUiPreset?:import('@/project/types').ShopUiPreset},p);counts[preset]=(counts[preset]??0)+1;}for(const v of Object.values(command))if(Array.isArray(v))walk(v);}};for(const map of Object.values(p.maps))for(const event of map.events)for(const page of event.pages??[])walk(page.commands);return counts;})()},
  hud:p.system.fieldHud, campaign:c?{id:c.id,name:c.name,species:c.speciesIds.length,badges:c.badges.length,locations:c.locations.length,objectives:c.objectives.length}:null,
  audio:{title:p.system.titleScreen?.musicResourceId,opening:p.system.opening?.musicResourceId,field:p.system.defaultBgmResourceId,battle:p.system.battleBgmResourceId,victory:p.system.battleVictoryMeResourceId,menu:p.meta.oprnMenuSounds,composed:Object.keys(p.meta.oprnMusicScores??{})},
  issues:issues(p),verificationScope:'configuration and effective menu model; not native input/play/save proof',
};}
export const GAME_SYSTEM_AUTHORING_TOOLS:readonly ToolDefinition[]=[
  tool('read_game_systems','전투 규칙·출전 파티·ESC 실제 항목·HUD·도감/지도/배지 정의·음악 연결을 함께 읽고 불일치를 표시.','read',schema({},[]),p=>({summary:'현재 게임 시스템과 실제 메뉴 모델을 조회했습니다.',data:systemView(p)})),
  tool('configure_shop_presentation','전체 상점의 표현을 명시적으로 선택. collector는 흰 도트 창의 도구점. 상품·가격·수량·매입 예산은 유지. event-default는 각 명령 스킨 사용.','write',schema({preset:{type:'string',enum:[...SHOP_UI_PRESETS,'event-default']}},['preset']),(p,args)=>{
    if(args.preset==='event-default')delete p.meta.oprnShopPreset;
    else if(typeof args.preset==='string'&&isShopUiPreset(args.preset))p.meta.oprnShopPreset=args.preset;
    else throw new ToolError('상점 스킨 오류.',{code:'invalid-args'});
    return {summary:'상점 표현을 저장했습니다. 실제 거래 검증은 별도입니다.',data:systemView(p)};
  }),
  tool('configure_field_menu' ,'ESC 메뉴의 실제 항목·순서·표시 이름과 창 스타일을 저작. collector는 도감/동료/가방/수첩/지도/배지/저장/설정. 기본 기능의 가용성·저장 제한은 유지.','write',schema({preset:{type:'string',enum:['collector','default','custom']},entries:{type:'array',items:{type:'object',additionalProperties:false,properties:{command:{type:'string',enum:[...FIELD_MENU_COMMANDS]},label:str},required:['command','label']}},style:{type:'string',enum:['field-list','pixel','classic','sheet','workbench']}},['preset']),(p,args)=>{
    const preset=String(args.preset);if(!['collector','default','custom'].includes(preset))throw new ToolError('메뉴 프리셋 오류.',{code:'invalid-args'});
    // Presets own their entries; structured model providers may emit optional arrays.
    // Custom explicitly owns user labels/order. Preset entries are not a mutation input.
    const next=preset==='default'?undefined:preset==='collector'?collectorFieldMenu():{version:1,entries:structuredClone(args.entries)} as AuthoredFieldMenu;
    if(next)try{validateFieldMenu(next);}catch(e){throw new ToolError(String(e),{code:'invalid-args'});}
    if(args.style!==undefined&&!['field-list','pixel','classic','sheet','workbench'].includes(String(args.style)))throw new ToolError('메뉴 스타일 오류.',{code:'invalid-args'});
    if(next)p.meta.oprnFieldMenu=next;else delete p.meta.oprnFieldMenu;
    p.system.menuUiStyle=args.style as Project['system']['menuUiStyle']??(preset==='default'?'pixel':'field-list');
    if(p.system.fieldHud)p.system.fieldHud.menuStyle=p.system.menuUiStyle==='field-list'?'field-list':'project';
    return {summary:'ESC 메뉴를 실제 기능 ID에 연결했습니다. 원정 수첩은 주인공 기록, 동료는 실제 몬스터/보관함입니다.',data:systemView(p)};
  }),
  tool('configure_monster_campaign','도감 순서·생태 설명·배지 스위치·지도 좌표·진행 목표를 실제 데이터/맵/스위치와 검증해 저장. 주어진 칸만 바꾼다(나머지는 유지). 줄이는 변경은 allowShrink:true 가 있어야 하고, 배지 수를 줄이려면 badgeCount 로 체육관 이벤트까지 함께 줄인다. 정의가 실제 지은 이벤트와 어긋나면 거부한다. 런타임 진행 상태는 바꾸지 않음.','write',schema({
    definition:{type:'object',additionalProperties:false,description:'바꿀 칸만 넣는다. 넣은 배열은 그 칸 전체를 대체한다(항목을 하나 고칠 때도 나머지를 함께 보낸다 — 먼저 read_game_systems).',properties:{
      id:str,name:str,
      dexRegisteredText:{type:'string',description:'새 종을 처음 잡았을 때 전투에 뜨는 도감 등록 문장. {name} 은 종 이름. 80자 이하. 빈 문자열이면 기본 문장(「{name}의 데이터가 도감에 등록되었다!」)으로 되돌린다.'},
      speciesIds:{type:'array',items:str},
      speciesNotes:{type:'array',items:{type:'object',additionalProperties:false,properties:{speciesId:str,note:str},required:['speciesId','note']}},
      badges:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:str,name:str,switchId:str,cityMapId:str},required:['id','name','switchId','cityMapId']}},
      locations:{type:'array',items:{type:'object',additionalProperties:false,properties:{mapId:str,name:str,x:{type:'number'},y:{type:'number'},kind:{type:'string',enum:['town','route','dungeon','league']}},required:['mapId','name','x','y','kind']}},
      objectives:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:str,title:str,switchId:str,requiresSwitchId:str},required:['id','title','switchId']}},
    }},
    badgeCount:{type:'integer',minimum:0,maximum:8,description:'체육관(배지) 수를 이 수로 줄인다 — 정의뿐 아니라 관장 이벤트·잠금·서사도 함께. 늘리지는 못한다.'},
    allowShrink:{type:'boolean',description:'도감 종·배지·지도 위치·목표 수를 줄이는 변경을 허용한다(기본 거부).'},
  },[]),(p,args)=>{
    const current=p.system.monsterCampaign;
    const raw=(args.definition??{}) as Record<string,unknown>;
    const allowShrink=args.allowShrink===true;
    if(!current&&(args.badgeCount!==undefined||!Object.keys(raw).length))throw new ToolError('몬스터 캠페인 정의가 없습니다 — definition 에 id·name·speciesIds·badges·locations·objectives 를 모두 넣어 만드세요.',{code:'invalid-args'});
    if(args.badgeCount===undefined&&!Object.keys(raw).length)throw new ToolError('바꿀 내용이 없습니다 — definition 또는 badgeCount 를 주세요.',{code:'invalid-args'});
    const before=checkMonsterCampaignDefinition(p).filter(f=>f.severity==='blocker').map(f=>f.code+f.message);
    const notice:string[]=[];
    try{
      if(args.badgeCount!==undefined){
        const n=Number(args.badgeCount);
        if(!Number.isInteger(n)||n<0)throw Error('badgeCount 는 0 이상의 정수여야 합니다.');
        if(current&&n<current.badges.length){const r=resizeCampaignGyms(p,n);notice.push(`체육관 ${r.before}→${r.after}개(배지 ${r.removedBadges.join("·")||"없음"} 제거, 체육관 건물·내부 ${r.removedGyms.length}곳 철거, 관장 이벤트 ${r.retiredLeaderEvents.length}개 정리, 잠금 ${r.rewiredConditions}곳 이동)`);}
        else if(current&&n>current.badges.length)throw Error(`체육관은 늘릴 수 없습니다(현재 ${current.badges.length}개 → ${n}개). 늘리려면 build_monster_game {mode:"create", replace:true, gymCount:${n}} 로 그 규모를 새로 짓거나, 새 마을·체육관 맵과 관장 이벤트를 직접 지은 뒤 definition.badges 로 등록하세요.`);
      }
      const base=p.system.monsterCampaign;
      const next:NonNullable<Project['system']['monsterCampaign']>=base?JSON.parse(JSON.stringify(base)) as NonNullable<Project['system']['monsterCampaign']>:{id:'',name:'',speciesIds:[],speciesNotes:{},badges:[],locations:[],objectives:[]};
      const known=new Set(['id','name','dexRegisteredText','speciesIds','speciesNotes','badges','locations','objectives']);
      for(const key of Object.keys(raw))if(!known.has(key))throw Error(`알 수 없는 칸: ${key}`);
      if(raw.id!==undefined)next.id=String(raw.id);
      if(raw.name!==undefined)next.name=String(raw.name);
      if(raw.dexRegisteredText!==undefined){const t=String(raw.dexRegisteredText).trim();if(t)next.dexRegisteredText=t;else delete next.dexRegisteredText;}
      for(const key of ['speciesIds','badges','locations','objectives'] as const){
        if(raw[key]===undefined)continue;
        if(!Array.isArray(raw[key]))throw Error(`${key} 는 배열이어야 합니다.`);
        const incoming=raw[key] as unknown[];
        const old=(next[key] as unknown[]).length;
        if(old>0&&incoming.length<old&&!allowShrink)throw Error(`${key} 를 ${old}개에서 ${incoming.length}개로 줄이는 덮어쓰기는 거부했습니다. 일부만 바꾸려면 기존 항목을 모두 포함해 보내고, 정말 줄이려면 allowShrink:true 를 주세요(체육관은 badgeCount).`);
        (next as unknown as Record<string,unknown>)[key]=JSON.parse(JSON.stringify(incoming));
      }
      if(raw.speciesNotes!==undefined){
        if(!Array.isArray(raw.speciesNotes))throw Error('speciesNotes 는 {speciesId, note} 배열이어야 합니다.');
        const notes=Object.fromEntries((raw.speciesNotes as {speciesId?:unknown;note?:unknown}[]).map(r=>[String(r.speciesId),String(r.note)]));
        next.speciesNotes={...next.speciesNotes,...notes};
      }
      if(raw.speciesIds!==undefined)for(const id of Object.keys(next.speciesNotes))if(!next.speciesIds.includes(id))delete next.speciesNotes[id];
      validateMonsterCampaign(next);
      if(next.speciesIds.length>512||next.badges.length>64||next.locations.length>1024||next.objectives.length>512)throw Error('캠페인 정의 상한 초과');
      const species=new Set((p.database.monsterSpecies??[]).map(r=>r.id)),switches=new Set(p.switches.map(r=>r.id));
      for(const id of next.speciesIds)if(!species.has(id))throw Error('실제 종 없음: '+id);
      for(const id of Object.keys(next.speciesNotes))if(!next.speciesIds.includes(id))throw Error('도감 밖 생태 설명: '+id);
      for(const row of next.badges)if(!p.maps[row.cityMapId]||!switches.has(row.switchId))throw Error('배지의 실제 맵/스위치 없음');
      for(const row of next.locations)if(!p.maps[row.mapId]||!Number.isFinite(row.x)||!Number.isFinite(row.y))throw Error('지도 위치 오류');
      for(const row of next.objectives)if(!switches.has(row.switchId)||row.requiresSwitchId&&!switches.has(row.requiresSwitchId))throw Error('목표 스위치 없음');
      for(const rows of [next.badges,next.objectives])if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('배지/목표 ID 중복');
      if(new Set(next.locations.map(r=>r.mapId)).size!==next.locations.length)throw Error('지도 맵 중복');
      // 정의가 약속하는 규모(plan)는 정의의 실제 수를 따라간다 — 정의만 바꿔 검수 하한이 거짓이 되지 않게.
      if(next.plan||raw.badges!==undefined)next.plan={...(next.plan??{gyms:next.badges.length,species:next.speciesIds.length,maps:0,links:0}),gyms:next.badges.length};
      if(next.plan&&raw.speciesIds!==undefined)next.plan={...next.plan,species:Math.min(next.plan.species,next.speciesIds.length)};
      p.system.monsterCampaign=next;
      // 정의가 실제 지은 이벤트·도감과 어긋나는 새 문제를 만들었다면 거부한다(이미 있던 문제는 그대로 둔다).
      const introduced=checkMonsterCampaignDefinition(p).filter(f=>f.severity==='blocker'&&!before.includes(f.code+f.message));
      if(introduced.length)throw Error('정의가 실제로 지은 게임과 어긋납니다: '+introduced.map(f=>f.message).join(' / '));
    }catch(e){throw new ToolError(e instanceof Error?e.message:String(e),{code:'invalid-args'});}
    return {summary:`캠페인 정의를 실제 참조와 연결했습니다${notice.length?' — '+notice.join('; '):''}. 포획·배지 획득 상태는 그대로입니다.`,data:systemView(p)};
  }),
  tool('review_game_systems','설정 후 시스템 조합과 실제 ESC 메뉴 모델 재검토. 플레이를 했다는 주장 없이 불일치 보고.','read',schema({},[]),p=>({summary:issues(p).length?'게임 시스템 조합에 확인할 항목이 있습니다.':'설정과 실제 메뉴 모델의 조합이 일치합니다. 출하 플레이 검증은 별도입니다.',data:systemView(p)})),
];
