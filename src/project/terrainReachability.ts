import { canMove, isPassable } from "./collision";
import type { GameMap, Project } from "./types";

const DIRECTIONS = [[0,-1],[0,1],[-1,0],[1,0]] as const;

/** Directed flood fill using runtime tile+height movement, including ramp side restrictions. */
export function terrainReachability(project:Project,map:GameMap,start:{x:number;y:number}):Uint8Array {
  const reached=new Uint8Array(map.width*map.height);
  if(!isPassable(project,map,start.x,start.y))return reached;
  const queue=new Int32Array(reached.length);let end=1;queue[0]=start.y*map.width+start.x;reached[queue[0]!]=1;
  for(let k=0;k<end;k++){
    const i=queue[k]!,x=i%map.width,y=Math.floor(i/map.width);
    for(const [dx,dy] of DIRECTIONS){
      const X=x+dx,Y=y+dy,j=Y*map.width+X;
      if(X<0||Y<0||X>=map.width||Y>=map.height||reached[j])continue;
      if(canMove(project,map,x,y,X,Y)){reached[j]=1;queue[end++]=j;}
    }
  }
  return reached;
}
