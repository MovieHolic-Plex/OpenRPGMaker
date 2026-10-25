// 조수 도구 author_beodeul_town(roofs medieval) 를 새 프로젝트에서 그대로 불러 중세 건물 마을을 짓고 그림을 남긴다(저장 안 함 — 증거 그림).
import fs from 'node:fs';
import {createBlankProject} from '../../src/project/defaults/blankProject.ts';
import {AUTHOR_BEODEUL_TOWN_TOOL} from '../../src/editor/tools/authorBeodeulTown.ts';
import {renderMapPng} from '../qa-game/render.mts';
const out=process.env.OUT??'qa-runs/harnesses/building-kit/massing/town';fs.mkdirSync(out,{recursive:true});
const args=JSON.parse(process.argv[2]??'{}');
const p=createBlankProject();
const r:any=AUTHOR_BEODEUL_TOWN_TOOL.run(p as any,{roofs:'medieval',theme:'river',width:64,height:48,...args});
const mapId=r.mapId??r.data?.mapId;
const m=p.maps[mapId]!;
const kits=new Set<string>();
for(const a of (m as any).structurePlacements??[])kits.add(a.kitId);
fs.writeFileSync(`${out}/town-${args.seed??'x'}.png`,renderMapPng({...p,startMapId:''},m).png);
console.log(JSON.stringify({mapId,summary:r.summary,data:r.data,warnings:(r.warnings??[]).slice(0,5),mk:[...kits].filter(k=>k.startsWith('bd-house-mk-'))}).slice(0,3000));
