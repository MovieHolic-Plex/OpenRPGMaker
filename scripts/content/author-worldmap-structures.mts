import { inspectWorldAtlas } from '../../src/project/worldAtlasAudit.ts';
// Author six real SQLite projects, then export PNGs only from reopened canonical snapshots.
// bun scripts/content/author-worldmap-structures.mts --phase create|images --root <fresh project directory> --out <evidence directory>
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createBlankProject} from '../../src/project/defaults.ts';
import {initLocalProjectStore,openLocalProjectStore} from '../../electron/local-store/store.ts';
import {installSharedContent,ensureSharedContent} from '../../src/project/sharedContent.ts';
import {readSharedContentLibrary} from '../lib/sharedContentSqlite.ts';
import {getTool,runTool} from '../../src/editor/tools/index.ts';
import {WORLD_ATLAS_STRUCTURES} from '../../src/project/worldAtlas.ts';
import {renderWorldAtlasSvg} from '../../src/project/worldAtlasRender.ts';
import {renderMapPng} from '../qa-game/render.mts';
import type {Project} from '../../src/project/types.ts';

const arg=(name:string,fallback?:string)=>{const i=process.argv.indexOf('--'+name);return i>=0?process.argv[i+1]!:fallback!;};
const root=path.resolve(arg('root','/home/main/.local/share/oprn/worldmap-structures-20261005'));
const out=path.resolve(arg('out','verify-shots/worldmap-structures'));
fs.mkdirSync(out,{recursive:true});
const manifestPath=path.join(out,'canonical-projects.json');
type Case={structure:string;atlasId:string;projectId:string;folder:string;revision:number;startMapId:string;startPos:{x:number;y:number}};

if(arg('phase','create')==='create'){
  if(fs.existsSync(manifestPath))throw Error('Canonical projects already exist. Use --phase images to reopen and render them.');
  const row=readSharedContentLibrary('worldmap-human-selected');if(!row)throw Error('Actual shared SQLite icon library missing');
  await installSharedContent({revision:createHash('sha256').update(JSON.stringify(row.library)).digest('hex'),libraries:{'worldmap-human-selected':row.library}});
  const project=createBlankProject();project.system.opening=undefined;ensureSharedContent(project);
  const originalIds=new Set(Object.keys(project.maps));
  const args={id:'examples',structure:'all',seed:7};
  console.log('Authoring shared new terrain and accepted landmark pixels…');
  await getTool('author_worldmap_structure')!.prepare?.(args,project);
  const context={project};const result=runTool(context,'author_worldmap_structure',args,{dryRun:false});
  if(!result.ok)throw Error(JSON.stringify(result));
  fs.writeFileSync(path.join(out,'author-tool-result.json'),JSON.stringify(result,null,2));
  const authored=context.project;
  const cases:Case[]=[];
  for(const atlas of authored.worldAtlases!){
    const start=atlas.nodes.find(n=>n.id===atlas.startNodeId)!;
    const kept=new Set([...originalIds,...atlas.nodes.map(n=>n.mapId),...(atlas.overviewMapId?[atlas.overviewMapId]:[])]);
    const p:Project={...authored,meta:{...authored.meta,title:atlas.name},worldAtlases:[atlas],maps:Object.fromEntries(Object.entries(authored.maps).filter(([id])=>kept.has(id))),
      mapTree:{mapId:project.mapTree.mapId,children:[{mapId:atlas.id+'_folder',kind:'folder',name:atlas.name,children:[...atlas.nodes.map(n=>({mapId:n.mapId,children:[]})),...(atlas.overviewMapId?[{mapId:atlas.overviewMapId,children:[]}]:[])]}]},
      startMapId:atlas.overviewMapId??start.mapId,startPos:atlas.overviewMapId?start.worldEntrance!:start.entry};
    const folder=path.join(root,atlas.structure);if(fs.existsSync(path.join(folder,'project.sqlite')))throw Error('Never overwrite an existing canonical project: '+folder);
    let store=await initLocalProjectStore({projectDir:folder});const projectId=store.info().projectId;
    const saved=await store.saveProject(p);if(saved.kind!=='saved')throw Error('Canonical save conflict');store.close();
    store=await openLocalProjectStore({projectDir:folder});const snapshot=store.loadSnapshot()!;
    const reopened=snapshot.project as Project,loadedAtlas=reopened.worldAtlases?.[0];
    if(!loadedAtlas||JSON.stringify(loadedAtlas)!==JSON.stringify(atlas))throw Error('Atlas changed across canonical save/reopen');
    const audit=inspectWorldAtlas(reopened,loadedAtlas);if(!audit.ok)throw Error(JSON.stringify(audit));
    cases.push({structure:atlas.structure,atlasId:atlas.id,projectId,folder,revision:snapshot.revision,startMapId:reopened.startMapId,startPos:reopened.startPos});store.close();
    console.log(JSON.stringify({savedAndReopened:true,...cases.at(-1),audit}));
  }
  fs.writeFileSync(manifestPath,JSON.stringify({source:'SQLite projects, closed and reopened',cases},null,2));
}

const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8')) as {cases:Case[]};
if(manifest.cases.length!==WORLD_ATLAS_STRUCTURES.length)throw Error('All six canonical projects are required');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  const page=await browser.newPage({viewport:{width:960,height:640},deviceScaleFactor:1});
  const summaries:any[]=[];
  for(const item of manifest.cases){
    const store=await openLocalProjectStore({projectDir:item.folder});const snapshot=store.loadSnapshot()!;const project=structuredClone(snapshot.project) as Project;store.close();
    for(const asset of Object.values(project.assets.uploaded))if(asset.ref&&!asset.dataUrl){
      const bytes=fs.readFileSync(path.join(item.folder,'assets',asset.ref.sha256+'.'+asset.ref.extension));
      if(createHash('sha256').update(bytes).digest('hex')!==asset.ref.sha256)throw Error('Canonical asset hash differs');
      asset.dataUrl=`data:${asset.ref.mime};base64,${bytes.toString('base64')}`;
    }
    const atlas=project.worldAtlases![0]!,dir=path.join(out,item.structure);fs.mkdirSync(dir,{recursive:true});
    const images:Record<string,string>={};
    for(const mapId of [...atlas.nodes.map(n=>n.mapId),...(atlas.overviewMapId?[atlas.overviewMapId]:[])]){
      const rendered=renderMapPng(project,project.maps[mapId]!,1);if(rendered.note)throw Error(rendered.note);
      fs.writeFileSync(path.join(dir,mapId+'.png'),rendered.png);images[mapId]='data:image/png;base64,'+rendered.png.toString('base64');
    }
    const landmarkImages=Object.fromEntries(Array.from({length:8},(_,i)=>[i,'data:image/png;base64,'+fs.readFileSync(path.resolve('public/assets/atlas-cartography/icons/'+i+'.png')).toString('base64')]));
    const svg=renderWorldAtlasSvg(atlas,{revealAll:true,mapId:project.startMapId,mapImages:images,landmarkImages});
    fs.writeFileSync(path.join(dir,'atlas.svg'),svg);
    await page.setContent('<!doctype html><html><body style="margin:0">'+svg+'</body></html>');await page.evaluate(()=>document.fonts.ready);
    await page.locator('svg').screenshot({path:path.join(out,item.structure+'.png')});
    const used=new Set([...atlas.nodes.map(n=>n.mapId),...(atlas.overviewMapId?[atlas.overviewMapId]:[])]);
    const runtime:Project={...project,maps:Object.fromEntries(Object.entries(project.maps).filter(([id])=>used.has(id))),
      tilesets:Object.fromEntries(Object.entries(project.tilesets).filter(([id])=>[...used].some(mapId=>project.maps[mapId]!.tilesetId===id)).map(([id,t])=>[id,{...t,referenceDocuments:[],structureKits:[],tileGroups:[]}])) ,
      mapTree:{mapId:project.startMapId,children:[...used].filter(id=>id!==project.startMapId).map(mapId=>({mapId,children:[]}))}};
    delete runtime.worldGraph;
    fs.writeFileSync(path.join(dir,'runtime-project.json'),JSON.stringify(runtime));
    summaries.push({...item,audit:inspectWorldAtlas(project,atlas),png:item.structure+'.png',imageSource:'canonical SQLite reload + real map tile renders + shared atlas renderer'});
  }
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({structures:summaries},null,2));
  const cards=manifest.cases.map(c=>`<section><img src="${c.structure}.png" alt="${c.structure}" /></section>`).join('');
  const html='<!doctype html><html lang="ko"><meta charset="utf-8"><title>월드맵 이동 구조 6종 · 실제 저작 지도</title><style>body{margin:0;background:#12202a}main{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px}img{display:block;width:100%;height:auto}@media(max-width:700px){main{grid-template-columns:1fr}}</style><main>'+cards+'</main></html>';
  fs.writeFileSync(path.join(out,'gallery.html'),html);await page.setViewportSize({width:1952,height:1984});
  const dataCards=manifest.cases.map(c=>`<img style="display:block;width:960px;height:640px" src="data:image/png;base64,${fs.readFileSync(path.join(out,c.structure+'.png')).toString('base64')}"/>`).join('');
  await page.setContent('<!doctype html><body style="margin:0;background:#12202a"><main style="display:grid;grid-template-columns:960px 960px;gap:16px;padding:16px">'+dataCards+'</main>');
  await page.screenshot({path:path.join(out,'all-six.png'),fullPage:true});
  console.log('Images exported from all six reopened canonical SQLite projects: '+out);
}finally{await browser.close();}
