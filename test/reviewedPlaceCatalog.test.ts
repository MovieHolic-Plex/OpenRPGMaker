import { sha256HexTextSync } from '@/util/sha256';
import { describe,it,expect } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { spatialId, checkedDocument } from '@/project/spatial/domain';
import { REVIEWED_PLACES, copyReviewedPlace } from '@/project/defaults/spatial/reviewedPlaceCatalog';
import { instantiateSpatialDesign } from '@/project/spatial/instances';
import { compileSpatialOccurrence } from '@/editor/spatial/compileSpatialOccurrence';

function emptySpatialDocument() { return { version: 1 as const, library: {objects:{},spaces:{},places:{},regions:{},worlds:{}}, occurrences:{}, rootOccurrenceIds:[], connections:[], legacyImport:{version:1 as const,sourceHash:sha256HexTextSync("{}"),mapping:[],backup:{encoding:"raw-json" as const,json:"{}",sha256:sha256HexTextSync("{}")}} }; }

describe('reviewed places shipped independently of a remote project',()=>{
 // 번들 검수 장소 25곳은 2026-10-07 저작권 정리(PR #2335)로 지웠다 — catalog.json 은 빈 목록이고 공용 DB 장소만 설치된다.
 // 그래서 25곳·place_functional_goods 복사 경우는 뺐다. 아래 장소별 반복은 공용 장소가 설치된 경우에만 돈다.
 it('ships no bundled places and rejects an unknown place',()=>{
 expect(REVIEWED_PLACES).toHaveLength(0);
 const p=createBlankProject();p.spatialAuthoring=emptySpatialDocument();
 expect(()=>copyReviewedPlace(p,'place_functional_goods','copy1')).toThrow();
 });
 for(const id of REVIEWED_PLACES.map(p=>p.id))it(`builds reusable ${id}`,()=>{
 const p=createBlankProject();p.spatialAuthoring=emptySpatialDocument();const copied=copyReviewedPlace(p,id,'test');const rootId=spatialId('test-occurrence');
 copied.project.spatialAuthoring=instantiateSpatialDesign(copied.project.spatialAuthoring!,copied.project,{source:{kind:'place',id:copied.id},rootId,seed:1,x:0,y:0,level:0,generatorVersion:'test'});
 const built=compileSpatialOccurrence(copied.project,{occurrenceId:rootId});const maps=Object.values(built.maps).filter(m=>!p.maps[m.id]);expect(maps).toHaveLength(id.includes('two_story')?2:1);expect(()=>checkedDocument(built.spatialAuthoring,built)).not.toThrow();
 if(id.includes('two_story'))expect(maps.flatMap(m=>m.events).flatMap(e=>e.pages??[]).flatMap(pg=>pg.commands).filter(c=>c.kind==='transfer')).toHaveLength(2);
 });
});
