// 몬스터 수집 캠페인 타이틀 키아트를 시작 마을 풍경(startTheme)에 맞춰 고르는 표.
// 왜(2026-10-14): 사막·눈 기획에서도 타이틀이 늘 해안 사슴 그림이었다. 고르는 배선만 여기 두고 그림은 그림 작업자가 넣는다.
//
// 그림을 더하는 법(그림 작업자): public/assets/emerald-monster/title-<theme>-asset.json 을 title-asset.json 과 같은
// UploadedAsset 모양({id,name,kind:"picture",dataUrl,meta}, id = MONSTER_TITLE_ART_IDS[theme])으로 두고,
// 아래 VARIANTS 에 import 한 줄 + 항목 한 줄만 더한다. effects 를 주지 않으면 그림 좌표에 묶이지 않는 잔잔한 효과(NEUTRAL)를 쓴다.
// 항목이 없거나 id 가 다르면 지금의 사슴(해안) 그림으로 돌아간다 — 빌드가 그림 파일 유무로 깨지지 않는다.
import type { Project, TitleEffect, UploadedAsset } from './types';
import stagArtwork from '../../public/assets/emerald-monster/title-asset.json';

export const MONSTER_TITLE_THEMES = ['default', 'coast', 'desert', 'snow'] as const;
export type MonsterTitleTheme = typeof MONSTER_TITLE_THEMES[number];

/** coast 는 지금의 사슴·해안 그림 그 자체다(별도 파일 없음). default(풀밭)·desert·snow 는 그림 작업자가 변형을 넣는다. */
export const MONSTER_TITLE_ART_IDS: Readonly<Record<MonsterTitleTheme, string>> = {
  default: 'oprn_emerald_title_meadow',
  coast: 'oprn_emerald_title_stag',
  desert: 'oprn_emerald_title_desert',
  snow: 'oprn_emerald_title_snow',
};

interface TitleVariant { readonly asset: UploadedAsset; readonly effects?: TitleEffect[] }

// ── 그림 작업자가 채우는 곳 ─────────────────────────────────────────────
// 예) import desertTitle from '../../public/assets/emerald-monster/title-desert-asset.json';
//     desert: { asset: desertTitle as UploadedAsset },
// 파일 이름: default → title-meadow-asset.json, desert → title-desert-asset.json, snow → title-snow-asset.json. coast 는 넣지 않는다(사슴 그림).
const VARIANTS: Partial<Record<Exclude<MonsterTitleTheme, 'coast'>, TitleVariant>> = {
};
// ────────────────────────────────────────────────────────────────────

/** 사슴·해안 그림의 이미지 좌표에 맞춘 효과(빛줄기 원점·물결 영역). 다른 그림에 그대로 쓰면 엉뚱한 곳이 반짝인다. */
export function createStagTitleEffects(): TitleEffect[] {
  return [
    { kind: 'godRays', intensity: 0.24, speed: 0.3, color: '#ffe8ab', source: [0.44, 0.65], toward: [0.66, 0.12], spread: 0.38 },
    { kind: 'water', intensity: 0.32, speed: 0.45, color: '#b8fff1', region: [[0, 0.7], [0.62, 0.7], [0.53, 0.88], [0.35, 1], [0, 0.91]] },
    { kind: 'dapple', intensity: 0.2, speed: 0.35, region: [[0.61, 0.84], [0.96, 0.89], [1, 1], [0.46, 1]] },
    { kind: 'motes', intensity: 0.35, speed: 0.32, color: '#f9ffd3', count: 12, region: [[0.59, 0.1], [0.95, 0.1], [0.97, 0.65], [0.62, 0.7]] },
    { kind: 'glow', intensity: 0.22, speed: 0.4, color: '#f6ffbd', source: [0.93, 0.055], spread: 0.06 },
    { kind: 'parallax', intensity: 0.12, speed: 0.25 },
  ];
}

/** 그림 좌표를 모르는 변형 그림용 — 화면 전체에 옅은 티끌과 시차만. */
const NEUTRAL_EFFECTS: Readonly<Record<Exclude<MonsterTitleTheme, 'coast'>, TitleEffect[]>> = {
  default: [{ kind: 'motes', intensity: 0.28, speed: 0.3, color: '#f9ffd3', count: 10, region: [[0, 0], [1, 0], [1, 0.7], [0, 0.7]] }, { kind: 'parallax', intensity: 0.1, speed: 0.25 }],
  desert: [{ kind: 'motes', intensity: 0.3, speed: 0.45, color: '#ffe2a8', count: 12, region: [[0, 0.3], [1, 0.3], [1, 1], [0, 1]] }, { kind: 'parallax', intensity: 0.1, speed: 0.25 }],
  snow: [{ kind: 'motes', intensity: 0.4, speed: 0.22, color: '#ffffff', count: 16, region: [[0, 0], [1, 0], [1, 1], [0, 1]] }, { kind: 'parallax', intensity: 0.1, speed: 0.25 }],
};

/** build_monster_game 의 startTheme(meadow|desert|snow|coast) → 타이틀 테마. */
export function monsterTitleThemeFromStart(startTheme: string | undefined): MonsterTitleTheme {
  return startTheme === 'coast' || startTheme === 'desert' || startTheme === 'snow' ? startTheme : 'default';
}

/**
 * 이미 만든 캠페인의 테마(보수 때 쓴다): 지금 타이틀이 변형 그림이면 그 테마, 아니면 시작 맵 풍경
 * (monster_coast 시트 → coast, monster_climate 시트의 눈밭/사막 모래 바닥 → snow/desert).
 */
export function monsterTitleThemeOf(project: Project): MonsterTitleTheme {
  const current = project.system.titleScreen?.backgroundResourceId;
  // 사슴 그림은 coast 이자 모든 테마의 대체 그림이라 id 만으로 테마를 정하지 않는다.
  const byId = MONSTER_TITLE_THEMES.find(theme => theme !== 'coast' && MONSTER_TITLE_ART_IDS[theme] === current);
  if (byId) return byId;
  const map = project.maps[project.startMapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset) return 'default';
  if (tileset.id === 'monster_coast') return 'coast';
  if (tileset.id !== 'monster_climate') return 'default';
  let snow = 0, sand = 0;
  for (const tile of map.lowerTiles) {
    const label = tileset.tileMeta?.[tile]?.label;
    if (label === '눈밭') snow++;
    else if (label === '사막 모래') sand++;
  }
  return snow > sand ? 'snow' : sand > 0 ? 'desert' : 'default';
}

/** 테마의 그림과 효과. 변형 그림이 없으면 사슴 그림으로 돌아간다(돌려준 theme 은 실제로 쓴 그림 = 'coast'). */
export function monsterTitleArt(theme: MonsterTitleTheme): { theme: MonsterTitleTheme; asset: UploadedAsset; effects: TitleEffect[] } {
  const variant = theme === 'coast' ? undefined : VARIANTS[theme];
  if (theme !== 'coast' && variant && variant.asset?.id === MONSTER_TITLE_ART_IDS[theme] && typeof variant.asset.dataUrl === 'string' && variant.asset.dataUrl) {
    return { theme, asset: variant.asset, effects: variant.effects ?? NEUTRAL_EFFECTS[theme].map(e => ({ ...e })) };
  }
  return { theme: 'coast', asset: stagArtwork as UploadedAsset, effects: createStagTitleEffects() };
}
