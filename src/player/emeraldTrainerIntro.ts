import { withInlineAsset } from "@/assets/inlineAssetStore";
import type { BattleSnapshot } from '@/battle/types';
import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { resolveEventPage } from '@/project/io/pageResolution';
import type { Project } from '@/project/types';
import type { PlaySession } from '@/project/session';
import type { BattleDirectorState } from '@/player/battleDirectorDom';
import { TRAINER_DISPLAY_WIDTH, isTrainerPictureSize, trainerThrowFrames } from '@/player/trainerPictureSize';
import '@/styles/runtime/emeraldTrainerIntro.css';

const SHEETS = ['oprn_emerald_field_cast_1', 'oprn_emerald_field_cast_2'] as const;
const ROLES = ['hero', 'rival', 'professor', 'nurse', 'merchant', 'mother', 'resident', 'gym_leader',
  'company_agent', 'captain', 'worker', 'explorer', 'student', 'ranger', 'moon_leader', 'hiker'] as const;
/** 인물 그림 원본 크기. 가로는 64(2배 표시) 또는 128(1배 표시) 두 가지이고, 세로는 가로와 같거나(정사각) 1.5배(옛 키 큰 그림)다.
 *  width/height 0 = 번들 그림이라 마운트 때 그림 크기에서 정한다. 어느 쪽이든 화면 폭은 128px 로 같다(전투 필드 앵커·몬스터 밀도 유지). */
type TrainerPicture = { url: string; width: number; height: number };
/** 볼 던지기 가로 시트: 프레임 한 칸이 정사각(64 또는 128) × N. 화면에는 한 칸을 128×128 로 보여 준다. */
type TrainerSheet = { url: string; frames: number };
type TrainerIntroPair = { role: string; opponent: TrainerPicture; hero: TrainerPicture; opponentThrow?: TrainerSheet; heroThrow?: TrainerSheet; orb?: string };
const THROW_FRAME_MS = 80;
/** 내보내기 구슬: 날아가는 시간과, 던지기 시트 없는 상대 쪽 구슬이 출발하는 때(인물이 걸어 나간 뒤). emeraldTrainerIntro.css 와 같은 값. */
const ORB_FLIGHT_MS = 220;
const FOE_ORB_START_MS = 560;

/** 인물 그림 계약(TroopRecord.trainerSprite): 모든 값이 업로드 그림 id. 없으면 아래 옛 규칙(필드 이벤트 그래픽 → 역할 이름)으로 간다. */
function authoredTrainerPair(project: Project, troopId: string): TrainerIntroPair | undefined {
  const sprite = project.database.troops.find(troop => troop.id === troopId)?.trainerSprite;
  if (!sprite?.front) return undefined;
  const opponent = trainerPicture(project, sprite.front);
  const hero = trainerPicture(project, sprite.back ?? 'oprn_emerald_trainer_hero_back', 'back');
  if (!opponent || !hero) return undefined;
  const heroBack = sprite.back ?? 'oprn_emerald_trainer_hero_back';
  // 내보내기 구슬 그림: 번들 뒷모습 역할에 orb.png(던지기 칸에서 그대로 잘라 낸 구슬)가 있으면 쓴다. 없으면 구슬 없이 옛 연출 그대로.
  const orb = !project.assets.uploaded[heroBack] && BUNDLED_ROLE.test(heroBack) ? bundledTrainerUrl(heroBack, 'orb') : undefined;
  return { role: 'authored', opponent, hero, opponentThrow: sprite.throw ? trainerSheet(project, sprite.throw) : undefined, heroThrow: sprite.backThrow ? trainerSheet(project, sprite.backThrow) : undefined, orb };
}

/** 번들 인물 그림(public/assets/battle-trainers/<role>/{front,back,throw}.png) 의 role id 꼴. 업로드 그림 id 가 먼저다. */
const BUNDLED_ROLE = /^[a-z][a-z0-9_]*$/u;
const bundledTrainerUrl = (role: string, file: 'front' | 'back' | 'throw' | 'orb'): string => withInlineAsset(`/assets/battle-trainers/${role}/${file}.png`);

function trainerPicture(project: Project, id: string, bundledFile: 'front' | 'back' = 'front'): TrainerPicture | null {
  const asset = project.assets.uploaded[id];
  if (!asset) return BUNDLED_ROLE.test(id) ? { url: bundledTrainerUrl(id, bundledFile), width: 0, height: 0 } : null;
  // 64×64 · 64×96 · 128×128 · 128×192 만 받는다. 크기마다 화면 폭이 128px 이 되도록 배율을 맞춘다.
  const width = asset.meta.width ?? 0;
  const height = asset.meta.height ?? 0;
  if (asset.kind !== 'picture' || !isTrainerPictureSize(width, height)) return null;
  const url = resolveAssetResourceUrl(id, { project });
  return url ? { url, width, height } : null;
}

/** frames 0 = 번들 그림이라 마운트 때 그림 크기(정사각 칸 × N)에서 센다. */
function trainerSheet(project: Project, id: string): TrainerSheet | undefined {
  const asset = project.assets.uploaded[id];
  if (!asset) return BUNDLED_ROLE.test(id) ? { url: bundledTrainerUrl(id, 'throw'), frames: 0 } : undefined;
  if (asset.kind !== 'picture') return undefined;
  const frames = trainerThrowFrames(asset.meta.width ?? 0, asset.meta.height ?? 0);
  const url = resolveAssetResourceUrl(id, { project });
  return url && frames ? { url, frames } : undefined;
}

/** The live field page selects the outfit. Never infer a trainer from its name or use substitute art. */
export function resolveEmeraldTrainerIntro(project: Project, session: PlaySession, snapshot: BattleSnapshot):
  TrainerIntroPair | undefined {
  if (!project.database.troops.find(troop => troop.id === snapshot.troopId)?.trainerBattle) return undefined;
  const authored = authoredTrainerPair(project, snapshot.troopId);
  if (authored) return authored;
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
  const opponent = trainerPicture(project, `oprn_emerald_trainer_${role}`);
  const hero = trainerPicture(project, 'oprn_emerald_trainer_hero_back', 'back');
  const opponentThrow = trainerSheet(project, `oprn_emerald_trainer_${role}_throw`);
  const heroThrow = trainerSheet(project, 'oprn_emerald_trainer_hero_back_throw');
  return opponent && hero ? { role, opponent, hero, opponentThrow, heroThrow } : undefined;
}

/** 허리에서 잘린 뒷모습(GBA 주인공처럼 아랫변이 글상자에 닿는 그림)인가: 맨 아랫줄의 40% 이상이 불투명하다.
 *  발이 보이는 전신 그림은 아랫줄이 비었거나 발 몇 칸뿐이라 받침 위에 서고, 잘린 그림은 아랫변을 글상자 윗변에 붙인다. */
function isBottomCut(image: HTMLImageElement): boolean {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(image, 0, height - 1, width, 1, 0, 0, width, 1);
    const row = context.getImageData(0, 0, width, 1).data;
    let opaque = 0;
    for (let x = 0; x < width; x++) if (row[x * 4 + 3]! > 0) opaque++;
    return opaque >= width * 0.4;
  } catch {
    return false;
  }
}

/** One pair per battle, outside field roster reconciliation. Loading/error never hides the real battlers.
 *  단계(BattleDirectorState): intro(둘이 양쪽에서 미끄러져 들어온다) → foe(상대가 볼을 던지고 나간다, 상대 몬스터 등장)
 *  → hero(내가 볼을 던지고 나간다, 내 몬스터 등장). 그림이 계약대로 없으면 마운트하지 않아 연출 없이 지금처럼 시작한다. */
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
  let phase: 'intro' | 'foe' | 'hero' | undefined;
  let destroyed = false;
  let failed = false;
  let ready = 0;
  // 던지기 시트가 없으면 인물이 걸어 나간 뒤(지연 200ms + 퇴장 380ms)에 몬스터가 나온다 — 250ms 에 내보내면 나가는 인물과 막 나온 몬스터가
  // 330ms 동안 한 받침 위에 겹쳐 섰다(r5b 설치 정지 화면, 2026-10-22).
  // 구슬 그림이 있으면(layer.dataset.sendoutOrb) 몬스터는 구슬이 받침에 떨어져 번쩍인 뒤에 나온다:
  // 내 쪽은 마지막 던지기 칸이 뜨는 순간(--throw-ms) 3칸 구슬 자리에서 구슬이 날아가 ORB_FLIGHT_MS 뒤 착지, 상대 쪽은 다 걸어 나간 뒤(560ms) 화면 밖에서 날아온다.
  let orbReady = false;
  const revealMs = (sheet: TrainerSheet | undefined): number => {
    if (sheet && sheet.frames > 0) return orbReady ? sheet.frames * THROW_FRAME_MS + ORB_FLIGHT_MS + 20 : sheet.frames * THROW_FRAME_MS + 120;
    if (sheet) return sheet.frames * THROW_FRAME_MS + 120;
    return orbReady ? FOE_ORB_START_MS + ORB_FLIGHT_MS + 20 : 600;
  };
  const update = (): void => {
    if (destroyed) return;
    const visible = phase !== undefined && !failed && ready === 2;
    layer.hidden = !visible;
    if (visible && phase) {
      layer.dataset.phase = phase;
      root.dataset.emeraldTrainerIntro = phase;
      root.style.setProperty('--emerald-reveal-ms', `${revealMs(phase === 'foe' ? pair.opponentThrow : pair.heroThrow)}ms`);
      // 내 구슬은 마지막 던지기 칸(빈손 마무리)이 뜨는 때 출발한다. 시트는 steps(N-1, end) 로 --throw-ms(N×80ms) 동안 밀리므로
      // 마지막 칸은 정확히 --throw-ms 에 뜬다 — (N-1)×80ms 에 출발시키면 3칸 그림 속 구슬과 날아가는 구슬이 두 개 보였다.
      if (pair.heroThrow?.frames) layer.style.setProperty('--orb-hero-start', `${pair.heroThrow.frames * THROW_FRAME_MS}ms`);
    } else {
      delete layer.dataset.phase;
      // 그림을 아직 불러오는 중이면(소개 단계인데 ready < 2) 몬스터·HUD 를 숨긴 채 기다린다 — 비워 두면 전환 막 사이로
      // 내 몬스터가 먼저 서 있다가 사라지고 트레이너가 들어왔다(r5b 설치 영상, 2026-10-22). 불러오기에 실패하면 지금처럼 바로 보인다.
      if (!failed && ready < 2 && phase !== undefined) root.dataset.emeraldTrainerIntro = 'pending';
      else delete root.dataset.emeraldTrainerIntro;
    }
  };
  for (const [side, picture, sheet] of [['hero', pair.hero, pair.heroThrow], ['opponent', pair.opponent, pair.opponentThrow]] as const) {
    const image = document.createElement('img');
    image.className = `emerald-trainer-intro-${side}`;
    image.alt = '';
    // 번들 그림은 크기를 모르므로 불러온 뒤 정한다. 업로드 그림은 계약 크기로 미리 정한다.
    const applySize = (width: number, height: number): void => {
      const scale = TRAINER_DISPLAY_WIDTH / width;
      image.width = width * scale;
      image.height = height * scale;
      image.dataset.portraitProfile = height === width ? (width === 64 ? 'emerald-native' : 'hires-square') : 'legacy-tall';
      image.dataset.portraitScale = String(scale);
      image.style.setProperty('--trainer-portrait-height', `${image.height}px`);
    };
    if (picture.width > 0) applySize(picture.width, picture.height);
    else applySize(64, 64);
    image.onload = () => {
      if (destroyed) return;
      if (side === 'hero' && isBottomCut(image)) layer.dataset.heroCut = 'true';
      if (picture.width > 0) {
        if (image.naturalWidth !== picture.width || image.naturalHeight !== picture.height) failed = true;
      } else if (isTrainerPictureSize(image.naturalWidth, image.naturalHeight)) applySize(image.naturalWidth, image.naturalHeight);
      else failed = true;
      ready++;
      update();
    };
    image.onerror = () => { failed = true; update(); };
    layer.append(image);
    image.src = picture.url;
    if (sheet) {
      const frames = sheet.frames;
      // 던지는 동작 시트: 한 칸 128×128 으로 보여 주고 background-position 을 프레임 수만큼 계단으로 민다.
      const throwNode = document.createElement('div');
      throwNode.className = `emerald-trainer-throw emerald-trainer-throw-${side}`;
      const configure = (count: number): void => {
        sheet.frames = count;
        throwNode.style.setProperty('--throw-frames', String(count));
        throwNode.style.setProperty('--throw-steps', String(count - 1));
        throwNode.style.setProperty('--throw-ms', `${count * THROW_FRAME_MS}ms`);
        throwNode.style.backgroundImage = `url("${sheet.url}")`;
        layer.dataset[side === 'hero' ? 'heroThrow' : 'opponentThrow'] = 'true';
      };
      layer.append(throwNode);
      if (frames > 0) configure(frames);
      else {
        // 번들 시트: 없거나 규격이 아니면 던지는 동작 없이 정지 자세로 미끄러진다(오류로 막지 않는다).
        const probe = new Image();
        probe.onload = () => {
          if (destroyed) return;
          const count = trainerThrowFrames(probe.naturalWidth, probe.naturalHeight);
          if (count) configure(count);
        };
        probe.src = sheet.url;
      }
    }
  }
  if (pair.orb) {
    // 구슬·섬광 노드(내 쪽 hero, 상대 쪽 foe). 그림을 못 불러오면 붙이지 않는다 — 구슬 없이 옛 연출 그대로.
    const orbUrl = pair.orb;
    const probe = new Image();
    probe.onload = () => {
      if (destroyed || probe.naturalWidth <= 0) return;
      for (const side of ['hero', 'foe'] as const) {
        if (side === 'foe' && pair.opponentThrow) continue; // 상대가 던지기 시트를 가지면 그 그림이 구슬을 그린다.
        const orbNode = document.createElement('div');
        orbNode.className = `emerald-sendout-orb emerald-sendout-orb-${side}`;
        orbNode.style.backgroundImage = `url("${orbUrl}")`;
        const flash = document.createElement('div');
        flash.className = `emerald-sendout-flash emerald-sendout-flash-${side}`;
        layer.append(orbNode, flash);
      }
      layer.dataset.sendoutOrb = 'true';
      orbReady = true;
      update();
    };
    probe.src = orbUrl;
  }
  root.append(layer);
  root.dataset.emeraldTrainerIntro = 'pending';
  return {
    sync(state) {
      phase = state.step === 'intro' ? (state.trainerIntroduction === true ? 'intro' : state.trainerSendOut) : undefined;
      update();
    },
    destroy() {
      destroyed = true;
      for (const image of layer.querySelectorAll('img')) { image.onload = null; image.onerror = null; image.removeAttribute('src'); }
      layer.remove();
      delete root.dataset.emeraldTrainerIntro;
      root.style.removeProperty('--emerald-reveal-ms');
    },
  };
}
