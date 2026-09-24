// Three-floor tower + roof on one compact octagonal shell (18×16). The only straight wall is the north one
// (x5~12); every staircase sits on it, never in the clipped corners:
//   up   = stone steps climbing the two-row wall face (3 wide),
//   down = the same steps sunk in the floor under the north wall, an iron rail on their far side.
// The floors stack: a floor's up stairs (x5~7 or x10~12) is where the next floor's down stairs are laid, so
// arriving upstairs you step off at the same x, one landing south of the rail.
//   1F up x5~7 → 2F down x5~7 · 2F up x10~12 → 3F down x10~12 · 3F up x5~7 → roof down x5~7.
// Built rooms get no scattered filler: carpets are runners along the walking line, furniture is placed by hand
// in groups that have a use (reading table with its chairs, bed with its side table, desk with its stool).
import { grid } from "./kit.mjs";

const W = 18, H = 16;
// x5~12 open from y1 (face y1~2), x3~4/x13~14 from y2 (face y2~3), x2/x15 from y4 (face y4~5).
const SHELL = [[".", 5, 1, 12, 14], [".", 3, 2, 14, 13], [".", 2, 4, 15, 11]];
const shell = (extra = []) => grid(W, H, [...SHELL, ...extra]);

/** Roof: the same octagon with no walls; its outer ring is a crenellated parapet, void beyond. */
function roofArt(extra) {
  const rows = shell(extra).split("\n").filter((r) => r.length).map((r) => [...r]);
  const open = (x, y) => y >= 0 && x >= 0 && y < H && x < W && rows[y][x] !== "#";
  const ring = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!open(x, y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([a, b]) => !open(x + a, y + b))) ring.push([x, y]);
  }
  for (const [x, y] of ring) rows[y][x] = "m";
  return "\n" + rows.map((r) => r.join("")).join("\n") + "\n";
}

export function towerPlans() {
  return [
    {
      id: "dungeon-tower-1f", name: "마법사 탑 · 1층 입구 홀", theme: "hall", series: "tower", dress: "tower", storey: 1,
      art: shell([[".", 8, 14, 9, 15], ["r", 8, 6, 9, 15], ["r", 5, 6, 9, 7], ["r", 5, 3, 6, 7]]),
      props: [
        ["^", 5, 1], ["T", 8, 3], ["b", 10, 1], ["b", 11, 1], ["b", 12, 1], ["p", 9, 2],
        ["I", 3, 4], ["I", 14, 4], ["I", 3, 11], ["I", 14, 11], ["G", 7, 12], ["G", 10, 12],
        ["N", 11, 5], ["S", 2, 7], ["S", 15, 8], ["s", 11, 13], ["T", 5, 9], ["T", 12, 9], ["b", 4, 2],
      ],
      entry: [8, 15], targets: [[6, 3], [12, 8], [3, 9]],
      exits: [{ at: [6, 2], to: "dungeon-tower-2f", arrive: [6, 6], note: "북쪽 벽 서쪽 돌계단 → 2층" }, { at: [8, 15], to: "outside", note: "남쪽 문 → 탑 밖" }],
      note: "팔각 탑의 1층 입구 홀. 남쪽 문에서 붉은 카펫이 북쪽으로 올라가 서쪽으로 꺾여 북쪽 벽의 오르는 돌계단(x5~7)에 닿는다. 계단 옆 화로, 북쪽 벽 동쪽은 책장 셋, 동쪽 바닥엔 수호 마법진, 팔각 모서리마다 석주, 문 안쪽 가고일 둘, 서·동 벽에 여신상",
    },
    {
      id: "dungeon-tower-2f", name: "마법사 탑 · 2층 서고", theme: "hall", series: "tower", dress: "tower", storey: 2,
      art: shell([["r", 5, 6, 12, 7], ["r", 11, 3, 12, 7], ["r", 2, 9, 6, 12]]),
      props: [
        ["-", 5, 3], ["_", 5, 4], ["^", 10, 1], ["b", 8, 1], ["b", 9, 1],
        ["b", 13, 9], ["b", 14, 9], ["b", 13, 12], ["b", 14, 12], ["b", 9, 10], ["b", 10, 10],
        ["t", 3, 10], ["(", 2, 10], [")", 6, 10], ["c", 8, 13], ["v", 7, 13], ["v", 9, 13],
        ["T", 4, 4], ["T", 13, 5],
      ],
      entry: [6, 6], targets: [[11, 3], [15, 10], [4, 12], [11, 13]],
      exits: [{ at: [6, 5], to: "dungeon-tower-1f", arrive: [6, 3], note: "내려가는 돌계단(x5~7) → 1층" }, { at: [11, 2], to: "dungeon-tower-3f", arrive: [11, 6], note: "북쪽 벽 동쪽 돌계단 → 3층" }],
      note: "서고 층. 1층에서 올라오면 북쪽 벽 서쪽의 내려가는 돌계단(난간 뒤) 앞에 선다. 붉은 카펫이 동쪽으로 가서 북쪽 벽 동쪽의 오르는 돌계단(x10~12)으로 꺾인다. 북쪽 벽 가운데 책장, 동쪽과 남쪽 바닥은 서가 세 줄(사이 통로), 서쪽 붉은 러그 위 독서 탁자와 의자 둘, 남쪽 둥근 탁자와 걸상 둘",
    },
    {
      id: "dungeon-tower-3f", name: "마법사 탑 · 3층 마법사의 방", theme: "hall", series: "tower", dress: "tower", storey: 3,
      art: shell([["r", 6, 8, 10, 12], ["r", 5, 6, 12, 7], ["r", 5, 3, 6, 7]]),
      props: [
        ["-", 10, 3], ["_", 10, 4], ["^", 5, 1], ["b", 8, 1], ["b", 9, 1],
        ["N", 7, 9], ["T", 5, 10], ["T", 11, 10],
        ["}", 14, 8], ["c", 15, 10], ["t", 2, 11], ["v", 3, 12], ["b", 3, 2], ["b", 4, 2], ["b", 13, 11], ["b", 14, 11],
      ],
      entry: [11, 6], targets: [[6, 3], [8, 13], [3, 10], [15, 9]],
      exits: [{ at: [11, 5], to: "dungeon-tower-2f", arrive: [11, 3], note: "내려가는 돌계단(x10~12) → 2층" }, { at: [6, 2], to: "dungeon-tower-roof", arrive: [6, 6], note: "북쪽 벽 서쪽 돌계단 → 옥상" }],
      note: "탑 주인의 방. 2층에서 오르면 북쪽 벽 동쪽 내려가는 돌계단 앞, 카펫이 서쪽으로 가 북쪽 벽 서쪽의 옥상 돌계단(x5~7)에 닿는다. 가운데 붉은 러그 위 마법진과 화로 둘, 동쪽 벽 아래 침대와 둥근 협탁, 서쪽 벽 아래 필기 책상과 걸상, 북서쪽 책장, 남동쪽 책장 둘",
    },
    {
      id: "dungeon-tower-roof", name: "마법사 탑 · 옥상", theme: "hall", series: "tower", dress: "tower", storey: 4, wall: [],
      art: roofArt([["q", 4, 6, 13, 12]]),
      props: [["-", 5, 3], ["_", 5, 4], ["N", 7, 9], ["I", 4, 8], ["I", 13, 8], ["G", 4, 11], ["G", 13, 11], ["S", 9, 3], ["S", 12, 3]],
      entry: [6, 6], targets: [[8, 12], [3, 9], [13, 5]],
      exits: [{ at: [6, 5], to: "dungeon-tower-3f", arrive: [6, 3], note: "내려가는 돌계단(x5~7) → 3층" }],
      note: "하늘로 트인 탑 꼭대기. 가장자리를 흉벽이 두르고 그 너머는 허공이다. 3층에서 오르면 북쪽의 내려가는 돌계단(난간 뒤) 앞, 가운데 동심 석판 위 별 보는 마법진과 양옆 석주 둘. 벽·카펫·횃불 없음",
    },
  ];
}
