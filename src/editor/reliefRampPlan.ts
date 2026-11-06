import { layerTileAt } from "@/project/mapLayers";
import { cellLift, reliefLiftField } from "@/project/relief/screen";
import { rampCode, reliefLevel, reliefSlopes, type RampDir } from "@/project/relief/walk";
import type { GameMap } from "@/project/types";
import type { ReliefDoodadPlan } from "./reliefDoodads";
import { terrainLocked } from "@/project/terrainDesign";
import { CUT_MAX_RISE, LONG_RAMP_RUNOUT, reverseCutLength } from "@/project/relief/cutPieces";

/** 경사로 그림이 있는 가장 높은 단 차: 북향은 긴 비탈(길이 = 단 차, 높이 제한 없음), 남향은 낱조각 1~4단. 동서는 칸마다 한 단(그림 무관). */
export function rampMaxRise(dir: RampDir, stairs = false): number {
  return dir === "s" || (dir === "n" && stairs) ? CUT_MAX_RISE : Number.POSITIVE_INFINITY;
}

/** 절벽 위 칸 (x,y) 와 이어진 같은 높이 고원을 to 단으로 낮춘다(잠긴 칸이 끼면 아무것도 안 하고 false). */
function lowerPlateau(draft: GameMap, x: number, y: number, to: number): boolean {
  const r = draft.relief; if (!r) return false;
  const from = reliefLevel(r, x, y), seen = new Set<number>(), stack = [y * draft.width + x];
  while (stack.length) {
    const i = stack.pop()!; if (seen.has(i)) continue;
    const cx = i % draft.width, cy = Math.floor(i / draft.width);
    if ((r.levels[i] ?? 0) !== from) continue;
    seen.add(i);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) { const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < draft.width && ny < draft.height) stack.push(ny * draft.width + nx); }
  }
  if ([...seen].some((i) => terrainLocked(draft.terrainDesign, i))) return false;
  const levels = r.levels.slice(); for (const i of seen) levels[i] = to;
  draft.relief = { ...r, levels };
  return true;
}

const AXES: readonly [RampDir, number, number][] = [["n",0,-1],["s",0,1],["e",1,0],["w",-1,0]];

/** Pick a straight cliff in any direction. The same footprint drives preview and placement. */
export function planReliefRamp(map: GameMap, pick: { x: number; y: number; face: "top" | "wall" }, width: number, stairs: boolean): ReliefDoodadPlan {
  const r = map.relief;
  if (!r) return { ok: false, reason: "언덕 가장자리에 대 보라", rects: [] };
  const slopes = reliefSlopes(r), lift = reliefLiftField(r);
  const hit = slopes.find(s => pick.x >= s.x && pick.x < s.x+s.w && pick.y >= s.y && pick.y < s.y+s.h);
  const candidates: { dir: RampDir; ux: number; uy: number; x: number; y: number; score: number }[] = [];
  for (const [dir,ux,uy] of AXES) {
    if (hit && dir !== hit.dir) continue;
    for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++) {
      let x=pick.x+dx, y=pick.y+dy;
      if (hit) {
        x=dir==="e" ? hit.x+hit.w : dir==="w" ? hit.x-1 : hit.x+Math.floor((hit.w-1)/2);
        y=dir==="s" ? hit.y+hit.h : dir==="n" ? hit.y-1 : hit.y+Math.floor((hit.h-1)/2);
        if (dx || dy) continue;
      }
      const lx=x-ux, ly=y-uy;
      if (x<0 || y<0 || x>=map.width || y>=map.height || lx<0 || ly<0 || lx>=map.width || ly>=map.height) continue;
      if (reliefLevel(r,x,y)>reliefLevel(r,lx,ly)) candidates.push({dir,ux,uy,x,y,score:dx*dx+dy*dy+(pick.face==="wall" && dir!=="n" ? 10 : 0)});
    }
  }
  candidates.sort((a,b)=>a.score-b.score);
  let failure: ReliefDoodadPlan = { ok:false, reason:"곧은 절벽과 아래 평지가 필요하다", rects:[] };
  for (const c of candidates) {
    // A ramp occupies one cell per cliff level. The low and high landings sit
    // outside that strip, so a three-level cliff gets a three-cell ramp rather
    // than an extra approach cell that makes it look like a road.
    // North/south cuts follow the cut-piece contract (cutPieces.ts): a north climb is one row at the cliff foot,
    // a reverse (south) climb rise+2 rows. East/west keep one cell per level (no cut pieces there).
    // 가까운 절벽이 너무 높아 고칠 길을 냈으면, 옆 방향으로 긴 비탈을 대신 깔지 않는다(사용자가 고른 곳은 그 절벽).
    if (failure.fix && c.dir!==candidates[0]!.dir) continue;
    const {dir,ux,uy,x,y}=c, hi=reliefLevel(r,x,y), lo=reliefLevel(r,x-ux,y-uy), rise=Math.max(1, hi-lo);
    // 북향: 1단은 발치 한 줄 낱조각, 2단 이상은 절벽 면을 따라 내려와 낮은 땅 위 두 칸에서 끝나는 긴 비탈(cutPieces.ts longRampPiece). 그림이 없는 높이면 고칠 길을 준다.
    const max=rampMaxRise(dir,stairs);
    if (rise>max) {
      if (!failure.fix) failure={ok:false,reason:`${rise}단 절벽은 경사로 그림이 ${max}단까지라 못 놓습니다`,rects:[],
        fix:{label:`위 땅을 ${lo+max}단으로 낮추고 놓기`,apply:draft=>{ if (lowerPlateau(draft,x,y,lo+max)) planReliefRamp(draft,pick,width,stairs).apply?.(draft); }}};
      continue;
    }
    const length=dir==='n' ? (stairs || rise<2 ? 1 : LONG_RAMP_RUNOUT) : dir==='s' ? reverseCutLength(rise) : rise;
    // Positive transverse axis avoids direction-dependent centering of even widths.
    const ax=uy!==0 ? 1 : 0, ay=ux!==0 ? 1 : 0, half=Math.floor((width-1)/2);
    const cells: {x:number;y:number}[]=[];
    let reason="";
    for (let a=0;a<width;a++) {
      const X=x+(a-half)*ax, Y=y+(a-half)*ay;
      if (reliefLevel(r,X,Y)!==hi || reliefLevel(r,X-ux,Y-uy)!==lo) reason="벽 높이가 고르지 않다 — 곧은 절벽에 대 보라";
      for (let d=1;d<=length;d++) cells.push({x:X-d*ux,y:Y-d*uy});
    }
    // Both flanks must be the same cliff (foot at lo under hi), or the cut's side wall stands loose in the grass.
    if (dir==='n' || dir==='s') for (const a of [-1,width]) {
      const X=x+(a-half)*ax, Y=y;
      if (X<0 || X>=map.width) continue;
      if (reliefLevel(r,X,Y)!==hi || reliefLevel(r,X-ux,Y-uy)!==lo) reason="경사로 양옆도 같은 절벽이어야 한다 — 절벽 가운데로 옮기세요";
    }
    const replaceable=slopes.filter(s=>s.dir===dir && s.lo===lo && s.hi===hi && cells.some(p=>p.x===s.x && p.y===s.y)
      && cells.some(p=>p.x===s.x+s.w-1 && p.y===s.y+s.h-1));
    for (const p of cells) {
      if (p.x<0 || p.y<0 || p.x>=map.width || p.y>=map.height) reason="맵 밖으로 나간다";
      else if (terrainLocked(map.terrainDesign,p.y*map.width+p.x)) reason="영역의 잠금을 먼저 해제하세요";
      else if (reliefLevel(r,p.x,p.y)!==lo) reason=`아래 ${length}칸이 평평해야 한다`;
      else if ((r.ramps?.[p.y*map.width+p.x]??0)>0 && !replaceable.some(s=>p.x>=s.x && p.x<s.x+s.w && p.y>=s.y && p.y<s.y+s.h)) reason="다른 통로에 걸친다";
      else if (layerTileAt(map,3,p.y*map.width+p.x)>=0 || layerTileAt(map,4,p.y*map.width+p.x)>=0) reason="나무·물체를 먼저 옮겨야 한다";
    }
    const rects=cells.map(p=>({x:p.x,y:p.y-cellLift(lift,p.x,p.y),w:1,h:1}));
    if (reason) { if (!failure.rects.length && !failure.fix) failure={ok:false,reason,rects}; continue; }
    return {ok:true,reason:`${{n:"북",s:"남",e:"동",w:"서"}[dir]}쪽 오르막 · 폭 ${width}칸 · 길이 ${length}칸`,rects,
      apply:draft=>{if (!draft.relief) return; const ramps=draft.relief.ramps?.slice()??new Array<number>(draft.width*draft.height).fill(0);
        for (const p of cells) ramps[p.y*draft.width+p.x]=rampCode(dir,stairs);
        draft.relief={...draft.relief,ramps}; }};
  }
  return failure;
}
