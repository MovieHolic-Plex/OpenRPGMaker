import { layerTileAt } from "@/project/mapLayers";
import { cellLift, reliefLiftField } from "@/project/relief/screen";
import { rampCode, reliefLevel, reliefSlopes, type RampDir } from "@/project/relief/walk";
import type { GameMap } from "@/project/types";
import type { ReliefDoodadPlan } from "./reliefDoodads";
import { terrainLocked } from "@/project/terrainDesign";

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
    const {dir,ux,uy,x,y}=c, hi=reliefLevel(r,x,y), lo=reliefLevel(r,x-ux,y-uy), length=hi-lo+1;
    // Positive transverse axis avoids direction-dependent centering of even widths.
    const ax=uy!==0 ? 1 : 0, ay=ux!==0 ? 1 : 0, half=Math.floor((width-1)/2);
    const cells: {x:number;y:number}[]=[];
    let reason="";
    for (let a=0;a<width;a++) {
      const X=x+(a-half)*ax, Y=y+(a-half)*ay;
      if (reliefLevel(r,X,Y)!==hi || reliefLevel(r,X-ux,Y-uy)!==lo) reason="벽 높이가 고르지 않다 — 곧은 절벽에 대 보라";
      for (let d=1;d<=length;d++) cells.push({x:X-d*ux,y:Y-d*uy});
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
    if (reason) { if (!failure.rects.length) failure={ok:false,reason,rects}; continue; }
    return {ok:true,reason:`${{n:"북",s:"남",e:"동",w:"서"}[dir]}쪽 오르막 · 폭 ${width}칸 · 길이 ${length}칸`,rects,
      apply:draft=>{if (!draft.relief) return; const ramps=draft.relief.ramps?.slice()??new Array<number>(draft.width*draft.height).fill(0);
        for (const p of cells) ramps[p.y*draft.width+p.x]=rampCode(dir,stairs);
        draft.relief={...draft.relief,ramps}; }};
  }
  return failure;
}
