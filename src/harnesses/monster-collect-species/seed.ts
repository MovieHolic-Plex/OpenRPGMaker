/**
 * 시드 — 하네스가 시작할 때 읽는 입력. 사람이 쓰는 도감 기획(seed.json)과
 * 하네스가 쓰는 진행 기록(ledger.json)을 나눈다. 둘 다 harness-data/monster-collect-species/ 에 커밋한다.
 */
import type { SpriteSide } from "./pixel/fit";

export type StyleContract = {
  /** 화풍 기준 (프롬프트에 그대로 들어간다) */
  reference: string;
  maxColors: number;
  canvas: number;
  /** 닮으면 안 되는 공식 몬스터 */
  avoid: string[];
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
};

export type MonsterSeed = {
  version: 1;
  style: StyleContract;
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

export type MonsterLedger = {
  version: 1;
  picks: Record<string, Partial<Record<SpriteSide, PickRecord>>>;
};

export function validateSeed(value: unknown): MonsterSeed {
  const seed = value as MonsterSeed;
  if (!seed || seed.version !== 1 || !Array.isArray(seed.species) || !seed.style) throw new Error("seed.json 형식이 아니다 (version 1, style, species 필요)");
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
