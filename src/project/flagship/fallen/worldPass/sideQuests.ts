/**
 * 서브 퀘스트 둘 — 「서브 퀘스트도 한 두개 추가하고」(사용자 2026-11-04). townQuests.ts 와 같은 꼴(스위치로 단계가 차는 그래프 퀘스트).
 *  Q4 오든의 해독초: 약방 오든이 숲 거미 독 주머니 둘을 부탁한다 → 회복약 셋.
 *  Q5 토비의 잃어버린 연: 광장 게시판의 쪽지 → 숲 어귀 나무에 걸린 연을 찾아 토비에게 → 100G 와 별빛 향 주머니.
 * 게시판은 광장 북쪽 풀밭(광산 골짜기 게시판 2×2, 번들 키트)에 서서 두 의뢰를 다 알린다.
 */
import type { QuestGraphDef } from "@/project/quest/questDef";
import type { Command, GameEvent, Project } from "@/project/types";
import {
  type Cell, all, choices, ensureSwitch, fork, gainGold, has, item, mustMap, narrate, page, putEvent, say, se, setSw, sw,
} from "./common";

const ODEN = "약재상 오든";
const TOBI = "꼬마 토비";
const VENOM = "item_fs_venom_sac";
const KITE = "item_fs_tobi_kite";
export const Q4_ON = "sw_fs_q_venom_on", Q4_DONE = "sw_fs_q_venom_done";
export const Q5_ON = "sw_fs_q_kite_on", Q5_FOUND = "sw_fs_q_kite_found", Q5_DONE = "sw_fs_q_kite_done";

export function noticeBoard(project: Project, hubId: string, front: Cell): void {
  const hub = mustMap(project, hubId);
  putEvent(hub, "ev_fs_notice_board", "광장 게시판", front, [
    page("ev_fs_notice_board_p", "읽는다", [], [
      narrate("광장 게시판이다. 쪽지 두 장이 꽂혀 있다."),
      fork(sw(Q4_DONE), [narrate("(약방) 독 주머니 의뢰 — 「끝났음, 고맙소. 오든」")], [narrate("(약방) 거미 독 주머니 두 개 구함.\n해독초가 모자라오. 약방 오든.")]),
      fork(sw(Q5_DONE), [narrate("(꼬마 글씨) 연 찾았어요!! 고마워요")], [narrate("(꼬마 글씨) 빨간 연을 잃어버렸어요.\n북쪽 숲 쪽으로 날아갔어요. 토비.")]),
      fork(sw(Q5_ON, false), [setSw(Q5_ON), narrate("의뢰 「토비의 잃어버린 연」을 맡았다.")]),
    ]),
  ]);
}

export function odenVenomQuest(project: Project): void {
  const oden = mustMap(project, "fs_apothecary").events.find((e) => e.id === "ev_fs_apothecary");
  if (!oden?.pages?.length) throw new Error("[fallen-world] 약방 오든이 없다");
  const offer = fork(sw(Q4_ON, false), [
    say(ODEN, "덤불거미 독 주머니를 둘만 구해 오겠나.\n독을 알아야 해독초를 달이지."),
    choices([
      { text: "구해 올게요", branch: [setSw(Q4_ON), narrate("의뢰 「오든의 해독초」를 맡았다.")] },
      { text: "다음에요", branch: [] },
    ]),
  ]);
  const notYet = say(ODEN, "독 주머니는 숲의 덤불거미가 지닌다.\n두 개다. 서두를 건 없어.");
  // 아이템 개수 조건이 없다 — 하나씩 받고, 둘째가 없으면 받은 하나를 돌려준다(townQuests 로한의 송곳니와 같은 꼴).
  const turnIn = fork(all(sw(Q4_ON), sw(Q4_DONE, false)), [
    fork(has(VENOM), [item(VENOM, -1), fork(has(VENOM), [
      item(VENOM, -1),
      narrate("독 주머니 둘을 건넸다."),
      say(ODEN, "좋아, 터지지 않게 잘 들고 왔군.\n이걸로 해독초 한 솥이다. 수고비다."),
      item("item_potion", 3),
      se("cc0-se-orp-inventory-cloth"),
      narrate("「회복약」 3개를 받았다."),
      setSw(Q4_DONE),
    ], [item(VENOM, 1), notYet])], [notYet]),
  ]);
  // 계산대 뒤 오든은 계산대 칸의 대리 이벤트(_counter)로 말을 받는다 — 둘 다에 끼운다.
  const counter = mustMap(project, "fs_apothecary").events.find((e) => e.id === "ev_fs_apothecary_counter");
  for (const p of [...oden.pages, ...(counter?.pages ?? [])]) {
    const list = p.commands as Command[];
    const at = list.findIndex((c) => c.kind === "text");
    list.splice(at < 0 ? 0 : at, 0, turnIn, offer);
  }
}

export function tobiKiteQuest(project: Project, forestEdgeId: string, kiteAt: Cell): void {
  const items = project.database.items;
  if (!items.some((i) => i.id === KITE)) {
    items.push({ ...structuredClone(items.find((i) => i.id === "item_fs_silver_spoon")!), id: KITE, name: "빨간 연", description: "토비의 빨간 종이 연.\n꼬리가 나뭇가지에 조금 찢겼다." });
  }
  const edge = mustMap(project, forestEdgeId);
  putEvent(edge, "ev_fs_q_kite_spot", "나뭇가지에 걸린 연", kiteAt, [
    page("ev_fs_q_kite_spot_idle", "평소", [], [narrate("덤불 위로 빨간 종잇조각이 펄럭인다.")]),
    page("ev_fs_q_kite_spot_on", "의뢰 중", [sw(Q5_ON), sw(Q5_FOUND, false)], [
      narrate("나뭇가지에 빨간 연이 걸려 있다.\n발끝을 세워 조심스레 떼어 냈다."),
      item(KITE, 1), se("cc0-se-orp-inventory-cloth"), narrate("「빨간 연」을 손에 넣었다."), setSw(Q5_FOUND),
    ]),
    page("ev_fs_q_kite_spot_done", "가져감", [sw(Q5_FOUND)], [narrate("연이 걸려 있던 가지가 흔들린다.")]),
  ]);
  const tobi = mustMap(project, "fs_hub").events.find((e) => e.id === "ev_fs_kid") as GameEvent | undefined;
  if (!tobi?.pages?.length) throw new Error("[fallen-world] 광장 토비가 없다");
  const back = fork(all(sw(Q5_FOUND), sw(Q5_DONE, false), has(KITE)), [
    narrate("빨간 연을 돌려주었다."),
    item(KITE, -1),
    say(TOBI, "내 연! 꼬리 찢어진 것도 그대로네.\n이거, 엄마가 준 용돈인데… 줄게요!"),
    gainGold(100), item("item_fs_star_scent", 1),
    narrate("100G와 「별빛 향 주머니」를 받았다."),
    setSw(Q5_DONE),
  ]);
  for (const p of tobi.pages) (p.commands as Command[]).unshift(back);
}

export function sideQuestJournal(project: Project): void {
  for (const [id, name] of [[Q4_ON, "Q4 오든의 해독초 수락"], [Q4_DONE, "Q4 오든의 해독초 완료"], [Q5_ON, "Q5 토비의 연 수락"],
    [Q5_FOUND, "Q5 연을 찾았다"], [Q5_DONE, "Q5 토비의 연 완료"]] as const) ensureSwitch(project, id, name);
  const q = (id: string, title: string, summary: string, nodes: [string, string, string][]): QuestGraphDef => ({
    kind: "graph", id, title, summary,
    nodes: nodes.map(([nid, description, s]) => ({ id: nid, description, completesWhen: { kind: "switch", switchId: s, value: true } })),
    edges: nodes.slice(1).map(([nid], i) => ({ from: nodes[i]![0], to: nid })),
  });
  const defs = [
    q("fs_q_venom", "오든의 해독초", "약방 오든이 해독초를 달이려고 덤불거미 독 주머니 두 개를 부탁했다.", [
      ["accept", "약방 오든의 부탁을 듣는다", Q4_ON], ["deliver", "덤불거미 독 주머니 두 개를 오든에게 가져간다", Q4_DONE]]),
    q("fs_q_kite", "토비의 잃어버린 연", "광장 게시판에 토비가 쪽지를 붙였다. 빨간 연이 북쪽 숲 쪽으로 날아갔다고 한다.", [
      ["accept", "광장 게시판의 쪽지를 읽는다", Q5_ON], ["find", "숲 어귀 나뭇가지에 걸린 연을 찾는다", Q5_FOUND], ["return", "광장의 토비에게 연을 돌려준다", Q5_DONE]]),
  ];
  const ids = new Set(defs.map((d) => d.id));
  project.quests = [...(project.quests ?? []).filter((d) => !ids.has((d as { id?: string }).id ?? "")), ...defs];
}
