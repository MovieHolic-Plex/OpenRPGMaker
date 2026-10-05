import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root=path.resolve('content-packs/joseon-folklore');
const collections=['classes','skills','items','equipment','enemies','troops','states','elements','skillChoreographies'];
const data={packId:'joseon-folklore',schemaVersion:1,...Object.fromEntries(collections.map(key=>[key,[]]))};
const roles=['consumables','equipment','monsters','behavior','classes','skills'];
let actions=[];
for(const role of roles) {
  const file=path.join(root,role,'data.json');
  if(!fs.existsSync(file)) continue;
  const source=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const key of collections) data[key].push(...(source[key]??[]));
  actions.push(...(source.enemyActions??[]));
}
const expansion=JSON.parse(fs.readFileSync(path.join(root,'monsters/expansion.json'),'utf8'));
for(const key of collections) data[key].push(...(expansion[key]??[]));
const enemyChoreographies=JSON.parse(fs.readFileSync(path.join(root,'skills/enemy-choreographies.json'),'utf8'));
data.skillChoreographies.push(...enemyChoreographies.skillChoreographies);
for(const [skillId,choreographyId] of Object.entries(enemyChoreographies.skillBindings)) {
  const skill=data.skills.find(row=>row.id===skillId);
  if(!skill || !data.skillChoreographies.some(row=>row.id===choreographyId)) throw new Error('Missing enemy choreography: '+skillId);
  skill.retroChoreographyId=choreographyId;
}
for(const patch of actions) {
  const enemy=data.enemies.find(row=>row.id===patch.enemyId);
  if(!enemy) throw new Error('AI enemy missing: '+patch.enemyId);
  for(const key of ['actions','skillIds','reactions']) if(patch[key]!==undefined) enemy[key]=patch[key];
}
for(const key of collections) {
  const ids=new Set();
  for(const row of data[key]) { if(ids.has(row.id)) throw new Error('Duplicate '+row.id); ids.add(row.id); }
}
for(const enemy of data.enemies) for(const action of enemy.actions ?? []) {
  if(!action.skillId) continue;
  const skill=data.skills.find(row=>row.id===action.skillId);
  if(!skill) throw new Error('Unknown enemy skill: '+action.skillId);
  const cost=skill.mpCost ?? {};
  if(enemy.stats.maxMp < (cost.flat ?? 0)) throw new Error('Enemy cannot afford its skill: '+enemy.id);
}
const icons=[];
for(const asset of JSON.parse(fs.readFileSync(path.join(root,'skills/art.json'),'utf8'))) {
  const target=path.join('public',asset.path);
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(asset.sourcePath,target);
  // Item and skill slugs can coincide (e.g. thunder-charm); their images are distinct.
  icons.push({resourceId:asset.resourceId.replace('jf-icon-','jf-skill-icon-'),path:asset.path,skillId:asset.skillId});
}
// The worker sources are durable code art; publication is owned by this integration step.
for(const role of ['consumables','equipment']) {
  const manifestName=role==='consumables'?'art-manifest.json':'assets.json';
  const manifest=JSON.parse(fs.readFileSync(path.join(root,role,manifestName),'utf8'));
  for(const asset of Array.isArray(manifest)?manifest:manifest.icons) {
    const source=path.join(root,role,asset.sourcePath??asset.sourceFile);
    const target=path.join('public',asset.path);
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
  }
}

for(const role of ['consumables','equipment']) {
  const records=JSON.parse(fs.readFileSync(path.join(root,role,'data.json'),'utf8'));
  for(const row of [...(records.items??[]),...(records.equipment??[])]) {
    const id=row.iconResourceId;
    if(!id) throw new Error('Missing icon '+row.id);
    const filename=id.replace(/^jf-icon-/,'')+'.png';
    const file=`assets/joseon-folklore/${role}/${filename}`;
    if(!fs.existsSync(path.join('public',file))) throw new Error('Missing '+file);
    if(!icons.some(icon=>icon.resourceId===id)) icons.push({resourceId:id,path:file});
  }
}
const sourceSheets=JSON.parse(fs.readFileSync(path.join(root,'monsters/sheets.json'),'utf8'));
const sheets=(Array.isArray(sourceSheets)?sourceSheets:sourceSheets.sheets).map(sheet=>({...sheet,portraitPath:sheet.path.replace(/\.png$/,'-portrait.png')}));
for(const sheet of sheets) {
  const target=path.join('public',sheet.path);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(path.join(root,'monsters/assets',path.basename(sheet.path)),target);
  execFileSync('python3',['-c','from PIL import Image;import sys; im=Image.open(sys.argv[1]); c=int(sys.argv[3]); assert im.size==(c*3,c*3); im.crop((0,0,c,c)).save(sys.argv[2])',path.join('public',sheet.path),path.join('public',sheet.portraitPath),String(sheet.cell)]);
}
fs.writeFileSync('src/assets/joseonFolkloreData.json',JSON.stringify(data,null,2)+'\n');
fs.writeFileSync('src/assets/joseonFolkloreAssets.json',JSON.stringify({icons,sheets},null,2)+'\n');
console.log(JSON.stringify({counts:Object.fromEntries(collections.map(key=>[key,data[key].length])),icons:icons.length,sheets:sheets.length}));
