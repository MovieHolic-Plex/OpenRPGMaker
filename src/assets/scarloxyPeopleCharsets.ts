// 몬스터 수집용 사람 걷기 칩 ScarloxyPeople1~(2026-10-16). RM2K3 CharSet 규격 288×256, 시트당 8명(4열×2행) × 3패턴 × 4방향(행 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽).
// 사용자 결정: 「사람 칩은 기존 Scarloxy People 칩에서 변형해 늘린다」. 뼈대는 Scarloxy MPWSP01 People1~2 의 10명(CC BY 4.0)이고, 모델 호출 없는 스크립트
// (`scarloxy_compose.py`: 머리 이식 + 부위 색 바꾸기)와 실제 Argon 부분 편집(`scarloxy_argon2.py`)으로 만든 후보 중 감독이 눈으로 거른 칩이다(직군: 경찰·연구원·간호사·단원·낚시꾼·캠퍼·등산가·곤충채집·숲지기·탐험가·라이벌·트레이너·여학생·신관·도장 보스 …). 2차(시트 5~10, 45칸)는 8318 gemini-4-argon-high 부분 편집 36 + 스크립트 9: 점원·수영 선수·뱃사람·선장·노인·마을 주민·점쟁이·도장 보스 10종·남학생·역무원·등대지기·포획/낚시 대회 참가자·사육사 …
// 시트와 명단(src/assets/scarloxyPeopleCharsets.json)은 `python3 src/harnesses/charset-actor/install_scarloxy_people.py` 가 harness-data/charset-actor/scarloxy-people-chips/ 의 최종 격자를 그대로 굽는다(재생성·재저작 없음, 화소 해시는 명단에 기록).
// 칸 번호는 덧붙이기 전용이다. 명단의 desc 가 조수가 찾는 외형 문장이다. 이 칩은 charsetFamily 가 `scarloxy-people` 로 분류해 몬스터 수집 장르 잠금이 허용한다. 출처 크레딧: public/assets/ATTRIBUTION.md 「ScarloxyPeople」.
import type { EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";
import type { CharsetAge, CharsetGender, CharsetSemanticEntry } from "@/assets/charsetSemantics";
import roster from "@/assets/scarloxyPeopleCharsets.json";

interface ScarloxyPeopleCharacter {
  id: string; name: string; desc: string; genre: string; role: string;
  gender: CharsetGender | null; age: CharsetAge | null; tags: string[]; sheet: number; index: number;
}
const CHARACTERS = (roster as { characters: ScarloxyPeopleCharacter[] }).characters;
const SHEETS = Array.from({ length: (roster as { sheets: number }).sheets }, (_, i) => i + 1);

export const SCARLOXY_PEOPLE_CHARSET_ASSETS = SHEETS.map((n) => ({
  category: "charset",
  id: `oprn-charset-scarloxy-people${n}`,
  name: `ScarloxyPeople${n} · Scarloxy 변형 인물 · OPRN`,
  sourcePath: "src/harnesses/charset-actor/install_scarloxy_people.py",
  path: `assets/generated/charsets/ScarloxyPeople${n}.png`,
  fileName: `ScarloxyPeople${n}.png`,
  textureKey: `tex_oprn_charset_scarloxy_people${n}`,
  group: "ScarloxyPeople",
})) satisfies readonly EasyRpgCharsetAsset[];

export const SCARLOXY_PEOPLE_CHARSET_RESOURCE_IDS: readonly string[] = SCARLOXY_PEOPLE_CHARSET_ASSETS.flatMap((asset) => [asset.id, asset.textureKey]);

export function resolveScarloxyPeopleCharsetUrl(resourceId: string): string | null {
  const asset = SCARLOXY_PEOPLE_CHARSET_ASSETS.find((entry) => entry.id === resourceId || entry.textureKey === resourceId);
  return asset ? `/${asset.path}` : null;
}

/** 조수가 이름·직업·외형으로 찾는 라벨(charsetSemantics 에 합쳐진다). 외형 문장은 명단의 desc. */
export const SCARLOXY_PEOPLE_CHARSET_SEMANTICS: readonly CharsetSemanticEntry[] = CHARACTERS.map((c) => ({
  textureKey: `tex_oprn_charset_scarloxy_people${c.sheet}`,
  characterIndex: c.index,
  label: c.name,
  ...(c.gender ? { gender: c.gender } : {}),
  ...(c.age ? { age: c.age } : {}),
  tags: [...new Set([c.name, c.genre, c.role, c.id, ...c.tags])],
  appearance: c.desc,
}));
