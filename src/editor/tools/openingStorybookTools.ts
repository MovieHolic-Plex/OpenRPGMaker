import type { ToolDefinition, JsonSchema } from './types';
import { ToolError } from './types';
import { hasOpeningImage, catalogLookup } from './cinematicTools';
import { validateOpeningAnimatic } from '@/project/openingAnimatic';
import type { CinematicScene } from '@/project/types';
const str:JsonSchema={type:'string'};
const schema=(properties:Record<string,JsonSchema>,required:string[]):JsonSchema=>({type:'object',additionalProperties:false,properties,required});
export const OPENING_STORYBOOK_TOOLS:readonly ToolDefinition[]=[
  {name:'get_opening_direction',description:'서사 오프닝의 사건·읽기 시간·음악 모티프 기준. 그림책/시네마틱/대결 중 사용자 의도 우선.',mode:'read',parameters:schema({},[]),run:()=>({summary:'사건·문장·구도·음악의 인과를 먼저 설계합니다.',data:{
    recipes:[
      {style:'storybook',structure:'world -> rupture -> stakes -> invitation -> handoff',composition:'Black negative space; one high-contrast illustration above short original lines; one meaningful change per panel. Still panels and narration are valid choices.',motion:'Rare meaningful reveal, dimming light or moving silhouette; no ambient wobble on every actor.',music:'Original memorable motif, sparse first phrase, harmonic rupture, restrained reprise at invitation.',tool:'make_opening_storybook'},
      {style:'cinematic',structure:'Concrete action -> interruption -> consequence -> player hook',composition:'Consistent place and light; independent actors/foreground; contact and reaction.',tool:'create_opening_animatic_shot'},
      {style:'duel',structure:'Opposed actors -> anticipation -> impact -> reaction -> title',composition:'Contrasting silhouettes; supplied poses/frames for contact; short cuts with sound timing.',tool:'animate_opening_layer'},
    ],
    reviewQuestions:['What changed in this world?','Why does that matter?','What will the player do next?','Can every line be read before the cut?','Does the motif create anticipation?'],
    reference:'Study Undertale for negative space, illustrated story hierarchy and a memorable motif. Do not copy its lines, art, melody or characters. Quality equivalence is subjective; review actual results, never declare it from a completed flag.',
    note:'A narrated fable may intentionally use text and still panels. Do not force a character montage or reject narration because another request preferred acting.',
  }})},
  {name:'make_opening_storybook',description:'실제 그림과 원문으로 흑색 그림책 애니메이틱을 원자적으로 조립. 사건 역할·읽기 시간 검증. 맵·세션·타이틀 유지.',mode:'write',preservesAuthoredRaster:true,parameters:schema({
    slides:{type:'array',items:{type:'object',additionalProperties:false,required:['id','role','text','durationMs'],properties:{id:str,role:{type:'string',enum:['world','rupture','stakes','invitation','handoff']},imageResourceId:str,text:str,durationMs:{type:'integer'}}}},
    ink:{type:'string',enum:['amber','ivory']},musicResourceId:str,
  },['slides']),run:(p,args)=>{
    if(!Array.isArray(args.slides)||args.slides.length<4||args.slides.length>8)throw new ToolError('그림책은4..8 패널입니다.',{code:'invalid-args'});
    if(args.ink!==undefined&&!['amber','ivory'].includes(String(args.ink)))throw new ToolError('잉크 색상 오류.',{code:'invalid-args'});
    const ink=args.ink==='ivory'?'#f0e9d7':'#e8bc72',ids=new Set<string>(),roles=new Set<string>();const scenes:CinematicScene[]=[];
    for(const [index,raw] of args.slides.entries()){
      if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ToolError('패널 객체가 필요합니다.',{code:'invalid-args'});
      const row=raw as Record<string,unknown>;if(Object.keys(row).some(k=>!['id','role','imageResourceId','text','durationMs'].includes(k)))throw new ToolError('지원하지 않는 패널 필드.',{code:'invalid-args'});
      const {id,role,text,durationMs,imageResourceId}=row;
      if(typeof id!=='string'||!id.trim()||id.length>100||ids.has(id)||typeof role!=='string'||!['world','rupture','stakes','invitation','handoff'].includes(role))throw new ToolError('패널 ID/역할 오류.',{code:'invalid-args'});
      if(typeof text!=='string'||!text.trim()||[...text].length>80||text.split('\n').length>3)throw new ToolError('원문은1..80자, 최대3행입니다.',{code:'invalid-args'});
      if(!Number.isSafeInteger(durationMs)||Number(durationMs)<Math.max(2200,[...text.replace(/\s/g,'')].length/5*1000+700)||Number(durationMs)>15000)throw new ToolError('읽기 시간: 초당5자 +700ms, 2.2..15초를 확보하세요.',{code:'reading-time'});
      if(imageResourceId!==undefined&&(typeof imageResourceId!=='string'||!hasOpeningImage(p,imageResourceId)))throw new ToolError('실제 패널 그림이 없습니다.',{code:'resource-not-found'});
      if(index===0&&role!=='world'||index===args.slides.length-1&&role!=='handoff')throw new ToolError('첫 패널 world, 마지막 handoff가 필요합니다.',{code:'invalid-args'});
      ids.add(id);roles.add(role);const duration=Number(durationMs);
      const composition={width:960,height:720,background:'#000000',layers:[
        ...(imageResourceId?[{id:'illustration',kind:'image' as const,resourceId:imageResourceId as string,role:'background' as const,x:80,y:45,width:800,height:405,sampling:'nearest' as const,keys:{opacity:[{atMs:0,value:0},{atMs:450,value:1},{atMs:duration-300,value:1},{atMs:duration,value:0}]}}]:[]),
        {id:'narrative',kind:'text' as const,role:'credit' as const,text:text as string,color:ink,x:55,y:imageResourceId?492:250,width:850,height:170,typography:{fontSize:36,weight:500,align:'center' as const,typewriterMs:Math.min(1100,Math.round([...text].length*38))},startMs:350,keys:{opacity:[{atMs:0,value:0},{atMs:400,value:1},{atMs:duration-200,value:1},{atMs:duration,value:0}]}},
      ]};validateOpeningAnimatic(composition,duration);scenes.push({id,kind:'animatic',narration:'',durationMs:duration,composition});
    }
    if(!['world','rupture','stakes','handoff'].every(r=>roles.has(r)))throw new ToolError('세계·균열·위기·플레이 진입을 포함하세요.',{code:'story-incomplete'});
    if(args.musicResourceId!==undefined&&(typeof args.musicResourceId!=='string'||!catalogLookup(p)('music',args.musicResourceId)))throw new ToolError('실제 음악이 없습니다.',{code:'resource-not-found'});
    p.system.opening={enabled:true,skippable:true,scenes,...(p.system.opening?.entry?{entry:p.system.opening.entry}:{}),...(args.musicResourceId?{musicResourceId:args.musicResourceId as string}:p.system.opening?.musicResourceId?{musicResourceId:p.system.opening.musicResourceId}:{})};
    return {summary:'패널을 실제 타임라인으로 조립했습니다. 마지막 수정 후 실제 프레임과 음악을 별도로 검토하세요.',data:{shots:scenes.length,durationMs:scenes.reduce((n,s)=>n+(s.durationMs??0),0),roles:[...roles],nativePlaybackVerified:false}};
  }},
];
