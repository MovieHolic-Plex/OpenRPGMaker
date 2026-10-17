// 흉상이 있는 대사는 대사창이 항상 아래 — 위·가운데 설정 위에서도(2026-10-17, vn-bust-bottom-1).
//   bun scripts/qa/runtime/vn-matrix-fixture.mts output/qa/bb/fx full-or-bustbottom ...   (프로필 bustbottom)
//   node scripts/runtime-qa.mjs --scenario vn-bust-bottom --project output/qa/bb/fx/project.json --out output/qa/bb/shots
// 캡처마다 evalToFile 탐침이 DOM 을 읽고 어긋나면 throw 해 비트를 실패시킨다:
//   - 흉상·전신(.dialogue-face-bust)이 있는 줄, 그 바로 뒤 선택지 = 창이 position-bottom 뿐이어야 한다(저작 설정이 top·center 여도).
//   - 초상이 없거나 48px 얼굴인 줄 = 저작한 위치(비트 id 의 위치)를 그대로 따라야 한다.
import { buildMatrixScenario } from "./vn-matrix.lib.mjs";
const W = Number(process.env.VN_BB_W ?? 1024);
const H = Number(process.env.VN_BB_H ?? 768);
const base = buildMatrixScenario({ id: "vn-bust-bottom", viewport: { width: W, height: H }, fixtureDefault: "output/qa/bb/fx/project.json" });
const assertFn = (setting, group, isChoices) => `() => { const o = document.querySelector('.dialogue-overlay'); const box = document.querySelector('.dialogue-box');
 const bust = document.querySelectorAll('.dialogue-face-bust').length; const pos = ['top','center','bottom'].filter((p) => o?.classList.contains('position-' + p));
 const bustGroup = /^(bust|full)/.test(${JSON.stringify(group)});
 if (bustGroup && !${isChoices} && bust === 0) throw new Error('흉상 줄인데 흉상이 안 그려짐');
 if (!bustGroup && bust > 0) throw new Error('흉상 없는 줄에 흉상이 그려짐');
 const expected = bustGroup ? 'bottom' : ${JSON.stringify(setting)};
 const r = { setting: ${JSON.stringify(setting)}, bust, overlayPositions: pos, boxPosition: box?.dataset.messagePosition ?? null, expected, box: box ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(box.getBoundingClientRect()) : null, vw: innerWidth, vh: innerHeight };
 if (pos.length !== 1 || pos[0] !== expected || r.boxPosition !== expected) throw new Error('창 위치 어긋남: ' + JSON.stringify(r));
 return r; }`;
// 전환 궤적: 대화가 열린 뒤 매 프레임 창 윗변·위치 클래스·줄 번호표를 쌓아 두고, 마지막에 파일로 남긴다.
//   흉상 없음(위) ↔ 흉상 있음(아래) 전환에서 창이 한 프레임에 튀는지 부드럽게 미끄러지는지 이 궤적으로 본다.
const recorderFn = `() => { window.__bbTrace = []; const t0 = performance.now(); const tick = () => { const box = document.querySelector('.dialogue-box'); const o = document.querySelector('.dialogue-overlay');
  if (box) window.__bbTrace.push({ t: Math.round(performance.now() - t0), y: Math.round(box.getBoundingClientRect().top), pos: ['top','center','bottom'].filter((p) => o.classList.contains('position-' + p)).join(','), tag: (/\\[(\\d{3})\\]/.exec(box.textContent || '') || [])[1] ?? '', bust: document.querySelectorAll('.dialogue-face-bust').length, choices: !!document.querySelector('[data-testid="runtime-choices"]') });
  requestAnimationFrame(tick); }; requestAnimationFrame(tick); return true; }`;
const dumpFn = `() => window.__bbTrace`;
const beats0 = base.beats.map((b) => {
  const m = /^m\d+-([a-z]+)-(top|center|bottom)-/.exec(b.id);
  if (!m || b.shot !== true) return b;
  const out = `${process.env.VN_BB_OUT ?? "output/qa/bb/probe"}/${b.id}.json`;
  return { ...b, ops: [...(b.ops ?? []), { kind: "evalToFile", fn: assertFn(m[2], m[1], b.id.endsWith('-c')), out }] };
});
const beats = beats0.map((b) => (b.id === "03-talk" ? { ...b, ops: [...(b.ops ?? []), { kind: "evalToFile", fn: recorderFn, out: `${process.env.VN_BB_OUT ?? "output/qa/bb/probe"}/_recorder-armed.json` }] } : b));
const last = beats[beats.length - 1];
beats[beats.length - 1] = { ...last, ops: [...(last.ops ?? []), { kind: "evalToFile", fn: dumpFn, out: `${process.env.VN_BB_OUT ?? "output/qa/bb/probe"}/_trace.json` }] };
export default { ...base, beats };
