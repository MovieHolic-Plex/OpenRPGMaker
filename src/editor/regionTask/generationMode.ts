// editor/regionTask/generationMode.ts
// 영역 작업의 두 갈래 — 조수(LLM) 와 생성기(오퍼레이터).
//
// 기존 흐름을 갈아엎지 않기 위한 스위치다. 기본값은 언제나 "assistant" 이며,
// 저장된 값이 깨졌거나 없으면 조수로 떨어진다 — 즉 이 모듈이 통째로 실패해도
// 사용자는 지금까지 쓰던 화면을 그대로 본다.

export const GENERATION_MODE_STORAGE_KEY = "oprn:region-generation-mode";

export type GenerationMode = "assistant" | "operator";

export const DEFAULT_GENERATION_MODE: GenerationMode = "assistant";

export function isGenerationMode(value: unknown): value is GenerationMode {
  return value === "assistant" || value === "operator";
}

export function readGenerationMode(): GenerationMode {
  if (typeof localStorage === "undefined") return DEFAULT_GENERATION_MODE;
  try {
    const raw = localStorage.getItem(GENERATION_MODE_STORAGE_KEY);
    return isGenerationMode(raw) ? raw : DEFAULT_GENERATION_MODE;
  } catch {
    // 사생활 보호 모드 등에서 localStorage 접근이 막혀도 모달은 떠야 한다.
    return DEFAULT_GENERATION_MODE;
  }
}

export function writeGenerationMode(mode: GenerationMode): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(GENERATION_MODE_STORAGE_KEY, mode);
  } catch {
    /* 저장 실패는 무해하다 — 이번 세션 동안만 모드가 유지된다. */
  }
}
