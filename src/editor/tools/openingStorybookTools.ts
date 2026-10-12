import type { ToolDefinition, JsonSchema } from './types';
import { ToolError } from './types';
import { hasOpeningImage, catalogLookup } from './cinematicTools';
import { validateOpeningAnimatic } from '@/project/openingAnimatic';
import { validateOpeningPortraitMotion } from '@/project/openingPortraitMotion';
import { isEmeraldMonsterStyle } from '@/project/emeraldMonsterStyle';
import type { CinematicScene } from '@/project/types';
const str:JsonSchema={type:'string'};
const schema=(properties:Record<string,JsonSchema>,required:string[]):JsonSchema=>({type:'object',additionalProperties:false,properties,required});
export const OPENING_STORYBOOK_TOOLS:readonly ToolDefinition[]=[
  {name:'get_opening_direction',description:'서사 오프닝의 사건·읽기 시간·음악 모티프 기준. 그림책/시네마틱/대결 중 사용자 의도 우선.',mode:'read',parameters:schema({},[]),run:()=>({summary:'사건·문장·구도·음악의 인과를 먼저 설계합니다.',data:{
    recipes:[
      {style:'storybook',structure:'world -> rupture -> stakes -> invitation -> handoff',composition:'Black negative space; one high-contrast illustration above short original lines; Keep the illustration while Enter advances short lines. No timer or repeated fades by default. Still panels and narration are valid choices.',motion:'Rare meaningful reveal, dimming light or moving silhouette; no ambient wobble on every actor.',music:'Original memorable motif, sparse first phrase, harmonic rupture, restrained reprise at invitation.',tool:'make_opening_storybook'},
      {style:'cinematic',structure:'Concrete action -> interruption -> consequence -> player hook',composition:'Consistent place and light; independent actors/foreground; contact and reaction.',tool:'create_opening_animatic_shot'},
      {style:'duel',structure:'Opposed actors -> anticipation -> impact -> reaction -> title',composition:'Contrasting silhouettes; supplied poses/frames for contact; short cuts with sound timing.',tool:'animate_opening_layer'},
      {style:'ingame-cutscene',structure:'black/letterbox -> camera over the REAL start map -> actors move in rhythm -> weather/particles/SE -> fade -> title text -> hand control to the player',composition:'FF6 Narshe march: the opening IS a scripted scene on the start map, not a slideshow. Build the map, place the actors, then script_cutscene_staged/script_cutscene on the start map with trigger auto + once.',motion:'moveActor lines in step, camera pan/follow, weather snow, shake on footfalls, letterbox, music + footstep SE beats.',tool:'script_cutscene_staged'},
      {style:'pixel-march',structure:'black -> wide establishing pan -> small figures crossing in rhythm -> close detail -> hold on emptiness -> title on black',composition:'FF6/16-bit style: NO narration text; pixel-art technique artStyle (visible square pixels, 32-colour palette, dithered gradients), very wide stills with slow camera pan, tiny silhouettes against a huge night landscape, 4:3 letterbox. Music and rhythmic footsteps/wind SE carry the mood; title card appears only after the last image goes dark.',motion:'animate_opening_camera slow pan/zoom 8-14s per shot; direction.sounds footstep loop every ~600ms; hard cut or long fade to black before the title.',tool:'create_opening_animatic_shot'},
      {style:'title-card',structure:'black -> logo fade -> one slow light sweep -> menu',composition:'Almost no scene. A single strong emblem and logo on dark; leans on music. Use generate_title_art with an emblem focal point and logoStyle matching the palette.',tool:'generate_title_art'},
      {style:'trailer-montage',structure:'hook image -> fast cuts of place/cast/threat -> one beat of silence -> title',composition:'6-10 short cuts (1.5-3s), each a different angle and subject; SE hits on cuts via direction.sounds; no sentences, only 1-3 word captions at most.',tool:'set_opening'},
      {style:'memory-fragment',structure:'present -> blurred recollection -> contradiction -> return',composition:'Desaturated recollection shots with a softer text layout (memory preset), one object recurring in every shot.',tool:'edit_opening'},
      {style:'credits-roll',structure:'staff roll over slow scenery -> title',composition:'preset credits (scroll), scenery stills with slow pans, music-driven.',tool:'set_opening'},
    ],
    reviewQuestions:['What changed in this world?','Why does that matter?','What will the player do next?','Can every line be read before the cut?','Does the motif create anticipation?'],
    reference:'Study Undertale for negative space, illustrated story hierarchy and a memorable motif. Do not copy its lines, art, melody or characters. Quality equivalence is subjective; review actual results, never declare it from a completed flag.',
    note:'A narrated fable may intentionally use text and still panels. Do not force a character montage or reject narration because another request preferred acting.',
    portraitMotion:{tool:'configure_opening_portrait_motion',presentation:'Emerald confirm-paced professor introduction',source:'Real horizontal pose strip; drawn blink/talk/gesture poses, not translated copies',contract:'resourceId, frameWidth, frameHeight, frameCount(2..32), frames(0-based order), fps(1..12), optional sceneFrames keyed by existing page IDs. Same controller and active-time clock survive Enter; no page timer or music restart.'},
  }})},
  {name:'configure_opening_portrait_motion',description:'Enter 확인식 에메랄드 교수 오프닝에 실제 포즈 스트립을 연결. 눈깜빡임·말하기·손짓을 기존 페이지 안에서 재생하며 음악·진행 시간을 바꾸지 않는다.',mode:'write',preservesAuthoredRaster:true,parameters:schema({
    portraitResourceId:str,
    motion:schema({resourceId:str,frameWidth:{type:'integer'},frameHeight:{type:'integer'},frameCount:{type:'integer'},frames:{type:'array',items:{type:'integer'}},fps:{type:'number'},sceneFrames:{type:'object',additionalProperties:true}},['resourceId','frameWidth','frameHeight','frameCount','frames','fps']),
  },['portraitResourceId','motion']),run:(p,args)=>{
    const book=p.meta.oprnOpeningBook;
    if(!isEmeraldMonsterStyle(p)||!book||!p.system.opening?.scenes.every((s,i)=>s.id===book.sceneIds[i]&&s.durationMs===0&&(s.kind==='image'||s.kind==='text'))||p.system.opening.scenes.length!==book.sceneIds.length)throw new ToolError('현재 에메랄드 확인식 그림책 오프닝이 필요합니다.',{code:'invalid-args'});
    if(typeof args.portraitResourceId!=='string'||!hasOpeningImage(p,args.portraitResourceId))throw new ToolError('정지 교수 초상 그림이 필요합니다.',{code:'resource-not-found'});
    try{validateOpeningPortraitMotion(args.motion,book.sceneIds);}catch(error){throw new ToolError(error instanceof Error?error.message:'포즈 스트립 계약 오류.',{code:'invalid-args'});}
    if(!hasOpeningImage(p,args.motion.resourceId))throw new ToolError('실제 포즈 스트립 그림이 없습니다.',{code:'resource-not-found'});
    book.portraitResourceId=args.portraitResourceId;
    book.portraitMotion=structuredClone(args.motion);
    return {summary:'확인식 교수 포즈를 연결했습니다. 실제 프레임·원본 치수·Enter 진행은 플레이어에서 검증하세요.',data:{portraitResourceId:book.portraitResourceId,motion:book.portraitMotion,nativePlaybackVerified:false}};
  }},
  {name:'make_opening_storybook',description:'실제 그림과 원문으로 그림책 도입을 조립. 기본 confirm은 Enter를 기다리고 같은 그림에서 문장만 교체. auto는 명시적으로 요청한 타임라인.',mode:'write',preservesAuthoredRaster:true,parameters:schema({
    slides:{type:'array',items:{type:'object',additionalProperties:false,required:['id','role','text'],properties:{id:str,role:{type:'string',enum:['world','rupture','stakes','invitation','handoff']},imageResourceId:str,text:str,durationMs:{type:'integer'}}}},
    ink:{type:'string',enum:['amber','ivory']},musicResourceId:str,progression:{type:'string',enum:['confirm','auto']},
  },['slides']),run:(p,args)=>{
    if(!Array.isArray(args.slides)||args.slides.length<4||args.slides.length>8)throw new ToolError('그림책은4..8 패널입니다.',{code:'invalid-args'});
    if(args.ink!==undefined&&!['amber','ivory'].includes(String(args.ink)))throw new ToolError('잉크 색상 오류.',{code:'invalid-args'});
    if(args.progression!==undefined&&!['confirm','auto'].includes(String(args.progression)))throw new ToolError('진행 방식 오류.',{code:'invalid-args'});
    const automatic=args.progression==='auto';
    const ink=args.ink==='ivory'?'#f0e9d7':'#e8bc72',ids=new Set<string>(),roles=new Set<string>();const scenes:CinematicScene[]=[];
    for(const [index,raw] of args.slides.entries()){
      if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ToolError('패널 객체가 필요합니다.',{code:'invalid-args'});
      const row=raw as Record<string,unknown>;if(Object.keys(row).some(k=>!['id','role','imageResourceId','text','durationMs'].includes(k)))throw new ToolError('지원하지 않는 패널 필드.',{code:'invalid-args'});
      const {id,role,text,durationMs}=row;const imageResourceId=row.imageResourceId===''?undefined:row.imageResourceId;
      if(typeof id!=='string'||!id.trim()||id.length>100||ids.has(id)||typeof role!=='string'||!['world','rupture','stakes','invitation','handoff'].includes(role))throw new ToolError('패널 ID/역할 오류.',{code:'invalid-args'});
      if(typeof text!=='string'||!text.trim()||[...text].length>80||text.split('\n').length>3)throw new ToolError('원문은1..80자, 최대3행입니다.',{code:'invalid-args'});
      if(automatic&&(!Number.isSafeInteger(durationMs)||Number(durationMs)<Math.max(2200,[...text.replace(/\s/g,'')].length/5*1000+700)||Number(durationMs)>15000))throw new ToolError('읽기 시간: 초당5자 +700ms, 2.2..15초를 확보하세요.',{code:'reading-time'});
      if(imageResourceId!==undefined&&(typeof imageResourceId!=='string'||!hasOpeningImage(p,imageResourceId)))throw new ToolError('실제 패널 그림이 없습니다.',{code:'resource-not-found'});
      if(index===0&&role!=='world'||index===args.slides.length-1&&role!=='handoff')throw new ToolError('첫 패널 world, 마지막 handoff가 필요합니다.',{code:'invalid-args'});
      ids.add(id);roles.add(role);
      if(!automatic){scenes.push(imageResourceId?{id,kind:'image',resourceId:imageResourceId as string,narration:text,durationMs:0,motion:'none'}:{id,kind:'text',narration:text,durationMs:0});continue;}
      const duration=Number(durationMs);
      const composition={width:960,height:720,background:'#000000',layers:[
        ...(imageResourceId?[{id:'illustration',kind:'image' as const,resourceId:imageResourceId as string,role:'background' as const,x:120,y:45,width:720,height:405,sampling:'nearest' as const,keys:{opacity:[{atMs:0,value:0},{atMs:450,value:1},{atMs:duration-300,value:1},{atMs:duration,value:0}]}}]:[]),
        {id:'narrative',kind:'text' as const,role:'credit' as const,text:text as string,color:ink,x:55,y:imageResourceId?492:250,width:850,height:170,typography:{fontSize:36,weight:500,align:'center' as const,typewriterMs:Math.min(1100,Math.round([...text].length*38))},startMs:350,keys:{opacity:[{atMs:0,value:0},{atMs:400,value:1},{atMs:duration-200,value:1},{atMs:duration,value:0}]}},
      ]};validateOpeningAnimatic(composition,duration);scenes.push({id,kind:'animatic',narration:'',durationMs:duration,composition});
    }
    if(!['world','rupture','stakes','handoff'].every(r=>roles.has(r)))throw new ToolError('세계·균열·위기·플레이 진입을 포함하세요.',{code:'story-incomplete'});
    if(args.musicResourceId!==undefined&&args.musicResourceId!==''&&(typeof args.musicResourceId!=='string'||!catalogLookup(p)('music',args.musicResourceId)))throw new ToolError('실제 음악이 없습니다.',{code:'resource-not-found'});
    p.system.opening={enabled:true,skippable:true,scenes,...(p.system.opening?.entry?{entry:p.system.opening.entry}:{}),...(args.musicResourceId?{musicResourceId:args.musicResourceId as string}:p.system.opening?.musicResourceId?{musicResourceId:p.system.opening.musicResourceId}:{})};
    if(automatic)delete p.meta.oprnOpeningBook;else p.meta.oprnOpeningBook={version:1,sceneIds:scenes.map(s=>s.id),ink:args.ink==='ivory'?'ivory':'amber'};
    return {summary:automatic?'자동 타임라인을 조립했습니다. 실제 재생을 별도로 확인하세요.':'Enter로 넘기는 그림책을 조립했습니다. 자동 진행과 패널 페이드는 없습니다. 실제 재생을 별도로 확인하세요.',data:{progression:automatic?'auto':'confirm',shots:scenes.length,durationMs:scenes.reduce((n,s)=>n+(s.durationMs??0),0),roles:[...roles],nativePlaybackVerified:false}};
  }},
];
