import fs from "node:fs";
import { createExpeditionSeed } from "../../src/project/examples/monsterExpedition/seed.ts";
import { MAP_TOOLS } from "../../src/editor/tools/mapTools.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { store } from "../../src/project/store.ts";
import { AUTOTILE_DIR } from "../../src/project/defaults/autotileEngine.ts";
const project = createExpeditionSeed(); store.loadProject?.(project);
const ts = project.tilesets["monster_dungeon"]!;
const g = ts.autotileGroups!.find((x) => x.id === "ru_pb")!;
const W = 24, H = 14;
const rows = [
"........................",
"........................",
"..######................",
"..#....#................",
"..#....#...##...........",
"..#....#...##...........",
"..######................",
"........................",
"....#########...........",
"........................",
"....#.....#.....#.......",
"....#.....#.....#.......",
"....#.....#.....#.......",
"........................",
];
const wall = (x:number,y:number)=> x<0||y<0||x>=W||y>=H ? false : rows[y]![x]==="#";
const BITS=[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]] as const;
const lower:number[]=[];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){ if(wall(x,y)){let m=0;for(const[dx,dy,b]of BITS)if(wall(x+dx,y+dy))m|=b;lower.push(g.variantMap[String(m)]!);} else lower.push(1776+((x+y)%4)); }
MAP_TOOLS.find((t)=>t.name==="create_map")!.run(project,{id:"t",name:"t",width:W,height:H,tilesetId:ts.id,border:"none"});
const map=project.maps["t"]!; map.lowerTiles=lower; map.upperTiles=new Array(W*H).fill(-1);
fs.writeFileSync("/tmp/dg/ru-test.png", renderMapPng(project,map,3).png);
