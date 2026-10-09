import type Phaser from "phaser";
import type { GameMap } from "@/project/types";
import { mapTileSize } from "@/project/tileGeometry";
import { terrainHeight } from "@/project/terrainGameplay";
import { reliefRowDepth } from "./playSceneRelief";
/** The same water finish is drawn in editor and exported player. No new tile assets. */
export function drawTerrainWater(scene: Phaser.Scene, map: GameMap, add: (g: Phaser.GameObjects.Graphics, row: number) => void): void {
  const depths = map.terrainDesign?.waterDepth; if (!depths) return;
  const size = mapTileSize(map);
  for (let y=0;y<map.height;y++) {
    let g: Phaser.GameObjects.Graphics | undefined;
    for(let x=0;x<map.width;x++) {
      const i=y*map.width+x,depth=depths[i]??0;if(!depth || map.relief?.ramps?.[i]===9)continue;
      g ??= scene.add.graphics();
      const height=terrainHeight(map,x,y), top=(y-height)*size;
      g.fillStyle(depth===1?0x6ae0d7:0x082b57,depth===1?.14:Math.min(.48,.1+depth*.055));g.fillRect(x*size,top,size,size);
      const below=(y+1)*map.width+x, drop=height-terrainHeight(map,x,y+1);
      if(y+1<map.height && (depths[below]??0)>0 && drop>.5) {
        const bottom=(y+1-terrainHeight(map,x,y+1))*size;
        g.fillStyle(0x43add7,.9);g.fillRect(x*size+2,top+size,size-4,bottom-top-size+size*.3);
        g.lineStyle(1,0xc3f4ff,.85);
        for(let stripe=4;stripe<size;stripe+=4){g.beginPath();g.moveTo(x*size+stripe,top+size);g.lineTo(x*size+stripe,bottom+size*.2);g.strokePath();}
        g.fillStyle(0xe2fbff,.75);g.fillEllipse((x+.5)*size,bottom+size*.3,size*.95,size*.35);
      }
    }
    if(g)add(g,y);
  }
}
const layers = new WeakMap<Phaser.Scene,{mapId:string;design:GameMap["terrainDesign"];relief:GameMap["relief"];objects:Phaser.GameObjects.Graphics[]}>();
export function syncTerrainWater(scene: Phaser.Scene, map: GameMap): void {
  const old=layers.get(scene);
  if(old?.mapId===map.id&&old.design===map.terrainDesign&&old.relief===map.relief)return;
  for(const g of old?.objects??[])g.destroy();
  const objects:Phaser.GameObjects.Graphics[]=[];
  drawTerrainWater(scene,map,(g,row)=>{g.setDepth(reliefRowDepth(row,mapTileSize(map),-.34));objects.push(g);});
  layers.set(scene,{mapId:map.id,design:map.terrainDesign,relief:map.relief,objects});
  if(!old)scene.events.once("shutdown",()=>{for(const g of layers.get(scene)?.objects??[])g.destroy();layers.delete(scene);});
}
