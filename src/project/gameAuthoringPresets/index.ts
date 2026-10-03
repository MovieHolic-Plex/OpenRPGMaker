import documents from './documents.json';
import type { GameDesignBrief, GameBriefSlot } from '../gameDesignBrief';
import type { InterviewGenre } from '../gameInterview';
import { choiceExecutionBindings } from './choices';

export const AUTHORING_PRESET_VERSION = 1;
export const AUTHORING_GENRE_LABELS: Record<InterviewGenre, string> = {
  romance: '관계·연애', monster: '몬스터 수집·육성', adventure: '탐험·모험', mystery: '추리·미스터리',
};

/** Old briefs use their engine's supported authoring genre; unsupported engines stay unchanged. */
export function authoringGenres(brief: GameDesignBrief): InterviewGenre[] {
  if (brief.interview) return [brief.interview.genre, ...(brief.interview.secondary ? [brief.interview.secondary] : [])];
  const genre = ({ 'story-cutscene': 'romance', 'monster-collect': 'monster', 'adventure-jrpg': 'adventure' } as const)[brief.presetId as 'story-cutscene' | 'monster-collect' | 'adventure-jrpg'];
  // A legacy story engine is not evidence of a romance selection.
  return genre && brief.presetId !== 'story-cutscene' ? [genre] : [];
}

export function selectedAuthoringDocuments(brief: GameDesignBrief) {
  const genres = authoringGenres(brief);
  return genres.length ? [documents.common, ...genres.map(genre => documents[genre])] : [];
}

export function authoringPresetManifest(brief: GameDesignBrief) {
  return selectedAuthoringDocuments(brief).map(({ id, version, sha256, text, sections }) => ({
    id, version, sha256, characters: text.length, sectionIds: sections.map(section => section.id),
  }));
}

export function detailedAuthoringTasks(brief: GameDesignBrief) {
  const requirements: GameBriefSlot[] = ['experience', 'activity', 'progression', 'detail', 'scope'];
  const dependencies: Record<string, string[]> = {
    C01: ['P01'], C02: ['C01'], C03: ['C02'], C04: ['C01'], C05: ['C02', 'C04'],
    C06: ['C03', 'C05'], C07: ['C02'], C08: ['C04'], C09: ['C06', 'C07'],
    C10: ['C02'], C11: ['C06', 'C09'], C12: ['C11'],
    R01: ['C01'], R02: ['R01'], R03: ['R02', 'C04'], R04: ['R03'], R05: ['R04'],
    R06: ['R04', 'C06'], R07: ['R03', 'C03'], R08: ['R04'], R09: ['R04'], R10: ['R04'],
    R11: ['R01', 'C03', 'C08'], R12: ['R05', 'R11'], R13: ['R04', 'C06'],
    R14: ['R05', 'R13'], R15: ['R14', 'C11'], R16: ['P02'],
    K01: ['C01'], K02: ['K01', 'C04'], K03: ['K02'], K04: ['K02', 'C05'], K05: ['K02', 'C05'],
    K06: ['K02'], K07: ['K02'], K08: ['K02', 'C05'], K09: ['K02'], K10: ['K01', 'C03'],
    K11: ['K01', 'C08'], K12: ['K02', 'C06'], K13: ['K02', 'C05'],
    K14: ['K12', 'K13'], K15: ['K14', 'C11'], K16: ['P02'],
    V01: ['C01'], V02: ['V01'], V03: ['V02', 'C03'], V04: ['V03', 'C05'], V05: ['V01', 'C04'],
    V06: ['V05', 'C05'], V07: ['V02', 'C04'], V08: ['V07', 'C06'], V09: ['V02', 'C05'],
    V10: ['V02', 'C03'], V11: ['V03', 'C08'], V12: ['V02', 'C09'],
    V13: ['V02', 'C06'], V14: ['V13', 'C05'], V15: ['V14', 'C11'], V16: ['P02'],
    Y01: ['C01'], Y02: ['Y01'], Y03: ['Y02', 'C04'], Y04: ['Y03', 'C06'], Y05: ['Y02', 'C07'],
    Y06: ['Y03', 'Y05'], Y07: ['Y03', 'C06'], Y08: ['Y01', 'C03'], Y09: ['Y03', 'C05'],
    Y10: ['Y09', 'Y08'], Y11: ['Y01', 'C09'], Y12: ['Y08', 'C08'],
    Y13: ['Y09', 'C06'], Y14: ['Y09', 'C06'], Y15: ['Y13', 'Y14', 'C11'], Y16: ['P02'],
  };
  return selectedAuthoringDocuments(brief).flatMap(document => document.sections.map(section => ({
    id: section.id, dependsOn: dependencies[section.id], requirements: [...requirements],
    input: section.input, action: section.action, output: section.output, acceptance: section.acceptance,
    presetDocument: document.id, presetSection: section.id,
    // These are concrete work contracts, not a claim every optional mechanic is required.
    applicability: '현재 확정 기획과 첫 제작 범위에 필요한 절만 실행한다. 미적용 절은 이유와 함께 skipped로 구분하며, 의존 절의 작업이 필요한지 판단한다. 사용자 설정은 최신 원문을 우선한다.',
  })));
}

/** Full manuals are embedded, never replaced by an index, summary, URL or lazy retrieval. */
export function detailedAuthoringPresetContext(brief: GameDesignBrief): string {
  const selected = selectedAuthoringDocuments(brief);
  if (!selected.length) return '';
  return [
    '## 상세 게임 제작 프리셋',
    '다음은 실제 적용할 제작 매뉴얼 전문이다. 요약이나 목차만으로 대체하지 않는다. 선택한 두 장르는 두 문서 전체를 읽고 결합하며, 사용하지 않은 장르의 시스템은 추가하지 않는다.',
    '문서의 전형·예시는 저작 규칙이다. 최신 확정 요약과 이후 사용자 수정이 원래 선택·예시·임시 결정보다 우선한다. 불필요한 기능이나 미래 범위까지 실행하지 않는다. 각 절의 입력과 선행 조건을 확인해 내부 하위 TODO로 구체화하고 실제 산출물과 검증 기록으로 추적한다.',
    `AUTHORING_PRESET_MANIFEST ${JSON.stringify(authoringPresetManifest(brief))}`,
    ...selected.map(document => `AUTHORING_PRESET_BEGIN ${document.id} ${document.sha256}\n${document.text}\nAUTHORING_PRESET_END ${document.id} ${document.sha256}`),
    choiceExecutionBindings(brief),
    ...(brief.interview?.secondary ? [
      `결합 대상: ${AUTHORING_GENRE_LABELS[brief.interview.genre]} + ${AUTHORING_GENRE_LABELS[brief.interview.secondary]}`,
      `사용자 결합 원문: ${JSON.stringify(brief.interview.blend)}`,
      '결합은 주 장르의 입력 → 실제 상태 변화 → 보조 장르의 입력 또는 반응 → 결과의 계약으로 설계한다. 별도 에피소드이면 각 장면의 완료와 다음 진입 조건을 분리하고, 한 선택의 공동 영향이면 두 상태 변화와 두 후속 반응을 각각 검증한다. 첫 범위 밖 기능은 계획만 남기고 완료로 보고하지 않는다.',
    ] : []),
  ].join('\n\n');
}
