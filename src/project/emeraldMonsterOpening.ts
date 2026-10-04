import type { Project, UploadedAsset } from './types';
import professorArtwork from '../../public/assets/emerald-monster/professor-asset.json';

export type EmeraldOpeningPage = { id: string; text: string; monsterSpeciesId?: string };

/** Shared original sprite introduction; actual starter selection remains in authored events. */
export function configureEmeraldMonsterOpening(project: Project, options: {
  professorName?: string;
  pages?: EmeraldOpeningPage[];
  musicResourceId?: string;
} = {}): void {
  const professor = professorArtwork as UploadedAsset;
  project.assets.uploaded[professor.id] = { ...professor, meta: { ...professor.meta } };
  const species = project.database.monsterSpecies ?? [];
  const starter = ['grass', 'fire', 'water'].map(type => species.find(s => s.types.includes(type)));
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
}
