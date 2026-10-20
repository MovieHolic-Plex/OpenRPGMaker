import type { Project } from './types';
import type { EventPageGraphic } from './types/events';
import { EMERALD_PROFESSOR_BUST_RESOURCE_ID } from './emeraldProfessorArt';
import { createStagTitleEffects, monsterTitleArt, monsterTitleThemeOf, type MonsterTitleTheme } from './emeraldMonsterTitleArt';
import { defaultTitleScreenSettings } from './defaults/defaultDatabase';
import { validateOpeningAnimatic } from './openingAnimatic';
import {
  charsetPatternIndex, EMERALD_OPENING_SHOT_MS, EMERALD_OPENING_SHOTS, emeraldOpeningShot,
  type EmeraldOpeningCast, type EmeraldOpeningChip, type EmeraldOpeningShot,
} from './emeraldMonsterOpeningShots';

/** 한 컷의 내레이션. shot 은 그 컷이 그리는 장면(새벽 섬·1번길·연구소·스타터 무대·체육관·마을 출발). */
export type EmeraldOpeningPage = { id: string; text: string; shot: EmeraldOpeningShot };

/** Anchors belong to the bundled stag/coastal sunset artwork, in image coordinates. */
export const createEmeraldMonsterTitleEffects = createStagTitleEffects;

/** 게임 속 그 인물(이벤트 첫 페이지 그림)과 컷의 인물을 맞춘다 — 데모가 칩을 바꾸면 오프닝도 따라간다. 내장 시트 그림만. */
function fieldChip(project: Project, id: RegExp): EmeraldOpeningChip | undefined {
  for (const map of Object.values(project.maps)) {
    const graphic = map.events.find(event => id.test(event.id))?.pages?.[0]?.graphic;
    if (graphic?.sprite?.type === 'bundled' && graphic.pattern !== undefined) return { resourceId: graphic.sprite.id, index: charsetPatternIndex(graphic.pattern) };
  }
  return undefined;
}

// 컷의 사람들은 별빛섬 캠페인이 쓰는 내장 캐릭터 시트에서 고른다(천문박사·라이벌·새순 체육관 관장). 게임에 같은 인물 이벤트가 있으면 그 칩.
const PROFESSOR: EmeraldOpeningChip = { resourceId: 'tex_oprn_charset_scarloxy_people3', index: charsetPatternIndex(76) };
const RIVAL: EmeraldOpeningChip = { resourceId: 'tex_scarloxy_charset_people1', index: charsetPatternIndex(34) };
const LEADER: EmeraldOpeningChip = { resourceId: 'tex_scarloxy_charset_people2', index: charsetPatternIndex(28) };
const HERO: EmeraldOpeningChip = { resourceId: 'scarloxy-charset-people1', index: 0 };
const MONSTER_CHIPS = 'tex_oprn_charset_harness_monster1';
const FLYER: EmeraldOpeningChip = { resourceId: 'oprn-charset-dawning-skybirds', index: 0 };
const WILD: EmeraldOpeningChip = { resourceId: MONSTER_CHIPS, index: 5 };

const chipOf = (graphic: EventPageGraphic | undefined): EmeraldOpeningChip | undefined =>
  graphic?.sprite?.id ? { resourceId: graphic.sprite.id, index: charsetPatternIndex(graphic.pattern ?? 0) } : undefined;

function emeraldOpeningCast(project: Project): EmeraldOpeningCast {
  const species = project.database.monsterSpecies ?? [];
  const lead = project.database.actors[0];
  return {
    hero: lead?.characterResourceId ? { resourceId: lead.characterResourceId, index: lead.characterIndex ?? 0 } : HERO,
    professor: fieldChip(project, /_lab_professor$/u) ?? PROFESSOR, rival: fieldChip(project, /_lab_rival$/u) ?? RIVAL, leader: fieldChip(project, /_gym_leader$/u) ?? LEADER, flyer: FLYER, wild: WILD,
    starters: ['grass', 'fire', 'water'].flatMap(type => {
      const starter = species.find(s => s.types?.includes(type)), front = starter?.graphic.monsterResourceId;
      return starter && front ? [{ frontResourceId: front, chip: chipOf(starter.graphic.fieldGraphic) }] : [];
    }),
  };
}

function defaultEmeraldOpeningPages(project: Project, professorName: string): EmeraldOpeningPage[] {
  const place = project.maps[project.startMapId]?.name ?? '새로운 마을';
  return [
    { id: 'emerald_intro_welcome', shot: 'dawn', text: `안녕! 만나서 반갑구나.\n나는 몬스터를 연구하는 ${professorName}란다.` },
    { id: 'emerald_intro_world', shot: 'route', text: '이 세계에는 몬스터라는 친구들이 살고 있지.\n사람과 함께 살아가기도, 풀숲에서 뛰놀기도 한단다.' },
    { id: 'emerald_intro_lab', shot: 'lab', text: '나는 연구소에서 몬스터와 사람이\n함께 지내는 법을 연구하고 있단다.' },
    { id: 'emerald_intro_companions', shot: 'stage', text: '풀을 품은 친구, 불을 품은 친구, 물을 가르는 친구.\n첫 동료는 네가 직접 고르면 돼.' },
    { id: 'emerald_intro_rival', shot: 'gym', text: '체육관 관장들과 라이벌이 너를 기다리지.\n함께 강해져서 배지를 모아 보렴.' },
    { id: 'emerald_intro_departure', shot: 'town', text: `${place}에서 너의 모험이 시작된단다.\n먼저 연구소에 들러 보렴. 기다리고 있겠다!` },
  ];
}

function writeEmeraldOpening(project: Project, pages: readonly EmeraldOpeningPage[], musicResourceId: string | undefined): void {
  if (pages.length < 2 || pages.length > 32) throw Error('Emerald introduction needs 2..32 shots');
  if (new Set(pages.map(page => page.id)).size !== pages.length) throw Error('Opening page ids must be unique');
  const cast = emeraldOpeningCast(project);
  const scenes = pages.map(page => {
    if (!page.id || !page.text.trim()) throw Error('Opening page needs an id and readable text');
    const composition = emeraldOpeningShot(page.shot, cast);
    validateOpeningAnimatic(composition, EMERALD_OPENING_SHOT_MS, `opening.${page.id}`);
    return { id: page.id, kind: 'animatic' as const, composition, durationMs: EMERALD_OPENING_SHOT_MS, narration: page.text };
  });
  project.system.opening = { enabled: true, skippable: true, scenes, ...(musicResourceId ? { musicResourceId } : {}) };
  delete project.meta.oprnOpeningBook;
}

/** 6컷 레이어 애니메틱 오프닝(새벽 섬→1번길→연구소→스타터→체육관→출발). 컷마다 4.5초, Enter 로 넘긴다. */
export function configureEmeraldMonsterOpening(project: Project, options: {
  professorName?: string;
  pages?: EmeraldOpeningPage[];
  musicResourceId?: string;
  /** 타이틀 키아트 테마(startTheme 에서). 생략하면 지금 프로젝트에서 추정(monsterTitleThemeOf). */
  titleTheme?: MonsterTitleTheme;
} = {}): void {
  writeEmeraldOpening(project, options.pages ?? defaultEmeraldOpeningPages(project, options.professorName ?? '천문박사'),
    options.musicResourceId ?? project.system.opening?.musicResourceId);
  configureEmeraldMonsterTitle(project, options.titleTheme);
}

/** 예전 생성기 기본 소개의 장면 id(교수 이름은 첫 장 글에 들어 있다). */
const LEGACY_DEFAULT_IDS = ['emerald_intro_welcome', 'emerald_intro_world', 'emerald_intro_companions', 'emerald_intro_journey', 'emerald_intro_choice', 'emerald_intro_departure'];

/**
 * 예전 생성기가 만든 정지 교수 초상 소개(반신상/64×64 칩 위 Enter 페이지)를 6컷 애니메틱으로 바꾼다. 타이틀은 건드리지 않는다.
 * 생성기 기본 글이면 새 기본 컷 글로(교수 이름은 살린다), 손본 글이면 그대로 컷 순서에 고르게 나눠 싣는다.
 * 직접 고른 초상이나 움직임을 단 소개는 두고 false 를 돌려준다.
 */
export function upgradeLegacyEmeraldMonsterOpening(project: Project): boolean {
  const book = project.meta.oprnOpeningBook, opening = project.system.opening;
  const generated = book?.portraitResourceId === EMERALD_PROFESSOR_BUST_RESOURCE_ID || book?.portraitResourceId === 'oprn_emerald_professor';
  if (!book || !opening || !generated || book.portraitMotion) return false;
  if (!opening.scenes.length || !opening.scenes.every(scene => (scene.kind === 'image' || scene.kind === 'text') && scene.durationMs === 0 && scene.narration.trim())) return false;
  const last = opening.scenes.length - 1;
  const pages = opening.scenes.map(scene => scene.id).join() === LEGACY_DEFAULT_IDS.join()
    ? defaultEmeraldOpeningPages(project, /연구하는 (.+)란다/u.exec(opening.scenes[0]!.narration)?.[1] ?? '천문박사')
    : opening.scenes.map((scene, i): EmeraldOpeningPage => ({
      id: scene.id, text: scene.narration,
      shot: EMERALD_OPENING_SHOTS[last ? Math.round(i * (EMERALD_OPENING_SHOTS.length - 1) / last) : 0]!,
    }));
  writeEmeraldOpening(project, pages, opening.musicResourceId);
  return true;
}

/** Shared original pixel key art; menu input and saved-game availability remain native. */
/** theme: 시작 마을 풍경별 키아트(그림이 없으면 사슴으로). 생략하면 지금 프로젝트에서 추정한다. */
export function configureEmeraldMonsterTitle(project: Project, theme: MonsterTitleTheme = monsterTitleThemeOf(project)): void {
  const { asset: artwork, effects } = monsterTitleArt(theme);
  project.assets.uploaded[artwork.id] = { ...artwork, meta: { ...artwork.meta } };
  const previous = project.system.titleScreen ?? defaultTitleScreenSettings();
  project.system.titleScreen = {
    ...previous, title: project.meta.title, backgroundResourceId: artwork.id,
    backgroundFit: 'cover', backgroundRendering: 'pixelated', logoStyle: 'plain',
    logoSubtitle: '작은 동료와 여덟 빛의 약속', menuStyle: 'plain',
    layout: { ...previous.layout, titleX: 24, titleY: 30, menuX: 28, menuY: 132 },
    effects, backgroundLayers: [], particles: undefined,
    sequence: { fadeMs: 700, push: 0.015, sweep: false, logoAtMs: 250, logoReveal: 'fade', menuAtMs: 500 },
    sounds: {
      cursorSeResourceId: 'cc0-se-orp-interface-interface1',
      confirmSeResourceId: 'cc0-se-orp-interface-interface2',
      cancelSeResourceId: 'cc0-se-orp-interface-interface3',
      ...previous.sounds,
    },
    intro: undefined, logoShine: 'none', transition: { kind: 'fade', durationMs: 300 },
  };
}
