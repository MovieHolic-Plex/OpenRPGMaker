import catalog from '../../assets/beodeulOrganicCatalog.json';
import type {TilesetDef,StructureKitDef,PassFlag} from '../types';
import {translateTiles} from '../objectStamp';

/**
 * 버들항 · 자연 기물(beodeul_organic, 2026-10-24) — 숲·들판의 바위·덤불·통나무·그루터기·버섯·들꽃·고사리·풀포기·이끼 돌·고목·사당 돌.
 * 코드 손 도트(scripts/content/beodeul-organic, 버들항 잠금 팔레트). 굽기(bake.py)는 그림마다 object-gate 출구(bundle)를 통과해야 한다.
 * 공용 번들: 새 프로젝트는 beodeul_organic 타일셋을 갖고, beodeul_city(마을·숲 맵이 쓰는 칩셋)에는 같은 그림을 이식해 kit `bd-org-<id>` 로 둔다.
 * 층: layer 3 = 서 있는 기물(3층, block 칸만 막힘), layer 2 = 밟고 지나가는 바닥 꾸미기(2층, 전부 통행).
 */
export const BEODEUL_ORGANIC_TEXTURE='tex_beodeul_organic';
export const BEODEUL_ORGANIC_ID='beodeul_organic';
export const BEODEUL_ORGANIC_KIT_PREFIX='bd-org-';

type OrganicItem=(typeof catalog.items)[number];
const OPEN:PassFlag={up:true,down:true,left:true,right:true};
const SHUT:PassFlag={up:false,down:false,left:false,right:false};

const FAMILY_KO:Record<string,string>={rock:'바위',mossy:'이끼 돌',bush:'덤불',wood:'통나무·그루터기',mushroom:'버섯',fern:'고사리',grass:'풀포기',flower:'들꽃',landmark:'숲 표지물'};

function cellFlags(){
 const priority=Array.from({length:catalog.count},()=>'lower' as 'lower'|'upper');
 const passability=Array.from({length:catalog.count},()=>({...OPEN}));
 for(const it of catalog.items){
  if(it.layer!==3)continue;
  for(const n of it.rows.flat())if(n>=0)priority[n]='upper';
 }
 // 막힘은 칸 그림에 묶인다 — 같은 칸 그림이 다른 기물의 막히지 않는 칸에 쓰여도 막는 쪽이 이긴다(안전).
 for(const it of catalog.items)if(it.layer===3)for(const [x,y] of it.block as number[][]){const n=it.rows[y!]![x!]!;if(n>=0){priority[n]='lower';passability[n]={...SHUT};}}
 return{priority,passability};
}

function kitFor(it:OrganicItem,map?:Map<number,number>):StructureKitDef{
 const up=it.layer===3;
 const tr=(n:number)=>n<0?-1:map?map.get(n)!:n;
 const rows=it.rows.map(r=>up?{tiles:r.map(()=>-1),upperTiles:r.map(tr)}:{tiles:r.map(()=>-1),lowerOverlayTiles:r.map(tr)});
 const blocked=(it.block as number[][]).map(([x,y])=>`(${x},${y})`).join(' ');
 return{id:BEODEUL_ORGANIC_KIT_PREFIX+it.id,name:`버들항 자연 · ${it.name} ${it.width}×${it.height}`,kind:'section',width:it.width,height:it.height,tileSize:16,learnedFrom:'pack-preset',rows,
  ai:{role:'prop',repeatability:'fixed',layerHome:up?'upper':'perCell',
   tags:['버들항','자연','숲','필드',FAMILY_KO[it.family]??it.family,it.en,up?'물체':'바닥 소품(걸음)'],
   themes:['field','forest','필드','숲'],
   description:`${it.name} (${it.en}) — 버들항 화풍 손 도트 자연 기물. ${up?`3층 기물, 막힌 칸 ${blocked}, 나머지는 사람 위에 그려진다.`:'2층 바닥 꾸미기, 밟고 지나간다.'}`,
   placementRules:up
    ?'풀·흙 위에. 길 한가운데·문 앞·다리 끝을 막지 않는다. 같은 기물을 일렬·격자로 세우지 말고 크기와 종류를 섞어 덩이로 둔다. 숲 가장자리·빈터 가장자리·나무 사이 틈에 잘 어울린다.'
    :'풀 위에 덩이로 흩는다(일렬·격자 금지). 길 한가운데에는 두지 않는다. 버섯·고사리는 나무 밑·그늘, 들꽃·풀포기는 빈터·길섶.'}};
}

export function createBeodeulOrganicTileset():TilesetDef{
 const {priority,passability}=cellFlags();
 return{id:BEODEUL_ORGANIC_ID,name:'버들항 · 자연 기물(바위·덤불·통나무·버섯·들꽃)',image:{type:'bundled',id:BEODEUL_ORGANIC_TEXTURE},kind:'custom',family:'oprn-atlas',
  tileSize:16,tilesPerRow:catalog.tilesPerRow,count:catalog.count,priority,passability,terrain:Array(catalog.count).fill(0),
  structureKits:catalog.items.map(it=>kitFor(it)),referenceSourceTilesetId:'beodeul_city'};
}

export function ensureBeodeulOrganicTileset(ts:TilesetDef):boolean{
 if(ts.id!==BEODEUL_ORGANIC_ID||ts.image.id!==BEODEUL_ORGANIC_TEXTURE)return false;
 const fresh=createBeodeulOrganicTileset();let changed=false;
 for(const key of ['count','tilesPerRow','priority','passability','terrain'] as const)if(JSON.stringify(ts[key])!==JSON.stringify(fresh[key])){(ts as any)[key]=fresh[key];changed=true;}
 if(JSON.stringify(ts.structureKits)!==JSON.stringify(fresh.structureKits)){ts.structureKits=fresh.structureKits;changed=true;}
 return changed;
}

/** beodeul_city(마을·숲 맵 칩셋)에 자연 기물을 이식한다. 한 번 이식한 칸은 다시 추가하지 않는다(translateTiles). */
export function ensureBeodeulOrganic(ts:TilesetDef):boolean{
 if(ts.id!=='beodeul_city'||ts.image.id!=='tex_beodeul_city')return false;
 const source=createBeodeulOrganicTileset();
 const graft=translateTiles(source,ts,catalog.items.flatMap(it=>it.rows.flat().filter(n=>n>=0)));
 let changed=graft.slotsAdded>0;
 for(const [n,target] of graft.map){
  if(ts.priority[target]!==source.priority[n]){ts.priority[target]=source.priority[n]!;changed=true;}
  if(JSON.stringify(ts.passability[target])!==JSON.stringify(source.passability[n])){ts.passability[target]=structuredClone(source.passability[n]!);changed=true;}
 }
 const kits=ts.structureKits??=[];
 for(const it of catalog.items){const k=kitFor(it,graft.map);
  const at=kits.findIndex(old=>old.id===k.id);if(at<0){kits.push(k);changed=true;}else if(JSON.stringify(kits[at])!==JSON.stringify(k)){kits[at]=k;changed=true;}}
 const keep=new Set(catalog.items.map(it=>BEODEUL_ORGANIC_KIT_PREFIX+it.id)),next=kits.filter(k=>!k.id.startsWith(BEODEUL_ORGANIC_KIT_PREFIX)||keep.has(k.id));
 if(next.length!==kits.length){ts.structureKits=next;changed=true;}
 return changed;
}

/** 칩셋에 이식된 자연 기물 kit (없으면 undefined). 숲 칠하기·조수 도구가 이름으로 찾는다. */
export function beodeulOrganicKit(ts:TilesetDef,id:string):StructureKitDef|undefined{
 return ts.structureKits?.find(k=>k.id===BEODEUL_ORGANIC_KIT_PREFIX+id);
}
