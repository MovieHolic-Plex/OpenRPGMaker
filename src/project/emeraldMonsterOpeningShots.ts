import { emeraldOpeningBackdrop, type EmeraldOpeningBackdropId } from '@/assets/emeraldOpeningBackdrops';
import type { AnimaticKey, AnimaticLayer, OpeningAnimatic } from './openingAnimatic';

/**
 * 몬스터 수집(에메랄드 결) 오프닝의 6컷 레이어 애니메틱.
 * 별빛섬 맵을 구운 배경 위에 RPG Maker 2000 캐릭터 시트(24×32 칸, 12열 8인)와 64×64 몬스터 그림을 얹는다.
 * 무대 480×320 에서 모든 그림을 정확히 2배로 그린다 — 배경·캐릭터·몬스터 도트가 같은 크기로 보인다.
 */
export type EmeraldOpeningShot = EmeraldOpeningBackdropId | 'region' | 'capsule' | 'together' | 'welcome';
/** 옛 생성기 소개를 고르게 나눠 싣는 기본 컷 순서(region 은 직접 고를 때만 쓴다). */
export const EMERALD_OPENING_SHOTS: readonly EmeraldOpeningShot[] = ['dawn', 'route', 'lab', 'stage', 'gym', 'town'];
export const EMERALD_OPENING_SHOT_MS = 4500;
/** 컷 길이. 지역 비행(region)은 섬 넷을 지나므로 조금 길다. */
export function emeraldOpeningShotMs(shot: EmeraldOpeningShot): number {
  return shot === 'region' ? 6500 : EMERALD_OPENING_SHOT_MS;
}

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
  /** 스타터 셋(풀·불꽃·물) — 64×64 정면 그림과 필드 칩. 없는 칸은 건너뛴다. name 이 있으면 등장할 때 이름표가 뜬다. */
  starters: readonly { frontResourceId: string; chip?: EmeraldOpeningChip; name?: string }[];
  /** 지역 비행(region) 컷의 섬 이름표 — 배경 맵의 실제 이름. 없으면 이름표 없이 난다. */
  places?: Partial<Record<EmeraldOpeningBackdropId, string>>;
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

function backdrop(id: EmeraldOpeningBackdropId): AnimaticLayer {
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

const shot = (layers: AnimaticLayer[], camera: OpeningAnimatic['camera'], background = '#0b1420', audioCues: OpeningAnimatic['audioCues'] = []): OpeningAnimatic =>
  ({ width: STAGE.width, height: STAGE.height, background, layers, ...(camera ? { camera } : {}), transition: { kind: 'fade', durationMs: 400 }, ...(audioCues?.length ? { audioCues } : {}) });

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

/**
 * 정원 무대 위로 스타터 셋이 차례로 튀어나온다(64×64 정면 그림을 2배로). 빛 구슬이 솟아 터지면 몬스터가 뛰어올라 착지하며
 * 눌렸다 펴지고(squash), 반짝이와 이름표가 뜬다. 박마다 효과음.
 */
function stageShot(cast: EmeraldOpeningCast): OpeningAnimatic {
  const gap = 24, rest = 64, left = (STAGE.width - cast.starters.length * MONSTER - (cast.starters.length - 1) * gap) / 2;
  const colors = ['#9cff7a', '#ffb050', '#7ad8ff'];
  const leaps = cast.starters.flatMap((starter, i): AnimaticLayer[] => {
    const x = left + i * (MONSTER + gap), cx = x + MONSTER / 2, at = 300 + i * 450, burst = at + 40, land = at + 560;
    const bob: AnimaticKey[] = [0, 1, 2, 3].map(n => ({ atMs: land + 500 + n * 520, value: n % 2 ? rest : rest - 4, ease: 'step' }));
    const color = colors[i % colors.length]!;
    return [
      // 빛 구슬: 화면 아래에서 솟아 몬스터가 나올 자리에서 터진다.
      { id: `starter-${i}-orb`, kind: 'glow', role: 'effect', space: 'screen', color, blend: 'lighter', x: cx - 24, y: STAGE.height - 10, width: 48, height: 48, startMs: Math.max(0, at - 260), endMs: burst + 160,
        glow: { inner: 0.45 }, keys: { y: [{ atMs: Math.max(0, at - 260), value: STAGE.height - 10 }, { atMs: burst, value: rest + MONSTER / 2 - 24, ease: 'ease-out' }], opacity: [{ atMs: Math.max(0, at - 260), value: 0.9 }, { atMs: burst + 160, value: 0 }] } },
      { id: `starter-${i}-burst`, kind: 'glow', role: 'effect', space: 'screen', color: '#ffffff', blend: 'lighter', x: cx - 90, y: rest + MONSTER / 2 - 90, width: 180, height: 180, startMs: burst, endMs: burst + 700,
        glow: { inner: 0.2 }, keys: { opacity: [{ atMs: burst, value: 0.95 }, { atMs: burst + 700, value: 0, ease: 'ease-out' }], scaleX: [{ atMs: burst, value: 0.4 }, { atMs: burst + 300, value: 1.2, ease: 'ease-out' }], scaleY: [{ atMs: burst, value: 0.4 }, { atMs: burst + 300, value: 1.2, ease: 'ease-out' }] } },
      { id: `starter-${i}-sparks`, kind: 'particles', role: 'effect', space: 'screen', color, blend: 'lighter', x: x - 10, y: rest - 20, width: MONSTER + 20, height: MONSTER + 20, startMs: burst, endMs: land + 1400,
        particles: { preset: 'sparks', count: 22, seed: 70 + i, speed: 22, size: 1.6 }, keys: { opacity: [{ atMs: burst, value: 1 }, { atMs: land + 1400, value: 0, ease: 'ease-in' }] } },
      { id: `starter-${i}-shadow`, kind: 'shape', shape: 'ellipse', role: 'prop', space: 'screen', color: '#0b1420', x: x + 24, y: rest + MONSTER - 14, width: MONSTER - 48, height: 12,
        keys: { opacity: [{ atMs: 0, value: 0 }, { atMs: land, value: 0 }, { atMs: land + 80, value: 0.35 }] } },
      { id: `starter-${i}`, kind: 'image', role: 'actor', characterRole: 'monster', space: 'screen', resourceId: starter.frontResourceId, sampling: 'nearest', x: cx, y: STAGE.height + 8 + MONSTER, width: MONSTER, height: MONSTER,
        // 발밑 기준점(가운데 아래) — 착지 때 눌렸다 펴지는 squash 가 땅에 붙어 일어난다. y 키는 발끝 자리.
        anchorX: 0.5, anchorY: 1,
        keys: {
          y: [{ atMs: at, value: STAGE.height + 8 + MONSTER }, { atMs: at + 340, value: rest - 28 + MONSTER, ease: 'ease-out' }, { atMs: land, value: rest + MONSTER, ease: 'ease-in' }, ...bob.map(k => ({ ...k, value: k.value + MONSTER }))],
          scaleX: [{ atMs: at, value: 0.6 }, { atMs: at + 200, value: 1 }, { atMs: land, value: 1 }, { atMs: land + 70, value: 1.18, ease: 'ease-out' }, { atMs: land + 220, value: 1, ease: 'ease-in-out' }],
          scaleY: [{ atMs: at, value: 0.6 }, { atMs: at + 200, value: 1.08 }, { atMs: land, value: 1 }, { atMs: land + 70, value: 0.82, ease: 'ease-out' }, { atMs: land + 220, value: 1, ease: 'ease-in-out' }],
        } },
      ...(starter.name ? [{ id: `starter-${i}-name`, kind: 'text' as const, role: 'credit' as const, space: 'screen' as const, text: starter.name, color: '#fff6d8', x, y: rest + MONSTER + 6, width: MONSTER, height: 20, startMs: land + 120,
        typography: { fontSize: 15, weight: 800, align: 'center' as const }, keys: { opacity: [{ atMs: land + 120, value: 0 }, { atMs: land + 320, value: 1 }], y: [{ atMs: land + 120, value: rest + MONSTER + 14 }, { atMs: land + 320, value: rest + MONSTER + 6, ease: 'ease-out' as const }] } }] : []),
    ];
  });
  return shot([
    backdrop('stage'),
    { id: 'stage-dim', kind: 'shape', shape: 'rect', role: 'effect', space: 'screen', color: '#0b1420', opacity: 0.35, x: 0, y: 0, width: STAGE.width, height: STAGE.height },
    ...leaps,
  ], { x: 448, keys: { y: [{ atMs: 0, value: 340 }, { atMs: 4500, value: 300, ease: 'ease-out' }] } }, '#0b1420',
  cast.starters.flatMap((_, i) => [
    { id: `pop-${i}`, resourceId: 'cc0-se-ors-item-gem-02', atMs: 340 + i * 450, durationMs: 700, volume: 0.5 },
    { id: `land-${i}`, resourceId: 'cc0-se-ors-creature-misc-0' + String(1 + i), atMs: 860 + i * 450, durationMs: 900, volume: 0.45 },
  ]));
}

/**
 * 지역 비행: 군도 위를 높이 날며 섬(맵) 넷을 지난다 — 해변 → 1번길 → 마을 → 언덕 정원. 모두 바깥 맵이다(체육관은 실내라 벽 테두리가 드러났다).
 * 섬은 좁은 바다 틈(40px)만 두고 붙여 화면이 어느 순간에도 땅을 비추고, 틈은 구름이 가린다. 섬 사이는 바다와 구름이 가리고,
 * 섬을 지날 때 핀이 반짝이며 이름표가 뜬다. 새떼가 같은 쪽으로 난다. 배경은 맵 그림을 1배(멀리서 본 크기)로 쓴다.
 */
function regionShot(cast: EmeraldOpeningCast): OpeningAnimatic {
  const ms = emeraldOpeningShotMs('region');
  type Isle = { id: EmeraldOpeningBackdropId; x: number; y: number };
  // 마을·정원(높이 320)이 놓인 띠(y 110..430)를 해변·1번길(더 높다)도 덮는다 — 카메라는 그 띠 가운데(y 270)로만 난다.
  const isles: Isle[] = [{ id: 'dawn', x: 0, y: 0 }, { id: 'route', x: 456, y: 20 }, { id: 'town', x: 880, y: 110 }, { id: 'stage', x: 1272, y: 110 }];
  const centerOf = (isle: Isle) => { const { crop } = emeraldOpeningBackdrop(isle.id); return { x: isle.x + crop.width / 2, y: isle.y + crop.height / 2 }; };
  const centers = isles.map(centerOf);
  // 첫 화면도 땅 위에서 연다 — 해변 가운데(208)에서 열면 줌 1.1 화면 왼쪽 끝에 빈 바다가 걸렸다.
  const camX: AnimaticKey[] = centers.map((c, i) => ({ atMs: Math.round(i * (ms - 500) / (isles.length - 1)), value: Math.round(i === 0 ? c.x + 32 : c.x), ...(i ? { ease: 'ease-in-out' as const } : {}) }));
  const camY: AnimaticKey[] = [{ atMs: 0, value: 270 }];
  const islandLayers = isles.flatMap((isle, i): AnimaticLayer[] => {
    const { resourceId, crop } = emeraldOpeningBackdrop(isle.id);
    return [
      { id: `isle-${i}`, kind: 'image', role: 'background', resourceId, sampling: 'nearest', x: isle.x, y: isle.y, width: crop.width, height: crop.height },
    ];
  });
  // 섬 가장자리(네모난 맵 끝)를 덮는 구름 — 부드러운 흰 빛무리.
  const cloud = (id: string, x: number, y: number, size: number, parallax: number, opacity = 0.9): AnimaticLayer =>
    ({ id, kind: 'glow', role: 'foreground', color: '#f4f8ff', x: x - size / 2, y: y - size / 2, width: size, height: size, parallax, opacity, glow: { inner: 0.35 } });
  const clouds: AnimaticLayer[] = [];
  isles.forEach((isle, i) => {
    const { crop } = emeraldOpeningBackdrop(isle.id);
    for (const [fx, fy, size] of [[0.3, -0.02, 220], [0.7, 1.02, 230]] as const) {
      clouds.push(cloud(`cloud-${i}-${clouds.length}`, isle.x + crop.width * fx, isle.y + crop.height * fy, size, 1));
    }
    // 다음 섬과의 바다 틈을 덮는 구름 기둥.
    const next = isles[i + 1];
    if (next) clouds.push(cloud(`gap-${i}`, (isle.x + crop.width + next.x) / 2, 270, 240, 1, 0.95));
  });
  const hiCloud = [cloud('hi-a', 420, 120, 280, 1.5, 0.55), cloud('hi-b', 1050, 420, 300, 1.5, 0.5)];
  const labels = isles.flatMap((isle, i): AnimaticLayer[] => {
    const name = cast.places?.[isle.id];
    const c = centers[i]!, at = camX[i]!.atMs, from = Math.max(0, at - 700), to = Math.min(ms, at + 1300);
    if (!name) return [];
    return [
      // 이름표 밑 어두운 띠 — 밝은 풀밭·모래 위에서도 읽힌다.
      { id: `plate-${i}`, kind: 'shape', shape: 'rect', role: 'effect', color: '#0b1a2e', x: c.x - (Array.from(name).length * 9 + 14), y: c.y - 59, width: Array.from(name).length * 18 + 28, height: 28, startMs: from, endMs: to,
        keys: { opacity: [{ atMs: from, value: 0 }, { atMs: from + 220, value: 0.62 }, { atMs: to - 250, value: 0.62 }, { atMs: to, value: 0 }] } },
      { id: `label-${i}`, kind: 'text', role: 'credit', text: name, color: '#fff6d8', x: c.x - 120, y: c.y - 54, width: 240, height: 24, startMs: from, endMs: to,
        // 기준점을 적어 둬야 렌더러의 「가운데 정렬 글이 화면 밖으로 넘치면 화면 가운데로」 보정이 세계 좌표 이름표를 끌고 가지 않는다.
        anchorX: 0, anchorY: 0,
        typography: { fontSize: 17, weight: 900, align: 'center' }, keys: { opacity: [{ atMs: from, value: 0 }, { atMs: from + 220, value: 1 }, { atMs: to - 250, value: 1 }, { atMs: to, value: 0 }], y: [{ atMs: from, value: c.y - 46 }, { atMs: from + 260, value: c.y - 54, ease: 'ease-out' }] } },
    ];
  });
  const flock = [0, 1, 2].map(i => walking(`flock-${i}`, { resourceId: cast.flyer.resourceId, index: [0, 1, 3][i]! }, 'right',
    [{ atMs: 0, x: -60 - i * 50, y: 40 + i * 36 }, { atMs: ms, x: 520 - i * 50, y: 24 + i * 36 }], { space: 'screen' }));
  return shot([
    { id: 'sea-glint', kind: 'particles', role: 'background', color: '#bfe6ff', blend: 'lighter', x: -150, y: -150, width: 1900, height: 900, opacity: 0.55, particles: { preset: 'sparks', count: 90, seed: 9, speed: 3, size: 1.2 } },
    ...islandLayers,
    ...clouds,
    ...labels,
    ...hiCloud,
    ...flock,
  ], { keys: { x: camX, y: camY, zoom: [{ atMs: 0, value: 1.1 }, { atMs: ms, value: 1, ease: 'ease-out' }] } }, '#2f78b8',
  [{ id: 'wind', resourceId: 'cc0-se-orp-battle-swing', atMs: 200, durationMs: 1200, volume: 0.3 }]);
}

/** 환영: 연구소 한가운데 박사가 혼자 서서 반긴다(주인공은 아직 없다 — 성별·이름을 고르기 전이다). 반짝이가 흩날린다. */
function welcomeShot(cast: EmeraldOpeningCast): OpeningAnimatic {
  const professor = standAt(7, 6);
  return shot([
    backdrop('lab'),
    { id: 'welcome-sparks', kind: 'particles', role: 'effect', space: 'screen', color: '#fff6c0', blend: 'lighter', x: 40, y: 20, width: 400, height: 200, opacity: 0.8,
      particles: { preset: 'sparks', count: 24, seed: 12, speed: 8, size: 1.4 } },
    walking('professor', cast.professor, 'down', [{ atMs: 0, x: professor.x, y: standAt(7, 4).y }, { atMs: 900, x: professor.x, y: professor.y }]),
    emote('professor-emote', 'heart', professor, 1100, 3600),
  ], { x: 240, y: 192 }, '#0b1420', [{ id: 'hello', resourceId: 'cc0-sound-monster-ui-confirm', atMs: 1100, durationMs: 400, volume: 0.45 }]);
}

/**
 * 박사가 구슬을 던지고, 터진 빛에서 첫 스타터가 튀어나와 하트를 띄운다(포켓몬 3세대 박사 소개의 「몬스터가 튀어나온다」).
 * 연구소 그림 위에서 박사가 선 채 구슬이 포물선을 그리고, 바닥에 닿는 순간 하얀 빛이 터진다.
 */
function capsuleShot(cast: EmeraldOpeningCast): OpeningAnimatic {
  const professor = standAt(7, 5), starter = cast.starters[0];
  const land = { x: 330, y: 234 }, throwAt = 500, hitAt = 1150, popAt = hitAt + 60, foot = 266;
  const arcX: AnimaticKey[] = [{ atMs: throwAt, value: 268 }, { atMs: hitAt, value: land.x - 10, ease: 'linear' }];
  const arcY: AnimaticKey[] = [{ atMs: throwAt, value: 140 }, { atMs: Math.round((throwAt + hitAt) / 2), value: 84, ease: 'ease-out' }, { atMs: hitAt, value: land.y - 10, ease: 'ease-in' }];
  return shot([
    backdrop('lab'),
    standing('professor', cast.professor, 'right', professor),
    // 구슬: 위 반은 빨갛고 아래 반은 흰 빛 — 빛무리 둘을 겹쳐 그린다(새 그림 없음).
    { id: 'capsule', kind: 'glow', role: 'effect', space: 'screen', color: '#ff6a5a', x: 0, y: 0, width: 22, height: 22, startMs: throwAt, endMs: hitAt + 40, glow: { inner: 0.7 }, keys: { x: arcX, y: arcY } },
    { id: 'capsule-core', kind: 'glow', role: 'effect', space: 'screen', color: '#ffffff', x: 0, y: 0, width: 12, height: 12, startMs: throwAt, endMs: hitAt + 40, glow: { inner: 0.9 },
      keys: { x: arcX.map(k => ({ ...k, value: k.value + 5 })), y: arcY.map(k => ({ ...k, value: k.value + 5 })) } },
    { id: 'burst', kind: 'glow', role: 'effect', space: 'screen', color: '#ffffff', blend: 'lighter', x: land.x - 110, y: land.y - 130, width: 220, height: 220, startMs: hitAt, endMs: hitAt + 800, glow: { inner: 0.25 },
      keys: { opacity: [{ atMs: hitAt, value: 1 }, { atMs: hitAt + 800, value: 0, ease: 'ease-out' }], scaleX: [{ atMs: hitAt, value: 0.3 }, { atMs: hitAt + 320, value: 1.2, ease: 'ease-out' }], scaleY: [{ atMs: hitAt, value: 0.3 }, { atMs: hitAt + 320, value: 1.2, ease: 'ease-out' }] } },
    { id: 'burst-sparks', kind: 'particles', role: 'effect', space: 'screen', color: '#fff3a0', blend: 'lighter', x: land.x - 80, y: land.y - 120, width: 160, height: 140, startMs: hitAt, endMs: hitAt + 1600,
      particles: { preset: 'sparks', count: 26, seed: 33, speed: 24, size: 1.6 }, keys: { opacity: [{ atMs: hitAt, value: 1 }, { atMs: hitAt + 1600, value: 0, ease: 'ease-in' }] } },
    ...(starter ? [
      { id: 'starter-shadow', kind: 'shape' as const, shape: 'ellipse' as const, role: 'prop' as const, space: 'screen' as const, color: '#0b1420', x: land.x - 34, y: foot - 8, width: 68, height: 12, startMs: popAt + 300, opacity: 0.3 },
      { id: 'starter', kind: 'image' as const, role: 'actor' as const, characterRole: 'monster' as const, space: 'screen' as const, resourceId: starter.frontResourceId, sampling: 'nearest' as const,
        x: land.x, y: foot, width: MONSTER, height: MONSTER, anchorX: 0.5, anchorY: 1, startMs: popAt,
        keys: {
          y: [{ atMs: popAt, value: foot }, { atMs: popAt + 200, value: foot - 34, ease: 'ease-out' as const }, { atMs: popAt + 380, value: foot, ease: 'ease-in' as const }],
          scaleX: [{ atMs: popAt, value: 0.2 }, { atMs: popAt + 200, value: 0.96 }, { atMs: popAt + 380, value: 1.18, ease: 'ease-out' as const }, { atMs: popAt + 540, value: 1, ease: 'ease-in-out' as const }],
          scaleY: [{ atMs: popAt, value: 0.2 }, { atMs: popAt + 200, value: 1.1 }, { atMs: popAt + 380, value: 0.82, ease: 'ease-out' as const }, { atMs: popAt + 540, value: 1, ease: 'ease-in-out' as const }],
        } },
      { id: 'starter-heart', kind: 'emote' as const, role: 'effect' as const, space: 'screen' as const, x: land.x + 26, y: foot - MONSTER + 6, width: 32, height: 32, startMs: popAt + 620, endMs: 4400, emote: { preset: 'heart' as const, tail: 'down' as const, popMs: 160 } },
    ] : []),
    emote('professor-emote', 'exclaim', professor, popAt + 400, popAt + 1500),
  ], { x: 240, y: 176 }, '#0b1420', [
    { id: 'throw', resourceId: 'cc0-sound-monster-ball-throw', atMs: throwAt, durationMs: 600, volume: 0.5 },
    { id: 'pop', resourceId: 'cc0-sound-monster-ball-break', atMs: hitAt, durationMs: 700, volume: 0.55 },
    { id: 'cry', resourceId: 'cc0-se-ors-creature-misc-01', atMs: popAt + 380, durationMs: 900, volume: 0.5 },
  ]);
}

/** 사람과 몬스터가 함께: 마을 큰길을 라이벌·관장이 제 몬스터를 데리고 오가고, 연못가에서 들몬스터가 깡충 뛴다. */
function togetherShot(cast: EmeraldOpeningCast): OpeningAnimatic {
  const lower = standAt(0, 8).y, upper = standAt(0, 7).y;
  const fire = cast.starters[1]?.chip ?? cast.wild, water = cast.starters[2]?.chip ?? cast.wild, pond = standAt(7, 10);
  return shot([
    backdrop('town'),
    walking('rival', cast.rival, 'right', [{ atMs: 0, x: 130, y: lower }, { atMs: 4400, x: 450, y: lower }]),
    walking('rival-buddy', fire, 'right', [{ atMs: 0, x: 80, y: lower }, { atMs: 4400, x: 400, y: lower }]),
    walking('leader', cast.leader, 'left', [{ atMs: 0, x: 600, y: upper }, { atMs: 4400, x: 330, y: upper }]),
    walking('leader-buddy', water, 'left', [{ atMs: 0, x: 650, y: upper }, { atMs: 4400, x: 380, y: upper }]),
    standing('pond-wild', cast.wild, 'down', pond, { keys: { y: [0, 1, 2, 3, 4, 5].map(n => ({ atMs: 400 + n * 700, value: n % 2 ? pond.y - 10 : pond.y, ease: 'ease-in-out' as const })) } }),
    emote('rival-emote', 'heart', { x: 400, y: lower }, 2400, 3800),
  ], { x: 352, y: 256 });
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

/**
 * 출발: 주인공이 마을 길을 내려와 연구소로 향한다. 첫 동료를 고르기 전의 내레이션이라 동료는 따라오지 않는다 —
 * 풀 스타터가 뒤따라 걸어 불·물을 고를 플레이어에게 다른 동료를 미리 보여 줬다(아스트라 호라이즌 2026-10-23 적대 VQA).
 */
function townShot(cast: EmeraldOpeningCast): OpeningAnimatic {
  const from = standAt(10, 4), to = standAt(10, 13);
  const flock: EmeraldOpeningChip = { resourceId: cast.flyer.resourceId, index: 3 };
  return shot([
    backdrop('town'),
    walking('hero', cast.hero, 'down', [{ atMs: 0, x: from.x, y: from.y }, { atMs: 4300, x: to.x, y: to.y }]),
    // 새 두 마리는 화면 맨 위 줄로 같은 빠르기로 줄지어 난다 — 내려오며 날면 2.7초쯤 동료·주인공 머리와 겹쳤다(2026-10-20 겹침 검사).
    walking('flyer', cast.flyer, 'left', [{ atMs: 0, x: 440, y: -18 }, { atMs: 4500, x: 40, y: -14 }], { space: 'screen' }),
    walking('flyer-flock', flock, 'left', [{ atMs: 0, x: 560, y: -18 }, { atMs: 4500, x: 160, y: -14 }], { space: 'screen' }),
  ], { x: 352, keys: { y: [{ atMs: 0, value: 200 }, { atMs: 4300, value: 400, ease: 'ease-in-out' }] } });
}

const BUILDERS: Record<EmeraldOpeningShot, (cast: EmeraldOpeningCast) => OpeningAnimatic> = {
  dawn: dawnShot, route: routeShot, lab: labShot, stage: stageShot, gym: gymShot, town: townShot, region: regionShot, capsule: capsuleShot, together: togetherShot, welcome: welcomeShot,
};

export function emeraldOpeningShot(id: EmeraldOpeningShot, cast: EmeraldOpeningCast): OpeningAnimatic {
  return BUILDERS[id](cast);
}
