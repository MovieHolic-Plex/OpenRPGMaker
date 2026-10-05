import {
  AUTHORING_PRESET_CATEGORIES, AUTHORING_PRESET_RULES, AUTHORING_PRESETS,
  authoringPresetById, searchAuthoringPresets, type AuthoringPresetCategory,
} from '@/project/authoringPresets';
import type { Project } from '@/project/types';
import { ToolError, type ToolDefinition } from './types';

const SYSTEM_FIELDS = {
  exploration: ['timeSystem'],
  'npc-life': ['timeSystem', 'companions'],
  'life-economy': ['timeSystem', 'craftRecipes', 'itemUpgrades', 'sellPrices', 'toolActions',
    'fishing', 'seasonalForage', 'museum', 'collections', 'energy', 'shipping', 'bundles', 'worldUnlocks', 'makers'],
  combat: ['battleModel', 'battleUiStyle', 'battleFlow', 'battleParty', 'actionCombat', 'limitGauge', 'resource2', 'partyGauge', 'atbMode'],
  party: ['companions', 'battleParty', 'activeSlots', 'rewardPolicy'],
  growth: ['battleModel', 'battleFlow', 'battleParty', 'limitGauge', 'resource2', 'partyGauge'],
  dungeon: ['timeSystem', 'actionCombat', 'vehicles'],
  'world-story': ['timeSystem', 'vehicles', 'worldUnlocks'],
  'time-causality': ['chapter', 'timeSystem'],
  'loot-equipment': ['craftRecipes', 'itemUpgrades', 'sellPrices'],
  'repeat-challenge': ['battleModel', 'battleFlow', 'actionCombat', 'difficulties', 'defaultDifficultyId', 'timeSystem'],
  endings: ['newGamePlus', 'chapter', 'gallery', 'titleScreen'],
} as const satisfies Record<AuthoringPresetCategory, readonly (keyof Project['system'])[]>;
const PROJECT_FIELDS = {
  exploration: [], 'npc-life': ['characters'], 'life-economy': [], combat: [],
  party: ['characters'], growth: ['growth'], dungeon: ['mapConnections'],
  'world-story': ['world', 'worldCanon', 'worldGraph', 'factions'],
  'time-causality': ['mapConnections'], 'loot-equipment': [], 'repeat-challenge': [], endings: ['endings'],
} as const satisfies Record<AuthoringPresetCategory, readonly (keyof Project)[]>;
function readAuthoringState(project: Project, category: AuthoringPresetCategory) {
  const fields = SYSTEM_FIELDS[category];
  const projectFields: readonly (keyof Project)[] = PROJECT_FIELDS[category];
  const databaseFields = category === 'life-economy' ? ['fishSpecies', 'crops', 'lifeSkills'] as const : [];
  return {
    source: 'live-project-authoring-data',
    system: Object.fromEntries(fields.filter(key => project.system[key] !== undefined)
      .map(key => [key, structuredClone(project.system[key])])),
    absentFields: fields.filter(key => project.system[key] === undefined),
    project: Object.fromEntries(projectFields.filter(key => project[key] !== undefined)
      .map(key => [key, structuredClone(project[key])])),
    absentProjectFields: projectFields.filter(key => project[key] === undefined),
    flagDefinitions: { switches: structuredClone(project.switches), variables: structuredClone(project.variables),
      storyFlags: structuredClone(project.storyFlags ?? []) },
    mapReferences: Object.values(project.maps).map(map => ({ id: map.id, name: map.name })),
    database: Object.fromEntries(databaseFields.filter(key => project.database[key] !== undefined)
      .map(key => [key, structuredClone(project.database[key])])),
    absentDatabaseFields: databaseFields.filter(key => project.database[key] === undefined),
    startSession: { inventory: structuredClone(project.session.inventory), gold: project.session.gold,
      partyActorIds: [...project.session.partyActorIds] },
    refresh: '설정을 변경한 뒤 같은 read_authoring_preset을 다시 호출해 최신 값을 확인한다. 시작 상태는 현재 플레이 중인 런타임 세션이 아니다.',
  };
}

function integer(value: unknown, fallback: number, min: number, max: number, field: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new ToolError(`${field}는 ${min}~${max} 정수여야 합니다.`, { code: 'invalid-args' });
  }
  return value;
}
const listPresets: ToolDefinition = {
  name: 'list_authoring_presets', mode: 'read', domains: ['system'],
  description: `일반 제작·수정 요청에서 AI 조수가 적합한 플레이 패턴을 스스로 찾는다. ${AUTHORING_PRESET_CATEGORIES.map(category => `${category.label}(${category.id})`).join(', ')}. JRPG·크로노풍 시대/인과·연계기와 디아블로풍 재료 사냥/장비 강화/반복 도전도 포함한다. category/query로 좁히고 상세는 read_authoring_preset으로 읽는다. 조회는 프로젝트를 수정하거나 플레이 완료를 증명하지 않는다.`,
  parameters: { type: 'object', properties: {
    category: { type: 'string', enum: AUTHORING_PRESET_CATEGORIES.map(entry => entry.id) },
    query: { type: 'string', maxLength: 200, description: '제목·설명·태그·ID 검색. 여러 단어는 모두 포함해야 한다.' },
    offset: { type: 'integer', minimum: 0, maximum: 10000 },
    limit: { type: 'integer', minimum: 1, maximum: 12 },
  }, additionalProperties: false },
  run(_project, args) {
    if (args.category !== undefined && !AUTHORING_PRESET_CATEGORIES.some(entry => entry.id === args.category)) {
      throw new ToolError('지원하지 않는 플레이 프리셋 분류입니다.', { code: 'invalid-args' });
    }
    if (args.query !== undefined && (typeof args.query !== 'string' || args.query.length > 200)) {
      throw new ToolError('query는 200자 이내 문자열이어야 합니다.', { code: 'invalid-args' });
    }
    const offset = integer(args.offset, 0, 0, 10000, 'offset');
    const limit = integer(args.limit, 12, 1, 12, 'limit');
    const matches = searchAuthoringPresets(args.category as AuthoringPresetCategory | undefined, args.query as string | undefined);
    const entries = matches.slice(offset, offset + limit).map(({ id, version, category, title, description, tags }) => ({ id, version, category, title, description, tags: [...tags] }));
    return {
      summary: entries.length ? `플레이 프리셋 ${entries.length}종 조회 — 일치 ${matches.length}종. 상세는 read_authoring_preset(presetId).`
        : '일치하는 플레이 프리셋이 없습니다. category/query 또는 offset을 확인하세요.',
      data: { categories: AUTHORING_PRESET_CATEGORIES.map(entry => ({ ...entry, count: AUTHORING_PRESETS.filter(preset => preset.category === entry.id).length })),
        entries, total: matches.length, offset, nextOffset: offset + entries.length < matches.length ? offset + entries.length : null,
        next: '사용자 요청의 행동과 후보 설명을 비교해 필요한 프리셋을 조수가 선택하고 read_authoring_preset으로 읽는다. 복합 요청은 관련 지침을 각각 읽어 필요한 단계만 조합한다. 검색 결과가 없으면 category만 지정하거나 더 짧은 query로 다시 조회한다.' },
    };
  },
};
const readPreset: ToolDefinition = {
  name: 'read_authoring_preset', mode: 'read', domains: ['system'],
  description: '목록에서 고른 공용 플레이 프리셋의 작성 매뉴얼 전체와 해당 분야의 현재 system·프로젝트 설정·상태 슬롯 정의·맵 참조·저작 시작 상태를 읽는다. 기존 제작법·생활/경제·시간·전투·성장·엔딩 원본 보존과 수정 후 재조회에 사용한다. 상태 전이·단계별 실제 도구·산출물·실패/취소/재방문 검사·엔진 한계도 반환한다. 필요한 도구는 find_tools로 스키마를 찾아 실제로 호출해야 하며, 조회만으로 작성·검증·저장이 완료되지 않는다.',
  parameters: { type: 'object', properties: {
    presetId: { type: 'string', maxLength: 100, description: 'list_authoring_presets에서 조회한 실제 ID. 예: past-world-change, dual-tech, equipment-upgrade, new-game-plus.' },
  }, required: ['presetId'], additionalProperties: false },
  run(project, args) {
    const preset = typeof args.presetId === 'string' ? authoringPresetById(args.presetId) : undefined;
    if (!preset) throw new ToolError('알 수 없는 플레이 프리셋 ID입니다. list_authoring_presets로 조회하세요.', { code: 'preset-not-found' });
    const names = [...new Set([...preset.tools.read, ...preset.tools.write, ...preset.tools.verify])];
    return {
      summary: `「${preset.title}」 작성 지침 — ${preset.steps.length}단계·검사 ${preset.checks.length}항목. 실제 작성과 플레이 검사는 아직 수행하지 않았습니다.`,
      data: { preset: structuredClone(preset), rules: [...AUTHORING_PRESET_RULES], verificationStatus: 'not-run',
        authoringState: readAuthoringState(project, preset.category),
        discoveryQueries: names.map(query => ({ tool: 'find_tools', query })),
        next: '사용자 범위에 맞는 단계만 선택하고 현재 데이터를 읽는다. 다른 행동도 요청받았다면 관련 프리셋을 읽어 공통 대상과 상태를 공유한다. 제작·수정 요청이면 실제 작성 도구의 스키마를 확인해 호출한 뒤 checks를 실행하고 근거를 보고한다. 설명·조회 요청은 읽기와 설명까지 수행한다.' },
    };
  },
};
export const AUTHORING_PRESET_TOOLS: readonly ToolDefinition[] = [listPresets, readPreset];
