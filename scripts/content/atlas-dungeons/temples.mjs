// 원소 신전 넷 × 3층: 바람(옥빛 대리석, 하늘 틈과 널다리), 물(청백 대리석, 못과 돌다리), 땅(황토 사암, 흙 두둑·바위·뿌리),
// 불(검붉은 현무암, 용암과 널다리). Each temple climbs 회랑 → 시련 → 수정 제단, but the three floors are drawn per
// element, not recoloured copies: the wind temple hangs over sky gaps, the water temple is built round pools and a
// flooded ring, the earth temple is a dug hall of dirt beds and boulder walls, the fire temple is islands in lava.
// Crystals are the element colour (cry-green / cry-cyan / cry-amber / cry-red) — never blue crystals in the fire temple.
import { grid, series, row, col } from "./lib.mjs";

const EL = {
  wind: { name: "바람의 신전", sheet: "oprn_dungeon_wind", liquid: "c", bridge: "%", cry: "cry-green", rune: "rune-wind", fire: "T", topUp: false },
  tide: { name: "물의 신전", sheet: "oprn_dungeon_tide", liquid: "~", bridge: "=", cry: "cry-cyan", rune: "rune-water", fire: "T", topUp: false },
  earth: { name: "땅의 신전", sheet: "oprn_dungeon_earth", liquid: "d", bridge: "d", cry: "cry-amber", rune: "rune-earth", fire: "T", topUp: false },
  fire: { name: "불의 신전", sheet: "oprn_dungeon_fire", liquid: "L", bridge: "&", cry: "cry-red", rune: "rune-fire", fire: "T", topUp: false },
};
const ALL_RUNES = ["rune-wind", "rune-water", "rune-earth", "rune-fire"];

export function templePlans() {
  return Object.keys(EL).flatMap((k) => [templeHall(k), templeTrial(k), templeAltar(k)]);
}

const base = (k) => series({ tileset: EL[k].sheet, theme: "hall", series: `temple-${k}`, seriesName: EL[k].name, env: "건물 내부", dress: false, groves: 0, heaps: 0, placeKind: "building", topUp: "shrine" });

// ── 1층: 회랑 ─────────────────────────────────────────────────────────────────────────────────────────────────────
function templeHall(k) {
  const e = EL[k], W = 34, H = 26;
  const art = [[".", 15, 20, 18, 25], [".", 3, 1, 30, 20], ["q", 15, 3, 18, 20]];
  const props = [["^", 15, 1], ["S", 13, 3], ["S", 20, 3], ...col("I", 13, 7, 17, 5), ...col("I", 20, 7, 17, 5), [`${e.cry}:crystal-pillar`, 12, 7], [`${e.cry}:crystal-pillar`, 21, 7]];
  let note = "";
  if (k === "wind") {
    // 양옆이 하늘로 트인 틈: 널다리가 바깥 벽 제단으로 건너간다
    art.push(["c", 4, 5, 11, 18, { blob: 401, wobble: 0.3 }], ["c", 22, 5, 29, 18, { blob: 402, wobble: 0.3 }], ["%", 4, 11, 12, 12], ["%", 21, 11, 29, 12], ["q", 3, 9, 4, 14], ["q", 29, 9, 30, 14]);
    props.push([e.rune, 3, 11], ["sparkle-gold", 3, 12], [e.rune, 30, 12], ["sparkle-gold", 30, 11], ["chest-wood", 3, 9], ["chest-wood", 30, 14],
      ["G", 5, 3], ["G", 27, 3], ["V", 9, 1], ["V", 24, 1], ["w", 7, 1], ["w", 26, 1], ["e", 4, 19], ["e", 29, 19], ["n", 6, 19], ["n", 27, 19], [`${e.cry}:crystal-small`, 10, 19], [`${e.cry}:crystal-small`, 23, 19]);
    note = "바람의 신전 첫 층. 무늬 석판 회랑이 석주 두 줄 사이로 북쪽 오르는 계단(여신상 둘·초록 수정 기둥)까지 곧게 가고, 양옆 바닥은 아래로 하늘이 내다보이는 틈으로 꺼졌다. 가로 널다리 둘이 틈을 건너 양쪽 벽 끝 바람 룬 제단(반짝임·보물상자)으로 가며, 남쪽 모서리엔 초록 수정 덩이";
  } else if (k === "tide") {
    art.push(["~", 4, 4, 11, 9, { blob: 411, wobble: 0.25 }], ["~", 22, 4, 29, 9, { blob: 412, wobble: 0.25 }], ["~", 4, 13, 11, 18, { blob: 413, wobble: 0.25 }], ["~", 22, 13, 29, 18, { blob: 414, wobble: 0.25 }],
      ["q", 4, 10, 12, 12], ["q", 21, 10, 29, 12]);
    props.push(["basin", 4, 10], ["basin", 28, 10], [e.rune, 7, 11], [e.rune, 26, 11], ["S", 10, 10], ["S", 23, 10],
      ["w", 6, 1], ["w", 27, 1], ["p", 9, 1], ["p", 24, 1], [`${e.cry}:crystal-small`, 3, 19], [`${e.cry}:crystal-small`, 30, 19], ["J", 12, 19], ["J", 21, 19], ["chest-wood", 3, 3]);
    note = "물의 신전 첫 층. 무늬 석판 회랑이 석주 두 줄 사이로 북쪽 오르는 계단까지 가고, 양쪽 곁채는 네 못으로 나뉜다. 못 사이 가로 석판 둑 끝에 회복의 샘 돌확과 물 룬, 여신상이 서고, 벽엔 횃불과 석판. 북서 구석 보물상자";
  } else if (k === "earth") {
    art.push(["d", 4, 4, 11, 18, { blob: 421, wobble: 0.2 }], ["d", 22, 4, 29, 18, { blob: 422, wobble: 0.2 }]);
    props.push(["O", 5, 5], ["B", 8, 7], ["O", 5, 14], ["B", 9, 15], ["O", 26, 5], ["B", 23, 8], ["O", 27, 14], ["B", 23, 15], // 흙 두둑 위 바위
      [e.rune, 7, 11], [e.rune, 26, 11], ["ore-gold", 4, 1], ["ore-gold", 29, 1], ["V", 8, 1], ["W", 10, 1], ["V", 23, 1], ["W", 25, 1], ["k", 6, 10], ["k", 27, 10],
      [`${e.cry}:crystal-pile`, 10, 11], [`${e.cry}:crystal-pile`, 23, 11], [`${e.cry}:crystal-small`, 3, 19], [`${e.cry}:crystal-small`, 30, 19], ["chest-wood", 7, 18]);
    note = "땅의 신전 첫 층. 황토 사암 회랑 양쪽 곁채는 흙 두둑으로 파 일군 밭처럼 비었고 큰 바위가 두둑마다 놓였다. 벽엔 금 광맥과 늘어진 뿌리, 두둑 가운데 땅 룬과 석순·호박색 수정 덩이. 무늬 석판 회랑이 북쪽 오르는 계단(여신상 둘·호박 수정 기둥)으로";
  } else {
    art.push(["L", 4, 4, 11, 18, { blob: 431, wobble: 0.3 }], ["L", 22, 4, 29, 18, { blob: 432, wobble: 0.3 }], ["&", 4, 8, 12, 8], ["&", 21, 15, 29, 15], ["q", 3, 6, 4, 10], ["q", 29, 13, 30, 17]);
    props.push([e.rune, 3, 8], ["chest-red", 3, 6], ["F", 3, 10], [e.rune, 30, 15], ["chest-red", 30, 17], ["F", 30, 13],
      ["T", 5, 19], ["T", 28, 19], ["w", 7, 1], ["w", 26, 1], ["G", 5, 2], ["G", 27, 2], [`${e.cry}:crystal-small`, 11, 19], [`${e.cry}:crystal-small`, 22, 19], ["f", 12, 3], ["f", 21, 3]);
    note = "불의 신전 첫 층. 검붉은 현무암 회랑 양쪽은 용암이 들끓는 못이고, 서쪽은 북쪽, 동쪽은 남쪽에서 널다리가 용암을 건너 벽 끝 불 룬 제단(붉은 보물상자·바닥 불길)으로 간다. 회랑 끝 북쪽 오르는 계단 양옆에 여신상과 붉은 수정 기둥, 남쪽 모서리엔 화로";
  }
  return base(k)({
    id: `atlas-temple-${k}-1f`, name: `${e.name} · 1층 회랑`, room: "통로", purpose: "탐험",
    art: grid(W, H, art), props,
    entry: [16, 25], targets: [[16, 4], [4, 11], [29, 11]].map(([x, y]) => (k === "fire" ? (x === 4 ? [4, 8] : x === 29 ? [29, 15] : [x, y]) : k === "tide" ? (x === 4 ? [6, 12] : x === 29 ? [27, 12] : [x, y]) : k === "earth" ? (x === 4 ? [7, 12] : x === 29 ? [26, 12] : [x, y]) : [x, y])),
    exits: [{ at: [16, 25], to: "outside", note: "남쪽 문 → 신전 앞" }, { at: [16, 3], to: `atlas-temple-${k}-2f`, arrive: [15, 20], note: "북쪽 계단 → 2층 시련" }],
    note,
  });
}

// ── 2층: 시련 ─────────────────────────────────────────────────────────────────────────────────────────────────────
function templeTrial(k) {
  const e = EL[k], W = 32, H = 24;
  const art = [[".", 3, 1, 28, 21], ["q", 4, 3, 27, 5], ["q", 4, 19, 27, 21], ["q", 4, 3, 7, 21], ["q", 24, 3, 27, 21]]; // 둘레 회랑
  const props = [["^", 14, 1], ["_", 14, 19], ...[[5, 4], [26, 4], [5, 20], [26, 20]].map(([x, y], i) => [ALL_RUNES[i], x, y]), ["plate", 15, 12], ["lever-off", 16, 12], // 네 원소 룬과 가운데 발판·레버
    ["w", 8, 1], ["w", 23, 1], ["I", 9, 6], ["I", 22, 6], ["I", 9, 16], ["I", 22, 16]];
  let note = "";
  if (k === "wind") {
    art.push(["c", 8, 7, 23, 17, { blob: 501, wobble: 0.15 }], [".", 13, 10, 18, 14], ["%", 15, 6, 16, 9], ["%", 8, 12, 12, 12], ["%", 19, 12, 23, 12]);
    props.push(["S", 13, 10], ["S", 18, 10], [`${e.cry}:crystal-small`, 13, 14], [`${e.cry}:crystal-small`, 18, 14], ["G", 4, 8], ["G", 27, 8], ["G", 4, 14], ["G", 27, 14]);
    note = "바람의 신전 2층, 시련의 방. 둘레 무늬 석판 회랑 네 모서리에 네 원소 룬, 가운데는 하늘로 트인 큰 틈 위의 섬 — 북·서·동 세 널다리가 섬으로 가고, 섬 위 발판과 레버를 여신상 둘과 초록 수정이 지킨다. 회랑 벽을 따라 가고일";
  } else if (k === "tide") {
    art.push(["~", 8, 7, 23, 17], [".", 12, 10, 19, 14], ["=", 15, 7, 16, 9], ["=", 15, 15, 16, 17]);
    props.push(["basin", 12, 10], ["basin", 18, 10], [`${e.cry}:crystal-pillar`, 12, 13], [`${e.cry}:crystal-pillar`, 19, 13], ["S", 4, 8], ["S", 27, 8], ["S", 4, 14], ["S", 27, 14]);
    note = "물의 신전 2층, 시련의 방. 네모난 큰 못 한가운데 석판 섬, 남북 돌다리로 건너면 섬 위엔 회복의 샘 둘과 푸른 수정 기둥, 발판과 레버(수위를 바꾸는 장치 자리). 둘레 회랑 네 모서리 원소 룬과 여신상 넷";
  } else if (k === "earth") {
    art.push(["d", 8, 6, 23, 18], ["q", 14, 11, 17, 13]);
    // 바위 미로: 흙판 위 큰 바위로 길을 가른다
    props.push(...[[9, 7], [13, 7], [19, 7], [9, 10], [20, 10], [11, 13], [18, 14], [9, 16], [13, 16], [21, 16]].map(([x, y], i) => [i % 2 ? "B" : "O", x, y]),
      ["V", 12, 1], ["W", 18, 1], ["ore-gold", 10, 1], ["ore-gold", 21, 1], [`${e.cry}:crystal-pile`, 16, 9], [`${e.cry}:crystal-small`, 11, 10], [`${e.cry}:crystal-small`, 20, 13], ["k", 15, 16], ["k", 17, 8]);
    note = "땅의 신전 2층, 시련의 방. 둘레 회랑 안쪽이 통째로 파헤친 흙판이고, 큰 바위 열 개가 길을 갈라 바위 미로를 이룬다. 한가운데 무늬 석판 위 발판과 레버, 호박 수정 덩이와 석순, 벽엔 뿌리와 금 광맥. 네 모서리 원소 룬";
  } else {
    art.push(["L", 8, 7, 23, 17, { blob: 521, wobble: 0.15 }], [".", 12, 10, 19, 14], ["&", 15, 6, 16, 9], ["&", 15, 15, 16, 18]);
    props.push(["T", 12, 10], ["T", 19, 10], ["F", 13, 14], ["F", 18, 14], ["G", 4, 8], ["G", 27, 8], ["G", 4, 14], ["G", 27, 14], [`${e.cry}:crystal-small`, 12, 13], [`${e.cry}:crystal-small`, 19, 13]);
    note = "불의 신전 2층, 시련의 방. 둘레 회랑이 가운데 끓는 용암 못을 두르고, 남북 널다리가 용암 섬으로 간다. 섬 위 화로 둘과 바닥 불길 사이 발판과 레버(용암을 식히는 장치 자리), 붉은 수정. 회랑 모서리 원소 룬과 가고일 넷";
  }
  return base(k)({
    id: `atlas-temple-${k}-2f`, name: `${e.name} · 2층 시련의 방`, room: "퍼즐방", purpose: "퍼즐",
    art: grid(W, H, art), props,
    entry: [15, 18], targets: [[15, 4], [15, 11], [5, 12], [26, 12]],
    exits: [{ at: [15, 19], to: `atlas-temple-${k}-1f`, arrive: [16, 4], note: "남쪽 내려가는 계단 → 1층" }, { at: [15, 3], to: `atlas-temple-${k}-3f`, arrive: [14, 20], note: "북쪽 오르는 계단 → 3층 제단" }],
    note,
  });
}

// ── 3층: 수정 제단 ────────────────────────────────────────────────────────────────────────────────────────────────
function templeAltar(k) {
  const e = EL[k], W = 30, H = 24;
  const art = [[".", 12, 21, 17, 23], [".", 3, 1, 26, 21], ["D", 9, 3, 20, 7], ["q", 13, 8, 16, 21]];
  const props = [[`${e.cry}:crystal-big`, 14, 3], [`${e.cry}:crystal-pillar`, 11, 3], [`${e.cry}:crystal-pillar`, 18, 3], [`${e.cry}:crystal-pillar`, 10, 5], [`${e.cry}:crystal-pillar`, 19, 5],
    [e.rune, 14, 6], [e.rune, 15, 6], ["S", 7, 3], ["S", 22, 3], ["chest-red", 12, 6], ["chest-red", 17, 6], ["w", 5, 1], ["w", 24, 1]];
  let note = "";
  if (k === "wind") {
    art.push(["c", 4, 9, 25, 15, { blob: 601, wobble: 0.3 }], ["%", 13, 9, 16, 15]);
    props.push(["G", 11, 16], ["G", 18, 16], [`${e.cry}:crystal-small`, 5, 17], [`${e.cry}:crystal-small`, 24, 17], ["n", 4, 5], ["n", 25, 5], ["sparkle-gold", 8, 18], ["sparkle-gold", 21, 18], ["e", 6, 20], ["e", 23, 20]);
    note = "바람의 신전 꼭대기, 수정 제단(보스방). 남쪽 계단에서 무늬 석판 길이 하늘로 트인 넓은 틈을 널다리로 건너 북쪽 단으로 간다. 단 위 초록 큰 수정과 수정 기둥 넷, 바람 룬 두 칸, 양옆 붉은 보물상자, 단 곁 여신상. 틈 이쪽엔 가고일 둘";
  } else if (k === "tide") {
    art.push(["~", 4, 8, 12, 17, { blob: 611, wobble: 0.25 }], ["~", 17, 8, 25, 17, { blob: 612, wobble: 0.25 }], ["~", 4, 2, 8, 7, { blob: 613, wobble: 0.2 }], ["~", 21, 2, 25, 7, { blob: 614, wobble: 0.2 }]);
    props.push(["basin", 9, 18], ["basin", 19, 18], ["S", 11, 9], ["S", 17, 9], [`${e.cry}:crystal-small`, 4, 19], [`${e.cry}:crystal-small`, 25, 19], ["J", 5, 20], ["J", 24, 20]);
    note = "물의 신전 꼭대기, 수정 제단(보스방). 제단 양옆과 참배길 양옆이 모두 맑은 못이라, 무늬 석판 참배길 하나만 북쪽 단으로 이어진다. 단 위 푸른 큰 수정과 수정 기둥 넷, 물 룬, 붉은 보물상자 둘. 남쪽 계단참엔 회복의 샘 둘";
  } else if (k === "earth") {
    art.push(["d", 4, 9, 25, 19], ["q", 13, 8, 16, 21]);
    props.push(...[[4, 10], [7, 12], [4, 15], [24, 10], [21, 12], [24, 15]].map(([x, y], i) => [i % 2 ? "B" : "O", x, y]), ["V", 8, 1], ["W", 10, 1], ["V", 19, 1], ["W", 21, 1], ["ore-gold", 4, 1], ["ore-gold", 25, 1],
      [`${e.cry}:crystal-pile`, 10, 11], [`${e.cry}:crystal-pile`, 19, 11], [`${e.cry}:crystal-small`, 9, 17], [`${e.cry}:crystal-small`, 20, 17], ["k", 11, 14], ["k", 18, 14]);
    note = "땅의 신전 꼭대기, 수정 제단(보스방). 제단 앞 넓은 흙판에 큰 바위가 양옆으로 늘어서고 호박 수정 덩이와 석순이 돋았다. 무늬 석판 참배길이 북쪽 단으로, 단 위 호박색 큰 수정과 수정 기둥 넷, 땅 룬, 붉은 보물상자 둘. 벽엔 뿌리와 금 광맥";
  } else {
    art.push(["L", 4, 8, 25, 19, { blob: 621, wobble: 0.2 }], ["&", 13, 8, 16, 19], ["q", 13, 20, 16, 21]);
    props.push(["T", 5, 20], ["T", 24, 20], ["F", 7, 20], ["F", 22, 20], ["G", 11, 20], ["G", 18, 20], ["T", 5, 4], ["T", 24, 4]);
    note = "불의 신전 꼭대기, 수정 제단(보스방). 제단 앞은 통째로 용암 호수이고 넓은 널다리 하나만 건너간다. 단 위 붉은 큰 수정과 수정 기둥 넷, 불 룬, 붉은 보물상자 둘, 단 곁 여신상과 화로. 남쪽 계단참엔 가고일과 화로·바닥 불길";
  }
  return base(k)({
    id: `atlas-temple-${k}-3f`, name: `${e.name} · 3층 수정 제단`, room: "보스방", purpose: "보스",
    art: grid(W, H, art), props,
    keeper: [14, 8], entry: [14, 22], targets: [[14, 8], [12, 7], [17, 7]],
    exits: [{ at: [14, 23], to: `atlas-temple-${k}-2f`, arrive: [15, 4], note: "남쪽 계단 → 2층" }],
    note,
  });
}
