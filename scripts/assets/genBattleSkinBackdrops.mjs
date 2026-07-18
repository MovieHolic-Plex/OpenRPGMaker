import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const WIDTH = 480;
const HEIGHT = 270;
const OUTPUT_DIR = path.resolve("public/assets/generated/battle-skins");
const pixels = new Uint8Array(WIDTH * HEIGHT * 3);

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return out;
}

function encodePng(width, height, data) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * width * 3, width * 3).copy(raw, row + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const rgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const clamp = (v, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], clamp(t, 0, 1))));

const BAYER_4 = [
  [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
];
export const bayer4 = (x, y) => (BAYER_4[y & 3][x & 3] + 0.5) / 16;

function setPixel(x, y, color, alpha = 1) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT || alpha <= 0) return;
  const i = (y * WIDTH + x) * 3;
  for (let c = 0; c < 3; c += 1) pixels[i + c] = Math.round(lerp(pixels[i + c], color[c], clamp(alpha, 0, 1)));
}

export function ditheredBand(y, stops, x = 0) {
  const p = clamp(y / (HEIGHT - 1), 0, 1);
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (p >= stops[i][0] && p <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const t = clamp((p - a[0]) / Math.max(0.0001, b[0] - a[0]), 0, 1);
  const levels = 48;
  const q = clamp((Math.floor(t * levels) + (bayer4(x, y) < (t * levels) % 1 ? 1 : 0)) / levels, 0, 1);
  return mix(a[1], b[1], q);
}

function gradient(stops, from = 0, to = HEIGHT) {
  for (let y = from; y < to; y += 1) for (let x = 0; x < WIDTH; x += 1) setPixel(x, y, ditheredBand(y, stops, x));
}

export function fillPolygon(points, color, alpha = 1) {
  const minY = Math.max(0, Math.ceil(Math.min(...points.map((p) => p[1]))));
  const maxY = Math.min(HEIGHT - 1, Math.floor(Math.max(...points.map((p) => p[1]))));
  for (let y = minY; y <= maxY; y += 1) {
    const xs = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j];
      if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i < xs.length; i += 2) for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1] ?? xs[i]); x += 1) setPixel(x, y, color, alpha);
  }
}

function ellipse(cx, cy, rx, ry, color, alpha = 1, feather = 0) {
  for (let y = Math.floor(cy - ry - feather); y <= cy + ry + feather; y += 1) for (let x = Math.floor(cx - rx - feather); x <= cx + rx + feather; x += 1) {
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
    if (d <= 1 + feather / Math.max(rx, ry)) setPixel(x, y, color, d <= 1 ? alpha : alpha * (1 - (d - 1) * Math.max(rx, ry) / feather));
  }
}

function line(x0, y0, x1, y1, color, alpha = 1, width = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i += 1) ellipse(lerp(x0, x1, i / steps), lerp(y0, y1, i / steps), width / 2, width / 2, color, alpha);
}

export function radialGlow(cx, cy, radius, color, alpha = 1) {
  for (let y = Math.max(0, cy - radius); y <= Math.min(HEIGHT - 1, cy + radius); y += 1) for (let x = Math.max(0, cx - radius); x <= Math.min(WIDTH - 1, cx + radius); x += 1) {
    const t = 1 - Math.hypot(x - cx, y - cy) / radius;
    if (t > 0) setPixel(x, y, color, alpha * t * t);
  }
}

function hash(x, y, seed = 0) { let n = (x * 374761393 + y * 668265263 + seed * 69069) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
export function noiseDots(count, area, colors, alpha = 1, seed = 1, size = 1) {
  const [x0, y0, x1, y1] = area;
  for (let i = 0; i < count; i += 1) {
    const x = lerp(x0, x1, hash(i, seed, 3)), y = lerp(y0, y1, hash(i, seed, 7));
    ellipse(x, y, size * (0.5 + hash(i, seed, 11)), size * (0.5 + hash(i, seed, 13)), colors[i % colors.length], alpha * (0.45 + hash(i, seed, 17) * 0.55));
  }
}

export function vignette(strength = 0.45, color = rgb("#050812")) {
  for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
    const dx = (x - WIDTH / 2) / (WIDTH / 2), dy = (y - HEIGHT / 2) / (HEIGHT / 2);
    setPixel(x, y, color, strength * Math.max(0, (dx * dx + dy * dy - 0.32) / 0.9) ** 1.5);
  }
}

function ground(y0, top, bottom, horizon = rgb("#d8e6ce")) {
  for (let y = y0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
    const t = (y - y0) / Math.max(1, HEIGHT - y0 - 1), q = (Math.floor(t * 40) + (bayer4(x, y) < (t * 40) % 1 ? 1 : 0)) / 40;
    setPixel(x, y, mix(top, bottom, q));
  }
  line(0, y0, WIDTH, y0, horizon, 0.45, 1);
}

function hills(yBase, peaks, color) { fillPolygon([[0, yBase], ...peaks, [WIDTH, yBase], [WIDTH, HEIGHT], [0, HEIGHT]], color); }
function cloud(cx, cy, scale, color, alpha = 1) {
  ellipse(cx, cy, 34 * scale, 8 * scale, color, alpha, 3);
  ellipse(cx - 18 * scale, cy - 5 * scale, 14 * scale, 10 * scale, color, alpha, 2);
  ellipse(cx + 4 * scale, cy - 10 * scale, 18 * scale, 15 * scale, color, alpha, 3);
  ellipse(cx + 24 * scale, cy - 4 * scale, 13 * scale, 10 * scale, color, alpha, 2);
}
function tree(x, y, s, crown, trunk = rgb("#27362e")) { fillPolygon([[x - 3*s,y],[x+3*s,y],[x+2*s,y-22*s],[x-2*s,y-22*s]],trunk); ellipse(x,y-27*s,14*s,16*s,crown); ellipse(x-10*s,y-23*s,10*s,12*s,crown); ellipse(x+10*s,y-22*s,10*s,12*s,crown); }
function platform(cx, cy, rx, ry, color) { ellipse(cx, cy + 3, rx, ry, rgb("#23452f"), 0.22, 3); ellipse(cx, cy, rx, ry, color, 0.82, 2); ellipse(cx, cy - 1, rx * 0.78, ry * 0.55, rgb("#f4f2c8"), 0.22); }
function reset() { pixels.fill(0); }

function pokemon() {
  reset(); gradient([[0,rgb("#55a9e5")],[.24,rgb("#78c9ee")],[.48,rgb("#a9e3ed")],[.66,rgb("#d8f3dc")],[1,rgb("#62a942")]]);
  radialGlow(390,45,55,rgb("#fffbd2"),.32); cloud(95,55,.8,rgb("#f8ffff"),.86); cloud(300,79,.62,rgb("#efffff"),.78);
  hills(171,[[0,161],[50,147],[108,159],[164,139],[225,155],[292,142],[352,157],[420,143],[480,158]],rgb("#4d9d79"));
  hills(190,[[0,180],[35,163],[72,179],[106,157],[138,179],[178,160],[220,181],[260,157],[300,178],[347,158],[395,178],[438,159],[480,176]],rgb("#287454"));
  ground(183,rgb("#72c64a"),rgb("#287a39"),rgb("#c9ea79")); noiseDots(150,[0,190,480,269],[rgb("#98dd59"),rgb("#3d963c")],.35,2,1);
  platform(126,230,82,17,rgb("#e9efb2")); platform(361,194,59,12,rgb("#f2efbd")); vignette(.18,rgb("#164b5b"));
}

function rm2003() {
  reset(); gradient([[0,rgb("#498dcc")],[.23,rgb("#75b5e0")],[.48,rgb("#a8d5e6")],[.64,rgb("#e2e3ae")],[1,rgb("#4e8b38")]]);
  cloud(100,57,.68,rgb("#f5f1d5"),.75); cloud(355,77,.55,rgb("#fff7dc"),.7);
  hills(183,[[0,158],[55,132],[115,164],[183,128],[255,163],[330,130],[405,158],[480,139]],rgb("#5f9d58"));
  hills(201,[[0,177],[62,151],[128,183],[208,148],[289,180],[370,150],[480,180]],rgb("#3e8241"));
  hills(214,[[0,199],[78,174],[146,202],[232,171],[315,199],[401,175],[480,199]],rgb("#2c6635"));
  ground(204,rgb("#55953e"),rgb("#28572d"),rgb("#9fbd68"));
  fillPolygon([[205,270],[275,270],[257,204],[237,204]],rgb("#b59358"),.75); fillPolygon([[219,270],[261,270],[251,204],[243,204]],rgb("#d2b471"),.4);
  tree(74,205,.72,rgb("#285d35")); tree(405,207,.58,rgb("#326b38")); noiseDots(80,[0,208,480,268],[rgb("#75ac49"),rgb("#c7c05b")],.35,9,1); vignette(.24,rgb("#173149"));
}

function rm2000() {
  reset(); gradient([[0,rgb("#111b3d")],[.25,rgb("#263458")],[.48,rgb("#6a4b58")],[.62,rgb("#dc794a")],[1,rgb("#1b332b")]]);
  radialGlow(395,151,75,rgb("#ffac58"),.35); cloud(118,72,.62,rgb("#6c7180"),.35);
  hills(190,[[0,170],[65,136],[123,171],[205,133],[284,174],[376,142],[480,168]],rgb("#263e3b"));
  hills(211,[[0,189],[72,158],[151,192],[224,161],[303,193],[392,160],[480,186]],rgb("#1a302d"));
  ground(203,rgb("#263c2d"),rgb("#101d1b"),rgb("#a7613c")); tree(320,202,1.05,rgb("#111d1e"),rgb("#151c1b"));
  noiseDots(45,[0,210,480,269],[rgb("#526044"),rgb("#8f7145")],.24,20,1); vignette(.5,rgb("#070b18"));
}

function octopath() {
  reset(); gradient([[0,rgb("#061416")],[.22,rgb("#0b2020")],[.45,rgb("#233027")],[.61,rgb("#8b6435")],[1,rgb("#071314")]]);
  radialGlow(240,154,120,rgb("#ffbd55"),.68); radialGlow(240,158,53,rgb("#ffe39a"),.38);
  hills(190,[[0,175],[70,150],[135,180],[201,151],[280,181],[355,145],[480,177]],rgb("#142725"));
  hills(214,[[0,197],[82,173],[155,200],[245,177],[330,201],[410,170],[480,197]],rgb("#0a1a1b"));
  ground(205,rgb("#18241e"),rgb("#050b0c"),rgb("#9c7440"));
  fillPolygon([[187,205],[210,205],[210,104],[225,91],[255,91],[270,104],[270,205],[293,205],[293,88],[314,88],[314,219],[166,219],[166,88],[187,88]],rgb("#081516"));
  fillPolygon([[210,123],[220,105],[260,105],[270,123],[258,116],[222,116]],rgb("#101d1b"));
  for (const [y,a] of [[173,.27],[190,.34],[218,.24]]) { fillPolygon([[0,y],[95,y-8],[190,y+4],[300,y-7],[395,y+3],[480,y-5],[480,y+18],[0,y+18]],rgb("#b9c8ad"),a); }
  noiseDots(105,[55,75,430,235],[rgb("#ffd36a"),rgb("#fff0aa")],.72,31,1.2); vignette(.75,rgb("#020607"));
}

function chrono() {
  reset(); gradient([[0,rgb("#08142f")],[.23,rgb("#182859")],[.45,rgb("#4c4079")],[.62,rgb("#5984a7")],[1,rgb("#102a48")]]);
  radialGlow(346,70,76,rgb("#9ff7ff"),.67); ellipse(346,70,35,35,rgb("#e5ffff"),.94,2); noiseDots(50,[10,12,470,125],[rgb("#d9ffff"),rgb("#8bd7f2")],.75,44,.8);
  hills(183,[[0,170],[62,105],[121,162],[187,93],[252,169],[323,114],[388,159],[438,103],[480,155]],rgb("#302d61"));
  hills(207,[[0,186],[74,139],[142,190],[219,133],[302,187],[375,143],[480,184]],rgb("#1b2850"));
  ground(198,rgb("#173e61"),rgb("#081a35"),rgb("#72dbe2"));
  for (let y=205;y<267;y+=7) { const w=(y-198)*2.4; line(346-w/2,y,346+w/2,y,rgb("#62dce4"),.22+(bayer4(y,1)*.15),1); }
  fillPolygon([[0,225],[80,215],[150,224],[220,217],[300,225],[390,214],[480,223],[480,270],[0,270]],rgb("#0b223d"),.38); vignette(.48,rgb("#07081d"));
}

function bravely() {
  reset(); gradient([[0,rgb("#f5eedb")],[.24,rgb("#eee3cb")],[.48,rgb("#f1d6bd")],[.65,rgb("#e7aa91")],[1,rgb("#8d7f63")]]);
  radialGlow(92,67,63,rgb("#fffbea"),.4); cloud(335,63,.72,rgb("#fff8e8"),.55);
  hills(188,[[0,163],[65,128],[120,166],[190,137],[265,168],[335,127],[410,163],[480,139]],rgb("#aeb79a"),.92);
  hills(207,[[0,185],[80,151],[143,189],[225,148],[304,186],[390,153],[480,183]],rgb("#b48f87"),.88);
  ground(201,rgb("#9ca17a"),rgb("#686b55"),rgb("#d5b18f"));
  fillPolygon([[299,202],[299,152],[311,152],[311,128],[321,119],[331,128],[331,202]],rgb("#6f6d64"),.8); fillPolygon([[262,202],[262,169],[280,169],[280,150],[292,150],[292,202]],rgb("#74766b"),.8); fillPolygon([[337,202],[337,161],[359,161],[359,202]],rgb("#676b63"),.8);
  noiseDots(100,[0,20,480,260],[rgb("#fff4db"),rgb("#bd8e86"),rgb("#88957b")],.18,52,2); vignette(.26,rgb("#6e504b"));
}

function dragonquest() {
  reset(); gradient([[0,rgb("#01030a")],[.24,rgb("#040816")],[.49,rgb("#09152b")],[.68,rgb("#0b1b35")],[1,rgb("#01040c")]]);
  radialGlow(240,151,150,rgb("#183c70"),.34);
  hills(201,[[0,194],[75,186],[145,196],[231,181],[318,197],[400,187],[480,194]],rgb("#071126"));
  hills(220,[[0,211],[100,202],[188,215],[280,201],[380,216],[480,207]],rgb("#030818"));
  ground(216,rgb("#07152c"),rgb("#01030a"),rgb("#18385c"));
  for (let y=230;y<270;y+=10) line(0,y,480,y,rgb("#244b76"),.3,1);
  for (let x=0;x<=480;x+=48) line(240,216,x,270,rgb("#244b76"),.28,1);
  ellipse(240,222,92,8,rgb("#1a3d67"),.18,5); noiseDots(30,[70,60,410,205],[rgb("#28568b")],.18,61,.8); vignette(.7,rgb("#000106"));
}

function ff() {
  reset(); gradient([[0,rgb("#18273e")],[.23,rgb("#354c68")],[.47,rgb("#71879a")],[.61,rgb("#e7cda2")],[1,rgb("#343e48")]]);
  radialGlow(239,157,105,rgb("#fff1bd"),.38);
  fillPolygon([[118,0],[170,0],[263,189],[231,189]],rgb("#ddecf2"),.09); fillPolygon([[325,0],[357,0],[278,190],[251,190]],rgb("#fff5d4"),.08);
  hills(190,[[0,174],[67,118],[117,158],[175,92],[239,166],[299,108],[351,159],[418,101],[480,164]],rgb("#465466"));
  hills(211,[[0,190],[70,151],[138,197],[220,145],[291,195],[370,151],[480,188]],rgb("#293746"));
  ground(202,rgb("#59615f"),rgb("#252b30"),rgb("#d9c8a1"));
  fillPolygon([[44,249],[68,224],[91,230],[103,258]],rgb("#202933")); fillPolygon([[370,263],[392,227],[422,221],[450,270]],rgb("#1e2832")); fillPolygon([[264,247],[277,228],[296,234],[309,254]],rgb("#303940"));
  noiseDots(95,[0,205,480,269],[rgb("#85847b"),rgb("#3d464b")],.34,72,1.5); vignette(.48,rgb("#111824"));
}

function mother() {
  reset();
  const pal=[rgb("#ff28b8"),rgb("#18e2ef"),rgb("#ffe33d"),rgb("#6624dc"),rgb("#ff612e")];
  for(let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++) {
    const dx=x-240,dy=y-135,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
    const u=(x+y*1.55+r*.24+Math.sin(a*5)*13)/30, v=(x*-.72+y+r*.18-Math.cos(a*4)*11)/37;
    const i=((Math.floor(u)%pal.length)+pal.length)%pal.length,j=((Math.floor(v)%pal.length)+pal.length)%pal.length;
    const edge=(u-Math.floor(u)+v-Math.floor(v))*.5, q=bayer4(x,y)<edge?1:0;
    setPixel(x,y,mix(pal[i],pal[j],.28+.32*q));
  }
  radialGlow(240,135,92,rgb("#fff7bd"),.22);
  hills(202,[[0,184],[80,163],[155,192],[240,158],[325,193],[405,160],[480,184]],rgb("#25104b"),.62);
  hills(222,[[0,209],[95,190],[180,214],[270,187],[360,216],[480,194]],rgb("#100525"),.72);
  ground(216,rgb("#341265"),rgb("#09031c"),rgb("#50f2dc"));
  for(let r=24;r<90;r+=15) { for(let a=0;a<Math.PI*2;a+=.035) setPixel(240+Math.cos(a)*r,135+Math.sin(a)*r*.55,pal[(r/15|0)%pal.length],.35); }
  noiseDots(90,[20,15,460,250],[rgb("#ffffff"),rgb("#fff331")],.45,83,1); vignette(.38,rgb("#12001f"));
}

function goldensun() {
  reset(); gradient([[0,rgb("#63364c")],[.22,rgb("#b95c47")],[.43,rgb("#ed8c46")],[.61,rgb("#ffd06a")],[1,rgb("#795127")]]);
  radialGlow(126,151,92,rgb("#ffd86b"),.7); ellipse(126,151,31,31,rgb("#fff0a0"),.94,2); cloud(350,68,.65,rgb("#ffd391"),.27);
  hills(191,[[0,177],[65,148],[132,174],[205,137],[280,177],[360,145],[430,169],[480,155]],rgb("#a76435"));
  hills(211,[[0,193],[86,165],[165,197],[250,159],[340,198],[420,171],[480,190]],rgb("#7c4b2b"));
  ground(202,rgb("#b87938"),rgb("#49321f"),rgb("#f5bd54"));
  fillPolygon([[0,235],[95,213],[184,229],[281,211],[375,231],[480,214],[480,270],[0,270]],rgb("#6b4628"),.5);
  for(const [x,y,s] of [[310,69,1],[341,83,.8],[378,60,.7]]) { line(x-7*s,y,x,y-4*s,rgb("#382c31"),.9,1); line(x,y-4*s,x+7*s,y,rgb("#382c31"),.9,1); }
  noiseDots(75,[0,205,480,269],[rgb("#d89a45"),rgb("#f0bd5c")],.26,94,1.3); vignette(.34,rgb("#3a1d25"));
}

const SCENES = { pokemon, rm2003, rm2000, octopath, chrono, bravely, dragonquest, ff, mother, goldensun };

export function generateAssets() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const written = [];
  for (const [id, draw] of Object.entries(SCENES)) {
    draw();
    const file = path.join(OUTPUT_DIR, `${id}-backdrop.png`);
    fs.writeFileSync(file, encodePng(WIDTH, HEIGHT, pixels));
    const size = fs.statSync(file).size;
    console.log(`${path.relative(process.cwd(), file)} ${size} bytes`);
    written.push(file);
  }
  console.log(`Confirmed ${written.length} backdrops at ${WIDTH}x${HEIGHT} RGB.`);
  return written;
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(new URL(import.meta.url).pathname)) generateAssets();
