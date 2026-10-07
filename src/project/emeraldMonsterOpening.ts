import type { Project, TitleEffect, UploadedAsset } from './types';
import professorArtwork from '../../public/assets/emerald-monster/professor-asset.json';
import titleArtwork from '../../public/assets/emerald-monster/title-asset.json';
import { defaultTitleScreenSettings } from './defaults/defaultDatabase';

export type EmeraldOpeningPage = { id: string; text: string; monsterSpeciesId?: string };

/** Anchors belong to the bundled stag/coastal sunset artwork, in image coordinates. */
export function createEmeraldMonsterTitleEffects(): TitleEffect[] {
  return [
    { kind: 'godRays', intensity: 0.24, speed: 0.3, color: '#ffe8ab', source: [0.44, 0.65], toward: [0.66, 0.12], spread: 0.38 },
    { kind: 'water', intensity: 0.32, speed: 0.45, color: '#b8fff1', region: [[0, 0.7], [0.62, 0.7], [0.53, 0.88], [0.35, 1], [0, 0.91]] },
    { kind: 'dapple', intensity: 0.2, speed: 0.35, region: [[0.61, 0.84], [0.96, 0.89], [1, 1], [0.46, 1]] },
    { kind: 'motes', intensity: 0.35, speed: 0.32, color: '#f9ffd3', count: 12, region: [[0.59, 0.1], [0.95, 0.1], [0.97, 0.65], [0.62, 0.7]] },
    { kind: 'glow', intensity: 0.22, speed: 0.4, color: '#f6ffbd', source: [0.93, 0.055], spread: 0.06 },
    { kind: 'parallax', intensity: 0.12, speed: 0.25 },
  ];
}

/** Shared original sprite introduction; actual starter selection remains in authored events. */
export function configureEmeraldMonsterOpening(project: Project, options: {
  professorName?: string;
  pages?: EmeraldOpeningPage[];
  musicResourceId?: string;
} = {}): void {
  const professor = professorArtwork as UploadedAsset;
  project.assets.uploaded[professor.id] = { ...professor, meta: { ...professor.meta } };
  const species = project.database.monsterSpecies ?? [];
  const starter = ['grass', 'fire', 'water'].map(type => species.find(s => s.types?.includes(type)));
  const professorName = options.professorName ?? '천문박사';
  const place = project.maps[project.startMapId]?.name ?? '새로운 마을';
  const pages: EmeraldOpeningPage[] = options.pages ?? [
    { id: 'emerald_intro_welcome', text: `안녕! 만나서 반갑구나.\n나는 몬스터를 연구하는 ${professorName}란다.` },
    { id: 'emerald_intro_world', text: '이 세계에는 몬스터라는 친구들이 살고 있지.\n사람과 함께 살아가기도, 풀숲에서 뛰놀기도 한단다.', monsterSpeciesId: starter[0]?.id },
    { id: 'emerald_intro_companions', text: '어떤 친구는 뜨거운 불을 품고,\n어떤 친구는 바다를 자유롭게 헤엄치지.', monsterSpeciesId: starter[1]?.id },
    { id: 'emerald_intro_journey', text: '너와 함께 여행할 친구를 만나 보렴.\n친구마다 잘하는 기술도, 좋아하는 장소도 다르단다.', monsterSpeciesId: starter[2]?.id },
    { id: 'emerald_intro_choice', text: '첫 동료는 네가 직접 고르면 돼.\n풀밭을 걷고, 친구를 만나고, 함께 강해지는 거야.' },
    { id: 'emerald_intro_departure', text: `${place}에서 너의 모험이 시작된단다.\n먼저 연구소에 들러 보렴. 기다리고 있겠다!` },
  ];
  if (pages.length < 2 || pages.length > 32) throw Error('Emerald introduction needs 2..32 confirmed pages');
  if (new Set(pages.map(page => page.id)).size !== pages.length) throw Error('Opening page ids must be unique');
  const scenes = pages.map(page => {
    if (!page.id || !page.text.trim()) throw Error('Opening page needs an id and readable text');
    const monster = page.monsterSpeciesId ? species.find(s => s.id === page.monsterSpeciesId) : undefined;
    if (page.monsterSpeciesId && !monster) throw Error(`Unknown showcase species: ${page.monsterSpeciesId}`);
    return { id: page.id, kind: 'image' as const, resourceId: monster?.graphic.monsterResourceId ?? professor.id,
      durationMs: 0, motion: 'none' as const, narration: page.text };
  });
  const musicResourceId = options.musicResourceId ?? project.system.opening?.musicResourceId;
  project.system.opening = { enabled: true, skippable: true, scenes, ...(musicResourceId ? { musicResourceId } : {}) };
  project.meta.oprnOpeningBook = { version: 1, sceneIds: scenes.map(s => s.id), ink: 'ivory', portraitResourceId: professor.id };
  configureEmeraldMonsterPortraitMotion(project);
  configureEmeraldMonsterTitle(project);
}

/** 교수 초상 움직임 시트(pokemon-character-motion 산출)는 저작권 정리(2026-10-07)로 지웠다. 초상은 정지 그림으로 둔다. */
export function configureEmeraldMonsterPortraitMotion(project: Project): void {
  const professor = professorArtwork as UploadedAsset;
  project.assets.uploaded[professor.id] = { ...professor, meta: { ...professor.meta } };
  const book = project.meta.oprnOpeningBook;
  if (!book || !project.system.opening) throw Error('An authored introduction is required before portrait motion');
  const { portraitMotion: _removed, ...rest } = book;
  project.meta.oprnOpeningBook = { ...rest, portraitResourceId: professor.id };
}

/** Shared original pixel key art; menu input and saved-game availability remain native. */
export function configureEmeraldMonsterTitle(project: Project): void {
  const artwork = titleArtwork as UploadedAsset;
  project.assets.uploaded[artwork.id] = { ...artwork, meta: { ...artwork.meta } };
  const previous = project.system.titleScreen ?? defaultTitleScreenSettings();
  project.system.titleScreen = {
    ...previous, title: project.meta.title, backgroundResourceId: artwork.id,
    backgroundFit: 'cover', backgroundRendering: 'pixelated', logoStyle: 'plain',
    logoSubtitle: '작은 동료와 여덟 빛의 약속', menuStyle: 'plain',
    layout: { ...previous.layout, titleX: 24, titleY: 30, menuX: 28, menuY: 132 },
    effects: createEmeraldMonsterTitleEffects(), backgroundLayers: [], particles: undefined,
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
