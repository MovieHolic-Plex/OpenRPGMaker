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
export const WIZARDING_CHARSET_SEMANTICS: readonly CharsetSemanticEntry[] = CHARACTERS.map((c) => ({
  textureKey: `tex_oprn_charset_wizarding${c.sheet}`,
  characterIndex: c.index,
  label: c.name,
  tags: [c.name, "마법 학교", "해리포터풍", c.spaceName, c.id],
  appearance: c.desc,
}));
