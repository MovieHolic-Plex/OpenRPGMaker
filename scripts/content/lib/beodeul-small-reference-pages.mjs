/** Keep the complete example, splitting the rule table into a second source-backed document. */
export function smallBeodeulReferencePages(example){
 const {graftRules,...targetTileset}=example.targetTileset;
 const pages=[{id:'bd-ground-small-example',name:'작은 마을 전체 네 층 정답',markdown:'# 소규모 마을 전체 정답\n\n원본 640×480 그림과 아래 전체 배열이 같은 결과다. 이식 번호는 이 fresh 예제용이며 현재 프로젝트에는 도구를 사용한다. graftRules 전체 통행/우선순위는 같은 용도의 「작은 마을 이식 칸 전체 규칙」 문서에서 이어서 읽는다.\n```json\n'+JSON.stringify({...example,targetTileset})+'\n```'},
 ];
 for(let offset=0;offset<graftRules.length;offset+=300){const page=Math.floor(offset/300)+1;
 pages.push({id:'bd-ground-small-grafts'+(page===1?'':`-${page}`),name:`작은 마을 이식 칸 전체 규칙 · ${page}`,markdown:'# 작은 마을 이식 칸 전체 규칙\n\n전체 graftRules를 300개씩 나눈 문서다. 같은 접두어의 모든 문서를 읽는다. source 좌표/텍스처/칸→target 칸과 우선순위·통행을 생략하지 않았다.\n```json\n'+JSON.stringify({tilesetId:example.targetTileset.id,count:example.targetTileset.count,tilesPerRow:example.targetTileset.tilesPerRow,offset,total:graftRules.length,graftRules:graftRules.slice(offset,offset+300)})+'\n```'});
 }
 for(const p of pages)if(p.markdown.length>120000)throw new Error(`버들 작은 마을 문서 저장 상한: ${p.id} ${p.markdown.length}`);
 return pages;
}
