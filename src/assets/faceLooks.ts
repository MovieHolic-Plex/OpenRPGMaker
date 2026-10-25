// 번들 얼굴(48px 낱장) 한 장마다 그림을 보고 적은 외형 — 나이·종류(사람·몬스터·동물·기계)·머리·눈에 띄는 것.
//
// 왜(2026-10-25 조수 단독 게임 심사 J35·J30): 조수는 얼굴을 이름표(「금발 소녀」「흰 수염 노인」)로만 골랐다. 이름표에는 나이가 빠진 얼굴이
// 53장이었고, 인형·기계·유령 같은 «사람이 아닌» 화자를 가릴 낱말도 없었다 — 「젊은 제페토」가 흰 수염 노인 얼굴로, 줄에 매달린 인형이
// 금발 사람 소녀 얼굴로, 태엽 병정이 사람 소년 얼굴로 말했다. 이 표가 얼굴 검색(list_resources kind:faceset)의 설명·검색어가 되고,
// 끝맺음 검사(src/ai/v2/lookChecks.ts)가 화자 이름과 이 설명을 맞대는 근거가 된다.
// 2026-10-25 얼굴 원본(public/assets/easyrpg/faceset·assets/generated/faceset)을 2~3배로 늘린 접촉 시트로 한 장씩 보고 적었다.
// 사람이 공용 대응표에서 얼굴 속성을 고치면 그 값이 먼저다(이 표는 번들 기본 설명).

import expressionSources from "../../scripts/shared-face-expression-sources.json";

export type FaceLookAge = "child" | "youth" | "middle" | "elder";
export type FaceLookKind = "human" | "monster" | "animal" | "machine" | "hidden";

export interface FaceLook {
  readonly age?: FaceLookAge;
  readonly kind: FaceLookKind;
  /** 그림에 보이는 것(나이·성별 낱말 포함). 부정어는 쓰지 않는다 — 검색에 걸린다. */
  readonly look: string;
}

const h = (age: FaceLookAge | undefined, look: string): FaceLook => ({ ...(age ? { age } : {}), kind: "human", look });
const m = (look: string): FaceLook => ({ kind: "monster", look });
const a = (look: string): FaceLook => ({ kind: "animal", look });

export const FACE_LOOKS: Readonly<Record<string, FaceLook>> = {
  "easyrpg-faceset-actor1-00": h("youth", "청년 남성. 뻗친 갈색 머리, 푸른 깃. 판타지 모험가"),
  "easyrpg-faceset-actor1-01": h("youth", "청년. 긴 푸른 머리, 붉은 깃. 판타지 여행자"),
  "easyrpg-faceset-actor1-02": h("youth", "청년 남성 병사. 쇠 투구, 붉은 투구 테. 판타지 병사"),
  "easyrpg-faceset-actor1-03": h("youth", "청년 여성 기사. 쇠 투구 아래 금발. 판타지 기사"),
  "easyrpg-faceset-actor1-04": h("youth", "청년 남성. 푸른 머리, 금테 검은 머리띠. 판타지 전사"),
  "easyrpg-faceset-actor1-05": h("youth", "청년 여성 마법사. 분홍 머리, 푸른 띠 두른 검은 모자. 판타지 마법사"),
  "easyrpg-faceset-actor1-06": h("youth", "청년 남성. 검은 머리, 흰 머리띠. 판타지 무사"),
  "easyrpg-faceset-actor1-07": h("youth", "청년 여성. 검은 머리, 금테 남색 모자. 판타지"),
  "easyrpg-faceset-actor1-08": h("youth", "청년 남성. 검은 머리, 굳은 얼굴, 이마에 붉은 점. 무도가"),
  "easyrpg-faceset-actor1-09": h("youth", "청년 여성. 주황 머리. 판타지"),
  "easyrpg-faceset-actor1-10": h("youth", "청년 남성 학자. 어두운 피부, 안경, 갈색 머리"),
  "easyrpg-faceset-actor1-11": h("youth", "청년 여성. 어두운 피부, 초록 곱슬머리, 머리 위 고글"),
  "easyrpg-faceset-actor1-12": h("middle", "중년 남성. 갈색 수염, 분홍 두건. 해적·산적"),
  "easyrpg-faceset-actor1-13": h("youth", "청년 여성. 분홍 머리, 보라 모자. 판타지 마법사"),
  "easyrpg-faceset-actor1-14": h("youth", "청년 남성. 초록 머리, 붉은 두건. 판타지 사냥꾼"),
  "easyrpg-faceset-actor1-15": h("youth", "청년 여성. 금발 곱슬머리, 초록 모자. 판타지 궁수"),
  "easyrpg-faceset-actor2-00": h("youth", "청년 남성. 검은 머리, 붉은 투구. 판타지 무사"),
  "easyrpg-faceset-actor2-01": h("middle", "중년 남성. 검은 머리, 콧수염, 입에 문 담배. 판타지 전사"),
  "easyrpg-faceset-actor2-02": { kind: "hidden", look: "검은 복면으로 얼굴을 가린 닌자. 눈만 보인다" },
  "easyrpg-faceset-actor2-03": h("youth", "청년 여성. 검은 머리, 흰 머리띠. 판타지 무도가"),
  "easyrpg-faceset-actor2-04": h("youth", "청년 여성. 긴 금발, 초록 눈. 판타지"),
  "easyrpg-faceset-actor2-05": h("youth", "청년 여성. 짙은 청록 머리, 귀걸이, 붉은 입술"),
  "easyrpg-faceset-actor2-06": h("youth", "청년. 갈색 단발 머리. 판타지"),
  "easyrpg-faceset-actor2-07": h("youth", "청년 여성. 갈색 단발. 판타지"),
  "easyrpg-faceset-actor2-08": h("youth", "청년 남성. 푸른 머리. 판타지"),
  "easyrpg-faceset-actor2-09": h("youth", "청년 남성. 금발. 판타지 왕자"),
  "easyrpg-faceset-actor2-10": h("youth", "청년 남성. 금발, 붉은 머리띠. 판타지 전사"),
  "easyrpg-faceset-actor2-11": h("youth", "청년 남성. 긴 푸른 머리. 판타지 총사"),
  "easyrpg-faceset-actor2-12": h("youth", "청년 여성. 자줏빛 단발. 판타지 무희"),
  "easyrpg-faceset-actor2-13": h("youth", "청년 여성. 황금색 머리, 초록 눈. 판타지"),
  "easyrpg-faceset-actor2-14": h("youth", "청년 여성. 긴 보라 머리, 붉은 입술. 판타지 마녀"),
  "easyrpg-faceset-actor2-15": h("youth", "청년 여성. 은청색 긴 머리, 붉은 모자, 붉은 눈. 판타지 소환사"),
  "easyrpg-faceset-people1-00": h("child", "남자아이. 갈색 단발"),
  "easyrpg-faceset-people1-01": h("child", "여자아이. 금발, 분홍 볼. 사람 소녀"),
  "easyrpg-faceset-people1-02": h("youth", "청년 남성. 푸른 머리"),
  "easyrpg-faceset-people1-03": h("youth", "젊은 여성. 긴 금발"),
  "easyrpg-faceset-people1-04": h("middle", "중년 남성. 갈색 머리, 굵은 콧수염"),
  "easyrpg-faceset-people1-05": h("youth", "젊은 여성. 갈색 머리, 초록 눈"),
  "easyrpg-faceset-people1-06": h("elder", "노인 남성. 벗어진 머리, 흰 수염, 주름"),
  "easyrpg-faceset-people1-07": h("elder", "노파. 백발, 주름"),
  "easyrpg-faceset-people1-08": h("youth", "청년 남성. 검은 머리"),
  "easyrpg-faceset-people1-09": h("middle", "여성. 어두운 피부, 흰 두건(수녀)"),
  "easyrpg-faceset-people1-10": h("middle", "중년 남성. 대머리, 윙크"),
  "easyrpg-faceset-people1-11": h("youth", "젊은 여성. 어두운 피부, 보라 머리"),
  "easyrpg-faceset-people1-12": h("middle", "남성. 검은 장발, 날카로운 눈"),
  "easyrpg-faceset-people1-13": h("middle", "여성. 금발 곱슬머리"),
  "easyrpg-faceset-people1-14": h("youth", "젊은 여성. 붉은 머리"),
  "easyrpg-faceset-people1-15": h("child", "여자아이. 민트색 단발, 초록 눈"),
  "easyrpg-faceset-people2-00": h("elder", "노인 남성 왕. 금관, 백발, 흰 수염"),
  "easyrpg-faceset-people2-01": h("youth", "젊은 여성. 긴 푸른 머리. 왕비"),
  "easyrpg-faceset-people2-02": h("youth", "청년 남성. 적갈색 머리. 왕자"),
  "easyrpg-faceset-people2-03": h("youth", "젊은 여성. 금발 곱슬 머리타래, 푸른 눈. 공주"),
  "easyrpg-faceset-people2-04": h("elder", "노인 남성. 백발, 흰 수염, 주름"),
  "easyrpg-faceset-people2-05": h("youth", "젊은 여성. 푸른 머리. 시녀"),
  "easyrpg-faceset-people2-06": h("middle", "중년 남성. 검은 머리, 콧수염, 넓은 얼굴"),
  "easyrpg-faceset-people2-07": h("youth", "청년 남성 병사. 푸른 쇠 투구"),
  "easyrpg-faceset-people2-08": a("강아지. 웃는 갈색·흰 개"),
  "easyrpg-faceset-people2-09": a("고양이. 갈색 줄무늬"),
  "easyrpg-faceset-people2-10": a("수탉. 붉은 볏"),
  "easyrpg-faceset-people2-11": a("양. 흰 털"),
  "easyrpg-faceset-people2-12": a("젖소. 검은·흰 얼룩"),
  "easyrpg-faceset-people2-13": a("말. 갈색"),
  "easyrpg-faceset-people2-14": a("호랑이"),
  "easyrpg-faceset-people2-15": a("사자. 갈기"),
  "easyrpg-faceset-monster-00": m("초록 슬라임"),
  "easyrpg-faceset-monster-01": m("붉은 피부 악마. 뿔"),
  "easyrpg-faceset-monster-02": m("분홍 돼지 얼굴 전사(오크)"),
  "easyrpg-faceset-monster-03": m("흰 시트 유령. 검은 눈, 벌린 입. 귀신"),
  "easyrpg-faceset-monster-04": m("흰 해골. 언데드"),
  "easyrpg-faceset-monster-05": m("초록 피부 좀비. 흉터. 언데드"),
  "easyrpg-faceset-monster-06": m("보라 두건 쓴 해골. 사신·망령"),
  "easyrpg-faceset-monster-07": m("검은 소 머리 미노타우로스"),
  "easyrpg-faceset-monster-08": m("초록 머리 하피. 여성 얼굴의 괴물"),
  "easyrpg-faceset-monster-09": m("푸른빛 흰 용"),
  "easyrpg-faceset-monster-10": m("창백한 피부, 백발 뱀파이어. 붉은 눈"),
  "easyrpg-faceset-monster-11": m("붉은 뿔 투구로 얼굴을 가린 마족 기사"),
  "easyrpg-faceset-monster-12": m("갈색 바위 골렘. 빛나는 눈"),
  "easyrpg-faceset-monster-13": m("녹색 드레이크(용)"),
  "easyrpg-faceset-monster-14": m("붉은 가면 악마. 흰 갈기"),
  "easyrpg-faceset-monster-15": m("보라 피부 마족. 뿔"),
  "generated-faceset-missing-people-00": h("youth", "젊은 여성 닌자. 검은 머리, 어두운 옷"),
  "generated-faceset-missing-people-01": h("child", "남자아이. 어두운 피부, 갈색 삐죽머리, 둥근 안경"),
  "generated-faceset-missing-people-02": h("youth", "청년 남성. 어두운 피부, 붉은·푸른 이국 모자"),
  "generated-faceset-missing-people-03": h("youth", "젊은 여성. 어두운 피부, 주황 터번과 보석"),
  "generated-faceset-missing-people-04": h("middle", "중년 남성. 어두운 피부, 대머리, 초록 옷"),
  "generated-faceset-missing-people-05": h("youth", "청년 남성. 어두운 피부, 금빛 머리띠, 노란 전통옷"),
  "generated-faceset-missing-people-06": h("youth", "청년 남성 병사. 붉은 머리, 흰 투구"),
  "generated-faceset-missing-people-07": h("youth", "청년 남성 전사. 검은 머리, 붉은 머리띠"),
  "generated-faceset-missing-people-08": h("youth", "젊은 여성. 검은 머리, 꽃 장식, 기모노"),
  "generated-faceset-missing-people-09": h("middle", "난쟁이 병사. 붉은 수염, 금빛 투구"),
  "generated-faceset-missing-people-10": h("middle", "중년 남성 무도가. 청록 머리, 수염, 어두운 피부"),
  "generated-faceset-missing-people-11": a("갈색 고양이"),
  "generated-faceset-missing-people-12": m("붉은 머리 하피. 여성 얼굴, 날개"),
  "generated-faceset-missing-people-13": { kind: "machine", look: "황동 기계 병사. 금속 얼굴, 빛나는 눈. 기계·태엽·자동인형·로봇·장난감 병정에 맞는 얼굴" },
  "generated-faceset-missing-people-14": { kind: "hidden", look: "검은 두건 속 얼굴이 어둠에 가려진 인물. 금테 두건" },
  "generated-faceset-missing-people-15": m("보라 두건 쓴 보라 피부 마족"),
  "generated-faceset-missing-scarloxy-00": h("child", "남자아이. 빨간 테두리 흰 모자, 갈색 머리"),
  "generated-faceset-missing-scarloxy-01": h("child", "남자아이. 뻗친 금발"),
  "generated-faceset-missing-scarloxy-02": h("child", "남자아이. 어두운 피부, 초록 벙거지"),
  "generated-faceset-missing-scarloxy-03": h("child", "여자아이. 보라 긴 머리"),
  "generated-faceset-missing-scarloxy-04": h("child", "여자아이. 갈색 양갈래에 빨간 리본"),
  "generated-faceset-missing-scarloxy-05": h("child", "남자아이. 남색 머리"),
  "generated-faceset-missing-scarloxy-06": h("youth", "청년 남성. 어두운 피부, 밀짚모자"),
  "generated-faceset-missing-scarloxy-07": h("youth", "젊은 여성. 청록 긴 머리, 분홍 귀 장식"),
  "generated-faceset-missing-scarloxy-08": h("youth", "청년 남성. 붉은 뻗친 머리, 어두운 피부"),
  "generated-faceset-missing-scarloxy-09": h("youth", "청년 남성. 초록 머리"),
  "generated-faceset-missing-monster-00": m("보물상자 미믹. 이빨과 혀"),
  "generated-faceset-missing-monster-01": m("붉은 드래곤"),
  "generated-faceset-missing-monster-02": m("붉은 불꽃 정령"),
};

const AGE_WORDS: Readonly<Record<FaceLookAge, string>> = { child: "어린이", youth: "청년·젊은", middle: "중년", elder: "노년·노인" };

/** 검색·설명에 붙이는 한 줄(「나이: … · 종류: … · 그림: …」). 표에 없는 얼굴은 undefined. */
export function faceLookText(resourceId: string): string | undefined {
  const look = FACE_LOOKS[faceLookKey(resourceId)];
  if (!look) return undefined;
  const kind = { human: "사람", monster: "몬스터", animal: "동물", machine: "기계", hidden: "얼굴 가림" }[look.kind];
  return `그림: ${look.look} (${kind}${look.age ? `·${AGE_WORDS[look.age]}` : ""})`;
}

/** 공용 표정 세트(shared-<줄기>-expressions)의 표정 얼굴·흉상·전신은 원본 얼굴(baseSheet·baseCell)의 설명을 물려받는다. */
const EXPRESSION_BASES: ReadonlyMap<string, string> = new Map(expressionSources.map((source) => [
  `shared-${source.stem}`,
  `easyrpg-faceset-${source.baseSheet.toLowerCase()}-${String(source.baseCell).padStart(2, "0")}`,
]));
export function faceLookKey(resourceId: string): string {
  if (FACE_LOOKS[resourceId]) return resourceId;
  const set = /^(shared-.+?-expressions)(?:-|$)/u.exec(resourceId)?.[1];
  return (set && EXPRESSION_BASES.get(set)) || resourceId;
}
export function faceLookOf(resourceId: string): FaceLook | undefined {
  return FACE_LOOKS[faceLookKey(resourceId)];
}
