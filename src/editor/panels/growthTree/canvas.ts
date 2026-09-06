import { el } from '@/util/dom';
import { growthArt } from './art';
import type { TreePosition } from '@/project/growth/types';
import type { TreeEdge } from '@/project/growth/graph';
import { button } from './controls';
export interface GraphNode extends TreePosition { id: string; name: string; subtitle: string; badge: string; iconUrl?: string; invalid?: boolean }
export interface GraphOptions {
  nodes: GraphNode[]; edges: TreeEdge[]; selected?: string; connecting?: string; zoom: number;
  onSelect: (id: string) => void; onMove: (id: string, p: TreePosition) => void;
  onZoom: (zoom: number) => void; onArrange: () => void;
}
const W = 180, H = 98;
export function renderGrowthCanvas(o: GraphOptions): HTMLElement {
  const viewport = el('div', { class: 'growth-viewport', attrs: { tabindex: '0', 'aria-label': '트리 작업 공간' }, dataset: { testid: 'growth-viewport' } });
  const width = Math.max(900, ...o.nodes.map(n => n.x + W + 100)), height = Math.max(640, ...o.nodes.map(n => n.y + H + 100));
  const plane = el('div', { class: 'growth-plane' });
  plane.style.width = `${width}px`; plane.style.height = `${height}px`;
  plane.style.transform = `scale(${o.zoom})`;
  const spacer = el('div', { class: 'growth-spacer', children: [plane] });
  spacer.style.width = `${width * o.zoom}px`; spacer.style.height = `${height * o.zoom}px`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'growth-wires'); svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height)); svg.setAttribute('aria-hidden', 'true');
  const paintWires = (): void => {
    svg.replaceChildren();
    for (const e of o.edges) {
      const a = o.nodes.find(n => n.id === e.from), b = o.nodes.find(n => n.id === e.to);
      if (!a || !b) continue;
      const path = document.createElementNS(svg.namespaceURI, 'path');
      const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2;
      const bend = Math.max(56, Math.abs(x2 - x1) / 2);
      path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`);
      path.setAttribute('class', e.from === o.selected || e.to === o.selected ? 'is-highlighted' : '');
      svg.append(path);
      const tip = document.createElementNS(svg.namespaceURI, 'path');
      tip.setAttribute('d', `M ${x2 - 7} ${y2 - 4} L ${x2} ${y2} L ${x2 - 7} ${y2 + 4}`); svg.append(tip);
    }
  };
  paintWires(); plane.append(svg);
  for (const n of o.nodes) {
    const card = el('button', {
      class: `growth-node${n.id === o.selected ? ' is-selected' : ''}${n.id === o.connecting ? ' is-source' : ''}${n.invalid ? ' is-invalid' : ''}`,
      attrs: { type: 'button', 'aria-label': `${n.name}, ${n.subtitle}`, 'aria-pressed': String(n.id === o.selected) },
      dataset: { testid: `growth-node-${n.id}`, nodeId: n.id },
      children: [
        growthArt(n.iconUrl, n.badge, 'growth-node-emblem'),
        el('span', { class: 'growth-node-copy', children: [el('strong', { class: 'growth-node-name', text: n.name }), el('span', { text: n.subtitle })] }),
        el('span', { class: 'growth-node-port' }),
      ],
    });
    const place = (): void => { card.style.left = `${n.x}px`; card.style.top = `${n.y}px`; };
    place();
    let start: { x: number; y: number; position: TreePosition; moved: boolean } | undefined;
    let suppressClick = false;
    card.addEventListener('pointerdown', e => {
      if (e.button !== 0 || o.connecting) return;
      start = { x: e.clientX, y: e.clientY, position: { x: n.x, y: n.y }, moved: false };
      card.setPointerCapture(e.pointerId);
    });
    card.addEventListener('pointermove', e => {
      if (!start) return;
      const dx = (e.clientX - start.x) / o.zoom, dy = (e.clientY - start.y) / o.zoom;
      if (Math.abs(dx) + Math.abs(dy) > 5) start.moved = true;
      if (!start.moved) return;
      n.x = Math.max(0, Math.min(10000, Math.round((start.position.x + dx) / 8) * 8));
      n.y = Math.max(0, Math.min(10000, Math.round((start.position.y + dy) / 8) * 8));
      place(); paintWires();
    });
    card.addEventListener('pointerup', () => {
      if (start?.moved) { suppressClick = true; o.onMove(n.id, { x: n.x, y: n.y }); }
      start = undefined;
    });
    card.addEventListener('pointercancel', () => {
      if (start) { n.x = start.position.x; n.y = start.position.y; place(); paintWires(); }
      start = undefined;
    });
    card.addEventListener('click', () => { if (suppressClick) { suppressClick = false; return; } o.onSelect(n.id); });
    card.addEventListener('keydown', e => {
      if (!e.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation();
      o.onMove(n.id, { x: Math.max(0, Math.min(10000, n.x + (e.key === 'ArrowLeft' ? -24 : e.key === 'ArrowRight' ? 24 : 0))), y: Math.max(0, Math.min(10000, n.y + (e.key === 'ArrowUp' ? -24 : e.key === 'ArrowDown' ? 24 : 0))) });
    });
    plane.append(card);
  }
  viewport.append(spacer);
  if (!o.nodes.length) viewport.append(el('div', { class: 'growth-canvas-empty', children: [el('span', { class: 'growth-empty-mark', text: '✧' }), el('h3', { text: '첫 번째 가능성을 놓아보세요' }), el('p', { text: '스킬 또는 능력치 노드를 추가하고 성장 경로를 연결하세요.' })] }));
  const zoom = (delta: number): void => o.onZoom(Math.max(.4, Math.min(1.6, Math.round((o.zoom + delta) * 10) / 10)));
  viewport.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoom(e.deltaY > 0 ? -.1 : .1); } }, { passive: false });
  const controls = el('div', { class: 'growth-canvas-controls', children: [button('−', 'growth-zoom-out', () => zoom(-.1)), el('output', { text: `${Math.round(o.zoom * 100)}%`, attrs: { 'aria-label': '확대 비율' } }), button('+', 'growth-zoom-in', () => zoom(.1)), button('자동 배치', 'growth-arrange', o.onArrange)] });
  return el('section', { class: 'growth-canvas', children: [viewport, controls] });
}
