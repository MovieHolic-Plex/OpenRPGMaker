export const WORLD_CANON_TONES = [
  "hopeful",
  "grim",
  "comic",
  "political",
  "slice",
  "gothic",
  "fairytale",
  "mythic",
] as const;

export type WorldCanonTone = (typeof WORLD_CANON_TONES)[number];

export const WORLD_CANON_STATUSES = ["draft", "canon", "secret"] as const;

export type WorldCanonStatus = (typeof WORLD_CANON_STATUSES)[number];

export const WORLD_CANON_LAW_KINDS = ["power", "gods", "death", "money"] as const;

export type WorldCanonLawKind = (typeof WORLD_CANON_LAW_KINDS)[number];

export const WORLD_CANON_BOUNDS = {
  name: 120,
  premise: 280,
  era: 80,
  techCeiling: 80,
  body: 50_000,
  absence: 40,
  absenceCount: 32,
  lawNote: 160,
} as const;

export type WorldCanonLaw = {
  readonly present?: boolean;
  readonly note?: string;
};

export type WorldCanonLaws = {
  readonly power?: WorldCanonLaw;
  readonly gods?: WorldCanonLaw;
  readonly death?: WorldCanonLaw;
  readonly money?: WorldCanonLaw;
};

export type WorldCanon = {
  readonly name?: string;
  readonly premise?: string;
  readonly tones?: readonly WorldCanonTone[];
  readonly era?: string;
  readonly techCeiling?: string;
  readonly absences?: readonly string[];
  readonly laws?: WorldCanonLaws;
  readonly body?: string;
  readonly status?: WorldCanonStatus;
};

export type WorldCanonLawState = {
  readonly present: boolean | undefined;
  readonly note: string;
};

export type ResolvedWorldCanonLaws = {
  readonly power: WorldCanonLawState;
  readonly gods: WorldCanonLawState;
  readonly death: WorldCanonLawState;
  readonly money: WorldCanonLawState;
};

export type ResolvedWorldCanon = {
  readonly name: string;
  readonly premise: string;
  readonly tones: readonly WorldCanonTone[];
  readonly era: string;
  readonly techCeiling: string;
  readonly absences: readonly string[];
  readonly laws: ResolvedWorldCanonLaws;
  readonly body: string;
  readonly status: WorldCanonStatus;
};

const EMPTY_LAW: WorldCanonLawState = { present: undefined, note: "" };

export const EMPTY_WORLD_CANON: ResolvedWorldCanon = {
  name: "",
  premise: "",
  tones: [],
  era: "",
  techCeiling: "",
  absences: [],
  laws: { power: EMPTY_LAW, gods: EMPTY_LAW, death: EMPTY_LAW, money: EMPTY_LAW },
  body: "",
  status: "draft",
};

export function isWorldCanonTone(value: string): value is WorldCanonTone {
  return (WORLD_CANON_TONES as readonly string[]).includes(value);
}

export function isWorldCanonStatus(value: string): value is WorldCanonStatus {
  return (WORLD_CANON_STATUSES as readonly string[]).includes(value);
}

export function resolveWorldCanon(value: WorldCanon | undefined): ResolvedWorldCanon {
  return {
    name: value?.name ?? "",
    premise: value?.premise ?? "",
    tones: uniqueTones(value?.tones ?? []),
    era: value?.era ?? "",
    techCeiling: value?.techCeiling ?? "",
    absences: value?.absences ?? [],
    laws: {
      power: resolveLaw(value?.laws?.power),
      gods: resolveLaw(value?.laws?.gods),
      death: resolveLaw(value?.laws?.death),
      money: resolveLaw(value?.laws?.money),
    },
    body: value?.body ?? "",
    status: value?.status ?? "draft",
  };
}

export function compactWorldCanon(canon: ResolvedWorldCanon): WorldCanon | undefined {
  const name = clampText(canon.name, WORLD_CANON_BOUNDS.name);
  const premise = clampText(canon.premise, WORLD_CANON_BOUNDS.premise);
  const era = clampText(canon.era, WORLD_CANON_BOUNDS.era);
  const techCeiling = clampText(canon.techCeiling, WORLD_CANON_BOUNDS.techCeiling);
  const body = clampText(canon.body, WORLD_CANON_BOUNDS.body);
  const tones = uniqueTones(canon.tones);
  const absences = uniqueAbsences(canon.absences);
  const laws = compactLaws(canon.laws);
  const status = canon.status === "draft" ? undefined : canon.status;
  const next: WorldCanon = {
    ...(name ? { name } : {}),
    ...(premise ? { premise } : {}),
    ...(tones.length > 0 ? { tones } : {}),
    ...(era ? { era } : {}),
    ...(techCeiling ? { techCeiling } : {}),
    ...(absences.length > 0 ? { absences } : {}),
    ...(laws ? { laws } : {}),
    ...(body ? { body } : {}),
    ...(status ? { status } : {}),
  };
  return Object.keys(next).length > 0 ? next : undefined;
}

export function worldCanonHasContent(value: WorldCanon | undefined): boolean {
  // 상태 껍데기({status:"canon"}만)까지 "저작됨"으로 세면 개요 카드가 거짓 저작을
  // 알리고 장르 시드가 건너뛰며 빈 프롬프트 블록이 나간다 — 상태는 내용으로 세지 않는다.
  if (!value) return false;
  const { status: _status, ...rest } = value;
  return compactWorldCanon(resolveWorldCanon(rest)) !== undefined;
}

function resolveLaw(value: WorldCanonLaw | undefined): WorldCanonLawState {
  return {
    present: value?.present,
    note: value?.note ?? "",
  };
}

function compactLaws(laws: ResolvedWorldCanonLaws): WorldCanonLaws | undefined {
  const power = compactLaw(laws.power);
  const gods = compactLaw(laws.gods);
  const death = compactLaw(laws.death);
  const money = compactLaw(laws.money);
  const next: WorldCanonLaws = {
    ...(power ? { power } : {}),
    ...(gods ? { gods } : {}),
    ...(death ? { death } : {}),
    ...(money ? { money } : {}),
  };
  return Object.keys(next).length > 0 ? next : undefined;
}

function compactLaw(law: WorldCanonLawState): WorldCanonLaw | undefined {
  const note = clampText(law.note, WORLD_CANON_BOUNDS.lawNote);
  if (law.present === undefined && !note) return undefined;
  return {
    ...(law.present !== undefined ? { present: law.present } : {}),
    ...(note ? { note } : {}),
  };
}

export function uniqueTones(values: readonly (WorldCanonTone | undefined)[]): readonly WorldCanonTone[] {
  const seen = new Set<WorldCanonTone>();
  const next: WorldCanonTone[] = [];
  for (const tone of WORLD_CANON_TONES) {
    if (!values.includes(tone) || seen.has(tone)) continue;
    seen.add(tone);
    next.push(tone);
  }
  return next;
}

export function uniqueAbsences(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of values) {
    const value = clampText(raw, WORLD_CANON_BOUNDS.absence);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    next.push(value);
    if (next.length >= WORLD_CANON_BOUNDS.absenceCount) break;
  }
  return next;
}

function clampText(value: string, max: number): string {
  return value.trim().slice(0, max);
}
