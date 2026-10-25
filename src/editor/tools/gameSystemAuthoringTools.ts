import { SHOP_UI_PRESETS, effectiveShopUiPreset, isShopUiPreset } from '@/project/shopUiPresets';
import type { ToolDefinition, JsonSchema } from './types';
import { ToolError } from './types';
import { FIELD_MENU_COMMANDS, collectorFieldMenu, romanceFieldMenu, storyFieldMenu, validateFieldMenu, fieldMenu, type AuthoredFieldMenu, type FieldMenuCommand } from '@/project/fieldMenu';
import {
  BACKLOG_LIMIT_MAX, BACKLOG_LIMIT_MIN, DIALOGUE_SPEEDS, DIALOGUE_UI_LANGUAGES, SKIP_SCOPES, WINDOW_OPACITY_MAX, WINDOW_OPACITY_MIN,
  backlogEnabled, mergeDialogueSystem, resolveDialogueSystem, validateDialogueSystem, type DialogueSystemPatch,
} from '@/project/dialogueSystem';
import { mergeVnExtras, resolveVnExtras, romanceVnExtras, validateVnExtras, listGallerySlots, listEndingRows, type VnExtrasPatch } from '@/project/vnExtras';
import { menuSystemIssues, syncMenuFeatures, syncMenuUiStyle } from '@/project/menuSystem';
import {
  VN_CHOICE_STYLES, VN_FONT_SCALES, VN_LETTER_SPACINGS, VN_LINE_SPACINGS, VN_NAMEPLATES, VN_PORTRAIT_ENTRANCES, VN_PRESETS, VN_PRESET_IDS, VN_SETTINGS, VN_UI_THEMES, VN_WAIT_ICONS,
  mergeVnLook, resolveVnLook, validateVnLook, type AuthoredVnLook, type VnLookPatch,
} from '@/project/vnLook';
import { validateMonsterCampaign } from '@/project/io/shapeMonsterCampaign';
import { monsterCampaign } from '@/project/monsterJournal';
import { defaultObedienceCaps } from '@/project/badgeProgress';
import { checkMonsterCampaignDefinition } from '@/project/monsterCampaignConsistency';
import { installBadgeCeremonies } from '@/project/monsterBadgeCeremony';
import { resizeCampaignGyms } from '@/project/examples/monsterExpedition/resizeGyms';
import { listStatusMenuCommandIds, listStatusMenuRailIds, statusMenuRailLabel } from '@/player/playerStatusMenuModel';
import { FIELD_HUD_THEMES, normalizeFieldHud, projectCanLoseHp } from '@/project/fieldHud';
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
  errors.push(...menuSystemIssues(p).map(issue=>issue.tool));
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
  vnLook:{authored:p.meta.oprnVnLook??null,effective:(()=>{const l=resolveVnLook(p);return l?{preset:l.preset,layout:l.layout,nameplate:l.nameplate,choiceStyle:l.choiceStyle,waitIcon:l.waitIcon,fontScale:l.fontScale,lineSpacing:l.lineSpacing,letterSpacing:l.letterSpacing,readColor:l.readColor,portraitEntrance:l.portraitEntrance,uiTheme:l.uiTheme}:null;})(),source:p.meta.oprnVnLook?'authored':resolveVnLook(p)?'relationship-default':'legacy-none'},
  vnExtras:{authored:p.meta.oprnVnExtras??null,effective:resolveVnExtras(p)??null,source:p.meta.oprnVnExtras?'authored':resolveVnExtras(p)?'relationship-default':'legacy-none',gallerySlots:listGallerySlots(p).length,endings:listEndingRows(p,[]).length},
  shop:{sellPriceOverrides:p.system.sellPrices??[],projectPreset:p.meta.oprnShopPreset??null,eventPresetCounts:(()=>{const counts:Record<string,number>={};const walk=(commands:unknown[])=>{for(const raw of commands){if(!raw||typeof raw!=='object')continue;const command=raw as Record<string,unknown>;if(command.kind==='shop'){const preset=effectiveShopUiPreset(command as {shopUiPreset?:import('@/project/types').ShopUiPreset},p);counts[preset]=(counts[preset]??0)+1;}for(const v of Object.values(command))if(Array.isArray(v))walk(v);}};for(const map of Object.values(p.maps))for(const event of map.events)for(const page of event.pages??[])walk(page.commands);return counts;})()},
  hud:p.system.fieldHud, campaign:c?{id:c.id,name:c.name,species:c.speciesIds.length,badges:c.badges.length,locations:c.locations.length,objectives:c.objectives.length}:null,
  audio:{title:p.system.titleScreen?.musicResourceId,opening:p.system.opening?.musicResourceId,field:p.system.defaultBgmResourceId,battle:p.system.battleBgmResourceId,victory:p.system.battleVictoryMeResourceId,menu:p.meta.oprnMenuSounds,composed:Object.keys(p.meta.oprnMusicScores??{})},
  issues:issues(p),verificationScope:'configuration and effective menu model; not native input/play/save proof',
};}
export const GAME_SYSTEM_AUTHORING_TOOLS:readonly ToolDefinition[]=[
  tool('read_game_systems','전투 규칙·출전 파티·ESC 실제 항목·HUD·도감/지도/배지 정의·음악 연결을 함께 읽고 불일치를 표시.','read',schema({},[]),p=>({summary:'현재 게임 시스템과 실제 메뉴 모델을 조회했습니다.',data:systemView(p)})),
  // 2026-10-25 사용자 규칙: 편집기 기본 HUD(체력 하트·514/514)를 출하하지 않는다. 조수가 장르에 맞는 HUD 를 고르거나 끈다.
  tool('set_field_hud','탐색 화면에 늘 떠 있는 HUD 를 장르에 맞게 고르거나 끈다(편집기 기본 HUD 를 그대로 두지 않는다). theme: '+Object.entries(FIELD_HUD_THEMES).filter(([k])=>k!=='legacy').map(([k,v])=>`${k}(${v})`).join(', ')+'. off:true = HUD 없음(이야기·추리·연애 대부분). vitals/clock/tools/objective 로 칸을 켜고 끈다.','write',schema({
    theme:{type:'string',enum:Object.keys(FIELD_HUD_THEMES).filter(k=>k!=='legacy'),description:'HUD 모양. 공포=horror(꽃잎 생명), 추격·이야기=chase(없음), 농장=farm, 모험=hearts, 고전 JRPG=classic, 파티 RPG=party.'},
    off:{type:'boolean',description:'true 면 상시 HUD 를 모두 끈다.'},
    vitals:{type:'boolean',description:'체력 표시'},clock:{type:'boolean',description:'달력·시계'},tools:{type:'boolean',description:'도구 슬롯'},objective:{type:'boolean',description:'목표 한 줄'},
  },[]),(p,args)=>{
    const keys=['theme','off','vitals','clock','tools','objective'];const unknown=Object.keys(args).filter(k=>!keys.includes(k));
    if(unknown.length)throw new ToolError(`알 수 없는 인자 ${unknown.join(', ')}. 허용: ${keys.join(', ')}.`,{code:'invalid-args'});
    if(args.off===true){p.system.fieldHud={theme:'chase',vitals:false,clock:false,tools:false,objective:false,hideEmpty:true,widgets:[]};return {summary:'필드 HUD 를 껐습니다(상시 표시 없음).',data:{hud:p.system.fieldHud}};}
    if(args.theme===undefined&&!keys.slice(2).some(k=>args[k]!==undefined))throw new ToolError('바꿀 것이 없습니다. 예: {theme:"horror"} · {off:true} · {theme:"hearts",clock:false}',{code:'invalid-args'});
    const theme=typeof args.theme==='string'?args.theme:(p.system.fieldHud?.theme??'minimal');
    const prev=p.system.fieldHud&&p.system.fieldHud.theme===theme?p.system.fieldHud:undefined;
    const flags:Record<string,boolean>={};for(const k of keys.slice(2))if(typeof args[k]==='boolean')flags[k]=args[k] as boolean;
    // 공포 HUD 의 꽃잎은 체력이다. 체력이 줄 일(전투·피해 명령·인카운트)이 없는 공포 탐험에 말없이 켜면 설명 없는 분홍 꽃이 떠 있다(2026-10-25 심사 J67).
    // 테마만 고르면 그런 게임에서는 체력·시계·도구 칸을 켜지 않는다. 명시한 칸(vitals:true 등)과 이미 고른 같은 테마 값은 그대로다.
    const damageless=!projectCanLoseHp(p);
    if(!prev&&theme==='horror'&&damageless)for(const k of ['vitals','clock','tools'])if(flags[k]===undefined)flags[k]=false;
    const next=normalizeFieldHud({...(prev??{}),theme,...flags,...(prev?.widgets?{widgets:prev.widgets}:{})});
    if(!prev)delete next.widgets;
    p.system.fieldHud=next;
    const note=next.theme==='horror'&&!next.vitals&&damageless&&flags.vitals!==true?' — 체력이 줄 일(전투·피해)이 없어 꽃잎 생명을 켜지 않았다. 체력을 쓰는 게임이면 vitals:true 나 set_life_flower 로 켠다':'';
    return {summary:`필드 HUD: ${FIELD_HUD_THEMES[next.theme]}(${next.theme}) — 체력 ${next.vitals?'표시':'숨김'}, 시계 ${next.clock?'표시':'숨김'}, 도구 ${next.tools?'표시':'숨김'}${note}`,data:{hud:next}};
  }),
  tool('configure_shop_presentation','전체 상점의 표현을 명시적으로 선택. collector는 흰 도트 창의 도구점. 상품·가격·수량·매입 예산은 유지. event-default는 각 명령 스킨 사용.','write',schema({preset:{type:'string',enum:[...SHOP_UI_PRESETS,'event-default']}},['preset']),(p,args)=>{
    if(args.preset==='event-default')delete p.meta.oprnShopPreset;
    else if(typeof args.preset==='string'&&isShopUiPreset(args.preset))p.meta.oprnShopPreset=args.preset;
    else throw new ToolError('상점 스킨 오류.',{code:'invalid-args'});
    return {summary:'상점 표현을 저장했습니다. 실제 거래 검증은 별도입니다.',data:systemView(p)};
  }),
  tool('configure_field_menu' ,'ESC 메뉴의 실제 항목·순서·표시 이름과 창 스타일을 저작. collector는 도감/동료/가방/수첩/지도/배지/저장/설정, romance는 호감도/일정/소지품/백로그/저장/불러오기/설정/타이틀로, story(전투 없는 이야기·공포·회상)는 소지품/갤러리/엔딩/대화 기록/저장/불러오기/설정/타이틀로. custom 은 entries 전체를 지정하거나, 지금 메뉴에 add(추가)/remove(삭제)만 얹는다. 백로그 항목을 넣으면 대사 시스템의 백로그도 함께 켠다. 기본 기능의 가용성·저장 제한은 유지.','write',schema({preset:{type:'string',enum:['collector','romance','story','default','custom']},entries:{type:'array',items:{type:'object',additionalProperties:false,properties:{command:{type:'string',enum:[...FIELD_MENU_COMMANDS]},label:str},required:['command','label']}},add:{type:'array',description:'custom 전용. 지금 메뉴에 덧붙일 항목(저장 앞, 타이틀로 앞에 들어간다).',items:{type:'object',additionalProperties:false,properties:{command:{type:'string',enum:[...FIELD_MENU_COMMANDS]},label:str},required:['command','label']}},remove:{type:'array',description:'custom 전용. 지금 메뉴에서 뺄 항목.',items:{type:'string',enum:[...FIELD_MENU_COMMANDS]}},style:{type:'string',enum:['field-list','pixel','classic','sheet','workbench']}},['preset']),(p,args)=>{
    const preset=String(args.preset);if(!['collector','romance','story','default','custom'].includes(preset))throw new ToolError('메뉴 프리셋 오류: preset 은 collector|romance|story|default|custom 중 하나여야 합니다.',{code:'invalid-args'});
    // Presets own their entries; structured model providers may emit optional arrays.
    // Custom explicitly owns user labels/order. Preset entries are not a mutation input.
    let next:AuthoredFieldMenu|undefined;
    const notice:string[]=[];
    if(preset==='default')next=undefined;
    else if(preset==='collector')next=collectorFieldMenu();
    else if(preset==='romance')next=romanceFieldMenu();
    else if(preset==='story')next=storyFieldMenu();
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
    syncMenuUiStyle(p,preset!=='default',args.style as Project['system']['menuUiStyle']|undefined);
    // 메뉴에 백로그·갤러리·엔딩을 넣었으면 기능도 같이 켠다(조용히 안 보이는 항목을 만들지 않는다) — 화면(자료집 「메뉴·시스템」)과 같은 규칙.
    notice.push(...syncMenuFeatures(p,next));
    return {summary:`ESC 메뉴를 실제 기능 ID에 연결했습니다${notice.length?' — '+notice.join('; '):''}. 원정 수첩은 주인공 기록, 동료는 실제 몬스터/보관함입니다.`,data:systemView(p)};
  }),
  tool('set_dialogue_system','대사창 읽기 보조를 저작: 백로그(지난 대사·고른 선택지, 세이브에 저장)·오토·스킵(읽은 글만/전부)·숨기기 단추와 시작 설정(대사 속도·오토 속도·스킵 범위·대사창 투명도)·단추 글자 언어. 연애·관계 중심·비주얼노벨형 게임은 이미 전부 켜져 있어 호출이 필요 없고, 끄거나 조정할 때만 쓴다. JRPG 등 다른 장르도 켤 수 있다. 주어진 칸만 바꾼다. 스킵은 선택지·엔딩·넘기기금지 글에서 항상 멈추므로 안전 규칙은 설정 항목이 아니다. 플레이어 기기 설정이 있으면 그것이 이긴다. 대사창 위치(위·가운데·아래)는 문장 표시 설정/say 의 position 이 정하며, 흉상·전신 초상이 있는 대사는 그 설정과 상관없이 항상 아래로 나온다.','write',schema({
    preset:{type:'string',enum:['romance','default'],description:'romance: 네 기능을 모두 켠 연애 기본 구성에서 시작. default: 저작을 지우고 자동 판정(관계 중심 게임은 기본 구성, 그 밖은 옛 동작)으로 되돌린다.'},
    backlog:{type:'boolean',description:'백로그(최근 N건 링 버퍼, 저장됨).'},
    backlogLimit:{type:'integer',minimum:BACKLOG_LIMIT_MIN,maximum:BACKLOG_LIMIT_MAX,description:`백로그에 남길 줄 수 ${BACKLOG_LIMIT_MIN}~${BACKLOG_LIMIT_MAX}, 기본 100.`},
    auto:{type:'boolean',description:'오토 진행(A 키). 대사창에 단추는 없다.'},
    skip:{type:'boolean',description:'스킵(S 키·Ctrl 누르는 동안 스킵). 대사창에 단추는 없다.'},
    hideButton:{type:'boolean',description:'대사창 숨기기(H 키). 대사창에 단추는 없다.'},
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
    if(args.preset==='default'){
      delete p.meta.oprnDialogueSystem;
      const ignored=Object.keys(patch);
      return {summary:`대사 시스템 저작을 지웠습니다. 이제 자동 판정입니다(${resolveDialogueSystem(p)?'관계 중심 게임이라 기본 구성이 켜짐':'옛 동작 그대로'}).${ignored.length?` preset:"default" 는 저작을 지우는 것이라 함께 준 칸(${ignored.join(', ')})은 적용하지 않았습니다. 켜거나 조정하려면 preset 없이 따로 호출하세요.`:''}`,data:systemView(p)};
    }
    const base=args.preset==='romance'?mergeDialogueSystem(undefined,{backlog:true,auto:true,skip:true,hideButton:true}):args.preset==='default'?undefined:resolveDialogueSystem(p);
    const next=mergeDialogueSystem(base,patch);
    try{validateDialogueSystem(next);}catch(e){fail(`${e instanceof Error?e.message:String(e)}`);}
    p.meta.oprnDialogueSystem=next;
    const menu=fieldMenu(p);
    if(next.backlog.enabled&&menu&&!menu.entries.some(e=>e.command==='backlog'))notice.push('저작된 ESC 메뉴에 백로그 항목이 없습니다 — 메뉴로도 열려면 configure_field_menu {preset:"custom", add:[{command:"backlog",label:"백로그"}]}');
    if(!next.backlog.enabled&&menu?.entries.some(e=>e.command==='backlog'))notice.push('ESC 메뉴의 백로그 항목은 백로그가 꺼져 있는 동안 보이지 않습니다');
    if(!next.backlog.enabled&&!next.auto.enabled&&!next.skip.enabled&&!next.hideButton.enabled)notice.push('네 기능이 모두 꺼졌습니다. 대사창에 옛 「기록」 단추가 돌아옵니다');
    return {summary:`대사창 읽기 보조를 저장했습니다(백로그 ${next.backlog.enabled?`${next.backlog.limit}줄`:'꺼짐'}, 오토 ${next.auto.enabled?'켜짐':'꺼짐'}, 스킵 ${next.skip.enabled?'켜짐':'꺼짐'}, 숨기기 ${next.hideButton.enabled?'켜짐':'꺼짐'}, 언어 ${next.language})${notice.length?' — '+notice.join('; '):''}. 실제 플레이 검증은 별도입니다.`,data:systemView(p)};
  }),
  tool('set_vn_extras','미연시 추가 화면을 저작: 갤러리(CG 잠금 표시 + 본 엔딩 회상)·엔딩 목록(엔딩 정의를 읽어 자동으로 채움, 인물별·결말 3종 체크리스트)·세이브 카드(날짜 + 마지막 대사 한 줄)·글자 언어. 연애·관계 중심 게임은 이미 전부 켜져 있어 호출이 필요 없고, 끄거나 조정할 때만 쓴다. 다른 장르도 켤 수 있다. 주어진 칸만 바꾼다. 새 그림은 만들지 않는다 — 갤러리는 showPicture recordInGallery 로 저작된 그림을, 엔딩 목록은 저작된 엔딩 정의를 읽는다. 플레이어 기기 설정·기존 저장은 그대로다.','write',schema({
    preset:{type:'string',enum:['romance','default'],description:'romance: 세 기능을 모두 켠 연애 기본 구성에서 시작. default: 저작을 지우고 자동 판정(관계 중심 게임은 기본 구성, 그 밖은 옛 동작)으로 되돌린다.'},
    gallery:{type:'boolean',description:'갤러리 확장(잠긴 CG 칸 표시·엔딩 회상). 끄면 옛 갤러리 동작(해금된 그림만, system.gallery 가 켜져 있을 때).'},
    galleryShowLocked:{type:'boolean',description:'아직 안 연 CG 칸을 「잠김」으로 보일지(true) 감출지(false).'},
    endings:{type:'boolean',description:'엔딩 목록 화면(ESC 메뉴 「엔딩」).'},
    endingsHideUnseen:{type:'boolean',description:'아직 못 본 엔딩 이름을 「???」 로 가릴지(true) 이름을 미리 보일지(false).'},
    saveCards:{type:'boolean',description:'세이브 칸에 마지막 대사 한 줄을 함께 보임.'},
    language:{type:'string',enum:[...DIALOGUE_UI_LANGUAGES,'inherit'],description:'갤러리·엔딩 목록 글자 언어. inherit 는 대사 시스템 언어를 따른다(기본). 게임 본문은 번역되지 않는다.'},
  },[]),(p,args)=>{
    const fail=(message:string):never=>{throw new ToolError(message,{code:'invalid-args'});};
    const allowed=['preset','gallery','galleryShowLocked','endings','endingsHideUnseen','saveCards','language'];
    const unknown=Object.keys(args).filter(k=>!allowed.includes(k));
    if(unknown.length)fail(`알 수 없는 인자 ${unknown.join(', ')}. 허용: ${allowed.join(', ')}.`);
    if(args.preset!==undefined&&args.preset!=='romance'&&args.preset!=='default')fail('preset 은 romance 또는 default 여야 합니다.');
    for(const key of ['gallery','galleryShowLocked','endings','endingsHideUnseen','saveCards'] as const)if(args[key]!==undefined&&typeof args[key]!=='boolean')fail(`${key} 는 true/false 여야 합니다(문자열 "true" 가 아님). 받은 값: ${JSON.stringify(args[key])}.`);
    if(args.language!==undefined&&args.language!=='inherit'&&!(DIALOGUE_UI_LANGUAGES as readonly string[]).includes(String(args.language)))fail(`language 는 ${[...DIALOGUE_UI_LANGUAGES,'inherit'].join('|')} 중 하나여야 합니다. 받은 값: ${JSON.stringify(args.language)}.`);
    const patch:VnExtrasPatch={...(args.gallery!==undefined?{gallery:args.gallery as boolean}:{}),...(args.galleryShowLocked!==undefined?{galleryShowLocked:args.galleryShowLocked as boolean}:{}),...(args.endings!==undefined?{endings:args.endings as boolean}:{}),...(args.endingsHideUnseen!==undefined?{endingsHideUnseen:args.endingsHideUnseen as boolean}:{}),...(args.saveCards!==undefined?{saveCards:args.saveCards as boolean}:{}),...(args.language!==undefined?{language:args.language as VnExtrasPatch['language']}:{})};
    if(args.preset==='default'){
      delete p.meta.oprnVnExtras;
      const ignored=Object.keys(patch);
      return {summary:`미연시 추가 화면 저작을 지웠습니다. 이제 자동 판정입니다(${resolveVnExtras(p)?'관계 중심 게임이라 기본 구성이 켜짐':'옛 동작 그대로'}).${ignored.length?` preset:"default" 는 저작을 지우는 것이라 함께 준 칸(${ignored.join(', ')})은 적용하지 않았습니다. 켜거나 조정하려면 preset 없이 따로 호출하세요.`:''}`,data:systemView(p)};
    }
    if(args.preset===undefined&&Object.keys(patch).length===0)return {summary:'바꿀 칸이 없어 아무것도 저장하지 않았습니다. 예: set_vn_extras {gallery:true} 또는 {saveCards:false}. 연애·관계 중심 게임은 이미 기본으로 켜져 있습니다.',data:systemView(p)};
    const base=args.preset==='romance'?romanceVnExtras():args.preset==='default'?undefined:resolveVnExtras(p);
    const next=mergeVnExtras(base,patch);
    try{validateVnExtras(next);}catch(e){fail(`${e instanceof Error?e.message:String(e)}`);}
    p.meta.oprnVnExtras=next;
    const notice:string[]=[],menu=fieldMenu(p);
    if(next.endings.enabled&&menu&&!menu.entries.some(e=>e.command==='endings'))notice.push('저작된 ESC 메뉴에 엔딩 항목이 없습니다 — 메뉴로 열려면 configure_field_menu {preset:"custom", add:[{command:"endings",label:"엔딩"}]}');
    if(next.gallery.enabled&&menu&&!menu.entries.some(e=>e.command==='gallery'))notice.push('저작된 ESC 메뉴에 갤러리 항목이 없습니다 — configure_field_menu {preset:"custom", add:[{command:"gallery",label:"갤러리"}]}');
    if(next.endings.enabled&&(p.endings??[]).length===0)notice.push('엔딩 정의가 아직 없어 목록이 비어 보입니다');
    if(next.saveCards.enabled&&!backlogEnabled(p))notice.push('대사 백로그가 꺼져 있어 세이브 카드에 대사 한 줄은 나오지 않습니다');
    if(next.gallery.enabled&&listGallerySlots(p).length===0)notice.push('recordInGallery 로 기록되는 그림이 없어 CG 칸이 비어 있습니다');
    return {summary:`미연시 추가 화면을 저장했습니다(갤러리 ${next.gallery.enabled?(next.gallery.showLocked?'켜짐·잠금 표시':'켜짐·잠금 숨김'):'꺼짐'}, 엔딩 목록 ${next.endings.enabled?(next.endings.hideUnseen?'켜짐·미달성 가림':'켜짐·이름 공개'):'꺼짐'}, 세이브 카드 ${next.saveCards.enabled?'켜짐':'꺼짐'}, 언어 ${next.language??'대사 시스템을 따름'})${notice.length?' — '+notice.join('; '):''}. 실제 플레이 검증은 별도입니다.`,data:systemView(p)};
  }),
  tool('set_vn_look','미연시(연애 비주얼노벨) 대사창의 룩(스킨)을 고른다. 한 번에 프리셋 하나 + 이름표·선택지 단추·대기 표시·글자 크기/줄 간격/자간·읽은 글 색·초상 등장 연출·ESC 메뉴 색 테마를 바꾼다. 주어진 칸만 바꾼다. 새 그림·글꼴 파일은 쓰지 않는다(CSS 만). 프리셋: '+VN_PRESET_IDS.map(id=>`${id}(${VN_PRESETS[id].label})`).join(', ')+'. 흉상·전신 초상이 있는 대사는 어느 프리셋에서든 대사창이 항상 아래다(위·가운데 설정은 초상 없는 대사에만 적용). 소재만 말하면 setting 을 준다 — campus→벚꽃 파스텔 카드, cafe→따뜻한 종이 노트, office→깔끔한 그레이 바, seaside→청량한 바다 유리, academy→다크 글라스. 「카페 연애 게임인데 따뜻한 느낌」 = {setting:"cafe"}, 「파스텔 카드」 = {preset:"sakura-card"}, 「텍스트 크게」 = {fontScale:"large"}. 연애·관계 중심 게임은 소재에 맞는 룩이 이미 자동으로 켜져 있어 호출이 필요 없고, 바꾸거나 다른 장르에 켤 때만 쓴다. preset 이나 setting 을 주면 이름표·선택지·대기 표시는 그 프리셋 기본으로 돌아간다(같이 주면 그 값이 이긴다). preset:"default" 만 주면 저작을 지우고 자동 판정(연애 게임은 소재 기본 룩, 그 밖은 옛 대사창)으로 되돌린다. ESC 메뉴의 색 테마는 uiTheme:"match"(대사창과 같은 색·모서리, 기본) 또는 "legacy"(기존 청색 창).','write',schema({
    preset:{type:'string',enum:[...VN_PRESET_IDS,'default'],description:'대사창 프리셋. default 는 저작 삭제(자동 판정으로 복귀).'},
    setting:{type:'string',enum:[...VN_SETTINGS],description:'게임의 소재(분위기). 그 소재에 어울리는 프리셋을 고른다. preset 이 같이 오면 preset 이 이긴다.'},
    nameplate:{type:'string',enum:[...VN_NAMEPLATES,'preset'],description:'이름표 모양: tab(윗변 탭)|pill(둥근 알약)|ribbon(비스듬한 리본). preset 은 프리셋 기본으로.'},
    choiceStyle:{type:'string',enum:[...VN_CHOICE_STYLES,'preset'],description:'선택지 단추: bar(가로 행)|card(카드)|bubble(알약 풍선). preset 은 프리셋 기본으로.'},
    waitIcon:{type:'string',enum:[...VN_WAIT_ICONS,'preset'],description:'다음 쪽 대기 표시: arrow(▼)|heart(하트)|dot(점). preset 은 프리셋 기본으로.'},
    fontScale:{type:'string',enum:[...VN_FONT_SCALES],description:'글자 크기: small|normal|large(대사창 글자만, 해상도·다른 화면은 그대로).'},
    lineSpacing:{type:'string',enum:[...VN_LINE_SPACINGS],description:'줄 간격 tight|normal|loose.'},
    letterSpacing:{type:'string',enum:[...VN_LETTER_SPACINGS],description:'자간 tight|normal|wide.'},
    readColor:{type:'boolean',description:'이미 읽은 글을 옅은 색으로 구분(스킵·다시 읽기에 유용). 기본 true.'},
    portraitEntrance:{type:'string',enum:[...VN_PORTRAIT_ENTRANCES],description:'흉상 초상이 나타나는 연출 none|fade|slide.'},
    uiTheme:{type:'string',enum:[...VN_UI_THEMES],description:'ESC 메뉴 색 테마. match=대사창 룩과 같은 색·모서리·그림자, legacy=기존 청색 창.'},
  },[]),(p,args)=>{
    const fail=(message:string):never=>{throw new ToolError(message,{code:'invalid-args'});};
    const allowed=['preset','setting','nameplate','choiceStyle','waitIcon','fontScale','lineSpacing','letterSpacing','readColor','portraitEntrance','uiTheme'];
    const unknown=Object.keys(args).filter(k=>!allowed.includes(k));
    if(unknown.length)fail(`알 수 없는 인자 ${unknown.join(', ')}. 허용: ${allowed.join(', ')}.`);
    if(Object.keys(args).length===0)fail('바꿀 내용이 없습니다. 예: {setting:"cafe"} · {preset:"sakura-card"} · {fontScale:"large"}');
    const oneOf=(key:string,list:readonly string[],extra:readonly string[]=[])=>{if(args[key]!==undefined&&!list.includes(String(args[key]))&&!extra.includes(String(args[key])))fail(`${key} 는 ${[...list,...extra].join('|')} 중 하나여야 합니다. 받은 값: ${JSON.stringify(args[key])}.`);};
    oneOf('preset',VN_PRESET_IDS,['default']);oneOf('setting',VN_SETTINGS);oneOf('nameplate',VN_NAMEPLATES,['preset']);oneOf('choiceStyle',VN_CHOICE_STYLES,['preset']);oneOf('waitIcon',VN_WAIT_ICONS,['preset']);
    oneOf('fontScale',VN_FONT_SCALES);oneOf('lineSpacing',VN_LINE_SPACINGS);oneOf('letterSpacing',VN_LETTER_SPACINGS);oneOf('portraitEntrance',VN_PORTRAIT_ENTRANCES);oneOf('uiTheme',VN_UI_THEMES);
    if(args.readColor!==undefined&&typeof args.readColor!=='boolean')fail(`readColor 는 true/false 여야 합니다(문자열 "true" 가 아님). 받은 값: ${JSON.stringify(args.readColor)}.`);
    if(args.preset==='default'&&Object.keys(args).length===1){
      delete p.meta.oprnVnLook;
      const now=resolveVnLook(p);
      return {summary:`미연시 대사창 룩 저작을 지웠습니다. 이제 자동 판정입니다(${now?`관계 중심 게임이라 소재 기본 룩 ${now.preset}`:'옛 대사창 그대로'}).`,data:systemView(p)};
    }
    if(args.preset==='default')fail('preset:"default" 는 저작을 지우는 값이라 다른 인자와 함께 줄 수 없습니다. 프리셋 id 를 고르세요.');
    const patch:VnLookPatch={
      ...(args.preset!==undefined?{preset:args.preset as VnLookPatch['preset']}:{}),...(args.setting!==undefined?{setting:args.setting as VnLookPatch['setting']}:{}),
      ...(args.nameplate!==undefined?{nameplate:args.nameplate as VnLookPatch['nameplate']}:{}),...(args.choiceStyle!==undefined?{choiceStyle:args.choiceStyle as VnLookPatch['choiceStyle']}:{}),...(args.waitIcon!==undefined?{waitIcon:args.waitIcon as VnLookPatch['waitIcon']}:{}),
      ...(args.fontScale!==undefined?{fontScale:args.fontScale as VnLookPatch['fontScale']}:{}),...(args.lineSpacing!==undefined?{lineSpacing:args.lineSpacing as VnLookPatch['lineSpacing']}:{}),...(args.letterSpacing!==undefined?{letterSpacing:args.letterSpacing as VnLookPatch['letterSpacing']}:{}),
      ...(args.readColor!==undefined?{readColor:args.readColor as boolean}:{}),...(args.portraitEntrance!==undefined?{portraitEntrance:args.portraitEntrance as VnLookPatch['portraitEntrance']}:{}),...(args.uiTheme!==undefined?{uiTheme:args.uiTheme as VnLookPatch['uiTheme']}:{}),
    };
    // 지금 보이는 룩(저작이 없으면 소재 기본 룩)을 출발점으로 삼는다. 프리셋을 바꾸면 이름표·선택지·대기 표시 저작은 새 프리셋 기본으로 돌아간다.
    const current:AuthoredVnLook|undefined=p.meta.oprnVnLook??(()=>{const l=resolveVnLook(p);return l?{version:1 as const,preset:l.preset}:undefined;})();
    const switching=patch.preset!==undefined||patch.setting!==undefined;
    const base=current&&switching?(()=>{const {nameplate:_n,choiceStyle:_c,waitIcon:_w,...rest}=current;return rest;})():current;
    const next=mergeVnLook(base,patch);
    try{validateVnLook(next);}catch(e){fail(`${e instanceof Error?e.message:String(e)}`);}
    p.meta.oprnVnLook=next;
    const eff=resolveVnLook(p)!;
    if(eff.preset==='dual-fullbody-veil'&&(!p.system.playResolution||(p.system.playResolution.width<=480&&p.system.playResolution.height<=320))){
      p.system.playResolution={width:1024,height:768};
      if(p.system.cameraZoom===undefined)p.system.cameraZoom=3.2;
    }
    const notice:string[]=[];
    if(eff.layout==='page')notice.push('풀스크린 NVL 은 초상을 숨기고 화면 전체에 글만 보입니다 — 대화 장면 전체에 쓰면 얼굴이 안 보입니다');
    if(!p.meta.oprnDialogueSystem&&!resolveDialogueSystem(p))notice.push('읽은 글 구분은 대사 시스템(set_dialogue_system)의 읽은 글 기록이 있을 때만 보입니다');
    return {summary:`미연시 대사창 룩을 저장했습니다(프리셋 ${eff.preset} · ${VN_PRESETS[eff.preset].label}, 이름표 ${eff.nameplate}, 선택지 ${eff.choiceStyle}, 대기 ${eff.waitIcon}, 글자 ${eff.fontScale}, 줄 ${eff.lineSpacing}, 자간 ${eff.letterSpacing}, 읽은 글 색 ${eff.readColor?'켜짐':'꺼짐'}, 초상 등장 ${eff.portraitEntrance}, 메뉴 테마 ${eff.uiTheme})${notice.length?' — '+notice.join('; '):''}. 실제 플레이 화면 검증은 별도입니다.`,data:systemView(p)};
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

