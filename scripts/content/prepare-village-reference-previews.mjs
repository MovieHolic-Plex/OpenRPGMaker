// 완성 마을 사례 미리보기의 모델 입력용 축소본을 만든다(2026-09-28).
//
// author_village 결과가 가장 가까운 사례 그림을 모델에게 붙인다(src/ai/villageReferenceExamples.ts). 원본
// public/assets/region-references/*.png 는 976~2400px·0.3~1.4MB라 그대로 넣으면 호출마다 무겁고, 헤드리스 Pi 는
// 캔버스가 없어 실행 중에 줄일 수 없다. 사람이 보는 원본은 그대로 두고 긴 변 640px·64색 사본만 둔다.
// 대상은 villageReferenceExamples 가 고를 수 있는 정착지 사례의 preview 전부다(output 없이 목록을 코드에서 읽는다).
//
// Usage: node_modules/.bin/vite-node --script scripts/content/prepare-village-reference-previews.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {REGION_REFERENCES, PLACE_REFERENCES} from '../../src/project/regionReferences.ts';

const outDir='public/assets/village-reference-previews';
const dry=process.argv.includes('--dry');
const MAX_EDGE='640';
const COLORS='64';

const previews=[...new Set([...REGION_REFERENCES,...PLACE_REFERENCES]
 .filter(e=>(e.regionKind==='settlement'||e.placeKind==='settlement')&&e.width>=30&&e.height>=24&&typeof e.preview==='string')
 .map(e=>e.preview))];
if(!dry)fs.mkdirSync(outDir,{recursive:true});
let before=0,after=0;
for(const preview of previews){
 const src=path.join('public',preview);
 if(!fs.existsSync(src)){console.warn('missing',src);continue;}
 const out=path.join(outDir,path.basename(preview));
 before+=fs.statSync(src).size;
 if(dry)continue;
 execFileSync('convert',[src,'-strip','-resize',`${MAX_EDGE}x${MAX_EDGE}>`,'-define','png:compression-level=9','-colors',COLORS,out],{stdio:'ignore'});
 after+=fs.statSync(out).size;
}
console.log(`${previews.length} previews · ${Math.round(before/1024)}KB${dry?'':` → ${Math.round(after/1024)}KB in ${outDir}`}`);
