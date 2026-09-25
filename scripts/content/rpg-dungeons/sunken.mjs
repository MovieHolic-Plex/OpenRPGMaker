// Sunken temple (2026-09-25): three rooms of a sea-goddess temple swallowed by the sea, north of the sea cave
// (dungeon-sea-cave's north exit leads here). Drawn on the sea repaint (oprn_dungeon_sea): sea-rock walls and
// pillars, the cut-stone temple floor kept, rock-lipped flooded pools (W), stone-edged water channels (~) with plank
// bridges (=), coral (B·q) grown only where a pillar foot meets water, seaweed on the walls. Built rooms, so pieces stand
// in groups with a reason (a flooded aisle, a shrine, the altar), never scattered: no floor dressing (groves/heaps 0).
// Doors are cut into the room itself — the north exit is a stone arch in the wall face, the south exit a one-cell
// gap in the rim at the map edge — so no floor strip runs out through the void.
import { grid } from "./kit.mjs";

export function sunkenPlans() {
  return [gate(), hall(), altar()];
}

function gate() {
  const W = 36, H = 23;
  return {
    id: "dungeon-sunken-gate", name: "해저 신전 · 물에 잠긴 입구 회랑", theme: "hall", series: "sunken", dress: "sea", groves: 0, heaps: 0, room: 1, tileset: "oprn_dungeon_sea",
    art: grid(W, H, [
      [".", 5, 3, 30, 21], // 회랑
      [".", 16, 21, 19, 22], // 남쪽 입구(테두리에 난 문 틈, 해저 동굴 북쪽에서 이어짐)
      ["q", 16, 5, 19, 21], // 무늬 석판 참배길(폭 4, 문 틈과 같은 폭)
      ["~", 5, 11, 30, 13], // 회랑을 가로지르는 물길
      ["=", 16, 11, 19, 13], // 물길 위 판자 다리(참배길 폭)
      ["W", 6, 15, 12, 20, { blob: 7, wobble: 0.12 }], // 남서쪽 가라앉은 바닥(물웅덩이)
      ["W", 24, 15, 29, 20, { blob: 19, wobble: 0.12 }], // 남동쪽 가라앉은 바닥
      ["W", 24, 5, 29, 9, { blob: 23, wobble: 0.12 }], // 북동쪽 가라앉은 바닥
      ["W", 6, 6, 11, 9, { blob: 31, wobble: 0.12 }], // 북서쪽 가라앉은 바닥
    ]),
    props: [
      // 참배길 양옆 석주 두 줄(물길 앞뒤로 둘씩)
      ["I", 14, 6], ["I", 21, 6], ["I", 14, 9], ["I", 21, 9], ["I", 14, 15], ["I", 21, 15], ["I", 14, 18], ["I", 21, 18],
      // 북쪽 벽 석조 아치(→ 기둥 대전), 남쪽 문 틈 양옆 가고일
      ["A", 16, 3], ["G", 15, 20], ["G", 20, 20],
      // 산호는 석주 밑동과 웅덩이가 맞닿은 두 곳에만(북서·남동, 대각으로 짝)
      ["B", 12, 6], ["q", 12, 8],
      ["B", 22, 19], ["q", 23, 17],
      // 벽에 걸린 해초
      ["V", 8, 4], ["W", 12, 4], ["V", 24, 4], ["x", 28, 3],
    ],
    entry: [17, 22],
    targets: [[17, 5], [18, 12], [9, 14], [27, 14]],
    exits: [{ at: [17, 22], to: "dungeon-sea-cave", arrive: [15, 1], note: "남쪽 문 틈 → 해저 동굴 북쪽" }, { at: [17, 5], to: "dungeon-sunken-hall", arrive: [19, 27], note: "북쪽 벽 아치 → 산호 기둥 대전" }],
    note: "해저 동굴 북쪽 굴길에서 남쪽 문 틈으로 들어오는 신전 입구 회랑. 가고일 둘이 지키는 문 틈을 지나면 무늬 석판 참배길이 북쪽으로 곧게 가고, 양옆에 석주 두 줄이 선다. 회랑 허리를 물길이 가로질러 판자 다리로 건너고, 참배길 끝 북쪽 벽의 석조 아치로 대전에 든다. 바닥이 꺼져 물이 찬 웅덩이 넷(네 모서리), 석주 밑동이 웅덩이에 닿는 두 곳(북서·남동)에만 붉은 산호 무리, 벽엔 해초가 늘어졌다",
  };
}

function hall() {
  const W = 40, H = 28;
  return {
    id: "dungeon-sunken-hall", name: "해저 신전 · 산호 기둥 대전", theme: "hall", series: "sunken", dress: "sea", groves: 0, heaps: 0, room: 2, tileset: "oprn_dungeon_sea",
    art: grid(W, H, [
      [".", 3, 3, 36, 26], // 대전
      [".", 18, 26, 21, 27], // 남쪽 문 틈 → 입구 회랑
      ["q", 16, 5, 23, 26], // 가운데 넓은 신랑(무늬 석판)
      ["q", 10, 25, 29, 26], // 남쪽 끝 가로 회랑(신랑에서 양쪽 물길 끝까지, 무늬 석판)
      ["~", 7, 7, 9, 24], ["~", 30, 7, 32, 24], // 잠긴 옆 복도 두 줄(물길)
      ["=", 7, 15, 9, 16], ["=", 30, 15, 32, 16], // 옆방으로 건너는 판자 다리
      ["q", 3, 11, 6, 19], // 서쪽 옆방 여신상 앞 무늬 석판(작은 제단 자리)
      ["W", 33, 18, 36, 24, { blob: 29, wobble: 0.12 }], ["W", 34, 6, 36, 11, { blob: 53, wobble: 0.12 }], ["W", 3, 7, 5, 10, { blob: 59, wobble: 0.12 }], ["W", 3, 21, 5, 25, { blob: 61, wobble: 0.12 }], // 옆방 무너진 바닥(동 둘, 서 둘)
      // 신랑과 석주 줄 사이 바닥이 꺼져 물이 찬 곳(좌우 엇갈림)
      ["W", 13, 7, 16, 12, { blob: 37, wobble: 0.1 }], ["W", 13, 18, 16, 23, { blob: 41, wobble: 0.1 }], ["W", 23, 12, 26, 17, { blob: 43, wobble: 0.1 }], ["W", 22, 21, 26, 25, { blob: 47, wobble: 0.1 }],
    ]),
    props: [
      // 신랑 양옆 석주 줄
      ["I", 12, 6], ["I", 27, 6], ["I", 12, 10], ["I", 27, 10], ["I", 12, 14], ["I", 27, 14], ["I", 12, 18], ["I", 27, 18], ["I", 12, 22], ["I", 27, 22],
      // 신랑 끝 북쪽 벽 석조 아치(→ 제단실)와 양옆 여신상 둘
      ["A", 18, 3], ["S", 16, 5], ["S", 23, 5],
      // 여신상 곁 공물 항아리 한 쌍씩
      ["J", 14, 6], ["J", 15, 6], ["J", 24, 6], ["J", 25, 6],
      // 산호는 석주 밑동이 물에 닿는 곳에만: 서쪽 물길 곁, 동쪽 물길 곁, 두 웅덩이 사이
      ["B", 10, 8], ["q", 11, 10],
      ["B", 28, 20], ["q", 28, 19],
      ["B", 24, 18],
      // 서쪽 옆방: 여신상 앞 보물상자와 항아리(다리 건너 보상)
      ["S", 4, 12], ["H", 4, 15], ["J", 5, 17], ["J", 4, 18],
      // 동쪽 옆방: 무너진 바닥 사이 쓰러진 석주 잔돌과 그 위에 자란 산호(한 무더기)
      ["B", 34, 13], ["q", 36, 13], ["U", 35, 15],
      // 벽 해초
      ["V", 6, 4], ["W", 10, 4], ["V", 29, 4], ["W", 33, 4], ["y", 25, 3],
    ],
    entry: [19, 27],
    targets: [[19, 5], [4, 16], [35, 16], [8, 16], [31, 16]],
    exits: [{ at: [19, 27], to: "dungeon-sunken-gate", arrive: [17, 5], note: "남쪽 문 틈 → 입구 회랑" }, { at: [19, 5], to: "dungeon-sunken-altar", arrive: [16, 23], note: "북쪽 벽 아치 → 바다 여신 제단" }],
    note: "석주 열 개가 두 줄로 선 대전. 가운데 무늬 석판 신랑이 남쪽 문 틈에서 북쪽 벽의 석조 아치까지 곧게 지나고 아치 양옆을 여신상 둘(곁에 공물 항아리 한 쌍씩)이 지킨다. 남쪽 끝은 무늬 석판 가로 회랑이 양쪽 물길 끝까지 잇는다. 신랑과 석주 줄 사이 바닥은 군데군데 꺼져 물이 찼고, 석주 밑동이 물에 닿는 세 곳에만 산호가 자랐다. 양쪽 옆 복도는 물에 잠긴 물길이라 판자 다리로 건너 옆방에 간다. 서쪽 옆방엔 물이 찬 두 웅덩이 사이 무늬 석판 작은 제단 자리에 여신상과 그 앞 보물상자·항아리, 동쪽 옆방은 바닥이 무너져 물이 찼고 그 사이 쓰러진 석주 잔돌 위에 산호가 한 무더기 자랐다",
  };
}

function altar() {
  const W = 34, H = 24;
  return {
    id: "dungeon-sunken-altar", name: "해저 신전 · 바다 여신 제단", theme: "hall", series: "sunken", dress: "sea", groves: 0, heaps: 0, room: 3, tileset: "oprn_dungeon_sea",
    art: grid(W, H, [
      [".", 4, 3, 29, 22], // 제단실
      [".", 15, 22, 18, 23], // 남쪽 문 틈 → 대전
      ["W", 8, 6, 25, 19, { blob: 71, wobble: 0.1 }], // 제단 섬을 두른 물 해자(바위 기슭, 둥근 몸)
      ["q", 11, 8, 22, 16, { blob: 73, wobble: 0.08 }], // 제단 섬(무늬 석판 바닥, 둥근 섬)
      ["%", 16, 16, 17, 18], // 해자 남쪽 판자 다리
      ["q", 10, 20, 23, 22], // 다리 앞 앞마당(무늬 석판, 가고일 둘이 선다)
      ["q", 16, 19, 17, 19], // 다리 끝 참배길
    ]),
    props: [
      // 제단: 여신상 둘 사이 마법진, 뒤에 공물 상자
      ["S", 12, 10], ["S", 21, 10], ["N", 15, 12], ["H", 16, 10],
      // 해자 바깥을 두른 석주 여섯(네 모서리 + 동서 가운데)과 다리 앞 가고일
      ["I", 6, 6], ["I", 27, 6], ["I", 5, 12], ["I", 28, 12], ["I", 6, 18], ["I", 27, 18], ["G", 13, 20], ["G", 20, 20],
      // 산호: 해자 기슭과 석주 밑동이 만나는 두 곳에만(북동·남서)
      ["B", 25, 8], ["q", 27, 8],
      ["B", 6, 15], ["q", 6, 17],
      // 벽 해초·석판
      ["V", 7, 4], ["W", 11, 4], ["p", 16, 3], ["V", 22, 4], ["W", 26, 4],
    ],
    entry: [16, 23],
    keeper: [16, 15],
    targets: [[16, 15], [16, 11], [5, 20], [28, 20]],
    exits: [{ at: [16, 23], to: "dungeon-sunken-hall", arrive: [19, 5], note: "남쪽 문 틈 → 산호 기둥 대전" }],
    note: "신전 맨 안쪽 제단실. 바위 기슭의 둥근 물 해자가 무늬 석판 섬을 두르고 남쪽 판자 다리 하나로만 건넌다. 무늬 석판 섬 위엔 바다 여신상 둘 사이에 붉은 마법진, 그 뒤에 공물 상자가 놓였다(보스 자리 keeper는 다리 끝). 해자 바깥을 석주 여섯이 두르고, 다리 앞 무늬 석판 앞마당에 가고일 둘, 해자 기슭이 석주에 닿는 두 모서리엔 산호 무리, 북쪽 벽엔 해초와 석판",
  };
}
