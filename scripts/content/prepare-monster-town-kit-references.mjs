// 몬스터 마을 부품 칩셋의 AI 참고문서를 만든다(번들 소유 — AGENTS 「새 타일·타일 학습은 공용에 추가한다」).
//
// 입력:
//   src/assets/monsterTownKitManifest.json   부품 블록 좌표(scripts/content/build-monster-town-kit.py 출력)
//   src/assets/scarloxyPackManifest.json     위 반쪽(초원 마을) 블록 좌표
//   .omo/tmp/pkmn-maps.json                  포켓몬풍 데모 마을·1번 길의 실제 배열(선택, 없으면 예제 배열 생략)
//                                            ← node_modules/.bin/vite-node --root . scripts/content/dump-pokemon-demo-maps.mts
// 출력:
//   src/assets/monsterTownKitReferences.json          참고문서 카테고리 1개(이미지는 /assets/... 경로)
//   public/assets/monster-town-kit/references/*.png   실제 타일로 합성한 정상/오류 그림
//
// 그림은 전부 시트의 실제 칸을 nearest 로 붙여 만든다(AI 가 그린 모형이 아니다).
// 실행: node scripts/content/prepare-monster-town-kit-references.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const KIT = JSON.parse(fs.readFileSync("src/assets/monsterTownKitManifest.json", "utf8"));
const PACK = JSON.parse(fs.readFileSync("src/assets/scarloxyPackManifest.json", "utf8"));
const MAPS_PATH = ".omo/tmp/pkmn-maps.json";
const OUT_JSON = "src/assets/monsterTownKitReferences.json";
const IMG_DIR = "public/assets/monster-town-kit/references";
const TILESET_ID = "scarloxy_chipset_monster_town_kit";
const COLS = 30;

const tileOf = (b, dx = 0, dy = 0) => (b.row + dy) * COLS + b.col + dx;
const grid = (b) => Array.from({ length: b.h }, (_, dy) => Array.from({ length: b.w }, (_, dx) => tileOf(b, dx, dy)));
const kit = Object.fromEntries(KIT.blocks.map((b) => [b.name, b]));
const base = Object.fromEntries(PACK.chipsets[0].blocks.map((b) => [b.name, b]));

const KIT_ROLES = {
  "item-shop": ["도구 상점", "3층(상위)", "×", "6×6 고정. 문은 맨 아래 줄 가운데 두 칸(dx 2~3)."],
  "research-lab": ["연구소", "3층", "×", "8×6 고정. 문은 맨 아래 줄 가운데 두 칸(dx 3~4)."],
  "cave-entrance": ["동굴 입구", "3층", "×", "5×4 고정. 구멍은 맨 아래 줄 가운데(dx 2)."],
  signpost: ["나무 표지판", "3층", "×", "1×1. 같은 칸에 조사 이벤트(글)를 둔다."],
  mailbox: ["우체통", "3층", "×", "1×1. 집 문 옆."],
  "cuttable-shrub": ["베는 나무", "3층", "×", "1×1. 길목을 막는 이벤트 그림으로도 쓴다."],
  boulder: ["밀 수 있는 바위", "3층", "×", "1×1. 힘 퍼즐 이벤트 그림으로도 쓴다."],
  crate: ["나무 상자", "3층", "×", "1×1."],
  "flower-planter": ["꽃 화단", "3층", "×", "2×1 고정(왼·오 순서)."],
  bench: ["흰 벤치", "3층", "×", "2×1 고정(왼·오 순서)."],
  "street-lamp": ["가로등", "3층", "×", "1×2 고정. 위 칸(머리)·아래 칸(기둥) 순서."],
  "tall-grass-a": ["조우 풀숲 A", "3층", "○", "1×1 반복. B 와 체크무늬((x+y)%2)로 섞는다."],
  "tall-grass-b": ["조우 풀숲 B", "3층", "○", "1×1 반복."],
  "picket-fence": ["흰 울타리", "3층", "×", "2칸 조각(왼·오)을 가로로 반복."],
  "fence-post": ["울타리 기둥", "3층", "×", "울타리 줄의 오른쪽 끝 한 칸을 덮는다."],
  "grass-ledge": ["풀밭 턱", "3층", "○", "3칸 조각(왼·가운데·오)을 가로로 반복. 칸마다 점프 이벤트."],
  "plank-bridge": ["나무 다리", "3층", "○", "2칸 조각을 물 위 가로로 반복."],
};

function dictionary() {
  const rows = KIT.blocks.map((b) => {
    const [name, layer, pass, rule] = KIT_ROLES[b.name] ?? [b.name, "3층", "?", ""];
    return `| ${b.name} | ${name} | ${b.col},${b.row} | ${b.w}×${b.h} | ${tileOf(b)}~${tileOf(b, b.w - 1, b.h - 1)} | ${layer} | ${pass} | ${rule} |`;
  });
  const kitJson = Object.fromEntries(KIT.blocks.map((b) => [b.name, grid(b)]));
  const baseUse = ["grass-terrain", "green-tree", "teal-tree", "green-tree-small", "grass-tuft", "grass-rock-1", "house-small", "house-small-alt", "hospital", "coast-pond-grass"];
  const baseJson = Object.fromEntries(baseUse.filter((n) => base[n]).map((n) => [n, grid(base[n])]));
  return [
    "# 몬스터 마을 부품 · 칸 사전",
    "",
    `tilesetId=${TILESET_ID}. 이미지 tex_scarloxy_chipset_monster_town_kit (public/assets/monster-town-kit/monster-town-kit.png, 480×512).`,
    "16px 칸, 30열, 960칸. 좌표·번호는 0기준, 번호 = 행×30 + 열.",
    "",
    "## 두 반쪽",
    "- **0~479 = Scarloxy 초원 마을 시트 그대로.** scarloxy_chipset_grassland 와 번호가 같다(잔디 124, 집, 센터, 나무, 연못).",
    "- **480~959 = 새 부품(생성 자산).** 모든 부품은 가장자리가 투명하므로 **3층(상위)**에 두고 1층에는 잔디 124 를 깐다. 1층에 부품을 두면 투명 픽셀 아래가 검게 보인다.",
    "- 다른 Scarloxy 시트(wilds·indoor)나 합본 마을의 번호를 섞지 않는다.",
    "",
    "## 부품 표 (○ 통행 가능, × 막힘)",
    "| 블록 | 이름 | 원점 열,행 | 크기 | 칸 번호 | 층 | 통행 | 규칙 |",
    "|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
    "## 부품 전체 배열 (행 우선, 3층)",
    "```json",
    JSON.stringify(kitJson),
    "```",
    "",
    "## 위 반쪽에서 함께 쓰는 블록 (1층 잔디 외에는 3층)",
    "```json",
    JSON.stringify(baseJson),
    "```",
    "잔디 몸통은 124(grass-terrain 블록 안 평지). 9·39·69 열은 빈 투명 칸이라 쓰지 않는다.",
  ].join("\n");
}

function steps() {
  const shop = kit["item-shop"], lab = kit["research-lab"], cave = kit["cave-entrance"];
  return [
    "# 몬스터 마을·도로 조립 순서",
    "",
    "tilesetId=scarloxy_chipset_monster_town_kit. 번호는 「칸 사전」과 같다.",
    "",
    "## 1. 바닥",
    "1층 전체를 잔디 124 로 채운다. 연못은 coast-pond-grass 3×3 을 1층에 도장한다.",
    "",
    "## 2. 건물 (3층, 블록 통째로)",
    `- 도구 상점 ${shop.w}×${shop.h}: 원점 (X,Y) 에 부품 배열을 그대로 찍는다. 문 = (X+2..X+3, Y+${shop.h - 1}). **문 아래 칸 (X+2, Y+${shop.h})** 이 접근칸이며 여기에 장소 이동 이벤트를 둔다.`,
    `- 연구소 ${lab.w}×${lab.h}: 문 = (X+3..X+4, Y+${lab.h - 1}), 접근칸 (X+3, Y+${lab.h}).`,
    "- 초원 시트의 집(house-small 5×5, 문 dx 1) · 센터(hospital 6×6, 문 dx 2~3) 도 같은 규칙.",
    "- 건물끼리 1칸 이상 띄운다. 접근칸과 그 아래 한 칸은 비워 길로 잇는다.",
    "",
    "## 3. 조우 풀숲 (3층, 반복)",
    "- 사각형 (x0,y0,w,h) 안의 빈 칸마다 (x+y)%2==0 이면 풀숲 A, 아니면 풀숲 B.",
    "- 최소 3×2. 나무·바위 칸은 건너뛴다. 길(주인공이 지나는 최단 경로)을 전부 덮지 않는다 — 풀숲을 피해 갈 길을 한 줄 남긴다.",
    "- **조우는 타일이 아니라 맵의 조우표**로 건다: encounterTable 항목마다 conditions.region = 풀숲 사각형. 이렇게 해야 풀숲 밖에서는 야생이 나오지 않는다.",
    "",
    "## 4. 울타리 (3층, 반복)",
    "- 가로 줄 x0..x1: x 마다 picket-fence[(x−x0)%2], 마지막 칸 x1 은 fence-post.",
    "- 마을 출구는 울타리를 끊어 2칸 이상 연다. 출구 칸에 장소 이동 이벤트.",
    "",
    "## 5. 풀밭 턱 (3층, 반복 + 이벤트)",
    "- 가로 줄: x 마다 grass-ledge[(x−x0)%3]. 통행 가능(○).",
    "- 칸마다 playerTouch 이벤트 한 개: 주인공을 dy=+2 로 점프(moveEvent PLAYER_MOVE_TARGET, jump). 아래에서 밟아도 아래로 튕겨 한 방향이 된다.",
    "",
    "## 6. 소품",
    "- 표지판·우체통·벤치·화단·가로등은 길 옆에. 표지판 칸에는 조사 이벤트(글)를 같은 칸에 둔다.",
    "- 가로등 1×2 는 위 칸이 머리다. 한 칸만 찍으면 기둥이 잘린다.",
    "",
    `## 7. 동굴 입구 ${cave.w}×${cave.h}`,
    `- 구멍 = (X+2, Y+${cave.h - 1}). 구멍 칸 자체에 장소 이동 이벤트를 둔다(구멍은 막힘이지만 이벤트는 앞에서 조사로 발동, 또는 이벤트 칸만 통행 가능으로 바꾼다).`,
    "- 동굴 안 타일은 이 시트에 없다. 동굴 맵은 easyrpg_chipset_dungeon 으로 따로 만든다.",
    "",
    "## 금지",
    "- 부품 블록을 잘라 쓰기(상점 윗줄만, 가로등 머리만).",
    "- 부품을 1층에 두기(투명 부분이 검게 보인다).",
    "- 맵 전체에 조우를 거는 것(맨 잔디에서도 야생이 나온다) — 풀숲 사각형에만 건다.",
    "- 없는 소재: 체육관 내부, 동굴 내부, 바다·해변, 다리 난간. 실내는 easyrpg_chipset_interior, 사막·설원·체육관 외관은 scarloxy_chipset_wilds.",
  ].join("\n");
}

function example(maps) {
  if (!maps) return null;
  const town = maps.find((m) => m.id === "map_pkmn_town");
  const route = maps.find((m) => m.id === "map_pkmn_route");
  const rows = (m, layer) => Array.from({ length: m.h }, (_, y) => m[layer].slice(y * m.w, (y + 1) * m.w));
  return [
    "# 완성 예제 · 새싹 마을과 초원 1번 길",
    "",
    "포켓몬풍 데모(createScarloxyPokemonDemoProject)의 두 맵 전체 배열이다. 그림 town-example.png · route-example.png 가 이 배열을 실제 타일로 그린 것이다.",
    "",
    `## 새싹 마을 ${town.w}×${town.h}`,
    "1층:",
    "```json",
    JSON.stringify(rows(town, "lower")),
    "```",
    "3층(-1 = 비움):",
    "```json",
    JSON.stringify(rows(town, "upper")),
    "```",
    "",
    `## 초원 1번 길 ${route.w}×${route.h}`,
    "풀숲 사각형(조우표 region): (3,5,8,4) (18,5,7,5) (6,17,8,3) (16,13,5,5). 턱 칸 (11,15)(12,15)(13,15) 에 점프 이벤트.",
    "1층:",
    "```json",
    JSON.stringify(rows(route, "lower")),
    "```",
    "3층:",
    "```json",
    JSON.stringify(rows(route, "upper")),
    "```",
  ].join("\n");
}

function renderImages(maps) {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const spec = { out: IMG_DIR, kit, base, maps: maps ?? [] };
  const py = String.raw`
import json, sys
from PIL import Image, ImageDraw
spec = json.loads(sys.stdin.read())
sheet = Image.open("public/assets/monster-town-kit/monster-town-kit.png").convert("RGBA")
T = 16
def tile(i): return sheet.crop(((i % 30) * T, (i // 30) * T, (i % 30) * T + T, (i // 30) * T + T))
def canvas(w, h):
    im = Image.new("RGBA", (w * T, h * T))
    g = tile(124)
    for y in range(h):
        for x in range(w): im.paste(g, (x * T, y * T))
    return im
def stamp(im, block, x, y, only=None):
    for dy in range(block["h"]):
        for dx in range(block["w"]):
            if only and (dx, dy) not in only: continue
            im.alpha_composite(tile((block["row"] + dy) * 30 + block["col"] + dx), ((x + dx) * T, (y + dy) * T))
def save(im, name, scale=3):
    im.resize((im.width * scale, im.height * scale), Image.NEAREST).convert("RGB").quantize(128).save(spec["out"] + "/" + name, optimize=True)
k, b = spec["kit"], spec["base"]
# 정상/오류 1: 가로등 한 칸만(머리 잘림) vs 두 칸
ok = canvas(3, 3); stamp(ok, k["street-lamp"], 1, 0)
bad = canvas(3, 3); stamp(bad, k["street-lamp"], 1, 1, only={(0, 1)})
pair = Image.new("RGBA", (ok.width * 2 + 8, ok.height), (255, 255, 255, 255)); pair.paste(ok, (0, 0)); pair.paste(bad, (ok.width + 8, 0)); save(pair, "lamp-ok-bad.png", 4)
# 정상/오류 2: 풀숲 체크무늬 vs 한 변형만
ok = canvas(6, 3); bad = canvas(6, 3)
for y in range(3):
    for x in range(6):
        stamp(ok, k["tall-grass-a" if (x + y) % 2 == 0 else "tall-grass-b"], x, y)
        stamp(bad, k["tall-grass-a"], x, y)
pair = Image.new("RGBA", (ok.width, ok.height * 2 + 8), (255, 255, 255, 255)); pair.paste(ok, (0, 0)); pair.paste(bad, (0, ok.height + 8)); save(pair, "grass-mix-ok-bad.png", 4)
# 정상/오류 3: 울타리 끝 기둥 있음 vs 없음(잘린 2칸 조각)
ok = canvas(7, 1); bad = canvas(7, 1)
for x in range(7):
    if x < 6: stamp(ok, k["picket-fence"], x - (x % 2), 0, only={(x % 2, 0)})
    else: stamp(ok, k["fence-post"], x, 0)
for x in range(7):
    stamp(bad, k["picket-fence"], x - (x % 2), 0, only={(x % 2, 0)})
pair = Image.new("RGBA", (ok.width, ok.height * 2 + 8), (255, 255, 255, 255)); pair.paste(ok, (0, 0)); pair.paste(bad, (0, ok.height + 8)); save(pair, "fence-ok-bad.png", 4)
# 정상/오류 4: 상점 통째 vs 윗줄 잘림
ok = canvas(8, 8); stamp(ok, k["item-shop"], 1, 1)
bad = canvas(8, 8); stamp(bad, k["item-shop"], 1, 1, only={(dx, dy) for dx in range(6) for dy in range(2, 6)})
pair = Image.new("RGBA", (ok.width * 2 + 8, ok.height), (255, 255, 255, 255)); pair.paste(ok, (0, 0)); pair.paste(bad, (ok.width + 8, 0)); save(pair, "shop-ok-bad.png", 3)
# 부품 한눈에
im = canvas(30, 11)
for name, block in k.items(): stamp(im, block, block["col"], block["row"] - 16)
save(im, "kit-overview.png", 2)
# 예제 맵
for m in spec["maps"]:
    im = Image.new("RGBA", (m["w"] * T, m["h"] * T))
    for layer in ("lower", "upper"):
        for i, t in enumerate(m[layer]):
            if t >= 0: im.alpha_composite(tile(t), ((i % m["w"]) * T, (i // m["w"]) * T))
    save(im, ("town" if m["id"] == "map_pkmn_town" else "route") + "-example.png", 2)
print("images ok")
`;
  execFileSync("python3", ["-c", py], { input: JSON.stringify(spec), stdio: ["pipe", "inherit", "inherit"] });
}

const maps = fs.existsSync(MAPS_PATH) ? JSON.parse(fs.readFileSync(MAPS_PATH, "utf8")) : null;
renderImages(maps);
const img = (id, name, caption) => ({ id, name, caption, dataUrl: `/${IMG_DIR.replace(/^public\//, "")}/${name}` });
const documents = [
  { id: "monster-town-dictionary", name: "칸 사전 · 두 반쪽·부품 표·전체 배열", markdown: dictionary() },
  { id: "monster-town-steps", name: "조립 순서 · 건물·풀숲·울타리·턱·소품·동굴", markdown: steps() },
];
const ex = example(maps);
if (ex) documents.push({ id: "monster-town-example", name: "완성 예제 · 새싹 마을·초원 1번 길 전체 배열", markdown: ex });
const images = [
  img("kit-overview", "kit-overview.png", "부품 480~ 전체 · 실제 타일(2배)"),
  img("lamp-ok-bad", "lamp-ok-bad.png", "왼쪽 정상: 가로등 1×2 통째 / 오른쪽 오류: 기둥 칸만 찍어 머리가 없다"),
  img("grass-mix-ok-bad", "grass-mix-ok-bad.png", "위 정상: 풀숲 A·B 체크무늬 / 아래 오류: A 만 반복해 무늬가 줄지어 보인다"),
  img("fence-ok-bad", "fence-ok-bad.png", "위 정상: 울타리 끝을 기둥으로 막음 / 아래 오류: 2칸 조각이 잘린 채 끝난다"),
  img("shop-ok-bad", "shop-ok-bad.png", "왼쪽 정상: 상점 6×6 통째 / 오른쪽 오류: 지붕 두 줄이 빠졌다"),
  ...(maps ? [img("town-example", "town-example.png", "완성 예제 · 새싹 마을(실제 배열 렌더)"), img("route-example", "route-example.png", "완성 예제 · 초원 1번 길(실제 배열 렌더)")] : []),
];
const category = {
  id: "monster-town-kit-v1",
  name: "몬스터 마을·도로 · 상점·연구소·조우 풀숲·울타리·턱",
  description: "Scarloxy 초원 마을(0~479) + 생성 부품(480~959) 한 장으로 몬스터 수집 게임의 마을과 도로를 까는 법. 칸 사전, 조립 순서, 완성 예제 전체 배열, 정상/오류 그림.",
  documents,
  images,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(category, null, 1) + "\n");
console.log(`${OUT_JSON}: ${documents.length} docs, ${images.length} images`);

