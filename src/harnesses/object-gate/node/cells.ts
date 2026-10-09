/**
 * 시트 칸 관문(노드). 기물이 메타데이터 없이 시트에 그냥 붙어 들어오는 길까지 막는다.
 *
 * 칸 해시 = sha256(`cell${칸크기}:` + 칸 RGBA(완전 투명 화소 RGB→0)) 앞 16자. 빈 칸은 세지 않는다.
 * 시트의 비지 않은 칸은 셋 중 하나여야 한다:
 *   ① 기준선(baseline-cells.txt) — 관문 도입 시점(2026-10-09)에 이미 번들·공용 DB 에 있던 칸(소급 면제, 감사 보고서만)
 *   ② 출구 규칙을 통과한 영수증의 칸 — 영수증은 판정한 원본 PNG 를 칸으로 자른 해시를 들고 있다(정렬 변형 포함)
 *   ③ 둘 다 아니면 거절.
 * 지형 조각도 같다 — kind terrain 으로 판정받는다(판정자 과반이 「서 있는 기물이 아니라 지형」이라 해야 한다).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { objectGateRefusal, type ObjectGateContext, type ObjectGateReceipt } from '../../_core/objectGate';
import { GATE_DATA, calibratedProfiles, listReceipts } from './store';

export const CELL_SIZES = [16, 24, 32, 48] as const;
export const BASELINE_FILE = resolve(GATE_DATA, 'baseline-cells.txt');

export function cellHash(tileSize: number, rgba: Uint8Array): string | null {
  let any = false;
  const copy = new Uint8Array(rgba);
  for (let i = 0; i < copy.length; i += 4) {
    if (copy[i + 3] === 0) { copy[i] = 0; copy[i + 1] = 0; copy[i + 2] = 0; } else any = true;
  }
  if (!any) return null;
  return createHash('sha256').update(`cell${tileSize}:`).update(copy).digest('hex').slice(0, 16);
}

/** 이미지를 칸으로 잘라 칸 해시와 칸 위치를 낸다. ox·oy = 이미지를 칸 격자에 놓을 때 왼쪽·위 여백. */
export function sheetCells(width: number, height: number, data: Uint8Array, tileSize: number, ox = 0, oy = 0): Array<{ index: number; col: number; row: number; hash: string }> {
  const cols = Math.ceil((width + ox) / tileSize), rows = Math.ceil((height + oy) / tileSize);
  const out: Array<{ index: number; col: number; row: number; hash: string }> = [];
  const cell = new Uint8Array(tileSize * tileSize * 4);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    cell.fill(0);
    for (let y = 0; y < tileSize; y++) {
      const sy = row * tileSize + y - oy; if (sy < 0 || sy >= height) continue;
      for (let x = 0; x < tileSize; x++) {
        const sx = col * tileSize + x - ox; if (sx < 0 || sx >= width) continue;
        const s = (sy * width + sx) * 4, d = (y * tileSize + x) * 4;
        cell[d] = data[s]!; cell[d + 1] = data[s + 1]!; cell[d + 2] = data[s + 2]!; cell[d + 3] = data[s + 3]!;
      }
    }
    const hash = cellHash(tileSize, cell);
    if (hash) out.push({ index: row * cols + col, col, row, hash });
  }
  return out;
}

/** 판정한 원본 PNG 의 칸 해시 — 칸 크기 넷 × 정렬 변형(왼/가운데/오른 × 위/아래). 굽기가 여백을 어떻게 붙여도 맞는다. */
export function receiptCells(width: number, height: number, data: Uint8Array): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const ts of CELL_SIZES) {
    const rx = (ts - (width % ts)) % ts, ry = (ts - (height % ts)) % ts;
    const set = new Set<string>();
    for (const ox of new Set([0, Math.floor(rx / 2), rx])) for (const oy of new Set([0, ry])) for (const c of sheetCells(width, height, data, ts, ox, oy)) set.add(c.hash);
    out[String(ts)] = [...set].sort();
  }
  return out;
}

export function readBaseline(): Set<string> {
  return existsSync(BASELINE_FILE) ? new Set(readFileSync(BASELINE_FILE, 'utf8').split('\n').filter(l => /^[0-9a-f]{16}$/.test(l))) : new Set();
}

/** 출구 규칙을 통과한 영수증의 칸 해시 → 영수증. */
export function passingCellIndex(context: ObjectGateContext, receipts: ObjectGateReceipt[] = listReceipts()): Map<string, ObjectGateReceipt> {
  const calibrated = calibratedProfiles();
  const index = new Map<string, ObjectGateReceipt>();
  for (const receipt of receipts) {
    if (objectGateRefusal({ receipt, pixelSha256: receipt.pixelSha256, context, calibratedProfiles: calibrated })) continue;
    for (const hashes of Object.values(receipt.cells ?? {})) for (const h of hashes) index.set(h, receipt);
  }
  return index;
}

export type SheetGateProblem = { label: string; uncovered: Array<{ index: number; col: number; row: number; hash: string }> };

/** 시트 한 장 확인. 기준선에도 통과 영수증에도 없는 칸 목록(빈 배열 = 통과). */
export function uncoveredSheetCells(sheet: { width: number; height: number; data: Uint8Array; tileSize: number }, baseline: Set<string>, passing: Map<string, ObjectGateReceipt>) {
  return sheetCells(sheet.width, sheet.height, sheet.data, sheet.tileSize).filter(c => !baseline.has(c.hash) && !passing.has(c.hash));
}

export function describeSheetProblems(problems: SheetGateProblem[]): string {
  return problems.map(p => `${p.label}: 판정 영수증 없는 새 칸 ${p.uncovered.length}개 (예: ${p.uncovered.slice(0, 6).map(c => `#${c.index}(${c.col},${c.row})`).join(' ')})`).join('\n')
    + '\n→ 새 기물·지형 그림은 `npm run harness -- object-gate review` 로 3/4 시점 판정을 받아야 한다(openwiki/harnesses/object-gate.md).';
}
