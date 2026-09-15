import { sha256HexTextSync } from '@/util/sha256';
import { describe,it,expect } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { spatialId, checkedDocument } from '@/project/spatial/domain';
import { REVIEWED_PLACES, copyReviewedPlace, reviewedPlaceMaps } from '@/project/defaults/spatial/reviewedPlaceCatalog';
import { deserialize,serialize } from '@/project/io';
import { instantiateSpatialDesign } from '@/project/spatial/instances';
import { compileSpatialOccurrence } from '@/editor/spatial/compileSpatialOccurrence';

function emptySpatialDocument() { return { version: 1 as const, library: {objects:{},spaces:{},places:{},regions:{},worlds:{}}, occurrences:{}, rootOccurrenceIds:[], connections:[], legacyImport:{version:1 as const,sourceHash:sha256HexTextSync("{}"),mapping:[],backup:{encoding:"raw-json" as const,json:"{}",sha256:sha256HexTextSync("{}")}} }; }

describe('reviewed places shipped independently of a remote project',()=>{
 it('ships the approved collection and has complete rasters',()=>{
 expect(REVIEWED_PLACES).toHaveLength(25);
 for(const item of REVIEWED_PLACES)for(const{map}of reviewedPlaceMaps(item.id)){expect(map.lowerTiles).toHaveLength(map.width*map.height);expect(map.upperTiles).toHaveLength(map.width*map.height);}
 });
 it('copies without changing existing project content and rejects repeated identities',()=>{
 const p=createBlankProject();p.spatialAuthoring=emptySpatialDocument();const original=serialize(p);
 const result=copyReviewedPlace(p,'place_functional_goods','copy1');expect(serialize(p)).toBe(original);expect(result.project.maps).toEqual(p.maps);expect(result.project.spatialAuthoring!.library.places[result.id].provenance.origin).toBe('user');expect(()=>copyReviewedPlace(result.project,'place_functional_goods','copy1')).toThrow();expect(()=>deserialize(serialize(result.project))).not.toThrow();
 });
 for(const id of ['place_functional_two_story_inn','place_iron_vein_mine','place_reviewed_cottage'])it(`builds reusable ${id}`,()=>{
 const p=createBlankProject();p.spatialAuthoring=emptySpatialDocument();const copied=copyReviewedPlace(p,id,'test');const rootId=spatialId('test-occurrence');
 copied.project.spatialAuthoring=instantiateSpatialDesign(copied.project.spatialAuthoring!,copied.project,{source:{kind:'place',id:copied.id},rootId,seed:1,x:0,y:0,level:0,generatorVersion:'test'});
 const built=compileSpatialOccurrence(copied.project,{occurrenceId:rootId});const maps=Object.values(built.maps).filter(m=>!p.maps[m.id]);expect(maps).toHaveLength(id.includes('two_story')?2:1);expect(()=>checkedDocument(built.spatialAuthoring,built)).not.toThrow();
 if(id.includes('two_story'))expect(maps.flatMap(m=>m.events).flatMap(e=>e.pages??[]).flatMap(pg=>pg.commands).filter(c=>c.kind==='transfer')).toHaveLength(2);
 });
});
