// Regional instructions refer to installed static places without inventing map links.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {withTsModule} from '../ontology-ts-loader.mjs';
const dependencies=['pixel-art-world-school-sewer-local','pixel-art-world-loose-supplements-local'];
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function appendRegionCandidates(library,snapshot) {
  const region=library.regions?.shared_paw_city;
  if(!region)return 0;
  const category={id:'small-place-candidates',name:'작은 장소 확장 후보 · 도시에는 아직 미배치',description:'다른 로컬 라이브러리의 검토된 전체 배열과 접근점. 실행 연결은 별도 저작.',documents:[],images:[]};
  for(const libraryId of dependencies){
    const source=snapshot.libraries[libraryId];if(!source)continue;
    if(source.sourceProjectId!==library.sourceProjectId)throw Error('Candidate source project differs');
    for(const [id,place]of Object.entries(source.places)){
      const tile=source.tilesets[place.exterior?.tilesetId],kit=tile?.structureKits?.find(k=>k.id===place.exterior.kitId),preview=source.previews[id];
      if(!kit||!preview)throw Error('Missing regional candidate assembly '+id);
      const arrays={placeId:id,tilesetId:tile.id,kitId:kit.id,width:kit.width,height:kit.height,lowerTiles:kit.rows.flatMap(r=>r.tiles),upperTiles:kit.rows.flatMap(r=>r.upperTiles),ports:place.ports};
      if(arrays.lowerTiles.length!==kit.width*kit.height||arrays.upperTiles.length!==kit.width*kit.height)throw Error('Incomplete regional arrays');
      category.documents.push({id,name:place.name+' · 지역 연결.md',markdown:`# ${place.name}\n\n현재 도시의 실행 맵과 이벤트에 연결되지 않은 정적 후보다. 공용 라이브러리 ${libraryId}의 장소 ${id}를 참조한다. 아래 타일 번호는 ${tile.id} 전용이며 현재 도시 아틀라스에 그대로 찍으면 다른 그림이 된다.\n\n배치 전에 해당 장소와 객체가 소유한 모든 원본·정상/오류 그림·밑동/방향/통행 문서를 읽는다. 같은 tilesetId의 별도 맵에서 전체 배열을 사용하거나, 원본 의존성을 보존하는 아틀라스 병합과 번호 치환을 먼저 수행한다. 실내 표본을 도시 건물 외관 위에 겹치지 않는다. 칸막이 표본은 조립 학습용이며 그 자체를 완성 시설로 취급하지 않는다.\n\n${kit.ai?.placementRules??''}\n\n\`\`\`json\n${JSON.stringify(arrays,null,2)}\n\`\`\`\n\nports는 접근 좌표이며 실행 전이/문 열림 이벤트가 아니다. 기존 도시의 출입구와 목적맵·복귀칸을 확인하고 명시적으로 연결한다. 기존 주택의 방·학교의 계단을 덮지 않는다. 하수도 계단 난간과 수면의 차단, 신사/새장 열린 그림의 충돌을 임의로 풀지 않는다. 촛불 frame0는 애니메이션이 아니며 L자 화단은 흙 테두리 표본이다. 연결 후 출입구→접근점→복귀를 실제 플레이어에서 확인한다.\n\n![정적 장소 전체](image:${id})`});
      category.images.push({id,name:id+'.png',caption:place.name+' · 도시 미연결',dataUrl:preview});
    }
  }
  region.referenceDocuments=(region.referenceDocuments??[]).filter(c=>c.id!==category.id);
  if(category.documents.length)region.referenceDocuments.push(category);
  return category.documents.length;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const[action,out]=process.argv.slice(2);if(action!=='--publish-local'||!out)throw Error('Usage: --publish-local <private receipt output>');
  await withTsModule('scripts/lib/sharedContentSqlite.ts','paw-region-candidates.mjs',async api=>{
    const before=api.readSharedContent(),id='pixel-art-world-local',old=before.libraries[id];if(!old)throw Error('Native city library missing');
    const library=structuredClone(old),count=appendRegionCandidates(library,before);
    if(count!==8)throw Error('Expected three school/sewer and five supplement candidates');
    const saved=api.publishSharedContent(id,library,hash(old)),after=api.readSharedContent();
    for(const[key,value]of Object.entries(before.libraries))if(key!==id&&hash(after.libraries[key])!==hash(value))throw Error('Unrelated library changed');
    if(hash(library.maps)!==hash(old.maps)||hash(library.tilesets)!==hash(old.tilesets)||hash(library.assets)!==hash(old.assets))throw Error('Regional-only patch changed source content');
    await fs.mkdir(out,{recursive:true});const proof={libraryId:id,file:saved.file,revision:saved.revision,documents:count,images:count,reloadedEqual:hash(saved.reloaded)===hash(library),mapsUnchanged:true,scope:'Region references only; static candidates are not new runtime map links.'};
    await fs.writeFile(path.join(out,'proof.json'),JSON.stringify(proof,null,2));console.log(proof);
  });
}
