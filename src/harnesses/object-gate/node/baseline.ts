/**
 * 시트 칸 관문의 기준선(baseline-cells.txt)을 만든다 — `npm run harness -- object-gate baseline`. 파일을 손으로 쓰지 않는다.
 *
 * 기준선 = 3/4 관문이 생기기 전부터 번들 시트에 있던 칸(소급 인정 — cells.ts 머리말 ①). 그 뒤에 들어온 칸은 기준선이 아니다.
 *   - 관문이 들어온 커밋: 06ddfcda5 «feat(object-gate): 공용 3/4 시점 오브젝트 게이트 판정 엔진 (리셋 복구, 출구 미배선) (#2404)», 2026-10-09 23:17 KST
 *     (`git log --diff-filter=A -- src/harnesses/object-gate/harness.ts` 의 첫 커밋).
 *   - 기준선을 읽는 커밋: 그 바로 앞(부모) 95d11925f, 2026-10-09 22:15 KST. 이 커밋은 고정이다 — 인자로 바꾸지 못한다.
 *   - 읽는 시트: 스토어 게시기가 싣는 번들 시트 여섯 장(scripts/store/seedBundles.mts SEED_BUNDLES 의 sheet 다섯 + 건물 검수 프로필 beodeul 의
 *     chipset.png). 여섯 장 모두 그 커밋에 있었다. 게시기에 시트를 더하면 여기에도 더하고 다시 만든다(그 커밋에 없던 시트는 건너뛴다 — 통째로 새 칸이다).
 * 칸 크기는 16(STORE_TILE_SIZE — 여섯 장 모두 16px 타일셋). 같은 커밋·같은 시트면 언제 만들어도 같은 파일이 나온다.
 * 얕은 복제(CI 의 depth 1)에는 그 커밋이 없다 — 전체 기록이 있는 체크아웃에서 돌린다.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';
import { BASELINE_FILE, sheetCells } from './cells';

/** 관문이 들어온 커밋(#2404)과 그 바로 앞 커밋. 기준선은 뒤의 것에서만 읽는다. */
export const GATE_INTRODUCED_COMMIT = '06ddfcda5';
export const BASELINE_COMMIT = '95d11925f27010a00acfd7f62500b36664bae6d3';
export const BASELINE_TILE_SIZE = 16;
/** 스토어 게시기가 싣는 번들 시트(저장소 경로). seedBundles.mts SEED_BUNDLES · beodeul-building-review/profiles.json(beodeul) 과 맞춘다. */
export const BASELINE_SHEETS = [
  'public/assets/beodeul-city/beodeul-city-chipset.png',
  'public/assets/joseon-baram/joseon-baram-chipset.png',
  'public/assets/atlas-interior/interior-chipset.png',
  'public/assets/jp-city/jp-city-chipset.png',
  'public/assets/wizarding-world/wizarding-world-chipset.png',
  'public/assets/beodeul-reviewed/chipset.png',
] as const;

export type BaselineSheet = { path: string; cells: number; fresh: number } | { path: string; missing: true };

/** 시트 PNG 들의 비지 않은 칸 해시를 모은다(순수 — git 을 읽지 않는다). png 가 null 이면 그 커밋에 없던 시트다. */
export function baselineFromSheets(sheets: ReadonlyArray<{ path: string; png: Uint8Array | null }>, tileSize = BASELINE_TILE_SIZE): { hashes: string[]; sheets: BaselineSheet[] } {
  const all = new Set<string>();
  const report: BaselineSheet[] = [];
  for (const sheet of sheets) {
    if (!sheet.png) { report.push({ path: sheet.path, missing: true }); continue; }
    const image = PNG.sync.read(Buffer.from(sheet.png));
    const cells = sheetCells(image.width, image.height, new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.length), tileSize);
    let fresh = 0;
    for (const cell of cells) if (!all.has(cell.hash)) { all.add(cell.hash); fresh += 1; }
    report.push({ path: sheet.path, cells: cells.length, fresh });
  }
  return { hashes: [...all].sort(), sheets: report };
}

/** baseline-cells.txt 의 글. `#` 줄은 설명이다(readBaseline 은 16자 해시 줄만 읽는다). */
export function baselineFileText(hashes: readonly string[], sheets: readonly BaselineSheet[]): string {
  const head = [
    '# 시트 칸 관문의 기준선 — 3/4 관문이 생기기 전부터 번들 시트에 있던 칸. `npm run harness -- object-gate baseline` 이 만든다(손으로 고치지 않는다).',
    `# 관문이 들어온 커밋 ${GATE_INTRODUCED_COMMIT} (#2404, 2026-10-09) 바로 앞 커밋 ${BASELINE_COMMIT} 의 시트에서 읽었다. 칸 크기 ${BASELINE_TILE_SIZE}.`,
    ...sheets.map(s => 'missing' in s ? `#   ${s.path}: 그 커밋에 없다` : `#   ${s.path}: 비지 않은 칸 ${s.cells} · 새로 더한 해시 ${s.fresh}`),
    `# 해시 ${hashes.length}개`,
  ];
  return `${[...head, ...hashes].join('\n')}\n`;
}

/** git 기록에서 기준선 커밋의 시트를 읽어 baseline-cells.txt 를 쓴다. 그 커밋이 없으면(얕은 복제) 던진다. */
export function writeBaseline(cwd = process.cwd()): { path: string; hashes: number; sheets: BaselineSheet[] } {
  const git = (args: string[]): Buffer => execFileSync('git', args, { cwd, maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  try { git(['cat-file', '-e', `${BASELINE_COMMIT}^{commit}`]); } catch { throw Error(`기준선 커밋 ${BASELINE_COMMIT.slice(0, 9)} 이 이 체크아웃에 없다 — 얕은 복제면 전체 기록을 받아라(git fetch --unshallow)`); }
  const sheets = BASELINE_SHEETS.map(path => {
    try { return { path, png: new Uint8Array(git(['show', `${BASELINE_COMMIT}:${path}`])) }; } catch { return { path, png: null }; }
  });
  const built = baselineFromSheets(sheets);
  mkdirSync(dirname(BASELINE_FILE), { recursive: true });
  writeFileSync(BASELINE_FILE, baselineFileText(built.hashes, built.sheets));
  return { path: BASELINE_FILE, hashes: built.hashes.length, sheets: built.sheets };
}
