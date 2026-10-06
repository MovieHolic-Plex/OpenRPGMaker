import type { Project } from './types';
import { collectorFieldMenu } from './fieldMenu';

const BUILTIN_OPENING_TEXTS = [
  '강을 낀 왕국에는 오래도록 전쟁이 없었다.',
  '하늘이 갈라지던 날, 빛은 산 너머로 물러났다.',
  '달빛만 남은 호숫가에서, 한 사람이 검을 집어 들었다.',
  '— 새 프로젝트 —',
];

/** An explicit collector presentation preset. Preserve independently authored opening stories. */
export function configureMonsterPresentation(project: Project): { defaultOpeningDisabled: boolean } {
  project.system.menuUiStyle = 'field-list';
  project.meta.oprnFieldMenu = collectorFieldMenu();
  project.meta.oprnShopPreset = 'collector';
  project.system.fieldHud = {
    ...project.system.fieldHud,
    theme: 'collector', font: 'pixel', menuStyle: 'project', clock: project.system.fieldHud?.clock ?? false,
    vitals: false, hideEmpty: true,
  };
  const opening = project.system.opening;
  const defaultOpening = opening?.scenes.length === BUILTIN_OPENING_TEXTS.length
    && opening.scenes.every((scene, index) => scene.narration === BUILTIN_OPENING_TEXTS[index]);
  const defaultOpeningDisabled = defaultOpening && opening?.enabled === true;
  if (defaultOpeningDisabled && opening) project.system.opening = { ...opening, enabled: false };
  return { defaultOpeningDisabled };
}
