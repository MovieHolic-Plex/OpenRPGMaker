import type { ShopUiPreset } from "@/project/types";

/**
 * 상점 UI 프리셋 목록 — 편집기 선택지·로드 검증·런타임 기본값이 한 곳을 본다.
 * 명령에 프리셋이 없으면 "pixel"(도트 창 + 파티원별 능력치 비교)을 쓴다. 예전 기본값
 * "classic" 은 목록·가격만 남기고 비교와 파티를 지워서, 장비를 사도 무엇이 오르는지 보이지 않았다.
 * 명시적으로 "classic" 을 저장한 상점은 그대로 classic 이다.
 */
export const SHOP_UI_PRESETS: readonly ShopUiPreset[] = [
  "pixel", "classic", "tabs", "grid", "compare", "split", "cart", "stock", "story", "baram",
];

export const DEFAULT_SHOP_UI_PRESET: ShopUiPreset = "pixel";

export function isShopUiPreset(value: string): value is ShopUiPreset {
  return (SHOP_UI_PRESETS as readonly string[]).includes(value);
}

