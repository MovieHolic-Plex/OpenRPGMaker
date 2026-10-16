// 현대 연애물 인물 걷기 칩 Modern1~3(2026-10-16). RM2K3 CharSet 규격 288×256, 시트당 8명(4열×2행) × 3패턴 × 4방향(행 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽).
// 캐릭터 칩 하네스(`charset-actor`)가 RTP Actor/People 베이스 칩의 상의·하의·신발·머리만 고쳐 쓴(소품 없음) 후보 중, 사용자 위임(「직접 거르라」)으로 거른 24종:
// 교복 남·여 9, 캐주얼 남·여 7, 정장 남·여 3, 카페 점원 3, 선생·교수 2. 시트와 명단(src/assets/modernCharsets.json)은
// `python3 src/harnesses/charset-actor/install_modern_romance.py` 가 harness-data/charset-actor/romance-pick1/ 의 최종 격자를 그대로 굽는다(재생성·재저작 없음, 화소 해시는 명단에 기록).
// 칸 번호는 덧붙이기 전용이다. 명단의 desc 가 조수가 찾는 외형 문장이다. 베이스 칩 출처 크레딧: public/assets/ATTRIBUTION.md 「Modern1~3」.
import type { EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";
import type { CharsetAge, CharsetGender, CharsetSemanticEntry } from "@/assets/charsetSemantics";
import roster from "@/assets/modernCharsets.json";

interface ModernCharacter {
  id: string; name: string; desc: string; genre: string; role: string;
  gender: CharsetGender | null; age: CharsetAge | null; tags: string[]; sheet: number; index: number;
}
const CHARACTERS = (roster as { characters: ModernCharacter[] }).characters;
const SHEETS = Array.from({ length: (roster as { sheets: number }).sheets }, (_, i) => i + 1);

export const MODERN_CHARSET_ASSETS = SHEETS.map((n) => ({
  category: "charset",
  id: `oprn-charset-modern${n}`,
  name: `Modern${n} · 현대 연애 인물 · OPRN`,
  sourcePath: "src/harnesses/charset-actor/install_modern_romance.py",
  path: `assets/generated/charsets/Modern${n}.png`,
  fileName: `Modern${n}.png`,
  textureKey: `tex_oprn_charset_modern${n}`,
  group: "Modern",
})) satisfies readonly EasyRpgCharsetAsset[];

export const MODERN_CHARSET_RESOURCE_IDS: readonly string[] = MODERN_CHARSET_ASSETS.flatMap((asset) => [asset.id, asset.textureKey]);

export function resolveModernCharsetUrl(resourceId: string): string | null {
  const asset = MODERN_CHARSET_ASSETS.find((entry) => entry.id === resourceId || entry.textureKey === resourceId);
  return asset ? `/${asset.path}` : null;
}

/** 조수가 이름·직업·외형으로 찾는 라벨(charsetSemantics 에 합쳐진다). 외형 문장은 명단의 desc. */
export const MODERN_CHARSET_SEMANTICS: readonly CharsetSemanticEntry[] = CHARACTERS.map((c) => ({
  textureKey: `tex_oprn_charset_modern${c.sheet}`,
  characterIndex: c.index,
  label: c.name,
  ...(c.gender ? { gender: c.gender } : {}),
  ...(c.age ? { age: c.age } : {}),
  tags: [...new Set([c.name, c.genre, c.role, c.id, ...c.tags])],
  appearance: c.desc,
}));
