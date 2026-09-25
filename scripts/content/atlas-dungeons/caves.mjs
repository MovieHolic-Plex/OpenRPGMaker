// 시작의 동굴(튜토리얼 3칸)과 버려진 은광(6층). Cave sheet (oprn_dungeon_cave: the chasm autotile is a pool with a rock lip).
// Natural floors are chambers (seeded blobs) joined by passages, with rock between them — a cave is mostly rock. Debris
// sits in heaps by the walls and stalagmites grow in clumps (dress.mjs); every prop group has an owner: a camp, a spring,
// a rail end, a miner's rest, a vein.
import { grid, series, room, hpass, vpass } from "./lib.mjs";

const tut = series({ theme: "cave", tileset: "oprn_dungeon_cave", series: "tutorial", seriesName: "시작의 동굴", env: "지하", groves: 12, heaps: 3, topUp: "cave" });
const mine = series({ theme: "cave", tileset: "oprn_dungeon_cave", series: "mine", seriesName: "버려진 은광", env: "지하", wall: [[21, 22, 23], [255, 256, 257]], groves: 12, heaps: 3, topUp: "cave" });

export function cavePlans() {
  return [tutorialMouth(), tutorialBats(), tutorialSlime(), mineGate(), mineB1(), mineShaft(), mineCrystal(), mineFlooded(), mineCore()];
}

function tutorialMouth() {
  const W = 28, H = 22;
  return tut({
    id: "atlas-tutorial-mouth", name: "시작의 동굴 · 입구", room: "통로", purpose: "탐험",
    art: grid(W, H, [
      vpass(13, 15, 21), // 남쪽 굴 어귀(맵 끝)
      room(12, 14, 7, 4, 101, 0.08), // 어귀 굴(야영 흔적)
      vpass(16, 6, 12), // 북쪽으로 오르는 굴길
      room(20, 6, 6, 4, 103, 0.08), // 샘굴
      ["W", 21, 5, 26, 9, { blob: 105, wobble: 0.14 }], // 맑은 지하 샘
      hpass(8, 15, 7), // 서쪽으로 난 굴길
      room(5, 7, 4, 3, 107, 0.08), // 북서쪽 막다른 굴
      vpass(18, 0, 3), // 북쪽 굴길(맵 끝)
    ]),
    props: [
      ["s", 15, 18], // 어귀의 안내 표지판
      ["F", 8, 14], ["E", 6, 15], ["j", 7, 16], ["J", 9, 16], // 앞선 모험가의 야영 흔적
      ["chest-wood", 4, 6], ["o", 5, 6], ["q", 3, 7], // 북서쪽 굴 끝 첫 보물상자와 떨어진 돌
    ],
    entry: [13, 21], targets: [[4, 8], [18, 1], [10, 15], [19, 7]],
    exits: [{ at: [13, 21], to: "outside", note: "남쪽 굴 어귀 → 마을 뒷산" }, { at: [18, 0], to: "atlas-tutorial-bats", arrive: [16, 23], note: "북쪽 굴길 → 박쥐 굴" }],
    note: "모험을 처음 시작하는 작은 굴(28×22). 남쪽 어귀 굴에 안내 표지판과 앞선 모험가의 야영 흔적(모닥불·나무통·물통·항아리), 좁은 굴길을 오르면 맑은 지하 샘이 고인 샘굴, 서쪽 굴길 끝 막다른 굴에 첫 보물상자. 샘굴 북쪽 굴길이 박쥐 굴로",
  });
}

function tutorialBats() {
  const W = 34, H = 24;
  return tut({
    id: "atlas-tutorial-bats", name: "시작의 동굴 · 박쥐 굴과 회복의 샘", room: "쉼터", purpose: "휴식",
    art: grid(W, H, [
      vpass(16, 17, 23), // 남쪽 굴길
      room(17, 11, 7, 6, 111, 0.08), // 가운데 박쥐 굴
      ["W", 17, 9, 23, 14, { blob: 121, wobble: 0.22 }], // 천장 물이 고인 웅덩이(박쥐가 매달린 천장 아래)
      vpass(16, 0, 5), // 북쪽 굴길
      hpass(3, 11, 13), // 서쪽 굴길
      room(5, 13, 4, 4, 113, 0.08), // 서쪽 샘굴
      hpass(23, 27, 9), // 동쪽 굴길
      room(29, 8, 4, 4, 115, 0.1), // 동쪽 막다른 굴
    ]),
    props: [
      ["basin", 4, 13], ["e", 2, 14], ["e", 7, 12], ["n", 7, 15], // 회복의 샘 돌확과 둘레 수정
      ["K", 30, 9], ["chest-wood", 29, 8], ["U", 31, 10], // 동쪽 굴 끝: 박쥐에게 당한 모험가와 상자
    ],
    entry: [16, 23], targets: [[5, 16], [29, 10], [16, 1], [14, 14]],
    exits: [{ at: [16, 23], to: "atlas-tutorial-mouth", arrive: [18, 0], note: "남쪽 → 입구" }, { at: [16, 0], to: "atlas-tutorial-slime", arrive: [12, 21], note: "북쪽 → 슬라임 둥지" }],
    note: "박쥐가 사는 가운데 굴(천장에서 떨어진 물이 고인 웅덩이, 석순 무리)에서 세 갈래로 나뉜다. 서쪽 샘굴은 회복의 샘(둥근 돌확에 빛나는 물)과 둘레 푸른 수정 — 보스 앞 쉼터. 동쪽 막다른 굴엔 박쥐에게 당한 모험가의 뼈와 보물상자. 북쪽 굴길은 슬라임 둥지로",
  });
}

function tutorialSlime() {
  const W = 26, H = 22;
  return tut({
    id: "atlas-tutorial-slime", name: "시작의 동굴 · 슬라임 둥지", room: "보스방", purpose: "보스", groves: 3,
    art: grid(W, H, [
      room(12, 10, 10, 8, 131, 0.06), // 둥근 둥지 굴
      vpass(12, 17, 21), // 남쪽 굴길
      ["W", 3, 6, 8, 15, { blob: 133, wobble: 0.18 }], ["W", 17, 7, 22, 15, { blob: 135, wobble: 0.18 }], // 양쪽 끈적한 웅덩이
      ["#", 9, -3, 16, 4, { blob: 137, wobble: 0.1 }], // 둥지 뒤 벽
      ["D", 9, 7, 16, 10], // 북쪽 흙 단(둥지 자리)
    ]),
    props: [
      ["bones", 10, 8], ["K", 15, 9], ["U", 11, 10], ["o", 14, 8], // 둥지: 삼킨 짐승 뼈
      ["chest-red", 12, 8], // 보스를 쓰러뜨리면 여는 상자
    ],
    keeper: [12, 12], entry: [12, 21], targets: [[12, 12], [13, 9], [9, 16]],
    exits: [{ at: [12, 21], to: "atlas-tutorial-bats", arrive: [16, 0], note: "남쪽 → 박쥐 굴" }],
    note: "시작의 동굴 가장 안쪽, 큰 슬라임이 사는 둥근 굴(보스방). 양쪽에 끈적한 웅덩이, 북쪽 흙 단 위가 둥지 — 삼킨 짐승의 뼈 사이에 붉은 보물상자. 보스는 단 앞 (12,12)에 선다. 둘레 석순 무리",
  });
}

// ── 버려진 은광 ────────────────────────────────────────────────────────────────────────────────────────────────
function mineGate() {
  const W = 36, H = 26;
  return mine({
    id: "atlas-mine-gate", name: "버려진 은광 · 갱구와 광부 쉼터", room: "쉼터", purpose: "상점", groves: 0, heaps: 2,
    art: grid(W, H, [
      [".", 3, 3, 32, 14], // 갱구 홀
      vpass(17, 13, 25, ".", 5), // 남쪽 갱구 굴(맵 끝)
      room(25, 19, 4, 3, 141, 0.12), hpass(18, 23, 20), ["W", 25, 18, 29, 22, { blob: 143, wobble: 0.2 }], // 갱구 곁 물이 스민 옆굴
      room(9, 19, 4, 3, 147, 0.12), hpass(11, 16, 20), // 갱구 곁 연장 창고 굴
      vpass(17, 0, 4), // 북쪽 본갱
      ["|", 4, 5, 12, 11], // 서쪽 광부 쉼터 널마루
      ["|", 23, 5, 31, 10], // 동쪽 상인 자리 널마루
    ]),
    rails: grid(W, H, [["+", 17, 0, 17, 25]]).replaceAll("#", " "),
    props: [
      // 광부 쉼터: 긴 탁자와 양끝 의자, 침대 둘, 물통·통, 화로
      ["int:table-long", 6, 8], ["int:seat-r", 5, 8], ["int:seat-l", 9, 8], ["int:bed-v", 4, 5], ["int:bed-v", 11, 5], ["int:bucket", 10, 10], ["E", 4, 10], ["T", 8, 5],
      // 던전 상인: 계산대, 상자·자루, 간판, 랜턴
      ["int:counter", 25, 6], ["int:crate", 28, 6], ["int:sack", 29, 6], ["int:sack", 30, 7], ["int:box", 24, 9], ["int:sign-item", 27, 3], ["int:lantern", 27, 8], ["int:stool", 26, 9],
      // 본선 곁: 광차, 광석 무더기, 화로
      ["m", 18, 12], ["int:ore", 21, 6], ["int:ore", 13, 6], ["int:crate", 21, 7], ["T", 14, 11], ["T", 20, 11],
      ["ship:post", 15, 6], ["ship:post", 19, 6], ["ship:post", 15, 9], ["ship:post", 19, 9], // 본선 양옆 갱목 받침
      ["int:rocks", 13, 13], ["int:ore", 12, 12], ["ship:post", 22, 13], ["int:crate", 23, 12], ["int:barrel", 11, 13], // 홀 남쪽 벽 아래 부린 광석과 짐
      // 연장 창고 굴: 판자 더미·상자·자루
      ["int:plank-pile", 7, 19], ["int:plank-stand", 8, 19], ["int:crate", 10, 20], ["int:sack", 11, 20], ["E", 6, 20],
      ["s", 15, 17], ["w", 6, 3], ["w", 29, 3], ["x", 21, 3],
    ],
    entry: [17, 25], targets: [[7, 9], [27, 9], [17, 1], [22, 12], [24, 20], [9, 21]],
    exits: [{ at: [17, 25], to: "outside", note: "남쪽 갱구 → 광산 마을 뒤 비탈" }, { at: [17, 0], to: "atlas-mine-b1", arrive: [19, 25], note: "북쪽 본갱 → 1층 레일 갱도" }],
    note: "버려진 은광 들머리. 남쪽 갱구에서 레일 본선이 북쪽 본갱으로 곧게 들어간다. 홀 서쪽 널마루는 광부 쉼터(긴 탁자와 양끝 의자, 침대 둘, 물통, 화로), 동쪽 널마루엔 던전 상인 자리(계산대·상자·자루·잡화 간판·랜턴·걸상). 본선 곁 광차와 광석 무더기, 갱구 굴 양옆으로 연장 창고 굴(판자 더미·상자)과 물이 스민 옆굴",
  });
}

function mineB1() {
  const W = 40, H = 26;
  return mine({
    id: "atlas-mine-b1", name: "버려진 은광 · 1층 레일 갱도", room: "통로", purpose: "탐험",
    art: grid(W, H, [
      vpass(19, 15, 25, ".", 5), // 남쪽 들머리(맵 끝)
      [".", 4, 10, 35, 14], // 가로 운반 갱도(벽면 둘 + 세 줄)
      room(20, 5, 4, 4, 151, 0.08), vpass(19, 8, 11, ".", 5), // 북쪽 막장
      room(7, 6, 5, 4, 153, 0.08), // 서쪽 은 광맥 굴
      room(33, 6, 4, 4, 155, 0.08), // 동쪽 광석 창고
      room(32, 20, 5, 4, 157, 0.08), vpass(32, 14, 17), // 동남쪽 해치 굴
      ["W", 23, 12, 28, 18, { blob: 161, wobble: 0.26 }], // 물 찬 균열
      ["w", 24, 13, 27, 13], // 균열 위 레일 다리
    ]),
    rails: grid(W, H, [["+", 19, 4, 19, 12], ["+", 19, 15, 19, 25], ["+", 7, 13, 18, 13], ["+", 21, 13, 34, 13], ["+", 7, 5, 7, 12], ["+", 34, 6, 34, 12]]).replaceAll("#", " "),
    turntables: [[19, 13]],
    props: [
      ["ore-silver", 5, 2], ["ore-silver", 8, 3], ["ore-gold", 10, 3], ["R", 4, 6], ["U", 5, 8], ["m", 7, 9], // 은 광맥 굴: 벽면 광맥과 캐다 만 돌
      ["O", 21, 3], ["R", 22, 5], ["m", 19, 6], ["ore-silver", 20, 1], // 막장
      ["int:crate", 31, 5], ["int:crate", 32, 5], ["int:ore", 31, 7], ["m", 34, 9], ["E", 36, 8], // 광석 창고
      ["hatch-open", 33, 21], ["s", 30, 19], ["E", 35, 21], ["j", 36, 20], // 아래층으로 내려가는 해치
      ["T", 14, 12], ["T", 22, 12],
    ],
    entry: [19, 25], targets: [[6, 7], [21, 7], [32, 7], [33, 21]],
    exits: [{ at: [19, 25], to: "atlas-mine-gate", arrive: [17, 0], note: "남쪽 → 갱구" }, { at: [33, 21], to: "atlas-mine-shaft", arrive: [15, 4], note: "동남쪽 바닥 해치(사다리) → 2층 수직갱" }],
    note: "가로 운반 갱도에 레일이 깔린 1층. 남쪽 들머리에서 본선이 가운데 회전대에 닿고, 서쪽 지선은 은 광맥 굴(벽면에 은·금 광맥, 캐다 만 돌, 광차), 동쪽 지선은 물 찬 균열 위 레일 다리를 건너 광석 창고(상자·광석·광차 차고)로, 북쪽은 막장. 동남쪽 굴 바닥에 아래층으로 내려가는 해치와 경고 표지판",
  });
}

function mineShaft() {
  const W = 32, H = 30;
  return mine({
    id: "atlas-mine-shaft", name: "버려진 은광 · 2층 수직갱", room: "퍼즐방", purpose: "탐험",
    art: grid(W, H, [
      room(15, 15, 13, 12, 171, 0.05), // 수직갱을 두른 굴
      [".", 13, 1, 17, 5], // 사다리가 내려오는 북쪽 벽
      ["o", 7, 9, 24, 22, { blob: 173, wobble: 0.1 }], // 가운데 바닥 없는 수직갱
      ["$", 14, 8, 16, 23], // 남북으로 건너는 널판 다리
      ["$", 6, 15, 25, 16], // 동서로 건너는 널판 다리
      vpass(15, 26, 29, ".", 5), // 남쪽 갱도(맵 끝)
    ]),
    props: [
      ["h", 15, 1], ["h", 15, 2], // 1층 해치에서 내려오는 사다리(벽면)
      ["lift", 20, 11], ["int:lantern", 22, 9], // 수직갱에 걸린 승강 발판
      ["E", 4, 12], ["int:crate", 4, 18], ["int:plank-pile", 5, 19], ["int:plank-stand", 4, 17], // 서쪽 벽 널판 더미
      ["j", 26, 18], ["E", 27, 17], // 동쪽 물통
      ["K", 8, 24], ["U", 9, 25], // 떨어진 광부
    ],
    entry: [15, 4], targets: [[15, 25], [5, 15], [26, 15], [15, 15]],
    exits: [{ at: [15, 4], to: "atlas-mine-b1", arrive: [33, 21], note: "북쪽 벽 사다리 → 1층 해치" }, { at: [15, 29], to: "atlas-mine-crystal", arrive: [18, 0], note: "남쪽 갱도 → 3층 수정 광맥" }],
    note: "바닥 없는 수직갱이 가운데를 차지한 2층. 1층 해치에서 북쪽 벽 사다리로 내려오면, 널판 다리 두 줄이 수직갱 위에서 십자로 만난다. 수직갱 동북쪽 허공에 승강 발판(도르래 줄)이 걸려 있고 랜턴, 서쪽 벽 아래 널판 더미와 상자, 남서쪽엔 떨어진 광부의 뼈. 남쪽 갱도가 수정 광맥으로 이어진다",
  });
}

function mineCrystal() {
  const W = 38, H = 26;
  return mine({
    id: "atlas-mine-crystal", name: "버려진 은광 · 3층 수정 광맥", room: "보물방", purpose: "보물", groves: 4,
    art: grid(W, H, [
      vpass(18, 0, 6), // 북쪽 갱도(맵 끝)
      room(18, 8, 6, 4, 181, 0.08), // 캐던 자리
      hpass(9, 13, 10), room(6, 10, 4, 4, 182, 0.1), // 서쪽 수정 굴
      hpass(23, 27, 10), room(31, 12, 5, 7, 183, 0.08), // 동쪽 호수 굴
      ["W", 29, 11, 36, 19, { blob: 184, wobble: 0.14 }], // 수정이 비치는 지하 호수
      vpass(17, 11, 20), hpass(13, 17, 20), room(10, 20, 5, 3, 187, 0.08), // 남서쪽 보물 굴
      hpass(0, 6, 20), // 서쪽 내리막(맵 끝)
    ]),
    props: [
      ["Q", 4, 9], ["C", 7, 9], ["e", 3, 11], ["n", 8, 12], ["e", 5, 13], // 서쪽 수정 무리
      ["Q", 27, 9], ["C", 30, 9], ["e", 27, 14], ["n", 28, 17], ["C", 27, 12], // 호숫가 수정 무리
      ["m", 17, 8], ["int:ore", 14, 8], ["int:crate", 14, 9], ["int:ore", 21, 8], ["T", 22, 9], // 캐던 자리: 광차·광석·상자·화로
      ["chest-iron", 9, 19], ["chest-wood", 11, 19], ["e", 8, 20], ["K", 13, 21], ["C", 14, 18], // 남서쪽 보물 굴
    ],
    entry: [18, 0], targets: [[10, 21], [28, 11], [6, 11], [20, 10]],
    exits: [{ at: [18, 0], to: "atlas-mine-shaft", arrive: [15, 29], note: "북쪽 → 2층 수직갱" }, { at: [0, 20], to: "atlas-mine-flooded", arrive: [0, 12], note: "남서쪽 굴 서쪽 내리막 → 4층 침수 갱도" }],
    note: "푸른 수정이 벽마다 자란 3층. 광부들이 캐다 만 자리(광차·광석·상자·화로)에서 서쪽 수정 굴과 동쪽 호수 굴(수정이 비치는 지하 호수와 호숫가 수정 무리)로 굴길이 갈라진다. 남쪽 굴길 끝 남서쪽 굴에 쇠 보물상자와 나무 상자, 쓰러진 광부, 그 굴 서쪽 내리막이 침수 갱도로",
  });
}

function mineFlooded() {
  const W = 40, H = 26;
  return mine({
    id: "atlas-mine-flooded", name: "버려진 은광 · 4층 침수 갱도", room: "퍼즐방", purpose: "퍼즐",
    art: grid(W, H, [
      hpass(0, 8, 12), // 서쪽 내리막 들머리(맵 끝)
      room(20, 13, 16, 8, 191, 0.06),
      ["W", 10, 7, 32, 20, { blob: 193, wobble: 0.08 }], // 물에 잠긴 갱도
      ["%", 9, 12, 30, 13], // 물 위 널판 길
      ["%", 22, 6, 23, 11], // 북쪽 수문으로
      ["%", 26, 14, 27, 18], // 남쪽 섬으로
      room(34, 12, 4, 4, 195, 0.1), // 동쪽 배수 기계 굴
      [".", 19, 1, 26, 6], // 북쪽 수문 둑
      room(26, 21, 4, 3, 197, 0.1), // 남쪽 섬(가라앉은 광차)
    ]),
    rails: grid(W, H, [["+", 1, 13, 8, 13], ["+", 31, 13, 35, 13]]).replaceAll("#", " "),
    props: [
      ["l", 22, 1], ["pipe-v", 20, 3], ["pipe-v", 25, 3], ["s", 21, 5], // 북쪽 수문: 벽 레버와 관
      ["gear-big", 34, 9], ["pipe-h", 32, 11], ["pipe-valve", 33, 11], ["piston", 36, 11], // 동쪽 배수 기계
      ["m", 26, 21], ["int:crate", 28, 21], ["K", 25, 22], // 남쪽 섬
      ["m", 6, 13], ["w", 3, 11],
    ],
    entry: [0, 12], targets: [[23, 4], [34, 14], [28, 22], [37, 13]],
    exits: [{ at: [0, 12], to: "atlas-mine-crystal", arrive: [0, 20], note: "서쪽 → 3층" }, { at: [37, 13], to: "atlas-mine-core", arrive: [13, 23], note: "동쪽 배수 굴 끝 → 골렘의 방" }],
    note: "지하수가 차오른 4층. 서쪽 들머리의 레일은 물가에서 끊기고, 널판 길이 물 위로 동쪽 배수 기계 굴(큰 톱니바퀴·관·밸브·피스톤)까지 간다. 널판 허리에서 북쪽으로 수문 둑(벽 레버 — 물을 빼는 장치 자리)과 남쪽으로 가라앉은 광차가 걸린 섬이 갈라진다. 배수 굴 끝이 골렘의 방으로",
  });
}

function mineCore() {
  const W = 28, H = 24;
  return mine({
    id: "atlas-mine-core", name: "버려진 은광 · 골렘의 방", room: "보스방", purpose: "보스", groves: 6,
    art: grid(W, H, [
      room(13, 11, 11, 9, 201, 0.05), // 둥근 광맥 심장부
      vpass(13, 19, 23), // 남쪽 굴길
      ["L", 4, 5, 22, 18, { blob: 203, wobble: 0.1 }], // 가운데 섬을 두른 녹은 광석 해자
      [".", 8, 9, 18, 15, { blob: 205, wobble: 0.06 }], // 가운데 섬
      ["D", 10, 10, 16, 13], // 골렘이 잠든 광석 단
      ["&", 12, 15, 14, 18], // 남쪽 돌다리(용암 위 널판)
    ]),
    props: [
      ["N", 12, 10], // 골렘 핵의 마법진
      ["ore-gold", 6, 3], ["ore-silver", 9, 2], ["ore-gold", 17, 2], ["ore-silver", 20, 3], // 벽의 광맥
      ["chest-red", 16, 10], ["int:ore", 9, 9], ["int:ore", 17, 13], // 섬 위 보상과 광석
    ],
    keeper: [13, 14], entry: [13, 23], targets: [[13, 14], [16, 11], [6, 18], [13, 20]],
    exits: [{ at: [13, 23], to: "atlas-mine-flooded", arrive: [37, 13], note: "남쪽 → 4층" }],
    note: "은광의 가장 깊은 곳, 광맥 심장부의 둥근 굴(보스방). 녹은 광석이 끓는 해자가 가운데 섬을 동·서·남 세 면에서 두르고(북쪽은 벽 밑 광석 단), 정면에서는 남쪽 한 줄 다리로 건넌다. 섬 위 갈색 광석 단에 골렘의 핵 마법진과 붉은 보물상자·광석, 벽마다 금·은 광맥. 골렘은 다리 끝 (13,14)에서 깨어난다",
  });
}
