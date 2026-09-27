// start/startIntent.ts
// 시작 화면(start-screen.html) → 편집기(index.html) 한 번짜리 인계.
//
// 시작 화면은 별도 문서라 고른 장르·한 문장이 모듈 상태로 넘어오지 않는다. 같은 창·같은 출처(app://oprn)의
// sessionStorage 에 싣고, 편집기 부팅이 **방금 만든 그 폴더가 열렸을 때만** 한 번 꺼낸다.
// 다른 폴더가 열렸거나 오래된 값이면 버린다 — 남의 프로젝트에 장르 프리셋을 덮어쓰면 안 된다.
// 이 파일은 시작 화면 번들에도 들어가므로 가벼운 타입 import 만 둔다.

import type { NewProjectChoiceId } from "@/editor/newProjectChoices";

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
  if (now - value.createdAt > MAX_AGE_MS || value.createdAt > now + 60_000) return null;
  if (value.projectDir !== openedProjectDir) return null;
  return value as StartScreenIntent;
}
