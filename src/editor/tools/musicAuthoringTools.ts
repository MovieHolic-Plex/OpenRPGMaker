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
  const a=p.assets.uploaded[id],url=resolveAssetResourceUrl(id,{project:p});
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
const ROLES=['title','opening','field-default','battle-default','victory','defeat','cursor','confirm','cancel','maps'] as const;
export const MUSIC_AUTHORING_TOOLS:readonly ToolDefinition[]=[
  tool('get_music_composer','새 음악을 실제 WAV로 만드는 악보·악기·루프 계약. 기존 BGM 선택과 구분.','read',schema({},[]),()=>({summary:'음표를 저작해 독립된 실제 스테레오 WAV를 만들 수 있습니다.',data:{
    method:'Original symbolic score, deterministic local synthesis; not remote studio/vocal generation. Notes are the actual audible composition, not labels or copied game music.',
    score:'{version:1,bpm:45..200,meter:3|4,bars:1..32,key:string,loop:boolean,seed:uint32,tracks:[{id,voice,gain:0..1,pan:-1..1?,notes:[{beat,length,midi:24..96,velocity:0..1?}]}]}',
    voices:MUSIC_VOICES,limits:MUSIC_SCORE_LIMITS,quarterNotes:'beat1 is one quarter note; fractional beats supported; end must fit bars*meter',
    arrangement:'Write an original memorable lead motif, answer phrase, independent bass/chords/arpeggio and rhythmic rests. Use rests by leaving gaps. Stage track entries at the story beats; avoid all voices sounding continuously.',
    loop:'Release tails wrap periodically for loop:true; one-shots fade their final60ms. Peak normalized to0.78; native HTML audio does not promise sample-accurate gap-free looping.',
    workflow:['compose_music','get_music_score','set_game_audio','native human audition'],
    listening:'Pi model receives symbolic score and actual sample measurements, not audio. Do not claim you heard it. Humans can audition the registered WAV in the resource picker or published audio player.',
    example:{version:1,bpm:100,meter:4,bars:2,key:'D minor',loop:true,seed:17,tracks:[{id:'lead',voice:'bell',gain:.45,notes:[{beat:0,length:1,midi:74},{beat:1.5,length:.5,midi:77},{beat:2,length:1,midi:81},{beat:4,length:1.5,midi:79},{beat:6,length:1,midi:77}]}]},
  }})),
  tool('compose_music','실제 음표·리듬·악기 악보를 스테레오 WAV로 합성하여 프로젝트 음악 리소스로 등록. 기존 ID 교체는 replace:true.','write',schema({resourceId:str,name:str,score:obj,replace:{type:'boolean'}},['name','score']),(p,args)=>{
    const id=args.resourceId===undefined?'composed_music_'+crypto.randomUUID():text(args.resourceId),name=text(args.name);
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
  tool('set_game_audio','타이틀/오프닝/필드/전투/승리·패배/메뉴 효과음/지정 맵에 실제 리소스를 연결. 종류와 대상 검증 후 변경.','write',schema({role:{type:'string',enum:[...ROLES]},resourceId:str,mapIds:{type:'array',items:str}},['role','resourceId']),(p,args)=>{
    const role=String(args.role),id=text(args.resourceId);if(!(ROLES as readonly string[]).includes(role))throw new ToolError('오디오 역할 오류.',{code:'invalid-args'});
    const kind=['cursor','confirm','cancel','defeat'].includes(role)?'sound':'music';
    playable(p,id,kind);
    let maps:string[]=[];
    if(role==='maps'){if(!Array.isArray(args.mapIds)||!args.mapIds.length||args.mapIds.length>256||args.mapIds.some(id=>typeof id!=='string'||!p.maps[id]))throw new ToolError('실제 mapIds가 필요합니다.',{code:'map-not-found'});maps=[...new Set(args.mapIds as string[])];}
    else if(args.mapIds!==undefined)throw new ToolError('mapIds는 maps 역할에서만 사용합니다.',{code:'invalid-args'});
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
