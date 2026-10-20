import { emeraldOpeningBackdrop, type EmeraldOpeningBackdropId } from '@/assets/emeraldOpeningBackdrops';
import type { AnimaticKey, AnimaticLayer, OpeningAnimatic } from './openingAnimatic';

/**
 * 몬스터 수집(에메랄드 결) 오프닝의 6컷 레이어 애니메틱.
 * 별빛섬 맵을 구운 배경 위에 RPG Maker 2000 캐릭터 시트(24×32 칸, 12열 8인)와 64×64 몬스터 그림을 얹는다.
 * 무대 480×320 에서 모든 그림을 정확히 2배로 그린다 — 배경·캐릭터·몬스터 도트가 같은 크기로 보인다.
 */
export type EmeraldOpeningShot = EmeraldOpeningBackdropId;
export const EMERALD_OPENING_SHOTS: readonly EmeraldOpeningShot[] = ['dawn', 'route', 'lab', 'stage', 'gym', 'town'];
export const EMERALD_OPENING_SHOT_MS = 4500;

/** 컷에 등장하는 캐릭터 시트의 한 사람(몬스터 칩도 같은 시트 규격이다). */
export type EmeraldOpeningChip = { resourceId: string; index: number };
export type EmeraldOpeningCast = {
  hero: EmeraldOpeningChip;
  professor: EmeraldOpeningChip;
  rival: EmeraldOpeningChip;
  leader: EmeraldOpeningChip;
  /** 하늘을 나는 들몬스터 칩. */
  flyer: EmeraldOpeningChip;
  /** 풀숲에서 고개를 내미는 들몬스터 칩. */
  wild: EmeraldOpeningChip;
  /** 스타터 셋(풀·불꽃·물) — 64×64 정면 그림과 필드 칩. 없는 칸은 건너뛴다. */
  starters: readonly { frontResourceId: string; chip?: EmeraldOpeningChip }[];
};

const STAGE = { width: 480, height: 320 } as const;
const SCALE = 2;
const CELL = { width: 24, height: 32 } as const;
const SHEET = { frameWidth: CELL.width, frameHeight: CELL.height, columns: 12, count: 96, fps: 0 } as const;
const PERSON = { width: CELL.width * SCALE, height: CELL.height * SCALE } as const;
const MONSTER = 64 * SCALE;
const TILE = 16 * SCALE;
type Facing = 'up' | 'right' | 'down' | 'left';
const FACING_ROW: Record<Facing, number> = { up: 0, right: 1, down: 2, left: 3 };

/** 이벤트 그림의 pattern(시트 전체 프레임 번호, 아래 보기 가운데 발)을 시트 안 인물 번호로 바꾼다. */
export function charsetPatternIndex(pattern: number): number {
  return Math.floor(Math.floor(pattern / SHEET.columns) / 4) * 4 + Math.floor((pattern % SHEET.columns) / 3);
}

function stepFrames(chip: EmeraldOpeningChip, facing: Facing): readonly [number, number, number] {
  const base = (Math.floor(chip.index / 4) * 4 + FACING_ROW[facing]) * SHEET.columns + (chip.index % 4) * 3;
  return [base, base + 1, base + 2];
}

/** 타일 (tx, ty) 에 선 인물의 왼쪽 위 좌표(세계 px). 시트 칸은 타일보다 넓고 높아 아래·가운데를 맞춘다. */
const standAt = (tx: number, ty: number) => ({ x: tx * TILE + TILE / 2 - PERSON.width / 2, y: (ty + 1) * TILE - PERSON.height });

function backdrop(id: EmeraldOpeningShot): AnimaticLayer {
  const { resourceId, crop } = emeraldOpeningBackdrop(id);
  return { id: 'backdrop', kind: 'image', role: 'background', resourceId, sampling: 'nearest', x: 0, y: 0, width: crop.width * SCALE, height: crop.height * SCALE };
}

function standing(id: string, chip: EmeraldOpeningChip, facing: Facing, at: { x: number; y: number }, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  const frame = stepFrames(chip, facing)[1];
  return { id, kind: 'image', role: 'actor', resourceId: chip.resourceId, sampling: 'nearest', sheet: { ...SHEET }, x: at.x, y: at.y, width: PERSON.width, height: PERSON.height,
    ...extra, keys: { frame: [{ atMs: 0, value: frame }], ...extra.keys } };
}

/** 발걸음이 이동 거리에 맞물려 바뀌는 보행(반 타일마다 한 걸음). */
function walking(id: string, chip: EmeraldOpeningChip, facing: Facing, path: readonly { atMs: number; x: number; y: number }[], extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  const [left, stand, right] = stepFrames(chip, facing);
  const keys = (axis: 'x' | 'y'): AnimaticKey[] => path.map(point => ({ atMs: point.atMs, value: point[axis], ease: 'linear' }));
  return { id, kind: 'image', role: 'actor', resourceId: chip.resourceId, sampling: 'nearest', sheet: { ...SHEET }, x: path[0]!.x, y: path[0]!.y, width: PERSON.width, height: PERSON.height,
    walk: { stride: TILE / 2, frames: [stand, right, stand, left] }, ...extra, keys: { x: keys('x'), y: keys('y'), ...extra.keys } };
}

function emote(id: string, preset: 'exclaim' | 'question' | 'heart', over: { x: number; y: number }, atMs: number, endMs: number): AnimaticLayer {
  return { id, kind: 'emote', role: 'effect', x: over.x + PERSON.width / 2 - 16, y: over.y - 30, width: 32, height: 32, startMs: atMs, endMs, emote: { preset, tail: 'down', popMs: 160 } };
}

const shot = (layers: AnimaticLayer[], camera: OpeningAnimatic['camera'], background = '#0b1420'): OpeningAnimatic =>
  ({ width: STAGE.width, height: STAGE.height, background, layers, ...(camera ? { camera } : {}), transition: { kind: 'fade', durationMs: 400 } });

/** 별빛섬의 새벽: 바다에서 해변 마을로 올라가는 팬, 새벽빛이 걷히고 하늘엔 새 몬스터가 난다. */
function dawnShot(cast: EmeraldOpeningCast): OpeningAnimatic {
  const swallow: EmeraldOpeningChip = { resourceId: cast.flyer.resourceId, index: 1 };
  const flock: EmeraldOpeningChip = { resourceId: cast.flyer.resourceId, index: 3 };
  return shot([
    backdrop('dawn'),
    walking('swimmer', cast.starters[2]?.chip ?? cast.wild, 'left', [{ atMs: 0, x: 600, y: 800 }, { atMs: 4500, x: 440, y: 800 }]),
    { id: 'dawn-tint', kind: 'shape', shape: 'rect', role: 'effect', space: 'screen', color: '#ff9a5c', blend: 'multiply', x: 0, y: 0, width: STAGE.width, height: STAGE.height,
      keys: { opacity: [{ atMs: 0, value: 0.52 }, { atMs: 3600, value: 0, ease: 'ease-in-out' }] } },
    // 세 마리는 같은 빠르기(4.5초에 484px)로 비스듬히 줄지어 난다 — 빠르기가 다르면 뒤의 새가 앞의 새를 따라잡아 겹쳤다(2026-10-20 겹침 검사: 2.95초에 551px²).
    walking('flyer-a', cast.flyer, 'right', [{ atMs: 0, x: 40, y: 20 }, { atMs: 4500, x: 524, y: 4 }], { space: 'screen' }),
    walking('flyer-b', swallow, 'right', [{ atMs: 0, x: -36, y: 74 }, { atMs: 4500, x: 448, y: 58 }], { space: 'screen' }),
    walking('flyer-c', flock, 'right', [{ atMs: 0, x: -112, y: 128 }, { atMs: 4500, x: 372, y: 112 }], { space: 'screen' }),
  ], { x: 416, keys: { y: [{ atMs: 0, value: 860 }, { atMs: 4300, value: 250, ease: 'ease-in-out' }] } });
}

/** 1번길: 주인공이 길을 달려 올라가고, 옆 풀숲에서 들몬스터가 고개를 내민다(풀숲 두 줄을 앞에 다시 그려 몸을 가린다). */
function routeShot(cast: EmeraldOpeningCast): OpeningAnimatic {
  const route = emeraldOpeningBackdrop('route').resourceId;
  const peek = (id: string, chip: EmeraldOpeningChip, tx: number, ty: number, atMs: number): AnimaticLayer[] => {
    const rowTop = ty * TILE, x = tx * TILE + TILE / 2 - PERSON.width / 2, hidden = rowTop - 8, peeked = rowTop - 44;
    return [
      standing(id, chip, 'left', { x, y: hidden }, { keys: { y: [{ atMs: 0, value: hidden }, { atMs, value: hidden }, { atMs: atMs + 180, value: peeked - 8, ease: 'ease-out' }, { atMs: atMs + 320, value: peeked, ease: 'ease-in' }] } }),
      { id: id + '-grass', kind: 'image', role: 'foreground', resourceId: route, sampling: 'nearest', crop: { x: 176, y: rowTop / SCALE, width: 96, height: 32 }, x: 352, y: rowTop, width: 192, height: TILE * 2 },
      emote(id + '-emote', 'exclaim', { x, y: peeked }, atMs + 200, atMs + 1500),
    ];
  };
  const songbird: EmeraldOpeningChip = { resourceId: cast.flyer.resourceId, index: 2 };
  return shot([
    backdrop('route'),
    ...peek('wild-a', cast.starters[0]?.chip ?? cast.wild, 12, 27, 1100),
    ...peek('wild-b', cast.wild, 15, 29, 2000),
    walking('hero', cast.hero, 'up', [{ atMs: 0, x: 296, y: 960 }, { atMs: 4400, x: 296, y: 560 }]),
    walking('flyer-route', songbird, 'right', [{ atMs: 0, x: 40, y: 28 }, { atMs: 4500, x: 460, y: 18 }], { space: 'screen' }),
  ], { x: 400, keys: { y: [{ atMs: 0, value: 864 }, { atMs: 1200, value: 840 }, { atMs: 4400, value: 600, ease: 'ease-in' }] } });
}

/** 천문박사의 연구소: 문으로 들어선 주인공을 박사가 반긴다. */
function labShot(cast: EmeraldOpeningCast): OpeningAnimatic {
  const professor = standAt(7, 5), arrive = standAt(7, 7);
  return shot([
    backdrop('lab'),
    standing('professor', cast.professor, 'down', professor),
    walking('hero', cast.hero, 'up', [{ atMs: 0, x: arrive.x, y: standAt(7, 11).y }, { atMs: 300, x: arrive.x, y: standAt(7, 11).y }, { atMs: 2100, x: arrive.x, y: arrive.y }]),
    emote('professor-emote', 'exclaim', professor, 2300, 3700),
  ], { x: 240, keys: { y: [{ atMs: 0, value: 224 }, { atMs: 3000, value: 176, ease: 'ease-in-out' }] } });
}

/** 정원 무대 위로 스타터 셋이 차례로 뛰어오른다(64×64 정면 그림을 2배로). */
function stageShot(cast: EmeraldOpeningCast): OpeningAnimatic {
  const gap = 24, rest = 64, left = (STAGE.width - cast.starters.length * MONSTER - (cast.starters.length - 1) * gap) / 2;
  const leaps = cast.starters.flatMap((starter, i): AnimaticLayer[] => {
    const x = left + i * (MONSTER + gap), at = 300 + i * 450, land = at + 560;
    const bob: AnimaticKey[] = [0, 1, 2, 3].map(n => ({ atMs: land + 500 + n * 520, value: n % 2 ? rest : rest - 4, ease: 'step' }));
    return [
      { id: `starter-${i}-shadow`, kind: 'shape', shape: 'ellipse', role: 'prop', space: 'screen', color: '#0b1420', x: x + 24, y: rest + MONSTER - 14, width: MONSTER - 48, height: 12,
        keys: { opacity: [{ atMs: 0, value: 0 }, { atMs: land, value: 0 }, { atMs: land + 80, value: 0.35 }] } },
      { id: `starter-${i}`, kind: 'image', role: 'actor', characterRole: 'monster', space: 'screen', resourceId: starter.frontResourceId, sampling: 'nearest', x, y: STAGE.height + 8, width: MONSTER, height: MONSTER,
        keys: { y: [{ atMs: at, value: STAGE.height + 8 }, { atMs: at + 340, value: rest - 28, ease: 'ease-out' }, { atMs: land, value: rest, ease: 'ease-in' }, ...bob] } },
    ];
  });
  return shot([
    backdrop('stage'),
    { id: 'stage-dim', kind: 'shape', shape: 'rect', role: 'effect', space: 'screen', color: '#0b1420', opacity: 0.35, x: 0, y: 0, width: STAGE.width, height: STAGE.height },
    ...leaps,
  ], { x: 448, keys: { y: [{ atMs: 0, value: 340 }, { atMs: 4500, value: 300, ease: 'ease-out' }] } });
}

/** 체육관: 라이벌이 관장 앞으로 걸어 올라가 맞선다. */
function gymShot(cast: EmeraldOpeningCast): OpeningAnimatic {
  // 화단(6~7행) 바로 아래(8행)에 서면 머리가 화단 나무판에 겹쳐 화단 속에 선 것처럼 보인다 - 한 칸 띄운 9행에서 맞선다.
  const leader = standAt(8, 4), face = standAt(8, 9);
  return shot([
    backdrop('gym'),
    standing('leader', cast.leader, 'down', leader),
    walking('rival', cast.rival, 'up', [{ atMs: 0, x: face.x, y: standAt(8, 15).y }, { atMs: 2300, x: face.x, y: face.y }]),
    emote('leader-emote', 'exclaim', leader, 2500, 3900),
    { id: 'versus', kind: 'text', role: 'effect', space: 'screen', text: 'VS', color: '#ffd23f', x: 0, y: 128, width: STAGE.width, height: 52, startMs: 2700,
      typography: { fontSize: 44, weight: 900, align: 'center' }, keys: { opacity: [{ atMs: 2700, value: 0 }, { atMs: 2900, value: 1 }] } },
  ], { x: 272, keys: { y: [{ atMs: 0, value: 470 }, { atMs: 2600, value: 228, ease: 'ease-in-out' }] } });
}

/** 출발: 주인공과 첫 동료가 마을 길을 내려와 모험을 떠난다. */
function townShot(cast: EmeraldOpeningCast): OpeningAnimatic {
  const from = standAt(10, 4), to = standAt(10, 13), partner = cast.starters[0]?.chip;
  const flock: EmeraldOpeningChip = { resourceId: cast.flyer.resourceId, index: 3 };
  return shot([
    backdrop('town'),
    ...(partner ? [walking('partner', partner, 'down', [{ atMs: 0, x: from.x, y: from.y - TILE * 2 }, { atMs: 4300, x: to.x, y: to.y - TILE }])] : []),
    walking('hero', cast.hero, 'down', [{ atMs: 0, x: from.x, y: from.y }, { atMs: 4300, x: to.x, y: to.y }]),
    // 새 두 마리는 화면 맨 위 줄로 같은 빠르기로 줄지어 난다 — 내려오며 날면 2.7초쯤 동료·주인공 머리와 겹쳤다(2026-10-20 겹침 검사).
    walking('flyer', cast.flyer, 'left', [{ atMs: 0, x: 440, y: -18 }, { atMs: 4500, x: 40, y: -14 }], { space: 'screen' }),
    walking('flyer-flock', flock, 'left', [{ atMs: 0, x: 560, y: -18 }, { atMs: 4500, x: 160, y: -14 }], { space: 'screen' }),
  ], { x: 352, keys: { y: [{ atMs: 0, value: 200 }, { atMs: 4300, value: 400, ease: 'ease-in-out' }] } });
}

const BUILDERS: Record<EmeraldOpeningShot, (cast: EmeraldOpeningCast) => OpeningAnimatic> = {
  dawn: dawnShot, route: routeShot, lab: labShot, stage: stageShot, gym: gymShot, town: townShot,
};

export function emeraldOpeningShot(id: EmeraldOpeningShot, cast: EmeraldOpeningCast): OpeningAnimatic {
  return BUILDERS[id](cast);
}
