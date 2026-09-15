import type { InteriorRoomPlan, RoomSpec } from "./interiorRoomPipeline";

/** Reflow new stock blueprints by usable activity size. Explicit authored plans
 * bypass this adapter. Private rooms keep a one-column partition and a two-row
 * wall face plus trim between north/south rooms. */
export function compactHousePlan(plan: InteriorRoomPlan, program?: string): InteriorRoomPlan {
  const source = plan.rooms;
  if (!source?.length) return plan;
  const corridor = source.find(r => r.id === "hall" || r.id === "hall2");
  if (source.length === 5 && corridor?.w === 3) {
    const upperEntry = plan.door.y === corridor.y;
    const rooms = source.map(r => r === corridor ? { ...r, x: 10, y: 4, w: 2, h: 11 }
      : r.y === corridor.y ? { ...r, x: r.x < corridor.x ? 4 : 13, y:4, w:r.x < corridor.x ? 5 : 6, h:r.x < corridor.x ? 3 : 4 }
      : { ...r, x:r.x < corridor.x ? 2 : 13, y:11, w:7, h:4 });
    return { ...plan, width: 22, height: 18, rooms,
      innerDoors: [{ x: 9, y: 5 }, { x: 12, y: 6 }, { x: 9, y: 13 }, { x: 12, y: 13 }],
      door: { x: 10, y: upperEntry ? 4 : 14 } };
  }
  const northSize = (room: RoomSpec) => room.theme === "study" ? {w:6,h:4}
    : (room.id === "work" || (program === "workshop" && room.id === "kitchen")) ? {w:7,h:4} : {w:4,h:3};
  const southSize = (room: RoomSpec) => program === "shop" ? {w:9,h:5} : program === "workshop" ? {w:9,h:4} : room.theme === "tavern" ? {w:10,h:5}
    : room.theme === "kitchen" ? {w:7,h:4} : {w:9,h:4};
  if (source.length === 2) {
    const north=northSize(source[0]!), south=southSize(source[1]!);
    const width=Math.max(north.w,south.w), northX=2+Math.floor((width-north.w)/2), southY=7+north.h;
    const doorX=northX+Math.floor(north.w/2);
    return {...plan,width:width+4,height:southY+south.h+3,
      rooms:[{...source[0]!,x:northX,y:4,...north},{...source[1]!,x:2,y:southY,w:width,h:south.h}],
      innerDoors:[{x:doorX,y:4+north.h}],door:{x:doorX,y:southY+south.h-1}};
  }
  if (source.length === 3) {
    const boxes=source.slice(0,2).map(northSize), northH=Math.max(...boxes.map(r=>r.h));
    const eastX=3+boxes[0]!.w, northW=boxes[0]!.w+1+boxes[1]!.w;
    const south=southSize(source[2]!), width=Math.max(northW,south.w), southY=7+northH;
    return {...plan,width:width+4,height:southY+south.h+3,
      rooms:source.map((r,i)=>({...r,...(i===2?{x:2,y:southY,w:width,h:south.h}
        :{x:i===0?2:eastX,y:4+northH-boxes[i]!.h,...boxes[i]!})})),
      innerDoors:[{x:2+Math.floor(boxes[0]!.w/2),y:4+northH},{x:eastX+Math.floor(boxes[1]!.w/2),y:4+northH}],
      door:{x:2+Math.floor(width/2),y:southY+south.h-1}};
  }
  return plan;
}
