/**
 * 시드 — 하네스가 시작할 때 읽는 입력. 사람이 쓰는 도감 기획(seed.json)과
 * 하네스가 쓰는 진행 기록(ledger.json)을 나눈다. 둘 다 harness-data/monster-collect-species/ 에 커밋한다.
 */
import type { SpriteSide } from "./pixel/fit";
import { IDLE_PLAN, type IdleMotion } from "./anim/idle";

export type StyleContract = {
  /** 화풍 기준 (프롬프트에 그대로 들어간다) */
  reference: string;
  maxColors: number;
  canvas: number;
  /** 닮으면 안 되는 공식 몬스터 */
  avoid: string[];
};

export type AnimationState = { frames: number; frameMs: number; loop: boolean };

/** 큰 동작 하나 — 생성 프롬프트에 action 문장이 들어간다 */
export type ActionContract = AnimationState & { action: string };

/**
 * 애니메이션 계약. 대기는 고른 스프라이트를 정수 픽셀로 움직이고(anim/idle.ts, 생성 없음),
 * 큰 동작은 한 줄 생성(anim/row.ts, sprite-gen 방식) 후 사람이 고른다.
 */
export type AnimationContract = {
  idle: AnimationState;
  actions: Record<string, ActionContract>;
};

export type SpeciesSeed = {
  id: string;
  name: string;
  types: string[];
  /** 진화 단계 1~3 */
  stage: 1 | 2 | 3;
  evolvesFrom?: string;
  /** 스타터 세 마리 묶음 이름 */
  starterSet?: string;
  /** 영어 디자인 설명 (생성 프롬프트에 들어간다) */
  design: string;
  palette?: string;
  /** 대기 애니메이션에서 따로 흔들 부위 (불꽃 꼬리 등) */
  motion?: IdleMotion;
};

export type MonsterSeed = {
  version: 1;
  style: StyleContract;
  animation: AnimationContract;
  species: SpeciesSeed[];
};

export type PickRecord = {
  /** harness-data 아래 격자 원본 (칸 하나 = 픽셀 하나) */
  grid: string;
  /** 생성 원본 PNG 의 sha256 */
  sourceSha256: string;
  /** 생성 원본 파일 (실행 산출물, 커밋 안 함 — 사라질 수 있다) */
  sourcePath: string;
  prompt: string;
  block: number;
  pickedAt: string;
  note?: string;
};

/** 큰 동작 한 줄의 선택 기록. grid 는 줄 전체 격자 도트(N 프레임이 한 장) */
export type ActionPickRecord = PickRecord & { frames: number };

export type MonsterLedger = {
  version: 1;
  picks: Record<string, Partial<Record<SpriteSide, PickRecord>>>;
  /** 종 → 면 → 동작 id */
  actions?: Record<string, Partial<Record<SpriteSide, Record<string, ActionPickRecord>>>>;
};

export function validateSeed(value: unknown): MonsterSeed {
  const seed = value as MonsterSeed;
  if (!seed || seed.version !== 1 || !Array.isArray(seed.species) || !seed.style) throw new Error("seed.json 형식이 아니다 (version 1, style, species 필요)");
  const animation = seed.animation;
  if (!animation?.idle || !animation.actions) throw new Error("seed.json 에 animation.idle·animation.actions 가 없다");
  if (animation.idle.frames !== IDLE_PLAN.length) throw new Error(`animation.idle.frames 는 ${IDLE_PLAN.length} (대기 움직임 계획 anim/idle.ts IDLE_PLAN 과 같아야 한다)`);
  for (const [id, action] of Object.entries(animation.actions)) {
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`동작 id 는 소문자 kebab-case: ${id}`);
    if (id === "idle") throw new Error("idle 은 동작(actions)이 아니다 — 생성하지 않고 animation.idle 로 만든다");
    if (!Number.isInteger(action.frames) || action.frames < 2 || action.frames > 6) throw new Error(`동작 ${id} frames 는 2~6 (한 줄 생성은 6장을 넘으면 겹치고 빠진다)`);
    if (!action.action?.trim()) throw new Error(`동작 ${id} 에 action 설명이 없다`);
  }
  const ids = new Set<string>();
  for (const species of seed.species) {
    if (!/^[a-z][a-z0-9-]*$/.test(species.id)) throw new Error(`종 id 는 소문자 kebab-case: ${species.id}`);
    if (ids.has(species.id)) throw new Error(`종 id 중복: ${species.id}`);
    ids.add(species.id);
    if (!species.design?.trim()) throw new Error(`종 ${species.id} 에 design 설명이 없다`);
    if (![1, 2, 3].includes(species.stage)) throw new Error(`종 ${species.id} stage 는 1~3`);
  }
  for (const species of seed.species) {
    if (species.evolvesFrom && !ids.has(species.evolvesFrom)) throw new Error(`종 ${species.id} 의 evolvesFrom ${species.evolvesFrom} 이 시드에 없다`);
  }
  return seed;
}

export function emptyLedger(): MonsterLedger {
  return { version: 1, picks: {} };
}
