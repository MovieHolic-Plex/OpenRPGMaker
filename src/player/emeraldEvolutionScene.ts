import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { bindEmeraldBattleSurface } from '@/player/emeraldSurfaces';
import { emitBattleJuice, playBattleCue } from '@/player/battleJuice';
import { monsterSpeciesById } from '@/project/monsterCollection';
import type { Project } from '@/project/types';
import { withJosa } from '@/util/josa';
import '@/styles/runtime/emeraldEvolution.css';

export interface EmeraldEvolutionEntry {
  readonly name: string;
  readonly fromSpeciesId: string;
  readonly toSpeciesId: string;
}

const TYPE_MS = 28;
/** 「로/으로」: 받침이 없거나 ㄹ 받침이면 로. */
function roJosa(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return '로';
  const final = code % 28;
  return final === 0 || final === 8 ? '로' : '으로';
}
const sleep = (ms: number, signal?: AbortSignal): Promise<void> => new Promise((resolve) => {
  const timer = window.setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { window.clearTimeout(timer); resolve(); }, { once: true });
});

function frontUrl(project: Project, speciesId: string): string | undefined {
  const resource = monsterSpeciesById(project, speciesId)?.graphic?.monsterResourceId;
  return resource ? resolveAssetResourceUrl(resource, { project }) ?? undefined : undefined;
}

function preload(url: string): Promise<void> {
  return new Promise((resolve) => { const image = new Image(); image.onload = () => resolve(); image.onerror = () => resolve(); image.src = url; });
}

/** 3세대 진화 장면(전투 승리 뒤, 필드로 돌아가기 전). 그림이 없는 종이면 장면 없이 지나간다. 취소(B)는 지원하지 않는다.
 *  ① 「어라? ○○의 모습이…!」 ② 흰 실루엣이 옛 모습과 새 모습을 점점 빠르게 번갈아 ③ 「축하합니다! ○○는 △△로 진화했다!」. 확인키로 문장을 넘긴다. */
export async function playEmeraldEvolutions(host: HTMLElement, project: Project, entries: readonly EmeraldEvolutionEntry[], signal?: AbortSignal): Promise<void> {
  for (const entry of entries) {
    if (signal?.aborted) return;
    const fromUrl = frontUrl(project, entry.fromSpeciesId);
    const toUrl = frontUrl(project, entry.toSpeciesId);
    if (!fromUrl || !toUrl) continue;
    await Promise.all([preload(fromUrl), preload(toUrl)]);
    await playOne(host, project, entry, fromUrl, toUrl, signal);
  }
}

async function playOne(host: HTMLElement, project: Project, entry: EmeraldEvolutionEntry, fromUrl: string, toUrl: string, signal?: AbortSignal): Promise<void> {
  const root = document.createElement('div');
  root.className = 'battle-scene emerald-evolution';
  root.dataset.battleUiStyle = 'pokemon';
  root.dataset.battleSkin = 'pokemon';
  root.dataset.monsterStyle = 'emerald';
  root.dataset.testid = 'emerald-evolution';
  const stage = document.createElement('div');
  stage.className = 'emerald-evolution-stage';
  const sprite = document.createElement('img');
  sprite.className = 'emerald-evolution-sprite';
  sprite.alt = '';
  sprite.src = fromUrl;
  stage.append(sprite);
  const box = document.createElement('div');
  box.className = 'emerald-evolution-message';
  const line = document.createElement('div');
  line.className = 'battle-message-line';
  box.append(line);
  root.append(stage, box);
  host.append(root);
  const surface = bindEmeraldBattleSurface(host, root);
  const controller = new AbortController();
  const stop = (): void => controller.abort();
  signal?.addEventListener('abort', stop, { once: true });
  let skip = false;
  const onKey = (event: KeyboardEvent): void => {
    if (!/^(z|Z|Enter| |e|E)$/u.test(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    skip = true;
  };
  const onClick = (): void => { skip = true; };
  window.addEventListener('keydown', onKey, true);
  root.addEventListener('click', onClick);
  const say = async (text: string, hold: number): Promise<void> => {
    skip = false;
    line.replaceChildren();
    const shown = document.createElement('span');
    const rest = document.createElement('span');
    rest.className = 'battle-message-untyped';
    rest.textContent = text;
    line.append(shown, rest);
    for (let i = 1; i <= text.length && !skip && !controller.signal.aborted; i += 1) {
      shown.textContent = text.slice(0, i);
      rest.textContent = text.slice(i);
      await sleep(TYPE_MS, controller.signal);
    }
    shown.textContent = text;
    rest.textContent = '';
    skip = false;
    const end = performance.now() + hold;
    while (performance.now() < end && !skip && !controller.signal.aborted) await sleep(40, controller.signal);
    skip = false;
  };
  try {
    await sleep(250, controller.signal);
    await say(`어라? ${withJosa(entry.name, '이/가')} 모습이…!`, 900);
    // 실루엣 점멸: 간격이 점점 줄어든다(400ms → 60ms). 흰 실루엣일 때 모양이 바뀐다.
    playBattleCue('victory');
    const swaps = [420, 360, 300, 250, 200, 160, 130, 100, 80, 70, 60, 60, 60, 60];
    let showNew = false;
    for (const gap of swaps) {
      if (controller.signal.aborted) break;
      sprite.dataset.silhouette = 'true';
      await sleep(gap, controller.signal);
      showNew = !showNew;
      sprite.src = showNew ? toUrl : fromUrl;
      sprite.dataset.silhouette = 'false';
      await sleep(gap, controller.signal);
    }
    sprite.src = toUrl;
    sprite.dataset.silhouette = 'true';
    await sleep(180, controller.signal);
    sprite.dataset.silhouette = 'false';
    const toName = monsterSpeciesById(project, entry.toSpeciesId)?.name ?? '새로운 모습';
    emitBattleJuice('victory', root);
    await say(`축하합니다! ${withJosa(entry.name, '은/는')} ${toName}${roJosa(toName)} 진화했다!`, 1800);
  } finally {
    window.removeEventListener('keydown', onKey, true);
    signal?.removeEventListener('abort', stop);
    surface.cleanup();
    root.remove();
  }
}
