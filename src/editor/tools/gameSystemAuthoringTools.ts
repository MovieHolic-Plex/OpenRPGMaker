import { SHOP_UI_PRESETS, effectiveShopUiPreset, isShopUiPreset } from '@/project/shopUiPresets';
import type { ToolDefinition, JsonSchema } from './types';
import { ToolError } from './types';
import { FIELD_MENU_COMMANDS, collectorFieldMenu, romanceFieldMenu, validateFieldMenu, fieldMenu, type AuthoredFieldMenu, type FieldMenuCommand } from '@/project/fieldMenu';
import {
  BACKLOG_LIMIT_MAX, BACKLOG_LIMIT_MIN, DIALOGUE_SPEEDS, DIALOGUE_UI_LANGUAGES, SKIP_SCOPES, WINDOW_OPACITY_MAX, WINDOW_OPACITY_MIN,
  backlogEnabled, mergeDialogueSystem, resolveDialogueSystem, validateDialogueSystem, type DialogueSystemPatch,
} from '@/project/dialogueSystem';
import { validateMonsterCampaign } from '@/project/io/shapeMonsterCampaign';
import { monsterCampaign } from '@/project/monsterJournal';
import { defaultObedienceCaps } from '@/project/badgeProgress';
import { checkMonsterCampaignDefinition } from '@/project/monsterCampaignConsistency';
import { installBadgeCeremonies } from '@/project/monsterBadgeCeremony';
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
  if(fieldMenu(p)?.entries.some(e=>['region-map','campaign-progress'].includes(e.command))&&!c)errors.push('지도·배지 항목에는 실제 캠페인 정의가 필요합니다.');
  if(fieldMenu(p)?.entries.some(e=>e.command==='monster-dex')&&!c&&s.monsterCollection!==true)errors.push('도감 항목에는 캠페인 정의 또는 포획(monsterCollection) 설정이 필요합니다.');
  if(fieldMenu(p)?.entries.some(e=>e.command==='backlog')&&!backlogEnabled(p))errors.push('ESC 메뉴에 백로그 항목이 있지만 대사 시스템의 백로그가 꺼져 있어 항목이 보이지 않습니다. set_dialogue_system {backlog:true} 로 켜거나 메뉴에서 빼세요.');
  if(backlogEnabled(p)&&fieldMenu(p)&&!fieldMenu(p)?.entries.some(e=>e.command==='backlog'))errors.push('대사 시스템의 백로그는 켜져 있지만 저작된 ESC 메뉴에 백로그 항목이 없습니다. 대사창 단추·L 키로는 열리지만 메뉴로는 못 엽니다. configure_field_menu {preset:"custom", add:[{command:"backlog",label:"백로그"}]} 로 넣으세요.');
  if(monsterParty&&s.monsterCollection===undefined)errors.push('몬스터 전투는 활성화됐지만 포획 커맨드는 꺼져 있습니다. 포획 없는 대회형이면 configure_monster_system(enabled:true, capture:false) 로 포획 없음을 선언하세요.');
  if(s.opening?.musicResourceId&&!p.assets.uploaded[s.opening.musicResourceId]?.ref&&!p.assets.uploaded[s.opening.musicResourceId]?.dataUrl && s.opening.musicResourceId.startsWith('composed_music_'))errors.push('저작 음악의 실제 바이트가 없습니다.');
  return errors;
}
function systemView(p:Project){const c=monsterCampaign(p),session=p.session as PlaySession;const trainer=p.database.actors.find(a=>a.id===session.partyActorIds?.[0]);return {
  reference:{style:p.meta.oprnMonsterStyle??null,resolution:p.system.playResolution??null,cameraZoom:p.system.cameraZoom??1},
  player:{mapId:p.startMapId,x:p.startPos.x,y:p.startPos.y,positionSource:'authored-start',actorId:trainer?.id,name:trainer?.name,characterResourceId:trainer?.characterResourceId,characterIndex:trainer?.characterIndex??0,companions:(session.monsterParty??[]).length},
  battle:{collection:p.system.monsterCollection===true,party:p.system.battleParty??(p.system.monsterBattleParty?'monsters':'actors'),rules:p.system.battleModel??'rm2k3',skin:p.system.battleUiStyle},
  fieldMenu:{style:p.system.fieldHud?.menuStyle&&p.system.fieldHud.menuStyle!=='project'?p.system.fieldHud.menuStyle:p.system.menuUiStyle??'pixel',authored:fieldMenu(p)??null,effectiveCommands:listStatusMenuCommandIds(p,session),effectiveRail:listStatusMenuRailIds(p,session).map(command=>({command,label:statusMenuRailLabel(command,true,p)}))},
  dialogueSystem:{authored:p.meta.oprnDialogueSystem??null,effective:resolveDialogueSystem(p)??null,source:p.meta.oprnDialogueSystem?'authored':resolveDialogueSystem(p)?'relationship-default':'legacy-none'},
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
  tool('configure_field_menu' ,'ESC 메뉴의 실제 항목·순서·표시 이름과 창 스타일을 저작. collector는 도감/동료/가방/수첩/지도/배지/저장/설정, romance는 호감도/일정/소지품/백로그/저장/불러오기/설정/타이틀로. custom 은 entries 전체를 지정하거나, 지금 메뉴에 add(추가)/remove(삭제)만 얹는다. 백로그 항목을 넣으면 대사 시스템의 백로그도 함께 켠다. 기본 기능의 가용성·저장 제한은 유지.','write',schema({preset:{type:'string',enum:['collector','romance','default','custom']},entries:{type:'array',items:{type:'object',additionalProperties:false,properties:{command:{type:'string',enum:[...FIELD_MENU_COMMANDS]},label:str},required:['command','label']}},add:{type:'array',description:'custom 전용. 지금 메뉴에 덧붙일 항목(저장 앞, 타이틀로 앞에 들어간다).',items:{type:'object',additionalProperties:false,properties:{command:{type:'string',enum:[...FIELD_MENU_COMMANDS]},label:str},required:['command','label']}},remove:{type:'array',description:'custom 전용. 지금 메뉴에서 뺄 항목.',items:{type:'string',enum:[...FIELD_MENU_COMMANDS]}},style:{type:'string',enum:['field-list','pixel','classic','sheet','workbench']}},['preset']),(p,args)=>{
    const preset=String(args.preset);if(!['collector','romance','default','custom'].includes(preset))throw new ToolError('메뉴 프리셋 오류: preset 은 collector|romance|default|custom 중 하나여야 합니다.',{code:'invalid-args'});
    // Presets own their entries; structured model providers may emit optional arrays.
    // Custom explicitly owns user labels/order. Preset entries are not a mutation input.
    let next:AuthoredFieldMenu|undefined;
    const notice:string[]=[];
    if(preset==='default')next=undefined;
    else if(preset==='collector')next=collectorFieldMenu();
    else if(preset==='romance')next=romanceFieldMenu();
    else{
      const adds=Array.isArray(args.add)?args.add as {command:FieldMenuCommand;label:string}[]:[];
      const removes=Array.isArray(args.remove)?(args.remove as unknown[]).map(String):[];
      if(args.entries===undefined&&adds.length===0&&removes.length===0)throw new ToolError('custom 메뉴에는 entries(전체 목록) 또는 add/remove 가 필요합니다. 예: {preset:"custom", add:[{command:"backlog",label:"백로그"}]}',{code:'invalid-args'});
      if(args.entries!==undefined&&!Array.isArray(args.entries))throw new ToolError('entries 는 {command,label} 배열이어야 합니다.',{code:'invalid-args'});
      const base:AuthoredFieldMenu=args.entries!==undefined?{version:1,entries:structuredClone(args.entries as AuthoredFieldMenu['entries'])}:{version:1,entries:structuredClone((fieldMenu(p)??{version:1,entries:[]}).entries)};
      if(args.entries===undefined&&base.entries.length===0)throw new ToolError('지금 저작된 메뉴가 없어 add/remove 의 기준이 없습니다. preset:"romance"|"collector" 로 먼저 만들거나 entries 전체를 주세요.',{code:'invalid-args'});
      for(const cmd of removes)if(!(FIELD_MENU_COMMANDS as readonly string[]).includes(cmd))throw new ToolError(`remove 에 알 수 없는 항목 ${cmd}. 허용: ${FIELD_MENU_COMMANDS.join(', ')}`,{code:'invalid-args'});
      base.entries=base.entries.filter(e=>!removes.includes(e.command));
      for(const row of adds){
        if(!row||typeof row!=='object'||!(FIELD_MENU_COMMANDS as readonly string[]).includes(row.command))throw new ToolError(`add 에 알 수 없는 항목 ${String((row as {command?:unknown})?.command)}. 허용: ${FIELD_MENU_COMMANDS.join(', ')}`,{code:'invalid-args'});
        if(base.entries.some(e=>e.command===row.command)){notice.push(`${row.command} 는 이미 메뉴에 있어 건너뜀`);continue;}
        const at=base.entries.findIndex(e=>e.command==='save'||e.command==='to-title');
        base.entries.splice(at<0?base.entries.length:at,0,{command:row.command,label:row.label});
      }
      next=base;
    }
    if(next)try{validateFieldMenu(next);}catch(e){throw new ToolError(`${String(e)} — 항목은 1~12개, 표시 이름은 1~12자(앞뒤 공백·줄바꿈 없음), 항목 중복 금지, to-title 은 마지막이어야 합니다.`,{code:'invalid-args'});}
    if(args.style!==undefined&&!['field-list','pixel','classic','sheet','workbench'].includes(String(args.style)))throw new ToolError('메뉴 스타일 오류: field-list|pixel|classic|sheet|workbench 중 하나.',{code:'invalid-args'});
    if(next)p.meta.oprnFieldMenu=next;else delete p.meta.oprnFieldMenu;
    p.system.menuUiStyle=args.style as Project['system']['menuUiStyle']??(preset==='default'?'pixel':'field-list');
    if(p.system.fieldHud)p.system.fieldHud.menuStyle=p.system.menuUiStyle==='field-list'?'field-list':'project';
    // 백로그 항목은 백로그가 켜져 있어야 보인다 — 메뉴에 넣었으면 같이 켠다(조용히 안 보이는 항목을 만들지 않는다).
    if(next?.entries.some(e=>e.command==='backlog')&&!backlogEnabled(p)){
      p.meta.oprnDialogueSystem=mergeDialogueSystem(resolveDialogueSystem(p),{backlog:true});
      notice.push('메뉴에 백로그가 있어 대사 시스템의 백로그를 켰습니다');
    }
    return {summary:`ESC 메뉴를 실제 기능 ID에 연결했습니다${notice.length?' — '+notice.join('; '):''}. 원정 수첩은 주인공 기록, 동료는 실제 몬스터/보관함입니다.`,data:systemView(p)};
  }),
  tool('set_dialogue_system','대사창 읽기 보조를 저작: 백로그(지난 대사·고른 선택지, 세이브에 저장)·오토·스킵(읽은 글만/전부)·숨기기 단추와 시작 설정(대사 속도·오토 속도·스킵 범위·대사창 투명도)·단추 글자 언어. 연애·관계 중심·비주얼노벨형 게임은 이미 전부 켜져 있어 호출이 필요 없고, 끄거나 조정할 때만 쓴다. JRPG 등 다른 장르도 켤 수 있다. 주어진 칸만 바꾼다. 스킵은 선택지·엔딩·넘기기금지 글에서 항상 멈추므로 안전 규칙은 설정 항목이 아니다. 플레이어 기기 설정이 있으면 그것이 이긴다.','write',schema({
    preset:{type:'string',enum:['romance','default'],description:'romance: 네 기능을 모두 켠 연애 기본 구성에서 시작. default: 저작을 지우고 자동 판정(관계 중심 게임은 기본 구성, 그 밖은 옛 동작)으로 되돌린다.'},
    backlog:{type:'boolean',description:'백로그(최근 N건 링 버퍼, 저장됨).'},
    backlogLimit:{type:'integer',minimum:BACKLOG_LIMIT_MIN,maximum:BACKLOG_LIMIT_MAX,description:`백로그에 남길 줄 수 ${BACKLOG_LIMIT_MIN}~${BACKLOG_LIMIT_MAX}, 기본 100.`},
    auto:{type:'boolean',description:'오토 진행 단추·A 키.'},
    skip:{type:'boolean',description:'스킵 단추·S 키·Ctrl 누르는 동안 스킵.'},
    hideButton:{type:'boolean',description:'숨기기 단추·H 키.'},
    language:{type:'string',enum:[...DIALOGUE_UI_LANGUAGES],description:'단추·백로그·설정 화면 글자 언어. ko 기본, auto 는 기기 언어. 게임 본문은 번역되지 않는다.'},
    defaults:{type:'object',additionalProperties:false,description:'플레이어가 아직 정하지 않았을 때의 시작 설정.',properties:{
      textSpeed:{type:'string',enum:[...DIALOGUE_SPEEDS]},autoSpeed:{type:'string',enum:[...DIALOGUE_SPEEDS]},skipScope:{type:'string',enum:[...SKIP_SCOPES],description:'read=읽은 글만, all=전부(선택지·엔딩 제외).'},
      windowOpacity:{type:'number',minimum:WINDOW_OPACITY_MIN,maximum:WINDOW_OPACITY_MAX,description:`대사창 배경 불투명도 ${WINDOW_OPACITY_MIN}~${WINDOW_OPACITY_MAX}.`}}},
  },[]),(p,args)=>{
    const fail=(message:string):never=>{throw new ToolError(message,{code:'invalid-args'});};
    const allowed=['preset','backlog','backlogLimit','auto','skip','hideButton','language','defaults'];
    const unknown=Object.keys(args).filter(k=>!allowed.includes(k));
    if(unknown.length)fail(`알 수 없는 인자 ${unknown.join(', ')}. 허용: ${allowed.join(', ')}.`);
    if(args.preset!==undefined&&args.preset!=='romance'&&args.preset!=='default')fail('preset 은 romance 또는 default 여야 합니다.');
    for(const key of ['backlog','auto','skip','hideButton'] as const)if(args[key]!==undefined&&typeof args[key]!=='boolean')fail(`${key} 는 true/false 여야 합니다(문자열 "true" 가 아님).`);
    if(args.backlogLimit!==undefined&&(typeof args.backlogLimit!=='number'||!Number.isInteger(args.backlogLimit)||args.backlogLimit<BACKLOG_LIMIT_MIN||args.backlogLimit>BACKLOG_LIMIT_MAX))fail(`backlogLimit 는 ${BACKLOG_LIMIT_MIN}~${BACKLOG_LIMIT_MAX} 사이 정수여야 합니다(기본 100). 받은 값: ${JSON.stringify(args.backlogLimit)}.`);
    if(args.language!==undefined&&!(DIALOGUE_UI_LANGUAGES as readonly string[]).includes(String(args.language)))fail(`language 는 ${DIALOGUE_UI_LANGUAGES.join('|')} 중 하나여야 합니다. 받은 값: ${JSON.stringify(args.language)}.`);
    let defaults:DialogueSystemPatch['defaults']|undefined;
    if(args.defaults!==undefined){
      const raw=args.defaults as Record<string,unknown>;
      if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('defaults 는 {textSpeed, autoSpeed, skipScope, windowOpacity} 객체여야 합니다.');
      const badKey=Object.keys(raw).find(k=>!['textSpeed','autoSpeed','skipScope','windowOpacity'].includes(k));
      if(badKey)fail(`defaults 에 알 수 없는 칸 ${badKey}. 허용: textSpeed, autoSpeed, skipScope, windowOpacity.`);
      for(const key of ['textSpeed','autoSpeed'] as const)if(raw[key]!==undefined&&!(DIALOGUE_SPEEDS as readonly string[]).includes(String(raw[key])))fail(`defaults.${key} 는 ${DIALOGUE_SPEEDS.join('|')} 중 하나여야 합니다. 받은 값: ${JSON.stringify(raw[key])}.`);
      if(raw.skipScope!==undefined&&!(SKIP_SCOPES as readonly string[]).includes(String(raw.skipScope)))fail(`defaults.skipScope 는 ${SKIP_SCOPES.join('|')} 중 하나여야 합니다(read=읽은 글만, all=전부). 받은 값: ${JSON.stringify(raw.skipScope)}.`);
      if(raw.windowOpacity!==undefined&&(typeof raw.windowOpacity!=='number'||!Number.isFinite(raw.windowOpacity)||raw.windowOpacity<WINDOW_OPACITY_MIN||raw.windowOpacity>WINDOW_OPACITY_MAX))fail(`defaults.windowOpacity 는 ${WINDOW_OPACITY_MIN}~${WINDOW_OPACITY_MAX} 사이 숫자여야 합니다(1=불투명). 받은 값: ${JSON.stringify(raw.windowOpacity)}.`);
      defaults=raw as DialogueSystemPatch['defaults'];
    }
    const patch:DialogueSystemPatch={...(args.backlog!==undefined?{backlog:args.backlog as boolean}:{}),...(args.backlogLimit!==undefined?{backlogLimit:args.backlogLimit as number}:{}),...(args.auto!==undefined?{auto:args.auto as boolean}:{}),...(args.skip!==undefined?{skip:args.skip as boolean}:{}),...(args.hideButton!==undefined?{hideButton:args.hideButton as boolean}:{}),...(args.language!==undefined?{language:args.language as DialogueSystemPatch['language']}:{}),...(defaults?{defaults}:{})};
    const notice:string[]=[];
    if(args.preset==='default'&&Object.keys(patch).length===0){
      delete p.meta.oprnDialogueSystem;
      return {summary:`대사 시스템 저작을 지웠습니다. 이제 자동 판정입니다(${resolveDialogueSystem(p)?'관계 중심 게임이라 기본 구성이 켜짐':'옛 동작 그대로'}).`,data:systemView(p)};
    }
    const base=args.preset==='romance'?mergeDialogueSystem(undefined,{backlog:true,auto:true,skip:true,hideButton:true}):args.preset==='default'?undefined:resolveDialogueSystem(p);
    const next=mergeDialogueSystem(base,patch);
    try{validateDialogueSystem(next);}catch(e){fail(`${e instanceof Error?e.message:String(e)}`);}
    p.meta.oprnDialogueSystem=next;
    const menu=fieldMenu(p);
    if(next.backlog.enabled&&menu&&!menu.entries.some(e=>e.command==='backlog'))notice.push('저작된 ESC 메뉴에 백로그 항목이 없습니다 — 메뉴로도 열려면 configure_field_menu {preset:"custom", add:[{command:"backlog",label:"백로그"}]}');
    if(!next.backlog.enabled&&menu?.entries.some(e=>e.command==='backlog'))notice.push('ESC 메뉴의 백로그 항목은 백로그가 꺼져 있는 동안 보이지 않습니다');
    if(!next.backlog.enabled&&!next.auto.enabled&&!next.skip.enabled&&!next.hideButton.enabled)notice.push('네 기능이 모두 꺼졌습니다. 대사창 단추 줄이 사라지고 옛 「기록」 단추만 남습니다');
    return {summary:`대사창 읽기 보조를 저장했습니다(백로그 ${next.backlog.enabled?`${next.backlog.limit}줄`:'꺼짐'}, 오토 ${next.auto.enabled?'켜짐':'꺼짐'}, 스킵 ${next.skip.enabled?'켜짐':'꺼짐'}, 숨기기 ${next.hideButton.enabled?'켜짐':'꺼짐'}, 언어 ${next.language})${notice.length?' — '+notice.join('; '):''}. 실제 플레이 검증은 별도입니다.`,data:systemView(p)};
  }),
  tool('configure_monster_campaign','도감 순서·생태 설명·배지 스위치·지도 좌표·진행 목표를 실제 데이터/맵/스위치와 검증해 저장. 주어진 칸만 바꾼다(나머지는 유지). 줄이는 변경은 allowShrink:true 가 있어야 하고, 배지 수를 줄이려면 badgeCount 로 체육관 이벤트까지 함께 줄인다. 정의가 실제 지은 이벤트와 어긋나면 거부한다. 런타임 진행 상태는 바꾸지 않음.','write',schema({
    definition:{type:'object',additionalProperties:false,description:'바꿀 칸만 넣는다. 넣은 배열은 그 칸 전체를 대체한다(항목을 하나 고칠 때도 나머지를 함께 보낸다 — 먼저 read_game_systems).',properties:{
      id:str,name:str,
      dexRegisteredText:{type:'string',description:'새 종을 처음 잡았을 때 전투에 뜨는 도감 등록 문장. {name} 은 종 이름. 80자 이하. 빈 문자열이면 기본 문장(「{name}의 데이터가 도감에 등록되었다!」)으로 되돌린다.'},
      speciesIds:{type:'array',items:str},
      speciesNotes:{type:'array',items:{type:'object',additionalProperties:false,properties:{speciesId:str,note:str},required:['speciesId','note']}},
      badges:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:str,name:str,switchId:str,cityMapId:str,iconResourceId:{type:'string',description:'배지 아이콘(번들 아이콘·그림 리소스 id). 생략하면 배지 화면이 기본 배지 아이콘을 쓴다.'}},required:['id','name','switchId','cityMapId']}},
      locations:{type:'array',items:{type:'object',additionalProperties:false,properties:{mapId:str,name:str,x:{type:'number'},y:{type:'number'},kind:{type:'string',enum:['town','route','dungeon','league']}},required:['mapId','name','x','y','kind']}},
      objectives:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:str,title:str,switchId:str,requiresSwitchId:str},required:['id','title','switchId']}},
    }},
    badgeCount:{type:'integer',minimum:0,maximum:8,description:'체육관(배지) 수를 이 수로 줄인다 — 정의뿐 아니라 관장 이벤트·잠금·서사도 함께. 늘리지는 못한다.'},
    allowShrink:{type:'boolean',description:'도감 종·배지·지도 위치·목표 수를 줄이는 변경을 허용한다(기본 거부).'},
    badgeCeremony:{type:'object',additionalProperties:false,description:'체육관 관장 승리 분기에 「배지 획득」 연출(섬광→징글→배지가 떠올라 빛남→「○○를 받았다!」)을 심거나 걷는다. 배지 스위치를 켜는 setSwitch 바로 뒤에 들어가며 다시 부르면 갈아 끼운다(멱등). build_monster_game 으로 지은 관장은 이미 들어 있다.',properties:{badgeId:{type:'string',description:'이 배지만. 생략하면 모든 배지.'},remove:{type:'boolean',description:'연출만 걷어 낸다(스위치·보상은 그대로).'},line:{type:'string',description:'마지막 문장(기본 「○○를 받았다!」).'}}},
    obedienceLevelCaps:{type:'object',additionalProperties:false,description:'원작식 복종 레벨 상한(기본 꺼짐). 켜면 획득한 배지 수에 비해 레벨이 높은 내 몬스터는 전투에서 기술 명령을 거부한다(아이템·교체·도망·포획은 가능). enabled:false 는 규칙을 끈다(필드 제거). caps 를 생략하면 배지 0개 Lv20, 배지마다 +5 사다리를 쓴다. 배지 수는 badges[].switchId(mx_badge_N)가 켜진 개수. gen1 전투 모델에서만 동작.',properties:{
      enabled:{type:'boolean'},
      caps:{type:'array',maxItems:64,description:'badges 오름차순 [{badges:배지 수, maxLevel:그 배지 수에서 말을 듣는 최대 레벨}]',items:{type:'object',additionalProperties:false,properties:{badges:{type:'integer',minimum:0,maximum:64},maxLevel:{type:'integer',minimum:1,maximum:100}},required:['badges','maxLevel']}},
      refuseLine:{type:'string',description:'거부 문장 틀({name}=몬스터 이름). 생략=원작식 기본 문장 넷을 돌려 쓴다'},
    },required:['enabled']},
  },[]),(p,args)=>{
    const current=p.system.monsterCampaign;
    const raw=(args.definition??{}) as Record<string,unknown>;
    const allowShrink=args.allowShrink===true;
    const ceremonyArg=args.badgeCeremony as {badgeId?:string;remove?:boolean;line?:string}|undefined;
    const obedienceArg=args.obedienceLevelCaps as {enabled?:boolean;caps?:{badges:number;maxLevel:number}[];refuseLine?:string}|undefined;
    if(!current&&(args.badgeCount!==undefined||!Object.keys(raw).length))throw new ToolError('몬스터 캠페인 정의가 없습니다 — definition 에 id·name·speciesIds·badges·locations·objectives 를 모두 넣어 만드세요.',{code:'invalid-args'});
    if(args.badgeCount===undefined&&!Object.keys(raw).length&&!ceremonyArg&&!obedienceArg)throw new ToolError('바꿀 내용이 없습니다 — definition·badgeCount·badgeCeremony·obedienceLevelCaps 중 하나를 주세요.',{code:'invalid-args'});
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
      if(obedienceArg){
        const previous=next.obedienceLevelCaps;
        if(obedienceArg.enabled===false){delete next.obedienceLevelCaps;notice.push('복종 레벨 상한 끔');}
        else{
          if(next.badges.length===0&&!obedienceArg.caps)throw Error('배지가 없는 캠페인에는 caps 를 직접 주세요.');
          next.obedienceLevelCaps={enabled:true,caps:obedienceArg.caps?JSON.parse(JSON.stringify(obedienceArg.caps)) as {badges:number;maxLevel:number}[]:previous?.caps.length?previous.caps:defaultObedienceCaps(next.badges.length),
            ...(obedienceArg.refuseLine!==undefined?(obedienceArg.refuseLine.trim()?{refuseLine:obedienceArg.refuseLine.trim()}:{}):previous?.refuseLine?{refuseLine:previous.refuseLine}:{})};
          if(p.system.battleModel!=='gen1')notice.push('주의: 복종 상한은 gen1 전투 모델에서만 동작합니다(configure_monster_system {rules:\'gen1\'}).');
          notice.push(`복종 레벨 상한 켬(${next.obedienceLevelCaps.caps.map(c=>`배지${c.badges}→Lv${c.maxLevel}`).join(', ')})`);
        }
      }
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
      if(ceremonyArg){
        const r=installBadgeCeremonies(p,ceremonyArg);
        notice.push(`배지 연출 ${r.installed.length?`심음(${r.installed.join('·')})`:''}${r.removed.length?`걷음(${r.removed.join('·')})`:''}${r.missing.length?` — 스위치를 켜는 관장 이벤트가 없어 못 심음(${r.missing.join('·')})`:''}`.trim());
      }
      // 정의가 실제 지은 이벤트·도감과 어긋나는 새 문제를 만들었다면 거부한다(이미 있던 문제는 그대로 둔다).
      const introduced=checkMonsterCampaignDefinition(p).filter(f=>f.severity==='blocker'&&!before.includes(f.code+f.message));
      if(introduced.length)throw Error('정의가 실제로 지은 게임과 어긋납니다: '+introduced.map(f=>f.message).join(' / '));
    }catch(e){throw new ToolError(e instanceof Error?e.message:String(e),{code:'invalid-args'});}
    return {summary:`캠페인 정의를 실제 참조와 연결했습니다${notice.length?' — '+notice.join('; '):''}. 포획·배지 획득 상태는 그대로입니다.`,data:systemView(p)};
  }),
  tool('review_game_systems','설정 후 시스템 조합과 실제 ESC 메뉴 모델 재검토. 플레이를 했다는 주장 없이 불일치 보고.','read',schema({},[]),p=>({summary:issues(p).length?'게임 시스템 조합에 확인할 항목이 있습니다.':'설정과 실제 메뉴 모델의 조합이 일치합니다. 출하 플레이 검증은 별도입니다.',data:systemView(p)})),
];
