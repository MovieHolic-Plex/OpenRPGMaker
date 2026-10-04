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

/** The live field page selects the outfit. Never infer a trainer from its name or use substitute art. */
export function resolveEmeraldTrainerIntro(project: Project, session: PlaySession, snapshot: BattleSnapshot):
  { role: typeof ROLES[number]; opponent: string; hero: string } | undefined {
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
  if (sheet < 0 || pattern === undefined || !Number.isInteger(pattern) || pattern < 0 || pattern >= 96) return undefined;
  const character = Math.floor(Math.floor(pattern / 12) / 4) * 4 + Math.floor((pattern % 12) / 3);
  const role = ROLES[sheet * 8 + character];
  const pictureUrl = (id: string): string | null => {
    const asset = project.assets.uploaded[id];
    if (asset?.kind !== 'picture' || asset.meta.width !== 64 || asset.meta.height !== 96) return null;
    return resolveAssetResourceUrl(id, { project });
  };
  const opponent = pictureUrl(`oprn_emerald_trainer_${role}`);
  const hero = pictureUrl('oprn_emerald_trainer_hero_back');
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
  for (const [side, url] of [['hero', pair.hero], ['opponent', pair.opponent]] as const) {
    const image = document.createElement('img');
    image.className = `emerald-trainer-intro-${side}`;
    image.alt = '';
    image.width = 128;
    image.height = 192;
    image.onload = () => {
      if (image.naturalWidth !== 64 || image.naturalHeight !== 96) failed = true;
      ready++;
      update();
    };
    image.onerror = () => { failed = true; update(); };
    layer.append(image);
    image.src = url;
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
