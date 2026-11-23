// ai/authStatusCache.ts
// 계정 상태(/auth/status)를 계정마다 짧게(30초) 다시 쓴다 — 동시에 여러 곳이 물어도 요청은 계정당 한 번이다.
//
// 왜 (2026-11-23 실측): 자동 연결 고르기(#4940·#4943)와 역할 표가 설정을 열 때마다 계정 길 전부를 다시 물어
// 설정 한 번에 /auth/status 가 44번 나갔다(부팅 9번). 로그인·로그아웃·키 저장·갱신은 COMPANION_AUTH_CHANGED_EVENT 로 비운다.
// 로그인 완료를 기다리는 폴링과 칩의 연결 확인은 이 캐시를 쓰지 않는다(늘 새로 묻는다).
import { COMPANION_AUTH_CHANGED_EVENT, fetchChatGptAuthStatus, type ChatGptAuthStatus } from "./chatgptOAuthClient";

export const AUTH_STATUS_CACHE_MS = 30_000;

const cache = new Map<string, { readonly at: number; readonly value: Promise<ChatGptAuthStatus> }>();
let listening = false;

export function clearCachedAuthStatus(): void {
  cache.clear();
}

export function fetchCachedAuthStatus(providerId: string, signal?: AbortSignal): Promise<ChatGptAuthStatus> {
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener(COMPANION_AUTH_CHANGED_EVENT, clearCachedAuthStatus);
  }
  const hit = cache.get(providerId);
  let value: Promise<ChatGptAuthStatus>;
  if (hit && Date.now() - hit.at < AUTH_STATUS_CACHE_MS) {
    value = hit.value;
  } else {
    // 여러 호출이 한 요청을 나눠 쓰므로 한 호출의 중단 신호를 공유 요청에 넘기지 않는다. 실패는 캐시에 남기지 않는다.
    value = fetchChatGptAuthStatus(providerId);
    const entry = { at: Date.now(), value };
    cache.set(providerId, entry);
    value.catch(() => { if (cache.get(providerId) === entry) cache.delete(providerId); });
  }
  if (!signal) return value;
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const onAbort = (): void => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    value.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}
