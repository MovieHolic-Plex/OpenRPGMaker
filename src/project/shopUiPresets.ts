import type { Project, ShopUiPreset } from "@/project/types";

export const SHOP_UI_PRESET_OPTIONS: readonly {
  readonly value: ShopUiPreset;
  readonly label: string;
  readonly hint: string;
}[] = [
  { value: "collector", label: "수집 게임 · 흰 창 도구점", hint: "상품·가격·보유 수량·설명과 수량 선택을 흰 도트 창에 표시합니다" },
  { value: "pixel", label: "도트 비교 상점 (기본)", hint: "도트 창에 파티원별 능력치 변화와 회복량을 바로 보여줍니다" },
  { value: "classic", label: "단순 목록 상점", hint: "상품명·가격·소지금 중심의 전통 상점" },
  { value: "tabs", label: "카테고리·일일 재고", hint: "카테고리와 오늘의 판매 목록을 함께 보여줍니다" },
  { value: "grid", label: "진열 카드 상점", hint: "상품 카드와 상세 설명을 중심으로 보여줍니다" },
  { value: "compare", label: "장비 비교 상점", hint: "현재 장비와 구매 후 능력치를 나란히 비교합니다" },
  { value: "split", label: "구매·개조·판매·교환", hint: "거래 서비스를 독립 메뉴로 나눕니다" },
  { value: "cart", label: "양측 인벤토리 거래", hint: "플레이어와 상인의 물품을 동시에 비교합니다" },
  { value: "stock", label: "재고·흥정 상점", hint: "한정 재고·가격·할인·상인 예산을 강조합니다" },
  { value: "story", label: "대화 중심 상점", hint: "상인 대화와 추천 상품을 먼저 보여줍니다" },
  { value: "baram", label: "바람의 나라식 간결 메뉴", hint: "작은 메뉴창과 짧은 문구로 빠르게 거래합니다" },
];

/**
 * 상점 UI 프리셋 목록 — 편집기 선택지·로드 검증·런타임 기본값이 한 곳을 본다.
 * 명령에 프리셋이 없으면 "pixel"(도트 창 + 파티원별 능력치 비교)을 쓴다. 예전 기본값
 * "classic" 은 목록·가격만 남기고 비교와 파티를 지워서, 장비를 사도 무엇이 오르는지 보이지 않았다.
 * 명시적으로 "classic" 을 저장한 상점은 그대로 classic 이다.
 */
export const SHOP_UI_PRESETS: readonly ShopUiPreset[] = SHOP_UI_PRESET_OPTIONS.map((option) => option.value);

export const DEFAULT_SHOP_UI_PRESET: ShopUiPreset = "pixel";

export function isShopUiPreset(value: string): value is ShopUiPreset {
  return (SHOP_UI_PRESETS as readonly string[]).includes(value);
}

/** Explicit project presentation choice overrides event surfaces; commerce stays authored. */
export function effectiveShopUiPreset(step: { shopUiPreset?: ShopUiPreset }, project?: Project): ShopUiPreset {
  return project?.meta.oprnShopPreset ?? step.shopUiPreset ?? DEFAULT_SHOP_UI_PRESET;
}
