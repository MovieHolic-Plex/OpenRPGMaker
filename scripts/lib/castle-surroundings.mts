import fs from 'node:fs';
import { createCastleTileset } from '../../src/project/defaults/castleTileset';
import type { GameMap, Project, SectionStructureKitDef } from '../../src/project/types';

export const HARBOR_TILESET_ID = 'castle_courtyard_harbor';
const ASSET_ID = 'castle_courtyard_harbor_atlas';
const base = 'public/assets/castle-surroundings/';
const manifest = JSON.parse(fs.readFileSync(base+'manifest.json','utf8')) as {
  width:number;height:number;count:number;alpha:string;
  parts:Record<string,{rect:[number,number,number,number];label:string;source:string}>;
};

/** A project-owned atlas: original castle indices stay identical for every map. */
export function installCastleSurroundings(project:Project) {
  project.assets.uploaded[ASSET_ID] = {
    id:ASSET_ID,name:'성채 · 항구와 자연 (CC-BY-SA 3.0)',kind:'chipset',
    dataUrl:'data:image/png;base64,'+fs.readFileSync(base+'atlas.png').toString('base64'),
    meta:{width:manifest.width,height:manifest.height,tileSize:16},
  };
  const tileset=createCastleTileset();
  tileset.id=HARBOR_TILESET_ID;tileset.name='성채 · 항구와 자연';
  tileset.image={type:'uploaded',id:ASSET_ID};tileset.count=manifest.count;
  // Do not inherit the older, misidentified prototype kits.
  tileset.structureKits=[];
  for(let tile=1024;tile<manifest.count;tile++) {
    tileset.passability.push({up:false,down:false,left:false,right:false});
    tileset.priority.push('upper');tileset.terrain.push(0);
    tileset.tileMeta!.push({label:'수변 소품 '+tile,description:'원본 수변·자연 소재의 16px 조각',defaultLayer:'upper',passage:'solid',
      tags:['수변','덧그림',...(manifest.alpha[tile]==='O'?[]:['투명'])],source:'ai'});
  }
  for(const [key,part] of Object.entries(manifest.parts)) {
    const [sx,sy,w,h]=part.rect;
    const rows=Array.from({length:h},(_,y)=>({tiles:Array(w).fill(-1),
      upperTiles:Array.from({length:w},(_,x)=>{
        const tile=(sy+y)*32+sx+x;
        tileset.tileMeta![tile].label=part.label;
        if(key==='soil') {
          tileset.tileMeta![tile].defaultLayer='lower';tileset.tileMeta![tile].passage='passable';
          tileset.priority[tile]='lower';tileset.passability[tile]={up:true,down:true,left:true,right:true};
        }
        return manifest.alpha[tile]==='E'?-1:tile;
      })}));
    if(key==='soil')for(const row of rows){row.tiles=row.upperTiles;row.upperTiles=Array(w).fill(-1);}
    const kit:SectionStructureKitDef={id:'castle-harbor-'+key,name:part.label,kind:'section',
      width:w,height:h,rows,learnedFrom:'db-authored',
      ai:{description:part.label+' — '+part.source,placementRules:'완성형 소품. 바닥을 보존하고 덧그림으로 배치.',
        repeatability:'fixed',layerHome:key==='soil'?'lower':'upper',origin:'ai',confidence:'high',role:'prop'}};
    tileset.structureKits.push(kit);
  }
  project.tilesets[tileset.id]=tileset;
  project.resourceProfiles=project.resourceProfiles.filter(p=>p.assetId!==ASSET_ID);
  project.resourceProfiles.push({kind:'chipset',name:tileset.name,assetId:ASSET_ID,
    tileWidth:16,tileHeight:16,imageWidth:manifest.width,imageHeight:manifest.height});
}

export function dressCastleSurroundings(map:GameMap,placements:{name:string;x:number;y:number;w:number;h:number}[]) {
  map.tilesetId=HARBOR_TILESET_ID;
  const cell=(x:number,y:number)=>{
    if(x<0||y<0||x>=map.width||y>=map.height)throw Error(`Outside map: ${x},${y}`);
    return y*map.width+x;
  };
  function stamp(key:string,x:number,y:number) {
    const [sx,sy,w,h]=manifest.parts[key].rect;
    placements.push({name:key,x,y,w,h});
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++) {
      const tile=(sy+yy)*32+sx+xx;if(manifest.alpha[tile]==='E')continue;
      const i=cell(x+xx,y+yy);
      if(map.upperTiles[i]>=0) {
        map.upperTileStacks??={};
        (map.upperTileStacks[i]??=[]).push(tile);
      }else map.upperTiles[i]=tile;
    }
  }
  // Harbor: solid land loading court -> wooden landing -> open-water berths.
  stamp('dock',106,42);stamp('dock',112,42);
  stamp('boatLeft',112,37);stamp('boatRight',112,49);
  stamp('sacks',101,40);stamp('firewood',100,47);
  // Northern fishing landing, deliberately smaller than the cargo harbor.
  stamp('dock',106,23);stamp('sacks',102,22);
  // A low grassy shelf feeds the two falls instead of waterfalls floating in water.
  for(let yy=0;yy<10;yy++)for(let xx=0;xx<12;xx++) {
    const sx=xx<2?xx:xx>=10?4+xx-10:2+xx%2;
    const sy=yy<2?26+yy:yy>=8?30+yy-8:28+yy%2;
    map.lowerTiles[cell(110+xx,4+yy)]=sy*32+sx;
  }
  stamp('boulders',111,5);
  // Short relief falls at the northern water entry; the eastern channel stays open.
  for(const x of [112,116])for(let yy=0;yy<6;yy++)for(let xx=0;xx<2;xx++)
    map.lowerTiles[cell(x+xx,12+yy)]=(26+yy)*32+12+xx;

  // Trees are whole, masked atlas islands; never isolated canopy/trunk fragments.
  for(const [x,y] of [[8,8],[8,84],[100,72],[78,93]])stamp('tree',x,y);
  for(const [x,y] of [[27,8],[34,7],[67,8],[76,8],[84,7],[10,35],[11,40],
    [101,16],[102,31],[104,57],[99,93],[24,102],[37,102],[66,103],[71,106]])stamp('bush',x,y);
  // Rock clusters and reeds explain the bank, with gaps at every dock and bridge.
  stamp('boulders',99,6);stamp('boulders',10,103);stamp('boulders',87,106);
  for(const [x,y] of [[11,30],[101,54],[102,98],[36,105],[81,8]])stamp('cairn',x,y);
  for(const [x,y] of [[107,31],[108,53],[119,26],[120,75],[108,99],[6,37],[6,66]])stamp('reeds',x,y);
  for(const [x,y] of [[103,34],[100,57],[123,34],[122,82],[98,105],[20,106],[32,102]])stamp('grass',x,y);
  // Market produce and kitchen garden. Rows are short with access gaps.
  stamp('produce',10,55);stamp('sacks',10,65);stamp('firewood',10,75);
  const [soilX,soilY]=manifest.parts.soil.rect;
  for(const left of [26,80])for(let yy=0;yy<5;yy++)for(let xx=0;xx<10;xx++)
    map.lowerTiles[cell(left+xx,47+yy)]=(soilY+yy%2)*32+soilX+xx%2;
  for(const x of [27,30,33])stamp('corn',x,47);
  for(const x of [81,84,87])stamp('tomato',x,47);
  stamp('stela',33,100);stamp('stela',73,100);
  for(const [x,y] of [[27,20],[82,20],[35,92],[78,92]])stamp('vine',x,y);
  map.locations!.push(
    {id:'second-castle-cargo-harbor',name:'나룻배 두 척과 화물 부두',x:100,y:37,w:20,h:17,tags:['항구','나룻배','목조 부두']},
    {id:'second-castle-kitchen-garden',name:'성채 텃밭',x:26,y:47,w:11,h:8,tags:['텃밭','옥수수']},
  );
  map.layoutPlan!.notes+=' 수변·자연 소재는 원본 예시에 명시된 Daniel Eddeland와 Hyptosis 원본 시트에서 가져옴.';
}
