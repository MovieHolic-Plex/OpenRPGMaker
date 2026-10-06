import {setLayerTileAt,layerTileAt} from '@/project/mapLayers';
import {ATLAS_CARTOGRAPHY_ICONS} from '@/project/defaults/atlasCartography';
import {atlasRoomAir} from '@/project/worldAtlasGeometry';
import type {GameMap} from '@/project/types';

const noise=(x:number,y:number,seed:number)=>{const n=Math.sin(x*127.1+y*311.7+seed*17.3)*43758.5453;return n-Math.floor(n);};
type Terrain='grass'|'water'|'stone'|'forest'|'sand'|'snow';
export function fieldTerrain(x:number,y:number):Terrain {
  if(y>86||x<3&&y>30)return 'water';
  const river=22+6*Math.sin(y/11);
  if(y>24&&Math.abs(x-river)<3.2)return 'water';
  if(((x-102)/15)**2+((y-48)/12)**2<1)return 'water';
  if(y<25&&y>13+3*Math.sin(x/9)&&x>35&&x<91)return 'stone';
  if(x<34&&y<30||x>72&&y>60||x<12&&y>51)return 'forest';
  if(x>96&&y>66)return 'sand';
  return 'grass';
}
export function worldTerrain(x:number,y:number):Terrain {
  const left=((x-32)/30)**2+((y-37)/31)**2<1+Math.sin(y*.4)*.08;
  const right=((x-72)/22)**2+((y-30)/26)**2<1+Math.sin(x*.6)*.06;
  if(!left&&!right||x>54&&x<60&&y>9&&y<62)return 'water';
  if(y<17)return 'snow';
  if(x<24&&y>46)return 'sand';
  if(x>64&&y<30&&x<76)return 'stone';
  if(x<28&&y>22&&y<40||x>74&&y>37)return 'forest';
  return 'grass';
}
export function paintAtlasLandscape(map:GameMap,seed:number,terrain:(x:number,y:number)=>Terrain,ox=0,oy=0):void {
  for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
    const gx=x+ox,gy=y+oy,t=terrain(gx,gy),rnd=noise(gx,gy,seed);
    let id=t==='sand'?5:t==='snow'?6:t==='forest'?(rnd>.55?40:58):rnd>.985?7:Math.floor(noise(Math.floor(gx/4),Math.floor(gy/4),seed)*4);
    if(t==='water'||t==='stone'){
      const mask=[[0,-1],[1,0],[0,1],[-1,0]].reduce((mask,[dx,dy],i)=>mask|(terrain(gx+dx!,gy+dy!)!==t?1<<i:0),0);
      id=t==='water'?8+mask:mask?24+mask:noise(Math.floor(gx/2),Math.floor(gy/2),seed)>.65?56:61;
    }
    setLayerTileAt(map,1,y*map.width+x,id);
  }
}
export function atlasRoad(map:GameMap,from:{x:number;y:number},to:{x:number;y:number},width=1):void {
  let x=from.x,y=from.y;
  const mark=()=>{for(let dy=0;dy<width;dy++)for(let dx=0;dx<width;dx++){
    const px=x+dx,py=y+dy;if(px<0||py<0||px>=map.width||py>=map.height)continue;
    const i=py*map.width+px;
    // Bridge decks remain solid looking, walkable paths across actual water.
    const old=layerTileAt(map,1,i);setLayerTileAt(map,1,i,old>=8&&old<24?46:4);setLayerTileAt(map,3,i,-1);
  }};
  mark();
  const dx=to.x-from.x,dy=to.y-from.y,steps=Math.max(Math.abs(dx),Math.abs(dy))*3;
  for(let step=1;step<=steps;step++){
    const t=step/steps,bend=Math.sin(t*Math.PI*2)*Math.sin(t*Math.PI)*2.5;
    const nx=Math.round(from.x+dx*t+(Math.abs(dy)>Math.abs(dx)?bend:0));
    const ny=Math.round(from.y+dy*t+(Math.abs(dx)>=Math.abs(dy)?bend:0));
    while(x!==nx){x+=Math.sign(nx-x);mark();}while(y!==ny){y+=Math.sign(ny-y);mark();}
  }
}
export function atlasLandmark(map:GameMap,index:number,x:number,y:number):void {
  const icon=ATLAS_CARTOGRAPHY_ICONS[index%ATLAS_CARTOGRAPHY_ICONS.length]!;
  for(let dy=0;dy<icon.height;dy++)for(let dx=0;dx<icon.width;dx++){
    const px=x+dx,py=y+dy;if(px<0||py<0||px>=map.width||py>=map.height)continue;
    setLayerTileAt(map,1,py*map.width+px,0);setLayerTileAt(map,3,py*map.width+px,icon.rows[dy]![dx]!);
  }
}
export function paintAtlasRoom(map:GameMap,index:number):void {
  map.sideView=true;map.sideViewJumpTiles=3;map.sideViewFallDamage=0;
  for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
    const air=atlasRoomAir(x,y,map.width,map.height,index);
    setLayerTileAt(map,1,y*map.width+x,air?47:49);
    if(air&&index%3===0&&y===map.height-8&&x%11===0)setLayerTileAt(map,3,y*map.width+x,51);
  }
  for(let x=8;x<map.width-7;x+=10)for(let dx=0;dx<5;dx++){
    const y=map.height-4-(index%2);if(atlasRoomAir(x+dx,y,map.width,map.height,index))setLayerTileAt(map,1,y*map.width+x+dx,49);
  }
  const ladderX=Math.floor(map.width*[.5,.28,.32,.74,.5][index%5]!);
  for(let y=3;y<map.height-2;y++)if(atlasRoomAir(ladderX,y,map.width,map.height,index)){
    setLayerTileAt(map,1,y*map.width+ladderX,50);setLayerTileAt(map,3,y*map.width+ladderX,-1);
    if(y%5===0)for(let dx=-4;dx<=4;dx++)if(dx!==0&&atlasRoomAir(ladderX+dx,y,map.width,map.height,index))setLayerTileAt(map,1,y*map.width+ladderX+dx,49);
  }
}
