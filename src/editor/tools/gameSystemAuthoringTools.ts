import { SHOP_UI_PRESETS, effectiveShopUiPreset, isShopUiPreset } from '@/project/shopUiPresets';
import type { ToolDefinition, JsonSchema } from './types';
import { ToolError } from './types';
import { FIELD_MENU_COMMANDS, collectorFieldMenu, validateFieldMenu, fieldMenu, type AuthoredFieldMenu } from '@/project/fieldMenu';
import { validateMonsterCampaign } from '@/project/io/shapeMonsterCampaign';
import { monsterCampaign } from '@/project/monsterJournal';
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
  if(monsterParty&&!s.monsterCollection)errors.push('몬스터 전투는 활성화됐지만 포획 커맨드는 꺼져 있습니다.');
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
    if(p.system.fieldHud)p.system.fieldHud.menuStyle=p.system.menuUiStyle;
    return {summary:'ESC 메뉴를 실제 기능 ID에 연결했습니다. 원정 수첩은 주인공 기록, 동료는 실제 몬스터/보관함입니다.',data:systemView(p)};
  }),
  tool('configure_monster_campaign','도감 순서·생태 설명·배지 스위치·지도 좌표·진행 목표를 실제 데이터/맵/스위치와 검증해 저장. 런타임 진행 상태는 바꾸지 않음.','write',schema({definition:{type:'object'}},['definition']),(p,args)=>{
    const definition=structuredClone(args.definition) as NonNullable<Project['system']['monsterCampaign']>;
    try{validateMonsterCampaign(definition);
      if(definition.speciesIds.length>512||definition.badges.length>64||definition.locations.length>1024||definition.objectives.length>512)throw Error('캠페인 정의 상한 초과');
      const species=new Set((p.database.monsterSpecies??[]).map(r=>r.id)),switches=new Set(p.switches.map(r=>r.id));
      for(const id of definition.speciesIds)if(!species.has(id))throw Error('실제 종 없음: '+id);
      for(const id of Object.keys(definition.speciesNotes))if(!definition.speciesIds.includes(id))throw Error('도감 밖 생태 설명: '+id);
      for(const row of definition.badges)if(!p.maps[row.cityMapId]||!switches.has(row.switchId))throw Error('배지의 실제 맵/스위치 없음');
      for(const row of definition.locations)if(!p.maps[row.mapId]||!Number.isFinite(row.x)||!Number.isFinite(row.y))throw Error('지도 위치 오류');
      for(const row of definition.objectives)if(!switches.has(row.switchId)||row.requiresSwitchId&&!switches.has(row.requiresSwitchId))throw Error('목표 스위치 없음');
      for(const rows of [definition.badges,definition.objectives])if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('배지/목표 ID 중복');
      if(new Set(definition.locations.map(r=>r.mapId)).size!==definition.locations.length)throw Error('지도 맵 중복');
    }catch(e){throw new ToolError(String(e),{code:'invalid-args'});}
    p.system.monsterCampaign=definition;return {summary:'캠페인 정의를 실제 참조와 연결했습니다. 포획·배지 획득 상태는 그대로입니다.',data:systemView(p)};
  }),
  tool('review_game_systems','설정 후 시스템 조합과 실제 ESC 메뉴 모델 재검토. 플레이를 했다는 주장 없이 불일치 보고.','read',schema({},[]),p=>({summary:issues(p).length?'게임 시스템 조합에 확인할 항목이 있습니다.':'설정과 실제 메뉴 모델의 조합이 일치합니다. 출하 플레이 검증은 별도입니다.',data:systemView(p)})),
];
