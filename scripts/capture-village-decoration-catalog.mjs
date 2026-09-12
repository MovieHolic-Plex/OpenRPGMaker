/** Native editor-rendered tile map crops; this does not synthesize artwork or write project data. */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
const out=process.argv[2]??"output/evidence/village-decoration";
const cards=JSON.parse(fs.readFileSync(path.join(out,"cards.json"),"utf8"));
const src=fs.readFileSync(path.join(out,"gallery/map-full.png")).toString("base64");
const zone={house:"집 주변",commons:"공용 공간",market:"장터",shore:"호숫가",road:"길가"};
const escape=s=>String(s).replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><title>마을 생활 공간 20종</title>
<style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#f0eee6;color:#28392c;font:16px system-ui}h1{font-size:26px;margin:0 0 8px}p{margin:0 0 20px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}article{background:#fffdf7;border:1px solid #c6caba;border-radius:8px;padding:14px}h2{font-size:15px;min-height:40px;margin:0}small{display:block;color:#63745c;margin-bottom:8px}.preview{height:192px;display:flex;align-items:center;justify-content:center}.tiles{image-rendering:pixelated;background-image:url(data:image/png;base64,${src});background-size:1920px 1920px}button{border:0;background:transparent;cursor:zoom-in}dialog{max-width:90vw;border:1px solid #76876a;border-radius:8px}dialog .preview{height:auto;padding:20px}dialog::backdrop{background:#0009}footer{margin-top:20px}</style>
<h1>마을 생활 공간 20종</h1><p>집 주변 · 공용 공간 · 장터 · 호숫가 · 길가 — 실제 에디터 타일로 저장한 공간입니다. 누르면 확대됩니다.</p><div class="grid">
${cards.map((c,i)=>`<article><h2>${String(i+1).padStart(2,"0")} · ${escape(c.name)}</h2><small>${zone[c.zone]} · ${c.width}×${c.height}칸 · 최대 ${c.maxCount}곳</small><button aria-label="${escape(c.name)} 확대"><div class="preview"><div class="tiles" style="width:${c.width*48}px;height:${c.height*48}px;background-position:-${c.x*48}px -${c.y*48}px"></div></div></button></article>`).join("")}</div><footer>접근 포트와 기존 길을 유지하며, 들어갈 자리가 있는 공간만 배치합니다.</footer><dialog><button id="close">닫기</button><div id="zoom"></div></dialog><script>const d=document.querySelector('dialog');document.querySelectorAll('article button').forEach(b=>b.onclick=()=>{document.querySelector('#zoom').innerHTML=b.innerHTML;d.showModal()});document.querySelector('#close').onclick=()=>d.close();</script></html>`;
fs.writeFileSync(path.join(out,"index.html"),html);
const browser=await chromium.launch({headless:true});try{const page=await browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1});await page.setContent(html);await page.screenshot({path:path.join(out,"catalog.png"),fullPage:true});}finally{await browser.close();}
