import type { Project } from '@/project/types';
import { sampleAnimaticTrack, validateOpeningAnimatic, type OpeningAnimatic, type AnimaticProperty } from '@/project/openingAnimatic';
import { loadAnimaticImages, drawAnimaticFrame } from '@/player/openingAnimaticRenderer';
import { el } from '@/util/dom';

/** Silent shared-renderer scrubber with scoped layer-key edits, not an HTML imitation. */
export function createOpeningAnimaticWorkbench(options: { project: Project; composition: OpeningAnimatic; durationMs: number; usable: () => boolean; commit: (a: OpeningAnimatic) => void }): HTMLElement {
  const { composition: a, durationMs } = options, controller = new AbortController();
  let current = 0, playing = false, frame = 0, selectedId = a.layers[0]?.id ?? '', baseTime = 0;
  const canvas = el('canvas', { dataset: { testid: 'animatic-scrubber-stage' } }); canvas.width = a.width; canvas.height = a.height;
  canvas.style.cssText = 'width:100%;max-height:320px;object-fit:contain;background:#000;display:block';
  const status = el('div', { text: '그림 불러오는 중', attrs: { role: 'status' } });
  const range = el('input', { attrs: { type: 'range', min: '0', max: String(durationMs), step: '1', 'aria-label': '애니메틱 시간' }, dataset: { testid: 'animatic-scrubber-time' } }); range.style.width = '100%';
  const label = el('span', { text: '0.00초' }), play = el('button', { text: '무음 재생', attrs: { type: 'button' } });
  const layers = el('select', { attrs: { 'aria-label': '합성 레이어' }, children: a.layers.map(l => el('option', { text: `${l.id} · ${l.role ?? l.kind}`, value: l.id })) });
  const fields = el('div', {}); fields.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const input = new Map<AnimaticProperty, HTMLInputElement>();
  for (const property of ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity'] as const) { const control = el('input', { attrs: { type: 'number', step: property === 'opacity' || property.startsWith('scale') ? '0.05' : '1', 'aria-label': property } }); control.style.width = '75px'; input.set(property, control); fields.append(el('label', { text: property, children: [control] })); }
  const key = el('button', { text: '현재 시간에 동작 키 저장', attrs: { type: 'button' }, dataset: { testid: 'animatic-set-key' } });
  const host = el('section', { dataset: { testid: 'animatic-workbench' }, children: [el('h4', { text: '애니메틱 · 시간과 레이어' }), canvas, range, el('div', { children: [play, label] }), status, layers, fields, key] });
  const images = loadAnimaticImages(options.project, a, controller.signal);
  const stop = () => { playing = false; cancelAnimationFrame(frame); play.textContent = '무음 재생'; };
  const controls = () => { const l = a.layers.find(l => l.id === selectedId); for (const [p, control] of input) control.value = String(l ? Number(sampleAnimaticTrack(l.keys?.[p], current, p === 'scaleX' || p === 'scaleY' || p === 'opacity' ? l[p] ?? 1 : l[p] ?? 0).toFixed(3)) : 0); key.disabled = !l; };
  const draw = () => { void images.then(loaded => { if (controller.signal.aborted) return; drawAnimaticFrame(canvas, a, loaded, current); label.textContent = `${(current / 1000).toFixed(2)} / ${(durationMs / 1000).toFixed(2)}초`; status.textContent = '무음 미리보기 · 전체 재생 버튼으로 음악과 실제 흐름을 확인할 수 있습니다.'; controls(); }).catch(error => { if (!controller.signal.aborted) { stop(); status.textContent = String(error); } }); };
  const tick = (now: number) => { if (!playing || controller.signal.aborted) return; if (!host.isConnected || !options.usable() || host.closest('[hidden]') || document.hidden || !host.getClientRects().length) { stop(); return; } current = Math.min(durationMs, Math.round(now - baseTime)); range.value = String(current); draw(); if (current >= durationMs) stop(); else frame = requestAnimationFrame(tick); };
  range.addEventListener('input', () => { stop(); current = Number(range.value); draw(); });
  layers.addEventListener('change', () => { selectedId = layers.value; controls(); });
  play.addEventListener('click', () => { if (playing) { stop(); return; } if (current >= durationMs) current = 0; playing = true; play.textContent = '일시 정지'; baseTime = performance.now() - current; frame = requestAnimationFrame(tick); });
  key.addEventListener('click', () => {
    if (!options.usable()) return; stop(); const draft = structuredClone(a), l = draft.layers.find(l => l.id === selectedId); if (!l) return;
    l.keys ??= {}; for (const [p, control] of input) { const value = Number(control.value); l.keys[p] = [...(l.keys[p] ?? []).filter(k => k.atMs !== current), { atMs: current, value, ease: 'ease-in-out' }].sort((a, b) => a.atMs - b.atMs); }
    try { validateOpeningAnimatic(draft, durationMs); options.commit(draft); } catch (error) { status.textContent = String(error); }
  });
  let mounted = false;
  const observer = new MutationObserver(() => { if (host.isConnected) mounted = true; else if (mounted) { stop(); controller.abort(); observer.disconnect(); } });
  observer.observe(host.ownerDocument.documentElement, { childList: true, subtree: true });
  queueMicrotask(() => { mounted ||= host.isConnected; });
  void images.then(draw).catch(error => { if (!controller.signal.aborted) { stop(); status.textContent = String(error); } }); return host;
}
