import { el } from '@/util/dom';

/** Decorative art never replaces the adjacent readable name or steals node dragging. */
export function growthArt(url: string | null | undefined, fallback: string, className: string): HTMLElement {
  const slot = el('span', { class: className, attrs: { 'aria-hidden': 'true' } });
  const badge = el('span', { text: fallback });
  if (!url) { slot.append(badge); return slot; }
  const image = el('img', { attrs: { alt: '', draggable: 'false' } });
  image.addEventListener('error', () => slot.replaceChildren(badge), { once: true });
  image.src = url;
  slot.append(image);
  return slot;
}
