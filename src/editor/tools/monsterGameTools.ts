import type { ToolDefinition } from './types';
import { ToolError } from './types';
import { configureEmeraldMonsterStyle, EMERALD_MONSTER_AUTHORING_GUIDE } from '@/project/emeraldMonsterStyle';
import { configureEmeraldMonsterOpening, configureEmeraldMonsterPortraitMotion } from '@/project/emeraldMonsterOpening';
import { configureEmeraldMonsterCast } from '@/project/emeraldMonsterCast';
import { configureEmeraldMonsterCreatureArt } from '@/project/emeraldMonsterCreatureArt';
import { configureMonsterPresentation } from '@/project/monsterPresentation';
import { repairExpeditionNpcLayout } from '@/project/examples/monsterExpedition/npcLayout';
import { repairExpeditionResidents } from '@/project/examples/monsterExpedition/residents';
import { repairExpeditionShopPrices } from '@/project/examples/monsterExpedition/shopPrices';
import { renameCampaign, type CampaignNames } from '@/project/examples/monsterExpedition/campaignNames';
import { replaceProjectContents } from './historyTools';
import { reviewMonsterGame } from './monsterGameReview';
import { isUntouchedDefaultOpening } from '@/project/defaults/defaultOpeningSequence';
import type { Project } from '@/project/types';

let campaignBuilder: typeof import('@/project/examples/monsterExpedition')['createMonsterExpedition'] | undefined;
let campaignLoadError='';

function isBlankDestination(p: Project): boolean {
  const maps=Object.values(p.maps);
  if(p.system.monsterCampaign||Object.keys(p.session.monsterInstances??{}).length||maps.length!==1||maps[0]!.id!== 'map_blank_start')return false;
  const map=maps[0]!;
  return !map.events.length && map.lowerTiles.every(t=>t===map.lowerTiles[0]) && map.upperTiles.every(t=>t===-1)
    && !(map.lowerOverlayTiles?.some(t=>t!==-1)||map.upperOverlayTiles?.some(t=>t!==-1)||map.shadowBits?.some(Boolean)||map.relief);
}

export const MONSTER_GAME_TOOLS: readonly ToolDefinition[] = [
  {name:'configure_monster_style',description:'에메랄드 참고 프로필을 실제 저작 설정에 적용. 맵·종·스토리·플레이 세션은 유지. 전체 게임 제작은 build_monster_game로 실행한다.',mode:'write',preservesAuthoredRaster:true,parameters:{type:'object',additionalProperties:false,required:['reference'],properties:{reference:{type:'string',enum:['emerald']}}},run(p){configureMonsterPresentation(p);configureEmeraldMonsterStyle(p);return {summary:'에메랄드 참고 설정을 적용했습니다. 전체 게임과 출하 플레이 검증은 별도입니다.',data:{...reviewMonsterGame(p),guide:EMERALD_MONSTER_AUTHORING_GUIDE}};}},
  {name:'build_monster_game',description:'실제 전체72맵/60종/8체육관/리그/엔딩/후일담 몬스터 게임. create는 공용 원작 캠페인으로 빈 프로젝트를 생성. 기존 저작 게임 전체 폐기를 사용자가 명시한 경우에만 replace:true. repair는 현재 캠페인을 재생성하지 않고 프로필/안전한 원본 NPC/가격 보수, 세션·타일·로스터·사용자 오프닝 보존. 제작 후 read/review_monster_game 필요.',mode:'write',domains:['system','world','database'],preservesAuthoredRaster:true,allowsTilesetChange:true,placesCuratedCast:true,prepare:async args=>{if(args.mode!=='create')return;try{campaignBuilder=(await import('@/project/examples/monsterExpedition')).createMonsterExpedition;campaignLoadError='';}catch(e){campaignLoadError=String(e);throw e;}},parameters:{type:'object',additionalProperties:false,required:['mode'],properties:{mode:{type:'string',enum:['create','repair']},replace:{type:'boolean',description:'create에만 허용. 기존 프로젝트 전체 교체가 명시적으로 요청된 경우만 true.'},title:{type:'string',maxLength:120},names:{type:'object',additionalProperties:false,description:'create에서 기획서의 고유명을 캠페인에 입힌다(진행·전투는 그대로). 기획서에 이름이 있으면 반드시 넘긴다.',properties:{region:{type:'string',maxLength:40,description:'섬·지방 이름(기본 별빛섬)'},startTown:{type:'string',maxLength:40,description:'시작 마을(기본 별싹 마을)'},professor:{type:'string',maxLength:40,description:'첫 동료를 주는 박사(기본 천문박사)'},firstRoute:{type:'string',maxLength:40,description:'첫 도로(기본 1번길 · 별싹 들판)'},firstGym:{type:'string',maxLength:40,description:'첫 체육관(기본 새순 체육관)'},firstLeader:{type:'string',maxLength:40,description:'첫 관장(기본 유림)'},firstBadge:{type:'string',maxLength:40,description:'첫 배지(기본 새잎 배지)'},gyms:{type:'array',maxItems:8,description:'기획서에 1~8관이 적혀 있으면 순서대로(1관부터). 적히지 않은 관은 빈 객체로 두고 건너뛴다. type 은 관장 동료 타입만 바꾸고 체육관 맵·장치는 그대로다.',items:{type:'object',additionalProperties:false,properties:{name:{type:'string',maxLength:40},leader:{type:'string',maxLength:40},badge:{type:'string',maxLength:40},type:{type:'string',enum:['rock','ground','bug','normal','flying','water','fire','electric','poison','grass','psychic','ice','ghost','dragon']}}}},firstRouteTrainers:{type:'array',maxItems:3,description:'첫 도로 트레이너 직업명(예: 벌레잡이 소년, 등산가). 그 도로의 트레이너만 바뀐다.',items:{type:'string',maxLength:30}}}},firstGymType:{type:'string',enum:['rock','ground','bug','normal','flying','water','fire','electric','poison','grass','psychic','ice','ghost','dragon'],description:'create에서 기획서의 첫 체육관 타입(바위 체육관→rock, 물→water). 첫 관장 동료만 그 타입으로 바뀌고 체육관 맵·장치는 그대로다.'},replaceOpening:{type:'boolean',description:'repair에서 기존 오프닝 교체가 명시적으로 요청된 경우만 true.'},replaceCreatureArt:{type:'boolean',description:'repair에서 공용 원작 캠페인의 몬스터 그림 교체가 요청된 경우만 true. 기본은 기존 그림 보존, 빠진 공용 아이콘만 등록.'}}},run(p,args){
    const mode=args.mode;
    if(mode==='repair'){
      if(args.replace===true)throw new ToolError('repair는 전체 교체를 허용하지 않습니다.',{code:'monster-repair-replace'});
      if(!p.system.monsterCampaign)throw new ToolError('보수할 실제 캠페인이 없습니다. 빈 프로젝트 생성은 mode:create를 사용하세요.',{code:'monster-campaign-missing'});
      const session=JSON.stringify(p.session),start=JSON.stringify([p.startMapId,p.startPos]);
      const defaultOpening=!p.system.opening||isUntouchedDefaultOpening(p.system.opening,p.meta.title)||isUntouchedDefaultOpening(p.system.opening,'새 프로젝트');
      configureMonsterPresentation(p);configureEmeraldMonsterStyle(p);
      const moved=p.system.monsterCampaign.id==='starlight-islands'?repairExpeditionNpcLayout(p):[];
      if(p.system.monsterCampaign.id==='starlight-islands'){repairExpeditionResidents(p);repairExpeditionShopPrices(p);}
      configureEmeraldMonsterCast(p);
      const updatedCreatureAssets = configureEmeraldMonsterCreatureArt(p, args.replaceCreatureArt === true).length;
      if(args.replaceOpening===true||defaultOpening)configureEmeraldMonsterOpening(p);
      else if(p.meta.oprnOpeningBook?.portraitResourceId==='oprn_emerald_professor'&&!p.meta.oprnOpeningBook.portraitMotion)configureEmeraldMonsterPortraitMotion(p);
      if(JSON.stringify(p.session)!==session||JSON.stringify([p.startMapId,p.startPos])!==start)throw new ToolError('보수 중 세션/시작 위치가 바뀌었습니다.',{code:'monster-repair-state'});
      return {summary:'기존 전체 캠페인을 재생성하지 않고 에메랄드 프로필과 안전한 보수를 적용했습니다.',data:{...reviewMonsterGame(p),mode,sessionPreserved:true,movedEvents:moved,updatedCreatureAssets}};
    }
    if(!isBlankDestination(p)&&args.replace!==true)throw new ToolError('기존 저작 맵을 보존했습니다. 현재 캠페인은 mode:repair, 전체 폐기가 명시된 요청만 create+replace:true로 처리하세요.',{code:'monster-create-authored-project'});
    if(!campaignBuilder)throw new ToolError('캠페인 재료를 불러오지 못했습니다. runToolAsync/prepareTool 생성 경로를 사용하세요. '+campaignLoadError,{code:'monster-builder-not-prepared'});
    const gymTypes=Array.isArray((args.names as CampaignNames|undefined)?.gyms)?((args.names as CampaignNames).gyms??[]).map(g=>(g as {type?:string})?.type):undefined;
    let fresh:Project;
    try{fresh=campaignBuilder({...(typeof args.firstGymType==='string'?{firstGymType:args.firstGymType}:{}),...(gymTypes?{gymTypes}:{})}).project;}
    catch(error){if(/No roster habitat\/type/.test(String(error)))throw new ToolError(`그 레벨에 맞는 몬스터가 없는 체육관 타입입니다: ${String(error).replace(/^Error: /,'')}. 다른 타입을 고르거나 비워 두세요.`,{code:'monster-gym-type-unavailable'});throw error;}
    fresh.meta.title=typeof args.title==='string'&&args.title.trim()?args.title.trim():p.meta.title;
    fresh.meta.author=p.meta.author;fresh.gameDesignBrief=p.gameDesignBrief;fresh.aiInstructions=p.aiInstructions;
    if(fresh.system.titleScreen)fresh.system.titleScreen.title=fresh.meta.title;
    configureMonsterPresentation(fresh);configureEmeraldMonsterStyle(fresh);configureEmeraldMonsterOpening(fresh);
    const renamed=args.names&&typeof args.names==='object'?renameCampaign(fresh,args.names as CampaignNames):0;
    replaceProjectContents(p,fresh);
    return {summary:'공용 원작 캠페인을 재사용해 실제72맵·60종·8체육관·리그·엔딩 게임을 생성했습니다. 구조 검토와 실제 플레이/저장은 별도입니다.',data:{...reviewMonsterGame(p),mode:'create',source:'original-starlight-islands-campaign',sessionPreserved:false,renamedStrings:renamed,...(typeof args.firstGymType==='string'?{firstGymType:args.firstGymType}:{})}};
  }},
  ...(['read_monster_game','review_monster_game'] as const).map(name=>({name,description:name==='read_monster_game'?'현재 전체 몬스터 게임의 실제 맵/종별 정면·뒷면·타입·기술·생태/메뉴/상점/오프닝/진행 연결을 읽는다.':'마지막 변경 뒤 전체72맵/60종/8배지와 실제 자원·스토리·스타터·상점·연결 검토. 구조 검사는 실제 플레이/저장 완료 증거가 아님.',mode:'read' as const,parameters:{type:'object' as const,additionalProperties:false,properties:{}},run:((p)=>{const data=reviewMonsterGame(p);return {summary:data.issues.length?'전체 몬스터 게임에 제작 문제가 남았습니다.':'전체 캠페인 구조와 리소스 연결을 검토했습니다. 실제 플레이/저장은 별도입니다.',data};}) as ToolDefinition['run']})),
];
