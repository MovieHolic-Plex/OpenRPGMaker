/**
 * 『여덟째 자리』 「이야기」 탭 — 세계 개요·설정집·인물(조수 도구로 쓴다, loreKit).
 * 비밀(기억과 태엽)은 설정집에 ai-hidden 으로 둔다 — 편집기에서 열면 보이고, 조수가 대사에 흘리지 않게.
 */
import type { Project } from "@/project/types";
import { loreExec, writeCodex, type CodexEntry, type CodexRelation } from "./loreKit";

const BODY = [
  "케른 마도학원은 북쪽 호수 위 바위섬에 선 오래된 성채다. 성은 방벽 주문으로 겨울바람과 호수의 안개를 막는다. 방벽은 시계탑의 태엽이 돌린다.",
  "학원은 해마다 가난한 집 아이들 가운데 장학생을 받는다. 장학석은 여덟 개다. 올해는 행정 착오로 아홉 명이 들어왔다. 학원은 착오를 바로잡지 않고, 겨울 시험 뒤 꼴찌 두 명에게 결정전을 치르게 한다고 알렸다.",
  "진 장학생은 집으로 돌아간다. 학원은 돌아가는 학생에게서 학원에서 배운 것과 만난 사람의 기억을 거둔다. 그래서 떨어진 학생은 「잘 지냈다」는 막연한 느낌만 안고 고향 배에 오른다. 학생들은 이것을 「호수가 가져간다」고 부른다.",
  "학원에는 기숙사가 없다. 학생은 전공 반으로 나뉘고 넥타이 색으로 반을 알아본다. 붉은색은 주문학, 초록은 약학, 푸른색은 문헌학, 노란색은 약초학이다.",
  "결투는 수업이다. 실기 교관 브란트는 결투를 「상대의 예고를 읽는 시험」이라고 가르친다. 모든 주문에는 준비 동작이 있고, 준비 동작을 읽는 사람이 이긴다. 결투는 상대가 지팡이를 내려놓으면 끝나고, 내려놓는 것도 실력으로 친다.",
  "한 학기는 여섯 주다. 장학생은 매주 오후를 어디에 쓸지 스스로 정한다. 연습, 도서관, 온실, 편지 탑. 시간은 늘 모자란다.",
].join("\n\n");

const ENTRIES: CodexEntry[] = [
  { id: "es_place_academy", type: "place", name: "케른 마도학원", summary: "호수 위 바위섬의 성채 학원. 시계탑 태엽이 성의 방벽을 돌린다.", tags: ["학원", "성채"] },
  { id: "es_place_hall", type: "place", name: "큰 강당", summary: "연회와 공개 결투, 겨울 시험이 열리는 곳. 시험 날에는 탁자를 걷고 훈련 원을 깐다.", refs: [{ kind: "map", id: "es_hall" }] },
  { id: "es_place_duel", type: "place", name: "실기 강의실", summary: "브란트 교관의 결투 수업. 바닥에 석회로 그은 훈련 원이 있다.", refs: [{ kind: "map", id: "es_duelroom" }] },
  { id: "es_place_library", type: "place", name: "도서관", summary: "열람실과 제한 서가. 학적 장부가 사서장 이델의 기록 탁자에 있다.", refs: [{ kind: "map", id: "es_library" }] },
  { id: "es_place_clock", type: "place", name: "시계탑 기어실", summary: "방벽을 돌리는 태엽과 톱니. 정비사 구스가 산다.", refs: [{ kind: "map", id: "es_clock" }] },
  { id: "es_place_greenhouse", type: "place", name: "약초 온실", summary: "테오가 물을 주는 곳. 유리벽에 덩굴이 탄다.", refs: [{ kind: "map", id: "es_greenhouse" }] },
  { id: "es_place_letters", type: "place", name: "편지 탑", summary: "부엉이가 고향으로 편지를 나르는 탑. 장학생은 한 주에 한 통을 쓸 수 있다.", refs: [{ kind: "map", id: "es_letters" }] },
  { id: "es_concept_seats", type: "concept", name: "장학석 여덟", summary: "장학생 자리는 여덟. 올해 장학생은 아홉. 겨울 시험 뒤 꼴찌 둘이 결정전을 치른다." },
  { id: "es_concept_lake", type: "concept", name: "호수가 가져간다", summary: "떨어진 학생은 학원에서 배운 것과 만난 사람의 기억을 잃고 돌아간다." },
  { id: "es_concept_duel", type: "concept", name: "결투 수업", summary: "주문에는 준비 동작이 있다. 예고를 읽고 받아치는 사람이 이긴다. 지팡이를 내려놓으면 끝난다." },
  { id: "es_concept_majors", type: "concept", name: "전공 반과 넥타이", summary: "붉은 주문학, 초록 약학, 푸른 문헌학, 노란 약초학. 기숙사는 없다." },
  { id: "es_item_ledger", type: "item", name: "학적 장부", summary: "입학한 학생의 이름과 해를 적는 장부. 지운 줄도 남아 있다." },
  { id: "es_event_feast", type: "event", name: "입학 연회", summary: "학장 오르벤이 장학석은 여덟이라고 말하는 밤.", refs: [{ kind: "map", id: "es_hall" }] },
  { id: "es_event_final", type: "event", name: "결정전", summary: "겨울 시험 마지막 날, 꼴찌 두 장학생의 결투." },
  { id: "es_secret_clock", type: "concept", name: "태엽에 감긴 기억", summary: "거둔 기억은 시계탑 태엽에 감겨 성의 방벽을 돌린다.", visibility: "ai-hidden",
    body: "학장은 이 제도를 알고 지킨다. 방벽이 멈추면 겨울에 성이 얼기 때문이다. 집이 없는 학생은 기억을 거둔 뒤 다시 「신입」으로 받는다. 테오가 세 번째, 구스는 그보다 훨씬 오래전이다. 이델은 지운 이름을 모두 따로 적어 두었다." },
  { id: "es_secret_teo", type: "character", name: "테오의 첫해", summary: "테오는 이미 두 번 떨어졌다. 장부에는 3년 연속 「신입」으로 적혀 있다.", visibility: "ai-hidden" },
];

const RELATIONS: CodexRelation[] = [
  { a: "es_place_hall", b: "es_place_academy", kind: "locatedIn" },
  { a: "es_place_duel", b: "es_place_academy", kind: "locatedIn" },
  { a: "es_place_library", b: "es_place_academy", kind: "locatedIn" },
  { a: "es_place_clock", b: "es_place_academy", kind: "locatedIn" },
  { a: "es_place_greenhouse", b: "es_place_academy", kind: "locatedIn" },
  { a: "es_place_letters", b: "es_place_academy", kind: "locatedIn" },
  { a: "es_item_ledger", b: "es_place_library", kind: "locatedIn" },
  { a: "es_secret_clock", b: "es_place_clock", kind: "locatedIn" },
  { a: "es_concept_lake", b: "es_secret_clock", kind: "causedBy" },
];

export const ES_PROFILES: Readonly<Record<string, { displayName: string; note: string }>> = {
  sera: { displayName: "세라", note: "문헌학 반 장학생. 같은 방 건너편 침대. 렌을 미워하지 않지만 양보하지도 않는다." },
  teo: { displayName: "테오", note: "약초학 반. 온실에서 물을 준다. 친절하고, 조금 이상하다." },
  idel: { displayName: "이델", note: "도서관 사서장. 학적 장부를 맡고 있다." },
  brandt: { displayName: "브란트", note: "실기 교관이자 시험 감독. 결투를 예고를 읽는 시험이라고 가르친다." },
  orben: { displayName: "오르벤", note: "학장. 성의 방벽을 지키는 노인." },
};

export function buildEighthSeatLore(project: Project): void {
  loreExec(project, "set_world_canon", {
    canon: {
      name: "케른 마도학원",
      premise: "장학석은 여덟, 장학생은 아홉. 겨울 시험 뒤 꼴찌 둘이 결정전을 치르고, 진 사람은 학원에서 만난 사람의 기억을 두고 집으로 돌아간다.",
      tones: ["grim", "slice", "political"],
      era: "증기와 촛불의 마도 시대",
      body: BODY,
    },
  });
  writeCodex(project, loreExec, ENTRIES, RELATIONS);
  for (const [characterId, profile] of Object.entries(ES_PROFILES)) {
    loreExec(project, "upsert_character_profile", { characterId, profile });
  }
}
