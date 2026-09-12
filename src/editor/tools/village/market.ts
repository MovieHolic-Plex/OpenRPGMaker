import { isSolidChipsetTile, isUpperChipsetTile, rm2k3WoodFloorPassFlag } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import type { GameMap } from "@/project/types";
import { protectedHouseCells } from "../houseProtection";
import { ROAD_TILES, type Point, type Rect } from "./constants";

type Goods = "produce" | "pottery" | "provisions";
type DisplayCell = Point & { readonly tile: number };
export interface MarketDisplay {
  readonly goods: Goods;
  readonly cells: readonly DisplayCell[];
  readonly frontage: readonly Point[];
}
export interface MarketArrangement {
  readonly aisle: readonly Point[];
  readonly displays: readonly MarketDisplay[];
  readonly placed: number;
}

// Combined Town atlas, visually checked: complete 202|203 fruit crate, individual
// 352 earthenware jars, 177/207 casks; 234|235|236 closes each counter at both ends.
const GOODS: readonly { kind: Goods; display: readonly number[]; compact: readonly number[] }[] = [
  { kind: "produce", display: [202,203,237], compact: [202,203] },
  { kind: "pottery", display: [352,352,237], compact: [352] },
  { kind: "provisions", display: [177,207,237], compact: [177] },
];
const DIRECTIONS = [[0,-1,"up","down"],[0,1,"down","up"],[-1,0,"left","right"],[1,0,"right","left"]] as const;

function validRect(rect: Rect): boolean {
  return [rect.x,rect.y,rect.w,rect.h].every(Number.isSafeInteger) && rect.w > 0 && rect.h > 0;
}

/** A wide cross in a large market, one clear cell in the smallest existing plazas. */
export function marketAisleCells(rect: Rect): Point[] {
  if (!validRect(rect)) return [];
  const width = rect.w >= 8 ? 2 : 1, height = rect.h >= 8 ? 2 : 1;
  const x0 = rect.x + Math.floor(rect.w/2) - Math.floor(width/2);
  const y0 = rect.y + Math.floor(rect.h/2) - Math.floor(height/2);
  const result: Point[] = [];
  for(let y=rect.y;y<rect.y+rect.h;y++) for(let x=rect.x;x<rect.x+rect.w;x++) {
    if ((x>=x0 && x<x0+width) || (y>=y0 && y<y0+height)) result.push({x,y});
  }
  return result;
}

/** Plan complete displays against the actual map; a blocked candidate writes nothing.
 * Customer fronts stay connected, and removing a display footprint may not split
 * the formerly walkable component. Existing roads, doors, events and stacks survive.
 */
export function planMarketDisplays(map: GameMap, requested: Rect): MarketArrangement {
  const empty: MarketArrangement = { aisle: [], displays: [], placed: 0 };
  if(!validRect(requested)) return empty;
  const area = { x:Math.max(0,requested.x), y:Math.max(0,requested.y),
    w:Math.min(map.width,requested.x+requested.w)-Math.max(0,requested.x),
    h:Math.min(map.height,requested.y+requested.h)-Math.max(0,requested.y) };
  if(area.w<1 || area.h<1) return empty;
  const index = ({x,y}:Point) => y*map.width+x;
  const protectedCells = new Set(protectedHouseCells(map).map(index));
  const aisle = marketAisleCells(area), reserved = new Set(aisle.map(index));
  for(const region of map.layoutPlan?.regions ?? []) if(region.role==="house" && region.doorAt) {
    for(let dx=-1;dx<=1;dx++) reserved.add(index({x:region.doorAt.x+dx,y:region.doorAt.y+1}));
  }
  for(const event of map.events) {
    protectedCells.add(index(event));
    for(const [dx,dy] of DIRECTIONS) reserved.add(index({x:event.x+dx,y:event.y+dy}));
  }
  const available = new Set<number>();
  for(let y=area.y;y<area.y+area.h;y++) for(let x=area.x;x<area.x+area.w;x++) {
    const at=y*map.width+x, lower=map.lowerTiles[at] ?? TILE.EMPTY;
    if(ROAD_TILES.has(lower)) reserved.add(at);
    if(protectedCells.has(at) || map.upperTiles[at]!==TILE.EMPTY
      || map.lowerTileStacks?.[at]!==undefined || map.upperTileStacks?.[at]!==undefined) continue;
    if(lower<0 || lower>=480 || isSolidChipsetTile(lower) || isUpperChipsetTile(lower)) continue;
    available.add(at);
  }
  const flood = (free:ReadonlySet<number>, start:number):Set<number> => {
    const seen=new Set<number>(), queue=[start];
    while(queue.length) {
      const at=queue.pop()!;
      if(seen.has(at) || !free.has(at)) continue;
      seen.add(at);
      const x=at%map.width, y=Math.floor(at/map.width);
      const from=rm2k3WoodFloorPassFlag(map.lowerTiles[at]!);
      for(const [dx,dy,direction,opposite] of DIRECTIONS) {
        const nx=x+dx, ny=y+dy;
        if(nx<area.x || nx>=area.x+area.w || ny<area.y || ny>=area.y+area.h) continue;
        const next=ny*map.width+nx, to=rm2k3WoodFloorPassFlag(map.lowerTiles[next]!);
        if(from?.[direction]===false || to?.[opposite]===false) continue;
        if(free.has(next) && !seen.has(next)) queue.push(next);
      }
    }
    return seen;
  };
  // A pre-existing obstacle can split a plaza. Author only its largest component
  // with a boundary entry; never manufacture an isolated, unreachable sales pocket.
  let free=new Set<number>();
  const unseen=new Set(available);
  while(unseen.size) {
    const component=flood(available,unseen.values().next().value!);
    for(const at of component)unseen.delete(at);
    const boundary=[...component].some(at=>at%map.width===area.x || at%map.width===area.x+area.w-1
      || Math.floor(at/map.width)===area.y || Math.floor(at/map.width)===area.y+area.h-1);
    if(boundary && component.size>free.size) free=component;
  }
  const seed=aisle.map(index).find(at=>free.has(at));
  if(seed===undefined) return { ...empty, aisle };
  const displays: MarketDisplay[]=[];
  const centerY=area.y+Math.floor((area.h-1)/2);
  const tryDisplay = (goods:typeof GOODS[number], compact:boolean):boolean => {
    const row=compact?goods.compact:goods.display, width=row.length, height=compact?1:2;
    const candidates: {x:number;y:number;south:boolean;frontY:number}[]=[];
    for(let y=area.y;y<=area.y+area.h-height;y++) for(let x=area.x;x<=area.x+area.w-width;x++) {
      const south=y+height<=centerY+1, frontY=south?y+height:y-1;
      if(frontY>=area.y && frontY<area.y+area.h)candidates.push({x,y,south,frontY});
    }
    candidates.sort((a,b)=>Number(b.south)-Number(a.south) || Math.abs(a.frontY-centerY)-Math.abs(b.frontY-centerY) || a.x-b.x);
    for(const candidate of candidates) {
      const cells:DisplayCell[]=[], frontage:Point[]=[];
      for(let dx=0;dx<width;dx++) {
        cells.push({x:candidate.x+dx,y:candidate.y+(candidate.south||compact?0:1),tile:row[dx]!});
        if(!compact)cells.push({x:candidate.x+dx,y:candidate.y+(candidate.south?1:0),tile:[234,235,236][dx]!});
        frontage.push({x:candidate.x+dx,y:candidate.frontY});
      }
      if(cells.some(cell=>!free.has(index(cell)) || reserved.has(index(cell))) || frontage.some(cell=>!free.has(index(cell))))continue;
      const after=new Set(free);
      for(const cell of cells)after.delete(index(cell));
      const reachable=flood(after,seed);
      if(reachable.size!==after.size)continue;
      free=after;
      for(const cell of frontage)reserved.add(index(cell));
      // Keep separate counters legible and leave room to pass their ends.
      for(let dy=0;dy<height;dy++) {
        reserved.add(index({x:candidate.x-1,y:candidate.y+dy}));
        reserved.add(index({x:candidate.x+width,y:candidate.y+dy}));
      }
      displays.push({goods:goods.kind,cells,frontage});
      return true;
    }
    return false;
  };
  // Give each commodity a slot before adding repeats. Tiny plazas use intact
  // compact goods displays; an overlarge counter is never clipped into fragments.
  for(const goods of GOODS) if(!tryDisplay(goods,false)) tryDisplay(goods,true);
  const target=Math.min(8,Math.max(3,Math.floor(area.w*area.h/24)));
  for(let i=0;displays.length<target && i<GOODS.length*2;i++)tryDisplay(GOODS[i%GOODS.length]!,false);
  return {aisle,displays,placed:displays.reduce((count,display)=>count+display.cells.length,0)};
}

export function placeMarketDisplays(map: GameMap, area: Rect): MarketArrangement {
  const result=planMarketDisplays(map,area);
  for(const display of result.displays) for(const cell of display.cells) map.upperTiles[cell.y*map.width+cell.x]=cell.tile;
  return result;
}
