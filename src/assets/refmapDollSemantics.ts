// REFMAP 변형 인물 칩(RefmapDoll<n>)의 조수 검색 라벨 — 에디터 전용(charsetSemantics 에 합쳐진다). 시트 목록은 refmapDollCharsets.ts.
// 이름·외형 문장·역할·태그는 Kiro Opus 가 칩 8개씩(앞·옆모습) 보고 적은 것이다(char-gen `refmap.read_labels`). 원본 REFMAP 인물의 성별·나이 꼬리표를 힌트로 줬다.
import type { CharsetAge, CharsetGender, CharsetSemanticEntry } from "@/assets/charsetSemantics";
import roster from "@/assets/refmapDollCharsets.json";

interface RefmapDollCharacter {
  id: string; name: string; desc: string; genre: string; role: string;
  gender: CharsetGender | null; age: CharsetAge | null; tags: string[]; sheet: number; index: number;
}
const CHARACTERS = (roster as { characters: RefmapDollCharacter[] }).characters;

/** 역할 이름의 영어 낱말 — 조수가 영어로 찾을 때(「maid」「old merchant」)도 걸리게. 이름·태그는 한국어로만 적혀 있다. */
const ROLE_EN: Readonly<Record<string, readonly string[]>> = {
  "마을 사람": ["villager", "townsfolk"], 귀족: ["noble", "aristocrat"], 기사: ["knight"], 메이드: ["maid"], 아이: ["child", "kid"],
  모험가: ["adventurer"], 마법사: ["mage", "wizard", "sorcerer"], 병사: ["soldier", "guard"], 선원: ["sailor"], 왕족: ["royal", "prince", "princess", "king", "queen"],
  무희: ["dancer"], 하인: ["servant"], 상인: ["merchant", "shopkeeper"], 성직자: ["priest", "cleric"], 수녀: ["nun"], 노인: ["old man", "elder"],
  농부: ["farmer"], 요리사: ["cook", "chef"], 사냥꾼: ["hunter"], 학자: ["scholar"], 집사: ["butler"], 학생: ["student"], 전사: ["warrior"],
  대장장이: ["blacksmith"], 장교: ["officer"], 의사: ["doctor"], 어부: ["fisherman"],
};

export const REFMAP_DOLL_CHARSET_SEMANTICS: readonly CharsetSemanticEntry[] = CHARACTERS.map((c) => ({
  textureKey: `tex_oprn_charset_refmap_doll${c.sheet}`,
  characterIndex: c.index,
  label: c.name,
  ...(c.gender ? { gender: c.gender } : {}),
  ...(c.age ? { age: c.age } : {}),
  tags: [...new Set([c.name, c.genre, c.role, ...c.tags, ...(ROLE_EN[c.role] ?? [])])],
  appearance: c.desc,
}));
