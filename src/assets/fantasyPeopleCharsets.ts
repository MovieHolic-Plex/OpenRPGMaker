// 판타지 직업·마을 인물 걷기 칩 FantasyPeople1~(2026-11-27). RM2K3 CharSet 규격 288×256, 시트당 최대 8명(4열×2행) × 3패턴 × 4방향(행 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽).
// easyrpg-charset-batch 스킬(공식 EasyRPG RTP 뼈대 + 12배 눈 현미경 face-check + 8배 손·배 보행 역학 kinematics-check)로 제작·검증되어 사용자가 승인한 인물 칩.
// 시트와 명단(src/assets/fantasyPeopleCharsets.json)은 `python3 src/harnesses/charset-actor/install_fantasy_people.py` 가
// harness-data/charset-actor/fantasy-people-picks/ 의 최종 격자를 그대로 굽는다(재생성 없음, 화소 해시는 명단에 기록).
// 칸 번호는 덧붙이기 전용이다. 명단의 desc 가 조수가 찾는 외형 문장이다. 베이스 칩 출처 크레딧: public/assets/ATTRIBUTION.md 「FantasyPeople」.
import type { EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";
import type { CharsetAge, CharsetGender, CharsetSemanticEntry } from "@/assets/charsetSemantics";
import roster from "@/assets/fantasyPeopleCharsets.json" with { type: "json" };

interface FantasyPeopleCharacter {
  id: string; name: string; desc: string; genre: string; role: string;
  gender: CharsetGender | null; age: CharsetAge | null; tags: string[]; sheet: number; index: number;
}
const CHARACTERS = (roster as { characters: FantasyPeopleCharacter[] }).characters;
const SHEETS = Array.from({ length: (roster as { sheets: number }).sheets }, (_, i) => i + 1);

export const FANTASY_PEOPLE_CHARSET_ASSETS = SHEETS.map((n) => ({
  category: "charset",
  id: `oprn-charset-fantasy-people${n}`,
  name: `FantasyPeople${n} · 판타지 직업·마을 인물 · OPRN`,
  sourcePath: "src/harnesses/charset-actor/install_fantasy_people.py",
  path: `assets/generated/charsets/FantasyPeople${n}.png`,
  fileName: `FantasyPeople${n}.png`,
  textureKey: `tex_oprn_charset_fantasy_people${n}`,
  group: "FantasyPeople",
})) satisfies readonly EasyRpgCharsetAsset[];

export const FANTASY_PEOPLE_CHARSET_RESOURCE_IDS: readonly string[] = FANTASY_PEOPLE_CHARSET_ASSETS.flatMap((asset) => [asset.id, asset.textureKey]);

export function resolveFantasyPeopleCharsetUrl(resourceId: string): string | null {
  const asset = FANTASY_PEOPLE_CHARSET_ASSETS.find((entry) => entry.id === resourceId || entry.textureKey === resourceId);
  return asset ? `/${asset.path}` : null;
}

/** 조수가 이름·직업·외형으로 찾는 라벨(charsetSemantics 에 합쳐진다). 외형 문장은 명단의 desc. */
export const FANTASY_PEOPLE_CHARSET_SEMANTICS: readonly CharsetSemanticEntry[] = CHARACTERS.map((c) => ({
  textureKey: `tex_oprn_charset_fantasy_people${c.sheet}`,
  characterIndex: c.index,
  label: c.name,
  ...(c.gender ? { gender: c.gender } : {}),
  ...(c.age ? { age: c.age } : {}),
  tags: [...new Set([c.name, c.genre, c.role, c.id, ...c.tags])],
  appearance: c.desc,
}));
