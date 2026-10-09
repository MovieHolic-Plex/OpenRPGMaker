/** Render saved tiles with the editor renderer; no substitute/generated house art. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const option=(name,fallback)=>{const at=process.argv.indexOf(name);return at<0?fallback:process.argv[at+1];};
const batch=option("--batch","all"), base=option("--base","http://127.0.0.1:19841");
const out=option("--out",`output/evidence/house-30/${batch}`);
const source=process.argv.includes("--preview")?"preview-project.json":"reloaded-project.json";
const project=JSON.parse(fs.readFileSync(`${out}/${source}`,"utf8"));
const manifest=JSON.parse(fs.readFileSync(`${out}/manifest.json`,"utf8"));
assert.equal(manifest.batch,batch);
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  await page.route("**/__house30",route=>route.fulfill({contentType:"text/html",body:'<!doctype html><meta charset="utf-8"><body></body>'}));
  await page.goto(`${base}/__house30`);
  const rendered=await page.evaluate(async({project,manifest})=>{
    const {deserialize}=await import("/src/project/io.ts");
    const {drawMapTileLayers,loadTilesetImage}=await import("/src/editor/mapTileDraw.ts");
    const p=deserialize(JSON.stringify(project)), maps=new Map();
    for(const mapId of new Set(manifest.placements.map(entry=>entry.mapId))) {
      const map=p.maps[mapId],tileset=p.tilesets[map.tilesetId],atlas=await loadTilesetImage(tileset);
      const canvas=document.createElement("canvas");canvas.width=map.width*map.tileSize;canvas.height=map.height*map.tileSize;
      const ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=false;drawMapTileLayers(ctx,atlas,map,tileset,1);
      maps.set(mapId,{canvas,map});
    }
    const cards=manifest.placements.map(entry=>{
      const {canvas:mapCanvas,map}=maps.get(entry.mapId),canvas=document.createElement("canvas");
      canvas.width=(entry.width+2)*map.tileSize;canvas.height=(entry.height+3)*map.tileSize;
      const ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=false;
      ctx.drawImage(mapCanvas,(entry.x-1)*map.tileSize,(entry.y-1)*map.tileSize,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
      return {...entry,png:canvas.toDataURL("image/png")};
    });
    return {cards};
  },{project,manifest});
  const writePng=(file,data)=>fs.writeFileSync(file,Buffer.from(data.split(",")[1],"base64"));
  for(const card of rendered.cards)writePng(`${out}/${String(card.number).padStart(2,"0")}.png`,card.png);
  // Full-sized boards retain a common one-times tile scale within and between groups.
  await page.evaluate(({cards,batch})=>{
    const width=Math.max(400,...cards.map(c=>(c.width+2)*16+32));
    const height=Math.max(...cards.map(c=>(c.height+3)*16))+106;
    document.head.insertAdjacentHTML("beforeend",`<style>
      *{box-sizing:border-box}body{margin:0;background:#efece4;color:#32382e;font:16px 'Noto Sans CJK KR',sans-serif}
      section{padding:24px;width:max-content}h1{font-size:26px;margin:0 0 6px}header p{margin:0 0 20px;color:#656b61}
      .grid{display:grid;grid-template-columns:repeat(5,${width}px);gap:12px}article{border:1px solid #ccc7ba;background:#faf8f1;height:${height}px;padding:16px}
      .art{height:${height-108}px;display:flex;align-items:end;justify-content:center;background:#e4e8d8}
      img{display:block;image-rendering:pixelated}h2{font-size:19px;margin:10px 0 4px}article p{font-size:13px;color:#646b60;margin:0;max-width:${width-32}px;line-height:1.4}
      #overview .grid{grid-template-columns:repeat(5,384px)}#overview article{height:360px}#overview .art{height:256px}
      #overview img{max-width:352px;max-height:250px;width:auto;height:auto}#overview h2{font-size:17px}
    </style>`);
    const board=(id,title,items)=>{
      const section=document.createElement("section");section.id=id;
      const header=document.createElement("header"),h1=document.createElement("h1"),hint=document.createElement("p");
      h1.textContent=title;hint.textContent="저장된 건물 외형 · 실제 에디터 타일 렌더 · 번호로 비교";header.append(h1,hint);section.append(header);
      const grid=document.createElement("div");grid.className="grid";if(items.length<5)grid.style.gridTemplateColumns=`repeat(${items.length},${width}px)`;
      for(const item of items){const card=document.createElement("article"),art=document.createElement("div"),img=document.createElement("img"),h=document.createElement("h2"),note=document.createElement("p");
        art.className="art";img.src=item.png;img.alt=item.name;art.append(img);h.textContent=`${String(item.number).padStart(2,"0")}  ${item.name}`;
        note.textContent=`${item.width}×${item.height}칸 · ${item.floors}층 외형 · ${item.description}`;card.append(art,h,note);grid.append(card);}
      section.append(grid);document.body.append(section);
    };
    for(const [i,key]of["a","b","c","d"].entries()){
      const group=cards.filter(card=>Math.floor((card.number-1)/10)===i);
      if(group.length)board(`batch-${key}`,`${String(group[0].number).padStart(2,"0")}–${group.at(-1).number} · ${["소형·단층 주택","2층 중심 주택","큰집·중정·다층 주택","정주지 참고 박공집"][i]}`,group);
    }
    if(batch==="all")board("overview",`수정 집과 정주지 참고 ${cards.length}종`,cards);
  },{cards:rendered.cards,batch});
  for(const key of ["a","b","c","d"])if(await page.locator(`#batch-${key}`).count())await page.locator(`#batch-${key}`).screenshot({path:`${out}/houses-${key}.png`});
  if(batch==="all")await page.locator("#overview").screenshot({path:`${out}/houses-30.png`});
  // A standalone inspector uses the same rendered pixels. Click to inspect one house.
  const cardsJSON=JSON.stringify(rendered.cards).replaceAll("<","\\u003c");
  fs.writeFileSync(`${out}/index.html`,`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>집 형태 ${rendered.cards.length}종</title>
    <style>body{margin:24px;background:#efece4;color:#30392c;font:16px sans-serif}nav{display:flex;gap:8px;margin-bottom:20px}button{padding:10px;cursor:pointer}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}article{padding:16px;background:#fbf8f0;border:1px solid #ccc}figure{margin:0;min-height:280px;display:flex;align-items:end;justify-content:center;background:#e4e8d8}img{max-width:100%;image-rendering:pixelated}h2{font-size:19px}dialog{max-width:95vw;background:#f5f2e9}dialog img{width:auto;min-width:50%;max-height:80vh}p{color:#61685c}</style>
    <h1>집 형태 ${rendered.cards.length}종</h1><p>그림을 누르면 확대됩니다. 층수는 외형 기준입니다.</p><nav></nav><main></main><dialog><button>닫기</button><h2></h2><img></dialog>
    <script>const cards=${cardsJSON};const dialog=document.querySelector('dialog');dialog.querySelector('button').onclick=()=>dialog.close();
    function render(group){document.querySelector('main').replaceChildren();for(const c of cards.filter(c=>group<0||Math.floor((c.number-1)/10)===group)){const a=document.createElement('article'),f=document.createElement('figure'),img=document.createElement('img'),h=document.createElement('h2'),p=document.createElement('p');img.src=c.png;img.alt=c.name;img.onclick=()=>{dialog.querySelector('h2').textContent=h.textContent;dialog.querySelector('img').src=c.png;dialog.querySelector('img').style.width=((c.width+2)*32)+'px';dialog.showModal();};h.textContent=String(c.number).padStart(2,'0')+' '+c.name;p.textContent=c.description;f.append(img);a.append(f,h,p);document.querySelector('main').append(a);}}
    ['전체','01–10','11–20','21–30','정주지 참고'].forEach((name,i)=>{const b=document.createElement('button');b.textContent=name;b.onclick=()=>render(i-1);document.querySelector('nav').append(b);});render(-1);</script>`);
  fs.writeFileSync(`${out}/render-proof.json`,JSON.stringify({source,renderer:"editor/mapTileDraw",houses:rendered.cards.length,projectId:manifest.projectId,scale:1},null,2));
  console.log(`${out}/index.html`);
} finally {await browser.close();}
