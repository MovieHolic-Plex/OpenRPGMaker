// 얼음 동굴·화산 동굴·해저 동굴 확장(각 3칸). Ice: the approved ice-cave theme (blue ice cliff, snow floor, ice sheets,
// ice blocks, blue crystals). Lava: the approved lava-cave theme (root-curtain face, redrock floor, lava autotile, plank
// bridges) — red crystals only (cry-red), never the sheet's blue ones. Sea: the sea repaint (the chasm autotile is a
// pool with a rock lip) with ship wreckage from the ship parts.
import { grid, series, room, hpass, vpass, row, col } from "./lib.mjs";

const ice = series({ theme: "ice", tileset: "oprn_dungeon_stone", series: "ice", seriesName: "서리 동굴", env: "지하", dress: "ice", groves: 8, heaps: 2, topUp: "ice" });
const lava = series({ theme: "lava", tileset: "oprn_dungeon_stone", series: "lava", seriesName: "불타는 화산 동굴", env: "지하", dress: "lava", groves: 8, heaps: 2, topUp: "lava" });
const sea = series({ theme: "cave", tileset: "oprn_dungeon_sea", series: "sea", seriesName: "파도 소리 해저 동굴", env: "수중", dress: "sea", groves: 8, heaps: 2, topUp: "sea" });

export function climatePlans() {
  return [iceGate(), iceSlide(), iceQueen(), lavaVent(), lavaForge(), lavaGolem(), seaTidepool(), seaWreck(), seaKraken()];
}

// ── 서리 동굴 ─────────────────────────────────────────────────────────────────────────────────────────────────────
function iceGate() {
  const W = 34, H = 24;
  return ice({
    id: "atlas-ice-gate", name: "서리 동굴 · 얼어붙은 입구", room: "통로", purpose: "탐험",
    art: grid(W, H, [
      vpass(8, 17, 23), room(9, 14, 6, 4, 701, 0.1), // 남서 어귀 굴
      hpass(14, 22, 13), room(25, 12, 6, 5, 703, 0.1), // 동쪽 얼음못 굴
      ["i", 22, 9, 29, 15, { blob: 705, wobble: 0.22 }], // 얼어붙은 못
      vpass(17, 3, 11), room(17, 5, 7, 3, 707, 0.08), // 북쪽 굴
      vpass(12, 0, 3),
    ]),
    props: [
      ["*", 23, 10], ["*", 27, 13], ["*", 21, 16], ["K", 25, 16], ["chest-wood", 24, 16], // 못 위 얼음 덩이와 얼어 죽은 모험가
      ["E", 6, 12], ["j", 7, 13], ["s", 10, 17], // 어귀의 버려진 짐과 표지판
      ["C", 12, 4], ["e", 13, 5], ["C", 21, 4], ["n", 22, 6], // 북쪽 굴 수정
    ],
    entry: [8, 23], targets: [[12, 1], [22, 16], [17, 6], [6, 15]],
    exits: [{ at: [8, 23], to: "outside", note: "남쪽 어귀 → 설산 기슭" }, { at: [12, 0], to: "atlas-ice-slide", arrive: [17, 23], note: "북쪽 → 빙판 굴" }],
    note: "눈 덮인 산기슭에서 들어오는 서리 동굴 어귀. 남서 어귀 굴엔 버려진 짐과 표지판, 동쪽 굴 가운데 얼어붙은 못 위로 얼음 덩이가 박혀 있고 끝에 얼어 죽은 모험가와 상자, 북쪽 굴엔 푸른 수정 기둥이 자란다",
  });
}

function iceSlide() {
  const W = 36, H = 26;
  return ice({
    id: "atlas-ice-slide", name: "서리 동굴 · 미끄러운 빙판", room: "퍼즐방", purpose: "퍼즐", groves: 4,
    art: grid(W, H, [
      vpass(17, 21, 25), room(17, 12, 14, 9, 711, 0.05), // 큰 빙판 굴
      ["i", 6, 6, 28, 18, { blob: 713, wobble: 0.1 }], // 굴 바닥 대부분이 빙판
      vpass(17, 0, 4),
    ]),
    props: [
      // 미끄러지다 멈추는 얼음 덩이(길을 만드는 돌): 빙판 위에 흩지 않고 줄과 모서리로
      ["*", 9, 8], ["*", 14, 7], ["*", 22, 7], ["*", 26, 10], ["*", 8, 13], ["*", 12, 16], ["*", 19, 12], ["*", 24, 15], ["*", 16, 17], ["*", 27, 16], ["*", 11, 10], ["*", 21, 17],
      ["Q", 4, 11], ["C", 30, 8], ["C", 31, 14], ["e", 5, 16], ["n", 29, 18], // 둘레 수정
      ["chest-iron", 26, 12], ["sparkle-blue", 19, 10], // 빙판 한가운데 쇠 상자
    ],
    entry: [17, 25], targets: [[17, 1], [5, 14]],
    exits: [{ at: [17, 25], to: "atlas-ice-gate", arrive: [12, 1], note: "남쪽 → 입구" }, { at: [17, 0], to: "atlas-ice-queen", arrive: [15, 21], note: "북쪽 → 얼음 여왕의 옥좌" }],
    note: "바닥 대부분이 빙판인 큰 굴(퍼즐방). 빙판 위를 미끄러지다 얼음 덩이에 부딪혀야 멈추는 방으로, 얼음 덩이 열두 개가 길을 만든다. 빙판 한가운데 반짝이는 쇠 보물상자, 둘레에 푸른 큰 수정과 수정 기둥. 남쪽에서 북쪽 굴길로 건너가야 한다",
  });
}

function iceQueen() {
  const W = 32, H = 24;
  return ice({
    id: "atlas-ice-queen", name: "서리 동굴 · 얼음 여왕의 옥좌", room: "보스방", purpose: "보스", groves: 6,
    art: grid(W, H, [
      vpass(15, 19, 23), room(15, 11, 12, 8, 721, 0.06),
      ["i", 5, 10, 11, 17, { blob: 723, wobble: 0.2 }], ["i", 19, 10, 25, 17, { blob: 725, wobble: 0.2 }], // 양쪽 얼음 못
      ["t", 11, 4, 19, 7], // 옥좌 단(깎은 얼음 판석)
    ]),
    props: [
      ["Z", 14, 4], ["Q", 11, 4], ["Q", 18, 4], ["C", 10, 7], ["C", 20, 7], ["chest-red", 13, 6], ["chest-red", 17, 6], // 옥좌와 큰 수정, 여왕의 보물
      ["*", 7, 12], ["*", 22, 14], ["*", 8, 16], ["K", 24, 12], ["S", 6, 6], ["S", 23, 6], // 얼어붙은 도전자와 얼음 석상
    ],
    keeper: [15, 10], entry: [15, 23], targets: [[15, 9], [13, 7], [17, 7]],
    exits: [{ at: [15, 23], to: "atlas-ice-slide", arrive: [17, 1], note: "남쪽 → 빙판 굴" }],
    note: "서리 동굴 가장 안쪽, 얼음 여왕의 옥좌(보스방). 북쪽 깎은 얼음 판석 단 위 옥좌 양옆에 큰 푸른 수정과 수정 기둥, 여왕의 붉은 보물상자 둘. 양쪽엔 얼음 못과 박힌 얼음 덩이, 얼어붙은 도전자의 뼈, 얼음 석상 둘. 보스는 단 앞 (15,10)",
  });
}

// ── 불타는 화산 동굴 ─────────────────────────────────────────────────────────────────────────────────────────────
function lavaVent() {
  const W = 38, H = 24;
  return lava({
    id: "atlas-lava-vent", name: "불타는 화산 동굴 · 용암 틈 길", room: "통로", purpose: "탐험",
    art: grid(W, H, [
      hpass(0, 8, 13), room(10, 12, 7, 7, 731, 0.1), // 서쪽 굴
      ["L", 13, 4, 19, 20, { blob: 733, wobble: 0.25 }], ["&", 13, 12, 19, 13], // 용암 강과 널다리
      room(26, 11, 8, 7, 735, 0.1), hpass(30, 37, 11), // 동쪽 굴
      ["L", 26, 14, 32, 18, { blob: 737, wobble: 0.3 }],
    ]),
    props: [
      ["cry-red:crystal-pillar", 6, 8], ["cry-red:crystal-small", 7, 9], ["F", 5, 15], ["f", 8, 16], // 서쪽 굴: 붉은 수정과 바닥 불길
      ["K", 22, 7], ["chest-red", 23, 7], ["f", 21, 8], // 동쪽 굴: 타 버린 모험가
      ["F", 29, 8], ["cry-red:crystal-pile", 32, 7], ["cry-red:crystal-small", 20, 15],
    ],
    entry: [0, 13], targets: [[37, 11], [23, 8], [7, 12]],
    exits: [{ at: [0, 13], to: "outside", note: "서쪽 → 화산 기슭" }, { at: [37, 11], to: "atlas-lava-forge", arrive: [1, 12], note: "동쪽 → 드워프 대장간" }],
    note: "화산 속으로 들어가는 첫 굴. 두 굴 사이를 용암 강이 가르고 널다리 하나로 건넌다. 서쪽 굴엔 붉은 수정과 바닥 불길, 동쪽 굴엔 작은 용암 못과 타 버린 모험가의 뼈·붉은 보물상자. 동쪽 굴길이 버려진 대장간으로",
  });
}

function lavaForge() {
  const W = 36, H = 26;
  return lava({
    id: "atlas-lava-forge", name: "불타는 화산 동굴 · 드워프 대장간", room: "쉼터", purpose: "상점", theme: "lava", topUp: false, groves: 2,
    art: grid(W, H, [
      hpass(0, 5, 12), [".", 4, 3, 31, 21], hpass(31, 35, 17), // 깎아 낸 대장간 굴(네모진 방)과 동쪽 굴길
      ["q", 6, 5, 16, 11], ["q", 20, 5, 29, 11], ["k", 5, 13, 30, 14], // 대장간·상점 무늬 판석 바닥, 도랑 앞 검게 그을린 돌
      ["L", 8, 15, 27, 18], ["&", 16, 15, 19, 18], // 풀무에 쓰는 용암 도랑
      ["w", 5, 19, 30, 21], // 남쪽 널마루(숙소)
    ]),
    props: [
      // 대장간: 화덕·오븐·벽 망치와 검, 광석
      ["int:stove", 6, 3], ["int:oven", 8, 3], ["int:wall-hammer", 10, 3], ["int:wall-sword", 11, 3], ["int:counter", 13, 6], ["int:ore", 7, 9], ["int:ore", 8, 9], ["int:bricks", 9, 9], ["int:bucket", 12, 10], ["int:crate", 15, 10], ["int:plank-pile", 6, 11], ["int:barrel", 16, 5], ["int:wall-hammer", 14, 3], ["int:ore", 10, 7], ["int:bucket", 6, 7],
      // 상점: 무기 진열장과 간판, 계산대
      ["int:weapon-case", 20, 3], ["int:weapon-case", 22, 3], ["int:sign-weapon", 24, 3], ["int:wall-shield", 26, 3], ["int:counter", 24, 7], ["int:helmet", 28, 6], ["int:boots", 28, 8], ["int:box", 21, 10], ["int:armor-stand", 20, 6], ["int:armor-stand", 20, 8], ["int:crate", 29, 10], ["int:leather", 27, 10],
      // 숙소: 침대와 식탁
      ["int:bed-h", 6, 19], ["int:bed-h", 9, 19], ["int:table-long", 21, 20], ["int:seat-r", 20, 20], ["int:seat-l", 24, 20], ["int:barrel", 28, 19], ["int:barrel", 29, 19], ["int:food", 22, 20],
      ["cry-red:crystal-small", 30, 13], ["F", 5, 14], ["w", 18, 3], ["T", 17, 12], ["T", 18, 12],
    ],
    entry: [1, 12], targets: [[14, 9], [25, 10], [18, 20], [10, 20], [35, 17]],
    exits: [{ at: [0, 12], to: "atlas-lava-vent", arrive: [36, 11], note: "서쪽 → 용암 틈 길" }, { at: [35, 17], to: "atlas-lava-golem", arrive: [15, 22], note: "동쪽 굴길 → 분화구" }],
    note: "화산 속을 깎아 낸 드워프 대장간(쉼터·상점). 북서 대장간엔 화덕·오븐·벽 망치와 검, 조리대 위 작업대, 광석과 벽돌 더미. 북동 상점엔 무기 진열장·간판·방패와 계산대, 투구·장화. 가운데 용암 도랑을 널다리로 건너면 남쪽 널마루 숙소(침대 둘·식탁·술통). 드워프 상인이 계산대 뒤에 선다",
  });
}

function lavaGolem() {
  const W = 32, H = 24;
  return lava({
    id: "atlas-lava-golem", name: "불타는 화산 동굴 · 분화구 밑바닥", room: "보스방", purpose: "보스", groves: 6,
    art: grid(W, H, [
      vpass(15, 19, 23), room(15, 11, 13, 9, 741, 0.06),
      ["L", 4, 3, 26, 17, { blob: 743, wobble: 0.15 }], [".", 10, 6, 20, 13, { blob: 745, wobble: 0.1 }], // 용암 호수 한가운데 섬
      ["&", 14, 14, 16, 19], // 섬으로 가는 널다리
      ["D", 12, 7, 18, 9],
    ]),
    props: [
      ["cry-red:crystal-big", 14, 7], ["cry-red:crystal-pillar", 12, 7], ["cry-red:crystal-pillar", 18, 7], ["chest-red", 16, 9], // 섬 위 붉은 큰 수정과 보물
      ["F", 11, 11], ["F", 19, 11], ["f", 13, 12], ["f", 17, 12], ["T", 3, 19], ["T", 26, 19], ["K", 5, 20], ["U", 24, 20],
    ],
    keeper: [15, 11], entry: [15, 23], targets: [[15, 11], [16, 10]],
    exits: [{ at: [15, 23], to: "atlas-lava-forge", arrive: [34, 17], note: "남쪽 → 대장간" }],
    note: "분화구 밑바닥, 용암 골렘이 잠든 곳(보스방). 굴을 채운 용암 호수 한가운데 섬이 있고 남쪽 널다리 하나로 건넌다. 섬 위 흙 단엔 붉은 큰 수정과 수정 기둥, 붉은 보물상자, 둘레 바닥 불길. 호숫가 남쪽 모서리엔 화로와 뼈. 보스는 섬 한가운데 (15,11)",
  });
}

// ── 파도 소리 해저 동굴 ───────────────────────────────────────────────────────────────────────────────────────────
function seaTidepool() {
  const W = 36, H = 24;
  return sea({
    id: "atlas-sea-tidepool", name: "파도 소리 해저 동굴 · 조수 웅덩이", room: "통로", purpose: "탐험",
    art: grid(W, H, [
      vpass(6, 18, 23), room(9, 13, 7, 5, 751, 0.1), // 남서 어귀
      ["W", 8, 11, 13, 16, { blob: 753, wobble: 0.25 }],
      hpass(15, 21, 12), room(26, 10, 8, 6, 755, 0.1), // 동쪽 조수 굴
      ["W", 21, 7, 28, 14, { blob: 757, wobble: 0.25 }], ["W", 29, 12, 33, 16, { blob: 759, wobble: 0.25 }],
      vpass(31, 0, 6),
    ]),
    props: [
      ["ship:barrel-open", 4, 12], ["ship:crate", 5, 12], ["ship:rope", 3, 14], // 파도에 밀려온 짐
      ["chest-wood", 29, 6], ["K", 30, 7], ["ship:anchor", 20, 15], ["ship:post", 24, 15],
    ],
    entry: [6, 23], targets: [[31, 1], [29, 7], [4, 14]],
    exits: [{ at: [6, 23], to: "outside", note: "남쪽 → 바닷가 절벽" }, { at: [31, 0], to: "atlas-sea-wreck", arrive: [4, 22], note: "북쪽 → 난파선 잔해 해변" }],
    note: "밀물 때 잠기는 바닷가 굴. 남서 어귀 굴과 동쪽 조수 굴에 바위 테두리 웅덩이가 여럿 고였고, 파도에 밀려온 통·상자·밧줄, 닻과 말뚝이 굴러다닌다. 동쪽 굴 끝에 먼저 온 이의 뼈와 상자",
  });
}

function seaWreck() {
  const W = 40, H = 26;
  return sea({
    id: "atlas-sea-wreck", name: "파도 소리 해저 동굴 · 난파선 잔해 해변", room: "보물방", purpose: "보물", groves: 3,
    art: grid(W, H, [
      vpass(4, 19, 25), room(19, 12, 16, 10, 761, 0.06), // 큰 해변 굴
      ["W", 20, 3, 37, 13, { blob: 763, wobble: 0.2 }], // 굴 안 바다(동북)
      ["%", 16, 8, 30, 9], // 부서진 선체 널이 물 위에 걸침
      hpass(32, 39, 18), // 남동쪽 굴길
      ["|", 9, 14, 17, 18], // 모래톱 위에 흩어진 선체 널판
    ]),
    props: [
      ["mast-stump", 12, 15], ["ship:rigging", 11, 14], ["ship:rope", 13, 16], ["ship:cannon-l", 15, 14], ["ship:cannon-cart-r", 9, 17], // 부러진 돛대·대포
      ["ship:barrel", 16, 17], ["ship:barrel-open", 17, 17], ["ship:crate", 10, 18], ["ship:crate", 11, 18], ["ship:wheel", 14, 18], // 흩어진 짐과 조타륜
      ["chest-red", 29, 9], ["chest-wood", 25, 8], ["ship:skull", 27, 8], // 물 위 선체 널 끝 보물
      ["ship:anchor", 6, 10], ["ship:post", 8, 8], ["ship:flag", 19, 20], ["K", 22, 18],
    ],
    entry: [4, 25], targets: [[29, 9], [13, 15], [7, 11], [39, 18]],
    exits: [{ at: [4, 25], to: "atlas-sea-tidepool", arrive: [31, 1], note: "남쪽 → 조수 웅덩이" }, { at: [39, 18], to: "atlas-sea-kraken", arrive: [15, 22], note: "남동쪽 굴 → 크라켄의 소굴" }],
    note: "파도에 떠밀려 온 배가 부서진 해변 굴(보물방). 모래톱에 선체 널판이 흩어지고 부러진 돛대와 밧줄, 대포, 조타륜, 통과 상자가 뒹군다. 동북쪽 굴 안 바다 위로 선체 널이 걸쳐 있고 그 끝에 붉은 보물상자와 해골. 남동쪽으로 크라켄의 소굴이 이어진다",
  });
}

function seaKraken() {
  const W = 32, H = 24;
  return sea({
    id: "atlas-sea-kraken", name: "파도 소리 해저 동굴 · 크라켄의 소굴", room: "보스방", purpose: "보스", groves: 4,
    art: grid(W, H, [
      vpass(15, 19, 23), room(15, 11, 13, 9, 771, 0.06),
      ["W", 4, 2, 26, 13, { blob: 773, wobble: 0.15 }], // 크라켄이 사는 깊은 물
      [".", 11, 14, 19, 18], ["D", 12, 14, 18, 16], // 물가 제단
    ]),
    props: [
      ["chest-red", 13, 15], ["chest-red", 17, 15], ["ship:skull", 15, 15], ["ship:swords", 14, 16], // 제물로 바친 보물
      ["ship:crate", 5, 17], ["ship:barrel-open", 6, 18], ["mast-stump", 24, 17], ["ship:rope", 25, 18], ["K", 8, 19], ["K", 22, 19], // 끌려온 배의 잔해
    ],
    keeper: [15, 13], entry: [15, 23], targets: [[15, 17], [13, 16]],
    exits: [{ at: [15, 23], to: "atlas-sea-wreck", arrive: [38, 18], note: "남쪽 → 난파선 해변" }],
    note: "해저 동굴 가장 안쪽, 크라켄이 사는 깊은 물(보스방). 굴 북쪽 절반을 검푸른 물이 채우고, 물가 흙 단엔 뱃사람들이 바친 붉은 보물상자 둘과 해골·검. 양쪽 물가에 끌려온 배의 잔해와 뼈. 보스는 물가 (15,13)",
  });
}
