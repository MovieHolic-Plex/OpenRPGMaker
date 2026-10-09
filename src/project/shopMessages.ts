import type { ResolvedTerms } from "@/project/terms";
import type { ShopMessageType } from "@/project/types/events";

/**
 * 상점 문구 정본. 에디터 미리보기와 런타임이 **같은 함수**를 부른다.
 *
 * 예전에는 두 곳에 문구가 따로 박혀 있어서
 *  - 에디터 미리보기는 "어심 오세요! 무엇이 필요하신가요?" (오타, 그리고 용어집을 안 읽음)
 *  - 런타임은 terms.shopGreeting = "어서 오세요."
 * 로 갈라졌다. 용어를 바꿔도 편집창 문구는 그대로였다.
 */
export const SHOP_MESSAGE_TYPES: readonly ShopMessageType[] = [
  "welcome",
  "business",
  "direct",
  "festival",
  "closingSale",
  "vip",
];

/** 편집창 드롭다운 라벨 — 6종 전부 노출한다(예전에는 앞의 3종만 저작 가능했다). */
export const SHOP_MESSAGE_LABELS: Readonly<Record<ShopMessageType, string>> = {
  welcome: "인사말",
  business: "둘러보기",
  direct: "고르기",
  festival: "축제 특가",
  closingSale: "마감 세일",
  vip: "VIP",
};

/** 입구 인사말. welcome 만 용어집을 따라가고 나머지는 상황 문구다. */
export function shopGreetingText(messageType: ShopMessageType | undefined, terms: ResolvedTerms): string {
  switch (messageType ?? "welcome") {
    case "business":
      return "무엇이 필요하신가요?";
    case "direct":
      return "물건을 고르세요.";
    case "festival":
      return "축제 특가! 오늘만 이 가격!";
    case "closingSale":
      return "마감 세일 중! 어서 고르세요!";
    case "vip":
      return "VIP 고객님, 어서 오세요.";
    case "welcome":
    default:
      return terms.shopGreeting;
  }
}

/** 목록 머리글(도움말 창의 기본 문구). */
export function shopListHeaderText(messageType: ShopMessageType | undefined): string {
  switch (messageType ?? "welcome") {
    case "direct":
      return "물건 하나를 고르세요.";
    case "festival":
      return "축제 한정 특가 목록입니다.";
    case "closingSale":
      return "마감 세일 목록 — 서두르세요!";
    case "vip":
      return "VIP 전용 혜택 목록입니다.";
    case "welcome":
    case "business":
    default:
      return "목록에서 물건을 고르세요.";
  }
}

/** 구매 탭 프롬프트. */
export function shopBuyPromptText(messageType: ShopMessageType | undefined): string {
  return (messageType ?? "welcome") === "welcome" ? "무엇을 구매하시겠습니까?" : "구매할 물건을 고르세요.";
}
