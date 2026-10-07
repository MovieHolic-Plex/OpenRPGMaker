// 신규·기존 프로젝트 양쪽 + SQLite 저장·재로드 증명. 사용: vite-node scripts/qa/beodeul-reviewed-store.mts <기존 프로젝트 폴더 사본>
import fs from 'node:fs';import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store';
import {defaultTilesets,ensureBundledTilesets} from '../../src/project/defaults/defaultAssets';
import {createBlankProject} from '../../src/project/defaults/blankProject';
import {ensureBeodeulReviewed} from '../../src/project/defaults/beodeulReviewed';
import references from '../../src/assets/beodeulReviewedReferences.json';
import catalog from '../../src/assets/beodeulReviewedCatalog.json';
const projectDir=process.argv.at(-1)!,ev='verify-shots/beodeul-reviewed';
const n=catalog.buildings.length,count=(ts:any,pre:string)=>ts.structureKits.filter((k:any)=>k.id.startsWith(pre)).length;
const check=(ts:any,label:string)=>{assert.equal(count(ts,'bd-house-rv-'),n,label+' body');assert.equal(count(ts,'bd-rv-shadow-'),n,label+' shadow');assert.equal(count(ts,'bd-rv-foundation-'),n,label+' foundation');
 const r=ts.referenceDocuments.find((c:any)=>c.id==='beodeul-reviewed');assert(r,label+' refs');assert.deepEqual(r,references[0]);
 assert(r.images.every((i:any)=>!i.dataUrl.startsWith('data:')));assert(r.documents.every((d:any)=>d.markdown.length<=120000));
 for(const k of ts.structureKits.filter((k:any)=>/^bd-(house-rv|rv-shadow|rv-foundation)-/.test(k.id)))for(const row of k.rows)for(const t of row.upperTiles)if(t>=0)assert(t<ts.count,label+" tile "+t);};
const fresh=defaultTilesets();assert(fresh.beodeul_reviewed,'standalone tileset');assert.equal(fresh.beodeul_reviewed!.structureKits!.length,n*3);
check(fresh.beodeul_city,'fresh city');
const blank=createBlankProject();check(blank.tilesets.beodeul_city,'blank city');
const store0=await openLocalProjectStore({projectDir});const prev=store0.loadSnapshot()!;store0.close();
const p=structuredClone(prev.project);const hadBefore=count(p.tilesets.beodeul_city,'bd-house-rv-');assert.equal(hadBefore,0);
ensureBundledTilesets(p);check(p.tilesets.beodeul_city,'existing city');assert(p.tilesets.beodeul_reviewed);
assert.deepEqual(p.maps,prev.project.maps);assert.equal(p.startMapId,prev.project.startMapId);
const city0=prev.project.tilesets.beodeul_city!;for(const [id,map] of Object.entries(prev.project.maps)as any){if(map.tilesetId!=='beodeul_city')continue;
 for(const t of new Set<number>([...map.lowerTiles,...(map.lowerOverlayTiles??[]),...map.upperTiles,...(map.upperOverlayTiles??[])]))if(t>=0){assert.deepEqual(p.tilesets.beodeul_city.passability[t],city0.passability[t]);assert.equal(p.tilesets.beodeul_city.priority[t],city0.priority[t]);}}
const again=structuredClone(p.tilesets.beodeul_city);assert(!ensureBeodeulReviewed(p.tilesets.beodeul_city),'idempotent');assert.deepEqual(p.tilesets.beodeul_city,again);
let store=await openLocalProjectStore({projectDir});const saved=await store.saveSerialized(JSON.stringify(p),prev.sha256);assert.equal(saved.kind,'saved');store.close();
store=await openLocalProjectStore({projectDir});const loaded=store.loadSnapshot()!;assert.deepEqual(loaded.project,p);check(loaded.project.tilesets.beodeul_city,'reloaded city');assert(loaded.project.tilesets.beodeul_reviewed);
const proof={projectId:store.projectId,projectDir,revisionBefore:prev.revision,revision:loaded.revision,sha256:loaded.sha256,savedAndReopened:true,freshHasKits:true,blankHasKits:true,existingGainedKits:n*3,mapsAndStartUnchanged:true,oldTilePassabilityUnchanged:true,idempotent:true,referencesIdentical:true,noDataUrls:true,buildings:n};store.close();
fs.writeFileSync(`${ev}/canonical-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
