// Charset 스프라이트 → FaceSet 리소스 매핑.
// EasyRPG RTP: People1/2·Actor1/2·Monster 페이스 시트가 있고, charset index 0~7 ↔ faceIndex 0~7이 대응한다.
// People3~5 등 전용 페이스가 없으면 People1/2로 폴백한다.

import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { EventPageGraphic, FaceGraphic } from "@/project/types";

const CHARSET_TO_FACESET: Readonly<Record<string, string>> = {
  tex_easyrpg_charset_people1: "easyrpg-faceset-people1",
  tex_easyrpg_charset_people2: "easyrpg-faceset-people2",
  // 전용 페이스 없음 → people1/2 폴백
  tex_easyrpg_charset_people3: "easyrpg-faceset-people1",
  tex_easyrpg_charset_people4: "easyrpg-faceset-people2",
  tex_easyrpg_charset_people5: "easyrpg-faceset-people1",
  tex_easyrpg_charset_actor1: "easyrpg-faceset-actor1",
  tex_easyrpg_charset_actor2: "easyrpg-faceset-actor2",
  tex_easyrpg_charset_actor3: "easyrpg-faceset-people1",
  tex_easyrpg_charset_actor4: "easyrpg-faceset-people2",
  tex_easyrpg_charset_monster1: "easyrpg-faceset-monster",
  tex_easyrpg_charset_monster2: "easyrpg-faceset-monster",
  tex_easyrpg_charset_monster3: "easyrpg-faceset-monster",
};

/** textureKey(charset) + characterIndex → FaceGraphic. 없으면 null. */
export function faceGraphicForCharset(
  textureKey: string,
  characterIndex = 0,
): FaceGraphic | null {
  const resourceId = CHARSET_TO_FACESET[textureKey]
    ?? inferFacesetFromTextureKey(textureKey);
  if (!resourceId) return null;
  const faceIndex = Math.max(0, Math.min(15, Math.trunc(characterIndex) || 0));
  return {
    resourceId,
    faceIndex,
    position: "left",
    flipHorizontally: false,
  };
}

/** EventPage graphic에서 페이스 추정. 투명 그래픽은 null. */
export function faceGraphicFromEventGraphic(graphic: EventPageGraphic): FaceGraphic | null {
  if (!graphic || graphic.transparent) return null;
  const sprite = graphic.sprite;
  if (!sprite || sprite.type !== "bundled" || !sprite.id) return null;
  const textureKey = sprite.id;
  let characterIndex = 0;
  if (typeof graphic.pattern === "number") {
    try {
      characterIndex = decodeCharsetFrameIndex(graphic.pattern).characterIndex;
    } catch {
      characterIndex = 0;
    }
  }
  return faceGraphicForCharset(textureKey, characterIndex);
}

function inferFacesetFromTextureKey(textureKey: string): string | null {
  const lower = textureKey.toLowerCase();
  if (lower.includes("people1")) return "easyrpg-faceset-people1";
  if (lower.includes("people2")) return "easyrpg-faceset-people2";
  if (lower.includes("people3") || lower.includes("people5")) return "easyrpg-faceset-people1";
  if (lower.includes("people4")) return "easyrpg-faceset-people2";
  if (lower.includes("actor1")) return "easyrpg-faceset-actor1";
  if (lower.includes("actor2")) return "easyrpg-faceset-actor2";
  if (lower.includes("monster")) return "easyrpg-faceset-monster";
  // resource id form: easyrpg-charset-people1
  if (lower.includes("charset-people1") || lower.endsWith("people1")) return "easyrpg-faceset-people1";
  if (lower.includes("charset-people2") || lower.endsWith("people2")) return "easyrpg-faceset-people2";
  return null;
}
