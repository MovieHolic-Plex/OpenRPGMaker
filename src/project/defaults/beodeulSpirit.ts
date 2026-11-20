import catalog from '../../assets/beodeulSpiritCatalog.json' with { type: "json" };
import type {TilesetDef,StructureKitDef,PassFlag} from '../types';
import {translateTiles} from '../objectStamp';

/**
 * 버들항 · 정령 숲 기물(beodeul_spirit, 2026-11-16) — 큰 활엽수 넷 · 중간 활엽수 둘 · 고목 · 정령 버섯 둘 · 정령 꽃 셋.
 * 그림은 Fable 지형 조각(줄기 · 고목 · 버섯 · 꽃)과 버들항 원본 수관 킷을 코드로 조립한 것이다(scripts/content/sheer-terrain/compose_spirit.py,
 * 굽기 bake_spirit.py — object-gate 출구 bundle, 오너 면제 fable-spiritforest-2026-11-16).
 * 이 시트는 이식 원본이다: 깎아지른 지형의 정령 숲 갈래를 지을 때만 beodeul_city 에 칸을 이식하고 kit `bd-sp-<id>` 를 단다
 * (옛 프로젝트 · 다른 맵의 타일셋은 그대로).
 * 칸 역할(catalog.roles): stand = 사람 위에 그리는 칸(통행), block = 막힌 밑동(사람 밑 · 막힘), under = 땅 그림자(사람 밑 · 통행) — 셋 다 윗층(3층) 칸이고
 * 우선순위로 앞뒤를 가른다. walk = 밟고 지나가는 2층 꾸밈.
 */
export const BEODEUL_SPIRIT_TEXTURE='tex_beodeul_spirit';
export const BEODEUL_SPIRIT_KIT_PREFIX='bd-sp-';

type SpiritItem=(typeof catalog.items)[number];
const OPEN:PassFlag={up:true,down:true,left:true,right:true};
const SHUT:PassFlag={up:false,down:false,left:false,right:false};

function sourceTileset():TilesetDef{
 const priority=catalog.roles.map(r=>r==='stand'?'upper' as const:'lower' as const);
 const passability=catalog.roles.map(r=>r==='block'?{...SHUT}:{...OPEN});
 return{id:'beodeul_spirit',name:'버들항 · 정령 숲 기물',image:{type:'bundled',id:BEODEUL_SPIRIT_TEXTURE},kind:'custom',family:'oprn-atlas',
  tileSize:16,tilesPerRow:catalog.tilesPerRow,count:catalog.count,priority,passability,terrain:Array(catalog.count).fill(0),structureKits:[]};
}

function kitFor(it:SpiritItem,map:Map<number,number>):StructureKitDef{
 const tr=(n:number)=>n<0?-1:map.get(n)??-1;
 // 3층 기물: 칸 전부 윗층(upperTiles) — 밑동 · 그림자 칸은 칸 우선순위가 lower 라 사람 밑에 그려진다(beodeul_organic 과 같다). 1층 바닥(풀)은 그대로 남는다.
 const rows=it.rows.map(r=>it.layer===3?{tiles:r.map(()=>-1),upperTiles:r.map(tr)}:{tiles:r.map(()=>-1),lowerOverlayTiles:r.map(tr)});
 const blocked=it.block.map(([x,y])=>`(${x},${y})`).join(' ');
 return{id:BEODEUL_SPIRIT_KIT_PREFIX+it.id,name:`버들항 정령 숲 · ${it.name} ${it.width}×${it.height}`,kind:'section',width:it.width,height:it.height,tileSize:16,learnedFrom:'pack-preset',rows,
  ai:{role:'prop',repeatability:'fixed',layerHome:'perCell',
   tags:['버들항','정령 숲','숲',it.family,it.en],themes:['forest','숲','spirit forest'],
   description:`${it.name} (${it.en}). ${it.layer===3?`Stands: trunk cells ${blocked} block; the crown is drawn above the hero; the ground shadow is walkable.`:'Walk-over ground decoration.'}`,
   placementRules:it.layer===3?'On grass, with its whole footprint on one level. Keep paths, doors and device ends clear.':'Scatter in small clumps on grass, not on the path.'}};
}

/** beodeul_city 에 정령 숲 기물을 이식한다(한 번 이식한 칸은 다시 추가하지 않는다). 바뀌었으면 true. */
export function ensureBeodeulSpirit(ts:TilesetDef):boolean{
 if(ts.id!=='beodeul_city'||ts.image.id!=='tex_beodeul_city')return false;
 const source=sourceTileset();
 const graft=translateTiles(source,ts,catalog.items.flatMap(it=>it.rows.flat().filter(n=>n>=0)));
 let changed=graft.slotsAdded>0;
 for(const [n,target] of graft.map){
  if(target<0)continue;
  if(ts.priority[target]!==source.priority[n]){ts.priority[target]=source.priority[n]!;changed=true;}
  if(JSON.stringify(ts.passability[target])!==JSON.stringify(source.passability[n])){ts.passability[target]=structuredClone(source.passability[n]!);changed=true;}
 }
 const kits=ts.structureKits??=[];
 for(const it of catalog.items){const k=kitFor(it,graft.map);
  const at=kits.findIndex(old=>old.id===k.id);if(at<0){kits.push(k);changed=true;}else if(JSON.stringify(kits[at])!==JSON.stringify(k)){kits[at]=k;changed=true;}}
 return changed;
}

export const BEODEUL_SPIRIT_ITEMS:readonly {readonly id:string;readonly family:string;readonly layer:number;readonly width:number;readonly height:number}[]=catalog.items;
