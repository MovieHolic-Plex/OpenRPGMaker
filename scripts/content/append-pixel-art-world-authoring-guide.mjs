import {readFile} from 'node:fs/promises';

// One source document, attached to each authored scene so reference ownership
// survives export and is available in both new and existing projects.
export async function appendSceneAuthoringGuide(library) {
  const markdown=await readFile('tiledata/pixel-art-world/AI-SCENE-AUTHORING.md','utf8');
  const category={id:'scene-authoring-workflow',name:'학교·실내·도시 실제 구현 절차',
    description:'공용 장면 구현 도구, 출입 연결, 방·가구·동선 규칙과 검증 한계',
    documents:[{id:'guide',name:'AI-SCENE-AUTHORING.md',markdown}],images:[]};
  for(const owner of [...Object.values(library.places),...Object.values(library.regions??{})]) {
    owner.referenceDocuments=(owner.referenceDocuments??[]).filter(c=>c.id!==category.id).concat(structuredClone(category));
  }
}
