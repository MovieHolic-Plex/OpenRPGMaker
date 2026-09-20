/** Read-only adversarial study. No authored project writes. */
import fs from 'node:fs';
import {chromium} from 'playwright';
const base='tiledata/castle-tiles-rpgs',out=process.argv[4]??base+'/audit';fs.mkdirSync(out,{recursive:true});
const inputs=[base+'/reference/user-castle.png',process.argv[2]??base+'/reference/revised-layout.png'].map(n=>'data:image/png;base64,'+fs.readFileSync(n).toString('base64'));
// Paired crops have identical source-pixel dimensions. These are thematic areas,
// not registered map coordinates or measured reference object segmentation.
const regions=[
 {id:'forecourt',title:'01 · 본성 앞마당: 바닥 재료와 빈 면',ref:[400,1460,800,330],ours:[420,1550,800,330],note:'참고는 작은 돌 포장·벽 발치 물건·접근부가 이어진다. 수정본은 넓은 황색 반복면에 소품이 떨어져 있다.'},
 {id:'courtyard',title:'02 · 뒤뜰: 군집과 바닥 전이',ref:[400,455,800,470],ours:[470,530,800,470],note:'참고는 노점 뒤 재고, 분수 주변 화분, 흙과 풀의 전이가 묶인다. 수정본은 주요 물체만 떨어져 있고 녹지 경계가 잘린다.'},
 {id:'north',title:'03 · 북쪽 녹지: 수관 밀도',ref:[0,0,1280,260],ours:[0,0,1280,260],note:'참고의 겹친 수관·관목과 수정본의 넓은 반복 잔디를 비교. 같은 원본 픽셀 범위.'},
 {id:'approach',title:'04 · 외부 진입부: 생활 장면과 길',ref:[180,1800,800,400],ours:[280,1890,800,400],note:'참고는 흙길·담장·술집이 엮인다. 수정본은 작은 성벽 건물과 각진 황색 길만 놓였다.'},
];
if(process.argv[2]){for(const r of regions)r.note='개선본 재검토: '+({forecourt:'석재 무늬와 바깥길이 구별되는가? 소품이 휴식·보관 장소로 묶이는가?',courtyard:'녹지 테두리가 이어지는가? 노점 재고와 분수 주변 소품이 동선을 막지 않는가?',north:'수관 사이를 중간 크기 나무가 연결하는가? 동일 나무의 반복이 여전히 드러나는가?',approach:'외부 진입부는 아직 미달이다. 건물 재료와 길 전이는 다음 수정 대상으로 남는다.'}[r.id]);}
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const panel=(r,n)=>{const [x,y,w,h]=n===0?r.ref:r.ours;return `<figure><figcaption>${n===0?'참고':'현재 수정본'} · source px ${x}, ${y}, ${w}, ${h}</figcaption><svg viewBox="${x} ${y} ${w} ${h}" style="aspect-ratio:${w}/${h}"><defs><clipPath id="${r.id}-${n}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><image clip-path="url(#${r.id}-${n})" width="${n===0?2239:2560}" height="${n===0?2235:2304}" href="${inputs[n]}"/></svg></figure>`;};
const html=`<!doctype html><meta charset="utf-8"><title>성채 바닥·밀도 반대 검토</title><style>body{margin:0;background:#151b18;color:#eee;font:16px/1.6 sans-serif}main{padding:24px;width:1120px;margin:auto}h1{font-size:25px}h2{font-size:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}figcaption{color:#cad4cc;font-size:13px}svg{display:block;width:100%;image-rendering:pixelated}section{border-top:1px solid #546054;padding:18px 0}p{margin:8px 0 16px}</style><main><h1>${process.argv[2]?'바닥·소품 밀도: 개선본 재검토':'바닥·소품 밀도: 현재 수정본 미달'}</h1><p>좌우 동일 원본 픽셀 크기의 주제별 관찰창. 참고의 밀도를 수치로 분할한 자료가 아니며, 맵 좌표의 일대일 대응도 아님.</p>${regions.map(r=>`<section id="${r.id}"><h2>${r.title}</h2><div class="pair">${panel(r,0)}${panel(r,1)}</div><p>${esc(r.note)}</p></section>`).join('')}</main>`;
fs.writeFileSync(out+'/comparison.html',html);fs.writeFileSync(out+'/regions.json',JSON.stringify(regions,null,2));
const placements=JSON.parse(fs.readFileSync(process.argv[3]??base+'/assembly-proof.json')).placements;
const props=placements.filter(p=>['lamp','bench','sacks','stela','small-pot','plant-pot','crate'].includes(p.name)&&p.x>=28&&p.x<86&&p.y>=98&&p.y<114);
const cells=58*16,bounds=props.reduce((n,p)=>n+p.w*p.h,0);
fs.writeFileSync(out+'/measurements.json',JSON.stringify({scope:'revised map only; reference has no object segmentation',forecourt:{rectCells:[28,98,58,16],areaCells:cells,nonArchitectureProps:props.length,props,boundingBoxCells:bounds,boundingBoxFraction:bounds/cells,limitation:'Bounding rectangles include transparent pixels; not visual coverage, not reference density ratio. Architecture and NPCs excluded.'},allPlacementRecords:placements.length},null,2));
const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:1168,height:1000}});await page.setContent(html);await page.evaluate(()=>document.fonts.ready);for(const r of regions)await page.locator('#'+r.id).screenshot({path:out+'/'+r.id+'.png'});}finally{await browser.close();}
console.log(JSON.stringify({pairs:regions.length,forecourtProps:props.length,boundingBoxCells:bounds,areaCells:cells}));
