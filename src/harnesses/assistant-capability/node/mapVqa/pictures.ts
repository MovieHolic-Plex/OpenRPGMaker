// map-vqa 의 그림(모델 없음): ① 깨끗한 1배 그림(플레이어가 보는 모습 — 편집기 표식 없음) ② 정수 배로 키운 4분면
// ③ 사실 표시 그림(막힌 칸 붉은 막 · 출구/사람/물건/적/안 보이는 이벤트 번호표 · 5칸 눈금) ④ 보고서용 결함 표시 그림.
import { PNG } from 'pngjs';
import type { GameMap, Project } from '../../../../project/types';
import { magnify } from '../visualJudge';
import { cropPng, renderLook, type Raster } from '../smallJobs/visualPictures';
import type { FactEvent, MapFacts } from './facts';

type Rgb = readonly [number, number, number];
// 3×5 도트 글자(숫자와 번호표 글자). 행마다 3비트.
const GLYPH: Record<string, number[]> = {
  '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [7, 1, 7, 4, 7], '3': [7, 1, 7, 1, 7], '4': [5, 5, 7, 1, 1], '5': [7, 4, 7, 1, 7], '6': [7, 4, 7, 5, 7], '7': [7, 1, 1, 1, 1], '8': [7, 5, 7, 5, 7], '9': [7, 5, 7, 1, 7],
  E: [7, 4, 7, 4, 7], P: [7, 5, 7, 4, 4], O: [7, 5, 5, 5, 7], F: [7, 4, 7, 4, 4], V: [5, 5, 5, 5, 2], S: [7, 4, 7, 1, 7],
};

class Canvas {
  readonly data: Buffer;
  constructor(readonly width: number, readonly height: number, fill: Rgb = [24, 24, 28]) {
    this.data = Buffer.alloc(width * height * 4);
    for (let i = 0; i < this.data.length; i += 4) { this.data[i] = fill[0]; this.data[i + 1] = fill[1]; this.data[i + 2] = fill[2]; this.data[i + 3] = 255; }
  }
  blit(source: Raster, dx: number, dy: number, factor: number): void {
    for (let y = 0; y < source.height * factor; y += 1) for (let x = 0; x < source.width * factor; x += 1) {
      const tx = dx + x, ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) continue;
      const s = (Math.floor(y / factor) * source.width + Math.floor(x / factor)) * 4, d = (ty * this.width + tx) * 4;
      this.data[d] = source.data[s]!; this.data[d + 1] = source.data[s + 1]!; this.data[d + 2] = source.data[s + 2]!; this.data[d + 3] = 255;
    }
  }
  fill(x: number, y: number, w: number, h: number, rgb: Rgb, alpha = 1): void {
    for (let py = Math.max(0, y); py < Math.min(this.height, y + h); py += 1) for (let px = Math.max(0, x); px < Math.min(this.width, x + w); px += 1) {
      const d = (py * this.width + px) * 4;
      for (let c = 0; c < 3; c += 1) this.data[d + c] = Math.round(rgb[c]! * alpha + this.data[d + c]! * (1 - alpha));
    }
  }
  box(x: number, y: number, w: number, h: number, rgb: Rgb, thick = 2): void {
    this.fill(x, y, w, thick, rgb); this.fill(x, y + h - thick, w, thick, rgb); this.fill(x, y, thick, h, rgb); this.fill(x + w - thick, y, thick, h, rgb);
  }
  /** 어두운 받침 위에 도트 글자. 돌려주는 값 = 받침 너비. */
  text(x: number, y: number, value: string, scale: number, rgb: Rgb, plate: Rgb | null = [0, 0, 0]): number {
    const chars = [...value].filter(char => GLYPH[char]);
    const width = chars.length * 4 * scale + scale, height = 7 * scale;
    if (plate) this.fill(x, y, width, height, plate, 0.85);
    chars.forEach((char, index) => GLYPH[char]!.forEach((row, ry) => { for (let rx = 0; rx < 3; rx += 1) if (row & (4 >> rx)) this.fill(x + scale + (index * 4 + rx) * scale, y + scale + ry * scale, scale, scale, rgb); }));
    return width;
  }
  png(): Buffer { const image = new PNG({ width: this.width, height: this.height }); image.data = this.data; return PNG.sync.write(image); }
}

export type MapPictures = { raster: Raster; pad: number; clean: Buffer; tile: number };
/** 깨끗한 1배 그림. 높이 지형이 위로 넓힌 여백(pad)은 잘라 낸다 — 칸 좌표가 그림과 바로 맞게. */
export function cleanPicture(project: Project, map: GameMap, tile: number): MapPictures {
  const raster = renderLook(project, map), pad = Math.max(0, raster.height - map.height * tile);
  return { raster, pad, clean: cropPng(raster, { x: 0, y: 0, w: map.width, h: map.height }, tile, pad), tile };
}

/** 검수자가 자세히 보는 그림: 작은 맵은 통째로 키운 한 장, 큰 맵은 2칸 겹친 4분면을 각각 키운 넉 장. */
export function detailPictures(pictures: MapPictures, map: { width: number; height: number }): Array<{ label: string; png: Buffer }> {
  const { tile } = pictures, limit = 1280;
  const whole = Math.floor(limit / (Math.max(map.width, map.height) * tile));
  if (whole >= 3) return [{ label: `Whole map magnified ${Math.min(4, whole)}x`, png: magnify(pictures.clean, Math.min(4, whole)) }];
  const halfW = Math.ceil(map.width / 2) + 1, halfH = Math.ceil(map.height / 2) + 1;
  const out: Array<{ label: string; png: Buffer }> = [];
  for (const [name, x, y] of [['NW (top-left)', 0, 0], ['NE (top-right)', map.width - halfW, 0], ['SW (bottom-left)', 0, map.height - halfH], ['SE (bottom-right)', map.width - halfW, map.height - halfH]] as const) {
    const rect = { x, y, w: halfW, h: halfH }, factor = Math.max(2, Math.min(4, Math.floor(limit / (Math.max(halfW, halfH) * tile))));
    out.push({ label: `Quadrant ${name}: cells x=${x}..${x + halfW - 1}, y=${y}..${y + halfH - 1}, magnified ${factor}x`, png: magnify(cropPng(pictures.raster, rect, tile, pictures.pad), factor) });
  }
  return out;
}

const COLOR: Record<FactEvent['kind'] | 'start', Rgb> = { exit: [40, 130, 255], person: [255, 214, 0], object: [0, 225, 225], foe: [255, 70, 70], invisible: [255, 0, 255], start: [60, 230, 110] };
const MARGIN = 16;
/** 사실 표시 그림: 막힌 칸에 붉은 막, 이벤트 번호표, 5칸마다 눈금과 칸 번호. 판정이 아니라 문서에서 읽은 사실만 그린다. */
export function factsPicture(pictures: MapPictures, facts: MapFacts): Buffer {
  const { tile } = pictures, k = facts.width * tile * 2 + MARGIN <= 1568 && facts.height * tile * 2 + MARGIN <= 1568 ? 2 : 1, cell = tile * k;
  const canvas = new Canvas(facts.width * cell + MARGIN, facts.height * cell + MARGIN);
  const clean = PNG.sync.read(pictures.clean);
  canvas.blit({ width: clean.width, height: clean.height, data: clean.data }, MARGIN, MARGIN, k);
  for (const blockedCell of facts.blocked) {
    const [x, y] = blockedCell.split(',').map(Number);
    canvas.fill(MARGIN + x! * cell, MARGIN + y! * cell, cell, cell, [255, 0, 0], 0.28);
    // 붉은 벽·지붕 위에서도 막힌 칸이 읽히게 빗금을 더한다.
    for (let i = 0; i < cell; i += 1) for (let j = (i % 6); j < cell; j += 6) canvas.fill(MARGIN + x! * cell + j, MARGIN + y! * cell + i, 1, 1, [120, 0, 0], 0.7);
  }
  for (let x = 0; x <= facts.width; x += 5) { canvas.fill(MARGIN + x * cell, MARGIN, 1, facts.height * cell, [255, 255, 255], 0.35); if (x < facts.width) canvas.text(MARGIN + x * cell + 1, 1, String(x), 2, [255, 255, 255], null); }
  for (let y = 0; y <= facts.height; y += 5) { canvas.fill(MARGIN, MARGIN + y * cell, facts.width * cell, 1, [255, 255, 255], 0.35); if (y < facts.height) canvas.text(0, MARGIN + y * cell + 1, String(y), y >= 100 ? 1 : 2, [255, 255, 255], null); }
  const mark = (x: number, y: number, tag: string, rgb: Rgb) => {
    canvas.box(MARGIN + x * cell, MARGIN + y * cell, cell, cell, rgb, Math.max(2, k));
    const width = tag.length * 8 + 2, tx = Math.min(canvas.width - width, MARGIN + x * cell), ty = MARGIN + y * cell - 14 >= MARGIN ? MARGIN + y * cell - 14 : MARGIN + (y + 1) * cell;
    canvas.text(tx, ty, tag, 2, rgb);
  };
  if (facts.start) mark(facts.start.x, facts.start.y, 'S', COLOR.start);
  for (const event of facts.events) mark(event.x, event.y, event.tag, COLOR[event.kind]);
  return canvas.png();
}
export const FACTS_LEGEND = 'FACTS picture legend (facts read from the saved map, not verdicts): red-tinted cells = BLOCKED (cannot be walked on); untinted = walkable. Boxes with tags: blue E# = exit (map transfer), yellow P# = person, cyan O# = visible object event, red F# = roaming foe, magenta V# = INVISIBLE event that shows text, green S = game start cell. White grid lines every 5 cells; numbers on the top and left margins are cell coordinates (x across, y down, origin top-left).';

export type MarkedDefect = { index: number; severity: 'blocker' | 'major' | 'polish'; region: { x: number; y: number; w: number; h: number } };
const SEVERITY_COLOR: Record<MarkedDefect['severity'], Rgb> = { blocker: [255, 40, 40], major: [255, 150, 0], polish: [255, 235, 60] };
/** 보고서용: 1배 그림 위에 결함 영역을 번호 상자로 표시한다(빨강 blocker · 주황 major · 노랑 polish). */
export function markedPicture(pictures: MapPictures, map: { width: number; height: number }, defects: MarkedDefect[]): Buffer {
  const { tile } = pictures, clean = PNG.sync.read(pictures.clean);
  const canvas = new Canvas(clean.width, clean.height);
  canvas.blit({ width: clean.width, height: clean.height, data: clean.data }, 0, 0, 1);
  for (const defect of [...defects].sort((a, b) => b.region.w * b.region.h - a.region.w * a.region.h)) {
    const x = Math.max(0, Math.min(map.width - 1, defect.region.x)), y = Math.max(0, Math.min(map.height - 1, defect.region.y));
    const w = Math.max(1, Math.min(map.width - x, defect.region.w)), h = Math.max(1, Math.min(map.height - y, defect.region.h));
    canvas.box(x * tile, y * tile, w * tile, h * tile, SEVERITY_COLOR[defect.severity], 2);
    canvas.text(x * tile, y * tile, String(defect.index), 2, SEVERITY_COLOR[defect.severity]);
  }
  return canvas.png();
}
