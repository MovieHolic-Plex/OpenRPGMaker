import {readFile} from 'node:fs/promises';

// One source document, attached to each authored scene so reference ownership
// survives export and is available in both new and existing projects.
export async function appendSceneAuthoringGuide(library) {
  const markdown=await readFile('tiledata/pixel-art-world/AI-SCENE-AUTHORING.md','utf8');
  const category={id:'scene-authoring-workflow',name:'저장 장면 복사 절차 · 직접 설계와 구분',
    description:'명시적인 복사 요청 전용. 새 평면은 직접 설계 지침을 따른다. 출입 연결·복사 검증 한계.',
    documents:[{id:'guide',name:'AI-SCENE-AUTHORING.md',markdown}],images:[]};
  for(const owner of [...Object.values(library.places),...Object.values(library.regions??{})]) {
    owner.referenceDocuments=(owner.referenceDocuments??[]).filter(c=>c.id!==category.id).concat(structuredClone(category));
  }
}
