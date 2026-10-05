import { inspectWorldAtlas } from '@/project/worldAtlasAudit';
import { authorWorldAtlas } from '@/editor/worldmap/atlasAuthoring';
import atlasExamples from '@/assets/worldAtlasExamples.json';
import { WORLD_ATLAS_CATALOG, WORLD_ATLAS_STRUCTURES } from '@/project/worldAtlas';
import { resolveReferenceImageDataUrl } from '@/project/bundledReferenceImages';
import { ToolError, type ToolDefinition } from './types';

function ids(args: Record<string,unknown>) {
  const base=String(args.id??'world_atlas');
  const structures=args.structure==='all'?[...WORLD_ATLAS_STRUCTURES]:[String(args.structure)];
  if(structures.some(s=>!WORLD_ATLAS_STRUCTURES.includes(s as never)))throw new ToolError('지원하지 않는 월드맵 구조입니다.');
  return structures.map(structure=>({structure:structure as typeof WORLD_ATLAS_STRUCTURES[number],id:args.structure==='all'?base+'_'+structure.replaceAll('-','_'):base}));
}

export async function worldAtlasReferenceImages(data: unknown) {
  const id=(data as {id?:unknown}|null)?.id;
  const example=atlasExamples.find(e=>e.id===id);
  if(!example)return [];
  return [{label:example.name+' · 정본 전체 지도',dataUrl:await resolveReferenceImageDataUrl(example.preview)}];
}

export const WORLD_ATLAS_TOOLS: readonly ToolDefinition[]=[{
  name:'list_worldmap_structures',mode:'read',domains:['map','world'],
  description:'월드맵 이동 구조 6종을 조회한다. 포켓몬 지역/도로, FF 축척 대륙, 젤다 필드, 마리오 스테이지, 할로우 나이트 방 발견, 슬레이 더 스파이어 일방향 런. 세계관 테마와 이동 구조는 서로 다른 선택이다.',
  parameters:{type:'object',properties:{},additionalProperties:false},
  run(){return {summary:'플레이 가능한 월드맵 구조 6종',data:{structures:WORLD_ATLAS_CATALOG,authorTool:'author_worldmap_structure',inspectTool:'inspect_worldmap_structure',referenceTool:'read_worldmap_structure_reference',examples:atlasExamples.map(e=>({id:e.id,name:e.name,preview:e.preview,sourceProjectId:e.sourceProjectId,authorArgs:e.authorArgs,mapCount:e.example.nodes.length+(e.example.overviewMapId?1:0)}))}};},
},{
  name:'read_worldmap_structure_reference',mode:'read',domains:['map','world'],
  description:'공용 월드맵 이동 방식의 정본 PNG·실행 지침·전체 장소/연결/해금 정의를 읽는다. 특정 게임 이름의 분위기와 실제 이동 구조를 구분한다.',
  parameters:{type:'object',properties:{structure:{type:'string',enum:[...WORLD_ATLAS_STRUCTURES]}},required:['structure'],additionalProperties:false},
  run(_project,args){const example=atlasExamples.find(e=>e.id===args.structure);if(!example)throw new ToolError('월드맵 구조가 없습니다.');return {summary:example.name+' · 정본 참고문서',data:example};},
},{
  name:'author_worldmap_structure',mode:'write',domains:['map','world'],preservesAuthoredRaster:true,
  description:'월드맵 구조를 실제 맵·문·해금 스위치·관문 이벤트와 함께 저작한다. region-routes=포켓몬 마을/도로, scaled-world=FF 걸을 대륙, field-overview=젤다 필드/열쇠, stage-nodes=마리오 클리어/비밀길, room-network=할로우 나이트 횡스크롤 방/발견/핀, run-path=슬레이 더 스파이어 일방향 선택. all은 여섯 구조를 함께 만든다. 기존 맵을 덮지 않는다. 지형은 새32px 공용 atlas_cartography를 쓰고 거점은 사람 승인 아이콘만 재사용한다. 필드는 이어지는 강·호수·절벽, 방은 서로 다른 실제 윤곽, 스테이지는 횡스크롤 코스로 만든다. 생성 후 inspect_worldmap_structure와 실제 화면을 확인한다.',
  parameters:{type:'object',properties:{id:{type:'string',description:'새 지도 묶음의 영문 소문자 id'},name:{type:'string'},structure:{type:'string',enum:[...WORLD_ATLAS_STRUCTURES,'all']},seed:{type:'integer'},setStart:{type:'boolean',description:'true이면 생성된 시작 맵을 게임 시작으로 지정(기본 false)'}},required:['id','structure'],additionalProperties:false},
  async prepare(args,project){
    const entries=ids(args);if(project?.worldAtlases?.some(a=>entries.some(e=>e.id===a.id))||project&&Object.keys(project.maps).some(id=>entries.some(e=>id.startsWith(e.id+'_'))))throw new ToolError('이미 있는 지도 id입니다. 새 id를 사용하세요.');

  },
  run(project,args){
    try {
      const entries=ids(args),seed=Number(args.seed??1);if(!Number.isSafeInteger(seed))throw new Error('seed는 정수입니다.');
      if(project.worldAtlases?.some(a=>entries.some(e=>e.id===a.id))||Object.keys(project.maps).some(id=>entries.some(e=>id.startsWith(e.id+'_'))))throw new Error('이미 있는 지도 id입니다. 새 id를 사용하세요.');
      const atlases=entries.map(entry=>{
        return authorWorldAtlas(project,{...entry,seed,...(typeof args.name==='string'&&entries.length===1?{name:args.name}:{}),
          ...(entry.structure==='scaled-world'?{overworldMapId:entry.id+'_overworld'}:{})});
      });
      const first=atlases[0]!,node=first.nodes.find(n=>n.id===first.startNodeId)!;
      if(args.setStart===true){project.startMapId=first.overviewMapId??node.mapId;project.startPos=first.overviewMapId?node.worldEntrance!:node.entry;}
      return {summary:`월드맵 ${atlases.length}종 · 실제 맵 ${atlases.reduce((sum,a)=>sum+a.nodes.length+(a.overviewMapId?1:0),0)}개 저작`,
        data:{atlasIds:atlases.map(a=>a.id),startMapId:project.startMapId,atlases:atlases.map(a=>({id:a.id,name:a.name,...inspectWorldAtlas(project,a),startNodeId:a.startNodeId,
          startMapId:a.overviewMapId??a.nodes.find(n=>n.id===a.startNodeId)!.mapId,maps:a.nodes.map(n=>({mapId:n.mapId,name:n.name,entry:n.entry,grants:n.grants}))})),
          help:'플레이 중 「세계 지도」 버튼 또는 M. 마을·필드·방은 실제 출입구로, 스테이지·런은 지도에서 열린 인접 장소를 고릅니다. 관문의 인물과 대화하면 클리어/해금됩니다.'}};
    }catch(error){throw new ToolError(error instanceof Error?error.message:String(error),{code:'world-atlas-authoring'});}
  },
},{
  name:'inspect_worldmap_structure',mode:'read',domains:['map','world'],
  description:'저작된 월드맵의 실제 맵·문 좌표·해금 조건·도달성과 자기 열쇠 뒤 관문 같은 순환을 검사한다. 지도 그림만 있는 경우와 실제 이동을 구분한다.',
  parameters:{type:'object',properties:{id:{type:'string'}},additionalProperties:false},
  run(project,args){const atlases=(project.worldAtlases??[]).filter(a=>!args.id||a.id===args.id);
    if(args.id&&!atlases.length)throw new ToolError('지도 묶음이 없습니다.');
    return {summary:`월드맵 ${atlases.length}종 검사`,data:{atlases:atlases.map(a=>({...a,audit:inspectWorldAtlas(project,a)}))}};},
}];
