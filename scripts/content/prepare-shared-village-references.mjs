import fs from 'node:fs';
const dir='tiledata/tilesets/forest_high_cliff_river/shared-library';
const selection=JSON.parse(fs.readFileSync(`${dir}/places.json`));
const doc=(id,name,path)=>({id,name,markdown:fs.readFileSync(path,'utf8')});
const image=(id,name,caption,path)=>({id,name,caption,dataUrl:'data:image/png;base64,'+fs.readFileSync(path).toString('base64')});
const village={id:'village',name:'숲마을',description:'forest_high_cliff_river 전용. 공용 장소 7개, 수관·줄기·절벽·물길·배치 검수와 SQLite 저장.',documents:[doc('shared-villages','공용 장소와 저장 안내.md',`${dir}/AI-REFERENCES.md`),doc('placement','16px 숲·절벽·물길 배치.md','tiledata/forest-villages/PLACEMENT.md')],images:selection.map(e=>image(e.slug,e.name+'.png',e.note,`public/assets/region-references/${e.slug}.png`))};
const objects={id:'village-props',name:'마을 소품',description:'16px 온전한 오브젝트 19종. 6열 시트, 금지 소품과 배치·저장 규칙.',documents:[doc('objects','공용 소품 19종 사용 기준.md',`${dir}/OBJECTS-AI.md`)],images:[image('object-atlas','공용 소품 19종.png','6열×14행, 96×224px. 각 키트의 전체 폭과 높이를 유지한다.','public/assets/shared-village/objects.png')]};
fs.writeFileSync('src/assets/sharedVillageReferences.json',JSON.stringify({village,objects})+'\n');
const ts=JSON.parse(fs.readFileSync('src/assets/sharedVillageObjects.json'));ts.referenceDocuments=[objects];fs.writeFileSync('src/assets/sharedVillageObjects.json',JSON.stringify(ts)+'\n');
// New reference-bearing immutable revision; do not overwrite the saved v1 snapshot.
for(const e of selection){
 const ref=`src/project/regionReferences/${e.slug}.json`;const m=JSON.parse(fs.readFileSync(ref));m.tileset.referenceDocuments=[village];fs.writeFileSync(ref,JSON.stringify(m)+'\n');
 const p=JSON.parse(fs.readFileSync(`public/assets/region-references/${e.slug}.oprn.json`));p.tilesets[m.tileset.id].referenceDocuments=[village];fs.writeFileSync(`public/assets/region-references/${e.slug}-v2.oprn.json`,JSON.stringify(p)+'\n');
}
console.log('Prepared 2 village documents/7 images and 1 object document/1 image');
