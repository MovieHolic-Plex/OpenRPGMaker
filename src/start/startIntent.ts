// start/startIntent.ts
// 시작 화면(start-screen.html) → 편집기(index.html) 한 번짜리 인계.
//
// 시작 화면은 별도 문서라 고른 장르·한 문장이 모듈 상태로 넘어오지 않는다. 같은 창·같은 출처(app://oprn)의
// sessionStorage 에 싣고, 편집기 부팅이 **방금 만든 그 폴더가 열렸을 때만** 한 번 꺼낸다.
// 다른 폴더가 열렸거나 오래된 값이면 버린다 — 남의 프로젝트에 장르 프리셋을 덮어쓰면 안 된다.
// 이 파일은 시작 화면 번들에도 들어가므로 가벼운 타입 import 만 둔다.

import type { NewProjectChoiceId } from "@/editor/newProjectChoices";
import type { ProjectStartMode, ProjectStartScreenSize } from "./projectStart";
import type { GameDesignBrief } from "@/project/gameDesignBrief";

export const START_SCREEN_INTENT_KEY = "oprn:start-screen-intent";
/** 만들기 → 편집기 부팅은 수 초다. 10분이 지난 값은 다른 작업의 찌꺼기로 본다. */
const MAX_AGE_MS = 10 * 60 * 1000;

export type StartScreenIntent = {
  readonly version: 1;
  /** 호스트가 돌려준 새 폴더 경로. 편집기가 연 폴더와 같아야 쓴다. */
  readonly projectDir: string;
  readonly title: string;
  /** null = 빈 프로젝트. */
  readonly choiceId: NewProjectChoiceId | null;
  /** 시작 화면의 한 문장. 비어 있을 수 있다. */
  readonly intent: string;
  readonly createdAt: number;
  readonly startMode?: ProjectStartMode;
  readonly screenSize?: ProjectStartScreenSize;
  /** Full confirmed interview; the editor validates it before seeding and saving. */
  readonly gameDesignBrief?: GameDesignBrief;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function writeStartScreenIntent(storage: StorageLike, intent: Omit<StartScreenIntent, "version" | "createdAt">, now = Date.now()): void {
  const value: StartScreenIntent = { version: 1, createdAt: now, ...intent };
  storage.setItem(START_SCREEN_INTENT_KEY, JSON.stringify(value));
}

/** 꺼내면서 지운다. 모양이 틀리거나, 오래됐거나, 다른 폴더면 null. */
export function takeStartScreenIntent(storage: StorageLike, openedProjectDir: string, now = Date.now()): StartScreenIntent | null {
  const raw = storage.getItem(START_SCREEN_INTENT_KEY);
  if (raw === null) return null;
  storage.removeItem(START_SCREEN_INTENT_KEY);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== "object") return null;
  const value = parsed as Partial<StartScreenIntent>;
  if (value.version !== 1 || typeof value.projectDir !== "string" || typeof value.title !== "string") return null;
  if (typeof value.intent !== "string" || typeof value.createdAt !== "number") return null;
  if (value.choiceId !== null && typeof value.choiceId !== "string") return null;
  if (value.startMode !== undefined && !["example", "ai", "blank"].includes(value.startMode)) return null;
  if (value.screenSize !== undefined && !["classic", "wide"].includes(value.screenSize)) return null;
  if (now - value.createdAt > MAX_AGE_MS || value.createdAt > now + 60_000) return null;
  if (value.projectDir !== openedProjectDir) return null;
  return value as StartScreenIntent;
}

/**
 * 시작 화면 「플레이」 → 편집기 문서를 편집 대신 플레이 모드로 부팅한다(2026-10-17, 플레이·만들기 런처).
 * 폴더는 openRecent 가 이미 열어 두었으므로 주소에 표시 하나만 싣는다. 부팅이 읽으면서 지운다 —
 * 플레이 중 새로고침은 편집 화면으로 돌아온다.
 */
export const START_PLAY_PARAM = "play";
export const START_PLAY_URL = `/index.html?${START_PLAY_PARAM}=1`;

export function takeStartPlayRequest(location: Pick<Location, "href">, history: Pick<History, "replaceState" | "state">): boolean {
  const url = new URL(location.href);
  if (!url.searchParams.has(START_PLAY_PARAM)) return false;
  url.searchParams.delete(START_PLAY_PARAM);
  history.replaceState(history.state, "", url);
  return true;
}
