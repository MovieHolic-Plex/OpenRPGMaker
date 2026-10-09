import type { BattleSnapshot } from '@/battle/types';
import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { resolveEventPage } from '@/project/io/pageResolution';
import type { Project } from '@/project/types';
import type { PlaySession } from '@/project/session';
import type { BattleDirectorState } from '@/player/battleDirectorDom';
import '@/styles/runtime/emeraldTrainerIntro.css';

const SHEETS = ['oprn_emerald_field_cast_1', 'oprn_emerald_field_cast_2'] as const;
const ROLES = ['hero', 'rival', 'professor', 'nurse', 'merchant', 'mother', 'resident', 'gym_leader',
  'company_agent', 'captain', 'worker', 'explorer', 'student', 'ranger', 'moon_leader', 'hiker'] as const;
type TrainerPicture = { url: string; width: 64; height: 64 | 96 };

/** The live field page selects the outfit. Never infer a trainer from its name or use substitute art. */
export function resolveEmeraldTrainerIntro(project: Project, session: PlaySession, snapshot: BattleSnapshot):
  { role: typeof ROLES[number]; opponent: TrainerPicture; hero: TrainerPicture } | undefined {
  if (!project.database.troops.find(troop => troop.id === snapshot.troopId)?.trainerBattle) return undefined;
  const eventId = snapshot.troopId.startsWith('mx_troop_') ? snapshot.troopId.slice('mx_troop_'.length) : undefined;
  if (!eventId) return undefined;
  const map = project.maps[session.currentMapId];
  if (!map) return undefined;
  const event = map.events.find(entry => entry.id === eventId);
  if (!event) return undefined;
  const page = resolveEventPage(event, {
    ...session, switches: snapshot.eventState.switches, variables: snapshot.eventState.variables,
    selfSwitches: snapshot.eventState.selfSwitches ?? session.selfSwitches,
  }, { locations: map.locations, host: session.eventLocations?.[eventId] });
  const graphic = page?.graphic;
  const sprite = graphic?.sprite;
  if (!graphic || sprite?.type !== 'uploaded') return undefined;
  const sheet = SHEETS.findIndex(id => id === sprite.id);
  const pattern = graphic.pattern;
  // 시작 테마 시트(oprn_emerald_field_cast_<테마>, emeraldMonsterCast)는 칸 0·1 주민, 2 조련사다. 그 걷기 칩 전용 전투 그림은
  // 아직 없어 가장 가까운 원작 자세(주민·탐험가)를 쓴다 — 그림이 없으면 소개 없이 몬스터가 「승부를 걸어왔다!」 때부터 서 있었다.
  const themed = /^oprn_emerald_field_cast_(desert|snow|coast)$/u.test(sprite.id);
  if ((sheet < 0 && !themed) || pattern === undefined || !Number.isInteger(pattern) || pattern < 0 || pattern >= 96) return undefined;
  const character = Math.floor(Math.floor(pattern / 12) / 4) * 4 + Math.floor((pattern % 12) / 3);
  const role: typeof ROLES[number] | undefined = themed ? (character === 2 ? 'explorer' : 'resident') : ROLES[sheet * 8 + character];
  if (!role) return undefined;
  const picture = (id: string): TrainerPicture | null => {
    const asset = project.assets.uploaded[id];
    // Emerald native trainer poses are64×64. Keep explicitly authored older
    // 64×96 portraits at their own aspect ratio without treating them as native.
    if (asset?.kind !== 'picture' || asset.meta.width !== 64 || (asset.meta.height !== 64 && asset.meta.height !== 96)) return null;
    const url = resolveAssetResourceUrl(id, { project });
    return url ? { url, width: 64, height: asset.meta.height } : null;
  };
  const opponent = picture(`oprn_emerald_trainer_${role}`);
  const hero = picture('oprn_emerald_trainer_hero_back');
  return opponent && hero ? { role, opponent, hero } : undefined;
}

/** One pair per battle, outside field roster reconciliation. Loading/error never hides the real battlers. */
export function mountEmeraldTrainerIntro(root: HTMLElement, project: Project, session: PlaySession | undefined,
  snapshot: BattleSnapshot): { sync(state: BattleDirectorState): void; destroy(): void } {
  const pair = session && resolveEmeraldTrainerIntro(project, session, snapshot);
  if (!pair) return { sync() {}, destroy() {} };
  const layer = document.createElement('div');
  layer.className = 'emerald-trainer-intro';
  layer.dataset.testid = 'emerald-trainer-intro';
  layer.dataset.trainerRole = pair.role;
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  let wanted = false;
  let destroyed = false;
  let failed = false;
  let ready = 0;
  const update = (): void => {
    if (destroyed) return;
    const visible = wanted && !failed && ready === 2;
    layer.hidden = !visible;
    if (visible) root.dataset.emeraldTrainerIntro = 'true';
    else delete root.dataset.emeraldTrainerIntro;
  };
  for (const [side, picture] of [['hero', pair.hero], ['opponent', pair.opponent]] as const) {
    const image = document.createElement('img');
    image.className = `emerald-trainer-intro-${side}`;
    image.alt = '';
    image.width = picture.width * 2;
    image.height = picture.height * 2;
    image.dataset.portraitProfile = picture.height === 64 ? 'emerald-native' : 'legacy-tall';
    image.style.setProperty('--trainer-portrait-height', `${image.height}px`);
    image.onload = () => {
      if (destroyed) return;
      if (image.naturalWidth !== picture.width || image.naturalHeight !== picture.height) failed = true;
      ready++;
      update();
    };
    image.onerror = () => { failed = true; update(); };
    layer.append(image);
    image.src = picture.url;
  }
  root.append(layer);
  return {
    sync(state) { wanted = state.step === 'intro' && state.trainerIntroduction === true; update(); },
    destroy() {
      destroyed = true;
      for (const image of layer.querySelectorAll('img')) { image.onload = null; image.onerror = null; image.removeAttribute('src'); }
      layer.remove();
      delete root.dataset.emeraldTrainerIntro;
    },
  };
}
