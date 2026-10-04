// EasyRPG RTP 차셋(캐릭터셋) 시맨틱 라벨.
// 시트 배치: 4열×2행 (characterIndex 0~7), 각 캐릭터는 3프레임×4방향.
// monster1~3은 핸드오프 0.4에서 헤드리스 플레이테스트로 검증된 인덱스.
// people1~5/actor1~4/animal/object1~2/vehicles는 각 시트를 characterIndex 셀 단위로 잘라
// (scripts로 4열×2행 그리드 PNG 생성 후 Read 도구로 육안 확인) 라벨링했다.
// appearance 는 아래 방향 정지 프레임을 보고 적은 문장이다 (charsetAppearances.ts).

import { CHARSET_APPEARANCE } from "@/assets/charsetAppearances";
import { sharedCharacterSemantics } from '@/project/sharedCharacters';

export type CharsetGender = "male" | "female" | "none";
export type CharsetAge = "child" | "youth" | "middle" | "elder";

export interface CharsetSemanticEntry {
  readonly spriteType?: 'bundled' | 'uploaded';
  readonly textureKey: string;
  readonly characterIndex: number;
  readonly label: string;
  readonly gender?: CharsetGender;
  readonly age?: CharsetAge;
  readonly tags: readonly string[];
  readonly appearance?: string;
}

type CharsetSemanticMeta = Pick<CharsetSemanticEntry, "gender" | "age">;
type RawEntry = readonly [index: number, label: string, tags: readonly string[], meta?: CharsetSemanticMeta];

function sheet(textureKey: string, rows: readonly RawEntry[]): CharsetSemanticEntry[] {
  return rows.map(([characterIndex, label, tags, meta]) => ({ textureKey, characterIndex, label, ...meta, tags: [label, ...tags] }));
}

const CHARSET_SEMANTICS_RAW: readonly CharsetSemanticEntry[] = [
  // tex_easyrpg_charset_monster1 — 2026-07-27 사용자 확정: 8칸 전부 채움.
  // 이전에는 0·2·3·4·5 만 있었고 **idx 2 를 "벌"이라 잘못 라벨**했다(실물은 오크).
  // 1·6·7 은 라벨이 없어 "검증되지 않은 칸"이었다 — 그래서 저작이 그 칸을 피하거나
  // 반대로 아무 뜻 없이 골라 썼다.
  { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 0, label: "슬라임", gender: "none", tags: ["슬라임", "몬스터", "약함", "젤리"] },
  { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 1, label: "붉은 악마", gender: "none", tags: ["악마", "붉은", "몬스터", "뿔"] },
  { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 2, label: "오크", gender: "none", tags: ["오크", "몬스터", "아인", "근접"] },
  { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 3, label: "유령", gender: "none", tags: ["유령", "몬스터", "언데드", "비행"] },
  { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 4, label: "해골", gender: "none", tags: ["해골", "몬스터", "언데드", "스켈레톤"] },
  { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 5, label: "좀비", gender: "none", tags: ["좀비", "몬스터", "언데드"] },
  { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 6, label: "스켈레톤 메이지", gender: "none", tags: ["스켈레톤", "메이지", "언데드", "마법", "몬스터"] },
  { textureKey: "tex_easyrpg_charset_monster1", characterIndex: 7, label: "미노타우르스", gender: "none", tags: ["미노타우르스", "몬스터", "뿔", "거대", "보스"] },
  // tex_easyrpg_charset_monster2 — 2026-07-27 사용자 확정: 8칸 전부 채움.
  // 이전에는 1·4·5 만 있었고 4 를 "모래 골렘", 5 를 "녹룡"이라 했다.
  // **idx 2 는 라벨이 아예 없었는데** 호수 신전의 봉인 3개가 전부 그 칸을 쓰고 있었다.
  { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 0, label: "하피", gender: "none", tags: ["하피", "몬스터", "비행", "날개"] },
  { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 1, label: "청룡", gender: "none", tags: ["청룡", "용", "드래곤", "몬스터"] },
  { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 2, label: "뱀파이어", gender: "none", tags: ["뱀파이어", "몬스터", "언데드", "귀족"] },
  { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 3, label: "마족 장군", gender: "none", tags: ["마족", "장군", "몬스터", "갑옷", "보스"] },
  { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 4, label: "스톤 골렘", gender: "none", tags: ["스톤 골렘", "골렘", "몬스터", "바위"] },
  { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 5, label: "드레이크", gender: "none", tags: ["드레이크", "용", "드래곤", "몬스터"] },
  { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 6, label: "악마", gender: "none", tags: ["악마", "몬스터", "무기", "보스"] },
  { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 7, label: "마왕", gender: "none", tags: ["마왕", "악마", "몬스터", "최종보스", "보스"] },
  // tex_easyrpg_charset_monster3
  // 2026-08-23 픽셀 실측 정정: 0 은 "박쥐형 날짐승"이 아니라 **붉은 머리 하피**다(Monster3.png
  // 프레임 25 = characterIndex 0/down). 이 라벨을 믿고 광산 박쥐 스폰에 쓴 결과 화면에
  // 붉은 머리 사람형이 떴다. 동굴 날짐승이 필요하면 monster2#1 을 쓸 것.
  { textureKey: "tex_easyrpg_charset_monster3", characterIndex: 0, label: "붉은 머리 하피", gender: "none", tags: ["하피", "유익 마인", "몬스터", "비행", "날개"] },
  { textureKey: "tex_easyrpg_charset_monster3", characterIndex: 5, label: "붉은 드래곤", gender: "none", tags: ["붉은 드래곤", "레드 드래곤", "용", "드래곤", "몬스터", "보스"] },

  // tex_easyrpg_charset_people1 — 일반 마을 주민.
  // 2026-07-27 사용자 확정 정정(0~5). 이전 라벨은 0 을 "청년 남성 주민", 4·5 를
  // "거친 남성 주민"·"숄 두른 여성 주민" 이라 했는데 실물은 아이 둘과 흑인 중년 부부다.
  ...sheet("tex_easyrpg_charset_people1", [
    [0, "남자아이", ["아이", "소년", "어린이", "주민"], { gender: "male", age: "child" }],
    [1, "여자아이", ["아이", "소녀", "어린이", "주민"], { gender: "female", age: "child" }],
    [2, "청년 남성", ["주민", "청년", "남성", "모험가"], { gender: "male", age: "youth" }],
    [3, "젊은 여성", ["주민", "여성", "청년"], { gender: "female", age: "youth" }],
    [4, "중년 남성 주민(흑인)", ["주민", "남성", "중년", "흑인"], { gender: "male", age: "middle" }],
    [5, "중년 여성 주민(흑인)", ["주민", "여성", "중년", "흑인"], { gender: "female", age: "middle" }],
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
  // tex_easyrpg_charset_people3 — 왕족과 그 시종.
  // 2026-07-27 사용자 확정 정정(4·5). 이전 라벨은 4 를 "노현자", 5 를 "보라 갑옷 기사"라 했는데
  // 실물은 집사와 여자 메이드다 — 성 안 시종 시트이지 마법사·기사 시트가 아니다.
  ...sheet("tex_easyrpg_charset_people3", [
    [0, "왕", ["왕", "국왕", "남성", "왕관"], { gender: "male" }],
    [1, "여왕", ["여왕", "왕비", "여성", "왕관"], { gender: "female" }],
    [2, "왕자", ["왕자", "남성", "청년"], { gender: "male", age: "youth" }],
    [3, "공주", ["공주", "여성", "청년"], { gender: "female", age: "youth" }],
    [4, "집사", ["집사", "시종", "남성", "정장"], { gender: "male", age: "middle" }],
    [5, "여자 메이드", ["메이드", "시종", "여성", "하녀"], { gender: "female" }],
    [6, "귀족 남성", ["귀족", "남성", "중년"], { gender: "male", age: "middle" }],
    [7, "파란 갑옷 기사", ["기사", "병사", "갑옷", "날개"]],
  ]),
  // tex_easyrpg_charset_people4 — 이국적인 주민.
  // 2026-07-27 사용자 확정 정정(0~7 전부). 이전 라벨은 0 을 "노년 전사", 5 를 "황금 왕"이라 했는데
  // 실물은 아이 둘로 시작하는 마을 주민 시트다. 사용자가 5·6 을 둘 다 "5번"으로 말했으므로
  // 실제 프레임을 4배로 잘라 육안 확인해 6 을 터번 노인, 7 을 터번 노파로 확정했다.
  ...sheet("tex_easyrpg_charset_people4", [
    [0, "빵모자 아이", ["아이", "어린이", "모자", "주민"], { age: "child" }],
    [1, "삐쭉머리 남자아이", ["아이", "소년", "어린이", "안경"], { gender: "male", age: "child" }],
    [2, "이국적인 모자 청년", ["청년", "남성", "이국적", "모자"], { gender: "male", age: "youth" }],
    [3, "머리 장식 이국 여성", ["여성", "이국적", "머리장식"], { gender: "female" }],
    [4, "대머리 이국 주민", ["주민", "대머리", "이국적", "남성"], { gender: "male" }],
    [5, "노란 전통옷 남성", ["남성", "이국적", "전통옷", "노란색"], { gender: "male" }],
    [6, "터번 노인", ["노인", "이국적", "남성", "터번"], { gender: "male", age: "elder" }],
    [7, "터번 노파", ["노인", "이국적", "여성", "터번"], { gender: "female", age: "elder" }],
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

  // tex_easyrpg_charset_actor1 — 2026-09-04 셀 확대 판독으로 교정: #4 는 갑옷이 아니라 망토 청년 마법사,
  // #5 는 마녀 모자의 젊은 여성 마법사, #7 은 파란 옷·파란 모자의 젊은 여성 마법사다.
  ...sheet("tex_easyrpg_charset_actor1", [
    [0, "청년 용사", ["전사", "용사", "주인공", "남성"], { gender: "male", age: "youth" }],
    [1, "빨간 로브 마법사", ["마법사", "여성", "로브"], { gender: "female" }],
    [2, "붉은 갑옷 기사", ["기사", "전사", "갑옷", "남성"], { gender: "male" }],
    [3, "붉은 갑옷 여전사", ["기사", "전사", "갑옷", "여성"], { gender: "female" }],
    [4, "젊은 남성 마법사", ["마법사", "남성", "청년", "망토"], { gender: "male", age: "youth" }],
    [5, "젊은 여성 마법사", ["마법사", "여성", "청년", "마녀", "모자"], { gender: "female", age: "youth" }],
    [6, "청록 로브 마법사", ["마법사", "남성", "로브"], { gender: "male" }],
    [7, "파란 옷 젊은 여성 마법사", ["마법사", "여성", "청년", "파란옷", "모자"], { gender: "female", age: "youth" }],
  ]),
  // tex_easyrpg_charset_actor2 — 2026-09-04 셀 확대 판독으로 교정: #1 은 회색 옷 젊은 여성(기사 아님),
  // #4 는 붉은 머리띠 중년 전사, #5 는 젊은 여성 도적, #6·#7 은 뾰족 귀 엘프(활 없음)다.
  ...sheet("tex_easyrpg_charset_actor2", [
    [0, "회색 머리 도적", ["도적", "전사", "남성"], { gender: "male" }],
    [1, "회색 옷 젊은 여성", ["여성", "청년", "회색옷"], { gender: "female", age: "youth" }],
    [2, "녹색 망토 레인저", ["궁수", "레인저", "남성"], { gender: "male" }],
    [3, "녹색 후드 궁수", ["궁수", "레인저", "남성"], { gender: "male" }],
    [4, "붉은 머리 중년 전사", ["전사", "갑옷", "남성", "중년", "붉은머리", "머리띠"], { gender: "male", age: "middle" }],
    [5, "젊은 여성 도적", ["도적", "여성", "청년", "보라머리", "후드"], { gender: "female", age: "youth" }],
    [6, "젊은 여성 엘프", ["엘프", "여성", "청년", "궁수", "깃털"], { gender: "female", age: "youth" }],
    [7, "젊은 남성 엘프", ["엘프", "남성", "청년", "금발", "궁수", "모자"], { gender: "male", age: "youth" }],
  ]),
  // tex_easyrpg_charset_actor3 — 2026-09-04 셀 확대 판독으로 교정: #2 는 복면 후드 닌자,
  // #3 은 머리 묶음·스카프 여성(노인 사무라이 아님), #6·#7 은 금장식 모자 음유시인(검사·귀족 아님)이다.
  ...sheet("tex_easyrpg_charset_actor3", [
    [0, "사무라이", ["사무라이", "전사", "갑옷", "남성"], { gender: "male" }],
    [1, "동양풍 떠돌이 검객", ["검객", "남성", "동양풍", "떠돌이"], { gender: "male" }],
    [2, "닌자", ["닌자", "남성", "복면", "후드", "가면"], { gender: "male" }],
    [3, "여자 닌자", ["닌자", "여성", "스카프"], { gender: "female" }],
    [4, "녹색 후드 여인", ["여성", "허브", "드루이드"], { gender: "female" }],
    [5, "무도가", ["무도가", "전사", "남성"], { gender: "male" }],
    [6, "남성 음유시인", ["음유시인", "남성", "금장식", "모자"], { gender: "male" }],
    [7, "여성 음유시인", ["음유시인", "여성", "왕관", "금장식"], { gender: "female" }],
  ]),
  // tex_easyrpg_charset_actor4 — 2026-09-04 셀 확대 판독으로 교정: 사제·가면전사·여전사 없음.
  // #0~#2 는 금발·보라머리 청년 3인, #3·#4·#6·#7 은 여성 마법사 4인(고깔모자 1), #5 는 금발 남성 갑옷 전사다.
  ...sheet("tex_easyrpg_charset_actor4", [
    [0, "보라 머리 청년", ["청년", "남성", "보라머리"], { gender: "male", age: "youth" }],
    [1, "금발 머리 청년", ["청년", "남성", "금발"], { gender: "male", age: "youth" }],
    [2, "금발 청년2", ["청년", "남성", "금발"], { gender: "male", age: "youth" }],
    [3, "보라 머리 여성 마법사", ["마법사", "여성", "보라머리"], { gender: "female" }],
    [4, "붉은 목도리 여성 마법사", ["마법사", "여성", "목도리", "빨강"], { gender: "female" }],
    [5, "금발 남성 갑옷 전사", ["전사", "갑옷", "남성", "금발"], { gender: "male" }],
    [6, "흑발 여성 마법사", ["마법사", "여성", "흑발"], { gender: "female" }],
    [7, "고깔모자 여성 마법사", ["마법사", "여성", "고깔모자", "마녀", "빨강"], { gender: "female" }],
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
    [7, "사자", ["사자", "동물", "야생"], { gender: "none" }],
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
  // tex_scarloxy_charset_people3 / people4 — 몬스터 게임 출연진(생성 자산, scripts/build-scarloxy-cast.py).
  // 2026-09-28 변환 결과 미리보기(tiledata/pkmn-characters/preview/)를 육안 확인해 라벨링. 배역표: scarloxyCast.ts.
  ...sheet("tex_scarloxy_charset_people3", [
    [0, "몬스터 박사", ["박사", "연구소", "과학자", "안경", "흰 가운", "scarloxy"], { gender: "male", age: "middle" }],
    [1, "엄마", ["엄마", "어머니", "주민", "앞치마", "scarloxy"], { gender: "female", age: "middle" }],
    [2, "회복 센터 간호사", ["간호사", "회복 센터", "치유사", "분홍 머리", "scarloxy"], { gender: "female", age: "youth" }],
    [3, "상점 점원", ["점원", "상인", "상점", "모자", "scarloxy"], { gender: "male", age: "youth" }],
    [4, "챔피언", ["챔피언", "최종 보스", "보스", "트레이너", "은발", "망토", "scarloxy"], { gender: "male", age: "youth" }],
    [5, "벌레잡이 소년", ["벌레잡이", "트레이너", "소년", "아이", "잠자리채", "밀짚모자", "scarloxy"], { gender: "male", age: "child" }],
    [6, "등산가", ["등산가", "트레이너", "배낭", "수염", "산", "동굴", "scarloxy"], { gender: "male", age: "middle" }],
    [7, "수영선수", ["수영선수", "트레이너", "물", "바다", "물안경", "scarloxy"], { gender: "male", age: "youth" }],
  ]),
  ...sheet("tex_scarloxy_charset_people4", [
    [0, "캠프걸", ["캠프걸", "트레이너", "소녀", "베레모", "야영", "scarloxy"], { gender: "female", age: "youth" }],
    [1, "낚시꾼", ["낚시꾼", "트레이너", "낚싯대", "노인", "물", "scarloxy"], { gender: "male", age: "elder" }],
    [2, "신사", ["신사", "트레이너", "부자", "실크햇", "지팡이", "노인", "scarloxy"], { gender: "male", age: "elder" }],
  ]),
];

function withAppearance(entry: CharsetSemanticEntry): CharsetSemanticEntry {
  const appearance = CHARSET_APPEARANCE[`${entry.textureKey}#${entry.characterIndex}`];
  if (!appearance) {
    throw new Error(`charset appearance missing: ${entry.textureKey}#${entry.characterIndex}`);
  }
  return { ...entry, appearance };
}

export const CHARSET_SEMANTICS: readonly CharsetSemanticEntry[] = CHARSET_SEMANTICS_RAW.map(withAppearance);

export function findCharsetSemantic(textureKey: string, characterIndex: number): CharsetSemanticEntry | undefined {
  return [...CHARSET_SEMANTICS, ...sharedCharacterSemantics()].find((entry) => entry.textureKey === textureKey && entry.characterIndex === characterIndex);
}

export function charsetSemanticsForTexture(textureKey: string): readonly CharsetSemanticEntry[] {
  return CHARSET_SEMANTICS.filter((entry) => entry.textureKey === textureKey);
}

export function applyCharsetLabelOverrides(
  base: readonly CharsetSemanticEntry[],
  overrides: readonly { readonly textureKey: string; readonly characterIndex: number; readonly label: string; readonly tags?: readonly string[]; readonly origin?: "user" | "ai" }[] | undefined,
): CharsetSemanticEntry[] {
  if (!overrides || overrides.length === 0) return [...base];
  const bySlot = new Map<string, { readonly label: string; readonly tags?: readonly string[] }>();
  for (const override of overrides) {
    const label = override.label.trim();
    if (!label) continue;
    bySlot.set(`${override.textureKey}#${override.characterIndex}`, { label, tags: override.tags });
  }
  if (bySlot.size === 0) return [...base];
  return base.map((entry) => {
    const override = bySlot.get(`${entry.textureKey}#${entry.characterIndex}`);
    if (!override) return entry;
    const tags = override.tags && override.tags.length > 0 ? [...override.tags] : entry.tags;
    return { ...entry, label: override.label, tags: [override.label, ...tags.filter((tag) => tag !== override.label)] };
  });
}

export function upsertCharsetLabelOverride(
  existing: readonly { readonly textureKey: string; readonly characterIndex: number; readonly label: string; readonly tags?: readonly string[]; readonly origin?: "user" | "ai" }[] | undefined,
  next: { readonly textureKey: string; readonly characterIndex: number; readonly label: string; readonly tags?: readonly string[]; readonly origin?: "user" | "ai" },
): { textureKey: string; characterIndex: number; label: string; tags?: string[]; origin?: "user" | "ai" }[] {
  const list = (existing ?? [])
    .filter((entry) => entry.textureKey !== next.textureKey || entry.characterIndex !== next.characterIndex)
    .map((entry) => ({
      textureKey: entry.textureKey,
      characterIndex: entry.characterIndex,
      label: entry.label,
      ...(entry.tags ? { tags: [...entry.tags] } : {}),
      ...(entry.origin ? { origin: entry.origin } : {}),
    }));
  const label = next.label.trim();
  if (!label) return list;
  const tags = (next.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0);
  list.push({
    textureKey: next.textureKey,
    characterIndex: next.characterIndex,
    label,
    ...(tags.length > 0 ? { tags } : {}),
    origin: next.origin ?? "user",
  });
  return list;
}
