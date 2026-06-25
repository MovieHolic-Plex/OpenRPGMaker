// 클라이언트 세션 저장 — 닉네임/user_id/subject_id를 localStorage에 보관.
// 재접속 시 자동 복원.

import type { Subject } from "@/types";

const KEY = "mcga.session";

export interface Session {
  nickname: string;
  user_id: string;
  subject: Subject;
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 스토리지 불가 시 무시 (시크릿 모드 등)
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
