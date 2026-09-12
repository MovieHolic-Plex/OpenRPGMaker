/** New exterior studies assembled from atlas materials, never house templates/stamps.
 * All wings contribute to one roof silhouette; only its external contour gets trim.
 * The baked sections are ordinary project objects; no new runtime format is needed.
 */
import type { SectionStructureKitDef } from "../../src/project/types";

type Wall = "plaster" | "stone" | "log";
type Roof = "clay" | "slate";
type Volume = { x: number; y: number; w: number; roof?: number; wall?: number; material?: Wall; color?: Roof; windows?: number[] };
type Point = { x: number; y: number };
type UpperStorey = { x: number; y: number; w: number; h: number; roofStart?: number };
export type HouseStudy = {
  id: string; name: string; note: string; width: number; height: number;
  volumes: Volume[]; doors: Point[];
  upperStorey?: UpperStorey;
  upperStoreys?: UpperStorey[];
  stackedCore?: { source: HouseStudy; levels: number; inset: number; rise: number };
};

export const HOUSE_STUDIES: HouseStudy[] = [
  { id: "cottage", name: "작은 회벽집", note: "낮은 지붕과 짧은 정면 · 기본 주택", width: 6, height: 6,
    volumes: [{x:0,y:0,w:6,roof:2,wall:3,windows:[1,4]}], doors:[{x:3,y:5}] },
  { id: "longhouse", name: "가로로 긴 집", note: "넓은 정면 · 한쪽으로 치우친 입구", width: 11, height: 6,
    volumes: [{x:0,y:0,w:11,roof:2,wall:3,material:"plaster",windows:[2,5,8]}], doors:[{x:3,y:5}] },
  { id: "townhouse", name: "좁은 2층집", note: "짧은 지붕 · 두 층의 창과 회벽", width: 6, height: 8,
    volumes: [{x:0,y:0,w:6,roof:2,wall:5,material:"plaster",windows:[1,4]}], doors:[{x:3,y:7}] },
  { id: "porch", name: "현관이 나온 통나무집", note: "본채 지붕에서 현관까지 이어지는 ㅗ자 지붕", width: 9, height: 9,
    volumes: [{x:0,y:0,w:9,roof:2,wall:3,material:"log",windows:[1,7]},
      {x:3,y:4,w:4,roof:1,wall:3,material:"log",windows:[]}], doors:[{x:4,y:8}] },
  { id: "farm", name: "ㄱ자 농가", note: "왼쪽 본채와 앞으로 나온 오른쪽 날개", width: 11, height: 10,
    volumes: [{x:0,y:0,w:7,roof:3,wall:3,windows:[1,4]},
      {x:5,y:2,w:6,roof:4,wall:3,windows:[1,4]}], doors:[{x:7,y:9}] },
  { id: "split", name: "엇갈린 처마집", note: "용마루와 처마가 꺾여도 한 면으로 이어지는 지붕", width: 12, height: 8,
    volumes: [{x:0,y:0,w:6,roof:2,wall:3,material:"stone",windows:[1,4]},
      {x:5,y:2,w:7,roof:2,wall:3,material:"stone",windows:[1,5]}], doors:[{x:8,y:7}] },
  { id: "setback", name: "어깨가 넓은 2층집", note: "중앙이 솟고 좌우가 넓어지는 한 지붕", width: 12, height: 11,
    volumes: [{x:3,y:0,w:6,roof:2,wall:5,material:"plaster"},
      {x:0,y:3,w:12,roof:2,wall:5,material:"plaster"}], doors:[{x:6,y:10}] },
  { id: "shop", name: "푸른 지붕 상점", note: "가게와 현관이 이어지는 푸른 지붕 · 석조 벽", width: 12, height: 9,
    volumes: [{x:0,y:0,w:12,roof:2,wall:3,material:"stone",color:"slate",windows:[1,3,8,10]},
      {x:4,y:4,w:4,roof:1,wall:3,material:"stone",color:"slate",windows:[]}], doors:[{x:5,y:8}] },
  { id: "courtyard", name: "안마당을 품은 집", note: "뒤채와 양쪽 날개 사이에 열린 작은 마당", width: 14, height: 11,
    volumes: [{x:0,y:0,w:14,roof:2,wall:3,material:"plaster",windows:[2,5,8,11]},
      {x:0,y:5,w:5,roof:2,wall:3,material:"plaster",windows:[2]},
      {x:9,y:5,w:5,roof:2,wall:3,material:"plaster",windows:[2]}], doors:[{x:7,y:5}] },
  { id: "inn", name: "왼쪽 윗채의 2층집", note: "위층 회벽을 드러내고 오른쪽 지붕면을 아래 처마까지 연결", width: 13, height: 12,
    volumes: [{x:1,y:0,w:8,roof:8,wall:3,material:"plaster"},
      {x:0,y:2,w:13,roof:6,wall:3,material:"plaster"}],
    upperStorey:{x:1,y:5,w:8,h:3}, doors:[{x:6,y:11}] },
  { id: "workshop", name: "오른쪽 윗채의 2층집", note: "위층을 오른쪽에 두고 왼쪽 지붕면과 하층 처마를 연결", width: 15, height: 13,
    volumes: [{x:6,y:0,w:8,roof:9,wall:3,material:"plaster",color:"slate"},
      {x:0,y:3,w:15,roof:6,wall:3,material:"plaster",color:"slate"}],
    upperStorey:{x:6,y:5,w:8,h:3}, doors:[{x:7,y:12}] },
];

// Keep review numbers stable after removing study 08.
export const REMOVED_HOUSE_STUDIES = ["house-study-balcony"];
export function houseStudyNumber(id:string):number {
  const ids=["cottage","longhouse","townhouse","porch","farm","split","setback","balcony","shop","courtyard","inn","workshop"];
  const number=ids.indexOf(id)+1;
  if(!number)throw new Error(`Unknown house study ${id}`);
  return number;
}

const WALLS = {
  plaster: [[15,16,17],[45,46,47],[75,76,77]],
  stone: [[12,13,14],[42,43,44],[72,73,74]],
  log: [[102,103,104],[132,133,134],[162,163,164]],
};

export function bakeHouseStudy(study: HouseStudy): SectionStructureKitDef {
  if(study.stackedCore) return bakeStackedHouse(study);
  const rows = Array.from({length:study.height},()=>({tiles:Array<number>(study.width).fill(-1),upperTiles:Array<number>(study.width).fill(-1)}));
  function put(x:number,y:number,tile:number,upper=false) {
    if (!rows[y] || x<0 || x>=study.width) throw new Error(`${study.id}: tile outside ${x},${y}`);
    rows[y]![upper ? "upperTiles" : "tiles"][x]=tile;
  }
  // Union the building columns before drawing. An overlapping wing never brings its
  // own complete ridge/eave rectangle, so no seam is drawn through a shared roof.
  const columns = Array.from({length:study.width},(_,x)=>{
    const wings=study.volumes.filter(v=>x>=v.x && x<v.x+v.w);
    if(!wings.length) return undefined;
    const front=wings.reduce((a,b)=>a.y+(a.roof??2)+(a.wall??3)>b.y+(b.roof??2)+(b.wall??3)?a:b);
    const top=Math.min(...wings.map(v=>v.y));
    const bottom=Math.max(...wings.map(v=>v.y+(v.roof??2)+(v.wall??3)));
    return {top,bottom,eave:bottom-(front.wall??3),material:front.material??"plaster",slate:front.color==="slate"};
  });
  const roofAt=(x:number,y:number):boolean=>!!columns[x] && y>=columns[x]!.top && y<=columns[x]!.eave;
  const eaveAt=(x:number,y:number):boolean=>columns[x]?.eave===y;
  // Contours are computed against the entire union, including re-entrant corners.
  for(let x=0;x<study.width;x++) {
    const c=columns[x]; if(!c)continue;
    for(let y=c.top;y<=c.eave;y++) {
      const top=!roofAt(x,y-1),eave=y===c.eave;
      const left=!roofAt(x-1,y),right=!roofAt(x+1,y);
      if(c.slate) {
        if(eave){put(x,y,467);if(left||right)put(x,y,right?387:386,true);}
        else if(top&&(left||right))put(x,y,right?357:356,true);
        else put(x,y,right?407:406);
      }else{
        if(eave){put(x,y,405);if(left||right)put(x,y,right?385:384,true);}
        else if(top){if(left||right)put(x,y,right?355:354,true);else put(x,y,374);}
        else put(x,y,left||eaveAt(x-1,y)?376:right||eaveAt(x+1,y)?377:404);
      }
    }
    for(let y=c.eave+1;y<=c.bottom;y++) {
      const band=y===c.eave+1?0:y===c.bottom?2:1;
      const sameWall=(nx:number)=>{
        const n=columns[nx];return n && n.eave===c.eave && n.bottom===c.bottom && n.material===c.material;
      };
      put(x,y,WALLS[c.material][band]![!sameWall(x-1)?0:!sameWall(x+1)?2:1]!);
    }
  }
  // Windows belong to visible facade runs, not former component rectangles.
  for(let x=0;x<study.width;) {
    const c=columns[x];if(!c){x++;continue;}
    let end=x;
    while(columns[end+1]?.eave===c.eave && columns[end+1]?.bottom===c.bottom && columns[end+1]?.material===c.material)end++;
    for(let wx=x+1;wx<end;wx+=3) for(let y=c.eave+2;y<c.bottom;y+=2) {
      if(study.doors.some(p=>p.x===wx && y>=p.y-1))continue;
      put(wx,y,c.slate?87:85,true);
    }
    x=end+1;
  }
  for(const storey of study.upperStoreys ?? (study.upperStorey ? [study.upperStorey] : [])) {
    const {x,y,w,h,roofStart=0}=storey;
    const slate=study.volumes[0]?.color==="slate";
    // This is an upper facade opening within a wrapping lower roof, not a second
    // complete house overlaid on another one. The roof continues down its sides
    // and across the lower eave, as in 고양이 map_blank_start (25,20)-(37,31).
    for(let dx=0;dx<w;dx++) {
      // A lower tier must never repaint the already completed facade above it.
      for(let ry=Math.max(1,roofStart);ry<y-1;ry++)put(x+dx,ry,slate?(dx===w-1?407:406):(dx===0?376:dx===w-1?377:404));
      put(x+dx,y-1,slate?467:405);
      put(x+dx,y-1,-1,true);
      for(let dy=0;dy<h;dy++) {
        put(x+dx,y+dy,WALLS.plaster[dy===0?0:1]![dx===0?0:dx===w-1?2:1]!);
        put(x+dx,y+dy,-1,true);
      }
    }
    for(const dx of [2,w-3])put(x+dx,y+1,slate?87:85,true);
  }
  for(const p of study.doors) { put(p.x,p.y-1,116);put(p.x,p.y,146);put(p.x,p.y-1,-1,true);put(p.x,p.y,-1,true); }
  const excluded=new Set([196,197,226,227,256,257]);
  for(const row of rows)for(const tile of [...row.tiles,...row.upperTiles])if(excluded.has(tile))throw new Error(`${study.id}: excluded tile ${tile}`);
  return {id:`house-study-${study.id}`,kind:"section",name:study.name,width:study.width,height:study.height,rows,
    learnedFrom:"db-authored",parts:study.doors.map((p,i)=>({id:`door-${i+1}`,kind:"entrance",dx:p.x,dy:p.y-1,w:1,h:2,note:"남향 출입구. 아래 한 칸은 접근로로 비워 둔다."})),
    ai:{description:study.note,placementRules:"마을의 집. 문 바로 아래 접근로를 비우고 부지 전체가 평지인지 확인한다.",tags:["집","house","주택외형연구",study.id],role:"structure",repeatability:"fixed",layerHome:"perCell"}};
}

/** Paint lower roof planes behind a completed upper building, preserving both
 * side trims. A single union cannot represent the depth discontinuity here.
 */
function bakeStackedHouse(study: HouseStudy): SectionStructureKitDef {
  const {source,levels,inset,rise}=study.stackedCore!;
  let core=bakeHouseStudy({...source,doors:[]});
  for(let level=0;level<levels;level++) {
    const width=core.width+inset*2,height=core.height+rise;
    const roofY=core.height-rise;
    const last=level===levels-1;
    const shell=bakeHouseStudy({...study,stackedCore:undefined,upperStorey:undefined,upperStoreys:undefined,
      width,height,volumes:[{x:0,y:roofY,w:width,roof:height-roofY-4,wall:3,
        material:"plaster",color:source.volumes[0]?.color ?? "clay"}],doors:last?study.doors:[]});
    core.rows.forEach((row,y)=>row.tiles.forEach((tile,x)=>{
      // An opaque upper facade hides the lower plane, including its ridge caps.
      if(tile>=0){shell.rows[y]!.tiles[x+inset]=tile;shell.rows[y]!.upperTiles![x+inset]=-1;}
      const upper=row.upperTiles?.[x] ?? -1;
      if(upper>=0)shell.rows[y]!.upperTiles![x+inset]=upper;
    }));
    core=shell;
  }
  if(core.width!==study.width||core.height!==study.height)throw new Error(`${study.id}: invalid tier extent`);
  return core;
}
