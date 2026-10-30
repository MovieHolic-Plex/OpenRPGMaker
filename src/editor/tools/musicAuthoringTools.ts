import { sha256HexBytesSync as sha256 } from '@/util/sha256';
import type { ToolDefinition, JsonSchema } from './types';
import { ToolError } from './types';
import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { listAudioResources } from '@/assets/audioResourceCatalog';
import { MUSIC_VOICES, MUSIC_SCORE_LIMITS, renderMusicScore, musicDataUrl, type MusicScore } from '@/project/musicScore';
import type { Project } from '@/project/types';
const str:JsonSchema={type:'string'},obj:JsonSchema={type:'object'};
const schema=(properties:Record<string,JsonSchema>,required:string[]):JsonSchema=>({type:'object',additionalProperties:false,properties,required});
const tool=(name:string,description:string,mode:'read'|'write',parameters:JsonSchema,run:ToolDefinition['run']):ToolDefinition=>({name,description,mode,parameters,run,preservesAuthoredRaster:true});
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>160)throw new ToolError('음악 ID/이름 문자열이 필요합니다.',{code:'invalid-args'});return v.trim();};

const wavBytes=(url:string)=>{const m=/^data:audio\/wav;base64,(.+)$/.exec(url);if(!m)throw new ToolError('WAV 바이트를 확인할 수 없습니다.',{code:'invalid-audio'});return Uint8Array.from(atob(m[1]),c=>c.charCodeAt(0));};
function playable(p:Project,id:string,kind:'music'|'sound'){
  if(!listAudioResources(kind,p).some(r=>r.id===id))throw new ToolError('실제 오디오 리소스가 없습니다: '+id,{code:'resource-not-found'});
  // 파일 참조(ref) 자산은 조수 워커에 주소 해석기가 없어 url 이 비어도 재생 소스가 있다(스토어 카드로 넣은 곡, 2026-10-25 실조수: 6번 실패).
  const a=p.assets.uploaded[id],url=resolveAssetResourceUrl(id,{project:p})||(a?.ref?.sha256?`asset-ref:${a.ref.sha256}`:'');
  if(!url)throw new ToolError('재생 소스가 없는 오디오입니다.',{code:'invalid-audio'});
  if(a){
    if(a.kind!==kind)throw new ToolError('오디오 종류가 다릅니다.',{code:'invalid-audio'});
    const source=a.dataUrl??'',mime=a.ref?.mime??source.split(';')[0].slice(5);
    if(!/^(audio\/(wav|wave|x-wav|mpeg|mp3|ogg|flac|webm|mp4))$/.test(mime)||(!a.ref&&!source.startsWith('data:audio/')))throw new ToolError('지원되는 오디오 파일이 아닙니다. MIDI/빈 소스는 재생할 수 없습니다.',{code:'invalid-audio'});
    if(!a.ref){const m=/;base64,(.+)$/.exec(source);if(!m)throw new ToolError('실제 오디오 바이트가 없습니다.',{code:'invalid-audio'});
      const prefix=atob(m[1].slice(0,96));
      const valid=/^(RIFF[\s\S]{4}WAVE|OggS|fLaC|ID3)/.test(prefix)||prefix.charCodeAt(0)===255&&(prefix.charCodeAt(1)&224)===224||prefix.slice(4,8)==='ftyp'||prefix.startsWith('\x1a\x45\xdf\xa3');
      if(!valid)throw new ToolError('오디오 파일 헤더가 올바르지 않습니다.',{code:'invalid-audio'});
    }
  }else if(/\.(mid|midi)(?:[?#]|$)/i.test(url))throw new ToolError('브라우저가 재생하지 못하는 MIDI입니다.',{code:'invalid-audio'});
  return url;
}
const ROLES=['title','opening','field-default','battle-default','victory','defeat','cursor','confirm','cancel','maps','boss','chase','ending'] as const;

/** 보스전 이름 낱말 — troopIds 를 주지 않았을 때 보스 부대를 고른다. */
const BOSS_NAME=/보스|boss|마왕|魔王|드래곤|dragon|용왕|수문장|두목|우두머리|대장|관장|군주|lord|king|queen|ボス/i;
type Cmd={kind?:unknown;commandId?:unknown;troopId?:unknown;fields?:Record<string,unknown>;[key:string]:unknown};
/** 명령 배열을 모두 돈다(분기·선택지 안 포함). */
function eachCommandList(node:unknown,visit:(list:Cmd[])=>void,depth=0):void{
  if(depth>24||!node||typeof node!=='object')return;
  if(Array.isArray(node)){if(node.some(item=>item&&typeof item==='object'&&'kind' in (item as object)))visit(node as Cmd[]);for(const item of node)eachCommandList(item,visit,depth+1);return;}
  for(const value of Object.values(node as Record<string,unknown>))if(value&&typeof value==='object')eachCommandList(value,visit,depth+1);
}
const isSystemBattleBgm=(c:Cmd|undefined,op:string)=>!!c&&c.kind==='m2Command'&&c.commandId==='m2-027-change-system-bgm'&&c.fields?.cue==='battle'&&c.fields?.operation===op;
/**
 * 보스전만 곡 바꾸기: 그 부대와 싸우는 전투 명령 바로 앞에 「전투 곡 바꾸기」, 바로 뒤에 「되돌리기」를 넣는다(이기든 지든 다음 전투는 기본 곡).
 * 이미 있으면 곡만 바꾼다. 기본 전투 곡(battle-default)은 건드리지 않는다.
 */
function setBossBattleMusic(p:Project,id:string,troopIds:readonly string[]){
  const want=new Set(troopIds),touched:{mapId:string;eventId:string;troopId:string}[]=[];
  const lists:{list:Cmd[];mapId:string;eventId:string}[]=[];
  for(const [mapId,map] of Object.entries(p.maps))for(const event of map.events??[])eachCommandList(event,list=>lists.push({list,mapId,eventId:event.id}));
  for(const ce of p.commonEvents??[])eachCommandList(ce,list=>lists.push({list,mapId:'(공통 이벤트)',eventId:String((ce as {id?:unknown}).id??'')}));
  for(const {list,mapId,eventId} of lists){
    for(let i=0;i<list.length;i++){
      const c=list[i]!;
      if(c.kind!=='battleProcessing'||typeof c.troopId!=='string'||!want.has(c.troopId))continue;
      const set={kind:'m2Command',commandId:'m2-027-change-system-bgm',fields:{cue:'battle',operation:'set',resourceId:id,volume:'100'}};
      if(isSystemBattleBgm(list[i-1],'set'))list[i-1]=set;else{list.splice(i,0,set);i++;}
      if(!isSystemBattleBgm(list[i+1],'reset'))list.splice(i+1,0,{kind:'m2Command',commandId:'m2-027-change-system-bgm',fields:{cue:'battle',operation:'reset'}});
      touched.push({mapId,eventId,troopId:c.troopId});
    }
  }
  return touched;
}
/**
 * 엔딩·크레딧 곡: 정의된 엔딩(project.endings[].presentation.musicResourceId — triggerEnding 이 엔딩 화면에 넘긴다)과,
 * endingIds 를 비웠으면 이벤트에 직접 쓴 엔딩 명령(kind:'ending' 의 presentation)에도 건다. 런타임은 playSceneOverlays 의 「ending-music」.
 * 새 엔딩·이벤트는 만들지 않는다 — 걸 자리가 없으면 거절한다(2026-10-30 실조수: 엔딩곡 자리가 없어 엔딩 이벤트를 새로 지었다).
 */
function setEndingMusic(p:Project,id:string,endingIds:readonly string[]){
  const endings=p.endings??[];
  const unknown=endingIds.filter(e=>!endings.some(ending=>ending.id===e));
  if(unknown.length)throw new ToolError('없는 엔딩: '+unknown.join(', ')+' — list_endings 로 id 를 확인하라: '+endings.slice(0,12).map(e=>`${e.id}(${e.name})`).join(', '),{code:'ending-not-found'});
  const picked=endingIds.length?endings.filter(e=>endingIds.includes(e.id)):endings;
  for(const ending of picked)ending.presentation={...(ending.presentation??{}),musicResourceId:id};
  const commands:{mapId:string;eventId:string}[]=[];
  if(!endingIds.length){
    for(const [mapId,map] of Object.entries(p.maps))for(const event of map.events??[])eachCommandList(event,list=>{for(const c of list)if(c.kind==='ending'){c.presentation={...((c.presentation as Record<string,unknown>|undefined)??{}),musicResourceId:id};commands.push({mapId,eventId:event.id});}});
    for(const ce of p.commonEvents??[])eachCommandList(ce,list=>{for(const c of list)if(c.kind==='ending'){c.presentation={...((c.presentation as Record<string,unknown>|undefined)??{}),musicResourceId:id};commands.push({mapId:'(공통 이벤트)',eventId:String((ce as {id?:unknown}).id??'')});}});
  }
  if(!picked.length&&!commands.length)throw new ToolError('곡을 걸 엔딩이 없습니다(정의된 엔딩도, 이벤트의 엔딩 명령도 없음). 음악만 바라는 요청이면 엔딩을 새로 만들지 말고 곡을 넣어 둔 채 보고에 적으세요.',{code:'ending-not-found'});
  return {endingIds:picked.map(e=>e.id),commands};
}
/** 이벤트 명령 배열만 돈다 — 이동 경로(moves·route·movement)의 setSwitch 는 이동 명령이라 곡 명령을 끼우면 안 된다. */
const ROUTE_KEYS=new Set(['moves','route','moveRoute','movement','conditions','trigger','graphic']);
function eachScriptList(node:unknown,visit:(list:Cmd[])=>void,depth=0):void{
  if(depth>24||!node||typeof node!=='object')return;
  if(Array.isArray(node)){if(node.some(item=>item&&typeof item==='object'&&'kind' in (item as object)))visit(node as Cmd[]);for(const item of node)eachScriptList(item,visit,depth+1);return;}
  for(const [key,value] of Object.entries(node as Record<string,unknown>))if(!ROUTE_KEYS.has(key)&&value&&typeof value==='object')eachScriptList(value,visit,depth+1);
}
const MEMORIZE_BGM='m2-063-memorize-current-bgm',PLAY_MEMORIZED_BGM='m2-064-play-memorized-bgm';
const isM2=(c:Cmd|undefined,id:string)=>!!c&&c.kind==='m2Command'&&c.commandId===id;
const isBgmPlay=(c:Cmd|undefined)=>!!c&&c.kind==='playAudio'&&(c.channel==='bgm'||c.channel===undefined&&c.loop===true);
/** 추격 곡 켜기 묶음: 「스위치가 아직 꺼져 있으면 → 현재 BGM 기억 + 곡 재생」. */
const isChaseCue=(c:Cmd|undefined,switchId:string)=>{
  if(!c||c.kind!=='fork')return false;
  const cond=c.condition as {kind?:unknown;switchId?:unknown;value?:unknown}|undefined,then=c.then as Cmd[]|undefined;
  return cond?.kind==='switch'&&cond.switchId===switchId&&cond.value===false&&Array.isArray(then)&&then.length===2&&isM2(then[0],MEMORIZE_BGM)&&isBgmPlay(then[1]);
};
/**
 * 추격 곡(아오오니식): 추격자(movement.type 'chase' 페이지)가 나타날 때 곡을 바꾸고 끝나면 되돌린다. 추격자는 만들지 않는다 — 없으면 거절.
 * - 스위치로 깨우는 추격자(페이지 조건 switch=ON): 그 스위치를 켜는 명령 바로 앞에 「(스위치가 아직 꺼져 있으면) 현재 BGM 기억 + 곡 재생」, 끄는 명령 바로 뒤에 「기억한 BGM 재생」.
 *   그리고 그 맵에 bgmWhileSwitch(스위치가 켜진 동안의 진입 곡)를 남겨, 켜진 채 다시 들어오거나 패배 복구해도 추격 곡이 이어지게 한다.
 * - 늘 있는 추격자(조건 없음) 또는 켜는 명령을 못 찾은 추격자: 그 맵이 곧 추격 무대이므로 맵 배경음을 추격 곡으로(맵을 나가면 다음 맵 곡으로 돌아온다).
 * 이미 걸려 있으면 곡만 바꾼다. 2026-10-30 실조수 e2e: 「아오오니 느낌으로 추격 음악」이 모든 전투(battle-default)에 걸렸다.
 */
/**
 * mapIds 가 틀렸을 때 고칠 수 있게 실제 맵 id·이름을 돌려준다. 2026-10-30 실조수: 타일셋 id(beodeul_city)를 mapIds 에 넣고
 * 「실제 mapIds가 필요합니다」만 받았다. 시작 맵을 앞에 두고 표시한다 — 맵을 말하지 않은 음악 요청은 시작 맵에 건다.
 */
export function mapIdsError(p:Project,given:readonly unknown[]):string{
  const bad=given.filter(m=>typeof m!=='string'||!p.maps[m]).map(m=>String(m));
  const tilesets=bad.filter(m=>Object.hasOwn(p.tilesets??{},m));
  const ids=Object.keys(p.maps);const start=p.startMapId&&p.maps[p.startMapId]?p.startMapId:undefined;
  const ordered=start?[start,...ids.filter(id=>id!==start)]:ids;
  const list=ordered.slice(0,24).map(id=>`${id}(${p.maps[id]!.name||id}${id===start?', 시작 맵':''})`).join(', ')+(ordered.length>24?` 외 ${ordered.length-24}개`:'');
  const head=!given.length?'mapIds 가 비었다.':`없는 mapIds: ${bad.join(', ')}.`;
  return `${head}${tilesets.length?` ${tilesets.join(', ')} 는 타일셋 id 다 — 맵 id 를 넣어라.`:''} 실제 맵: ${list||'없음'}. 사용자가 맵을 말하지 않았으면 시작 맵(지금 보는 맵)에 건다.`;
}
function setChaseMusic(p:Project,id:string,mapIds:readonly string[]){
  const scope=mapIds.length?mapIds:Object.keys(p.maps);
  const chasers:{mapId:string;eventId:string;switches:string[]}[]=[];
  for(const mapId of scope)for(const event of p.maps[mapId]?.events??[])for(const page of event.pages??[]){
    if((page as {movement?:{type?:unknown}}).movement?.type!=='chase')continue;
    const switches=(page.conditions??[]).flatMap(c=>c.kind==='switch'&&c.value===true?[c.switchId]:[]);
    chasers.push({mapId,eventId:event.id,switches});
  }
  if(!chasers.length)throw new ToolError(`추격자가 없습니다${mapIds.length?`(맵 ${mapIds.join(', ')})`:''} — 추격 곡은 추격자(make_chase_scene 이 만든 movement:chase 이벤트)가 나타날 때 겁니다. 음악만 바라는 요청이면 추격자를 새로 만들지 말고 곡을 넣어 둔 채 보고에 적으세요. 전투 곡(battle-default)에 걸지 마세요.`,{code:'chaser-not-found'});
  const want=new Set(chasers.flatMap(c=>c.switches)),on=new Set<string>(),cues:{mapId:string;eventId:string;switchId:string;at:'start'|'end'}[]=[];
  const lists:{list:Cmd[];mapId:string;eventId:string}[]=[];
  for(const [mapId,map] of Object.entries(p.maps))for(const event of map.events??[])eachScriptList(event,list=>lists.push({list,mapId,eventId:event.id}));
  for(const ce of p.commonEvents??[])eachScriptList(ce,list=>lists.push({list,mapId:'(공통 이벤트)',eventId:String((ce as {id?:unknown}).id??'')}));
  for(const {list,mapId,eventId} of lists){
    for(let i=0;i<list.length;i++){
      const c=list[i]!;
      if(c.kind!=='setSwitch'||typeof c.switchId!=='string'||!want.has(c.switchId))continue;
      if(c.value===true){
        // 이미 켜져 있으면(금고를 다시 조사) 기억하지 않는다 — 추격 곡을 «평소 곡»으로 덮어 끌 때 되돌아오지 않았다(2026-10-30 출하 플레이어 확인).
        const cue={kind:'fork',condition:{kind:'switch',switchId:c.switchId,value:false},then:[{kind:'m2Command',commandId:MEMORIZE_BGM,fields:{}},{kind:'playAudio',resourceId:id,loop:true,channel:'bgm'}]};
        if(isChaseCue(list[i-1],c.switchId))list[i-1]=cue;
        else if(isBgmPlay(list[i-1])&&isM2(list[i-2],MEMORIZE_BGM)){list.splice(i-2,2,cue);i--;}
        else{list.splice(i,0,cue);i++;}
        on.add(c.switchId);cues.push({mapId,eventId,switchId:c.switchId,at:'start'});
      }else if(c.value===false){
        if(!isM2(list[i+1],PLAY_MEMORIZED_BGM))list.splice(i+1,0,{kind:'m2Command',commandId:PLAY_MEMORIZED_BGM,fields:{}});
        cues.push({mapId,eventId,switchId:c.switchId,at:'end'});
      }
    }
  }
  const mapBgm=[...new Set(chasers.filter(c=>!c.switches.some(sw=>on.has(sw))).map(c=>c.mapId))];
  for(const mapId of mapBgm)p.maps[mapId]!.bgm={mode:'custom',resourceId:id};
  // 켜는 순간의 곡 바꾸기만으로는 추격 상태를 따라가지 못한다 — 스위치가 켜진 채 맵에 다시 들어오거나 잡혀서 다시 시작하면
  // 맵 진입 곡(평소 곡)이 다시 깔렸다(2026-10-30 실조수 e2e). 그래서 추격자 맵에 「이 스위치가 켜진 동안의 진입 곡」을 남긴다.
  const whileOn:{mapId:string;switchId:string}[]=[];
  for(const c of chasers)for(const switchId of c.switches){
    if(!on.has(switchId)||whileOn.some(w=>w.mapId===c.mapId&&w.switchId===switchId))continue;
    const map=p.maps[c.mapId]!,list=(map.bgmWhileSwitch??=[]),found=list.find(entry=>entry.switchId===switchId);
    if(found)found.resourceId=id;else list.push({switchId,resourceId:id});
    whileOn.push({mapId:c.mapId,switchId});
  }
  return {chasers:chasers.map(c=>({mapId:c.mapId,eventId:c.eventId,via:c.switches.some(sw=>on.has(sw))?'switch':'map-bgm'})),cues,mapBgm,whileOn};
}
export const MUSIC_AUTHORING_TOOLS:readonly ToolDefinition[]=[
  tool('get_music_composer','새 음악을 실제 WAV로 만드는 악보·악기·루프 계약. 기존 BGM 선택과 구분.','read',schema({},[]),()=>({summary:'음표를 저작해 독립된 실제 스테레오 WAV를 만들 수 있습니다.',data:{
    method:'Original symbolic score, deterministic local synthesis; not remote studio/vocal generation. Notes are the actual audible composition, not labels or copied game music.',
    score:'{version:1,bpm:45..200,meter:3|4,bars:1..32,key:string,loop:boolean,seed:uint32,tracks:[{id,voice,gain:0..1,pan:-1..1?,notes:[{beat,length,midi:24..96,velocity:0..1?}]}]}',
    resourceIdContract:'Use composed_music_<unique_name> only, e.g. composed_music_starlight_promise. An omitted or empty ID generates a UUID. Existing uploads require replace:true.',
    voices:MUSIC_VOICES,limits:MUSIC_SCORE_LIMITS,quarterNotes:'beat1 is one quarter note; fractional beats supported; end must fit bars*meter',
    arrangement:'Write an original memorable lead motif, answer phrase, independent bass/chords/arpeggio and rhythmic rests. Use rests by leaving gaps. Stage track entries at the story beats; avoid all voices sounding continuously.',
    loop:'Release tails wrap periodically for loop:true; one-shots fade their final60ms. Peak normalized to0.78; native HTML audio does not promise sample-accurate gap-free looping.',
    workflow:['compose_music','get_music_score','set_game_audio','native human audition'],
    listening:'Pi model receives symbolic score and actual sample measurements, not audio. Do not claim you heard it. Humans can audition the registered WAV in the resource picker or published audio player.',
    example:{version:1,bpm:100,meter:4,bars:2,key:'D minor',loop:true,seed:17,tracks:[{id:'lead',voice:'bell',gain:.45,notes:[{beat:0,length:1,midi:74},{beat:1.5,length:.5,midi:77},{beat:2,length:1,midi:81},{beat:4,length:1.5,midi:79},{beat:6,length:1,midi:77}]}]},
  }})),
  tool('compose_music','실제 음표·리듬·악기 악보를 스테레오 WAV로 합성하여 프로젝트 음악 리소스로 등록. 기존 ID 교체는 replace:true.','write',schema({resourceId:str,name:str,score:obj,replace:{type:'boolean'}},['name','score']),(p,args)=>{
    const id=(args.resourceId===undefined||args.resourceId==='')?'composed_music_'+crypto.randomUUID():text(args.resourceId),name=text(args.name);
    if(!/^composed_music_[A-Za-z0-9_-]+$/.test(id)||p.resourceProfiles.some(r=>r.assetId===id)&&!p.assets.uploaded[id]||resolveAssetResourceUrl(id)) {
      if(!p.assets.uploaded[id]||!/^composed_music_[A-Za-z0-9_-]+$/.test(id))throw new ToolError('새 작곡 ID는 composed_music_ 이름공간을 사용해야 합니다.',{code:'invalid-args'});
    }
    if(p.assets.uploaded[id]&&args.replace!==true)throw new ToolError('기존 음악입니다. 교체는 replace:true로 명시하세요.',{code:'resource-exists'});
    if(p.assets.uploaded[id]&&p.assets.uploaded[id].kind!=='music')throw new ToolError('다른 종류 리소스 ID는 덮을 수 없습니다.',{code:'invalid-args'});
    const score=structuredClone(args.score) as MusicScore;let rendered;
    try{rendered=renderMusicScore(score);}catch(e){throw new ToolError(String(e),{code:'invalid-args'});}
    const dataUrl=musicDataUrl(rendered.bytes);
    const existing=p.meta.oprnMusicScores??{};
    if(!existing[id]&&Object.keys(existing).length>=32)throw new ToolError('저장된 악보는 최대32개입니다.',{code:'too-many-scores'});
    const total=Object.entries(existing).reduce((n,[key,v])=>n+(key===id?0:v.measurements.frames*4+44),rendered.bytes.length);
    if(total>48*1024*1024)throw new ToolError('저작 WAV 총량은48MB까지입니다.',{code:'music-budget'});
    const sha=sha256(rendered.bytes);
    p.assets.uploaded[id]={id,name,kind:'music',dataUrl,meta:{}};
    p.meta.oprnMusicScores={...existing,[id]:{score,measurements:rendered.measurements,sha256:sha}};
    return {summary:`새 음악 「${name}」을 실제 WAV로 만들었습니다. 청취 검증은 별도입니다.`,data:{resourceId:id,name,bytes:rendered.bytes.length,...rendered.measurements,nativePlaybackVerified:false,modelHeardAudio:false}};
  }),
  tool('get_music_score','저작 악보와 실제 WAV 측정값 조회. trackId로 한 파트만 조회 가능.','read',schema({resourceId:str,trackId:str},['resourceId']),(p,args)=>{
    const id=text(args.resourceId),stored=p.meta.oprnMusicScores?.[id];if(!stored||p.assets.uploaded[id]?.kind!=='music')throw new ToolError('이 음악의 작곡 악보가 없습니다.',{code:'score-not-found'});
    const asset=p.assets.uploaded[id],actual=asset.ref?.sha256??sha256(wavBytes(asset.dataUrl??''));
    if(actual!==stored.sha256)throw new ToolError('음악 바이트가 바뀌어 악보 측정값이 유효하지 않습니다.',{code:'score-stale'});
    const score={...stored.score,tracks:args.trackId?stored.score.tracks.filter(t=>t.id===args.trackId):stored.score.tracks};
    if(!score.tracks.length)throw new ToolError('해당 파트가 없습니다.',{code:'track-not-found'});
    return {summary:'실제로 합성한 악보와 측정값입니다. 음악 청취를 대신하지 않습니다.',data:{resourceId:id,...stored,score}};
  }),
  tool('set_game_audio','타이틀/오프닝/필드/전투/승리·패배/메뉴 효과음/지정 맵/보스전에 실제 리소스를 연결. 종류와 대상 검증 후 변경. 맵 배경음은 role:maps+mapIds(맵 id — 타일셋 id 아님. 사용자가 맵을 말하지 않았으면 시작 맵·지금 보는 맵에 건다, 곡과 이름이 비슷한 맵을 고르지 않는다), 모든 전투는 battle-default, 승리 팡파르는 victory(짧은 곡), 보스전만은 role:boss(+troopIds — 비우면 이름에 보스·마왕·드래곤 등이 든 부대) — 그 전투 직전에 곡을 바꾸고 끝나면 되돌리는 명령을 넣는다. 엔딩·크레딧 곡은 role:ending(+endingIds — 비우면 모든 엔딩과 이벤트의 엔딩 명령). 추격 곡(쫓아올 때)은 role:chase(+mapIds — 추격자가 있는 맵, 비우면 모든 추격자): 스위치로 깨우는 추격자는 그 스위치를 켤 때 곡을 바꾸고 끌 때 되돌리며 스위치가 켜진 동안은 그 맵에 다시 들어오거나 잡혀서 다시 시작해도 추격 곡이 이어지고, 늘 있는 추격자는 그 맵 배경음이 된다. 추격자가 없으면 거절한다(새로 만들지 말 것) — 추격 곡을 전투 곡에 걸지 않는다.','write',schema({role:{type:'string',enum:[...ROLES]},resourceId:str,mapIds:{type:'array',items:str},troopIds:{type:'array',items:str},endingIds:{type:'array',items:str}},['role','resourceId']),(p,args)=>{
    const role=String(args.role),id=text(args.resourceId);if(!(ROLES as readonly string[]).includes(role))throw new ToolError('오디오 역할 오류.',{code:'invalid-args'});
    const kind=['cursor','confirm','cancel','defeat'].includes(role)?'sound':'music';
    playable(p,id,kind);
    let maps:string[]=[];
    const mapList=Array.isArray(args.mapIds)?(args.mapIds as unknown[]):[];
    if(role==='chase'){
      if(mapList.some(m=>typeof m!=='string'||!p.maps[m]))throw new ToolError(mapIdsError(p,mapList),{code:'map-not-found'});
      if(args.troopIds!==undefined||Array.isArray(args.endingIds)&&args.endingIds.length)throw new ToolError('chase 역할은 mapIds 만 받습니다.',{code:'invalid-args'});
      const done=setChaseMusic(p,id,[...new Set(mapList as string[])]);
      const viaSwitch=done.chasers.filter(c=>c.via==='switch').length;
      return {summary:`추격자 ${done.chasers.length}명에 추격 곡을 걸었습니다${viaSwitch?` — 추격 스위치를 켜는 곳 ${done.cues.filter(c=>c.at==='start').length}곳에서 곡을 바꾸고 끄는 곳 ${done.cues.filter(c=>c.at==='end').length}곳에서 되돌림, 켜진 동안 맵에 다시 들어오거나 다시 시작해도 추격 곡`:''}${done.mapBgm.length?` — 늘 있는 추격자의 맵 ${done.mapBgm.length}개는 맵 배경음을 추격 곡으로(맵을 나가면 돌아옴)`:''}.`,data:{role,resourceId:id,kind,...done,verificationScope:'authored-binding'}};
    }
    if(role==='maps'){if(!Array.isArray(args.mapIds)||!args.mapIds.length||args.mapIds.length>256||args.mapIds.some(id=>typeof id!=='string'||!p.maps[id]))throw new ToolError(mapIdsError(p,mapList),{code:'map-not-found'});maps=[...new Set(args.mapIds as string[])];}
    else if(args.mapIds!==undefined&&!(Array.isArray(args.mapIds)&&args.mapIds.length===0))throw new ToolError('mapIds는 maps·chase 역할에서만 사용합니다.',{code:'invalid-args'});
    if(args.troopIds!==undefined&&role!=='boss')throw new ToolError('troopIds는 boss 역할에서만 사용합니다.',{code:'invalid-args'});
    const endingIds=Array.isArray(args.endingIds)?(args.endingIds as unknown[]).filter((e):e is string=>typeof e==='string'):[];
    if(endingIds.length&&role!=='ending')throw new ToolError('endingIds는 ending 역할에서만 사용합니다.',{code:'invalid-args'});
    if(role==='ending'){
      const done=setEndingMusic(p,id,endingIds);
      return {summary:`엔딩 ${done.endingIds.length}개${done.commands.length?`·엔딩 명령 ${done.commands.length}곳`:''}에 곡을 걸었습니다(엔딩 화면이 뜰 때 재생).`,data:{role,resourceId:id,kind,endingIds:done.endingIds,endingCommands:done.commands,verificationScope:'authored-binding'}};
    }
    if(role==='boss'){
      const troops=p.database.troops??[];
      const given=Array.isArray(args.troopIds)?(args.troopIds as unknown[]).filter((t):t is string=>typeof t==='string'):[];
      const unknown=given.filter(t=>!troops.some(troop=>troop.id===t));
      if(unknown.length)throw new ToolError('없는 부대: '+unknown.join(', ')+' — get_database_records(troops)로 id 를 확인하라.',{code:'troop-not-found'});
      // 이름으로 고를 때는 실제로 전투 명령이 있는 부대만(2026-10-25 실조수: 쓰지 않는 「붉은 드래곤」만 잡혀 구미호 보스전을 못 찾았다).
      const fought=new Set<string>();
      for(const map of Object.values(p.maps))for(const event of map.events??[])eachCommandList(event,list=>{for(const c of list)if(c.kind==='battleProcessing'&&typeof c.troopId==='string')fought.add(c.troopId);});
      for(const ce of p.commonEvents??[])eachCommandList(ce,list=>{for(const c of list)if(c.kind==='battleProcessing'&&typeof c.troopId==='string')fought.add(c.troopId);});
      const ids=given.length?given:troops.filter(troop=>fought.has(troop.id)&&BOSS_NAME.test(troop.name??'')).map(troop=>troop.id);
      if(!ids.length)throw new ToolError('보스 부대를 찾지 못했습니다. troopIds 로 보스 부대 id 를 주세요(전투 명령이 있는 부대): '+troops.filter(t=>fought.has(t.id)).slice(0,12).map(t=>`${t.id}(${t.name})`).join(', '),{code:'troop-not-found'});
      const touched=setBossBattleMusic(p,id,ids);
      if(!touched.length)throw new ToolError('이 부대와 싸우는 전투 명령(battleProcessing)이 맵 이벤트에 없습니다: '+ids.join(', ')+'. 보스 이벤트를 먼저 만들거나, 보이는 적·조우 전투라면 battle-default 를 쓰세요.',{code:'battle-not-found'});
      return {summary:`보스전 ${touched.length}곳에 곡을 걸었습니다(그 전투 직전에 바꾸고 끝나면 기본 전투 곡으로 되돌림).`,data:{role,resourceId:id,kind,troopIds:ids,battles:touched,verificationScope:'authored-binding'}};
    }
    if(role==='opening'&&!p.system.opening)throw new ToolError('먼저 오프닝을 저작하세요.',{code:'opening-not-found'});
    if(role==='title'&&!p.system.titleScreen)throw new ToolError('먼저 타이틀을 저작하세요.',{code:'title-not-found'});
    switch(role){
      case 'title':p.system.titleScreen!.musicResourceId=id;break;
      case 'opening':p.system.opening!.musicResourceId=id;break;
      case 'field-default':p.system.defaultBgmResourceId=id;break;
      case 'battle-default':p.system.battleBgmResourceId=id;break;
      case 'victory':p.system.battleVictoryMeResourceId=id;break;
      case 'defeat':p.system.battleDefeatSeResourceId=id;break;
      case 'maps':for(const mapId of maps)p.maps[mapId].bgm={mode:'custom',resourceId:id};break;
      default:
        p.meta.oprnMenuSounds={...p.meta.oprnMenuSounds,[role]:id};
        if(p.system.titleScreen)p.system.titleScreen.sounds={...p.system.titleScreen.sounds,[role+'SeResourceId']:id};
    }
    return {summary:'실제 리소스를 지정한 게임 오디오 역할에 연결했습니다.',data:{role,resourceId:id,kind,mapIds:maps,verificationScope:'authored-binding',runtimePrecedence:'Session/M2 battle overrides may take precedence over battle-default; existing trainer events keep their authored cue.'}};
  }),
];
