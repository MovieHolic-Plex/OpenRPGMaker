import { readFileSync } from "node:fs";
import { deserialize } from "@/project/io/serialize";
const p:any = deserialize(readFileSync("qa-runs/poke-fix-p/g8.json","utf8"));
const m=p.maps.mx_map_moon_gym;
console.log(m.width,m.height);
for (const e of m.events) console.log(e.id,e.x,e.y, e.pages[0].graphic?.kind ?? "", !!e.pages[0].detectionEncounter);
