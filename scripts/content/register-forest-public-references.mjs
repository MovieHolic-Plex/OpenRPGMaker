import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {withTsModule} from '../ontology-ts-loader.mjs';
const out='verify-shots/forest-public-references';fs.mkdirSync(out,{recursive:true});
const existingDir=process.env.FOREST_REFERENCE_PROJECT_DIR??'/home/main/.codex/worktrees/a4e1/rpg-zzu/.oprn-projects/oprn-hill-forest-harmony-20260918-a4e1';
const freshDir=process.env.FOREST_REFERENCE_FRESH_DIR??path.resolve('.oprn-projects/forest-public-reference-proof');
assert(!fs.existsSync(path.join(freshDir,'project.sqlite')),'Fresh proof must start without a project');
let fresh;await withTsModule('src/project/defaults/blankProject.ts','blank.mjs',m=>{fresh=m.createBlankProject();});
fresh.meta.title='공용 숲마을 참고문서 · 새 프로젝트 확인';
const proof=[];
await withTsModule('src/project/defaults/forestHarmony.ts','forest.mjs',async forest=>{
 await withTsModule('src/project/tilesetReferences.ts','references.mjs',m=>m.validateTilesetReferences(forest.createForestHarmonyTileset().referenceDocuments));
 const privateTileset=forest.createForestHarmonyTileset();privateTileset.image={type:'uploaded',id:'private'};delete privateTileset.referenceDocuments;assert.equal(forest.ensureForestHarmonyReferences(privateTileset),false);
 const edited=forest.createForestHarmonyTileset();edited.referenceDocuments[0].documents[0].markdown='사용자 편집';assert.equal(forest.ensureForestHarmonyReferences(edited),false);assert.equal(edited.referenceDocuments[0].documents[0].markdown,'사용자 편집');
 await withTsModule('electron/local-store/store.ts','store.mjs',async api=>{
  // Invoke only while these project folders have no running host; use the repository store API.
  for(const [mode,dir]of [['existing',existingDir],['fresh',freshDir]]){
   const store=mode==='fresh'?await api.initLocalProjectStore({projectDir:dir}):await api.openLocalProjectStore({projectDir:dir});
   let before;
   try{
    before=store.loadSnapshot();const project=mode==='fresh'?fresh:structuredClone(before.project);
    if(mode==='existing'){assert(project.tilesets.forest_harmony);store.backup();forest.ensureForestHarmonyReferences(project.tilesets.forest_harmony);assert.deepEqual(project.maps,before.project.maps);}
    const result=await store.saveSerialized(JSON.stringify(project),before?.sha256??null);assert.equal(result.kind,'saved');
    const reloaded=store.loadSnapshot();assert.deepEqual(JSON.parse(JSON.stringify(reloaded.project)),JSON.parse(JSON.stringify(project)));const cat=project.tilesets.forest_harmony.referenceDocuments.find(c=>c.id==='forest-public-village');assert.equal(cat.documents.length,2);assert.equal(cat.images.length,8);
    proof.push({mode,projectDir:dir,projectId:store.info().projectId,storage:'SQLite',saved:true,reloaded:true,documents:2,images:8,mapsUnchanged:mode==='existing',privateTilesetUnchanged:true,userDocumentPreserved:true});
   }finally{store.close();}
   const reopened=await api.openLocalProjectStore({projectDir:dir});try{assert.equal(reopened.loadSnapshot().project.tilesets.forest_harmony.referenceDocuments.find(c=>c.id==='forest-public-village').images.length,8);}finally{reopened.close();}
  }
 });
});
fs.writeFileSync(out+'/persistence.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
