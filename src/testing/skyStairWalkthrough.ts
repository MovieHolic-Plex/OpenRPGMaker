// testing/skyStairWalkthrough.ts
// 《천공의 계단》 5퀘스트 + 보스 + 엔딩 완주 시나리오. walkthroughRunner 용 스텝 시퀀스.
// 헤드리스로 게임을 끝까지 진행해, 층이 하나라도 막히면 CI 가 잡는다.
//
// 경로: 항구(Q1 등대) → 밀밭(Q2 허수아비) → 안개 숲(Q3 아이) → 호수 신전(Q4 세 봉인)
//      → 폐광(통행증) → 설산 관문 → 천공 제단(파수꾼 3인 → 보스 → 엔딩).
//
// 이 시나리오가 존재하는 이유: 이 게임을 만들면서 **층간 이동문 6개가 벽 타일 위에
// 놓여 있었다**(2026-07-27 실측). 밟을 수 없으니 게임을 깰 수 없었는데, 타입 검사도
// projectLint 도 그걸 잡지 못했다 — lint 는 transfer 의 *목적지*만 보고 문 자체가
// 도달 가능한지는 보지 않는다. 완주 시나리오만이 그 종류의 결함을 잡는다.

import { SKY_ITEM, SKY_MAP, SKY_SWITCH, SKY_VARIABLE } from "@/project/defaults/skyStairGame";
import type { WalkthroughStep } from "./walkthroughRunner";

export const SKY_STAIR_WALKTHROUGH: readonly WalkthroughStep[] = [
  // ── 1층 항구 아셀: Q1 등대의 불씨 ──────────────────────────────────────
  { do: "moveTo", mapId: SKY_MAP.harbor, x: 15, y: 15 }, // 광장까지 실제로 걸어가지는지
  { do: "interact", eventId: "ev_sky_h_lightkeeper" },
  { expect: "switch", switchId: SKY_SWITCH.q1Started },
  { do: "interact", eventId: "ev_sky_h_oil" },
  { expect: "item", itemId: SKY_ITEM.lampOil, count: 1 },
  { do: "interact", eventId: "ev_sky_h_lighthouse" },
  { expect: "switch", switchId: SKY_SWITCH.q1Done },
  { expect: "switch", switchId: SKY_SWITCH.gateWheat },
  { expect: "item", itemId: SKY_ITEM.hiPotion, present: true },
  { do: "interact", eventId: "ev_sky_h_gate_n" },
  { expect: "mapId", mapId: SKY_MAP.wheat },

  // ── 2층 황금 밀밭: Q2 밀밭의 허수아비(3인 전투) ────────────────────────
  { do: "interact", eventId: "ev_sky_w_farmer" },
  { expect: "switch", switchId: SKY_SWITCH.q2Started },
  { do: "interact", eventId: "ev_sky_w_scarecrow" },
  { do: "battle", expect: "victory" },
  { expect: "switch", switchId: SKY_SWITCH.q2Done },
  { expect: "item", itemId: SKY_ITEM.charm, present: true },
  { expect: "switch", switchId: SKY_SWITCH.gateMist },
  { do: "interact", eventId: "ev_sky_w_gate_n" },
  { expect: "mapId", mapId: SKY_MAP.mistwood },

  // ── 3층 안개 숲: Q3 안개 속의 아이(단서 3개 → 3인 전투) ────────────────
  { do: "interact", eventId: "ev_sky_m_mother" },
  { expect: "switch", switchId: SKY_SWITCH.q3Started },
  { do: "interact", eventId: "ev_sky_m_clue_1" },
  { do: "interact", eventId: "ev_sky_m_clue_2" },
  { do: "interact", eventId: "ev_sky_m_clue_3" },
  { expect: "variable", variableId: SKY_VARIABLE.scarves, op: ">=", value: 3 },
  { do: "interact", eventId: "ev_sky_m_child" },
  { do: "battle", expect: "victory" },
  { expect: "switch", switchId: SKY_SWITCH.q3Done },
  { expect: "item", itemId: SKY_ITEM.scarf, present: true },
  { do: "interact", eventId: "ev_sky_m_gate_n" },
  { expect: "mapId", mapId: SKY_MAP.shrine },

  // ── 4층 호수 신전: Q4 세 개의 봉인(3인 전투 ×3) ───────────────────────
  { do: "interact", eventId: "ev_sky_s_priest" },
  { expect: "switch", switchId: SKY_SWITCH.q4Started },
  { do: "interact", eventId: "ev_sky_s_seal1" },
  { do: "battle", expect: "victory" },
  { expect: "switch", switchId: SKY_SWITCH.seal1 },
  { expect: "item", itemId: SKY_ITEM.seal1, present: true },
  { do: "interact", eventId: "ev_sky_s_seal2" },
  { do: "battle", expect: "victory" },
  { expect: "switch", switchId: SKY_SWITCH.seal2 },
  { do: "interact", eventId: "ev_sky_s_seal3" },
  { do: "battle", expect: "victory" },
  { expect: "switch", switchId: SKY_SWITCH.seal3 },
  { expect: "variable", variableId: SKY_VARIABLE.seals, op: ">=", value: 3 },
  { do: "interact", eventId: "ev_sky_s_priest" }, // 봉인석 3개 → 천공의 열쇠
  { expect: "switch", switchId: SKY_SWITCH.q4Done },
  { expect: "item", itemId: SKY_ITEM.skyKey, present: true },
  { expect: "switch", switchId: SKY_SWITCH.gateMine },
  { do: "interact", eventId: "ev_sky_s_gate_n" },
  { expect: "mapId", mapId: SKY_MAP.mine },

  // ── 5층 잊힌 폐광: Q5 시작 + 설산 통행증 ──────────────────────────────
  { do: "interact", eventId: "ev_sky_mine_miner" },
  { expect: "item", itemId: SKY_ITEM.snowPass, present: true },
  { expect: "switch", switchId: SKY_SWITCH.q5Started },
  { expect: "switch", switchId: SKY_SWITCH.gateSnow },
  { do: "interact", eventId: "ev_sky_mine_mimic" }, // 4인 전투(선택 전투)
  { do: "battle", expect: "victory" },
  { expect: "item", itemId: SKY_ITEM.bomb, present: true },
  { do: "interact", eventId: "ev_sky_mine_gate_n" },
  { expect: "mapId", mapId: SKY_MAP.snowgate },

  // ── 6층 설산 관문: 통행증 제시 ────────────────────────────────────────
  { do: "interact", eventId: "ev_sky_sn_gatekeeper" },
  { expect: "switch", switchId: SKY_SWITCH.gateAltar },
  { do: "interact", eventId: "ev_sky_sn_gate_n" },
  { expect: "mapId", mapId: SKY_MAP.altar },

  // ── 7층 천공 제단: 파수꾼 3인 → 보스 → 엔딩 ───────────────────────────
  { do: "interact", eventId: "ev_sky_al_warden" },
  { do: "battle", expect: "victory" },
  { do: "interact", eventId: "ev_sky_al_demon" },
  { do: "battle", expect: "victory" },
  { expect: "switch", switchId: SKY_SWITCH.q5Done },
  { expect: "item", itemId: SKY_ITEM.starShard, present: true },
  { expect: "ended" },
];
