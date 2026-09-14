import type { InteriorRoomPlan } from "./interiorRoomPipeline";

/** New small homes use the reference's shared living floor, with furniture-sized
 * northern nooks. Explicit/public/private multi-room plans bypass this adapter. */
export function openHousePlan(plan: InteriorRoomPlan): InteriorRoomPlan {
  const rooms=plan.rooms??[];
  if(rooms.at(-1)?.theme!=="dining")return plan;
  if(rooms.length===2){
    const study=rooms[0]!.theme==="study";
    return {...plan,openPlan:true,width:11,height:12,innerDoors:[],door:{x:7,y:9},rooms:[
      {...rooms[0]!,x:2,y:4,w:4,h:2},
      {id:study?"sleep_nook":"cook_nook",theme:study?"bedroom":"kitchen",x:6,y:4,w:3,h:2,floorTile:study?72:12},
      {...rooms[1]!,x:2,y:6,w:7,h:4},
    ]};
  }
  if(rooms.length===3){
    const leftH=rooms[0]!.theme==="kitchen"?3:2,rightH=rooms[1]!.theme==="kitchen"?3:2;
    const livingY=4+Math.max(leftH,rightH);
    return {...plan,openPlan:true,width:11,height:livingY+6,innerDoors:[],door:{x:7,y:livingY+3},rooms:[
      {...rooms[0]!,x:2,y:livingY-leftH,w:4,h:leftH},
      {...rooms[1]!,x:6,y:livingY-rightH,w:3,h:rightH},
      {...rooms[2]!,x:2,y:livingY,w:7,h:4},
    ]};
  }
  return plan;
}
