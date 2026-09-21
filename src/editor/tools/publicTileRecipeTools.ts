import {PUBLIC_TILE_RECIPE_IDS,publicRecipe,stampPublicTileRecipe,validatePublicTileRecipes,type RecipePlacement} from '@/project/publicTileRecipes';
import {ForestRecipeError} from '@/project/forestRecipes';
import {ToolError,type ToolDefinition,type JsonSchema} from './types';
const point:JsonSchema={type:'object',properties:{x:{type:'integer',minimum:0},y:{type:'integer',minimum:0}},required:['x','y'],additionalProperties:false};
const placement:JsonSchema={type:'object',properties:{...point.properties,recipeId:{type:'string',enum:PUBLIC_TILE_RECIPE_IDS}},required:['recipeId','x','y'],additionalProperties:false};
export const PUBLIC_TILE_RECIPE_TOOLS:readonly ToolDefinition[]=[
 {name:'inspect_tile_recipe',mode:'read',description:'공용 숲마을 건물·가구·숲·울타리·동굴의 정확한 두 레이어 배열, 시트 좌표, 접근칸과 결합 순서를 읽는다.',domains:['tile','map'],parameters:{type:'object',properties:{mapId:{type:'string'},placement},required:['mapId','placement'],additionalProperties:false},run:(project,args)=>execute(project,args,'inspect')},
 {name:'stamp_tile_recipe',mode:'write',description:'공용 조립법을 원형대로 배치하고 내장 접근칸을 자동 검사한다. 맵 입출구는 entryPoints로 추가한다. 실패하면 원자적으로 취소한다.',domains:['tile','map'],parameters:{type:'object',properties:{mapId:{type:'string'},placement,overwrite:{type:'boolean'},entryPoints:{type:'array',items:point}},required:['mapId','placement'],additionalProperties:false},run:(project,args)=>execute(project,args,'stamp')},
 {name:'validate_tile_recipes',mode:'read',description:'placements의 잘린 뿌리·빠진 줄기·틀린 외곽/레이어·문·막힌 접근칸과 단절된 출입구를 검사하고 오류 좌표를 반환한다. 원본 조립법과 비교하며 임의 지형을 추측하지 않는다.',domains:['tile','map'],parameters:{type:'object',properties:{mapId:{type:'string'},placements:{type:'array',items:placement},entryPoints:{type:'array',items:point}},required:['mapId','placements'],additionalProperties:false},run:(project,args)=>execute(project,args,'validate')},
];
function execute(project:Parameters<ToolDefinition['run']>[0],args:Record<string,unknown>,mode:string){try{const map=project.maps[String(args.mapId)];if(!map)throw new ToolError('맵이 없습니다.');const p=args.placement as RecipePlacement;const entries=(args.entryPoints??[])as {x:number;y:number}[];if(entries.length>32)throw new ToolError('외부 출입구는 최대32개입니다.');
 const placements=args.placements as RecipePlacement[];if(mode==='validate'&&(!placements?.length||placements.length>64))throw new ToolError('placements는 1~64개입니다.');
 const data=mode==='inspect'?publicRecipe(project.tilesets[map.tilesetId],p):mode==='stamp'?stampPublicTileRecipe(project,map,p,args.overwrite===true,entries):validatePublicTileRecipes(project,map,placements,entries);return{summary:`공용 타일 조립 ${mode}`,data};
 }catch(e){if(e instanceof ForestRecipeError)throw new ToolError(e.message,{code:e.code,mapId:String(args.mapId),x:e.x,y:e.y});throw e;}}
