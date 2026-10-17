// 대사창 레이아웃 탐침 — 매트릭스 시나리오에서 지정한 비트 하나까지 진행하고 DOM 사각을 JSON 으로 남긴다.
//   VN_PROBE_N=96 node scripts/runtime-qa.mjs --scenario vn-probe --project output/qa/after/fx-full/project.json --out output/qa/probe
import { buildMatrixScenario } from "./vn-matrix.lib.mjs";
const base = buildMatrixScenario({ id: "vn-probe", viewport: { width: Number(process.env.VN_PROBE_W ?? 1024), height: Number(process.env.VN_PROBE_H ?? 768) }, fixtureDefault: "output/qa/after/fx-full/project.json" });
const target = `m${String(process.env.VN_PROBE_N ?? 96).padStart(3, "0")}-`;
const idx = base.beats.findIndex((b) => b.id.startsWith(target));
const fn = `() => { const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); const c = getComputedStyle(el); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), cls: el.className, height: c.height, width: c.width, bgSize: c.backgroundSize, bgPos: c.backgroundPosition }; };
 return { box: r(document.querySelector('.dialogue-box')), overlay: r(document.querySelector('.dialogue-overlay')), faces: [...document.querySelectorAll('.dialogue-face')].map(r), body: r(document.querySelector('.dialogue-box .body')), bar: r(document.querySelector('.dialogue-bar')), name: r(document.querySelector('.speaker-nameplate')), vw: innerWidth, vh: innerHeight }; }`;
export default { ...base, beats: [...base.beats.slice(0, idx + 1), { id: "probe", note: "탐침", ops: [{ kind: "evalToFile", fn, out: process.env.VN_PROBE_OUT ?? "output/qa/probe.json" }], shot: true }] };
