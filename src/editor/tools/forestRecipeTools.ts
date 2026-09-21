import { FOREST_RECIPE_IDS, compileForestRecipe, checkForestRecipeBounds, compareForestRecipe, applyForestRecipe, forestRecipeAccess, ForestRecipeError } from '@/project/forestRecipes';
import { ToolError, type ToolDefinition, type JsonSchema } from './types';
const parameters: JsonSchema = { type: 'object', properties: {
  mapId: { type: 'string' }, recipeId: { type: 'string', enum: [...FOREST_RECIPE_IDS] },
  x: { type: 'integer', minimum: 0 }, y: { type: 'integer', minimum: 0 },
  repeats: { type: 'integer', minimum: 1, maximum: 16 },
  overwrite: { type: 'boolean', description: '검토한 영역을 덮을 때만 true. 이벤트 칸은 항상 거절.' },
  checkPlaced: { type: 'boolean', description: 'inspect에서 true면 원본 부품 배열과 현재 맵을 칸별 비교.' },
  accessPoints: { type: 'array', items: { type: 'object', properties: {x:{type:'integer'},y:{type:'integer'}},required:['x','y'],additionalProperties:false } },
}, required: ['mapId','recipeId','x','y'], additionalProperties: false };
export const FOREST_RECIPE_TOOLS: readonly ToolDefinition[] = [false,true].map(write => ({
  name: write ? 'stamp_forest_recipe' : 'inspect_forest_recipe', mode: write ? 'write' : 'read', domains: ['tile','map'],
  description: write ? '공용 forest_harmony의 온전한 숲/나무 부품을 결정론적으로 조립한다. 타일 번호·픽셀을 AI가 만들지 않는다. 전체가 안 들어가거나 출입 연결이 막히면 변경 없이 거절.' : '공용 숲 조립의 전체 크기·부품 좌표를 미리 본다. checkPlaced=true면 잘린 뿌리/캡/뒤집힌 외곽 등 원본과 다른 칸의 좌표와 기대 타일을 반환한다.',
  parameters,
  run(project, args) {
    try {
      const map = project.maps[String(args.mapId)];if (!map) throw new ToolError('맵이 없습니다.');
      const t = project.tilesets[map.tilesetId];if (!t) throw new ToolError('타일셋이 없습니다.');
      const plan = compileForestRecipe(t, { recipeId:String(args.recipeId),x:args.x as number,y:args.y as number,repeats:args.repeats as number|undefined });
      checkForestRecipeBounds(map, plan);
      const access = args.accessPoints as {x:number;y:number}[]|undefined;
      const result = write ? applyForestRecipe(project,map,plan,args.overwrite===true,access)
        : args.checkPlaced ? {...compareForestRecipe(map,plan),access:forestRecipeAccess(project,map,access)} : {status:'preview'};
      return { summary: `${args.recipeId}: ${plan.width}×${plan.height} (${plan.x},${plan.y})`, data: {recipeId:args.recipeId,origin:{x:plan.x,y:plan.y},width:plan.width,height:plan.height,parts:plan.parts,...result} };
    } catch(e) { if(e instanceof ForestRecipeError) throw new ToolError(e.message,{code:e.code,mapId:String(args.mapId),x:e.x,y:e.y});throw e; }
  },
}));
