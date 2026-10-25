// 조수 v2 스위치 — 기본 꺼짐(v1). 켜는 길은 둘: 주소에 ?assistant=v2, 또는 localStorage 「oprn:assistant-v2」 = "1".
// 끄려면 ?assistant=v1 이나 저장값 "0". 기본값을 v2 로 바꾸는 것은 사용자 결정이다(openwiki/assistant-v2.md).
export const ASSISTANT_V2_STORAGE_KEY = "oprn:assistant-v2";

export function isAssistantV2Enabled(): boolean {
  try {
    const flag = typeof location !== "undefined" ? new URLSearchParams(location.search).get("assistant") : null;
    if (flag === "v2") return true;
    if (flag === "v1") return false;
    return typeof localStorage !== "undefined" && localStorage.getItem(ASSISTANT_V2_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
