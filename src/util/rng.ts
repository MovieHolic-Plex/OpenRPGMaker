export const RNG_STREAMS = ["encounter", "battle", "movement", "misc"] as const;

export type RngStreamName = (typeof RNG_STREAMS)[number];

export type RngStreamState = {
  readonly seed: number;
  state: number;
};

export type RngState = {
  seed: number;
  streams: Record<RngStreamName, RngStreamState>;
};

export type Rng = () => number;

const DEFAULT_SEED = 1;

export function randomSessionSeed(): number {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const value = new Uint32Array(1);
    cryptoApi.getRandomValues(value);
    return normalizeSeed(value[0] ?? DEFAULT_SEED);
  }
  return normalizeSeed(Date.now() ^ Math.floor(Math.random() * 0xffffffff));
}

export function createRngState(seed = randomSessionSeed()): RngState {
  const normalizedSeed = normalizeSeed(seed);
  return {
    seed: normalizedSeed,
    streams: {
      encounter: createStreamState(normalizedSeed, "encounter"),
      battle: createStreamState(normalizedSeed, "battle"),
      movement: createStreamState(normalizedSeed, "movement"),
      misc: createStreamState(normalizedSeed, "misc"),
    },
  };
}

export function normalizeRngState(value: unknown, fallbackSeed = randomSessionSeed()): RngState {
  if (!isRecord(value)) return createRngState(fallbackSeed);
  const seed = typeof value.seed === "number" && Number.isFinite(value.seed)
    ? normalizeSeed(value.seed)
    : normalizeSeed(fallbackSeed);
  const streamsRecord = isRecord(value.streams) ? value.streams : {};
  const streams = {} as Record<RngStreamName, RngStreamState>;
  for (const stream of RNG_STREAMS) {
    const raw = streamsRecord[stream];
    if (isRecord(raw) && typeof raw.state === "number" && Number.isFinite(raw.state)) {
      streams[stream] = {
        seed: typeof raw.seed === "number" && Number.isFinite(raw.seed) ? normalizeSeed(raw.seed) : deriveStreamSeed(seed, stream),
        state: normalizeSeed(raw.state),
      };
    } else {
      streams[stream] = createStreamState(seed, stream);
    }
  }
  return { seed, streams };
}

export function cloneRngState(state: RngState): RngState {
  return {
    seed: normalizeSeed(state.seed),
    streams: {
      encounter: { ...state.streams.encounter },
      battle: { ...state.streams.battle },
      movement: { ...state.streams.movement },
      misc: { ...state.streams.misc },
    },
  };
}

export function nextRngFloat(state: RngState, stream: RngStreamName): number {
  const current = state.streams[stream] ?? createStreamState(state.seed, stream);
  const next = mulberry32Next(current.state);
  current.state = next.state;
  state.streams[stream] = current;
  return next.value;
}

export function rngForState(state: RngState, stream: RngStreamName): Rng {
  return () => nextRngFloat(state, stream);
}

export function mulberry32(seed: number): Rng {
  let state = normalizeSeed(seed);
  return () => {
    const next = mulberry32Next(state);
    state = next.state;
    return next.value;
  };
}

function createStreamState(seed: number, stream: RngStreamName): RngStreamState {
  const streamSeed = deriveStreamSeed(seed, stream);
  return { seed: streamSeed, state: streamSeed };
}

function deriveStreamSeed(seed: number, stream: RngStreamName): number {
  return fnv1a(`${normalizeSeed(seed)}:${stream}`);
}

function normalizeSeed(seed: number): number {
  const normalized = seed >>> 0;
  return normalized === 0 ? DEFAULT_SEED : normalized;
}

function mulberry32Next(state: number): { readonly state: number; readonly value: number } {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let t = Math.imul(nextState ^ (nextState >>> 15), 1 | nextState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { state: nextState, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return normalizeSeed(hash);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
