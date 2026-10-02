// Review-only animation studies. Uses the project's editable effect raster primitives.
// No production catalog, project database or existing graphic is changed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRaster, toStrip, rgba, polygon, stroke, streak, glow, blob,
  ellipseRing, sparkle, mulberry32, makeAngularNoise, boltPath, ramp, pulse, clamp01,
} from '../../../../scripts/lib/effectSheet/raster.mjs';
import { writePng } from '../../../../scripts/lib/pixelPng.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(ROOT, 'sheets'), { recursive: true });
const N = 32, FRAME_MS = 50;
const orange = rgba(255, 117, 39), gold = rgba(255, 220, 109);
const blue = rgba(117, 219, 255), mint = rgba(142, 255, 194);
const fading = (t, start, end) => 1 - ramp(t, start, end);
const particles = (seed, count) => {
  const r = mulberry32(seed);
  return Array.from({length: count}, (_, i) => ({
    a: r() * Math.PI * 2, speed: .6 + r() * .7, size: 2 + r() * 5,
    x: r() * 140 - 70, delay: r() * .15, phase: r() * Math.PI * 2, i,
  }));
};
const sparks = particles(17, 28), frost = particles(31, 20), lights = particles(51, 24);

function fire(f, t, scale = 1) {
  const noise = makeAngularNoise(mulberry32(37), 4, t * 2);
  if (t < .4) {
    const fly = ramp(t, .03, .38), x = 16 + fly * 80, y = 111 - Math.sin(fly * Math.PI) * 10;
    const appear = ramp(t, 0, .08);
    for (let j = 4; j >= 0; j--) {
      const xx = x - 8 * j;
      if (xx < 5) continue;
      streak(f, xx, y + Math.sin(j * 1.6 + t * 14) * 3, 0, 16, 6 - j * .75,
        rgba(255, 91 + j * 18, 30, appear * (.75 - j * .12)));
    }
    blob(f, x, y, 9 * scale, rgba(242, 81, 31, appear), noise, {amplitude:.3});
    blob(f, x + 2, y, 6 * scale, rgba(255, 194, 63, appear), noise, {amplitude:.2});
    glow(f, x + 3, y, 3.5 * scale, rgba(255, 250, 199, appear));
  }
  if (t < .34) return;
  const q = ramp(t, .34, 1), grow = ramp(q, 0, .23), fade = fading(q, .35, 1);
  glow(f, 96, 105, 22 + 36 * grow * scale, rgba(255, 115, 30, .25 * fade));
  for (let j = 6; j >= 0; j--) {
    const a = -Math.PI + j * Math.PI / 6;
    const xx = 96 + Math.cos(a) * (10 + 19 * grow) * scale;
    const yy = 113 + Math.sin(a) * (12 + 25 * grow) * scale - q * 18;
    const radius = (7 + 13 * grow) * scale * fade;
    blob(f, xx, yy, radius, rgba(191, 49, 30, fade), noise, {amplitude:.35});
    blob(f, xx, yy - 3, radius * .75, rgba(255, 126, 35, fade), noise, {amplitude:.32});
    blob(f, xx, yy - 5, radius * .43, rgba(255, 222, 108, fade), noise, {amplitude:.28});
  }
  for (const s of sparks) {
    const q1 = clamp01((q - s.delay) / .85);
    if (q1 <= 0) continue;
    const dist = (8 + q1 * 60 * s.speed) * scale;
    const x = 96 + Math.cos(s.a) * dist;
    const y = 108 + Math.sin(s.a) * dist - 24 * q1 + 20 * q1 * q1;
    streak(f, x, y, s.a, s.size * 1.5, 1.3, rgba(255, 179 + s.i % 3 * 25, 75, fading(q1, .35, 1)));
  }
  const hit = pulse(q, 0, .09, .19);
  glow(f, 96, 105, 21 * scale, rgba(255, 248, 201, hit));
}

function crystal(f, x, base, h, w, a) {
  polygon(f, [[x,base-h],[x+w,base-h*.42],[x+w*.62,base],[x-w*.6,base],[x-w,base-h*.4]], rgba(44,107,179,a));
  polygon(f, [[x,base-h],[x+w,base-h*.42],[x+w*.62,base],[x,base-h*.23]], rgba(86,194,240,a));
  polygon(f, [[x,base-h],[x,base-h*.23],[x-w*.6,base],[x-w,base-h*.4]], rgba(181,246,255,a));
  stroke(f, [[x,base-h],[x,base-h*.23]], 1.2, rgba(240,255,255,a));
}
function ice(f, t) {
  const lift = ramp(t, .08, .45), fade = fading(t, .54, .74);
  ellipseRing(f, 96, 143, 13 + lift * 35, 3 + lift * 7, 2, rgba(135,221,255,fade * lift));
  glow(f, 96, 125, 46, rgba(109,209,255,.17 * lift * fade));
  for (let j = 0; j < 5; j++) {
    const u = ramp(t, .1 + Math.abs(j - 2) * .055, .43 + Math.abs(j - 2) * .055);
    crystal(f, 96 + (j - 2) * 19, 139 + Math.abs(j - 2) * 2, (86 - Math.abs(j-2)*20) * u, 12, fade);
  }
  if (t < .53) return;
  const q = ramp(t, .53, 1), a = fading(q, .1, 1);
  for (const s of frost) {
    const dist = 12 + q * 65 * s.speed;
    const x = 96 + Math.cos(s.a) * dist, y = 100 + Math.sin(s.a) * dist + q*q*20;
    const spin = s.a + q * (s.i % 2 ? 4 : -4), l = s.size + 3;
    const tip = [x + Math.cos(spin) * l, y + Math.sin(spin) * l];
    polygon(f, [tip,[x+Math.cos(spin+2.4)*l,y+Math.sin(spin+2.4)*l],[x+Math.cos(spin-2.4)*l,y+Math.sin(spin-2.4)*l]], rgba(99,192,235,a));
    stroke(f, [tip,[x,y]], 1.4, rgba(215,255,255,a));
  }
  glow(f, 96, 100, 22, rgba(230,255,255,pulse(q,0,.08,.19)));
}

function thunder(f, t) {
  const charge = pulse(t,0,.22,.4);
  for (let j=0;j<5;j++) {
    const a=j*Math.PI*2/5 + t*4;
    sparkle(f,96+Math.cos(a)*24,87+Math.sin(a)*20,3,rgba(149,168,255,charge));
  }
  const strike = t > .25 && t < .62;
  if (strike) {
    const a = .7 + .3 * Math.sin(t*37)**2;
    const points = boltPath(mulberry32(101 + Math.floor(t * 10)), 94, 9, 96, 125, 7, 12);
    stroke(f, points, 4, rgba(111,95,239,a));
    stroke(f, points, 2.3, rgba(183,202,255,a));
    stroke(f, points, .95, rgba(255,254,219,a));
    for (let j=0;j<3;j++) {
      const p=points[j+2];
      const branch=boltPath(mulberry32(202+j),p[0],p[1],p[0]+(j%2?-31:31),p[1]+23,4,7);
      stroke(f,branch,1.5,rgba(163,173,255,a*.8));
      stroke(f,branch,.55,rgba(255,249,197,a));
    }
    glow(f,96,121,17,rgba(215,213,255,.35));
  }
  if (t < .28) return;
  const q=ramp(t,.28,1), fade=fading(q,.15,1);
  ellipseRing(f,96,137,7+q*51,3+q*13,1.4,rgba(172,174,255,fade));
  for (const s of frost.slice(0,12)) {
    const x=96+Math.cos(s.a)*q*60*s.speed, y=125+Math.sin(s.a)*q*36*s.speed-q*16;
    stroke(f,[[x-3,y-4],[x+2,y],[x-1,y+3]],.9,rgba(231,230,255,fade));
  }
}

function heal(f,t) {
  const fade = pulse(t,0,.33,1), rise=ramp(t,.05,.85);
  ellipseRing(f,96,142,35,9,2,rgba(93,228,152,fade));
  ellipseRing(f,96,141-rise*57,30-rise*9,7,1.1,rgba(211,255,174,fade*.8));
  glow(f,96,113,42,rgba(117,239,160,fade*.15));
  for(const s of lights) {
    const q = clamp01((t-s.delay)/.82);
    if(q<=0 || q>=1) continue;
    const x=96+s.x*.52+Math.sin(q*6+s.phase)*6, y=146-q*(70+s.speed*16);
    const a=Math.sin(q*Math.PI)**.7;
    sparkle(f,x,y,s.size*.65,rgba(199,255,204,a),{thickness:1});
    if(s.i%4===0) {
      stroke(f,[[x-3,y],[x+3,y]],1.2,rgba(248,255,203,a));
      stroke(f,[[x,y-3],[x,y+3]],1.2,rgba(248,255,203,a));
    }
  }
  const bloom=pulse(t,.35,.57,.8);
  for(let j=0;j<8;j++) {
    const a=j*Math.PI/4-t*.7;
    streak(f,96+Math.cos(a)*16,83+Math.sin(a)*12,a,14,2,rgba(225,255,185,bloom));
  }
}

const effects = { fire, ice, thunder, heal };
for (const [slug,painter] of Object.entries(effects)) {
  const frames=[];
  for(let i=0;i<N;i++) {
    const f=createRaster(.5);
    painter(f,(i+.5)/N);
    frames.push(f);
  }
  const strip=toStrip(frames,5);
  writeFileSync(path.join(ROOT,'sheets',`${slug}.png`),writePng(strip.width,strip.height,strip.data));
}
writeFileSync(path.join(ROOT,'manifest.json'),JSON.stringify({
  prototype:true,source:'render.mjs',productionApplied:false,
  frameWidth:96,frameHeight:96,frameCount:N,frameDurationMs:FRAME_MS,
  effects:Object.keys(effects),previewNote:'Asset studies composited over existing bundled targets; not a gameplay recording.',
},null,2)+'\n');
console.log('Rendered four NEW 32-frame transparent effect studies.');
