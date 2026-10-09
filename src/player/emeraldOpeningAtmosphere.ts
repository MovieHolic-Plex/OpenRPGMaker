import { resolveAudioSource } from './audio/audioResources';
import { getPlayerPreferences } from './playerPreferences';
import type { Project } from '@/project/types';
import { el } from '@/util/dom';
import '@/styles/runtime/emeraldOpeningMotion.css';

/** Persistent scenery and sequence-owned one shots; never owns or restarts BGM. */
export function createEmeraldOpeningAtmosphere(host: HTMLElement, project: Project, reducedMotion: boolean) {
  const layer = el('div', { class: 'cinematic-emerald-atmosphere', attrs: { 'aria-hidden': 'true' } });
  layer.dataset.reducedMotion = String(reducedMotion);
  for (let i = 0; i < 10; i += 1) {
    const mote = el('i', { class: 'cinematic-emerald-mote' });
    mote.style.setProperty('--mote-x', `${8 + (i * 29 % 83)}%`);
    mote.style.setProperty('--mote-y', `${9 + (i * 17 % 48)}%`);
    mote.style.setProperty('--mote-delay', `${-i * 1.7}s`);
    layer.append(mote);
  }
  const sounds = project.system.titleScreen?.sounds;
  let audio: HTMLAudioElement | undefined;
  let stopped = false;
  const release = (): void => {
    if (!audio) return;
    const previous = audio;
    audio = undefined;
    previous.pause();
    previous.removeAttribute('src');
    previous.load();
    previous.remove();
  };
  const cue = (kind: 'entry' | 'page'): void => {
    if (stopped) return;
    const volume = getPlayerPreferences().se * (kind === 'entry' ? 0.25 : 0.18);
    const id = kind === 'entry' ? sounds?.confirmSeResourceId : sounds?.cursorSeResourceId;
    const url = resolveAudioSource(id, project);
    release();
    if (!url || volume === 0) return;
    const item = host.ownerDocument.createElement('audio');
    item.dataset.testid = 'emerald-opening-sfx';
    item.dataset.cue = kind;
    item.src = url;
    item.volume = volume;
    audio = item;
    host.append(item);
    item.addEventListener('ended', () => { if (audio === item) release(); }, { once: true });
    // Optional atmosphere never blocks a readable page when browser audio is unavailable.
    item.addEventListener('error', () => { if (audio === item) release(); }, { once: true });
    void item.play().catch(() => { if (audio === item) release(); });
  };
  return {
    layer, cue,
    dispose: (): void => { stopped = true; release(); layer.remove(); },
  };
}
