import fs from "node:fs";
import { firefox } from "playwright";
const root = "output/evidence/interior-catalog-review";
const data = JSON.parse(fs.readFileSync(`${root}/renders-life-verified.json`));
const old = JSON.parse(fs.readFileSync(`${root}/renders-complete.json`));
const audit = JSON.parse(fs.readFileSync(`${root}/audit-life-verified.json`));
const png = (path) =>
  "data:image/png;base64," + fs.readFileSync(path).toString("base64");
const rows = data.renders.map((r) => ({
  ...audit.find((a) => a.id === r.id),
  after: png(`${root}/life-verified/${r.index}.png`),
  before: png(
    `${root}/complete/${old.renders.find((a) => a.id === r.id).index}.png`,
  ),
}));
const out = "output/interior-life";
fs.mkdirSync(out, { recursive: true });
const style = `*{box-sizing:border-box}body{margin:0;background:#15221d;color:#eee9dc;font:16px system-ui,sans-serif}main{max-width:1250px;margin:auto;padding:28px}h1{font-size:28px}p{color:#c1cfc5;line-height:1.6}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{background:#0d1713;padding:16px;border:1px solid #34473b;border-radius:10px}h2{font-size:17px;margin:0 0 12px}img{display:block;width:100%;height:300px;object-fit:contain;image-rendering:pixelated}button{background:#c5d5ab;border:0;padding:10px 18px;margin-bottom:18px;border-radius:6px;cursor:pointer}small{color:#aabdac}.sample main{padding:18px}.sample h1,.sample .intro,.sample button,.sample small{display:none}.sample img{height:310px}@media(max-width:750px){.grid{grid-template-columns:1fr}main{padding:16px}}`;
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>생활 구역으로 구성한 실내 12개</title><style>${style}</style><main><h1>생활 구역으로 구성한 실내 12개</h1><p class="intro">커튼과 난롯가, 러그 위 식탁, 침대 옆 수납장, 돌바닥 세면 구역을 함께 구성했습니다. 기존의 방별 물건 배치와 비교해 보세요.</p><button id="toggle">기존 배치 보기</button><div class="grid"></div></main><script>const rows=${JSON.stringify(rows).replaceAll("<", "\\u003c")};let before=false;function draw(){const grid=document.querySelector('.grid');grid.replaceChildren();for(const r of rows){const card=document.createElement('article');card.className='card';const h=document.createElement('h2');h.textContent=r.name;const img=new Image();img.src=before?r.before:r.after;img.alt=r.name+(before?' 기존':' 변경 후');const p=document.createElement('small');p.textContent=r.width+'×'+r.height+' · '+r.roomCount+'개 방 · '+r.slots+'개 가구 조합';card.append(h,img,p);grid.append(card)}}draw();document.querySelector('button').onclick=()=>{before=!before;document.querySelector('button').textContent=before?'변경 후 보기':'기존 배치 보기';draw()};</script></html>`;
fs.writeFileSync(`${out}/index.html`, html);
const browser = await firefox.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1250, height: 900 },
  });
  await page.setContent(html);
  await page.evaluate(async () => {
    await Promise.all([...document.images].map((i) => i.decode()));
  });
  await page.locator("#toggle").click();
  await page.locator("#toggle").click();
  await page.evaluate(() => {
    document.body.classList.add("sample");
    const cards = [...document.querySelectorAll(".card")];
    cards.forEach((c, i) => {
      if (![0, 2, 3, 5, 6, 9].includes(i)) c.remove();
    });
  });
  await page
    .locator("main")
    .screenshot({ path: "output/evidence/interior-life/samples.png" });
  console.log("Gallery and sample image created");
} finally {
  await browser.close();
}
