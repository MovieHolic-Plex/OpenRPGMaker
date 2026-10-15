import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { canMove } from "@/project/collision";
const p: any = (createMonsterExpedition({ gymCount: 1 }) as any).project;
for (const m of Object.values<any>(p.maps)) {
  // entry cells: transfers destinations into this map
  const entries: {x:number,y:number}[] = [];
  const walk = (cmds: any[]) => { for (const c of cmds ?? []) { if (c.kind==="transfer" && c.mapId===m.id) entries.push({x:c.x,y:c.y}); for (const v of Object.values(c)) if (Array.isArray(v)) walk(v as any[]); } };
  for (const mm of Object.values<any>(p.maps)) for (const e of mm.events) { walk(e.commands); for (const pg of e.pages??[]) walk(pg.commands); }
  if (entries.length < 2) continue;
  const a = entries[0]!, b = entries.find(e => Math.abs(e.x-a.x)+Math.abs(e.y-a.y) > 8);
  if (!b) continue;
  const reach = (block?: string) => { const seen = new Set<string>([`${a.x},${a.y}`]); const q=[[a.x,a.y]]; for (let h=0;h<q.length;h++){const [x,y]=q[h]!; for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx!,ny=y+dy!,k=`${nx},${ny}`; if(seen.has(k)||k===block||nx<0||ny<0||nx>=m.width||ny>=m.height||!canMove(p,m,x!,y!,nx,ny))continue; seen.add(k); q.push([nx,ny]);}} return seen; };
  const base = reach(); if (!base.has(`${b.x},${b.y}`)) continue;
  const cuts: string[] = [];
  for (const k of base) { if (k===`${a.x},${a.y}`||k===`${b.x},${b.y}`) continue; if (!reach(k).has(`${b.x},${b.y}`)) cuts.push(k); }
  if (cuts.length) console.log(m.id, m.tilesetId, m.width+"x"+m.height, "a", JSON.stringify(a), "b", JSON.stringify(b), "cuts", cuts.length, cuts.slice(0,6).join(" "));
}
