import { readFileSync } from "node:fs";
import { deserialize } from "@/project/io/serialize";
const a:any=deserialize(readFileSync("qa-runs/poke-fix-p/g8.json","utf8")), b:any=deserialize(readFileSync("/tmp/pfp-g8-export.json","utf8"));
const enc=(p:any)=>Object.values<any>(p.maps).flatMap(m=>(m.encounterTable??[]).map((e:any)=>JSON.stringify([m.id,e.troopId,e.levelMin,e.levelMax,e.conditions?.terrainId])));
const sight=(p:any)=>Object.values<any>(p.maps).flatMap(m=>m.events).filter((e:any)=>e.pages?.some((x:any)=>x.detectionEncounter)).length;
console.log("project id", b.meta?.id ?? b.id ?? "(see store info)", "| sight trainers", sight(a), sight(b), "| encounter entries", enc(a).length, enc(b).length, "equal:", JSON.stringify(enc(a))===JSON.stringify(enc(b)), "| gameOver", JSON.stringify(b.system.gameOver), "| terrains", b.database.terrains.length);
