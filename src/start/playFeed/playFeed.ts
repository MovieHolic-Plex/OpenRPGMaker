// start/playFeed/playFeed.ts
// 시작 화면에서 「플레이」를 누른 기록(이 컴퓨터의 localStorage). 카드는 2026-10-20 부터 src/start/home/homeView.ts 가 그린다.
import type { RecentProjectEntry } from "../../../electron/shared/start";

export const PLAYED_KEY = "oprn:start-played";
/** 기억하는 플레이 기록 수. 최근 목록보다 넉넉하면 된다. */
const MAX_PLAYED = 40;

/** 폴더 → 시작 화면에서 마지막으로 「플레이」를 누른 시각(ISO). 이 컴퓨터의 localStorage 에만 둔다. */
export type PlayedLog = Readonly<Record<string, string>>;

export function readPlayedLog(storage: Pick<Storage, "getItem"> | null): PlayedLog {
  let parsed: unknown;
  try { parsed = JSON.parse(storage?.getItem(PLAYED_KEY) ?? "{}"); } catch { return {}; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).filter(([, at]) => typeof at === "string" && Number.isFinite(Date.parse(at))));
}

export function recordPlayed(storage: Pick<Storage, "getItem" | "setItem"> | null, projectDir: string, now = Date.now()): void {
  const next = { ...readPlayedLog(storage), [projectDir]: new Date(now).toISOString() };
  const kept = Object.entries(next).sort(([, a], [, b]) => Date.parse(b) - Date.parse(a)).slice(0, MAX_PLAYED);
  try { storage?.setItem(PLAYED_KEY, JSON.stringify(Object.fromEntries(kept))); } catch { /* 기록을 못 남겨도 플레이는 열린다. */ }
}

/** 플레이한 적 있는 항목만, 최근에 플레이한 순서로. */
export function worldsByLastPlayed(entries: readonly RecentProjectEntry[], log: PlayedLog): readonly RecentProjectEntry[] {
  const at = (entry: RecentProjectEntry): number => Date.parse(log[entry.projectDir] ?? "");
  return entries.filter((entry) => Number.isFinite(at(entry))).sort((a, b) => at(b) - at(a));
}
