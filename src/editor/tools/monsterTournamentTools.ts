import type { ToolDefinition } from './types';
import { ToolError } from './types';
import { replaceProjectContents } from './historyTools';
import type { Project } from '@/project/types';

// 포획 없는 대회형(트레이너 대전 토너먼트) 몬스터 게임 생성기. 캠페인(build_monster_game)과 같은 룰·로스터·그림·칩셋을 쓰되
// 체육관 8관·스토리 대신 접수 → 연습장 → N회전 본선 → 우승 엔딩으로 짠다. monsterCollection=false 를 선언한다.
let builder: typeof import('@/project/examples/monsterExpedition/tournamentGame')['createMonsterTournament'] | undefined;
let expeditionBuilder: typeof import('@/project/examples/monsterExpedition/tournamentGame')['createMonsterHuntingGrounds'] | undefined;
let loadError = '';

function isBlankDestination(p: Project): boolean {
  const maps = Object.values(p.maps);
  if (p.system.monsterCampaign || Object.keys(p.session.monsterInstances ?? {}).length || maps.length !== 1 || maps[0]!.id !== 'map_blank_start') return false;
  const map = maps[0]!;
  return !map.events.length && map.lowerTiles.every(t => t === map.lowerTiles[0]) && map.upperTiles.every(t => t === -1)
    && !(map.lowerOverlayTiles?.some(t => t !== -1) || map.upperOverlayTiles?.some(t => t !== -1) || map.shadowBits?.some(Boolean) || map.relief);
}

const THEMES = ['desert', 'snow', 'coast', 'volcano'] as const;
type Theme = (typeof THEMES)[number];

export const MONSTER_TOURNAMENT_TOOLS: readonly ToolDefinition[] = [
  {
    name: 'build_monster_tournament',
    description: '포획 없는 대회형(트레이너 대전 중심) 몬스터 게임을 실제 프로젝트로 생성한다 — 접수 마을(센터·도구점·집·접수처) · 연습장(야생·연습 상대) · 본선 N회전(방마다 상대·대기실 회복) · 결승 · 우승 엔딩. 몬스터 파티로 싸우되 포획 커맨드·포획구슬은 없다(system.monsterCollection=false 선언). 체육관·배지 캠페인이 아니므로 build_monster_game 을 쓰지 말 것. 빈 프로젝트에만 생성, 기존 게임 교체는 replace:true.',
    mode: 'write',
    domains: ['system', 'world', 'database'],
    preservesAuthoredRaster: true,
    allowsTilesetChange: true,
    placesCuratedCast: true,
    prepare: async () => {
      try { const mod = await import('@/project/examples/monsterExpedition/tournamentGame'); builder = mod.createMonsterTournament; expeditionBuilder = mod.createMonsterHuntingGrounds; loadError = ''; }
      catch (e) { loadError = String(e); throw e; }
    },
    parameters: {
      type: 'object', additionalProperties: false, properties: {
        title: { type: 'string', maxLength: 120, description: '게임 제목(생략하면 「<대회 이름> 몬스터 토너먼트」)' },
        rounds: { type: 'integer', minimum: 2, maximum: 8, description: '본선 회전 수(결승 포함). 기본 4. 마지막 회전이 결승이다.' },
        startTheme: { type: 'string', enum: ['meadow', ...THEMES], description: '시작 마을 풍경. 생략/meadow=풀밭, desert/snow/coast/volcano. 요청이 화산·용암이면 volcano.' },
        names: { type: 'object', additionalProperties: false, description: '기획서의 고유명. 있으면 넘긴다.', properties: {
          region: { type: 'string', maxLength: 40, description: '대회 이름(기본 별빛 대회)' },
          startTown: { type: 'string', maxLength: 40, description: '접수 마을 이름' },
          registrar: { type: 'string', maxLength: 40, description: '첫 동료를 건네는 접수 담당' },
          rival: { type: 'string', maxLength: 40, description: '라이벌 이름(기본 나루)' },
          champion: { type: 'string', maxLength: 40, description: '결승 상대(기본 라이벌)' },
          arena: { type: 'string', maxLength: 40, description: '본선 경기장 이름(기본 <대회 이름> 본선)' },
        } },
        replace: { type: 'boolean', description: '기존 저작 프로젝트 전체 교체가 명시적으로 요청된 경우만 true.' },
      },
    },
    run(p, args) {
      if (!isBlankDestination(p) && args.replace !== true) throw new ToolError('기존 저작 맵을 보존했습니다. 전체 폐기가 명시된 요청만 replace:true 로 처리하세요.', { code: 'monster-create-authored-project' });
      if (!builder) throw new ToolError('대회 재료를 불러오지 못했습니다. runToolAsync/prepareTool 생성 경로를 사용하세요. ' + loadError, { code: 'monster-builder-not-prepared' });
      const theme = THEMES.includes(args.startTheme as Theme) ? (args.startTheme as Theme) : undefined;
      const names = args.names && typeof args.names === 'object' ? (args.names as Record<string, string>) : undefined;
      const rounds = typeof args.rounds === 'number' ? args.rounds : undefined;
      const built = builder({ ...(rounds !== undefined ? { rounds } : {}), ...(theme ? { startTheme: theme } : {}), ...(names ? { names } : {}), ...(typeof args.title === 'string' && args.title.trim() ? { title: args.title.trim() } : {}) });
      const fresh = built.project;
      fresh.meta.author = p.meta.author; fresh.gameDesignBrief = p.gameDesignBrief; fresh.aiInstructions = p.aiInstructions;
      replaceProjectContents(p, fresh);
      return {
        summary: `포획 없는 대회형 몬스터 게임을 생성했습니다 — ${Object.keys(p.maps).length}맵 · 본선 ${built.manifest.rounds}회전(결승 포함) · 연습장 · 우승 엔딩. 포획구슬·포획 커맨드 없음(monsterCollection=false 선언). 실제 플레이/저장은 별도로 확인하세요.`,
        data: { mode: 'create', format: 'tournament', capture: false, rounds: built.manifest.rounds, maps: Object.keys(p.maps).length, battles: built.manifest.battles.length, startTheme: theme ?? 'meadow', sessionPreserved: false },
      };
    },
  },
  {
    name: 'build_monster_expedition',
    description: '체육관 없이 사냥터를 따라 걷는 도감 탐험형 몬스터 수집 게임을 실제 프로젝트로 생성한다 — 마을(센터·도구점·집·연구소) · 사냥터 N곳(야생·조련사 둘) · 라이벌(연구소 + 마지막 사냥터 앞) · 마지막 사냥터의 보스 · 엔딩. 포획 있음(구슬·도감). 체육관·배지가 없으니 「체육관 없이」 요청에 쓰고, 도감을 60종 넘게 채우려면 이어서 define_monster_families(spawn)를 쓴다. 빈 프로젝트에만, 교체는 replace:true.',
    mode: 'write',
    domains: ['system', 'world', 'database'],
    preservesAuthoredRaster: true,
    allowsTilesetChange: true,
    placesCuratedCast: true,
    prepare: async () => {
      try { const mod = await import('@/project/examples/monsterExpedition/tournamentGame'); builder = mod.createMonsterTournament; expeditionBuilder = mod.createMonsterHuntingGrounds; loadError = ''; }
      catch (e) { loadError = String(e); throw e; }
    },
    parameters: {
      type: 'object', additionalProperties: false, properties: {
        title: { type: 'string', maxLength: 120, description: '게임 제목(생략하면 「<지역> 도감 탐험」)' },
        rounds: { type: 'integer', minimum: 2, maximum: 5, description: '사냥터 수(마지막 사냥터 포함). 기본 4' },
        startTheme: { type: 'string', enum: ['meadow', ...THEMES], description: '시작 마을 풍경(화산·용암→volcano 등)' },
        names: { type: 'object', additionalProperties: false, description: '기획서의 고유명', properties: {
          region: { type: 'string', maxLength: 40, description: '지역·탐험 이름(기본 별빛 사냥터)' },
          startTown: { type: 'string', maxLength: 40, description: '시작 마을 이름' },
          registrar: { type: 'string', maxLength: 40, description: '첫 동료를 주는 박사' },
          rival: { type: 'string', maxLength: 40, description: '라이벌 이름(기본 나루)' },
        } },
        replace: { type: 'boolean', description: '기존 저작 프로젝트 전체 교체가 명시된 경우만 true.' },
      },
    },
    run(p, args) {
      if (!isBlankDestination(p) && args.replace !== true) throw new ToolError('기존 저작 맵을 보존했습니다. 전체 폐기가 명시된 요청만 replace:true 로 처리하세요.', { code: 'monster-create-authored-project' });
      if (!expeditionBuilder) throw new ToolError('재료를 불러오지 못했습니다. runToolAsync/prepareTool 생성 경로를 사용하세요. ' + loadError, { code: 'monster-builder-not-prepared' });
      const theme = THEMES.includes(args.startTheme as Theme) ? (args.startTheme as Theme) : undefined;
      const names = args.names && typeof args.names === 'object' ? (args.names as Record<string, string>) : undefined;
      const built = expeditionBuilder({ ...(typeof args.rounds === 'number' ? { rounds: args.rounds } : {}), ...(theme ? { startTheme: theme } : {}), ...(names ? { names } : {}), ...(typeof args.title === 'string' && args.title.trim() ? { title: args.title.trim() } : {}) });
      const fresh = built.project;
      fresh.meta.author = p.meta.author; fresh.gameDesignBrief = p.gameDesignBrief; fresh.aiInstructions = p.aiInstructions;
      replaceProjectContents(p, fresh);
      const groundIds = Object.keys(p.maps).filter(id => id.startsWith('mx_map_ground_'));
      return {
        summary: `체육관 없는 도감 탐험 게임을 생성했습니다 — ${Object.keys(p.maps).length}맵 · 사냥터 ${built.manifest.rounds}곳 · 라이벌 · 마지막 사냥터 보스 · 엔딩. 포획·도감 있음. 도감을 더 채우려면 define_monster_families(spawn.mapIds=사냥터). 실제 플레이/저장은 별도로 확인하세요.`,
        data: { mode: 'create', format: 'expedition', capture: true, grounds: built.manifest.rounds, groundMapIds: groundIds, maps: Object.keys(p.maps).length, battles: built.manifest.battles.length, startTheme: theme ?? 'meadow', speciesInDex: p.database.monsterSpecies?.length ?? 0, sessionPreserved: false },
      };
    },
  },
];
