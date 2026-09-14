import type { InteriorRoomPlan, RoomSpec } from './interiorRoomPipeline';

type MutableRoom = { -readonly [K in keyof RoomSpec]: RoomSpec[K] };
type Box = { x: number; y: number; w: number; h: number };
type Link = { a: number; b: number; x: number; y: number };
type Candidate = { rooms: RoomSpec[]; links: Link[]; score: number };
const hash = (text: string) => [...text].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const overlap = (a: number, aw: number, b: number, bw: number) => Math.min(a + aw, b + bw) - Math.max(a, b);

/** Generate room relationships before their tile geometry. Only new stock house
 * plans call this search; explicit layouts and frozen source geometry bypass it.
 * North-facing art, minimum approaches, wall depth and privacy constrain growth.
 */
export function generateHouseTopology(plan: InteriorRoomPlan, identity: string, accept?: (candidate: InteriorRoomPlan) => boolean): InteriorRoomPlan {
  const source = plan.rooms;
  if (!source || source.length < 2) return plan;
  let state = hash(`${identity}:${plan.seed}`) || 1;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  const integer = (n: number) => Math.floor(random() * n);
  const open = plan.openPlan === true;
  const entrance = source.findIndex(r => plan.concept?.rooms[r.id]?.role === 'entrance');
  const main = entrance >= 0 ? entrance : source.findIndex(r => /living|dining|tavern|shop/.test(r.id));
  const root = main >= 0 ? main : source.length - 1;
  const candidates: Candidate[] = [];
  for (let attempt = 0; attempt < 96; attempt++) {
    const rooms: MutableRoom[] = source.map(r => ({ ...r }));
    // A corridor is not a fixed eleven-cell spine: its length follows adjoining functions.
    for (const r of rooms) {
      if (r.theme === 'corridor') { r.w = 2 + integer(2); r.h = 4 + integer(3); }
      else if (open && r.id === source[root]!.id) {
        r.w = 7 + integer(2); r.h = 4;
      } else if (open) {
        r.w = Math.max(r.theme === 'study' ? 4 : 3, r.w + integer(2) - 1);
      }
    }
    rooms[root] = { ...rooms[root]!, x: 0, y: 0 };
    const placed = [root], todo = source.map((_, i) => i).filter(i => i !== root);
    // Corridor and work/service rooms can become intermediate nodes; beds stay leaves.
    todo.sort((a,b) => Number(rooms[b]!.theme === 'corridor') - Number(rooms[a]!.theme === 'corridor'));
    const links: Link[] = [];
    let failed = false;
    for (const index of todo) {
      let accepted = false;
      for (let trial = 0; trial < 48; trial++) {
        const parents = placed.filter(i => rooms[i]!.theme !== 'bedroom' && (open || rooms[i]!.theme !== 'kitchen'));
        const parent = parents[integer(parents.length)] ?? root;
        const a = rooms[parent]!, b = rooms[index]!;
        const side = integer(4), horizontal = side < 2, gap = open ? 0 : horizontal ? 1 : 3;
        const shared = open ? 2 : 1;
        const offset = horizontal ? -b.h + shared + integer(a.h + b.h - 2 * shared + 1)
          : -b.w + shared + integer(a.w + b.w - 2 * shared + 1);
        const next: RoomSpec = { ...b, x: horizontal ? (side === 0 ? a.x - b.w - gap : a.x + a.w + gap) : a.x + offset,
          y: horizontal ? a.y + offset : side === 2 ? a.y - b.h - gap : a.y + a.h + gap };
        if (placed.some(i => !separated(rooms[i]!, next, open))) continue;
        const x = horizontal ? (side === 0 ? next.x + next.w : a.x + a.w)
          : Math.floor((Math.max(a.x,next.x)+Math.min(a.x+a.w,next.x+next.w)-1)/2);
        const y = horizontal ? Math.floor((Math.max(a.y,next.y)+Math.min(a.y+a.h,next.y+next.h)-1)/2)
          : side === 2 ? next.y+next.h : a.y+a.h;
        rooms[index] = next; placed.push(index); links.push({ a: parent, b: index, x, y }); accepted = true; break;
      }
      if (!accepted) { failed = true; break; }
    }
    if (failed || rooms.some(r => !northCapacity(r, rooms, open))) continue;
    const left=Math.min(...rooms.map(r=>r.x)),top=Math.min(...rooms.map(r=>r.y));
    const width=Math.max(...rooms.map(r=>r.x+r.w))-left,height=Math.max(...rooms.map(r=>r.y+r.h))-top;
    if (width > 30 || height > 28 || Math.max(width/height,height/width)>2.8) continue;
    const area=rooms.reduce((n,r)=>n+r.w*r.h,0), degrees=rooms.map((_,i)=>links.filter(l=>l.a===i||l.b===i).length);
    // Compactness is one criterion, not an instruction to collapse every result
    // into the same box. Seeded selection below retains different graph/outline solutions.
    const score=area/(width*height) - Math.max(0,Math.max(...degrees)-3)*0.08;
    candidates.push({rooms,links,score});
  }
  if (!candidates.length) return plan;
  candidates.sort((a,b)=>b.score-a.score);
  const offset=integer(Math.min(24,candidates.length));
  for(let choice=0;choice<candidates.length;choice++){
  const chosen=candidates[(offset+choice)%candidates.length]!;
  const dx=2-Math.min(...chosen.rooms.map(r=>r.x)),dy=4-Math.min(...chosen.rooms.map(r=>r.y));
  const rooms=chosen.rooms.map(r=>({...r,x:r.x+dx,y:r.y+dy}));
  // Entrance always lies on an exposed south edge. It may enter the common room,
  // a service room or a hallway; never use a bed as the building's passage.
  const entries=rooms.flatMap((r,i)=>r.theme==='bedroom'?[]:Array.from({length:r.w},(_,j)=>({x:r.x+j,y:r.y+r.h-1,i})))
    .filter(p=>!rooms.some((r,i)=>i!==p.i&&p.x>=r.x-1&&p.x<r.x+r.w+1&&r.y>p.y&&r.y<=p.y+4))
    .sort((a,b)=>Number(b.i===root)-Number(a.i===root));
  const rootEntries=entries.filter(p=>p.i===root), available=rootEntries.length?rootEntries:entries;
  if (!available.length) continue;
  const door=available[integer(available.length)]!;
  const candidate = {...plan,rooms,wings:rooms.map(({x,y,w,h})=>({x,y,w,h})),
    width:Math.max(...rooms.map(r=>r.x+r.w))+2,height:Math.max(...rooms.map(r=>r.y+r.h))+3,
    innerDoors:open?[]:chosen.links.map(({x,y})=>({x:x+dx,y:y+dy})),door:{x:door.x,y:door.y}};
  if (!accept || accept(candidate)) return candidate;
  }
  return plan;
}

function separated(a: Box,b: Box,open: boolean): boolean {
  const ox=overlap(a.x,a.w,b.x,b.w),oy=overlap(a.y,a.h,b.y,b.h);
  if (ox>0&&oy>0) return false;
  if (open) return ox<=0 || a.y+a.h===b.y || b.y+b.h===a.y || a.y+a.h+3<=b.y || b.y+b.h+3<=a.y;
  if (oy>0) return a.x+a.w+1<=b.x||b.x+b.w+1<=a.x;
  if (ox>0) return a.y+a.h+3<=b.y||b.y+b.h+3<=a.y;
  return true;
}
function northCapacity(room: RoomSpec, rooms: readonly RoomSpec[], open: boolean): boolean {
  if (!open) return true;
  const minimum=room.theme==='study'?3:room.theme==='bedroom'||room.theme==='kitchen'?1:0;
  let run=0,best=0;
  for(let x=room.x;x<room.x+room.w;x++){
    const covered=rooms.some(other=>other!==room&&x>=other.x&&x<other.x+other.w&&room.y-1>=other.y&&room.y-1<other.y+other.h);
    run=covered?0:run+1;best=Math.max(best,run);
  }
  return best>=minimum;
}
