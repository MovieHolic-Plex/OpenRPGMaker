import { findCharsetAsset } from "@/assets/charsetCatalog";
import reviewedCatalog from "@/assets/sharedCharacterGraphics.json";

/**
 * 걷기 그림(시트+칸) → 검토된 얼굴. **공용 대응표(sharedCharacterGraphics.json)가 유일한 정본이다.**
 *
 * 왜 따로 두는가: 2026-09-28 전수 조사에서 얼굴이 틀린 곳은 전부 이 대응표를 거치지 않은 경로였다 —
 * 기본 파티·배우 기본 얼굴·시작 마을·하늘계단은 "이름이 같은 시트가 짝" 이라는 옛 가정을 하드코딩했고,
 * AI 가 직접 넘긴 얼굴은 짝 검사 없이 저장됐다. 배우 기본 얼굴은 내보낸 게임(플레이어 번들)에서도
 * 쓰이므로, 스키마 검사(zod)를 끌고 오는 sharedCharacterGraphicsSchema 대신 JSON 을 직접 읽는다.
 *
 * - "exact"/"approximate" 둘 다 mapped 이면 얼굴이 있다. 근사라도 눈으로 보고 받아들인 짝이다.
 * - "no-face" 는 **얼굴이 없어야 하는** 칸이다(몬스터·사물·원본 얼굴 시트에 없는 인물).
 * - 대응표에 없는 그림(업로드 차셋 등)은 판단하지 않는다 — null 이 아니라 undefined 로 구분한다.
 */
export type ReviewedCharsetFace =
  | { readonly status: "mapped"; readonly faceResourceId: string; readonly quality: "exact" | "approximate" | "unspecified" }
  | { readonly status: "no-face" | "pending"; readonly faceResourceId: null };

type Row = { textureKey: string; characterIndex: number; status: string; faceResourceId: string | null; quality: string };
const ROWS = new Map<string, ReviewedCharsetFace>(
  (reviewedCatalog.mappings as readonly Row[]).map((row) => [
    `${row.textureKey}#${row.characterIndex}`,
    row.status === "mapped" && row.faceResourceId
      ? { status: "mapped", faceResourceId: row.faceResourceId, quality: row.quality as "exact" | "approximate" | "unspecified" }
      : { status: row.status === "pending" ? "pending" : "no-face", faceResourceId: null },
  ]),
);
/** 대응표가 얼굴로 쓰는 id 집합 — 저장본 교정이 "번들 얼굴인가" 를 판정할 때 쓴다. */
const REVIEWED_FACE_IDS = new Set((reviewedCatalog.faces as readonly { resourceId: string }[]).map((face) => face.resourceId));

/** 리소스 id 표기(easyrpg-charset-actor2)와 텍스처 키(tex_easyrpg_charset_actor2) 모두 받는다. */
export function canonicalCharsetTextureKey(idOrTextureKey: string): string {
  return findCharsetAsset(idOrTextureKey)?.textureKey ?? idOrTextureKey;
}

/** 대응표 행. 대응표가 모르는 그림이면 undefined(판단 보류). */
export function reviewedCharsetFaceRow(idOrTextureKey: string, characterIndex = 0): ReviewedCharsetFace | undefined {
  if (!Number.isInteger(characterIndex) || characterIndex < 0 || characterIndex > 7) return undefined;
  return ROWS.get(`${canonicalCharsetTextureKey(idOrTextureKey)}#${characterIndex}`);
}

/** 짝 얼굴 id. 얼굴이 없어야 하거나 대응표가 모르면 undefined. */
export function reviewedFaceIdForCharset(idOrTextureKey: string, characterIndex = 0): string | undefined {
  const row = reviewedCharsetFaceRow(idOrTextureKey, characterIndex);
  return row?.status === "mapped" ? row.faceResourceId : undefined;
}

/** 번들 대응표가 다루는 얼굴 id 인가(업로드·생성 얼굴은 false). */
export function isReviewedBundledFaceId(resourceId: string): boolean {
  return REVIEWED_FACE_IDS.has(resourceId);
}

/**
 * 조수가 **직접 넘긴** 얼굴을 걷기 그림과 대조한다. 2026-09-28 전수 조사: place_npc·make_villager·page.face·
 * 컷신 say.face·upsert_actor 다섯 곳 모두 노인 그림에 슬라임 얼굴을 넣어도 경고 없이 저장됐다.
 *
 * - 대응표가 모르는 그림(업로드 차셋)이나 번들이 아닌 얼굴(업로드·생성 초상·표정 세트)은 판단하지 않는다.
 * - 짝이 있는 그림에 다른 번들 얼굴이 오면 **짝으로 고친다**.
 * - 대응표가 "얼굴 없음" 인 그림(몬스터·사물·원본에 얼굴이 없는 인물)에 번들 얼굴이 오면 **얼굴을 뺀다**.
 * 고친 경우 경고 한 줄을 돌려준다 — 조수는 경고를 읽고 다음 호출을 고칠 수 있다.
 */
export function reconcileFaceWithCharset(
  faceResourceId: string,
  idOrTextureKey: string,
  characterIndex = 0,
): { readonly faceResourceId: string | null; readonly warning?: string } {
  const row = reviewedCharsetFaceRow(idOrTextureKey, characterIndex);
  if (!row || !isReviewedBundledFaceId(faceResourceId)) return { faceResourceId };
  if (row.status === "mapped") {
    if (row.faceResourceId === faceResourceId) return { faceResourceId };
    return {
      faceResourceId: row.faceResourceId,
      warning: `얼굴 ${faceResourceId} 는 걷기 그림 ${canonicalCharsetTextureKey(idOrTextureKey)}#${characterIndex} 와 다른 인물이라 짝 얼굴 ${row.faceResourceId} 로 바꿨습니다. 얼굴을 생략하면 짝이 자동으로 붙습니다.`,
    };
  }
  return {
    faceResourceId: null,
    warning: `걷기 그림 ${canonicalCharsetTextureKey(idOrTextureKey)}#${characterIndex} 에는 맞는 얼굴이 없어 얼굴 ${faceResourceId} 를 붙이지 않았습니다. 얼굴이 꼭 필요하면 generate_character_appearance 로 이 인물의 얼굴을 만드세요.`,
  };
}


