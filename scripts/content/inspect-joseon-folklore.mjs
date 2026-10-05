import fs from 'node:fs';
import assert from 'node:assert/strict';
import { withTsModule } from '../ontology-ts-loader.mjs';
const data=JSON.parse(fs.readFileSync('src/assets/joseonFolkloreData.json','utf8'));
const art=JSON.parse(fs.readFileSync('src/assets/joseonFolkloreAssets.json','utf8'));
for(const [key,n] of Object.entries({classes:5,items:32,equipment:36,enemies:19,skills:44,skillChoreographies:7}))assert.equal(data[key].length,n,key+' count');
assert.equal(art.sheets.length,19);
const ai=JSON.parse(fs.readFileSync('content-packs/joseon-folklore/behavior/data.json','utf8')).enemyActions;
const expanded=JSON.parse(fs.readFileSync('content-packs/joseon-folklore/monsters/expansion.json','utf8')).enemies;
assert.equal(ai.length+expanded.filter(enemy=>enemy.actions.length===2).length,19,'All authored enemies have behavior');
for(const icon of art.icons){const bytes=fs.readFileSync('public/'+icon.path);assert.equal(bytes.readUInt32BE(16),32,icon.path);assert.equal(bytes.readUInt32BE(20),32,icon.path);}
await withTsModule('scripts/content/lib-joseon-folklore.ts','jf-inspect.mjs',async api=>{
 const root=process.argv[2];assert(root,'Pass a project folder for reference inspection');
 const db=await api.openLocalProjectStore({projectDir:root});const snapshot=db.loadSnapshot();db.close();assert(snapshot);
 const p=structuredClone(snapshot.project);const first=api.applyJoseonFolklorePack(p);const issues=api.collectProjectReferenceIssues(p);
 assert.deepEqual(issues,[],'References');
 const sword=p.database.equipment.find(e=>e.id==='equip_jf_warrior_weapon_1');sword.name='저자가 정한 검 이름';
 const second=api.applyJoseonFolklorePack(p);assert.equal(second.added,0,'Idempotent install');assert.equal(sword.name,'저자가 정한 검 이름','Author record preservation');
 const fresh=api.createJoseonFolkloreRecords();assert.notEqual(fresh.equipment.find(e=>e.id===sword.id).name,sword.name,'Fresh bundle copies');
 const evidence={counts:Object.fromEntries(Object.entries(data).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length])),firstInstall:first.added,reapplyAdded:second.added,referenceIssues:issues,icons:art.icons.length,sheets:art.sheets.length};
 fs.mkdirSync('output/joseon-folklore',{recursive:true});fs.writeFileSync('output/joseon-folklore/pack-inspection.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
});
