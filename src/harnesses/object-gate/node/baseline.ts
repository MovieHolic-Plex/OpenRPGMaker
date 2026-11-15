/**
 * 시트 칸 관문의 기준선(baseline-cells.txt)을 만든다 — `npm run harness -- object-gate baseline`. 파일을 손으로 쓰지 않는다.
 *
 * 기준선 = **기준선 커밋의 번들 시트에 이미 실려 있던 칸**(감독 결정 2026-11-15. 감독이 전한 오너의 말 — 스토어 관문 정책을 감독에게 맡겼다:
 * 「스토어는 니가 좀 알아서해라.... 거절이 너무 빡센게 문젠거같은데 흠 .... Fable 이 만든거는 좀 쉽게 통과시키고싶음.」).
 *   - 기준선 커밋: 86a9e1931 (main, 2026-11-15 19:16 UTC = 2026-11-16 04:16 KST, #4723). 이 커밋은 고정이다 — 인자로 바꾸지 못한다.
 *   - 까닭: 그 칸들은 이미 편집기 번들로 사용자에게 나가 있다. 같은 그림을 스토어에서만 막는 것은 얻는 것이 없다.
 *   - 기준선에서 빼는 것: 오너 면제 묶음(그 커밋의 harness-data/object-gate/waivers/*.json)에 든 칸 — 그 칸은 면제 규칙으로 간다
 *     (Fable 묶음은 store 를 넓히면 통과, Fable 이 아닌 묶음은 그대로 막힌다).
 *   - 서명된 사람 거절·보정된 Opus 불합격이 붙은 그림의 칸은 파일에서 빼지 않고 **출구에서** 막는다(cells.ts blockedCellIndex) —
 *     기준선을 만든 뒤에 생긴 거절도 막히고, 서명 열쇠가 없는 상자에서 만든 파일과 있는 상자에서 만든 파일이 같다.
 *   - 그 뒤로 번들에 들어오는 새 칸은 기준선이 아니다: 관문 통과이거나 store 가 열린 Fable 면제여야 스토어로 나간다.
 *   - 읽는 시트: 스토어 게시기가 싣는 번들 시트 여섯 장(scripts/store/seedBundles.mts SEED_BUNDLES 의 sheet 다섯 + 건물 검수 프로필 beodeul 의
 *     chipset.png). 게시기에 시트를 더해도 여기에는 더하지 않는다 — 그 시트의 칸은 기준선 커밋 뒤의 새 칸이다.
 * 처음 안(같은 날, 이 PR 의 앞 커밋): 관문이 들어온 커밋 06ddfcda5(#2404, 2026-10-09) 바로 앞 95d11925f 의 시트만 기준선으로 했다. 그러면 Fable 묶음을
 *   넓혀도 다섯 팩이 거절됐다(관문 도입 뒤 번들에 들어온 판정 기록 없는 칸 — 버들항 13516 · 일본 도시 8669 · 조선 4550 · 실내 1219 · 마법 학교 32)라서 바꿨다.
 * 칸 크기는 16(STORE_TILE_SIZE — 여섯 장 모두 16px 타일셋). 같은 커밋이면 언제 어느 상자에서 만들어도 같은 파일이 나온다.
 * 얕은 복제(CI 의 depth 1)에는 그 커밋이 없을 수 있다 — 전체 기록이 있는 체크아웃에서 돌린다.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';
import { BASELINE_FILE, sheetCells } from './cells';

/** 기준선을 읽는 커밋(main, 2026-11-15). 고정이다. */
export const BASELINE_COMMIT = '86a9e19313d6967f4d9dd792212bec1ce07da97d';
export const BASELINE_COMMIT_DATE = '2026-11-15';
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
/** 기준선 커밋에서 오너 면제 묶음을 읽는 폴더(저장소 경로). */
export const BASELINE_WAIVER_DIR = 'harness-data/object-gate/waivers';

export type BaselineSheet = { path: string; cells: number; waived: number; fresh: number } | { path: string; missing: true };

/**
 * 시트 PNG 들의 비지 않은 칸 해시를 모은다(순수 — git 을 읽지 않는다). png 가 null 이면 그 커밋에 없던 시트다.
 * exclude = 오너 면제 묶음의 칸 해시 — 기준선에 넣지 않는다(시트마다 몇 칸이 빠졌는지 waived 로 센다).
 */
export function baselineFromSheets(sheets: ReadonlyArray<{ path: string; png: Uint8Array | null }>, exclude: ReadonlySet<string> = new Set(), tileSize = BASELINE_TILE_SIZE): { hashes: string[]; sheets: BaselineSheet[] } {
  const all = new Set<string>();
  const report: BaselineSheet[] = [];
  for (const sheet of sheets) {
    if (!sheet.png) { report.push({ path: sheet.path, missing: true }); continue; }
    const image = PNG.sync.read(Buffer.from(sheet.png));
    const cells = sheetCells(image.width, image.height, new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.length), tileSize);
    let fresh = 0, waived = 0;
    for (const cell of cells) {
      if (exclude.has(cell.hash)) { waived += 1; continue; }
      if (!all.has(cell.hash)) { all.add(cell.hash); fresh += 1; }
    }
    report.push({ path: sheet.path, cells: cells.length, waived, fresh });
  }
  return { hashes: [...all].sort(), sheets: report };
}

/** 오너 면제 묶음 글(JSON)들에서 그 칸 크기의 칸 해시를 모은다(순수). 읽지 못하는 글은 건너뛴다. */
export function waiverCellHashes(batchTexts: readonly string[], tileSize = BASELINE_TILE_SIZE): { hashes: Set<string>; batches: number } {
  const hashes = new Set<string>();
  let batches = 0;
  for (const text of batchTexts) {
    let batch: { schema?: string; items?: Array<{ cells?: Record<string, string[]> }> };
    try { batch = JSON.parse(text); } catch { continue; }
    if (batch?.schema !== 'oprn-object-gate-owner-waiver/1' || !Array.isArray(batch.items)) continue;
    batches += 1;
    for (const item of batch.items) for (const hash of item?.cells?.[String(tileSize)] ?? []) hashes.add(hash);
  }
  return { hashes, batches };
}

/** baseline-cells.txt 의 글. `#` 줄은 설명이다(readBaseline 은 16자 해시 줄만 읽는다). */
export function baselineFileText(hashes: readonly string[], sheets: readonly BaselineSheet[], waivers: { batches: number; hashes: number } = { batches: 0, hashes: 0 }): string {
  const head = [
    '# 시트 칸 관문의 기준선 — 기준선 커밋의 번들 시트에 이미 실려 있던 칸. `npm run harness -- object-gate baseline` 이 만든다(손으로 고치지 않는다).',
    `# 기준선 커밋 ${BASELINE_COMMIT} (main, ${BASELINE_COMMIT_DATE}) 의 시트에서 읽었다. 칸 크기 ${BASELINE_TILE_SIZE}. 그 뒤로 번들에 들어오는 칸은 기준선이 아니다.`,
    `# 뺀 것: 그 커밋의 오너 면제 묶음 ${waivers.batches}개에 든 칸(해시 ${waivers.hashes}개) — 면제 규칙으로 간다. 사람 거절·Opus 불합격이 붙은 그림의 칸은 출구에서 막는다.`,
    ...sheets.map(s => 'missing' in s ? `#   ${s.path}: 그 커밋에 없다` : `#   ${s.path}: 비지 않은 칸 ${s.cells} · 면제 묶음의 칸이라 뺀 것 ${s.waived} · 새로 더한 해시 ${s.fresh}`),
    `# 해시 ${hashes.length}개`,
  ];
  return `${[...head, ...hashes].join('\n')}\n`;
}

/** git 기록에서 기준선 커밋의 시트·면제 묶음을 읽어 baseline-cells.txt 를 쓴다. 그 커밋이 없으면(얕은 복제) 던진다. */
export function writeBaseline(cwd = process.cwd()): { path: string; hashes: number; sheets: BaselineSheet[]; waivers: { batches: number; hashes: number } } {
  const git = (args: string[]): Buffer => execFileSync('git', args, { cwd, maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  try { git(['cat-file', '-e', `${BASELINE_COMMIT}^{commit}`]); } catch { throw Error(`기준선 커밋 ${BASELINE_COMMIT.slice(0, 9)} 이 이 체크아웃에 없다 — git fetch origin main(얕은 복제면 --unshallow) 뒤에 다시 돌려라`); }
  const sheets = BASELINE_SHEETS.map(path => {
    try { return { path, png: new Uint8Array(git(['show', `${BASELINE_COMMIT}:${path}`])) }; } catch { return { path, png: null }; }
  });
  const waiverFiles = git(['ls-tree', '--name-only', BASELINE_COMMIT, `${BASELINE_WAIVER_DIR}/`]).toString('utf8').split('\n').filter(name => name.endsWith('.json')).sort();
  const waived = waiverCellHashes(waiverFiles.map(name => git(['show', `${BASELINE_COMMIT}:${name}`]).toString('utf8')));
  const built = baselineFromSheets(sheets, waived.hashes);
  const waivers = { batches: waived.batches, hashes: waived.hashes.size };
  mkdirSync(dirname(BASELINE_FILE), { recursive: true });
  writeFileSync(BASELINE_FILE, baselineFileText(built.hashes, built.sheets, waivers));
  return { path: BASELINE_FILE, hashes: built.hashes.length, sheets: built.sheets, waivers };
}
