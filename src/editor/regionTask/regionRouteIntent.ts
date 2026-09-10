// 한 문장 → 어느 실행 경로. 스펙 §5.1.
//
// 왜 이 모듈이 생겼나: 진입 화면이 "무엇을 만들지" 를 묻기 전에 "누구에게 말할지" 를 먼저
// 물었다(조수/생성기 모드 스위치 + 실내 초안 접기 + 카테고리 시트). 경로 선택은 사용자가
// **결과를 보기 전에는 판단할 수 없는 것**이라서, 그 질문은 답할 수 없는 질문이었다.
// 그래서 경로는 코드가 고르고, 사용자는 문장 하나만 쓴다.
//
// 규칙 하나: **경로를 정하려고 LLM 을 부르지 않는다.** 값싼 경로(키워드)로 확실한 것만
// 잡고, 못 잡으면 조수(LLM)로 넘긴다. 오라우팅은 결과 화면의 반대-경로 재실행으로 복구한다
// (스펙 §5.3) — 라우팅이 비싸지면 그 복구가 두 번 비싸진다.
//
// DOM·store 의존 없음. `heuristicOperatorIntent` 는 동기·순수이고 생성기를 특정하지
// 못하면 실패로 남긴다(추측하지 않는다) — 이 라우터의 성질이 거기서 나온다.
import {
  heuristicOperatorIntent,
  isOperatorIntentFailure,
} from "@/editor/operators/operatorIntent";
import type { InteriorThemeModifier } from "@/editor/interiorRoomPipeline";
import { DIRECT_INTERIOR_PRESETS, type DirectInteriorPresetId } from "./runDirectRoomDraft";
import { isRegionPolishRequest } from "./regionPolish";

export type RegionRoute =
  /** 입력이 비었거나 "주변과 어울리게" 어휘 — 대상은 이 사각형, 목표는 주변 어울림. */
  | { readonly kind: "polish"; readonly why: string }
  /** 생성기(오퍼레이터). LLM 0콜·결정적. */
  | {
    readonly kind: "operator";
    readonly operatorId: string;
    readonly params: Record<string, number | boolean | string>;
    readonly note: string;
    readonly why: string;
  }
  /** AI 없이 실내 초안. */
  | {
    readonly kind: "interior";
    readonly presetId: DirectInteriorPresetId;
    readonly modifier: InteriorThemeModifier | "";
    readonly note: string;
    readonly why: string;
  }
  /** 위 어느 것도 확실하지 않다 — 문장 그대로 조수에게 넘긴다. */
  | { readonly kind: "assistant"; readonly why: string };

/**
 * 실내 신호. 「여관」 한 단어로는 실내로 보내지 않는다 — "여관이 있는 마을" 은 마을이다.
 * 안/속을 말하는 낱말이 있어야 실내다.
 */
const INTERIOR_MARKER = /실내|내부|인테리어|집\s*안|건물\s*안|안쪽|방\s*배치|방을\s*나눠/;

const INTERIOR_PRESET_KEYWORDS: readonly { readonly id: DirectInteriorPresetId; readonly test: RegExp }[] = [
  { id: "manor", test: /대저택|저택|맨션|귀족/ },
  { id: "inn", test: /여관|숙소|주막|여인숙/ },
  { id: "home", test: /주거|살림|민가|가정집/ },
];

const INTERIOR_MODIFIER_KEYWORDS: readonly { readonly id: InteriorThemeModifier; readonly test: RegExp }[] = [
  { id: "luxury", test: /호화|화려|사치|고급/ },
  { id: "sacred", test: /신성|성소|사원|예배|신전/ },
  { id: "scholarly", test: /학구|서재|학자|연구|도서/ },
  { id: "martial", test: /무술|병영|무기|훈련/ },
  { id: "rustic", test: /소박|시골|촌스|투박/ },
];

const PRESET_LABEL = new Map<DirectInteriorPresetId, string>(
  DIRECT_INTERIOR_PRESETS.map((preset) => [preset.id, preset.label]),
);

/**
 * 문장에서 실내 초안 의도를 읽는다. 실내 신호가 없으면 null(= 실내가 아니다).
 * 프리셋을 특정할 낱말이 없으면 가장 중립적인 「주거 3실」로 둔다 — 무엇으로 읽었는지는
 * `note` 에 남고, 결과 화면의 「조절…」에서 바꿀 수 있다.
 */
export function resolveInteriorIntent(instruction: string): {
  readonly presetId: DirectInteriorPresetId;
  readonly modifier: InteriorThemeModifier | "";
  readonly note: string;
} | null {
  const text = instruction.trim();
  if (!text || !INTERIOR_MARKER.test(text)) return null;
  const presetId = INTERIOR_PRESET_KEYWORDS.find((entry) => entry.test.test(text))?.id ?? "home";
  const modifier = INTERIOR_MODIFIER_KEYWORDS.find((entry) => entry.test.test(text))?.id ?? "";
  const label = PRESET_LABEL.get(presetId) ?? presetId;
  return { presetId, modifier, note: `${label}${modifier ? ` + ${modifier}` : ""}` };
}

/**
 * 문장 → 경로. 순서가 곧 정책이다.
 *
 * 1. 빈 입력 → 다듬기 (버튼 하나가 「다듬기」와 「실행」 둘을 겸한다)
 * 2. 다듬기 어휘 → 다듬기 (기존 `isRegionPolishRequest` 그대로)
 * 3. 실내 신호 → 실내 초안 (AI 0콜)
 * 4. 생성기 키워드 → 생성기 (AI 0콜)
 * 5. 나머지 → 조수
 */
export function resolveRegionRoute(instruction: string): RegionRoute {
  const text = instruction.trim();
  if (!text) return { kind: "polish", why: "입력이 비어 있음" };
  if (isRegionPolishRequest(text)) return { kind: "polish", why: "다듬기 어휘" };

  const interior = resolveInteriorIntent(text);
  if (interior) {
    return {
      kind: "interior",
      presetId: interior.presetId,
      modifier: interior.modifier,
      note: interior.note,
      why: "실내 낱말",
    };
  }

  const intent = heuristicOperatorIntent(text);
  if (!isOperatorIntentFailure(intent)) {
    return {
      kind: "operator",
      operatorId: intent.operatorId,
      params: intent.params,
      note: intent.note,
      why: "생성기 키워드",
    };
  }

  return { kind: "assistant", why: "키워드로 확실하지 않음" };
}

/** 결과 화면에서 「반대 경로로 다시」 버튼이 무엇이 되어야 하나. 같은 문장을 다른 길로 보낸다. */
export function oppositeRouteLabel(kind: RegionRoute["kind"]): string {
  return kind === "assistant" ? "생성기로 다시" : "AI로 다시";
}
