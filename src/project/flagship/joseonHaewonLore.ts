/**
 * 해원 : 청석골 검안록 — 자료집 「이야기」 탭(세계 개요·설정집·인물). 빌더 끝에서 한 번 부른다.
 * 조수와 같은 도구(set_world_canon · upsert_world_codex · upsert_character_profile)로 쓴다.
 */
import type { Project } from "@/project/types";
import { loreExec, writeCodex, type CodexEntry, type CodexRelation } from "./loreKit";

const BODY = [
  "조선 후기, 경상도 산골 고을 청석골. 지난겨울 관아가 내준 환곡 쌀에 모래가 섞였고, 봄이 오기 전에 마을 사람 셋이 죽었다.",
  "우물에 빠진 노비 아이 분이, 곳간에서 목을 맨 서원, 뒷산 굴에서 얼어 죽은 떠돌이들. 마을은 셋 다 귀신 짓이라 하고, 이방은 굿 날을 받아 두었다.",
  "감영은 검률 하나를 내려보낸다. 검률은 시신을 검안하고 법조문을 읽는 하급 관원이다. 그는 귀신을 믿지 않는다. 시신은 거짓말을 하지 않는다고 믿는다.",
  "이 고을에서 원혼은 실제로 운다. 다만 원혼은 사람을 해치지 않는다. 억울하게 죽은 이는 누가, 왜 그랬는지 바르게 들을 때까지 떠나지 못할 뿐이다.",
  "그래서 검률이 하는 일은 둘이다. 낮에는 증거로 진범을 지목하고, 밤에는 만신 곁에서 그 이름을 원혼에게 고한다. 이름을 불러 보내면 원한이 풀리고(해원), 부적으로 봉하면 소리만 그친다.",
  "사건을 하나씩 풀수록 세 죽음이 한 장부로 이어진다. 모래 섞인 쌀은 누구의 곳간에서 나왔고, 그 장부를 덮으려는 사람은 누구인가.",
].join("\n\n");

const ENTRIES: readonly CodexEntry[] = [
  { id: "jw_place_village", type: "place", name: "청석골", summary: "경상도 산골 고을. 큰 우물·빨래터·방앗간·주막·관아가 한 길에 늘어서 있다.", body: "솔숲 대문 안에 관아 동헌이 있고, 냇가 아래로 물레방아가 돈다. 서쪽 들머리로 들어오면 성황당 고목이 먼저 보인다.", refs: [{ kind: "map", id: "map_jw_village" }] },
  { id: "jw_place_office", type: "place", name: "관아 동헌", summary: "사또 대신 이방이 일을 보는 곳. 마당 거적 아래 분이의 시신이 있다.", refs: [{ kind: "map", id: "map_jw_office" }] },
  { id: "jw_place_inn", type: "place", name: "주막", summary: "주모가 시래깃국을 끓이는 큰길 끝 초가. 검률은 여기 안쪽 방에 묵는다.", refs: [{ kind: "map", id: "map_jw_inn" }] },
  { id: "jw_place_shrine", type: "place", name: "월화 만신의 집", summary: "마을 서쪽 끝 초가. 정화수 그릇과 무구가 놓여 있다.", refs: [{ kind: "map", id: "map_jw_shrine" }] },
  { id: "jw_place_well", type: "place", name: "큰 우물", summary: "분이를 건진 우물. 밤이면 우는 소리가 난다고들 한다." },
  { id: "jw_place_mill", type: "place", name: "방앗간", summary: "정 서방이 물레방아를 돌리는 곳. 밤에 방아 소리가 나면 안 되는 곳이다." },
  { id: "jw_event_case1", type: "event", name: "사건 1 — 우물에서 우는 아이", summary: "노비 분이(열다섯)가 우물에서 건져졌다. 마을은 물귀신이 데려갔다고 한다.", body: "검안하면 물에 빠져 죽은 몸이 아니다. 목에 손가락 자국이 있다. 그 밤 방앗간에서 무엇을 본 아이였다." },
  { id: "jw_event_ledger", type: "event", name: "모래 섞인 환곡", summary: "지난겨울 관아가 내준 환곡 쌀에 모래가 섞였다. 세 죽음의 뿌리다.", visibility: "ai-hidden" },
  { id: "jw_concept_geomryul", type: "concept", name: "검률", summary: "감영에 딸린 하급 관원. 시신을 검안하고 법조문을 맞춰 본다.", body: "검안 소견은 「무원록」의 항목을 따라 적는다. 입·코의 거품, 손톱 밑의 진흙, 배의 부름으로 물에 빠져 죽었는지를 가린다." },
  { id: "jw_concept_haewon", type: "concept", name: "해원", summary: "원혼에게 진상을 바르게 고해 원한을 풀어 보내는 일.", body: "원혼은 손이 닿지 않는다. 맞는 이름을 들어야 소리가 낮아진다. 틀린 이름을 고하면 바람이 거세진다." },
  { id: "jw_concept_seal", type: "concept", name: "봉인", summary: "부적으로 원혼을 막는 일. 소리는 그치지만 원한은 남는다.", body: "엉뚱한 사람을 지목했으면 이름 불러 보낼 수가 없어 봉하는 수밖에 없다. 봉한 횟수는 마지막에 고을이 어떤 곳으로 남는지를 가른다." },
  { id: "jw_item_journal", type: "item", name: "검안록", summary: "검률이 적는 일지. 메뉴의 「검안록」에서 날짜별로 읽는다." },
  { id: "jw_guide_tone", type: "guideline", name: "글의 결", summary: "어른의 사극. 귀신은 빛과 소리로만 나온다. 농담·귀여운 말투를 쓰지 않는다.", body: "대사는 짧은 하오체·하게체. 고통을 자세히 묘사하지 않고, 검안 소견처럼 사실만 적는다. 원혼의 모습을 그리지 않는다." },
];

const RELATIONS: readonly CodexRelation[] = [
  { a: "jw_place_office", b: "jw_place_village", kind: "locatedIn" },
  { a: "jw_place_inn", b: "jw_place_village", kind: "locatedIn" },
  { a: "jw_place_shrine", b: "jw_place_village", kind: "locatedIn" },
  { a: "jw_place_well", b: "jw_place_village", kind: "locatedIn" },
  { a: "jw_place_mill", b: "jw_place_village", kind: "locatedIn" },
  { a: "jw_event_case1", b: "jw_event_ledger", kind: "causedBy", note: "분이는 밤에 모래 섞는 것을 봤다" },
];

const PROFILES: readonly { id: string; displayName: string; note: string }[] = [
  { id: "actor_hero", displayName: "정 검률", note: "감영에서 내려온 검률. 귀신보다 시신을 믿는다." },
  { id: "npc_jw_deokbae", displayName: "덕배", note: "관아 오작사령. 글은 모르지만 시신은 많이 만져 봤다. 검률의 손발이 된다." },
  { id: "npc_jw_ibang", displayName: "이방 최득량", note: "사또 대신 고을을 쥔 이방. 묻기도 전에 덮는다." },
  { id: "npc_jw_wolhwa", displayName: "월화 만신", note: "고을 만신. 굿은 산 사람 들으라고 한다고 말한다. 분이를 공으로 울어 주겠다고 했다." },
  { id: "npc_jw_jeong", displayName: "정 서방", note: "방앗간 주인. 아들 이름을 군안에서 빼 준다는 말에 밤 방아를 돌렸다." },
  { id: "npc_jw_chilbok", displayName: "칠복", note: "주막 일꾼. 분이와 정분났다는 소문이 돈다." },
  { id: "npc_jw_jumo", displayName: "주모", note: "큰길 끝 주막 주인. 그 밤 칠복이 장작 패는 것을 내다봤다." },
];

export function writeJoseonHaewonLore(project: Project): void {
  loreExec(project, "set_world_canon", { canon: {
    name: "청석골",
    premise: "조선 후기 산골 고을. 감영 검률이 귀신 짓으로 덮인 죽음 셋을 검안해 진범을 지목하고, 밤에는 원혼에게 진상을 고해 원한을 풀어 보낸다.",
    era: "조선 후기",
    techCeiling: "등잔·물레방아·붓",
    tones: ["grim", "political"],
    absences: ["총포", "서양 문물", "괴물 전투"],
    body: BODY,
  } });
  writeCodex(project, loreExec, ENTRIES, RELATIONS);
  for (const profile of PROFILES) {
    loreExec(project, "upsert_character_profile", { characterId: profile.id, profile: { displayName: profile.displayName, note: profile.note } });
  }
}
