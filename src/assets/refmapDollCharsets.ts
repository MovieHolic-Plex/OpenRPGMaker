// REFMAP 변형 인물 걷기 칩 RefmapDoll1~(2026-10-28). RM2K3 CharSet 규격 288×256, 시트당 8명(4열×2행) × 3패턴 × 4방향(행 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽).
// 비공개 생성기 char-gen 의 `refmap` 종이 인형: REFMAP 인물 242명 중 한 사람의 머리 덩어리를 다른 사람의 몸에 얹고 목을 다시 그린 칩이다.
// 짝 58,322개 → 숫자 관문 통과 4,798 → Kiro Opus 눈 검사 통과 2,793 → 같은 인물의 색 바꾼 쌍둥이 짝 93개 뺌 → 2,700(사용자 위임 「번들, 검수 위임」 2026-10-28). 원본 시트는 싣지 않는다.
// 사용자 결정(2026-10-28): REFMAP 제외(2026-10-06)의 예외 — 변형한 칩만, 게임 안에서 무료로. 소재 자체 판매·스토어 재배포는 계속 막는다(이름에 refmap 이 있어 스토어 낱말표가 막는다).
// 시트와 명단은 `python3 src/harnesses/charset-actor/install_refmap_dolls.py --from <char-gen export>` 가 굽는다. 크레딧: public/assets/ATTRIBUTION.md 「RefmapDoll」.
// 이 모듈은 명단 JSON 을 읽지 않는다 — 2,700명 이름·외형 문장이 내보낸 게임(플레이어)에 실리지 않게, 라벨은 refmapDollSemantics.ts(에디터 전용)에 둔다.
import type { EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";

/** 시트 수. 명단(refmapDollCharsets.json)의 sheets 와 같다(install_refmap_dolls.py 가 맞춰 쓴다). */
export const REFMAP_DOLL_SHEETS = 338;

export const REFMAP_DOLL_CHARSET_ASSETS = Array.from({ length: REFMAP_DOLL_SHEETS }, (_, i) => i + 1).map((n) => ({
  category: "charset",
  id: `oprn-charset-refmap-doll${n}`,
  name: `RefmapDoll${n} · REFMAP 변형 인물`,
  sourcePath: "src/harnesses/charset-actor/install_refmap_dolls.py",
  path: `assets/generated/charsets/RefmapDoll${n}.png`,
  fileName: `RefmapDoll${n}.png`,
  textureKey: `tex_oprn_charset_refmap_doll${n}`,
  group: "RefmapDoll",
})) satisfies readonly EasyRpgCharsetAsset[];

export const REFMAP_DOLL_CHARSET_RESOURCE_IDS: readonly string[] = REFMAP_DOLL_CHARSET_ASSETS.flatMap((asset) => [asset.id, asset.textureKey]);

export function resolveRefmapDollCharsetUrl(resourceId: string): string | null {
  const asset = REFMAP_DOLL_CHARSET_ASSETS.find((entry) => entry.id === resourceId || entry.textureKey === resourceId);
  return asset ? `/${asset.path}` : null;
}
