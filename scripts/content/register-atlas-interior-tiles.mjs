// Register the atlas interior rows (tiles 2070..2159, baked by bake-atlas-interior-tiles.py) on the bundled Tibo
// tileset definition src/assets/tiboRecoveredTileset.json: count, walkability, layer, labels, tile groups and
// structure kits (so the assistant can stamp the multi-tile objects by id). Also states the facing of the sheet's own
// front-view pew (1814~1847) so nobody seats a congregation with its back to the altar again.
// Existing projects grow to the new count (tiles and kits) through extendTiboInteriorDefaults.
// Idempotent. Usage: node scripts/content/register-atlas-interior-tiles.mjs
import fs from "node:fs";

const FILE = "src/assets/tiboRecoveredTileset.json";
const t = JSON.parse(fs.readFileSync(FILE, "utf8"));
const FIRST = 2070, COUNT = 2160;
const solid = { up: false, down: false, left: false, right: false }, open = { up: true, down: true, left: true, right: true };
const thing = (label, tags, description, extra = {}) => ({ role: "object", tags: [label, ...tags, "실내"], label, source: "bundled-default", passage: "solid", confidence: "high", description, defaultLayer: "upper", repeatability: "unique", ...extra });
const cells = {};   // n → [meta, passability, priority]
const piece = (first, w, h, name, tags, description, opts = {}) => {
  const names = h === 1 ? (w === 1 ? [""] : w === 3 ? ["왼끝", "가운데", "오른끝"] : Array.from({ length: w }, (_, i) => `${i + 1}열`))
    : Array.from({ length: w * h }, (_, i) => `${Math.floor(i / w) + 1}행 ${i % w + 1}열`);
  for (let i = 0; i < w * h; i++) {
    const label = names[i] ? `${name} ${names[i]}` : name;
    cells[first + i] = [thing(label, tags, description, opts.meta ?? {}), opts.open ? open : solid, opts.lower ? "lower" : "upper"];
  }
};
const PEW_BACK = "뒷모습 긴 의자 — 앉은 사람이 북쪽(제단·무대)을 본다. 등받이 뒤판과 찬송가 선반이 보이는 그림. 교회·대성당·경매장·강당의 신자석은 이것을 제단 쪽으로 줄지어 둔다(시트의 1814~1847 긴 의자는 앞모습이라 남쪽을 보고 앉는다)";
piece(2070, 4, 2, "뒷모습 긴 의자(4칸)", ["pew", "긴 의자", "교회", "성당", "뒷모습", "북쪽을 봄"], PEW_BACK);
piece(2078, 3, 2, "뒷모습 긴 의자(3칸)", ["pew", "긴 의자", "교회", "예배당", "뒷모습", "북쪽을 봄"], PEW_BACK + ". 좁은 예배당·옆 통로용 3칸 폭");
const BARS = "쇠창살 칸막이. 바닥 한 줄에 왼끝·가운데(되풀이)·오른끝으로 세운다(윗층, 막힘). 창살 문 2087은 가운데 조각 자리에 하나. 감옥 감방 앞·경비대 유치장·금고 앞";
cells[2084] = [thing("쇠창살 왼끝", ["iron bars", "창살", "감옥", "감방"], BARS), solid, "upper"];
cells[2085] = [thing("쇠창살 가운데", ["iron bars", "창살", "감옥", "감방"], BARS, { repeatability: "repeat" }), solid, "upper"];
cells[2086] = [thing("쇠창살 오른끝", ["iron bars", "창살", "감옥", "감방"], BARS), solid, "upper"];
cells[2087] = [thing("쇠창살 문", ["iron bar door", "창살 문", "감옥", "자물쇠"], BARS), solid, "upper"];
piece(2088, 2, 2, "둥근 금고 문", ["vault door", "금고", "은행", "강철"], "2×2 둥근 강철 금고 문. 벽면 두 줄(윗줄·아랫줄)에 거는 벽걸이 — 은행·보물고 뒷벽. 바닥에 두지 않는다", { open: true, meta: { passage: "passable", role: "prop" } });
piece(2092, 3, 2, "칠판", ["blackboard", "칠판", "학교", "교실", "학원"], "3×2 분필 글씨 칠판과 분필 받침. 벽면 두 줄에 거는 벽걸이 — 교실·학원·길드 회의실 앞벽. 학생 책상은 칠판을 보게(뒷모습 의자 268) 줄지어 둔다", { open: true, meta: { passage: "passable", role: "prop" } });
piece(2100, 3, 2, "보석 진열 카운터", ["jewel counter", "보석", "진열장", "보석상", "카운터"], "3×2 유리 뚜껑 아래 붉은 벨벳 위 반지·보석을 늘어놓은 카운터. 보석상 점원은 카운터 뒤(북쪽)에 선다");
piece(2106, 2, 2, "룰렛 탁자", ["roulette", "룰렛", "카지노", "도박"], "2×2 초록 천 룰렛 탁자(바퀴·걸기 칸). 카지노 홀 가운데, 둘레에 의자를 탁자 쪽으로 둔다");
piece(2110, 4, 3, "돌 욕조", ["bath", "목욕탕", "욕조", "온천", "김"], "4×3 김이 오르는 돌 욕조. 목욕탕·온천 실내 바닥에 두고 곁에 나무 욕조·바가지·수건을 모은다");
piece(2122, 2, 2, "고기 걸이", ["meat rack", "정육", "고기", "햄", "푸줏간"], "2×2 햄과 고깃덩이를 매단 나무 걸이. 정육점 카운터 뒤·뒷벽 앞 바닥에");
piece(2126, 2, 2, "가죽 건조틀", ["hide frame", "가죽", "무두질", "공방", "사냥꾼"], "2×2 나무 틀에 끈으로 당겨 맨 짐승 가죽. 가죽 공방·사냥꾼 오두막 벽 곁 바닥에");
const STAGE = "무대 앞면. 무대 바닥은 널 102로 깔고, 그 남쪽 첫 줄을 이 앞면(왼끝·가운데 되풀이·오른끝, 아래층·막힘)으로 닫는다. 오르는 자리는 무대 계단 2133 한 칸";
cells[2130] = [{ ...thing("무대 앞면 왼끝", ["stage", "무대", "극장", "강당"], STAGE), role: "wall", defaultLayer: "lower" }, solid, "lower"];
cells[2131] = [{ ...thing("무대 앞면 가운데", ["stage", "무대", "극장", "강당"], STAGE, { repeatability: "repeat" }), role: "wall", defaultLayer: "lower" }, solid, "lower"];
cells[2132] = [{ ...thing("무대 앞면 오른끝", ["stage", "무대", "극장", "강당"], STAGE), role: "wall", defaultLayer: "lower" }, solid, "lower"];
cells[2133] = [{ ...thing("무대 계단", ["stage steps", "무대", "계단", "극장"], STAGE), role: "terrain", passage: "passable", defaultLayer: "lower" }, open, "lower"];
piece(2134, 3, 2, "창구 카운터(창살)", ["teller counter", "은행", "창구", "창살", "카운터"], "3×2 쇠창살과 둥근 창구가 달린 은행 카운터(동전 쟁반·종). 창구 직원은 카운터 뒤(북쪽)에, 손님은 앞(남쪽)에 선다");

const UPPER_KIT = (id, name, first, w, h, desc) => ({
  ai: { snap: "floor", tags: ["실내 확장", "Tibo", "소품", "아틀라스 실내"], origin: "ai", themes: ["storage", "tavern", "study"], layerHome: "upper", description: desc, repeatability: "fixed", placementRules: desc },
  id, kind: "section", name,
  rows: Array.from({ length: h }, (_, y) => ({ tiles: Array(w).fill(-1), upperTiles: Array.from({ length: w }, (_, x) => first + y * w + x) })),
  width: w, height: h, learnedFrom: "atlas-interiors",
});
const kits = [
  UPPER_KIT("tibo-atlas-pew-back", "뒷모습 긴 의자(북쪽을 봄)", 2070, 4, 2, PEW_BACK),
  UPPER_KIT("tibo-atlas-pew-back-3", "뒷모습 긴 의자 3칸(북쪽을 봄)", 2078, 3, 2, PEW_BACK),
  UPPER_KIT("tibo-atlas-vault-door", "둥근 금고 문", 2088, 2, 2, "벽면 두 줄에 거는 2×2 강철 금고 문"),
  UPPER_KIT("tibo-atlas-blackboard", "칠판", 2092, 3, 2, "벽면 두 줄에 거는 3×2 칠판"),
  UPPER_KIT("tibo-atlas-jewel-counter", "보석 진열 카운터", 2100, 3, 2, "3×2 보석 진열 카운터, 점원은 북쪽"),
  UPPER_KIT("tibo-atlas-roulette", "룰렛 탁자", 2106, 2, 2, "2×2 룰렛 탁자"),
  UPPER_KIT("tibo-atlas-bath", "돌 욕조", 2110, 4, 3, "4×3 김 오르는 돌 욕조"),
  UPPER_KIT("tibo-atlas-meat-rack", "고기 걸이", 2122, 2, 2, "2×2 햄·고깃덩이 걸이"),
  UPPER_KIT("tibo-atlas-hide-frame", "가죽 건조틀", 2126, 2, 2, "2×2 가죽 건조틀"),
  UPPER_KIT("tibo-atlas-teller-counter", "창구 카운터(창살)", 2134, 3, 2, "3×2 은행 창구 카운터, 직원은 북쪽"),
];

for (let n = FIRST; n < COUNT; n++) {
  const [meta, pass, pri] = cells[n] ?? [{ label: "", source: "bundled-default", description: "", defaultLayer: "upper" }, open, "upper"];
  t.terrain[n] = 0;
  t.priority[n] = pri;
  t.passability[n] = pass;
  t.tileMeta[n] = meta;
}
t.count = COUNT;
// The sheet's own pew is the front view: say so on its cells and kit.
const FRONT = "앞모습 긴 의자 — 앉은 사람이 남쪽(보는 사람 쪽)을 본다. 제단·무대를 북쪽에 둔 방의 신자석으로 쓰지 않는다(뒷모습 긴 의자 2070~2077/2078~2083을 쓴다). 무대가 남쪽에 있는 방·벽을 등진 대기석용";
for (const n of [1814, 1815, 1816, 1817, 1844, 1845, 1846, 1847]) Object.assign(t.tileMeta[n], { label: "긴 의자(앞모습·남쪽을 봄)", description: FRONT });
const pew = t.structureKits.find((k) => k.id === "tibo-fantasy-pew");
Object.assign(pew, { name: "긴 의자(앞모습·남쪽을 봄)" });
Object.assign(pew.ai, { description: FRONT, placementRules: FRONT });
for (const k of kits) {
  const i = t.structureKits.findIndex((x) => x.id === k.id);
  if (i >= 0) t.structureKits[i] = k; else t.structureKits.push(k);
}
const groups = [
  { id: "atlas-pew-back", name: "뒷모습 긴 의자", tileIds: [2070, 2071, 2072, 2073, 2074, 2075, 2076, 2077, 2078, 2079, 2080, 2081, 2082, 2083], role: "object", description: "4×2(2070~2073 / 2074~2077)와 3×2(2078~2080 / 2081~2083). 앉은 사람이 북쪽을 본다 — 제단·설교대·무대가 북쪽이면 신자석은 모두 이것. 줄 사이 한 칸을 비워 드나들게 하고, 가운데 통로를 둔다." },
  { id: "atlas-iron-bars", name: "쇠창살", tileIds: [2084, 2085, 2086, 2087], role: "object", description: "바닥 한 줄에 2084 왼끝 · 2085 가운데 되풀이 · 2086 오른끝, 문은 가운데 자리에 2087 하나. 윗층·막힘. 창살 뒤 감방은 통행 검사에서 일부러 닫은 곳으로 뺀다." },
  { id: "atlas-vault-door", name: "둥근 금고 문", tileIds: [2088, 2089, 2090, 2091], role: "object", description: "2×2 벽걸이(2088 2089 / 2090 2091). 윗줄을 벽면 윗줄, 아랫줄을 벽면 아랫줄에. 은행·보물고 뒷벽." },
  { id: "atlas-blackboard", name: "칠판", tileIds: [2092, 2093, 2094, 2095, 2096, 2097], role: "object", description: "3×2 벽걸이(2092~2094 / 2095~2097). 교실 앞벽 벽면 두 줄에. 교사 책상은 칠판 앞, 학생 자리는 뒷모습 의자 268로 칠판을 보게." },
  { id: "atlas-shop-counters", name: "보석·창구 카운터", tileIds: [2100, 2101, 2102, 2103, 2104, 2105, 2134, 2135, 2136, 2137, 2138, 2139], role: "object", description: "3×2 카운터 둘: 보석 진열 카운터 2100~2105, 은행 창구 카운터(창살) 2134~2139. 점원·직원은 카운터 뒤(북쪽) 바닥 한 줄에 서고 그 뒤 벽에 진열장·금고 문." },
  { id: "atlas-leisure-bath", name: "룰렛·돌 욕조", tileIds: [2106, 2107, 2108, 2109, 2110, 2111, 2112, 2113, 2114, 2115, 2116, 2117, 2118, 2119, 2120, 2121], role: "object", description: "룰렛 탁자 2×2(2106 2107 / 2108 2109), 돌 욕조 4×3(2110~2113 / 2114~2117 / 2118~2121). 욕조 곁에 나무 욕조·바가지·수건, 룰렛 둘레에 의자를 탁자 쪽으로." },
  { id: "atlas-trade-racks", name: "고기 걸이·가죽 건조틀", tileIds: [2122, 2123, 2124, 2125, 2126, 2127, 2128, 2129], role: "object", description: "2×2 바닥 소품: 고기 걸이 2122~2125(정육점), 가죽 건조틀 2126~2129(가죽 공방·사냥꾼)." },
  { id: "atlas-stage", name: "무대 앞면·계단", tileIds: [2130, 2131, 2132, 2133], role: "terrain", description: "무대 바닥은 널 102. 남쪽 끝 줄을 2130 왼끝 · 2131 가운데 · 2132 오른끝으로 닫고(아래층·막힘), 오르는 자리 한 칸에 계단 2133(아래층·통행). 객석은 뒷모습 의자 268·뒷모습 긴 의자로 무대를 보게." },
];
for (const g of groups) {
  const full = { ...g, source: "bundled-default", confidence: "high", defaultLayer: g.role === "object" ? "upper" : "lower", placementRules: g.description };
  const i = t.tileGroups.findIndex((x) => x.id === g.id);
  if (i >= 0) t.tileGroups[i] = full; else t.tileGroups.push(full);
}
fs.writeFileSync(FILE, JSON.stringify(t, null, 2) + "\n");
console.log({ count: t.count, kits: kits.length, groups: groups.length });
