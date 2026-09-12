import { isDeepStrictEqual } from "node:util";
import type { Project, SectionStructureKitDef, VillageDecorationRule } from "../../src/project/types";
import type { SpatialId, SpaceDesign, ObjectDesign } from "../../src/project/spatial/types";
const tilesetId = "easyrpg_chipset_combined_town";
type Prop = { id: string; name: string; lower?: number[][]; upper?: number[][] };
// Complete atoms from the inspected Combined Town atlas. No guessed sprites,
// wall signs on empty ground, isolated canopy halves, or log house wall cells.
const PROPS: Prop[] = [
  { id:"flower",name:"작은 꽃밭",upper:[[288,288]] },
  { id:"pots",name:"화분과 물항아리",upper:[[351,352]] },
  { id:"wood",name:"장작과 도구 상자",upper:[[349,237]] },
  { id:"produce",name:"수확물 상자",upper:[[202,203]] },
  { id:"table",name:"작업 탁자",upper:[[234,235,236]] },
  { id:"bench",name:"가로 벤치",upper:[[327,328]] },
  { id:"barrel",name:"저장 통",upper:[[177]] },
  { id:"jar",name:"물항아리",upper:[[352]] },
  { id:"sign",name:"자립 팻말",upper:[[440]] },
  { id:"fence",name:"짧은 울타리",upper:[[439,379,409]] },
  { id:"well",name:"석조 우물",upper:[[382]] },
  { id:"tent",name:"장터의 천막",upper:[[447,448,449],[477,478,479]] },
  { id:"dock",name:"두 칸 폭의 나무 잔교",lower:[[228,229],[228,229],[228,229]] },
  { id:"field",name:"새싹 이랑",lower:[[126,157,128],[216,217,218]] },
  { id:"hedge",name:"낮은 덤불",upper:[[289]] },
  { id:"rock",name:"물가 돌무더기",upper:[[29,59]] },
];
type Recipe = { id:string;name:string;zone:VillageDecorationRule["zone"];maxCount:number;w:number;h:number;slots:[string,number,number][];port:[number,number] };
export const VILLAGE_DECORATION_RECIPES: Recipe[] = [
  {id:"flower-yard",name:"꽃과 화분이 있는 앞마당",zone:"house",maxCount:6,w:4,h:2,slots:[["flower",0,0],["pots",2,0]],port:[1,1]},
  {id:"kitchen-yard",name:"작은 텃밭과 수확물",zone:"house",maxCount:6,w:5,h:3,slots:[["field",0,0],["produce",3,0]],port:[2,2]},
  {id:"wood-yard",name:"장작을 쌓아 둔 작업 마당",zone:"house",maxCount:6,w:3,h:2,slots:[["wood",0,0],["barrel",2,0]],port:[1,1]},
  {id:"porch-yard",name:"벤치와 항아리의 문간 쉼터",zone:"house",maxCount:6,w:3,h:2,slots:[["bench",0,0],["jar",2,0]],port:[1,1]},
  {id:"shop-yard",name:"식료품점 앞 진열 공간",zone:"house",maxCount:3,w:3,h:2,slots:[["produce",0,0],["sign",2,0]],port:[1,1]},
  {id:"workshop-yard",name:"공방의 야외 작업대",zone:"house",maxCount:3,w:5,h:2,slots:[["table",0,0],["wood",3,0]],port:[1,1]},
  {id:"narrow-garden",name:"좁은 문간의 화분과 항아리",zone:"house",maxCount:8,w:2,h:2,slots:[["pots",0,0]],port:[0,1]},
  {id:"narrow-store",name:"좁은 골목의 장작과 상자",zone:"house",maxCount:8,w:2,h:2,slots:[["wood",0,0]],port:[0,1]},
  {id:"well-court",name:"공동 우물과 물 긷는 자리",zone:"commons",maxCount:1,w:3,h:3,slots:[["well",1,0],["jar",0,0],["bench",0,2]],port:[2,1]},
  {id:"notice-court",name:"마을 안내와 작은 쉼터",zone:"commons",maxCount:1,w:4,h:2,slots:[["sign",0,0],["bench",1,0],["hedge",3,0]],port:[1,1]},
  {id:"shared-garden",name:"울타리 옆 공동 텃밭",zone:"commons",maxCount:1,w:5,h:4,slots:[["fence",0,0],["field",0,1],["produce",3,1]],port:[2,3]},
  {id:"market-tent",name:"장터 천막과 보관 통",zone:"market",maxCount:1,w:4,h:3,slots:[["tent",0,0],["barrel",3,1]],port:[1,2]},
  {id:"market-storage",name:"장터 뒤 물품 적재 공간",zone:"market",maxCount:2,w:3,h:2,slots:[["produce",0,0],["barrel",2,0]],port:[1,1]},
  {id:"market-pottery",name:"항아리와 포장 작업대",zone:"market",maxCount:1,w:4,h:2,slots:[["table",0,0],["jar",3,0]],port:[2,1]},
  {id:"fishing-dock",name:"물 위로 이어지는 작은 잔교",zone:"shore",maxCount:1,w:2,h:4,slots:[["dock",0,1]],port:[0,0]},
  {id:"fishing-bank",name:"물가 낚시와 짐 놓는 자리",zone:"shore",maxCount:1,w:3,h:2,slots:[["bench",0,0],["barrel",2,0]],port:[1,1]},
  {id:"rock-bank",name:"돌과 덤불이 섞인 물가",zone:"shore",maxCount:3,w:3,h:2,slots:[["rock",0,0],["hedge",2,0]],port:[1,1]},
  {id:"shore-flowers",name:"호숫가 꽃과 휴식 자리",zone:"shore",maxCount:2,w:3,h:2,slots:[["flower",0,0],["jar",2,0]],port:[1,1]},
  {id:"road-garden",name:"골목 모퉁이의 짧은 울타리와 꽃",zone:"road",maxCount:5,w:3,h:3,slots:[["fence",0,0],["flower",0,1]],port:[1,2]},
  {id:"road-sign",name:"갈림길 안내와 덤불",zone:"road",maxCount:3,w:3,h:2,slots:[["sign",0,0],["hedge",2,0]],port:[1,1]},
];
export function registerVillageDecorationCatalog(project: Project): VillageDecorationRule[] {
  const library = project.spatialAuthoring!.library;
  const objects = library.objects as Record<string,ObjectDesign>;
  const spaces = library.spaces as Record<string,SpaceDesign>;
  const tileset = project.tilesets[tilesetId]!;
  for (const prop of PROPS) {
    const rows = prop.lower ?? prop.upper!;
    const width = rows[0]!.length, height = rows.length, kitId = `village-dressing:${prop.id}`;
    const kit: SectionStructureKitDef = { id:kitId,kind:"section",name:prop.name,width,height,learnedFrom:"db-authored",
      rows:Array.from({length:height},(_,y)=>({tiles:[...(prop.lower?.[y] ?? Array(width).fill(-1))],upperTiles:[...(prop.upper?.[y] ?? Array(width).fill(-1))]})) };
    const previousKit = tileset.structureKits?.find(k=>k.id===kitId);
    const changed = !isDeepStrictEqual(previousKit, kit);
    tileset.structureKits = [...(tileset.structureKits??[]).filter(k=>k.id!==kitId),kit];
    const id = kitId as SpatialId;
    const previousObject = objects[id];
    const object: ObjectDesign = { id,name:prop.name,revision:previousObject?.revision ?? 1,tags:["마을 장식","실외 소품"],provenance:{origin:"ai"},graphic:{tilesetId,kitId},anchors:[],chips:[] };
    objects[id] = previousObject && (changed || !isDeepStrictEqual(previousObject, object))
      ? { ...object, revision:previousObject.revision+1 } : object;
  }
  return VILLAGE_DECORATION_RECIPES.map(recipe=>{
    const id = `village-dressing:space:${recipe.id}` as SpatialId;
    const previous = spaces[id];
    const space: SpaceDesign = {id,name:recipe.name,revision:previous?.revision ?? 1,tags:[...(recipe.id==="fishing-dock"?["water-overlay"]:[]),"소규모 마을",`배치:${recipe.zone}`,`반복:${recipe.maxCount}`,"출입구와 기존 통로 유지"],
      provenance:{origin:"ai"},environment:"outdoor",tilesetId,shape:"rect",width:recipe.w,height:recipe.h,floor:"ground",wall:"none",floorAreas:[{kind:"rect",material:"ground",x:0,y:0,width:recipe.w,height:recipe.h}],
      ports:[{id:`${id}:entry` as SpatialId,name:"접근로",x:recipe.port[0],y:recipe.port[1]}],
      objectSlots:recipe.slots.map(([object,x,y],i)=>({id:`${id}:slot:${i}` as SpatialId,objectDesignId:`village-dressing:${object}` as SpatialId,quantity:1,required:true,placement:{mode:"fixed",x,y}}))};
    spaces[id] = previous && !isDeepStrictEqual(previous,space) ? { ...space, revision:previous.revision+1 } : space;
    return {spaceId:id,zone:recipe.zone,maxCount:recipe.maxCount};
  });
}
