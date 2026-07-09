// testing/emberWalkthrough.ts
// 《잿불의 유산》 3퀘스트 + 엔딩 완주 시나리오. walkthroughRunner용 스텝 시퀀스.
// 헤드리스로 CI에서 게임을 끝까지 진행해 회귀를 잡는다.
//
// 경로: 마을(수락 Q1/Q3) → 안개숲(Q2 약초 + 슬라임/말벌=열쇠) → 광산(박쥐/골렘=핵)
//      → 마을 되돌아가 Q3 납품 → 광산 뒷문 → 잿빛 고개 → 화염 성소 → 용 처치 + 엔딩.

import { EMBER_ITEM, EMBER_MAP, EMBER_SWITCH, EMBER_VARIABLE } from "@/project/defaults/emberQuestGame";
import type { WalkthroughStep } from "./walkthroughRunner";

export const EMBER_WALKTHROUGH: readonly WalkthroughStep[] = [
  // ── 잿불 마을: Q1(꺼진 화로) + Q3(대장장이 의뢰) 수락 ──
  { do: "moveTo", mapId: EMBER_MAP.village, x: 16, y: 11 }, // 광장 내 reachability 검증
  { do: "interact", eventId: "ev_ember_chief" },
  { do: "choose", index: 0 }, // 의뢰 수락
  { expect: "switch", switchId: EMBER_SWITCH.q1Started },
  { do: "interact", eventId: "ev_ember_smith" },
  { do: "choose", index: 0 },
  { expect: "switch", switchId: EMBER_SWITCH.q3Started },
  { do: "interact", eventId: "ev_ember_gate_a" }, // 동문 → 안개 숲
  { expect: "mapId", mapId: EMBER_MAP.forest },

  // ── 안개 숲: Q2(달빛 약초) + 슬라임/말벌 전투(→ 낡은 열쇠) ──
  { do: "interact", eventId: "ev_forest_herbalist" },
  { do: "choose", index: 0 },
  { expect: "switch", switchId: EMBER_SWITCH.q2Started },
  { do: "interact", eventId: "ev_forest_herb_1" },
  { expect: "item", itemId: EMBER_ITEM.moonHerb, count: 1 },
  { do: "interact", eventId: "ev_forest_herb_2" },
  { do: "interact", eventId: "ev_forest_herb_3" },
  { expect: "variable", variableId: EMBER_VARIABLE.moonHerbs, op: ">=", value: 3 },
  { do: "interact", eventId: "ev_forest_herbalist" }, // 약초 납품
  { expect: "switch", switchId: EMBER_SWITCH.q2Done },
  { expect: "item", itemId: EMBER_ITEM.hiPotion, present: true },
  { do: "interact", eventId: "ev_forest_slime" },
  { do: "battle", expect: "victory" },
  { expect: "switch", switchId: EMBER_SWITCH.battleSlime },
  { do: "interact", eventId: "ev_forest_hornets" },
  { do: "battle", expect: "victory" },
  { expect: "item", itemId: EMBER_ITEM.oldKey, present: true },
  { do: "interact", eventId: "ev_forest_mine_door" }, // 열쇠로 광산 문
  { expect: "mapId", mapId: EMBER_MAP.mine },

  // ── 메마른 광산: 박쥐 + 골렘 전투(→ 골렘의 핵) ──
  { do: "interact", eventId: "ev_mine_bats" },
  { do: "battle", expect: "victory" },
  { expect: "switch", switchId: EMBER_SWITCH.battleBats },
  { do: "interact", eventId: "ev_mine_golem" },
  { do: "battle", expect: "victory" },
  { expect: "item", itemId: EMBER_ITEM.golemCore, present: true },
  { expect: "switch", switchId: EMBER_SWITCH.battleGolem },

  // ── Q3 납품을 위해 마을로 되돌아가기: 광산 → 숲 → 마을 ──
  { do: "interact", eventId: "ev_mine_return" }, // → 숲
  { expect: "mapId", mapId: EMBER_MAP.forest },
  { do: "interact", eventId: "ev_forest_return" }, // → 마을
  { expect: "mapId", mapId: EMBER_MAP.village },
  { do: "interact", eventId: "ev_ember_smith" }, // 핵 납품
  { expect: "switch", switchId: EMBER_SWITCH.q3Done },
  { expect: "item", itemId: EMBER_ITEM.guardTalisman, present: true },

  // ── 다시 성소로: 마을 → 숲 → 광산 → 뒷문 → 고개 → 성소 ──
  { do: "interact", eventId: "ev_ember_gate_a" },
  { expect: "mapId", mapId: EMBER_MAP.forest },
  { do: "interact", eventId: "ev_forest_mine_door" },
  { expect: "mapId", mapId: EMBER_MAP.mine },
  { do: "interact", eventId: "ev_mine_back_exit" }, // → 잿빛 고개
  { expect: "mapId", mapId: EMBER_MAP.pass },
  { do: "interact", eventId: "ev_pass_hermit" }, // 회복
  { do: "interact", eventId: "ev_pass_east" }, // → 성소
  { expect: "mapId", mapId: EMBER_MAP.sanctum },

  // ── 화염 성소: 용 처치 + 엔딩 ──
  { do: "interact", eventId: "ev_sanctum_keeper" }, // 회복
  { do: "interact", eventId: "ev_sanctum_dragon" },
  { do: "battle", expect: "victory" },
  { expect: "switch", switchId: EMBER_SWITCH.battleDragon },
  { expect: "switch", switchId: EMBER_SWITCH.q1Clear },
  { expect: "ended" },
];
