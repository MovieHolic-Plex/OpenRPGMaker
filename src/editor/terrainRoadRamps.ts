import type { GameMap } from "@/project/types";
import { rampCode, type RampDir, reliefAllowsStep } from "@/project/relief/walk";
import { terrainEditable } from "./terrainDesignPlans";
import type { TerrainPoint } from "./terrainDesignGeometry";
/** Fall back to the available road corridor when a wide rectangular ramp does not fit. */
export function connectTerrainRoad(map: GameMap, road: TerrainPoint[], width: number, touched: Set<number>): { ramps: number; blocked: number } {
  const r = map.relief; if (!r) return { ramps:0,blocked:0 };
  r.ramps ??= new Array<number>(map.width * map.height).fill(0);
  let ramps = 0;
  for (let n = 1; n < road.length; n++) {
    const a = road[n-1]!, b = road[n]!, ai = a.y * map.width + a.x, bi = b.y * map.width + b.x;
    if (Math.abs(a.x-b.x)+Math.abs(a.y-b.y) !== 1 || reliefAllowsStep(r,a.x,a.y,b.x,b.y)) continue;
    const low = r.levels[ai]! < r.levels[bi]! ? a : b, high = low === a ? b : a;
    const dx = high.x-low.x, dy = high.y-low.y, dir: RampDir = dx > 0 ? "e" : dx < 0 ? "w" : dy > 0 ? "s" : "n", lo = r.levels[low.y*map.width+low.x]!, hi = r.levels[high.y*map.width+high.x]!;
    // Keep a flat landing at bends: move the height break one cell along the straight exit.
    const before = road[n-2], after = road[n+1];
    const bend = low === a ? before && (a.x-before.x !== dx || a.y-before.y !== dy) : after && (after.x-b.x !== -dx || after.y-b.y !== -dy);
    if (bend) {
      const landing = high.y*map.width+high.x;
      const continuation = low === a ? after : before;
      if (continuation && Math.abs(continuation.x-high.x)+Math.abs(continuation.y-high.y) === 1 && touched.has(landing) && terrainEditable(map,landing) && continuation.x-high.x === dx && continuation.y-high.y === dy) { r.levels[landing] = lo; touched.add(landing); n = low === a ? n - 1 : Math.max(0,n - 2); continue; }
    }
    const maxLength = hi-lo+1, half = Math.floor((width-1)/2); let placed = false;
    for (let side = -half; side <= half; side++) {
      const X = low.x + (dy ? side : 0), Y = low.y + (dx ? side : 0), Hx = X+dx, Hy = Y+dy;
      if (X<0 || Y<0 || X>=map.width || Y>=map.height || Hx<0 || Hy<0 || Hx>=map.width || Hy>=map.height || r.levels[Y*map.width+X] !== lo || r.levels[Hy*map.width+Hx] !== hi) continue;
      for (let d=0; d<maxLength; d++) {
        const x=X-d*dx,y=Y-d*dy,i=y*map.width+x;
        if(x<0||y<0||x>=map.width||y>=map.height||r.levels[i]!==lo||!terrainEditable(map,i)||!touched.has(i)) break;
        const centerIndex = road.findIndex(p=>p.x===x&&p.y===y);
        if(centerIndex>0 && centerIndex<road.length-1) { const prev=road[centerIndex-1]!,next=road[centerIndex+1]!; if(prev.x!==next.x && prev.y!==next.y) break; }
        r.ramps[i]=rampCode(dir); touched.add(i); placed=true;
      }
    }
    if (placed) ramps++;
  }
  const blocked = road.slice(1).filter((b,n)=>{const a=road[n]!;return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1&&!reliefAllowsStep(r,a.x,a.y,b.x,b.y);}).length;
  return { ramps,blocked };
}
