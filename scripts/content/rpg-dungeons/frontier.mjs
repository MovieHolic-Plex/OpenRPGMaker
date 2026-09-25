// Frontier dungeons (2026-09-25): five maps of a normal fantasy RPG that the set was missing —
//  - 마왕성 정문 홀: the demon castle's entrance hall, north arch → dungeon-demon-hall's south door;
//  - 투기장 경기장: the sand floor ringed by stone stands, reached from interior-arena-waiting-room's stair;
//  - 늪 신전: a ruined temple half swallowed by a poisonous swamp, rotting boardwalks over bog water;
//  - 해적 소굴: a sea cave hideout with a hidden dock on an inlet from the open sea;
//  - 우물 밑 굴: a small first-quest cellar reached by climbing down a village well.
// Same grammar as the sunken temple: doors are cut into the room (north = arch on the wall face, others = a gap in
// the one-cell rim at the map edge), every prop stands in a group with a reason, built rooms get no floor dressing.
import { grid } from "./kit.mjs";

export function frontierPlans() {
  return [demonFront(), arena(), swampTemple(), pirateCove(), wellCellar()];
}

function demonFront() {
  const W = 33, H = 25;
  return {
    id: "dungeon-demon-front", name: "마왕성 · 정문 홀", theme: "demon", series: "frontier", placeKind: "facility", groves: 0, heaps: 0,
    art: grid(W, H, [
      [".", 3, 3, 29, 23], // 정문 홀
      [".", 14, 24, 18, 24], // 남쪽 성문(테두리에 난 문 틈)
      ["q", 14, 5, 18, 24], // 성문에서 아치까지 무늬 석판 길
      ["r", 15, 5, 17, 24], // 그 위 붉은 카펫
      ["L", 4, 6, 11, 12, { blob: 3, wobble: 0.12 }], ["L", 21, 6, 28, 12, { blob: 8, wobble: 0.12 }], // 양옆 용암 못
      ["D", 4, 15, 10, 20], ["D", 22, 15, 28, 20], // 양옆 단
    ]),
    props: [
      ["A", 15, 3], ["G", 13, 5], ["G", 19, 5], // 북쪽 벽 아치(→ 1층 복도)와 가고일
      ["I", 12, 8], ["I", 20, 8], ["I", 12, 12], ["I", 20, 12], ["I", 12, 16], ["I", 20, 16], // 카펫 양옆 석주 줄
      ["G", 13, 22], ["G", 19, 22], ["T", 11, 22], ["T", 21, 22], // 성문 안쪽 가고일과 화로
      ["N", 6, 16], ["T", 4, 15], ["T", 10, 15], // 서쪽 단: 소환 마법진과 화로
      ["G", 23, 15], ["G", 27, 15], ["K", 24, 18], ["K", 26, 19], ["U", 25, 19], // 동쪽 단: 가고일 둘이 지키는 뼈 무더기
      ["w", 5, 4], ["w", 9, 4], ["w", 23, 4], ["w", 27, 4], ["x", 12, 3], ["y", 20, 3],
    ],
    entry: [16, 24],
    targets: [[16, 5], [7, 21], [25, 21], [5, 13], [27, 13]],
    exits: [{ at: [16, 24], to: "outside", note: "남쪽 성문 → 마왕성 바깥(외관 맵 outdoor-demon-castle, 도착 좌표는 외관 맵이 정한다)" }, { at: [16, 5], to: "dungeon-demon-hall", arrive: [17, 16], note: "북쪽 벽 아치 → 1층 복도 남쪽 문" }],
    note: "마왕성 성문을 들어서면 나오는 정문 홀. 남쪽 성문 틈에서 무늬 석판 위 붉은 카펫이 북쪽 벽 석조 아치까지 곧게 가고, 양옆 석주 세 쌍이 줄지어 선다. 카펫 양쪽에 모양이 다른 용암 못 둘, 그 아래 갈색 단 둘 — 서쪽 단엔 화로 둘 사이 소환 마법진, 동쪽 단엔 가고일 둘이 지키는 뼈 무더기. 성문 안쪽과 아치 앞을 가고일이 지키고, 북쪽 벽엔 횃불과 금",
  };
}

function arena() {
  const W = 36, H = 30;
  return {
    id: "dungeon-arena-floor", name: "투기장 · 경기장", theme: "hall", series: "frontier", placeKind: "facility", groves: 0, heaps: 0,
    art: grid(W, H, [
      [".", 2, 2, 33, 28], // 경기장 건물
      [".", 15, 29, 20, 29], // 남쪽 관중 출입문(테두리 문 틈)
      ["q", 4, 5, 31, 5], ["q", 4, 7, 31, 7], ["q", 4, 25, 31, 25], // 관중석 단(무늬 석판 줄)
      ["y", 8, 9, 27, 23, { blob: 5, wobble: 0.06 }], // 모래 경기장
      ["D", 14, 4, 21, 8], // 북쪽 우승자 관람석(단)
    ]),
    props: [
      ["Z", 16, 4], ["T", 14, 4], ["T", 21, 4], ["G", 14, 7], ["G", 21, 7], // 관람석: 왕좌, 화로, 가고일
      ["I", 6, 10], ["I", 6, 14], ["I", 6, 18], ["I", 6, 22], ["I", 29, 10], ["I", 29, 14], ["I", 29, 18], ["I", 29, 22], // 모래 양옆 석주 열
      ["-", 3, 12], ["_", 3, 13], ["j", 3, 16], ["E", 2, 16], ["E", 2, 17], // 서쪽: 대기실로 내려가는 투사 계단과 물통·나무통
      ["S", 31, 15], ["T", 32, 13], ["T", 32, 18], // 동쪽: 승리의 여신상과 화로
      ["G", 13, 27], ["G", 22, 27], // 남쪽 출입문 양옆
      ["w", 6, 3], ["w", 11, 3], ["w", 24, 3], ["w", 29, 3],
    ],
    entry: [17, 29],
    targets: [[17, 16], [4, 15], [30, 16], [17, 9], [5, 26]],
    exits: [{ at: [17, 29], to: "outside", note: "남쪽 관중 출입문 → 투기장 바깥" }, { at: [4, 14], to: "interior-arena-waiting-room", arrive: [16, 6], note: "서쪽 투사 계단(내려감) → 투기장 대기실 동벽 계단 앞" }],
    note: "모래 경기장을 석조 관중석이 두른 투기장. 북쪽 관중석 가운데 갈색 단 위 우승자 관람석(왕좌·화로·가고일), 관중석은 무늬 석판 단 줄로 층을 나눴다. 모래 양옆을 석주 열이 두르고, 서쪽 관중석 아래엔 대기실로 내려가는 투사 계단(난간 뒤)과 곁의 물통·나무통, 동쪽엔 승리의 여신상과 화로 둘. 남쪽 테두리 문 틈이 관중 출입문",
  };
}

function swampTemple() {
  const W = 38, H = 28;
  return {
    id: "dungeon-swamp-temple", name: "늪 신전 · 독늪에 잠긴 폐신전", theme: "stone", series: "frontier", placeKind: "natural", groves: 0, heaps: 0, tileset: "oprn_dungeon_cave",
    art: grid(W, H, [
      [".", 2, 11, 35, 26, { blob: 11, wobble: 0.1 }], // 독늪 동굴
      [".", 15, 22, 20, 27], // 남쪽 입구(테두리 문 틈)
      [".", 8, 2, 29, 12], // 폐신전(지은 방)
      ["t", 8, 4, 29, 11], // 신전 석판 바닥
      ["q", 17, 4, 20, 11], // 신랑
      ["W", 4, 13, 16, 22, { blob: 4, wobble: 0.12 }], ["W", 21, 13, 34, 22, { blob: 9, wobble: 0.12 }], // 독늪 물
      ["%", 16, 16, 21, 17], // 가운데 널판 다리
      ["%", 9, 19, 15, 19], // 서쪽 섬으로 가는 널판
    ]),
    props: [
      ["S", 18, 4], ["T", 16, 4], ["T", 21, 4], // 신전 안쪽: 늪의 여신상과 화로
      ["I", 10, 5], ["I", 14, 5], ["I", 23, 5], ["I", 27, 5], ["I", 10, 9], ["I", 27, 9], ["R", 13, 10], ["R", 23, 10], // 석주(둘은 무너져 돌무더기)
      ["V", 9, 3], ["W", 12, 3], ["V", 25, 3], ["W", 28, 3], ["x", 21, 2],
    ],
    entry: [17, 27],
    targets: [[18, 6], [9, 7], [28, 7], [5, 24], [33, 24]],
    exits: [{ at: [17, 27], to: "outside", note: "남쪽 입구 → 늪지대" }],
    note: "초안",
  };
}

function pirateCove() {
  const W = 38, H = 26;
  return {
    id: "dungeon-pirate-cove", name: "해적 소굴 · 숨은 선착장", theme: "cave", series: "frontier", placeKind: "natural", groves: 0, heaps: 0, dress: "sea", tileset: "oprn_dungeon_sea",
    art: grid(W, H, [
      [".", 2, 2, 13, 10, { blob: 21, wobble: 0.1 }], // 북서쪽 야영 굴
      [".", 1, 8, 25, 19, { blob: 23, wobble: 0.08 }], // 가운데 모래 굴
      [".", 17, 1, 31, 10, { blob: 25, wobble: 0.1 }], // 북동쪽 망루 턱
      [".", 2, 15, 10, 23, { blob: 27, wobble: 0.12 }], // 남서쪽 보물 굴
      [".", 15, 16, 30, 23, { blob: 29, wobble: 0.1 }], // 남동쪽 물가
      [".", 0, 10, 3, 13], // 서쪽 굴길(테두리 문 틈)
      ["#", 14, -1, 19, 11, { blob: 31, wobble: 0.12 }], // 야영 굴과 망루 턱을 가르는 바위 혀
      ["W", 18, 3, 22, 7, { blob: 35, wobble: 0.12 }], // 망루 턱의 조수 웅덩이
      ["W", 3, 12, 13, 19, { blob: 41, wobble: 0.1 }], // 모래 굴 조수 웅덩이
      ["%", 7, 12, 8, 19], // 야영지에서 보물 굴로 건너는 널판
      ["W", 18, 18, 28, 22, { blob: 47, wobble: 0.12 }], // 남쪽으로 들어온 바닷물
      ["#", 12, 17, 18, 26, { blob: 43, wobble: 0.12 }], // 보물 굴과 물가를 가르는 남쪽 바위 혀
      ["W", 22, 7, 37, 21, { blob: 6, wobble: 0.1 }], ["W", 30, 11, 37, 16], // 바다로 트인 물길(동쪽 맵 밖으로)
      ["|", 5, 5, 10, 8], // 야영지 널마루
      ["|", 24, 3, 29, 6], // 망루 널마루(바다 어귀를 내려다본다)
      ["%", 18, 13, 27, 14], // 선착장 널판
      ["%", 27, 15, 28, 15], // 배에 걸친 널판
      ["%", 27, 16, 30, 16], ["%", 25, 17, 32, 17], ["%", 27, 18, 30, 18], // 선착장에 댄 배(이물·고물이 뾰족한 선체)
    ]),
    props: [
      ["t", 6, 7], ["(", 5, 7], [")", 9, 7], ["T", 8, 5], ["}", 11, 5], ["}", 12, 5], ["E", 5, 5], ["E", 5, 6], // 야영지: 탁자·의자·화로·침대 둘·나무통
      ["E", 19, 11], ["E", 20, 11], ["E", 19, 12], ["j", 20, 12], ["E", 18, 15], ["J", 19, 15], // 선착장 뿌리 양옆에 부린 짐
      ["E", 28, 17], ["J", 29, 17], // 배에 실린 짐
      ["E", 2, 16], ["J", 2, 17], // 굴길 어귀에 부려 둔 밀수품
      ["H", 5, 22], ["H", 7, 22], ["J", 6, 22], ["E", 4, 21], ["K", 8, 21], // 남서쪽 굴 끝 보물 더미와 지키다 죽은 해적
      ["T", 27, 3], [")", 28, 5], // 망루 단: 화로와 바다를 보는 의자
    ],
    extra: [[27, 16, 252], [28, 16, 253], [29, 16, 253], [30, 16, 254], [27, 18, 252], [28, 18, 253], [29, 18, 253], [30, 18, 254]], // 뱃전(어두운 판자)
    entry: [0, 12],
    targets: [[7, 8], [6, 21], [26, 13], [32, 17], [25, 17], [26, 5]],
    exits: [{ at: [0, 12], to: "outside", note: "서쪽 굴길 → 해안 절벽" }],
    note: "초안",
  };
}

function wellCellar() {
  const W = 20, H = 16;
  return {
    id: "dungeon-well-cellar", name: "우물 밑 굴 · 첫 모험", theme: "stone", series: "frontier", placeKind: "natural", groves: 0, heaps: 0, tileset: "oprn_dungeon_cave",
    art: grid(W, H, [
      [".", 3, 2, 17, 11, { blob: 3, wobble: 0.1 }], [".", 7, 2, 11, 5], // 굴과 사다리 벽
      [".", 1, 8, 9, 14, { blob: 17, wobble: 0.12 }], // 남서쪽 쥐 둥지 굴
      ["|", 8, 4, 10, 5], // 사다리 밑 낡은 널판 디딤
      ["k", 7, 3, 16, 13, { blob: 7, wobble: 0.1 }], // 물이 스며 젖은 바닥
      ["W", 12, 6, 19, 14, { blob: 5, wobble: 0.15 }], // 동쪽 벽에서 스며 나와 고인 물웅덩이
    ]),
    props: [
      ["h", 9, 2], ["h", 9, 3], ["j", 10, 5], // 우물로 오르는 사다리와 떨어진 두레박
      ["B", 4, 6], ["U", 6, 7], ["z", 6, 6], // 무너져 내린 우물 돌
      ["V", 13, 3], ["W", 14, 3], // 물 스미는 벽의 이끼 덩굴
      ["H", 3, 12], ["K", 2, 12], ["U", 4, 13], ["z", 5, 13], ["E", 2, 13], // 쥐 둥지 구석: 뼈·잔돌·부서진 통 사이 잃어버린 상자
    ],
    entry: [9, 4],
    targets: [[3, 11], [11, 12], [13, 5]],
    exits: [{ at: [9, 4], to: "outside", note: "사다리 → 마을 우물" }],
    note: "초안",
  };
}
