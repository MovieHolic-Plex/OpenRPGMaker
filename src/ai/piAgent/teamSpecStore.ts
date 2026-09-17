// 팀 명세 저장소. localStorage(oprn:pi-team) 에 두고, 패널과 명령이 같은 사본을 본다.

import { defaultTeamSpec, normalizeTeamSpec, type PiTeamSpec } from "./teamSpec";

export const TEAM_SPEC_STORAGE_KEY = "oprn:pi-team";

type Listener = (spec: PiTeamSpec) => void;
const listeners = new Set<Listener>();
let cached: PiTeamSpec | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadTeamSpec(): PiTeamSpec {
  if (cached) return cached;
  const raw = storage()?.getItem(TEAM_SPEC_STORAGE_KEY);
  if (!raw) return (cached = defaultTeamSpec());
  try {
    const normalized = normalizeTeamSpec(JSON.parse(raw));
    return (cached = { ...normalized, reviewAfterWork: normalized.reviewAfterWork ?? true });
  } catch {
    return (cached = defaultTeamSpec());
  }
}

export function saveTeamSpec(spec: PiTeamSpec): PiTeamSpec {
  const normalized = normalizeTeamSpec(spec);
  cached = normalized;
  storage()?.setItem(TEAM_SPEC_STORAGE_KEY, JSON.stringify(normalized));
  for (const listener of listeners) listener(normalized);
  return normalized;
}

export function resetTeamSpec(): PiTeamSpec {
  storage()?.removeItem(TEAM_SPEC_STORAGE_KEY);
  cached = null;
  const spec = loadTeamSpec();
  for (const listener of listeners) listener(spec);
  return spec;
}

export function subscribeTeamSpec(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** 테스트용: 캐시를 비운다. */
export function __resetTeamSpecCache(): void {
  cached = null;
}
