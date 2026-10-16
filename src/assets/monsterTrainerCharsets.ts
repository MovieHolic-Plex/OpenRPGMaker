// 몬스터 수집 게임용 사람 걷기 칩 MonsterTrainer(2026-10-16). RM2K3 CharSet 규격 288×256, 시트마다 8명(4열×2행) × 3패턴 × 4방향(행 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽).
// 캐릭터 칩 하네스(`charset-actor`)가 RTP Actor/People 베이스 칩의 머리·옷·장비만 부위 마스크 안에서 고쳐 쓴 트레이너·NPC 칩이다
// (모델 gemini-4-argon-high, 12프레임 픽셀 동일성 검사 통과분만). 시트와 명단(src/assets/monsterTrainerCharsets.json)은
// `python3 src/harnesses/charset-actor/install_monster_trainer.py` 가 harness-data/charset-actor/monster-trainer-chips/ 의 최종 격자를 그대로 굽는다
// (재생성·재저작 없음, 화소 해시는 명단에 기록). 칸 번호는 덧붙이기 전용이다. 명단의 desc 가 조수가 찾는 외형 문장이다.
// 베이스 칩 출처 크레딧: public/assets/ATTRIBUTION.md 「MonsterTrainer」. 장르 잠금 계열 id 는 "monster-trainer"(project/charsetFamily.ts).
import type { EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";
import type { CharsetAge, CharsetGender, CharsetSemanticEntry } from "@/assets/charsetSemantics";
import roster from "@/assets/monsterTrainerCharsets.json";

interface MonsterTrainerCharacter {
  id: string; name: string; desc: string; genre: string; role: string;
  gender: CharsetGender | null; age: CharsetAge | null; tags: string[]; sheet: number; index: number;
}
const CHARACTERS = (roster as { characters: MonsterTrainerCharacter[] }).characters;
const SHEETS = Array.from({ length: (roster as { sheets: number }).sheets }, (_, i) => i + 1);

export const MONSTER_TRAINER_CHARSET_ASSETS = SHEETS.map((n) => ({
  category: "charset",
  id: `oprn-charset-monster-trainer${n}`,
  name: `MonsterTrainer${n} · 몬스터 수집 트레이너·마을 인물 · OPRN`,
  sourcePath: "src/harnesses/charset-actor/install_monster_trainer.py",
  path: `assets/generated/charsets/MonsterTrainer${n}.png`,
  fileName: `MonsterTrainer${n}.png`,
  textureKey: `tex_oprn_charset_monster_trainer${n}`,
  group: "MonsterTrainer",
})) satisfies readonly EasyRpgCharsetAsset[];

export const MONSTER_TRAINER_CHARSET_RESOURCE_IDS: readonly string[] = MONSTER_TRAINER_CHARSET_ASSETS.flatMap((asset) => [asset.id, asset.textureKey]);

export function resolveMonsterTrainerCharsetUrl(resourceId: string): string | null {
  const asset = MONSTER_TRAINER_CHARSET_ASSETS.find((entry) => entry.id === resourceId || entry.textureKey === resourceId);
  return asset ? `/${asset.path}` : null;
}

/** 조수가 이름·직업·외형으로 찾는 라벨(charsetSemantics 에 합쳐진다). 외형 문장은 명단의 desc. */
export const MONSTER_TRAINER_CHARSET_SEMANTICS: readonly CharsetSemanticEntry[] = CHARACTERS.map((c) => ({
  textureKey: `tex_oprn_charset_monster_trainer${c.sheet}`,
  characterIndex: c.index,
  label: c.name,
  ...(c.gender ? { gender: c.gender } : {}),
  ...(c.age ? { age: c.age } : {}),
  tags: [...new Set([c.name, c.genre, c.role, c.id, ...c.tags])],
  appearance: c.desc,
}));
