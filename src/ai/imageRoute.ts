import type { AiConfig } from "./llmClient";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_PROVIDER_ID,
} from "./imageModelCatalog";
import { resolvePixelModel } from "./pixelModel";
import type { RoleModel } from "./modelRoles";

/**
 * 그림 용도 라우터 — 에디터·조수가 그림을 만드는 모든 용도를 **세 갈래**로 가르는 유일한 표(2026-10-16).
 *
 * - `generative`  배경·대형 그림(타이틀·오프닝·컷신·초상·배경…). 생성형 **이미지 모델**(설정 「이미지」 절의 첫 칸).
 * - `dot-text`    도트(타일셋·캐릭터셋·맵 기물). **텍스트 모델**이 격자 문자열로 찍는다(설정의 «도트 저작 모델»).
 *                 이미지 모델은 호출하지 않는다 — 눈금·팔레트·3/4 시점을 지키지 못하기 때문이다.
 * - `upload-only` 사용자가 올린 파일만 쓴다. 생성 경로가 없다.
 *
 * 표가 정본이다. 새 그림 경로는 여기 한 줄을 먼저 넣고, `generateAiImage` 호출에 그 용도를 넘긴다.
 * 근거(파일:줄)는 openwiki/editor-ai-panel.md 「이미지 용도 분리」 표.
 *
 * 제외(이 라우터를 거치지 않는 별도 경로, 건드리지 않는다): 몬스터·트레이너 전투 그림 하네스
 * (src/harnesses/monster-collect-species · battle-trainer-sprites — 생성 후 격자 도트화 + 사람이 고름).
 */
export type ImageRouteKind = "generative" | "dot-text" | "upload-only";

interface PurposeSpec {
  readonly kind: ImageRouteKind;
  /** 화면·로그에 쓰는 한국어 이름. */
  readonly label: string;
}

export const IMAGE_PURPOSES = {
  // ── 생성형 이미지 모델: 배경·대형 그림 ─────────────────────────────────────
  "title-art": { kind: "generative", label: "타이틀 키아트" },
  "title-logo": { kind: "generative", label: "타이틀 로고" },
  "title-depth": { kind: "generative", label: "타이틀 깊이 지도" },
  "opening-still": { kind: "generative", label: "오프닝·게임오버 스틸" },
  "cutscene-backdrop": { kind: "generative", label: "컷신 배경" },
  "cutscene-sprite": { kind: "generative", label: "컷신 소품 컷아웃" },
  "backdrop": { kind: "generative", label: "전투·맵·시차 배경" },
  "title-picture": { kind: "generative", label: "타이틀 배경 그림" },
  "picture": { kind: "generative", label: "그림 표시·일반 그림" },
  "faceset": { kind: "generative", label: "얼굴·흉상 초상" },
  "character-appearance": { kind: "generative", label: "캐릭터 외형 초상·흉상" },
  "item-icon": { kind: "generative", label: "아이템 아이콘" },
  "interview-scene": { kind: "generative", label: "새 게임 인터뷰 배경" },
  "concept-thumb": { kind: "generative", label: "컨셉 카드 썸네일" },
  // ── 텍스트 모델(도트 저작 모델): 격자 문자열로 찍는 도트 ───────────────────
  "tileset": { kind: "dot-text", label: "타일셋 조각" },
  "charset": { kind: "dot-text", label: "캐릭터셋(걷기 칩)" },
  "map-object": { kind: "dot-text", label: "맵 기물" },
  "interior-prop": { kind: "dot-text", label: "실내 기물" },
  // ── 사용자 업로드만 ─────────────────────────────────────────────────────
  "user-upload": { kind: "upload-only", label: "사용자 업로드" },
} as const satisfies Record<string, PurposeSpec>;

export type ImagePurpose = keyof typeof IMAGE_PURPOSES;

export function isImagePurpose(value: unknown): value is ImagePurpose {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(IMAGE_PURPOSES, value);
}

/** 라우터가 읽는 설정 부분. 브라우저(AiConfig)와 Bun 워커(요청에 실린 선택)가 같은 모양으로 넘긴다. */
export type ImageRouteConfig = Pick<AiConfig, "imageProviderId" | "imageModel" | "pixelModel" | "ultrabrainProviderId" | "ultrabrainModel" | "ultrabrainReasoningEffort">;

export type ImageRoute =
  | { readonly kind: "generative"; readonly purpose: ImagePurpose; readonly providerId: string; readonly model: string }
  | {
      readonly kind: "dot-text";
      readonly purpose: ImagePurpose;
      /** 격자를 쓰는 텍스트 모델. follows = 저장값이 없어 계획·최종 판단 모델을 따라간다(옛 설정). */
      readonly model: RoleModel;
      readonly follows: boolean;
      readonly surface: "workshop-draw";
    }
  | { readonly kind: "upload-only"; readonly purpose: ImagePurpose };

/**
 * 용도 하나가 어느 모델로 가는지 정한다. 순수 함수 — 모델을 부르지 않는다.
 * generative 의 호출별 providerId/model 지정은 `overrides` 가 이긴다(기존 generateAiImage 계약 그대로).
 */
export function resolveImageRoute(
  purpose: ImagePurpose,
  config: ImageRouteConfig,
  overrides: { readonly providerId?: string; readonly model?: string } = {},
): ImageRoute {
  const spec = IMAGE_PURPOSES[purpose];
  if (spec.kind === "generative") {
    return {
      kind: "generative",
      purpose,
      providerId: overrides.providerId ?? config.imageProviderId ?? DEFAULT_IMAGE_PROVIDER_ID,
      model: overrides.model ?? config.imageModel ?? DEFAULT_IMAGE_MODEL,
    };
  }
  if (spec.kind === "dot-text") {
    const pixel = resolvePixelModel(config);
    return { kind: "dot-text", purpose, model: pixel.model, follows: pixel.follows, surface: "workshop-draw" };
  }
  return { kind: "upload-only", purpose };
}

/** 이미지 모델로 만들 수 없는 용도에 보여 줄 안내. 도트·업로드 전용 용도가 생성 요청을 받았을 때. */
export function imageRouteRefusal(route: Exclude<ImageRoute, { kind: "generative" }>): string {
  const label = IMAGE_PURPOSES[route.purpose].label;
  return route.kind === "dot-text"
    ? `「${label}」은(는) 도트라서 이미지 모델로 만들지 않습니다. 공방에서 도트 저작 모델이 격자로 직접 찍습니다.`
    : `「${label}」은(는) 생성하지 않고 사용자가 올린 파일만 씁니다.`;
}
