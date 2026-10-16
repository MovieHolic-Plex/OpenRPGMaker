// 시간여행·제국군 직업 인물 걷기 칩 Heroes1(2026-10-16). RM2K3 CharSet 규격 288×256, 8명(4열×2행) × 3패턴 × 4방향(행 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽).
// 캐릭터 칩 하네스(`charset-actor`)가 RTP Actor/People 베이스 칩의 머리·옷·장비만 고쳐 쓴 CT·FF6풍 후보 중 pick-6 에서 채택한 8종.
// 사용자 위임(「pick-6 는 니 추천대로」)으로 채택. 시트와 명단(src/assets/heroesCharsets.json)은 `python3 src/harnesses/charset-actor/install_ct_ff6.py`
// 가 harness-data/charset-actor/ct-ff6-pick6/ 의 최종 격자를 그대로 굽는다(재생성·재저작 없음, 화소 해시는 명단에 기록).
// 칸 번호는 덧붙이기 전용이다. 명단의 desc 가 조수가 찾는 외형 문장이다. 베이스 칩 출처 크레딧: public/assets/ATTRIBUTION.md 「Heroes1」.
import type { EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";
import type { CharsetAge, CharsetGender, CharsetSemanticEntry } from "@/assets/charsetSemantics";
import roster from "@/assets/heroesCharsets.json";

interface HeroesCharacter {
  id: string; name: string; desc: string; genre: string; role: string;
  gender: CharsetGender | null; age: CharsetAge | null; tags: string[]; sheet: number; index: number;
}
const CHARACTERS = (roster as { characters: HeroesCharacter[] }).characters;
const SHEETS = Array.from({ length: (roster as { sheets: number }).sheets }, (_, i) => i + 1);

export const HEROES_CHARSET_ASSETS = SHEETS.map((n) => ({
  category: "charset",
  id: `oprn-charset-heroes${n}`,
  name: `Heroes${n} · 시간여행·제국군 직업 인물 · OPRN`,
  sourcePath: "src/harnesses/charset-actor/install_ct_ff6.py",
  path: `assets/generated/charsets/Heroes${n}.png`,
  fileName: `Heroes${n}.png`,
  textureKey: `tex_oprn_charset_heroes${n}`,
  group: "Heroes",
})) satisfies readonly EasyRpgCharsetAsset[];

export const HEROES_CHARSET_RESOURCE_IDS: readonly string[] = HEROES_CHARSET_ASSETS.flatMap((asset) => [asset.id, asset.textureKey]);

export function resolveHeroesCharsetUrl(resourceId: string): string | null {
  const asset = HEROES_CHARSET_ASSETS.find((entry) => entry.id === resourceId || entry.textureKey === resourceId);
  return asset ? `/${asset.path}` : null;
}

/** 조수가 이름·직업·외형으로 찾는 라벨(charsetSemantics 에 합쳐진다). 외형 문장은 명단의 desc. */
export const HEROES_CHARSET_SEMANTICS: readonly CharsetSemanticEntry[] = CHARACTERS.map((c) => ({
  textureKey: `tex_oprn_charset_heroes${c.sheet}`,
  characterIndex: c.index,
  label: c.name,
  ...(c.gender ? { gender: c.gender } : {}),
  ...(c.age ? { age: c.age } : {}),
  tags: [...new Set([c.name, c.genre, c.role, c.id, ...c.tags])],
  appearance: c.desc,
}));
