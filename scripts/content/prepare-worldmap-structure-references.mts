import {createAtlasCartographyTileset} from '../../src/project/defaults/atlasCartography.ts';
import { inspectWorldAtlas } from '../../src/project/worldAtlasAudit.ts';
// Source and bundle are written from reopened SQLite content, never from a completion message.
// --publish writes ONLY the local shared SQLite library through its publication API.
import fs from 'node:fs';
import path from 'node:path';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {publishSharedContent,readSharedContentLibrary} from '../lib/sharedContentSqlite.ts';
import {WORLD_ATLAS_CATALOG} from '../../src/project/worldAtlas.ts';
import type {Project} from '../../src/project/types.ts';
import type {SharedContentLibrary,SharedWorldmapStructureReference} from '../../src/project/sharedContentSchema.ts';
const out=path.resolve(process.argv[2]??'verify-shots/worldmap-structures');
const manifest=JSON.parse(fs.readFileSync(path.join(out,'canonical-projects.json'),'utf8'));
const source=path.resolve('tiledata/worldmap-structures'),publicDir=path.resolve('public/assets/worldmap-structures');
fs.mkdirSync(source,{recursive:true});fs.mkdirSync(publicDir,{recursive:true});
const entries:SharedWorldmapStructureReference[]=[];
for(const item of manifest.cases){
 const store=await openLocalProjectStore({projectDir:item.folder});const p=store.loadSnapshot()!.project as Project;store.close();
 const atlas=p.worldAtlases![0]!,audit=inspectWorldAtlas(p,atlas);if(!audit.ok)throw Error(JSON.stringify(audit));
 const catalog=WORLD_ATLAS_CATALOG.find(c=>c.id===atlas.structure)!;
 const preview='/assets/worldmap-structures/'+atlas.structure+'.png';fs.copyFileSync(path.join(out,atlas.structure+'.png'),path.join(publicDir,atlas.structure+'.png'));
 const markdown=`# ${atlas.name}\n\n${catalog.description}\n\n## 실제 저작 순서\n\n1. list_worldmap_structures로 이동 방식을 고른다.\n2. author_worldmap_structure({id:"my_world",structure:"${atlas.structure}",seed:7})로 실제 맵과 이벤트를 만든다. id는 영문 소문자로 시작하고 영문 소문자·숫자·밑줄·하이픈을 쓴다.\n3. inspect_worldmap_structure({id})의 audit.ok, 실제 맵·출입구·착지·관문을 확인한다.\n4. show_map_region으로 실제 타일을 보고 플레이에서 M으로 지도를 연다.\n5. 실제 SQLite 프로젝트 저장 후 같은 저장소에서 다시 읽어 지도 정의와 맵을 확인한다.\n\n## 정본 표본\n\n프로젝트 ${item.projectId}. 맵 ${atlas.nodes.length+(atlas.overviewMapId?1:0)}개, 연결 ${atlas.edges.length}개. 해금 뒤 ${audit.reachableAfterUnlocks}/${audit.nodes} 장소 도달. PNG는 저장소를 닫고 다시 연 프로젝트의 타일 렌더와 공용 지도 렌더러를 사용했다.\n\n## 데이터와 그림의 계약\n\n세계관 theme과 이동 structure는 독립이다. 현재 생성기는 여섯 구조별 고정 연결 레시피이며 완성된 상용 게임을 재현한 것은 아니다. 이 표본은 새 공용 atlas_cartography 32px 지형을 사용한다. 지형 원본은 scripts/content/build-atlas-cartography.py이며, 거점은 사람이 승인한 기존 아이콘의 원본 화소를 재사용한다. 필드의 강·호수·절벽과 굴곡 길은 실제 통행 타일이다. 방 지도는 roomShape가 가리키는 실제 방 윤곽을 쓰고 사다리에는 실제 climbable 지형 기록을 연결한다. 스테이지는 하늘과 풀 절벽 발판이 있는 횡스크롤 코스다. 특정 상용 게임의 타일을 복사한 것이 아니다. 공개 타일의 원래 참고문서는 해당 타일셋(list_tileset_references)에서 읽는다.\n\n발견·클리어·능력·핀은 session.switches에 저장한다. 지도에 들어오거나 그림을 여는 것만으로 관문이 통과되지 않는다. stage-nodes/run-path는 열린 인접 장소만 이동한다. run-path는 이전 층과 방문한 분기를 재진입하지 않는다. region-routes/field-overview/room-network는 실제 출입구 이벤트로 왕복한다. scaled-world는 실제 대륙의 거점 입구로 출입한다. 비밀 출구는 일반 클리어와 별도 스위치다.\n\n## 정상과 오류 확인\n\n정상: 닿는 출구, 통행 가능한 착지 칸, 귀환 문을 밟지 않는 착지, 관문을 통과한 뒤 해금, 방의 발견/핀 저장. 오류: 겹친 문, 막힌 착지, 자기 열쇠 뒤 잠긴 관문, 월드맵 점을 아무거나 눌러 순간이동, 런에서 이전 층 재진입. inspect 도구가 좌표·연결 불일치를 보고하며 플레이 화면을 함께 확인한다.\n\n## 표본 전체 연결 정의\n\n\`\`\`json\n${JSON.stringify(atlas,null,2)}\n\`\`\`\n`;
 fs.writeFileSync(path.join(source,atlas.structure+'.md'),markdown);fs.writeFileSync(path.join(source,atlas.structure+'.json'),JSON.stringify(atlas,null,2));
 entries.push({id:atlas.structure,name:atlas.name,sourceProjectId:item.projectId,preview,authorArgs:{structure:atlas.structure,seed:7},example:atlas,
   referenceDocuments:[{id:'worldmap-'+atlas.structure,name:atlas.name,description:catalog.description,documents:[{id:'guide',name:'실행·전체 연결·저장 계약',markdown}],images:[{id:'canonical-atlas',name:atlas.name+'.png',caption:'정본 재로드에서 만든 전체 지도',dataUrl:preview}]}]});
}
fs.writeFileSync(path.resolve('src/assets/worldAtlasExamples.json'),JSON.stringify(entries));
fs.writeFileSync(path.join(source,'README.md'),'# 공용 월드맵 이동 구조\n\n6종의 실행 지침·정본 연결 정의. 그림은 public/assets/worldmap-structures, 배포 번들은 src/assets/worldAtlasExamples.json.\n\n재생성: `bun scripts/content/prepare-worldmap-structure-references.mts verify-shots/worldmap-structures`. 로컬 공용 DB 등록은 `--publish`를 명시한다.\n\n게임 이름은 이동 구조 연구의 비교 대상이며 그림은 프로젝트 공용 타일과 지도 렌더러를 사용한다. 원래 타일의 라이선스·출처는 public/assets/ATTRIBUTION.md 및 각 타일 번들 표기를 따른다.\n');
if(process.argv.includes('--publish')){
 const id='worldmap-navigation-structures-v1',old=readSharedContentLibrary(id);
 const library:SharedContentLibrary={version:1,projectDefaults:false,roots:[],places:{},tilesets:{atlas_cartography:createAtlasCartographyTileset()},assets:{},maps:{},previews:Object.fromEntries(entries.map(e=>[e.id,'data:image/png;base64,'+fs.readFileSync(path.join(out,e.id+'.png')).toString('base64')])),sourceProjectId:manifest.cases[0].projectId,
   worldmapStructures:Object.fromEntries(entries.map(e=>[e.id,e]))};
 const result=publishSharedContent(id,library,old?.revision??null);
 if(Object.keys(result.reloaded.worldmapStructures??{}).length!==6)throw Error('Shared DB reload lost a structure');
 fs.writeFileSync(path.join(out,'shared-library.json'),JSON.stringify({id,file:result.file,revision:result.revision,structures:entries.map(e=>e.id),reloaded:true},null,2));
 console.log(JSON.stringify({id,file:result.file,revision:result.revision,structures:entries.length,reloaded:true}));
}
