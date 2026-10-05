import { charsetFrameSource } from '@/assets/easyrpgRtp';
import type { RgbaImage } from '@/editor/cutsceneArt/imageProcess';

export interface CharsetPreviewCandidate {
  readonly selectionId: string;
  readonly textureKey: string;
  readonly characterIndex: number;
  readonly label: string;
}

/** Only the candidates in this response are pictured, in the same order. */
export function charsetPreviewCandidates(toolName: string, data: unknown): CharsetPreviewCandidate[] {
  if (toolName !== 'list_npc_graphics' && toolName !== 'list_resources') return [];
  const matches = (data as { matches?: unknown } | undefined)?.matches;
  if (!Array.isArray(matches)) return [];
  return matches.flatMap((value): CharsetPreviewCandidate[] => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    const selectionId = typeof row.selectionId === 'string' ? row.selectionId : row.id;
    const parsed = typeof selectionId === 'string' ? /^charset:(.+):(\d+)$/u.exec(selectionId) : null;
    if (!parsed) return [];
    const characterIndex = Number(parsed[2]);
    if (!Number.isInteger(characterIndex) || characterIndex < 0 || characterIndex > 7) return [];
    return [{ selectionId: selectionId as string, textureKey: parsed[1]!, characterIndex, label: String(row.label ?? '') }];
  }).slice(0, 50);
}

const DIGITS = ['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001',
  '111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];

/** Numbered contact sheet, nearest-neighbour pixels; no synthesized artwork. */
export function drawCharsetPreview(candidates: readonly CharsetPreviewCandidate[], load: (id: string) => RgbaImage): RgbaImage {
  if (!candidates.length) throw new Error('캐릭터 칩 미리보기 후보가 없습니다.');
  // The render reply protocol accepts at most 512px per side. Keep every
  // pictured candidate in that envelope, including a full 50-item browse page.
  const compact = candidates.length > 9;
  const cols = Math.min(compact ? 9 : 3, candidates.length);
  const cellW = compact ? 56 : 112, cellH = compact ? 80 : 154, scale = compact ? 2 : 4;
  const insetX = compact ? 4 : 8, insetY = compact ? 14 : 22, numberY = compact ? 2 : 6;
  const width = cols * cellW, height = Math.ceil(candidates.length / cols) * cellH;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = 35; data[i + 1] = 39; data[i + 2] = 48; data[i + 3] = 255; }
  candidates.forEach((candidate, index) => {
    const sheet = load(candidate.textureKey);
    const source = charsetFrameSource({ characterIndex: candidate.characterIndex, direction: 'down', pattern: 1 });
    if (sheet.width !== 288 || sheet.height !== 256) throw new Error(`캐릭터 칩 시트 규격이 다릅니다: ${candidate.textureKey}`);
    const ox = (index % cols) * cellW, oy = Math.floor(index / cols) * cellH;
    // RTP colour keys match the runtime's top-left key; alpha sheets retain their alpha.
    const hasAlpha = sheet.data.some((value, i) => i % 4 === 3 && value < 255);
    for (let y = 0; y < source.height * scale; y++) for (let x = 0; x < source.width * scale; x++) {
      const si = ((source.y + Math.floor(y / scale)) * sheet.width + source.x + Math.floor(x / scale)) * 4;
      const keyed = !hasAlpha && [0, 1, 2].every(c => sheet.data[si + c] === sheet.data[c]);
      const alpha = keyed ? 0 : sheet.data[si + 3]! / 255;
      const di = ((oy + insetY + y) * width + ox + insetX + x) * 4;
      for (let c = 0; c < 3; c++) data[di + c] = sheet.data[si + c]! * alpha + data[di + c]! * (1 - alpha);
    }
    String(index + 1).split('').forEach((digit, place) => {
      const pixels = DIGITS[Number(digit)]!;
      for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (pixels[y * 3 + x] === '1') {
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const di = ((oy + numberY + y * 2 + dy) * width + ox + insetX + place * 8 + x * 2 + dx) * 4;
          data[di] = data[di + 1] = data[di + 2] = 245;
        }
      }
    });
  });
  return { width, height, data };
}
