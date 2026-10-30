/**
 * 「이상 없음」 이야기 탭(세계 개요·설정집·인물) 저작 — 조수 도구(set_world_canon · upsert_world_codex · upsert_character_profile)만 쓴다.
 * 사실은 빌더(nothingToReport.ts)의 대사·아이템에서 왔다. 30년 전 일의 진상과 엔딩 갈래는 ai-hidden 으로 둔다.
 */
import type { Project } from "@/project/types";
import { loreExec, writeCodex, type CodexEntry, type CodexRelation, type LoreExec } from "./loreKit";

const MAP = { f1: "map_nr_1f", f2: "map_nr_2f", f3: "map_nr_3f", roof: "map_nr_roof", yard: "map_nr_yard" } as const;

const CANON_BODY = [
  "장소",
  "사쿠라자카 중학교. 3층 본관과 옥상, 체육관, 흙 운동장이 있는 평범한 공립 중학교다. 11월 밤 9시 40분이 지나면 현관 유리문은 쇠사슬로 잠기고, 교문도 닫힌다. 복도에는 초록 비상구 등과 창으로 드는 달빛뿐이다.",
  "숙직",
  "밤에는 숙직 교사 한 명이 학교를 돈다. 손전등을 들고 문을 하나씩 열어 보고, 숙직 일지에 층마다 「이상 없음」이라고 적는다. 사에키 선생은 그 일을 30년째 하고 있다.",
  "그날",
  "1995년 11월 7일 밤, 숙직이던 사에키 선생은 옥상을 확인하지 않고 일지에 「옥상 이상 없음」이라고 적었다. 그날 밤 옥상 철문은 밖에서 빗장이 걸려 있었고, 2학년 마키노 사요는 아침까지 그 위에 있었다. 사요가 빌린 도서 『별의 지도』는 지금도 반납되지 않았다.",
  "지금",
  "11월 7일 밤, 2학년 하야세 린은 일직 일지를 쓰다 교실에서 잠들었다. 깨어 보니 학교는 잠겼고 복도에는 손전등 하나가 오간다. 들키면 끝이다. 선생은 손전등을 얼굴에 대고 조용히 말한다. 「찾았다.」",
  "규칙",
  "숙직 선생은 보이는 것과 들리는 것을 쫓는다. 달리면 멀리서도 들리고, 걸으면 가까이서만 들린다. 청소 도구함·커튼·책상 밑에 숨으면 지나간다. 숨는 것을 본 사람에게는 소용없다. 3층에는 세일러복 학생이 있다. 그 학생은 벽을 지나 천천히 다가오고, 계단으로 내려가면 따라오지 않는다.",
  "톤",
  "소리로 겁을 준다. 음악 대신 발소리와 숨소리, 오래 비워 둔 복도. 피도 괴물도 없다. 무서운 것은 한 사람이 확인하지 않은 한 줄이다.",
].join("\n\n");

const ENTRIES: readonly CodexEntry[] = [
  { id: "nr_place_school", type: "place", name: "사쿠라자카 중학교", summary: "이야기의 무대. 3층 본관·옥상·운동장.", body: "밤 9시 40분 방송 뒤 현관과 교문이 잠긴다. 교실마다 청소 도구함이 있고, 교무실 벽에 네 자리 번호 열쇠함이 있다.", tags: ["장소"], refs: [{ kind: "map", id: MAP.f1 }, { kind: "map", id: MAP.f2 }, { kind: "map", id: MAP.f3 }], source: "nothingToReport.ts 맵" },
  { id: "nr_place_2f", type: "place", name: "2층 교실과 복도", summary: "린이 깨어나는 2-B 교실, 2-A 교실, 동서로 긴 복도.", body: "복도 동쪽 끝에 계단참이 있다. 교실 뒷문 곁과 복도에 청소 도구함이 셋 있다.", tags: ["장소"], refs: [{ kind: "map", id: MAP.f2 }] },
  { id: "nr_place_1f", type: "place", name: "1층 현관·교무실·보건실", summary: "쇠사슬 감긴 현관 유리문, 열쇠함이 있는 교무실, 커튼 친 보건실.", body: "교무실 책상 위에 30년 전 숙직 일지가 있다. 보건실 침대 시트 밑에 낱장 한 장이 끼어 있다.", tags: ["장소"], refs: [{ kind: "map", id: MAP.f1 }] },
  { id: "nr_place_3f", type: "place", name: "3층 음악실·도서실·이과실", summary: "발소리가 없는 층. 세일러복 학생이 나온다.", body: "도서실 대출 카운터 서랍에 『별의 지도』 대출 카드가 있다. 음악실 피아노의 가장 낮은 도가 눌린 채다. 이과실 표본장 밑에 낱장이 접혀 있다.", tags: ["장소"], refs: [{ kind: "map", id: MAP.f3 }] },
  { id: "nr_place_roof", type: "place", name: "옥상", summary: "철문 너머. 펜스와 고가 수조.", body: "옥상 열쇠는 녹슬어 있다. 30년 동안 아무도 쓰지 않았다.", tags: ["장소"], refs: [{ kind: "map", id: MAP.roof }] },
  { id: "nr_place_yard", type: "place", name: "운동장과 교문", summary: "현관 밖. 어둡고 넓은 흙 운동장 끝에 교문이 있다.", tags: ["장소"], refs: [{ kind: "map", id: MAP.yard }] },
  { id: "nr_item_log", type: "item", name: "숙직 일지", summary: "숙직 교사가 층마다 「이상 없음」을 적는 일지.", body: "1995년 11월 7일 쪽: 「3층 이상 없음. 음악실 이상 없음. 옥상 이상 없음.」 옥상 칸만 펜 눌림이 얕다.", tags: ["단서"], refs: [{ kind: "item", id: "item_nr_page1" }] },
  { id: "nr_item_pages", type: "item", name: "일지 낱장 세 장", summary: "교무실 책상, 보건실 침대, 이과실 표본장에서 하나씩.", body: "세 장을 다 읽은 사람만 옥상 철문 앞에서 열쇠를 돌린다.", tags: ["단서"], refs: [{ kind: "item", id: "item_nr_page2" }, { kind: "item", id: "item_nr_page3" }] },
  { id: "nr_item_card", type: "item", name: "대출 카드 『별의 지도』", summary: "대출: 2학년 마키노 사요 · 11월 7일. 반납: 빈칸.", tags: ["단서"] },
  { id: "nr_item_keybox", type: "item", name: "교무실 열쇠함", summary: "네 자리 번호 자물쇠. 메모: 「번호는 그날이다. 잊으면 안 되는 날.」", body: "열면 소리가 크다. 현관 열쇠와 옥상 열쇠가 들어 있다.", tags: ["장치"], refs: [{ kind: "item", id: "item_nr_key_entrance" }, { kind: "item", id: "item_nr_key_roof" }] },
  { id: "nr_item_flashlight", type: "item", name: "손전등", summary: "2-B 교탁 서랍. 앞쪽 부채꼴만 밝힌다.", tags: ["도구"], refs: [{ kind: "item", id: "item_nr_flashlight" }] },
  { id: "nr_event_1107", type: "event", name: "1995년 11월 7일 밤", summary: "숙직 교사가 옥상을 확인하지 않은 밤.", body: "옥상 철문은 밖에서 빗장이 걸려 있었다. 다음 날 아침 일지에는 「누가 걸었는지 모름」이라고 적혔다.", tags: ["과거"], visibility: "ai-hidden" },
  { id: "nr_concept_rules", type: "concept", name: "숨기와 소리", summary: "보이면 쫓고 들리면 온다. 숨으면 지나간다.", body: "달리면 8칸 밖까지 들린다. 걸으면 3칸. 열쇠함·쇠사슬 같은 큰 소리는 더 멀리 간다. 붙잡히면 그 층에 들어온 자리에서 다시 한다. 모은 것은 그대로 남는다.", tags: ["규칙"] },
  { id: "nr_guideline_tone", type: "guideline", name: "톤 지침", summary: "소리로 겁준다. 깜짝 놀래기는 게임 전체 두 번.", body: "음악 대신 발소리. 「!」·땀 말풍선 금지. 피·괴물 금지. 공포 장면에는 초상을 띄우지 않는다. 짧은 어른의 문장.", tags: ["지침"], visibility: "ai-hidden" },
  { id: "nr_guideline_endings", type: "guideline", name: "엔딩 갈래", summary: "하교(A)와 이상 있음(B, 진 엔딩).", body: "현관 열쇠로 운동장을 건너 교문을 넘으면 A. 낱장 세 장을 다 모으고 옥상 열쇠로 올라가 일지 마지막 줄에 「옥상 이상 있음」이라고 적으면 B.", tags: ["지침"], visibility: "ai-hidden" },
];

const RELATIONS: readonly CodexRelation[] = [
  { a: "nr_event_1107", b: "nr_place_roof", kind: "locatedIn" },
  { a: "nr_item_pages", b: "nr_item_log", kind: "custom", note: "같은 일지에서 떨어져 나왔다" },
  { a: "nr_item_card", b: "nr_event_1107", kind: "causedBy", note: "그날 빌린 책" },
  { a: "nr_item_keybox", b: "nr_event_1107", kind: "custom", note: "번호는 그날이다" },
];

const PROFILES = [
  { characterId: "rin", displayName: "하야세 린", note: "2학년 B반. 11월 7일 일직. 일지를 쓰다 교실에서 잠들었다.", nameColor: "#c9d6ff" },
  { characterId: "saeki", displayName: "사에키 선생", note: "숙직 교사. 30년째 밤마다 손전등을 들고 학교를 돈다. 수첩에 같은 말을 적는다. 「이상 없음.」", nameColor: "#ffe6a8" },
  { characterId: "sayo", displayName: "마키노 사요", note: "30년 전 2학년. 세일러복. 대출 카드의 반납 칸이 비어 있다.", nameColor: "#a9c4ff" },
];

export function applyNothingToReportLore(project: Project, exec: LoreExec = loreExec): void {
  exec(project, "set_world_canon", {
    canon: {
      name: "사쿠라자카 중학교 (이상 없음)",
      premise: "11월 7일 밤, 잠긴 중학교에서 깨어난 2학년 하야세 린이 숙직 교사의 손전등을 피해 빠져나가려 한다. 열쇠함 번호는 30년 전 「그날」이다.",
      tones: ["horror", "gothic"],
      era: "현대 일본(지금, 그리고 30년 전 1995년)",
      techCeiling: "현대. 손전등, 교내 방송, 꺼진 휴대폰",
      absences: ["피와 살상 묘사", "괴물", "전투"],
      laws: {
        power: { present: false, note: "초능력도 무기도 없다. 숨고, 듣고, 읽는다." },
        death: { present: true, note: "30년 전 옥상에서 한 학생이 아침을 맞지 못했다. 그 학생은 아직 3층에 있다." },
      },
      body: CANON_BODY,
      status: "canon",
    },
  });
  writeCodex(project, exec, ENTRIES, RELATIONS);
  for (const profile of PROFILES) {
    const existing = project.characters?.[profile.characterId];
    exec(project, "upsert_character_profile", {
      characterId: profile.characterId,
      profile: {
        displayName: profile.displayName,
        note: existing?.note?.trim() ? existing.note : profile.note,
        dialogue: { ...(existing?.dialogue ?? {}), nameColor: existing?.dialogue?.nameColor ?? profile.nameColor },
      },
    });
  }
}
