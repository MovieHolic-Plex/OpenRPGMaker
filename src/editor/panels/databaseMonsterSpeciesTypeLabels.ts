// editor/panels/databaseMonsterSpeciesTypeLabels.ts
//
// 타입 id(fire·water·grass …)를 화면에 보일 한국어 이름으로 바꾼다. **표시 전용** — 저장값은 id 그대로다.
// 잘 알려진 id 만 옮기고, 프로젝트가 만든 타입(예: "바람", "shadow")은 id 를 그대로 보여 준다.

const KNOWN_TYPE_LABELS: Readonly<Record<string, string>> = {
  normal: "노말",
  fire: "불",
  water: "물",
  grass: "풀",
  electric: "전기",
  ice: "얼음",
  fighting: "격투",
  poison: "독",
  ground: "땅",
  flying: "비행",
  psychic: "에스퍼",
  bug: "벌레",
  rock: "바위",
  ghost: "고스트",
  dragon: "드래곤",
  dark: "악",
  steel: "강철",
  fairy: "페어리",
};

export function monsterTypeLabel(type: string): string {
  return KNOWN_TYPE_LABELS[type.trim().toLowerCase()] ?? type;
}

/** 칩 색을 고르는 키. 잘 알려진 타입만 색이 있고 나머지는 중립색이다. */
export function monsterTypeTone(type: string): string {
  const key = type.trim().toLowerCase();
  return key in KNOWN_TYPE_LABELS ? key : "custom";
}
