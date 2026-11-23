// ai/providerPin.ts
// 사용자가 AI 설정에서 직접 고른 연결(고정). 있으면 자동 선택(editor/panels/aiAutoProvider)이 바꾸지 않는다. 없으면 자동.
export const AI_PROVIDER_PIN_STORAGE_KEY = "oprn:ai-provider-pin";

export function loadProviderPin(): string | null {
  try { return typeof localStorage === "undefined" ? null : localStorage.getItem(AI_PROVIDER_PIN_STORAGE_KEY); } catch { return null; }
}

export function saveProviderPin(providerId: string | null): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (providerId) localStorage.setItem(AI_PROVIDER_PIN_STORAGE_KEY, providerId);
    else localStorage.removeItem(AI_PROVIDER_PIN_STORAGE_KEY);
  } catch { /* 저장소를 못 쓰면 고정 없이 자동으로 돈다 */ }
}
