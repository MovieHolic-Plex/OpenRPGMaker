// Migrate durable Slates research into project-owned purpose/document/image records.
// Run read-slates-project.mjs first; remote publication is a separate CAS save.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, basename, extname } from 'node:path';
import { createHash } from 'node:crypto';
const directory=process.argv[2]??'output/tileset-references';
const project=JSON.parse(await readFile(`${directory}/source/source-project.json`,'utf8'));
const owner=project.tilesets.slates_32;
if(!owner||owner.referenceDocuments?.length)throw Error('Expected unseeded original Slates tileset');
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,16);
const categories=[];
async function category(id,name,description,files){
 const group={id,name,description,documents:[],images:[]};const seen=new Map();
 async function attach(path,caption=''){
  const full=resolve(path);if(seen.has(full))return seen.get(full);
  const bytes=await readFile(full);const id='img-'+hash(path);seen.set(full,id);
  group.images.push({id,name:basename(path),caption:caption||basename(path),dataUrl:`data:image/${extname(path)==='.jpg'?'jpeg':'png'};base64,${bytes.toString('base64')}`});return id;
 }
 for(const file of files){
  let markdown=await readFile(file,'utf8');
  for(const match of [...markdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)]){
   const imageId=await attach(resolve(dirname(file),match[2]),match[1]);markdown=markdown.replace(match[0],`![${match[1]}](image:${imageId})`);
  }
  markdown=`> 출처: ${file}. 이 문서의 본문과 그림은 프로젝트 DB에 저장되어 있습니다. 저장소 경로는 연구 출처이며, 첨부 그림은 외부 파일 없이 열립니다.\n\n${markdown}`;
  group.documents.push({id:basename(file,'.md'),name:basename(file),markdown});
 }
 categories.push(group);return {group,attach};
}
const village=await category('village','마을','Slates 32px로 촘촘한 성곽 마을을 배치할 때. 밀도·길 폭·지붕 접합·레이어·통행을 함께 확인합니다.',[
 'openwiki/slates-dense-town.md','openwiki/slates-assembly-playbook.md','openwiki/slates-village-authoring.md','openwiki/slates-structure-learning.md',
]);
for(const version of ['v1','v2'])await village.attach(`public/assets/slates/slates-${version}-32px.png`,`Slates ${version} 원본 아틀라스 · Ivan Voirol / CC BY 4.0. v1 48열, v2 56열, 32px.`);
const intro=`# Slates 참고문서 사용 순서\n\n이 자료는 데이터베이스 → 타일 → Slates → 참고문서 → 마을에 저장되어 있습니다. 모든 AI가 같은 자료를 사용합니다.\n\n1. slates-dense-town.md에서 촘촘한 마을의 밀도와 좁은 길 기준을 읽습니다.\n2. slates-assembly-playbook.md와 구조 학습 문서에서 지붕·성벽 접합을 확인합니다.\n3. 저작 지침에서 레이어와 통행을 확인합니다.\n4. 필요한 세부 부품은 ‘구조 표본’, 원본 번호는 ‘타일 사전’, 원본 사각형 연산은 ‘조립 레시피’ 용도에서 추가로 조회합니다.\n\nAI 도구: list_tileset_references → read_tileset_reference. MD는 nextOffset이 null이 될 때까지, 이미지는 imageId로 각각 조회합니다. 다음 응답에서 referencePurpose: village로 배치합니다.\n\n기존 마을의 완성도를 보장하는 자동 배치 템플릿은 아닙니다. 밀도 수치와 원본 이미지의 접합을 직접 비교하고 저장 후 재로드를 확인하세요.\n\n작품: Slates — Ivan Voirol, CC BY 4.0. 원본 제목 영역을 제거한 아틀라스와 설명용 확대·비교 그림을 포함합니다. 원작: https://opengameart.org/content/slates-32x32px-orthogonal-tileset-by-ivan-voirol\n`;
village.group.documents.unshift({id:'start',name:'00-읽기-순서.md',markdown:intro});
await category('structures','구조 표본','집·상점·지붕·성벽·성문·탑·교량의 관찰 표본과 조립 상태를 조사할 때.',['openwiki/slates-structure-samples.md']);
await category('atlas','타일 사전','원본 1,232슬롯 전체의 번호와 용도를 조사할 때.',['openwiki/slates-atlas-review.md','openwiki/slates-study.md']);
const recipeGroup={id:'recipes',name:'조립 레시피',description:'기존에 검토한 6개 모듈의 원본 사각형·그리는 순서·바닥·그림자·통행 근거. 수치를 복원할 때 추가로 읽습니다.',documents:[],images:[]};
const recipes=JSON.parse(await readFile('docs/experiments/slates-astra-v2/modules.json','utf8'));
for(const module of recipes.modules){
 const compact={...module,operations:module.operations.map(({source,sourceVersion,sourceRect,destination,layer,part,drawOrder,...extra})=>({s:sourceVersion,r:sourceRect,d:destination,l:layer,p:part,o:drawOrder,...extra}))};
 const text=JSON.stringify(compact,null,0);
 // Keep complete JSON documents within authored bounds; never truncate recipe data.
 if(text.length>120000)throw Error(`Recipe too large: ${module.id}`);
 recipeGroup.documents.push({id:module.id,name:`${module.id}.md`,markdown:`# ${module.id} 조립 레시피\n\n출처: docs/experiments/slates-astra-v2/modules.json\n원작: Ivan Voirol, CC BY 4.0. 좌표: native pixels.\n연산 s=원본 버전(v1/v2), r=sourceRect [x,y,w,h], d=destination [x,y], l=layer, p=part, o=drawOrder. 원본 그림은 ‘마을’ 용도에 첨부되어 있습니다.\n\n\`\`\`json\n${text}\n\`\`\`\n`});
}
categories.push(recipeGroup);
owner.referenceDocuments=categories;
for(const tileset of Object.values(project.tilesets))if(tileset.id!==owner.id&&tileset.id.startsWith('slates_'))tileset.referenceSourceTilesetId=owner.id;
await writeFile(`${directory}/project.json`,JSON.stringify(project));
const manifest={owner:owner.id,sharedBy:Object.values(project.tilesets).filter(t=>t.referenceSourceTilesetId===owner.id).map(t=>t.id),categories:categories.map(g=>({id:g.id,name:g.name,documents:g.documents.length,images:g.images.length,characters:g.documents.reduce((n,d)=>n+d.markdown.length,0)}))};
await writeFile(`${directory}/migration.json`,JSON.stringify(manifest,null,2));console.log(manifest);
