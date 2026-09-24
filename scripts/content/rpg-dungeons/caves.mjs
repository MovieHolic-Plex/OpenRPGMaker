// Natural cave set (four maps joined by edge corridors): entrance → fork → treasure / boss.
// Rooms are organic bodies (seeded blobs), rock spurs grow out of the walls (never free-standing blocks), water
// is an irregular spring pool, and debris sits in a few heaps by the walls.
import { grid } from "./kit.mjs";

export function cavePlans() {
  return [entrance(), fork(), treasure(), boss()];
}

function entrance() {
  const W = 28, H = 22;
  return {
    id: "dungeon-cave-entrance", name: "자연 동굴 · 입구", theme: "cave", series: "cave", tileset: "oprn_dungeon_cave", outcrops: true, groves: 3, room: 1,
    art: grid(W, H, [
      [".", 2, 2, 25, 19, { blob: 11, wobble: 0.14 }], [".", 13, 0, 15, 5], [".", 13, 16, 16, 21],
      ["#", 3, 17, 11, 23, { blob: 113, wobble: 0.2 }], // 남서쪽 바위
      ["#", 16, 5, 29, 12, { blob: 4, wobble: 0.22 }], // 동쪽 벽에서 길게 뻗은 바위 혀
      ["#", -2, 12, 9, 18, { blob: 8, wobble: 0.22 }], // 서쪽 벽에서 뻗은 바위 혀
      ["W", 3, 4, 10, 11, { blob: 5, wobble: 0.18 }], // 지하 샘
    ]),
    props: [
      ["k", 11, 12], ["q", 12, 13], ["q", 10, 13],
      ["F", 18, 16], ["E", 20, 15], ["j", 20, 16], ["s", 14, 18],
    ],
    entry: [15, 21],
    targets: [[8, 12], [19, 14], [16, 14]],
    exits: [{ at: [13, 0], to: "dungeon-cave-fork", arrive: [15, 22], note: "북쪽 굴길 → 갈림길" }, { at: [15, 21], to: "outside", note: "남쪽 굴 어귀 → 바깥" }],
    note: "바깥에서 들어오는 굴 어귀. 서쪽에 불규칙한 지하 샘과 석순, 동쪽 벽에서 바위 턱이 튀어나와 그 아래가 무너진 옆굴(큰 바위·잔돌·희생자 해골). 어귀 안쪽엔 앞선 모험가의 야영 흔적(모닥불·나무통·물통)과 경고 표지판, 북쪽 굴길로 이어진다",
  };
}

function fork() {
  const W = 32, H = 23;
  return {
    id: "dungeon-cave-fork", name: "자연 동굴 · 갈림길", theme: "cave", series: "cave", tileset: "oprn_dungeon_cave", outcrops: true, groves: 3, room: 2,
    art: grid(W, H, [
      [".", 3, 3, 21, 19, { blob: 21, wobble: 0.16 }], [".", 14, 0, 16, 5], [".", 14, 17, 16, 22], [".", 0, 7, 6, 11],
      [".", 19, 5, 30, 16, { blob: 8, wobble: 0.14 }], // 동쪽 수정 샘굴
      ["W", 18, 6, 22, 17, { blob: 12, wobble: 0.35 }], ["%", 18, 11, 22, 11], // 지하 개울과 그 위 나무 다리
      ["#", -2, 13, 12, 24, { blob: 2, wobble: 0.2 }], // 서남쪽 벽에서 뻗은 바위
      ["#", 2, -2, 12, 7, { blob: 23, wobble: 0.2 }], // 서북쪽 벽에서 뻗은 바위

    ]),
    props: [
      ["s", 13, 13], ["k", 17, 15], ["q", 18, 16], ["q", 16, 17], ["k", 9, 10], ["q", 10, 11], ["q", 8, 11], ["k", 26, 11],
      ["C", 26, 8], ["e", 28, 9], ["Q", 25, 13], ["n", 27, 14], ["K", 24, 10],
      ["e", 3, 11],
    ],
    entry: [15, 22],
    targets: [[27, 11], [2, 9]],
    exits: [
      { at: [15, 0], to: "dungeon-cave-boss", arrive: [14, 21], note: "북쪽 → 보스방" },
      { at: [0, 9], to: "dungeon-cave-treasure", arrive: [21, 8], note: "서쪽 → 보물방" },
      { at: [15, 22], to: "dungeon-cave-entrance", arrive: [13, 0], note: "남쪽 → 입구" },
    ],
    note: "세 갈래 길. 가운데 표지판이 서쪽 보물방·북쪽 보스방을 가리키고, 동쪽은 지하 개울을 나무 다리로 건너는 수정 샘굴(막다른 곳, 큰 수정·수정 기둥·쓰러진 광부 해골). 수정은 샘굴과 서쪽 굴길 두 곳에 나뉘어 자란다",
  };
}

function treasure() {
  const W = 22, H = 16;
  return {
    id: "dungeon-cave-treasure", name: "자연 동굴 · 보물방", theme: "cave", series: "cave", tileset: "oprn_dungeon_cave", outcrops: true, groves: 3, room: 3,
    art: grid(W, H, [
      [".", 2, 2, 16, 14, { blob: 31, wobble: 0.15 }], [".", 14, 6, 21, 9],
      ["W", 2, 9, 8, 14, { blob: 9, wobble: 0.3 }], // 지하 샘
    ]),
    props: [
      ["H", 8, 6], ["C", 6, 6], ["C", 11, 5], ["e", 7, 7], ["e", 10, 7], ["K", 9, 9],
      ["q", 14, 5], ["R", 11, 12],
    ],
    entry: [21, 8],
    targets: [[8, 7], [5, 8]],
    exits: [{ at: [21, 8], to: "dungeon-cave-fork", arrive: [0, 9], note: "동쪽 → 갈림길" }],
    note: "막다른 보물방. 안쪽 벽 아래 닫힌 보물상자를 수정 기둥 둘과 작은 수정이 두르고, 상자 앞에 먼저 온 모험가의 해골. 서남쪽에 불규칙한 지하 샘, 동쪽 짧은 굴길 하나로만 들어온다",
  };
}

function boss() {
  const W = 28, H = 22;
  return {
    id: "dungeon-cave-boss", name: "자연 동굴 · 보스방", theme: "cave", series: "cave", tileset: "oprn_dungeon_cave", outcrops: true, groves: 3, room: 4,
    art: grid(W, H, [
      [".", 3, 3, 24, 19, { blob: 41, wobble: 0.12 }], [".", 13, 0, 15, 4], [".", 13, 17, 15, 21],
      ["W", 18, 11, 24, 16, { blob: 27, wobble: 0.3 }], // 동남쪽 샘
      ["#", -2, 11, 8, 17, { blob: 6, wobble: 0.2 }], ["#", 19, 2, 29, 9, { blob: 19, wobble: 0.2 }], // 벽에서 뻗은 바위
    ]),
    props: [
      // 보스 자리: 쓰러진 거대 석순과 뼈 무더기 앞의 빈 결전장
      ["k", 12, 6], ["k", 15, 6], ["B", 13, 5], ["K", 11, 8], ["K", 16, 8], ["U", 14, 8], ["T", 10, 9], ["T", 17, 9],
      ["q", 9, 13], ["k", 17, 16], ["q", 18, 17], ["K", 9, 17], ["q", 21, 11], ["q", 5, 11], ["q", 19, 10], ["K", 12, 12],
    ],
    entry: [14, 21],
    keeper: [14, 10],
    targets: [[14, 10], [14, 0], [18, 14]],
    exits: [
      { at: [14, 21], to: "dungeon-cave-fork", arrive: [15, 0], note: "남쪽 → 갈림길" },
      { at: [14, 0], to: "deeper", note: "북쪽 굴길 → 동굴 깊은 곳(보스를 이긴 뒤)" },
    ],
    note: "둥근 결전장. 북쪽 굴길 앞 거대한 바위와 석순 둘, 그 앞 뼈 무더기가 보스가 버티는 자리이고 좌우 화로 둘이 비춘다. 동남쪽에 불규칙한 샘, 서북쪽엔 석순 숲, 벽에서 튀어나온 바위 둘이 몸을 숨길 자리. 보스 뒤 북쪽 굴길이 이긴 뒤 나가는 길",
  };
}
