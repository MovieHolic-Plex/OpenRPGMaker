/**
 * 『강호의 철련』 자료집 「이야기」 — 세계 개요·설정집·인물.
 * 조수 도구로만 쓴다. 두 번 불러도 같은 문서다(id 고정).
 */
import type { Project } from "@/project/types";
import type { CharacterProfile } from "@/project/types/events";
import { loreExec, writeCodex, type CodexEntry, type CodexRelation, type LoreExec } from "./loreKit";

const SRC = "openwiki/iron-lotus.md";

const CANON_BODY = [
  "[세계]",
  "강호는 산과 진과 문파로 이어진 길이다. 정파는 청죽문처럼 문을 열고 제자를 받고, 사파는 흑련사처럼 하늘에서 떨어진 것까지 거둔다. 사람들은 검끝에 내공을 싣는다. 설린의 기록에는 그 이름이 아직 없다. 그녀는 그것을 미확인 에너지라고 부른다.",
  "",
  "[유하진]",
  "운무산 기슭의 객잔 마을. 여관, 약방, 동문이 있다. 동문 밖은 청죽림이고, 림 북쪽 끝이 운무산 사원으로 이어진다. 청죽문 장문 소청하가 마을 일을 보고, 여관 주인 고모가 방을 맡긴다.",
  "",
  "[청죽문과 흑련사]",
  "청죽문은 정파다. 제자에게 검과 마음과 기운의 순서를 가르친다. 흑련사는 사파다. 집사 야율검은 하늘에서 떨어진 쇳덩이를 표본으로 해체하려 한다. 두 파는 오래 싸웠고, 이번 추락이 그 싸움의 다음 불씨다.",
  "",
  "[이야기, 제1막]",
  "어느 밤 은빛 고치가 청죽림에 떨어진다. 안에서 중계 기체 설린이 눈을 뜬다. 이튿날 야율검이 유하진에 포고를 붙인다. 소청하는 설린에게 고치의 신호 조각을 사원 천기단으로 보내라 하고, 제자 백리호가 동행한다.",
  "죽림에서 설린은 내공이라는 말을 처음 기록한다. 고치의 잠금 셋 — 현지 이름, 살아 있는 손, 검·기·심 — 을 풀면 신호 조각이 나온다. 사원 문을 연 뒤 마당의 흑련사 선봉을 지나, 천기단 앞에서 야율검과 그가 깨운 철 인형을 쓰러뜨린다.",
  "천기단이 북쪽의 답을 받는다. 설린의 배의 나머지가 아직 살아 있다. 소청하는 제1막을 닫으며, 다음 고개에서 그 빛을 잇라고 한다. 야율검은 본산에서 다시 오겠다고 남긴다.",
  "",
  "[아직 하지 않은 말]",
  "설린은 귀환하면 현지 기록이 지워질 수 있다고 의심하지만, 제1막에서는 그 문장을 읽지 않는다. 흑련사 교주의 이름도 아직 없다. 북쪽 배의 좌표만 남는다.",
].join("\n");

const ENTRIES: readonly CodexEntry[] = [
  { id: "il_place_town", type: "place", name: "유하진", summary: "운무산 기슭의 객잔 마을. 여관과 약방, 동문이 있다.", tags: ["장소"], source: SRC },
  { id: "il_place_grove", type: "place", name: "청죽림", summary: "유하진 동문 밖의 대나무 숲. 설린의 고치가 돌등 옆에 박혀 있다.", tags: ["장소"], source: SRC },
  { id: "il_place_temple", type: "place", name: "운무산 사원", summary: "청죽림 북쪽의 산 사원. 천기단이 있고, 신호 조각으로 문이 열린다.", tags: ["장소"], source: SRC },
  { id: "il_place_sect", type: "place", name: "청죽문", summary: "정파. 장문 소청하가 제자에게 검·기·심의 순서를 가르친다.", tags: ["장소", "문파"], source: SRC },
  { id: "il_faction_orthodox", type: "faction", name: "청죽문", summary: "정파. 유하진을 지키고, 하늘에서 온 아이도 제자로 본다.", tags: ["정파"], source: SRC },
  { id: "il_faction_cult", type: "faction", name: "흑련사", summary: "사파. 하늘에서 떨어진 것을 표본으로 거둔다. 집사 야율검이 앞장선다.", tags: ["사파"], source: SRC },
  { id: "il_char_seolrin", type: "character", name: "설린", summary: "중계 기체. 청죽림에 떨어진 고치에서 눈을 떴다. 내공을 미확인 에너지로 기록한다.", body: "자신을 물건이 아니라고 말한다. 귀환 신호를 보내고 싶어 한다. 전투에서는 패턴을 읽고, 말투는 보고문과 사람 말을 오간다.", tags: ["인물"], source: SRC },
  { id: "il_char_baek", type: "character", name: "백리호", summary: "청죽문 제자. 뜨겁고 곧다. 설린의 기록 말투에 화를 내다 동료가 된다.", tags: ["인물"], source: SRC },
  { id: "il_char_master", type: "character", name: "소청하", summary: "청죽문 장문. 설린을 표본이 아니라 제자로 대한다.", tags: ["인물"], source: SRC },
  { id: "il_char_yayul", type: "character", name: "야율검", summary: "흑련사 집사. 설린을 해체하려 쫓아오고, 제1막 끝에서 북쪽에서 다시 보겠다 남긴다.", tags: ["인물"], source: SRC },
  { id: "il_item_shard", type: "item", name: "신호 조각", summary: "고치 잠금을 풀면 나오는 귀환 신호의 조각. 사원 문과 천기단이 이것을 기다린다.", tags: ["물건"], refs: [{ kind: "item", id: "item_il_signal_shard" }], source: SRC },
  { id: "il_concept_qi", type: "concept", name: "미확인 에너지", summary: "강호가 내공이라 부르는 것. 설린의 센서는 아직 이름을 확정하지 않는다.", tags: ["규칙"], source: SRC },
  { id: "il_concept_order", type: "concept", name: "검·기·심", summary: "청죽문이 가르치는 순서. 몸, 기운, 마음. 고치의 마지막 잠금도 이 순서를 묻는다.", tags: ["규칙"], source: SRC },
  { id: "il_event_crash", type: "event", name: "청죽림 추락", summary: "은빛 고치가 죽림에 떨어지고 설린이 눈을 뜬 밤.", tags: ["사건"], source: SRC },
  { id: "il_event_signal", type: "event", name: "천기단의 답", summary: "야율검을 쓰러뜨린 뒤 천기단이 북쪽의 답을 받는다. 제1막이 여기서 닫힌다.", tags: ["사건"], source: SRC },
  { id: "il_note", type: "guideline", name: "제작 노트", summary: "맵은 전국·에도 손 도트 한 계열. 무림 칩셋은 사람 선택 전이라 쓰지 않는다. 대사는 한국어, 한 상자 두 줄.", tags: ["제작 노트"], source: SRC },
];

const RELATIONS: readonly CodexRelation[] = [
  { a: "il_place_grove", b: "il_place_town", kind: "custom", note: "동문 밖" },
  { a: "il_place_temple", b: "il_place_grove", kind: "custom", note: "림 북쪽" },
  { a: "il_char_master", b: "il_faction_orthodox", kind: "memberOf" },
  { a: "il_char_baek", b: "il_faction_orthodox", kind: "memberOf" },
  { a: "il_char_yayul", b: "il_faction_cult", kind: "memberOf" },
  { a: "il_faction_cult", b: "il_faction_orthodox", kind: "enemyOf" },
  { a: "il_char_seolrin", b: "il_char_baek", kind: "allyOf" },
  { a: "il_char_yayul", b: "il_char_seolrin", kind: "enemyOf" },
  { a: "il_event_crash", b: "il_place_grove", kind: "locatedIn" },
  { a: "il_event_signal", b: "il_place_temple", kind: "locatedIn" },
  { a: "il_item_shard", b: "il_event_crash", kind: "causedBy" },
];

const PROFILES: readonly { id: string; displayName: string; note: string }[] = [
  { id: "il_seolrin", displayName: "설린", note: "중계 기체. 청죽림에 떨어졌다." },
  { id: "il_baek", displayName: "백리호", note: "청죽문 제자. 설린과 동행한다." },
  { id: "il_cheongha", displayName: "소청하", note: "청죽문 장문." },
  { id: "il_yayul", displayName: "야율검", note: "흑련사 집사." },
  { id: "il_gomo", displayName: "고모", note: "유하진 여관 주인." },
  { id: "il_salgu", displayName: "살구", note: "유하진 약재상." },
];

export function applyIronLotusLore(project: Project, exec: LoreExec = loreExec): void {
  exec(project, "set_world_canon", {
    canon: {
      name: "강호의 철련",
      premise: "기계 소녀 설린이 무림의 대나무 숲에 떨어진다. 정파의 제자와 사파의 집사 사이에서, 그녀는 내공을 배우며 집을 부를 신호를 찾는다.",
      tones: ["comic", "mythic", "hopeful"],
      era: "정파와 사파가 산을 나누어 가진 강호",
      techCeiling: "검과 내공, 향로와 천기단까지. 설린의 고치 외에는 기계를 만들지 못한다",
      absences: ["총과 화약", "하늘을 나는 배의 제작", "내공을 수치로 확정하는 학문"],
      laws: {
        power: { present: true, note: "내공. 설린은 미확인 에너지로 기록한다. 청죽문은 검·기·심의 순서를 가르친다." },
        gods: { present: true, note: "사원과 천기단이 하늘을 읽는다. 흑련사는 하늘에서 떨어진 것을 자신의 몫이라 한다." },
        death: { present: true, note: "야율검은 제1막에서 죽지 않고 물러난다. 쓰러진 동료는 향로와 여관에서 일어난다." },
        money: { present: true, note: "골드. 여관 하룻밤 20, 청죽 보약 40." },
      },
      body: CANON_BODY,
      status: "canon",
    },
  });
  writeCodex(project, exec, ENTRIES, RELATIONS);
  for (const profile of PROFILES) {
    const existing: Partial<CharacterProfile> = project.characters?.[profile.id] ?? {};
    exec(project, "upsert_character_profile", {
      characterId: profile.id,
      profile: JSON.parse(JSON.stringify({
        ...existing,
        displayName: profile.displayName,
        note: existing.note ?? profile.note,
      })),
    });
  }
}
