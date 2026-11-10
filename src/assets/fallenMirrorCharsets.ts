// 폴른 스타 하늘탑 3층 「렌즈 거울」 칩 FallenMirror1(2026-11-10, fs-vqa-obs). RM2K3 CharSet 규격 288×256.
// 칸 0 = 어두운 거울(남빛 유리), 칸 1 = 빛이 맺힌 거울. 방향 줄 = 거울 면이 향한 쪽(위 = 놋쇠 뒷판).
// 예전 판은 RTP Object2 의 누름 버튼·회보라 바위 칸이라 거울로 읽히지 않았다. 사람이 아닌 기물 칩이다(charsetFamily object).
// 그림 원본: scripts/content/fallen-tower-mirror/bake.py(코드 손 도트). 3/4 관문(object-gate)은 프로필 미보정이라 영수증이 없다.
import type { CharsetSemanticEntry } from "@/assets/charsetSemantics";
import type { EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";

export const FALLEN_MIRROR_TEXTURE = "tex_oprn_charset_fallen_mirror1";

export const FALLEN_MIRROR_CHARSET_ASSETS = [{
  category: "charset",
  id: "oprn-charset-fallen-mirror1",
  name: "FallenMirror1 · 렌즈 거울(어두움·빛) · OPRN",
  sourcePath: "scripts/content/fallen-tower-mirror/bake.py",
  path: "assets/generated/charsets/FallenMirror1.png",
  fileName: "FallenMirror1.png",
  textureKey: FALLEN_MIRROR_TEXTURE,
  group: "OPRN 기물",
}] as const satisfies readonly EasyRpgCharsetAsset[];

export const FALLEN_MIRROR_CHARSET_RESOURCE_IDS: readonly string[] = FALLEN_MIRROR_CHARSET_ASSETS.flatMap((asset) => [asset.id, asset.textureKey]);

export function resolveFallenMirrorCharsetUrl(resourceId: string): string | null {
  const asset = FALLEN_MIRROR_CHARSET_ASSETS.find((entry) => entry.id === resourceId || entry.textureKey === resourceId);
  return asset ? `/${asset.path}` : null;
}

/** 조수가 「거울」「렌즈」「반사」로 찾는 라벨. 방향 줄 = 거울 면이 향한 쪽(아래 = 정면 유리, 위 = 놋쇠 뒷판). */
export const FALLEN_MIRROR_CHARSET_SEMANTICS: readonly CharsetSemanticEntry[] = [
  { textureKey: FALLEN_MIRROR_TEXTURE, characterIndex: 0, label: "어두운 렌즈 거울", tags: ["거울", "렌즈", "반사", "빛 퍼즐", "천문대", "mirror", "기물"],
    appearance: "돌 받침 위 놋쇠 둥근 틀에 끼운 남빛 유리 거울. 방향 줄이 거울 면이 향한 쪽이다(아래 정면 유리·옆 얇은 원판·위 놋쇠 뒷판)." },
  { textureKey: FALLEN_MIRROR_TEXTURE, characterIndex: 1, label: "빛이 맺힌 렌즈 거울", tags: ["거울", "렌즈", "반사", "빛 퍼즐", "빛", "천문대", "mirror", "기물"],
    appearance: "돌 받침 위 놋쇠 둥근 틀의 옅은 유리 거울에 흰 반짝임과 따뜻한 테두리 빛. 방향 줄이 거울 면이 향한 쪽이다." },
];
