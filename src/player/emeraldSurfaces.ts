import type { Project } from '@/project/types';
import { isEmeraldMonsterStyle } from '@/project/emeraldMonsterStyle';
import '@/styles/runtime/emeraldSurfaces.css';

/** Shared opt-in for authored games; no campaign ID or species assumptions. */
export function stampEmeraldSurface(node: HTMLElement, project: Pick<Project, 'meta'>, surface: string): boolean {
  const enabled = isEmeraldMonsterStyle(project);
  if (enabled) {
    node.dataset.monsterStyle = 'emerald';
    node.dataset.emeraldSurface = surface;
  }
  return enabled;
}

/** The Emerald surface owns 480×320 (exact 2× GBA), ordinary battles keep their 640×480 binder. */
export function bindEmeraldBattleSurface(host: HTMLElement, scene: HTMLElement): { sync(): void; cleanup(): void } {
  const sync = (): void => {
    const width = host.clientWidth || host.offsetWidth || 480;
    const height = host.clientHeight || host.offsetHeight || 320;
    // 정수 배율만(픽셀 격자 계약). 1 미만으로 줄어드는 작은 창만 비정수를 허용한다.
    const fit = Math.min(width / 480, height / 320);
    const scale = fit < 1 ? fit : Math.floor(fit);
    scene.style.setProperty('--battle-stage-scale', String(scale));
    scene.style.setProperty('--battle-stage-offset-x', `${Math.max(0, (width - 480 * scale) / 2)}px`);
    scene.style.setProperty('--battle-stage-offset-y', `${Math.max(0, (height - 320 * scale) / 2)}px`);
    scene.dataset.battleStageScale = scale.toFixed(3);
  };
  sync();
  const frame = requestAnimationFrame(sync);
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(sync);
  observer?.observe(host);
  return { sync, cleanup: () => { cancelAnimationFrame(frame); observer?.disconnect(); } };
}
