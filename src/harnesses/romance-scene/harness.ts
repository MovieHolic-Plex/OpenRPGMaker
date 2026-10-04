import { defineHarness } from '../_core/manifest';
import { normalizeRomanceContract } from './contract';

export const ROMANCE_SCENE_HARNESS = defineHarness({
  id: 'romance-scene', title: '연애 첫 대화 장면',
  summary: '한 맵의 첫 만남을 코드로 준비하고, 두 선택의 상태·반응·재대화·종료를 실제 해석자로 검사한다. AI 완료 선언은 검증 영수증이 아니다.',
  scope: { genre: 'story-cutscene' },
  triggers: ['단일 관계·연애 장르에서 대화 중심 / 한 관계 / 첫 만남 한 장면을 선택했을 때'],
  seed: 'harness-data/romance-scene/seed.json', doc: 'openwiki/harnesses/romance-scene.md',
  stages: [{ id: 'inspect', title: '장면 검사', summary: '프로젝트 JSON의 계약·두 선택·재대화·종료를 검사한다. --project <path> 필요.' }],
  entrypoints: { cli: true, editorUi: false, assistantTool: true },
  contract: { normalize: normalizeRomanceContract },
});
