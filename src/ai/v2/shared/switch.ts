// 조수 v2 스위치 — 기본 켜짐(v2). 오너 결정 2026-11-24(레인 fix1124-ai-gen): v1 기본이라 v2 다양화 수정이 사용자 화면에 닿지 않았다.
// 되돌리는 길은 둘: 주소에 ?assistant=v1, 또는 localStorage 「oprn:assistant-v2」 = "0". 주소 ?assistant=v2 는 저장값 "0" 보다 이긴다.
const ASSISTANT_V2_STORAGE_KEY = "oprn:assistant-v2";

export function isAssistantV2Enabled(): boolean {
  try {
    const flag = typeof location !== "undefined" ? new URLSearchParams(location.search).get("assistant") : null;
    if (flag === "v2") return true;
    if (flag === "v1") return false;
    return typeof localStorage === "undefined" || localStorage.getItem(ASSISTANT_V2_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}
