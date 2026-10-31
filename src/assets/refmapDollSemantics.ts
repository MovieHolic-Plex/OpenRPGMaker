// REFMAP 변형 인물 칩(RefmapDoll<n>)의 조수 검색 라벨 — 에디터 전용(charsetSemantics 에 합쳐진다). 시트 목록은 refmapDollCharsets.ts.
// 이름·외형 문장·역할·태그는 Kiro Opus 가 칩 8개씩(앞·옆모습) 보고 적은 것이다(char-gen `refmap.read_labels`). 원본 REFMAP 인물의 성별·나이 꼬리표를 힌트로 줬다.
import type { CharsetAge, CharsetGender, CharsetSemanticEntry } from "@/assets/charsetSemantics";
import roster from "@/assets/refmapDollCharsets.json";
import { hasRefmapDollBattler } from "@/assets/refmapDollCharsets";

interface RefmapDollCharacter {
  id: string; name: string; desc: string; genre: string; role: string;
  gender: CharsetGender | null; age: CharsetAge | null; tags: string[]; sheet: number; index: number;
}
const CHARACTERS = (roster as { characters: RefmapDollCharacter[] }).characters;

/** 전투 시트가 있는 칸에 붙는 태그 — 조수가 「전투」「파티」로 찾으면 걸린다(주인공·동료 후보). */
export const REFMAP_DOLL_BATTLE_TAGS = ["전투 그림", "파티", "동료", "주인공", "battle", "party"] as const;

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
  tags: [...new Set([c.name, c.genre, c.role, ...c.tags, ...(ROLE_EN[c.role] ?? []), ...(hasRefmapDollBattler(c.sheet, c.index) ? REFMAP_DOLL_BATTLE_TAGS : [])])],
  appearance: hasRefmapDollBattler(c.sheet, c.index) ? `${c.desc} (옆모습 전투 그림 있음 — 파티에 넣으면 전투에서 이 인물로 싸운다)` : c.desc,
}));
