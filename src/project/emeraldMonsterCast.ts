import type { GameEvent, GameMap, Project } from './types';

/**
 * 몬스터 수집 캠페인의 테마(사막·눈·해안) 주민·조련사 걷기 칩 배선.
 *
 * 역사: 에메랄드 캠페인 전용 필드 인물·조련사 그림(cast-*, theme-cast-v1)은 저작권 정리(2026-10-07)로 지웠다 — 원작 걷기 그림을
 * 판형으로 고친 것이라 공개 저장소에 둘 수 없다. 그 뒤로 테마와 무관하게 캠페인이 처음 깐 기본 걷기 칩(People1)이 남았다.
 *
 * 지금 계약(2026-10-14):
 * - THEME_CASTS 는 테마 → 역할 → 설치된 걷기 칩(리소스 id·칸)이다. **사용자가 후보를 Allow 하고 그 판본을 공용 팩으로 설치한 뒤에만**
 *   여기에 항목을 더한다. 조수·감독자·에이전트가 대신 Allow 하거나, Allow 없이 항목을 더하지 않는다.
 * - 항목이 없거나, 항목의 그림이 이 프로젝트(업로드 자산)에 실제로 없으면 기본 칩을 그대로 둔다(조용한 대체 — 깨진 그림을 깔지 않는다).
 * - 새 그림은 원작 판형을 쓰지 않은 독자 도트여야 한다(charset-actor 하네스처럼 원본 격자 직접 저작 → 결손 검사 → 사람 남기기).
 *   pokemon-character-casting 의 theme-cast-v1 후보는 원작 판형 파생이라 공개본에 들일 수 없다.
 */
export type CastTheme = 'desert' | 'snow' | 'coast';
export type CastRole = 'resident_m' | 'resident_f' | 'trainer';
/** 칩 그림: 공용 번들 칩셋(bundled) 또는 프로젝트 업로드 자산(uploaded)과 그 안의 칸(pattern). */
export interface CastChip { readonly source: 'bundled' | 'uploaded'; readonly resourceId: string; readonly pattern: number }

/** 설치된(사용자 Allow 를 받은) 테마 걷기 칩. 비어 있으면 모든 테마가 기본 칩을 쓴다. */
export const THEME_CASTS: Readonly<Partial<Record<CastTheme, Partial<Record<CastRole, CastChip>>>>> = {
};

/** 테마 칩을 입히는 맵: 시작 마을, 그 마을과 같은 기후로 바꾼 둘째 마을(사막→모래종, 눈→서리꽃), 첫 도로. */
const THEME_MAPS: Readonly<Record<CastTheme, readonly string[]>> = {
  desert: ['mx_map_home', 'mx_map_dune', 'mx_map_meadow'],
  snow: ['mx_map_home', 'mx_map_frost', 'mx_map_meadow'],
  coast: ['mx_map_home', 'mx_map_meadow'],
};

/** 주민(마을 이벤트 _local·_ambient_resident_N·_guide)과 도로 조련사(_trainer_N)의 역할. 그 밖(박사·관장·간호사·상인)은 손대지 않는다. */
export function castRoleOf(event: GameEvent): CastRole | null {
  if (/_trainer_\d+$/.test(event.id)) return 'trainer';
  const resident = /_(local|guide)$/.test(event.id) ? 0 : Number(/_ambient_resident_(\d+)$/.exec(event.id)?.[1] ?? NaN);
  if (Number.isNaN(resident)) return null;
  return resident % 2 ? 'resident_f' : 'resident_m';
}

/** 시작 마을 풍경 → 칩 테마. 생략하면 시작 맵 풍경에서 추정한다(보수 경로). */
function themeOf(project: Project, startTheme?: string): CastTheme | null {
  if (startTheme === 'desert' || startTheme === 'snow' || startTheme === 'coast') return startTheme;
  if (startTheme !== undefined) return null;
  const map = project.maps[project.startMapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset) return null;
  if (tileset.id === 'monster_coast') return 'coast';
  if (tileset.id !== 'monster_climate') return null;
  let snow = 0, sand = 0;
  for (const tile of map.lowerTiles) { const l = tileset.tileMeta?.[tile]?.label; if (l === '눈밭') snow++; else if (l === '사막 모래') sand++; }
  return snow > sand ? 'snow' : sand ? 'desert' : null;
}

function chipInstalled(project: Project, chip: CastChip): boolean {
  return chip.source === 'bundled' || !!project.assets.uploaded[chip.resourceId];
}

/**
 * 테마 주민·조련사에게 설치된 테마 칩을 입힌다. 바꾼 이벤트 id 와, 칩이 없어 기본 칩으로 둔 역할을 돌려준다(보고·검수용).
 * 걷기 그림만 바꾼다 — 위치·대사·이동 경로·전투는 그대로다.
 */
export function configureEmeraldMonsterCast(project: Project, options: { readonly startTheme?: string } = {}): { theme: CastTheme | null; changed: string[]; fallback: CastRole[] } {
  const theme = themeOf(project, options.startTheme);
  if (!theme) return { theme, changed: [], fallback: [] };
  const table = THEME_CASTS[theme] ?? {};
  const fallback = (['resident_m', 'resident_f', 'trainer'] as const).filter(role => !table[role] || !chipInstalled(project, table[role]!));
  const changed: string[] = [];
  for (const mapId of THEME_MAPS[theme]) {
    const map: GameMap | undefined = project.maps[mapId];
    for (const event of map?.events ?? []) {
      const role = castRoleOf(event);
      const chip = role ? table[role] : undefined;
      if (!role || !chip || fallback.includes(role)) continue;
      for (const page of event.pages ?? []) {
        if (!page.graphic.sprite) continue;
        page.graphic = { ...page.graphic, sprite: { type: chip.source, id: chip.resourceId }, pattern: chip.pattern };
      }
      changed.push(event.id);
    }
  }
  return { theme, changed, fallback };
}
