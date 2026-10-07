import type { Project } from './types';

/** 에메랄드 캠페인 전용 필드 인물·조련사 그림(cast-*, theme-cast)은 저작권 정리(2026-10-07)로 지웠다.
 *  그 그림으로 갈아 끼우던 일을 하지 않고, 캠페인이 처음 깐 기본 걷기 칩을 그대로 둔다. 호출부 계약만 남긴다. */
export function configureEmeraldMonsterCast(_project: Project, _options: { readonly startTheme?: string } = {}): void {}
