// 망자의 지하 묘지(5층)와 옛 왕도 하수도 미궁(5칸). Built rooms on the stone sheet: rectangular halls whose top two rows
// are the wall face, passages cut into them, burial and sewer furniture in groups with a reason (a niche row, a noble's
// bier, a sluice with its lever, a rat nest by the outfall). Rubble only in a corner heap or two.
import { grid, series, row, col, railing } from "./lib.mjs";

const crypt = series({ tileset: "oprn_dungeon_stone", theme: "teal", series: "crypt", seriesName: "망자의 지하 묘지", env: "지하", dress: "crypt", groves: 0, heaps: 2, topUp: "crypt" });
const sewer = series({ tileset: "oprn_dungeon_stone", theme: "teal", series: "sewer", seriesName: "옛 왕도 하수도", env: "지하", dress: "stone", groves: 0, heaps: 2, topUp: "crypt" });

export function cryptPlans() {
  return [cryptStair(), cryptOssuary(), cryptNoble(), cryptTrap(), cryptLich(), sewerEntry(), sewerCross(), sewerSluice(), sewerMarket(), sewerRatKing()];
}

function cryptStair() {
  const W = 30, H = 22;
  return crypt({
    id: "atlas-crypt-stair", name: "망자의 지하 묘지 · 계단실과 벽감", room: "통로", purpose: "탐험",
    art: grid(W, H, [
      [".", 3, 1, 26, 13], // 계단실
      ["q", 13, 3, 15, 13], // 계단에서 내려오는 참배길
      [".", 13, 13, 15, 21], ["q", 13, 13, 15, 21], // 남쪽 회랑(맵 끝)
      ["D", 4, 3, 10, 5], ["D", 19, 3, 25, 5], // 북쪽 벽 아래 관을 얹은 단
    ]),
    props: [
      ["^", 13, 1], ["T", 11, 3], ["T", 17, 3], // 지상으로 오르는 돌계단과 화로
      ["coffin-stone", 5, 3], ["coffin-wood", 7, 3], ["coffin-stone", 9, 3], ["coffin-wood", 20, 3], ["coffin-stone", 22, 3], ["coffin-wood", 24, 3], // 단 위 관 여섯
      ...row("X", 5, 9, 8, 2), ...row("Y", 20, 24, 8, 2), // 벽감 앞 비석 줄
      ["I", 8, 10], ["I", 20, 10], ["G", 11, 11], ["G", 17, 11], // 회랑 어귀를 지키는 가고일과 석주
      ["web-l", 3, 2], ["web-r", 26, 2], ["x", 6, 1], ["y", 22, 1],
      ["K", 4, 12], ["bones", 5, 12], ["K", 25, 12],
      ...row("Y", 5, 9, 11, 4), ...row("X", 21, 25, 11, 4), ["I", 11, 7], ["I", 17, 7], // 둘째 비석 줄과 참배길 석주
    ],
    entry: [14, 3], targets: [[6, 7], [23, 7], [14, 20]],
    exits: [{ at: [14, 3], to: "outside", note: "북쪽 벽 돌계단 → 묘지 예배당" }, { at: [14, 21], to: "atlas-crypt-ossuary", arrive: [2, 12], note: "남쪽 회랑 → 해골 회랑" }],
    note: "묘지 예배당 밑으로 내려오는 첫 방. 북쪽 벽 돌계단 양옆에 화로, 양쪽 벽 아래 낮은 단 위에 나무 관과 석관이 번갈아 셋씩 놓이고 그 앞에 십자 비석·석판 비석이 줄지어 선다. 무늬 석판 참배길이 남쪽 회랑으로 곧게 가고, 회랑 어귀를 석주와 가고일이 지킨다. 모서리엔 거미줄과 뼈",
  });
}

function cryptOssuary() {
  const W = 36, H = 26;
  return crypt({
    id: "atlas-crypt-ossuary", name: "망자의 지하 묘지 · 해골 회랑", room: "통로", purpose: "탐험", heaps: 3,
    art: grid(W, H, [
      [".", 0, 10, 33, 13], // 가로 회랑(서쪽 맵 끝에서)
      [".", 16, 2, 19, 24], // 세로 회랑
      [".", 4, 2, 12, 9], [".", 23, 2, 32, 9], // 북쪽 납골실 둘
      [".", 4, 15, 12, 22], [".", 23, 15, 32, 22], // 남쪽 납골실 둘
      [".", 8, 9, 9, 10], [".", 27, 9, 28, 10], [".", 8, 13, 9, 15], [".", 27, 13, 28, 15], // 납골실 문
      ["q", 16, 4, 19, 21],
    ]),
    props: [
      // 납골실마다: 벽을 따라 해골 무더기와 관, 가운데 비석
      ["K", 5, 4], ["bones", 6, 4], ["K", 11, 4], ["coffin-wood-open", 5, 6], ["coffin-wood", 11, 6], ["Y", 8, 5],
      ["K", 24, 4], ["bones", 31, 4], ["coffin-stone", 24, 6], ["coffin-stone-open", 31, 6], ["X", 27, 5], ["X", 29, 5],
      ["coffin-wood", 5, 17], ["coffin-wood", 7, 17], ["coffin-wood", 11, 17], ["bones", 6, 21], ["K", 10, 21], ["Y", 9, 19],
      ["coffin-stone", 24, 17], ["coffin-stone", 31, 17], ["chest-iron", 27, 17], ["G", 26, 17], ["G", 29, 17], ["K", 25, 21],
      ["w", 14, 10], ["w", 22, 10], ["x", 3, 10], ["y", 30, 10],
      ["T", 16, 5], ["T", 19, 5],
      ["web-l", 4, 3], ["web-r", 32, 16],
      ["_", 16, 22],
    ],
    entry: [0, 12], targets: [[8, 7], [28, 7], [8, 20], [28, 20], [17, 4]],
    exits: [{ at: [0, 12], to: "atlas-crypt-stair", arrive: [14, 20], note: "서쪽 → 계단실" }, { at: [17, 22], to: "atlas-crypt-noble", arrive: [6, 3], note: "세로 회랑 남쪽 끝 내려가는 돌계단 → 귀족 묘실" }],
    note: "십자 회랑 네 모서리에 납골실 넷. 가로 회랑 벽엔 횃불과 금, 세로 회랑엔 무늬 석판과 화로. 북서 납골실은 해골 무더기와 열린 나무 관, 북동은 석관과 열린 석관, 남서는 나무 관 세 줄, 남동은 가고일 둘이 지키는 쇠 보물상자와 석관. 세로 회랑 남쪽 끝 돌계단이 귀족 묘실로 내려간다",
  });
}

function cryptNoble() {
  const W = 32, H = 26;
  return crypt({
    id: "atlas-crypt-noble", name: "망자의 지하 묘지 · 귀족 묘실", room: "보물방", purpose: "보물", heaps: 1, topUp: false,
    art: grid(W, H, [
      [".", 3, 1, 27, 22],
      ["q", 11, 7, 19, 22], ["r", 14, 5, 16, 22], // 판석 신랑(身廊)과 붉은 카펫 참배길
      ["q", 11, 3, 19, 6], // 제단 앞 무늬 석판
      ["D", 12, 3, 18, 5], // 가문 석관 단
      ...[9, 12, 15, 18].flatMap((y) => [["D", 4, y, 10, y + 1], ["D", 20, y, 26, y + 1]]), // 석관을 얹은 낮은 단 여덟
      [".", 14, 22, 16, 25],
    ]),
    props: [
      ["^", 5, 1], ...row("Y", 4, 8, 7, 2), ["x", 9, 1], // 해골 회랑으로 오르는 돌계단(북서 벽)
      ["coffin-stone", 13, 3], ["coffin-stone", 15, 3], ["coffin-stone", 17, 3], ["S", 11, 3], ["S", 19, 3], ["T", 12, 7], ["T", 18, 7], // 가문 석관 셋과 여신상·화로
      ...col("I", 11, 9, 19, 5), ...col("I", 19, 9, 19, 5), // 참배길 양옆 석주
      ...[9, 12, 15, 18].flatMap((y) => [5, 7, 9].map((x) => ["coffin-stone", x, y])), ...[9, 12, 15, 18].flatMap((y) => [["J", 4, y + 1], ["J", 10, y + 1]]), // 서쪽 석관 네 줄
      ...[9, 12, 15, 18].flatMap((y) => [["J", 20, y + 1], ["J", 26, y + 1]]), ...[9, 12, 15, 18].flatMap((y) => [21, 23, 25].map((x) => [x === 23 && y === 12 ? "coffin-stone-open" : "coffin-stone", x, y])), // 동쪽 석관 네 줄(하나는 열림)
      ...row("Y", 5, 9, 21, 2), ...row("Y", 21, 25, 21, 2), ["K", 4, 21], ["K", 26, 21], // 남쪽 벽 앞 비석
      ["chest-red", 26, 4], ["chest-iron", 3, 6], ["int:jars", 27, 5], ["J", 3, 7],
      ["w", 9, 1], ["w", 23, 1], ["int:banner", 13, 1], ["int:banner", 16, 1],
    ],
    entry: [6, 3], targets: [[15, 8], [6, 11], [24, 16], [26, 5], [4, 6], [15, 24]],
    exits: [{ at: [6, 3], to: "atlas-crypt-ossuary", arrive: [17, 22], note: "북서 벽 돌계단 → 해골 회랑" }, { at: [15, 25], to: "atlas-crypt-trap", arrive: [1, 12], note: "남쪽 → 함정 회랑" }],
    note: "옛 귀족 가문이 잠든 큰 묘실. 북서 벽 돌계단으로 내려오면, 남쪽 문에서 붉은 카펫 참배길이 석주 두 줄 사이로 북쪽 가문 석관 단(석관 셋·여신상 둘·화로 둘)까지 간다. 참배길 양옆으로 낮은 단 네 줄씩, 단마다 석관 셋과 양끝 부장 항아리, 동쪽 하나는 뚜껑이 열려 있다. 북쪽 양 모서리엔 부장품 — 붉은 보물상자·단지, 쇠 보물상자·항아리. 벽엔 횃불과 가문 깃발",
  });
}

function cryptTrap() {
  const W = 40, H = 22;
  const spikes = [];
  for (const x of [6, 7, 10, 11, 14, 15, 22, 23, 26, 27]) for (const y of [11, 12, 13]) spikes.push([(x + y) % 4 < 2 ? "spikes-up" : "spikes-down", x, y]);
  return crypt({
    id: "atlas-crypt-trap", name: "망자의 지하 묘지 · 가시 함정 회랑", room: "함정방", purpose: "함정", heaps: 1,
    art: grid(W, H, [
      [".", 0, 9, 39, 14], // 긴 함정 회랑
      [".", 17, 2, 20, 9], [".", 15, 1, 22, 6], // 북쪽 발판 방
      [".", 30, 14, 35, 20], // 남동쪽 보상 방
      ["q", 17, 3, 20, 5],
    ]),
    props: [
      ...spikes,
      ["plate", 18, 4], ["plate-down", 19, 4], ["l", 16, 1], ["l", 21, 1], // 발판 방: 가시를 멈추는 발판과 벽 레버
      ["I", 29, 15], ["I", 36, 15], // 보상 방 문기둥
      ["chest-iron", 31, 19], ["chest-wood", 34, 19], ["K", 30, 20], ["U", 35, 20], ["coffin-stone-open", 33, 18],
      ["K", 12, 13], ["bones", 24, 11], // 함정에 걸린 도굴꾼
      ["w", 4, 9], ["w", 18, 9], ["w", 34, 9], ["x", 9, 9], ["y", 28, 9],
      ["s", 2, 11],
    ],
    entry: [0, 12], targets: [[18, 3], [32, 17], [39, 12]],
    exits: [{ at: [0, 12], to: "atlas-crypt-noble", arrive: [15, 24], note: "서쪽 → 귀족 묘실" }, { at: [39, 12], to: "atlas-crypt-lich", arrive: [1, 12], note: "동쪽 → 묘지기의 방" }],
    note: "바닥 곳곳에 가시 함정 판이 두 칸씩 깔린 긴 회랑(솟은 판·들어간 판이 번갈아). 회랑 허리 북쪽 발판 방의 발판 스위치와 벽 레버 둘이 가시를 멈추는 장치 자리, 동쪽 끝 남쪽의 보상 방은 석주 둘이 선 문간 안쪽(쇠 보물상자·나무 상자). 함정에 걸린 도굴꾼의 뼈와 입구의 경고 표지판",
  });
}

function cryptLich() {
  const W = 30, H = 24;
  return crypt({
    id: "atlas-crypt-lich", name: "망자의 지하 묘지 · 묘지기의 방", room: "보스방", purpose: "보스", heaps: 0,
    art: grid(W, H, [
      [".", 0, 10, 4, 13], // 서쪽 회랑(맵 끝)
      [".", 4, 1, 26, 21],
      ["q", 9, 5, 21, 17], ["r", 5, 11, 25, 12], // 무늬 석판 제단 뜰과 가로 카펫
      ["c", 5, 3, 8, 8, { blob: 211, wobble: 0.25 }], ["c", 22, 14, 25, 20, { blob: 213, wobble: 0.25 }], // 무너져 꺼진 바닥
      ["D", 12, 2, 18, 4],
    ]),
    props: [
      ["N", 14, 8], // 묘지기의 소환진
      ["coffin-stone-open", 13, 2], ["coffin-stone-open", 17, 2], ["Z", 14, 2], // 묘지기의 옥좌와 열린 석관 둘
      ["fire-violet:brazier", 10, 5], ["fire-violet:brazier", 20, 5], ["fire-violet:brazier", 10, 15], ["fire-violet:brazier", 20, 15], // 보랏빛 화로 넷
      ["G", 9, 3], ["G", 21, 3],
      ["chest-red", 23, 4], ["K", 24, 6], ["bones", 6, 16], ["K", 7, 18], ["coffin-wood-open", 5, 17],
      ["web-l", 4, 1], ["web-r", 26, 1],
    ],
    keeper: [15, 10], entry: [0, 12], targets: [[15, 10], [23, 6], [7, 14]],
    exits: [{ at: [0, 12], to: "atlas-crypt-trap", arrive: [39, 12], note: "서쪽 → 함정 회랑" }],
    note: "묘지 가장 안쪽, 묘지기(리치)의 방(보스방). 서쪽 회랑에서 붉은 카펫이 가로지르는 무늬 석판 뜰 가운데 소환진, 북쪽 단 위 옥좌와 뚜껑 열린 석관 둘, 뜰 네 귀퉁이에 보랏빛 화로. 북서·남동 바닥은 무너져 꺼졌고, 북동 구석에 붉은 보물상자, 남서 구석에 열린 관과 뼈. 보스는 소환진 앞 (15,10)",
  });
}

// ── 옛 왕도 하수도 미궁 ─────────────────────────────────────────────────────────────────────────────────────────
function sewerEntry() {
  const W = 36, H = 24;
  return sewer({
    id: "atlas-sewer-entry", name: "옛 왕도 하수도 · 맨홀 아래 수로", room: "통로", purpose: "탐험",
    art: grid(W, H, [
      [".", 2, 2, 33, 21],
      ["~", 3, 10, 32, 13], // 가로 수로
      ["=", 16, 10, 18, 13], // 수로 위 돌다리
      ["~", 25, 4, 27, 13], // 북쪽에서 흘러드는 지류
      ["=", 25, 7, 27, 7],
      ["#", 8, 15, 20, 22], ["#", 2, 2, 12, 5], // 방을 나누는 벽덩이
    ]),
    props: [
      ["h", 22, 2], ["h", 22, 3], // 맨홀 사다리(벽면)
      ["pipe-v", 29, 2], ["pipe-v", 31, 2], ["pipe-h", 14, 14], // 벽의 관
      ["E", 30, 5], ["J", 31, 6], ["int:crate", 30, 7], // 하수 관리인 창고
      ["K", 4, 18], ["U", 5, 19], ["j", 23, 19], ["E", 24, 19], ["s", 21, 8],
      ["w", 16, 6], ["w", 30, 15],
    ],
    entry: [22, 4], targets: [[31, 8], [5, 17], [28, 18], [3, 8]],
    exits: [{ at: [22, 4], to: "outside", note: "북쪽 벽 사다리 → 골목 맨홀" }, { at: [2, 17], to: "atlas-sewer-cross", arrive: [37, 12], note: "남서쪽 → 교차 수로" }],
    note: "골목 맨홀 사다리로 내려오는 하수도 들머리. 가로 수로가 방을 가로지르고 북쪽 지류가 흘러들며, 돌다리 두 개로 건넌다. 북동쪽 하수 관리인 창고(통·항아리·상자), 벽을 따라 관, 남서쪽 구석에 쓰러진 사람의 뼈. 남서쪽 통로가 교차 수로로",
  });
}

function sewerCross() {
  const W = 40, H = 26;
  return sewer({
    id: "atlas-sewer-cross", name: "옛 왕도 하수도 · 네 갈래 교차 수로", room: "퍼즐방", purpose: "탐험",
    art: grid(W, H, [
      [".", 1, 8, 38, 17], // 가로 수로 복도
      [".", 14, 1, 25, 24], // 세로 수로 복도
      ["~", 1, 11, 38, 13], ["~", 18, 3, 21, 24], // 십자 수로
      [".", 17, 10, 22, 14], ["q", 17, 10, 22, 14], // 가운데 교차 광장(무늬 석판)
      ["=", 9, 11, 10, 13], ["=", 30, 11, 31, 13], ["=", 18, 6, 21, 6], ["=", 18, 19, 21, 19], // 네 팔의 돌다리
      [".", 38, 10, 39, 13], [".", 0, 10, 1, 13],
    ]),
    props: [
      ["I", 16, 9], ["I", 23, 9], ["I", 16, 15], ["I", 23, 15], // 교차점 네 기둥
      ["pipe-h", 3, 8], ["pipe-h", 4, 8], ["pipe-valve", 5, 8], ["pipe-v", 15, 2], ["pipe-v", 24, 2],
      ["s", 12, 9], ["s", 27, 15],
      ["j", 15, 22], ["E", 24, 22], ["K", 3, 16], ["int:plank-pile", 35, 16],
      ["w", 8, 8], ["w", 31, 8],
    ],
    entry: [38, 16], targets: [[1, 16], [15, 4], [15, 23], [19, 12]],
    exits: [{ at: [38, 16], to: "atlas-sewer-entry", arrive: [3, 17], note: "동쪽 → 들머리" }, { at: [1, 16], to: "atlas-sewer-rat", arrive: [34, 12], note: "서쪽 → 쥐왕의 둥지" }, { at: [15, 3], to: "atlas-sewer-sluice", arrive: [11, 22], note: "북쪽 → 수문실" }, { at: [15, 24], to: "atlas-sewer-market", arrive: [18, 2], note: "남쪽 → 하수도 암시장" }],
    note: "네 갈래 수로가 만나는 교차점. 수로 복도 양쪽 턱을 걸어 네 팔의 돌다리로 건너고, 가운데는 무늬 석판을 깐 교차 광장(네 기둥). 갈림마다 표지판, 벽을 따라 관과 밸브, 모서리에 통·널판 더미",
  });
}

function sewerSluice() {
  const W = 34, H = 22;
  return sewer({
    id: "atlas-sewer-sluice", name: "옛 왕도 하수도 · 수문실", room: "퍼즐방", purpose: "퍼즐",
    art: grid(W, H, [
      [".", 3, 1, 30, 15],
      ["~", 6, 8, 27, 11], // 수문 앞 저수로(양옆 턱으로 돈다)
      [".", 12, 12, 21, 21], ["~", 15, 12, 18, 21], // 남쪽으로 빠지는 물길과 양옆 턱
      ["=", 15, 17, 18, 17],
      ["q", 5, 3, 28, 6], // 수문 기계 둑
    ]),
    props: [
      ...railing(9, 24, 7), // 둑 난간(저수로 쪽)
      ["gear-big", 5, 3], ["gear-big", 27, 3], ["gear", 10, 4], ["gear", 23, 4], ["piston", 13, 3], ["piston", 20, 3], // 수문을 올리는 톱니·피스톤
      ["lever-off", 16, 4], ["lever-on", 17, 4], ["console", 15, 5], // 수문 조종 레버와 조종대
      ["l", 6, 1], ["l", 27, 1], ["pipe-v", 11, 1], ["pipe-v", 22, 1],
      ["E", 4, 14], ["j", 5, 14], ["E", 4, 13], ["int:crate", 29, 14], ["int:crate", 28, 14], ["int:plank-pile", 29, 13], ["s", 14, 19], ["j", 20, 19], ["int:bucket", 20, 14],
    ],
    entry: [13, 21], targets: [[16, 6], [5, 12], [27, 13], [8, 6], [20, 20]],
    exits: [{ at: [13, 21], to: "atlas-sewer-cross", arrive: [15, 4], note: "남쪽 → 교차 수로" }],
    note: "왕도 하수를 막는 수문실(퍼즐방). 저수로 위 둑에 수문을 올리는 큰 톱니바퀴 둘·작은 톱니·피스톤 둘, 가운데 조종대와 바닥 레버 둘(물을 빼면 다른 수로가 걷힌다는 장치 자리). 둑과 저수로 사이엔 쇠 난간, 저수로 양옆 턱을 돌아 둑에 오른다. 남쪽으로 빠지는 물길 양옆 턱을 따라 들어오고, 저수로 남쪽 두 모서리엔 관리인의 통·물통·상자·널판",
  });
}

function sewerMarket() {
  const W = 36, H = 26;
  return sewer({
    id: "atlas-sewer-market", name: "옛 왕도 하수도 · 도둑 길드 암시장", room: "쉼터", purpose: "상점", topUp: false,
    art: grid(W, H, [
      [".", 17, 0, 19, 5],
      [".", 3, 4, 32, 22],
      ["~", 3, 13, 32, 14], // 시장을 가로지르는 좁은 수로
      ["=", 8, 13, 9, 14], ["=", 17, 13, 19, 14], ["=", 27, 13, 28, 14],
      ["|", 4, 6, 16, 11], ["|", 20, 6, 31, 11], ["|", 4, 16, 13, 21], ["|", 23, 16, 31, 21], // 상인 좌판 널마루 넷
      ["r", 14, 15, 22, 21], // 가운데 흥정 깔개
    ]),
    props: [
      // 무기상
      ["int:weapon-case", 6, 4], ["int:wall-sword", 8, 4], ["int:wall-shield", 10, 4], ["int:counter", 7, 8], ["int:sign-weapon", 9, 4], ["int:crate", 11, 9],
      // 약·잡화상
      ["int:jar-shelf", 24, 4], ["int:fruit-shelf", 26, 4], ["int:sign-item", 28, 4], ["int:table-long", 24, 8], ["int:jars", 29, 9], ["int:sack", 29, 7], ["int:bottles", 25, 8],
      // 여관 겸 선술집
      ...[["int:table-round", 7, 18], ["int:seat-r", 6, 18], ["int:seat-l", 8, 18], ["int:table-round", 10, 19], ["int:seat-r", 9, 19], ["int:seat-l", 11, 19]],
      ["int:barrel", 5, 16], ["int:barrel", 6, 16], ["int:bottles", 12, 16],
      // 장물아비
      ["int:box", 24, 17], ["chest-iron", 26, 17], ["int:necklace", 28, 18], ["int:table-square", 27, 19], ["int:seat-l", 28, 19], ["int:crate", 30, 20], ["int:sack", 23, 21],
      // 흥정 깔개
      ["int:table-square", 18, 18], ["int:seat-r", 17, 18], ["int:seat-l", 19, 18], ["int:lantern", 15, 16], ["int:lantern", 21, 16],
      ["w", 14, 4], ["w", 22, 4], ["T", 15, 11], ["T", 21, 11],
    ],
    entry: [18, 1], targets: [[8, 10], [27, 11], [8, 20], [25, 19], [18, 20]],
    exits: [{ at: [18, 0], to: "atlas-sewer-cross", arrive: [19, 23], note: "북쪽 → 교차 수로" }],
    note: "하수도 깊숙한 곳 도둑 길드의 암시장(쉼터·상점). 좁은 수로를 가운데 두고 널마루 좌판 넷 — 북서 무기상(진열장·벽걸이 검·방패·계산대), 북동 약·잡화상(단지 선반·긴 탁자·술병), 남서 선술집(둥근 탁자와 마주 앉는 의자, 술통), 남동 장물아비(쇠 상자·보석 목걸이·흥정 탁자). 가운데 붉은 깔개엔 흥정 탁자와 랜턴 둘",
  });
}

function sewerRatKing() {
  const W = 36, H = 22;
  return sewer({
    id: "atlas-sewer-rat", name: "옛 왕도 하수도 · 쥐왕의 둥지", room: "보스방", purpose: "보스", topUp: "crypt",
    art: grid(W, H, [
      [".", 30, 10, 35, 13],
      [".", 3, 2, 31, 19],
      ["~", 3, 14, 31, 16], // 남쪽 배수로
      ["c", 5, 4, 12, 10, { blob: 221, wobble: 0.25 }], // 무너져 꺼진 하수 구덩이
      ["D", 13, 4, 23, 11], // 쓰레기 더미 둥지(흙 단)
      ["~", 25, 4, 29, 9], ["=", 25, 7, 29, 7], // 북동 침전조와 널다리
      ["=", 25, 14, 27, 16],
    ]),
    props: [
      ["bones", 15, 6], ["K", 21, 6], ["int:plank-pile", 16, 8], ["int:chair-fallen", 20, 8], ["int:sack", 17, 6], ["U", 19, 9], ["int:glass", 15, 9], // 쥐왕이 모은 쓰레기와 뼈
      ["chest-red", 18, 5],
      ["pipe-v", 24, 2], ["pipe-v", 28, 2], ["pipe-h", 13, 2], ["pipe-valve", 14, 2],
      ["K", 27, 18], ["E", 29, 18], ["bones", 25, 18], ["int:sack", 28, 18], ["J", 30, 18], ["int:crate", 30, 17],
    ],
    keeper: [18, 12], entry: [35, 12], targets: [[18, 12], [18, 7], [27, 18], [6, 12]],
    exits: [{ at: [35, 12], to: "atlas-sewer-cross", arrive: [1, 12], note: "동쪽 → 교차 수로" }],
    note: "하수도 막다른 큰 저수조, 쥐왕의 둥지(보스방). 북쪽 흙더미 단 위에 쥐왕이 끌어모은 쓰레기(널판·쓰러진 의자·자루·깨진 유리)와 뼈 사이 붉은 보물상자, 서북쪽 바닥은 무너져 꺼졌고 남쪽 배수로 건너 모서리엔 먼저 온 모험가의 짐과 뼈. 보스는 둥지 앞 (18,12)",
  });
}
