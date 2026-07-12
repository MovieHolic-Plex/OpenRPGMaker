// EasyRPG RTP 차셋(캐릭터셋) 시맨틱 라벨.
// 시트 배치: 4열×2행 (characterIndex 0~7), 각 캐릭터는 3프레임×4방향.
// monster1~3은 핸드오프 0.4에서 헤드리스 플레이테스트로 검증된 인덱스.
// people1~5/actor1~4/animal/object1~2/vehicles는 각 시트를 characterIndex 셀 단위로 잘라
// (scripts로 4열×2행 그리드 PNG 생성 후 Read 도구로 육안 확인) 라벨링했다.

export type CharsetGender = "male" | "female" | "none";
export type CharsetAge = "child" | "youth" | "middle" | "elder";

export interface CharsetSemanticEntry {
  readonly textureKey: string;
  readonly characterIndex: number;
  readonly label: string;
  readonly gender?: CharsetGender;
  readonly age?: CharsetAge;
  readonly tags: readonly string[];
}

type CharsetSemanticMeta = Pick<CharsetSemanticEntry, "gender" | "age">;
type RawEntry = readonly [index: number, label: string, tags: readonly string[], meta?: CharsetSemanticMeta];

function sheet(textureKey: string, rows: readonly RawEntry[]): CharsetSemanticEntry[] {
  return rows.map(([characterIndex, label, tags, meta]) => ({ textureKey, characterIndex, label, ...meta, tags: [label, ...tags] }));
}

export const CHARSET_SEMANTICS: readonly CharsetSemanticEntry[] = [
  // tex_easyrpg_charset_monster1 — 검증됨(핸드오프 0.4)
  { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 0, label: "슬라임", gender: "none", tags: ["슬라임", "몬스터", "약함", "젤리"] },
  { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 2, label: "벌", gender: "none", tags: ["벌", "몬스터", "곤충", "비행"] },
  { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 3, label: "유령", gender: "none", tags: ["유령", "몬스터", "언데드", "비행"] },
  { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 4, label: "해골", gender: "none", tags: ["해골", "몬스터", "언데드", "스켈레톤"] },
  { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 5, label: "좀비", gender: "none", tags: ["좀비", "몬스터", "언데드"] },
  // tex_easyrpg_charset_monster2 — 검증됨(핸드오프 0.4)
  { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 1, label: "청룡", gender: "none", tags: ["청룡", "용", "드래곤", "몬스터"] },
  { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 4, label: "모래 골렘", gender: "none", tags: ["모래 골렘", "골렘", "몬스터", "사막"] },
  { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 5, label: "녹룡", gender: "none", tags: ["녹룡", "용", "드래곤", "몬스터"] },
  // tex_easyrpg_charset_monster3 — 검증됨(핸드오프 0.4)
  { textureKey: "tex_easyrpg_charset_monster3", characterIndex: 0, label: "박쥐형 날짐승", gender: "none", tags: ["박쥐", "몬스터", "비행"] },
  { textureKey: "tex_easyrpg_charset_monster3", characterIndex: 5, label: "붉은 드래곤", gender: "none", tags: ["붉은 드래곤", "레드 드래곤", "용", "드래곤", "몬스터", "보스"] },

  // tex_easyrpg_charset_people1 — 일반 마을 주민.
  ...sheet("tex_easyrpg_charset_people1", [
    [0, "청년 남성 주민", ["주민", "청년", "남성", "모험가"], { gender: "male", age: "youth" }],
    [1, "어린 소녀", ["아이", "소녀", "어린이"], { gender: "female", age: "child" }],
    [2, "청년 모험가", ["주민", "청년", "모험가", "남성"], { gender: "male", age: "youth" }],
    [3, "젊은 여성 주민", ["주민", "여성", "청년"], { gender: "female", age: "youth" }],
    [4, "거친 남성 주민", ["주민", "야만인", "남성", "수염"], { gender: "male" }],
    [5, "숄 두른 여성 주민", ["주민", "여성", "청년"], { gender: "female", age: "youth" }],
    [6, "대머리 남성 주민", ["주민", "남성", "대머리", "중년"], { gender: "male", age: "middle" }],
    [7, "노파", ["노인", "여성", "할머니"], { gender: "female", age: "elder" }],
  ]),
  // tex_easyrpg_charset_people2 — 이색적인 주민/성직자.
  ...sheet("tex_easyrpg_charset_people2", [
    [0, "중절모 신사", ["상인", "신사", "남성", "모자"], { gender: "male" }],
    [1, "수녀", ["노인", "여성", "수녀", "성직자"], { gender: "female", age: "elder" }],
    [2, "승려", ["승려", "남성", "대머리", "성직자"], { gender: "male" }],
    [3, "이국적인 여성", ["여성", "이국적", "댄서"], { gender: "female" }],
    [4, "닌자 소녀", ["아이", "소녀", "닌자"], { gender: "female", age: "child" }],
    [5, "토끼 귀 여성", ["여성", "토끼", "코스튬"], { gender: "female" }],
    [6, "화려한 여왕", ["여왕", "여성", "화려함"], { gender: "female" }],
    [7, "요정 소녀", ["요정", "소녀", "아이", "날개"], { gender: "female", age: "child" }],
  ]),
  // tex_easyrpg_charset_people3 — 왕족/기사.
  ...sheet("tex_easyrpg_charset_people3", [
    [0, "왕", ["왕", "국왕", "남성", "왕관"], { gender: "male" }],
    [1, "여왕", ["여왕", "왕비", "여성", "왕관"], { gender: "female" }],
    [2, "왕자", ["왕자", "남성", "청년"], { gender: "male", age: "youth" }],
    [3, "공주", ["공주", "여성", "청년"], { gender: "female", age: "youth" }],
    [4, "노현자", ["노인", "현자", "마법사", "남성"], { gender: "male", age: "elder" }],
    [5, "보라 갑옷 기사", ["기사", "병사", "갑옷", "남성"], { gender: "male" }],
    [6, "귀족 남성", ["귀족", "남성", "중년"], { gender: "male", age: "middle" }],
    [7, "파란 갑옷 기사", ["기사", "병사", "갑옷", "날개"]],
  ]),
  // tex_easyrpg_charset_people4 — 이국적인 주민.
  ...sheet("tex_easyrpg_charset_people4", [
    [0, "노년 전사", ["노인", "전사", "병사", "남성"], { gender: "male", age: "elder" }],
    [1, "불량배", ["불량배", "남성", "청년", "선글라스"], { gender: "male", age: "youth" }],
    [2, "술탄", ["술탄", "이국적", "남성", "터번"], { gender: "male" }],
    [3, "사막 상인", ["상인", "이국적", "남성", "터번"], { gender: "male" }],
    [4, "승려", ["승려", "남성", "대머리"], { gender: "male" }],
    [5, "황금 왕", ["왕", "국왕", "남성", "황금"], { gender: "male" }],
    [6, "사막 노인", ["노인", "이국적", "남성", "터번"], { gender: "male", age: "elder" }],
    [7, "신비한 사제", ["사제", "신비", "남성", "로브"], { gender: "male" }],
  ]),
  // tex_easyrpg_charset_people5 — 여관/마을 NPC.
  ...sheet("tex_easyrpg_charset_people5", [
    [0, "청년 병사", ["병사", "기사", "남성", "청년"], { gender: "male", age: "youth" }],
    [1, "어린 소녀", ["아이", "소녀", "어린이"], { gender: "female", age: "child" }],
    [2, "청년 전사", ["전사", "남성", "청년"], { gender: "male", age: "youth" }],
    [3, "전통 의상 여성", ["여성", "전통의상", "기모노"], { gender: "female" }],
    [4, "난쟁이 병사", ["난쟁이", "병사", "남성"], { gender: "male" }],
    [5, "하녀", ["하녀", "여성", "메이드"], { gender: "female" }],
    [6, "여관 주인", ["여관", "여관주인", "상인", "남성", "중년"], { gender: "male", age: "middle" }],
    [7, "노학자", ["노인", "학자", "남성", "안경"], { gender: "male", age: "elder" }],
  ]),

  // tex_easyrpg_charset_actor1 — 영웅 파티 클래스(전사/마법사 계열).
  ...sheet("tex_easyrpg_charset_actor1", [
    [0, "청년 용사", ["전사", "용사", "주인공", "남성"], { gender: "male", age: "youth" }],
    [1, "빨간 로브 마법사", ["마법사", "여성", "로브"], { gender: "female" }],
    [2, "붉은 갑옷 기사", ["기사", "전사", "갑옷", "남성"], { gender: "male" }],
    [3, "붉은 갑옷 여전사", ["기사", "전사", "갑옷", "여성"], { gender: "female" }],
    [4, "검은 갑옷 기사", ["기사", "전사", "갑옷", "남성", "다크나이트"], { gender: "male" }],
    [5, "마녀", ["마법사", "마녀", "여성", "날개"], { gender: "female" }],
    [6, "청록 로브 마법사", ["마법사", "남성", "로브"], { gender: "male" }],
    [7, "파란 로브 현자", ["마법사", "현자", "남성", "로브"], { gender: "male" }],
  ]),
  // tex_easyrpg_charset_actor2 — 영웅 파티 클래스(궁수/도적 계열).
  ...sheet("tex_easyrpg_charset_actor2", [
    [0, "회색 머리 도적", ["도적", "전사", "남성"], { gender: "male" }],
    [1, "청년 기사", ["기사", "전사", "남성", "청년"], { gender: "male", age: "youth" }],
    [2, "녹색 망토 레인저", ["궁수", "레인저", "남성"], { gender: "male" }],
    [3, "녹색 후드 궁수", ["궁수", "레인저", "남성"], { gender: "male" }],
    [4, "황금 갑옷 전사", ["전사", "갑옷", "남성", "수염"], { gender: "male" }],
    [5, "어둠의 여마법사", ["마법사", "여성", "다크메이지"], { gender: "female" }],
    [6, "엘프 궁수", ["궁수", "엘프", "남성"], { gender: "male" }],
    [7, "금발 궁수", ["궁수", "레인저", "남성"], { gender: "male" }],
  ]),
  // tex_easyrpg_charset_actor3 — 영웅 파티 클래스(사무라이/오리엔탈 계열).
  ...sheet("tex_easyrpg_charset_actor3", [
    [0, "사무라이", ["사무라이", "전사", "갑옷", "남성"], { gender: "male" }],
    [1, "떠돌이 검객", ["도적", "검객", "남성"], { gender: "male" }],
    [2, "가면 전사", ["기사", "전사", "가면", "남성"], { gender: "male" }],
    [3, "노년 사무라이", ["노인", "사무라이", "남성"], { gender: "male", age: "elder" }],
    [4, "녹색 후드 여인", ["여성", "허브", "드루이드"], { gender: "female" }],
    [5, "무도가", ["무도가", "전사", "남성"], { gender: "male" }],
    [6, "적발 검사", ["전사", "검사", "남성"], { gender: "male" }],
    [7, "왕관 쓴 귀족", ["왕", "귀족", "남성"], { gender: "male" }],
  ]),
  // tex_easyrpg_charset_actor4 — 영웅 파티 클래스(마법사/성직자 계열).
  ...sheet("tex_easyrpg_charset_actor4", [
    [0, "청년 마법사", ["마법사", "남성", "청년"], { gender: "male", age: "youth" }],
    [1, "사제", ["사제", "성직자", "남성"], { gender: "male" }],
    [2, "황금 가면 전사", ["기사", "전사", "가면", "남성"], { gender: "male" }],
    [3, "여성 닌자", ["닌자", "도적", "여성"], { gender: "female" }],
    [4, "황금 갑옷 여전사", ["기사", "전사", "갑옷", "여성"], { gender: "female" }],
    [5, "초록 갑옷 여전사", ["전사", "갑옷", "여성"], { gender: "female" }],
    [6, "어둠의 여마법사", ["마법사", "여성", "다크메이지"], { gender: "female" }],
    [7, "붉은 마녀", ["마법사", "마녀", "여성"], { gender: "female" }],
  ]),

  // tex_easyrpg_charset_animal — 동물.
  ...sheet("tex_easyrpg_charset_animal", [
    [0, "주황 고양이", ["고양이", "동물"], { gender: "none" }],
    [1, "검은 고양이", ["고양이", "동물"], { gender: "none" }],
    [2, "닭", ["닭", "동물", "가금류"], { gender: "none" }],
    [3, "양", ["양", "동물"], { gender: "none" }],
    [4, "소", ["소", "동물", "가축"], { gender: "none" }],
    [5, "말", ["말", "동물", "가축"], { gender: "none" }],
    [6, "호랑이", ["호랑이", "동물", "야생"], { gender: "none" }],
    [7, "고슴도치", ["고슴도치", "동물"], { gender: "none" }],
  ]),

  // tex_easyrpg_charset_object1 — 문/상자류.
  ...sheet("tex_easyrpg_charset_object1", [
    [0, "나무 문(패널)", ["문", "나무문", "입구"], { gender: "none" }],
    [1, "나무 문(판자)", ["문", "나무문", "입구"], { gender: "none" }],
    [2, "이중 나무문", ["문", "나무문", "입구"], { gender: "none" }],
    [3, "철문", ["문", "철문", "입구"], { gender: "none" }],
    [4, "철문(단일)", ["문", "철문", "입구"], { gender: "none" }],
    [5, "감옥 문", ["문", "감옥", "철창"], { gender: "none" }],
    [6, "보물 상자", ["보물상자", "상자", "보물"], { gender: "none" }],
    [7, "나무 통", ["나무통", "통", "상자"], { gender: "none" }],
  ]),
  // tex_easyrpg_charset_object2 — 기타 사물/기믹.
  ...sheet("tex_easyrpg_charset_object2", [
    [0, "레버", ["레버", "스위치", "기믹"], { gender: "none" }],
    [1, "밧줄 뭉치", ["밧줄", "기믹"], { gender: "none" }],
    [2, "금고", ["금고", "상자", "보물"], { gender: "none" }],
    [3, "받침대", ["받침대", "스위치", "기믹"], { gender: "none" }],
    [4, "바닥 스위치", ["스위치", "기믹", "바닥"], { gender: "none" }],
    [5, "바위", ["바위", "돌", "장애물"], { gender: "none" }],
    [6, "보석", ["보석", "크리스탈", "보물"], { gender: "none" }],
    [7, "서랍장", ["서랍장", "가구"], { gender: "none" }],
  ]),

  // tex_easyrpg_charset_vehicles — 탈것.
  ...sheet("tex_easyrpg_charset_vehicles", [
    [0, "뗏목", ["뗏목", "탈것", "배"], { gender: "none" }],
    [1, "배", ["배", "탈것", "보트"], { gender: "none" }],
    [2, "함선", ["함선", "탈것", "배"], { gender: "none" }],
    [3, "열기구", ["열기구", "탈것", "비행"], { gender: "none" }],
    [4, "비행선", ["비행선", "탈것", "비행"], { gender: "none" }],
    [5, "탱크", ["탱크", "탈것"], { gender: "none" }],
    [6, "비행정", ["비행정", "탈것", "비행"], { gender: "none" }],
    [7, "우주선", ["우주선", "탈것", "비행"], { gender: "none" }],
  ]),

  // tex_scarloxy_charset_people1 — Scarloxy MPWSP01 팩 주민 (scripts/import-scarloxy-pack.py 변환,
  // 생성 프리뷰를 Read 도구로 육안 확인해 라벨링).
  ...sheet("tex_scarloxy_charset_people1", [
    [0, "초록 모자 트레이너 소년", ["주인공", "트레이너", "소년", "모자", "배낭", "scarloxy"], { gender: "male", age: "youth" }],
    [1, "금발 소년", ["소년", "금발", "주민", "scarloxy"], { gender: "male", age: "youth" }],
    [2, "초록 벙거지 소년", ["소년", "모자", "벙거지", "주민", "scarloxy"], { gender: "male", age: "youth" }],
    [3, "보라 머리 소녀", ["소녀", "보라 머리", "주민", "scarloxy"], { gender: "female", age: "youth" }],
    [4, "갈래머리 소녀", ["소녀", "아이", "갈래머리", "주민", "scarloxy"], { gender: "female", age: "child" }],
    [5, "남색 머리 소년", ["소년", "청년", "주민", "scarloxy"], { gender: "male", age: "youth" }],
    [6, "밀짚모자 농부", ["농부", "밀짚모자", "주민", "scarloxy"], { gender: "male" }],
    [7, "물 도장 보스", ["보스", "물", "트레이너", "청록 머리", "scarloxy"], { gender: "female" }],
  ]),
  // tex_scarloxy_charset_people2 — Scarloxy MPWSP01 팩 보스 트레이너.
  ...sheet("tex_scarloxy_charset_people2", [
    [0, "불 도장 보스", ["보스", "불", "트레이너", "scarloxy"], { gender: "male" }],
    [1, "풀 도장 보스", ["보스", "풀", "트레이너", "scarloxy"], { gender: "male" }],
  ]),
];

export function findCharsetSemantic(textureKey: string, characterIndex: number): CharsetSemanticEntry | undefined {
  return CHARSET_SEMANTICS.find((entry) => entry.textureKey === textureKey && entry.characterIndex === characterIndex);
}

export function charsetSemanticsForTexture(textureKey: string): readonly CharsetSemanticEntry[] {
  return CHARSET_SEMANTICS.filter((entry) => entry.textureKey === textureKey);
}
