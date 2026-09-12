/** Browser rendering through the editor's mapTileDraw, using saved/reloaded data when available. */
import { chromium } from "playwright";
import fs from "node:fs";
const out="output/evidence/house-studies";
const file=process.argv.includes("--reloaded")?"reloaded-project.json":"preview-project.json";
const project=JSON.parse(fs.readFileSync(`${out}/${file}`,"utf8"));
const manifest=JSON.parse(fs.readFileSync(`${out}/studies.json`,"utf8"));
const origin="http://127.0.0.1:19841";
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1728,height:1120},deviceScaleFactor:1});
  await page.route("**/__house_studies",r=>r.fulfill({contentType:"text/html",body:'<html><meta charset="utf-8"><body></body></html>'}));
  await page.goto(`${origin}/__house_studies`);
  const rendered=await page.evaluate(async({project,manifest})=>{
    const {deserialize}=await import("/src/project/io.ts");
    const {drawMapTileLayers,loadTilesetImage}=await import("/src/editor/mapTileDraw.ts");
    const p=deserialize(JSON.stringify(project)),map=p.maps[manifest.mapId],tileset=p.tilesets[map.tilesetId];
    const atlas=await loadTilesetImage(tileset);
    document.head.insertAdjacentHTML('beforeend','<style>body{margin:0;background:#eee9df;font-family:"Noto Sans CJK KR",sans-serif;color:#33372e}.grid{display:grid;grid-template-columns:repeat(3,576px)}article{box-sizing:border-box;height:592px;border:1px solid #d6d1c5;background:#f8f5ef;position:relative}canvas{display:block;image-rendering:pixelated}h2{font-size:20px;margin:13px 20px 4px;font-weight:600}p{font-size:14px;margin:0 20px;color:#666a60}.art{height:512px;display:flex;align-items:center;justify-content:center;background:#82a85c}</style>');
    const full=document.createElement('canvas');full.width=map.width*16;full.height=map.height*16;
    const context=full.getContext('2d');context.imageSmoothingEnabled=false;
    drawMapTileLayers(context,atlas,map,tileset,1);
    const cards=[];
    for(let group=0;group<2;group++) {
      const grid=document.createElement('section');grid.className='grid';grid.id=`group-${group}`;document.body.append(grid);
      for(let j=0;j<6;j++) {
        const i=group*6+j,study=manifest.placements[i];
        if(!study)continue;
        const card=document.createElement('article'),art=document.createElement('div');card.dataset.number=String(study.number);art.className='art';
        const c=document.createElement('canvas');c.width=576;c.height=512;
        const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
        for(let gy=0;gy<512;gy+=32)for(let gx=0;gx<576;gx+=32)ctx.drawImage(full,0,0,16,16,gx,gy,32,32);
        ctx.drawImage(full,(study.x-1)*16,(study.y-1)*16,(study.width+2)*16,(study.height+2)*16,(576-(study.width+2)*32)/2,(512-(study.height+2)*32)/2,(study.width+2)*32,(study.height+2)*32);
        art.append(c);card.append(art);const h=document.createElement('h2');h.textContent=`${String(study.number ?? i+1).padStart(2,'0')}  ${study.name}`;card.append(h);
        const text=document.createElement('p');text.textContent=study.note;card.append(text);grid.append(card);
        cards.push({id:study.id,png:c.toDataURL('image/png')});
      }
    }
    return {map:full.toDataURL('image/png'),cards};
  },{project,manifest});
  for(let i=0;i<2;i++) await page.locator(`#group-${i}`).screenshot({path:`${out}/houses-${i===0?'01-06':'07-12'}.png`});
  await page.evaluate(()=>{
    const pair=document.createElement('section');pair.id='revised-pair';pair.className='grid';pair.style.gridTemplateColumns='repeat(2,576px)';pair.style.width='1152px';
    for(const n of ['11','12'])pair.append(document.querySelector(`article[data-number="${n}"]`).cloneNode(true));
    document.body.append(pair);
    // cloneNode does not copy canvas pixels.
    for(const n of ['11','12'])pair.querySelector(`article[data-number="${n}"] canvas`).getContext('2d').drawImage(document.querySelector(`article[data-number="${n}"] canvas`),0,0);
  });
  await page.locator('#revised-pair').screenshot({path:`${out}/houses-11-12-revised.png`});
  const writePng=(file,data)=>fs.writeFileSync(file,Buffer.from(data.split(',')[1],'base64'));
  writePng(`${out}/gallery-map.png`,rendered.map);
  for(const card of rendered.cards)writePng(`${out}/${card.id}.png`,card.png);
  fs.writeFileSync(`${out}/index.html`,'<!doctype html><meta charset="utf-8"><title>집 외형 연구 — 11채</title><style>body{background:#eee9df;max-width:1440px;margin:32px auto;font-family:sans-serif;color:#34382d}img{width:100%;image-rendering:pixelated}h1{font-size:26px}p{color:#63695a}</style><h1>집 외형 연구 · 11채 (08번 제외)</h1><p>기존 집 형태를 복제하지 않고 벽·지붕 타일로 조립한 외형 연구. 실제 에디터 타일 렌더링.</p>'+['01-06','07-12'].map(id=>`<img src="data:image/png;base64,${fs.readFileSync(`${out}/houses-${id}.png`).toString('base64')}" alt="집 ${id}">`).join(''));
  fs.writeFileSync(`${out}/render-proof.json`,JSON.stringify({source:file,renderer:"editor/mapTileDraw",houses:manifest.placements.length,mapId:manifest.mapId},null,2));
  console.log(JSON.stringify({source:file,houses:manifest.placements.length,output:out}));
} finally {await browser.close();}
