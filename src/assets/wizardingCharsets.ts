// 마법 학교(해리포터풍) 걷기 칩 Wizarding1~N(2026-10). RM2K3 CharSet 규격 288×256, 8명(4열×2행) × 3패턴 × 4방향(행 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽).
// 그림 원본: scripts/content/wizarding/pieces/characters_*.py·creatures.py(python3 손 도트) + 슈퍼하네스 데모에서 승인된 native 걷기 시트 5명.
// 시트와 명단(src/assets/wizardingCharsets.json)은 scripts/content/wizarding/bake_wz.py 가 검수 통과분만 굽는다. 명단의 desc 가 조수가 찾는 외형 문장이다.
import type { EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";
import type { CharsetSemanticEntry } from "@/assets/charsetSemantics";
import roster from "@/assets/wizardingCharsets.json";

interface WizardingCharacter { id: string; name: string; space: string; spaceName: string; desc: string; sheet: number; index: number; source: string }
const CHARACTERS = (roster as { characters: WizardingCharacter[] }).characters;
const SHEETS = Array.from({ length: (roster as { sheets: number }).sheets }, (_, i) => i + 1);

export const WIZARDING_CHARSET_ASSETS = SHEETS.map((n) => ({
  category: "charset",
  id: `oprn-charset-wizarding${n}`,
  name: `Wizarding${n} · 마법 학교 인물·생물 · OPRN`,
  sourcePath: "scripts/content/wizarding/bake_wz.py",
  path: `assets/generated/charsets/Wizarding${n}.png`,
  fileName: `Wizarding${n}.png`,
  textureKey: `tex_oprn_charset_wizarding${n}`,
  group: "Wizarding",
})) satisfies readonly EasyRpgCharsetAsset[];

export const WIZARDING_CHARSET_RESOURCE_IDS: readonly string[] = WIZARDING_CHARSET_ASSETS.flatMap((asset) => [asset.id, asset.textureKey]);

export function resolveWizardingCharsetUrl(resourceId: string): string | null {
  const asset = WIZARDING_CHARSET_ASSETS.find((entry) => entry.id === resourceId || entry.textureKey === resourceId);
  return asset ? `/${asset.path}` : null;
}

/** 조수가 이름·공간·외형으로 찾는 라벨(charsetSemantics 에 합쳐진다). 외형 문장은 명단의 desc. */
// 조수의 외형 검색(list_npc_graphics)이 「마법약 교수」「호그와트 학생」「부엉이 관리인」 같은 말로도 찾게 —
// 이름·공간 이름을 낱말로 쪼개고, 역할 낱말에 흔한 다른 말을 더한다.
const ROLE_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  교사: ["교수", "선생님", "선생"], 교수: ["교사", "선생님", "선생"], 학생: ["신입생", "동급생", "학생 마법사"],
  관리인: ["관리자", "사육사", "경비"], 사서: ["도서관", "도서관 사서"], 치료사: ["간호사", "의무실", "치료 마법사"],
  조교: ["조수"], 장인: ["주인", "상인", "지팡이 장인"], 직원: ["점원", "상인"], 안내인: ["안내원", "뱃사공"],
  배달원: ["우체부", "부엉이 우편"], 정비사: ["관리인", "시계탑"], 선수: ["퀴디치", "운동선수"], 환자: ["부상자"],
};
const EXTRA_TAGS: Readonly<Record<string, readonly string[]>> = {
  "부엉이 우편 담당 학생": ["부엉이 관리인", "부엉이 사육사", "부엉이 탑"],
  "성 관리인": ["관리인", "수위", "성 관리자"],
  "교수": ["마법 학교 교수", "선생님"],
};
function wizardingTags(c: { readonly name: string; readonly spaceName: string; readonly id: string }): string[] {
  const words = [...c.name.split(/[\s()·]+/u), ...c.spaceName.split(/[\s()·]+/u)].filter((w) => w.length >= 2);
  const roles = words.flatMap((w) => ROLE_SYNONYMS[w] ?? []);
  const compound = words.filter((w) => !ROLE_SYNONYMS[w]).flatMap((w) => words.filter((r) => ROLE_SYNONYMS[r]).flatMap((r) => [`${w} ${r}`, ...(ROLE_SYNONYMS[r] ?? []).map((x) => `${w} ${x}`)]));
  return [...new Set([c.name, "마법 학교", "해리포터풍", "호그와트", "마법사", "마녀", "wizard", "witch", c.spaceName, c.id, ...words, ...roles, ...compound, ...(EXTRA_TAGS[c.name] ?? [])])];
}

export const WIZARDING_CHARSET_SEMANTICS: readonly CharsetSemanticEntry[] = CHARACTERS.map((c) => ({
  textureKey: `tex_oprn_charset_wizarding${c.sheet}`,
  characterIndex: c.index,
  label: c.name,
  tags: wizardingTags(c),
  appearance: c.desc,
}));
