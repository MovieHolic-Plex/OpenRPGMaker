// Plans of tiledata/atlas-biomes: per biome seven fields with different layouts, twelve border fields where two
// biomes meet, and the world maps (continent, archipelago, regional maps; lib/atlas-biome-world.mjs).
// A plan: { id, biome, layout (lib/atlas-biome-layouts.mjs), o (layout options, incl. meets), width, height, seed,
//           name, purpose, note, zone?(x, y, b) → true on the neighbour's side, fill? (fill overrides) }.
// Exits: every field records what each exit meets (o.meets). Inside a biome the seven fields form a road: west ↔ east
// go to the previous / next field of the chain, north / south to a field two steps on, or to the border field.
const F = (id, layout, o, width, height, name, note) => ({ id, layout, o, width, height, name, note });

const CHAINS = {
  jungle: [
    F("jungle-vine-ford", "riverFord", { pool: true, north: true }, 64, 44, "덩굴 강 나루", "탁한 초록 강이 우림 한가운데를 남북으로 흐르고, 나루 아래에 소가 고인다. 판뿌리 거목이 강둑을 지킨다"),
    F("jungle-idol-cave", "caveRoad", { stream: true }, 60, 44, "이끼 석상 동굴길", "북쪽 우림 절벽 면에 동굴 입구가 뚫려 있고 석상이 지킨다. 덩굴이 절벽을 타고 내려온다"),
    F("jungle-terrace-falls", "waterfallValley", {}, 60, 48, "판뿌리 폭포 계곡", "절벽 위에서 떨어진 물이 소를 이루고 남쪽으로 흘러 나간다. 계단으로 절벽 위 고개에 오른다"),
    F("jungle-spring-glade", "glade", { north: true }, 64, 46, "우림 샘 빈터", "사방이 빽빽한 우림이고 가운데 빈터에 샘이 있다. 숲길 세 갈래가 빈터에서 만난다"),
    F("jungle-green-lake", "lakeShore", { island: true }, 66, 46, "초록 호수 섬", "우림 속 큰 호수 한가운데 작은 섬, 남쪽 호숫가 길과 나루"),
    F("jungle-crossing", "crossroads", { pond: true }, 60, 46, "우림 네 갈래 쉼터", "네 갈래 길이 만나는 빈터에 나그네 쉼터(모닥불·천막)"),
    F("jungle-vine-pass", "twoTier", { pond: false, cave: false, east: true }, 58, 50, "덩굴 고갯길", "두 단 벼랑을 계단 두 개로 오르는 고갯길, 가운뎃단에서 동쪽으로 갈린다"),
  ],
  swamp: [
    F("swamp-mist-causeway", "marsh", {}, 62, 44, "물안개 늪 둑길", "작은 늪 웅덩이 사이로 둑길이 구불구불 지나간다. 맹그로브가 물가에 뿌리를 내린다"),
    F("swamp-mangrove-channels", "marsh", { north: false, ponds: 9 }, 66, 46, "맹그로브 수로", "웅덩이가 촘촘한 저지대, 서쪽과 동쪽만 이어지는 좁은 둑길"),
    F("swamp-black-lake", "lakeShore", {}, 62, 46, "검은 늪 호수", "검푸른 늪 호수, 남쪽 호숫가 길과 낚시 나루"),
    F("swamp-two-bridges", "riverFord", { twoBridges: true, width: 4, south: true }, 64, 48, "두 다리 늪강", "넓은 늪강에 다리 두 개, 남쪽 갈림길"),
    F("swamp-rot-glade", "glade", { south: true }, 60, 44, "썩은 나무 빈터", "늪 숲 한가운데 빈터와 샘, 숲길 세 갈래"),
    F("swamp-cave-mouth", "caveRoad", {}, 58, 44, "늪 동굴 입구", "늪 북쪽 바위 벼랑에 동굴 입구, 계단으로 벼랑 위 고원"),
    F("swamp-mangrove-coast", "coast", { sea: "east", cove: true }, 58, 48, "맹그로브 해안", "동쪽이 바다인 맹그로브 해안, 작은 만과 나루"),
  ],
  mushroom: [
    F("mushroom-crossroads", "crossroads", {}, 56, 44, "버섯 숲 네 갈래", "거대 버섯 숲 사이 네 갈래 길과 나그네 쉼터"),
    F("mushroom-fairy-glade", "glade", { north: true, pond: false }, 60, 46, "요정 고리 빈터", "보랏빛 버섯 숲 가운데 요정 고리가 있는 빈터"),
    F("mushroom-spore-cave", "caveRoad", { stream: true }, 60, 44, "포자 동굴 입구", "북쪽 벼랑에 동굴, 포자 개울과 다리"),
    F("mushroom-spore-ford", "riverFord", { pool: true, south: true }, 62, 46, "포자 개울 나루", "빛 이끼 개울을 건너는 나루와 소"),
    F("mushroom-terraces", "twoTier", {}, 56, 52, "버섯 층층 비탈", "두 단 비탈, 가운뎃단에 작은 연못과 윗단 동굴"),
    F("mushroom-glow-lake", "lakeShore", {}, 62, 46, "빛 이끼 호수", "푸른 버섯 숲 속 호수와 나루"),
    F("mushroom-falls", "waterfallValley", {}, 60, 48, "버섯 폭포 계곡", "버섯 절벽에서 떨어지는 폭포와 소"),
  ],
  crystal: [
    F("crystal-steps", "twoTier", {}, 56, 52, "수정 층계", "두 단 수정 벼랑과 계단, 윗단 동굴"),
    F("crystal-cliff-cave", "cliffTerrace", { twoStairs: true, cave: true }, 62, 44, "수정 절벽 동굴", "수정 절벽 발치의 동굴과 두 계단"),
    F("crystal-mirror-lake", "lakeShore", { island: true }, 64, 46, "거울 호수", "수정 벌판 가운데 맑은 호수와 섬"),
    F("crystal-plain-road", "meadowRoad", {}, 64, 44, "수정 벌판 길", "수정 무리가 흩어진 넓은 벌판을 가로지르는 길"),
    F("crystal-light-ford", "riverFord", { north: true }, 60, 44, "빛 개울 나루", "빛나는 개울을 건너는 나루"),
    F("crystal-spire-cross", "crossroads", {}, 58, 46, "수정 탑 갈림길", "수정 첨탑 사이 네 갈래 쉼터"),
    F("crystal-falls", "waterfallValley", {}, 60, 48, "수정 폭포", "수정 벼랑의 폭포와 소, 계단 위 고개"),
  ],
  badlands: [
    F("badlands-red-cave", "cliffTerrace", { cave: true }, 60, 44, "붉은 절벽 동굴", "층층이 쌓인 붉은 절벽 발치에 동굴"),
    F("badlands-layered-canyon", "twoTier", { pond: false, cave: false }, 58, 52, "층층 협곡", "두 단 붉은 절벽을 계단으로 오르는 협곡"),
    F("badlands-stair-canyon", "twoTier", { east: true }, 60, 52, "붉은 계단 협곡", "두 단 절벽, 가운뎃단 웅덩이와 윗단 굴"),
    F("badlands-dust-road", "meadowRoad", { pond: false }, 66, 44, "먼지 벌판 길", "마른 나무와 붉은 바위가 흩어진 먼지 벌판"),
    F("badlands-red-river", "riverFord", { width: 2, south: true }, 62, 44, "붉은 강 나루", "메마른 땅을 가르는 가는 강과 나루"),
    F("badlands-crossroads", "crossroads", {}, 60, 46, "황무지 갈림길", "황무지 네 갈래와 나그네 쉼터"),
    F("badlands-gorge-cave", "caveRoad", {}, 60, 44, "협곡 굴 입구", "높은 붉은 절벽 면의 굴과 계단"),
  ],
  savanna: [
    F("savanna-grass-road", "meadowRoad", {}, 66, 44, "사바나 들길", "키 큰 마른 풀 사이 들길, 아카시아와 물웅덩이"),
    F("savanna-waterhole-ford", "riverFord", { pool: true, north: true }, 64, 44, "물웅덩이 나루", "건기에도 마르지 않는 강과 소"),
    F("savanna-dry-lake", "lakeShore", {}, 64, 46, "건기 호수", "마른 풀밭 가운데 호수와 나루"),
    F("savanna-baobab-cross", "crossroads", {}, 60, 46, "바오밥 갈림길", "바오밥이 선 네 갈래 쉼터"),
    F("savanna-kopje-bluff", "cliffTerrace", { twoStairs: true }, 62, 44, "바위언덕 벼랑", "벼랑 하나를 두 계단으로 오르는 사바나 고지"),
    F("savanna-falls", "waterfallValley", {}, 60, 48, "사바나 폭포", "고지에서 떨어지는 폭포와 소"),
    F("savanna-open-plain", "meadowRoad", { pond: false, south: false }, 68, 44, "탁 트인 초원", "나무가 드문 넓은 초원을 가로지르는 길"),
  ],
  taiga: [
    F("taiga-ice-lake", "lakeShore", {}, 60, 46, "타이가 얼음 호수", "가문비 숲 속 호수, 얼거나 검게 트인 물"),
    F("taiga-spruce-ford", "riverFord", { north: true }, 62, 44, "가문비 강 나루", "가문비 숲을 가르는 강과 나루"),
    F("taiga-snow-glade", "glade", { south: true }, 60, 46, "눈 덮인 빈터", "빽빽한 가문비 숲 가운데 눈 덮인 빈터와 샘"),
    F("taiga-bear-cave", "caveRoad", { stream: true }, 60, 44, "곰 동굴 입구", "북쪽 벼랑의 동굴과 얼음 개울"),
    F("taiga-spruce-pass", "twoTier", { pond: false, cave: false }, 58, 50, "가문비 고갯길", "두 단 벼랑을 넘는 고갯길"),
    F("taiga-frozen-falls", "waterfallValley", {}, 60, 48, "언 폭포 계곡", "벼랑의 폭포와 소, 계단 위 고개"),
    F("taiga-logger-cross", "crossroads", {}, 58, 46, "벌목꾼 갈림길", "벌목꾼 쉼터가 있는 네 갈래"),
  ],
  tundra: [
    F("tundra-river-ford", "riverFord", {}, 60, 44, "툰드라 강 나루", "이끼 언 들을 가르는 찬 강과 나루"),
    F("tundra-moss-plain", "meadowRoad", {}, 66, 44, "이끼 벌판 길", "잔설과 동토 사이 이끼 벌판 길"),
    F("tundra-ice-lake", "lakeShore", { island: true }, 62, 46, "얼음 호수 섬", "얼어붙은 호수와 섬"),
    F("tundra-frost-cave", "cliffTerrace", { cave: true }, 60, 44, "동토 벼랑 동굴", "동토 벼랑 발치의 동굴"),
    F("tundra-cold-coast", "coast", {}, 64, 44, "툰드라 해안", "남쪽 찬 바다와 모래 없는 해안, 나루"),
    F("tundra-cairn-cross", "crossroads", {}, 58, 46, "돌무지 갈림길", "네 갈래와 나그네 쉼터"),
    F("tundra-frost-pass", "twoTier", { pond: false }, 58, 50, "서리 고개", "두 단 서리 벼랑, 윗단 동굴"),
  ],
  blight: [
    F("blight-cursed-cave", "caveRoad", {}, 56, 44, "저주 동굴 입구", "보랏빛 벼랑에 저주받은 동굴 입구"),
    F("blight-withered-glade", "glade", { pond: false, north: true }, 60, 46, "시든 숲 빈터", "어둠의 숲 가운데 시든 빈터"),
    F("blight-poison-marsh", "marsh", {}, 62, 44, "독 늪 길", "보랏빛 독 웅덩이 사이 둑길"),
    F("blight-violet-ford", "riverFord", { south: true }, 62, 44, "보라 강 나루", "보라색 강과 나루"),
    F("blight-obelisk-cross", "crossroads", {}, 58, 46, "오벨리스크 갈림길", "검은 오벨리스크가 선 네 갈래"),
    F("blight-dark-steps", "twoTier", {}, 56, 52, "검은 층 언덕", "두 단 검은 벼랑, 윗단 동굴"),
    F("blight-venom-lake", "lakeShore", {}, 62, 46, "독 호수", "빛나는 독 호수와 나루"),
  ],
  skyisle: [
    F("skyisle-cloud-steps", "islands", { count: 4 }, 72, 40, "구름섬 징검다리", "하늘에 뜬 섬 네 개를 나무다리로 잇는 길"),
    F("skyisle-three-isles", "islands", { count: 3 }, 60, 42, "하늘 세 섬", "하늘 섬 셋과 다리"),
    F("skyisle-five-isles", "islands", { count: 5 }, 80, 42, "하늘 다섯 섬", "하늘 섬 다섯을 잇는 긴 다리 길"),
    F("skyisle-cliff-edge", "coast", {}, 64, 44, "구름 절벽 끝", "남쪽이 구름 바다인 섬 끝, 구름 나루"),
    F("skyisle-cloud-bay", "coast", { sea: "east", cove: true }, 58, 48, "구름 만", "동쪽 구름 바다와 작은 만"),
    F("skyisle-sky-lake", "lakeShore", { island: true }, 62, 46, "하늘 호수", "섬 위의 구름 호수와 작은 섬"),
    F("skyisle-meadow", "meadowRoad", {}, 64, 44, "하늘 초원 길", "바람 수정이 선 하늘 초원"),
  ],
  tropical: [
    F("tropical-palm-beach", "coast", {}, 64, 44, "야자 해변", "남쪽 바다와 흰 모래사장, 야자수와 나루"),
    F("tropical-coral-bay", "coast", { sea: "east", cove: true }, 58, 48, "산호 만", "동쪽 바다의 산호 만"),
    F("tropical-coral-isles", "islands", { count: 3 }, 62, 42, "산호섬 징검다리", "산호초 바다 위 섬 셋"),
    F("tropical-lagoon", "lakeShore", { island: true }, 64, 46, "석호", "야자 숲에 둘러싸인 석호와 섬"),
    F("tropical-river-ford", "riverFord", { pool: true }, 62, 44, "열대 강 나루", "열대 숲을 가르는 강과 소"),
    F("tropical-falls", "waterfallValley", {}, 60, 48, "열대 폭포", "절벽 폭포와 소"),
    F("tropical-jungle-glade", "glade", { north: true }, 60, 46, "열대 숲 빈터", "열대 숲 가운데 샘 빈터"),
  ],
};

const SEED0 = { jungle: 7100, swamp: 7200, mushroom: 7300, crystal: 7400, badlands: 7500, savanna: 7600, taiga: 7700, tundra: 7800, blight: 7900, skyisle: 8000, tropical: 8100 };
const PLANS_FIELDS = [];
for (const [biome, list] of Object.entries(CHAINS)) {
  list.forEach((f, k) => {
    const prev = list[k - 1], next = list[k + 1], far = list[(k + 2) % list.length], back = list[(k + list.length - 2) % list.length];
    const meets = { west: prev ? prev.name : `${biome === "skyisle" ? "하늘 길" : "바깥 길"} (지역도)`, east: next ? next.name : `${biome === "skyisle" ? "하늘 길" : "바깥 길"} (지역도)`, north: far.name, south: back.name, ...(f.o.meets ?? {}) };
    PLANS_FIELDS.push({ ...f, biome, o: { ...f.o, meets }, seed: SEED0[biome] + k * 10 + 1, purpose: f.note.split(".")[0] });
  });
}

// Border fields: base biome + the zone where the neighbour biome's lawn and pieces take over (sheet NEIGHBOUR pairs).
const B = (id, biome, layout, o, width, height, seed, name, note, zone) => ({ id, biome, layout, o, width, height, seed, name, note, purpose: note.split(".")[0], zone, border: true });
const BORDERS = [
  B("border-jungle-swamp-ford", "jungle", "riverFord", { meets: { west: "덩굴 강 나루", east: "물안개 늪 둑길" } }, 64, 44, 8201, "우림과 늪의 경계 나루", "강 동쪽부터 우림이 늪으로 바뀐다", (x, y, b) => x > b.W * 0.55 + 3 * Math.sin(y / 5)),
  B("border-jungle-swamp-glade", "jungle", "glade", { south: true, meets: { south: "맹그로브 수로", north: "우림 샘 빈터" } }, 60, 46, 8211, "늪으로 잠기는 우림 빈터", "빈터 남쪽이 늪 땅으로 잠긴다", (x, y, b) => y > b.H * 0.6 + 2.5 * Math.sin(x / 4.3)),
  B("border-taiga-tundra-line", "taiga", "lakeShore", { meets: { north: "이끼 벌판 길", west: "타이가 얼음 호수" } }, 62, 46, 8221, "나무 한계선 호수", "호수 북쪽 너머로 가문비가 끝나고 툰드라가 시작된다", (x, y, b) => y < b.H * 0.3 + 2 * Math.sin(x / 5)),
  B("border-taiga-tundra-cross", "taiga", "crossroads", { meets: { east: "툰드라 강 나루", west: "벌목꾼 갈림길" } }, 60, 46, 8231, "숲 끝 갈림길", "갈림길 동쪽이 툰드라 벌판", (x, y, b) => x > b.W * 0.6 + 3 * Math.sin(y / 4)),
  B("border-savanna-badlands-plain", "savanna", "meadowRoad", { meets: { east: "먼지 벌판 길", west: "사바나 들길" } }, 66, 44, 8241, "초원 끝 붉은 땅", "들길 동쪽으로 풀이 끝나고 붉은 황무지가 시작된다", (x, y, b) => x > b.W * 0.58 + 4 * Math.sin(y / 6)),
  B("border-savanna-badlands-bluff", "savanna", "cliffTerrace", { meets: { north: "붉은 절벽 동굴", south: "바위언덕 벼랑" } }, 62, 46, 8251, "붉은 고지 벼랑", "벼랑 위 고지가 붉은 황무지", (x, y, b) => y < b.H * 0.4 + 1.5 * Math.sin(x / 5)),
  B("border-tropical-jungle-coast", "tropical", "coast", { meets: { north: "덩굴 강 나루", west: "야자 해변" } }, 64, 44, 8261, "우림이 닿는 해변", "해변 뒤 내륙이 우림으로 짙어진다", (x, y, b) => y < b.H * 0.28 + 2 * Math.sin(x / 4)),
  B("border-blight-forest-glade", "blight", "glade", { north: true, meets: { west: "시든 숲 빈터", east: "푸른 숲 (공용 숲마을)" } }, 60, 46, 8271, "오염이 번지는 숲 가장자리", "빈터 서쪽은 아직 푸른 숲, 동쪽부터 오염이 번진다", (x, y, b) => x < b.W * 0.42 + 3 * Math.sin(y / 4.5)),
  B("border-blight-forest-ford", "blight", "riverFord", { meets: { east: "푸른 숲 (공용 숲마을)", west: "보라 강 나루" } }, 62, 44, 8281, "강이 막은 오염", "강 동쪽 기슭은 오염되지 않은 숲", (x, y, b) => x > b.W * 0.56 + 2 * Math.sin(y / 5)),
  B("border-mushroom-crystal-cross", "mushroom", "crossroads", { meets: { east: "수정 벌판 길", west: "버섯 숲 네 갈래" } }, 58, 46, 8291, "버섯과 수정의 갈림길", "갈림길 동남쪽부터 수정 땅", (x, y, b) => x + y * 0.8 > b.W * 0.62 + b.H * 0.4),
  B("border-swamp-blight-marsh", "swamp", "marsh", { meets: { east: "독 늪 길", west: "물안개 늪 둑길" } }, 62, 44, 8301, "썩어 가는 늪", "늪 동쪽이 보랏빛 오염으로 썩어 간다", (x, y, b) => x > b.W * 0.6 + 3 * Math.sin(y / 5)),
  B("border-tundra-crystal-plain", "tundra", "meadowRoad", { meets: { south: "수정 벌판 길", west: "이끼 벌판 길" } }, 64, 44, 8311, "수정 서리 들판", "들판 남쪽에 수정이 솟아난다", (x, y, b) => y > b.H * 0.62 + 2 * Math.sin(x / 4.5)),
];

// World maps (lib/atlas-biome-world.mjs): continent, archipelago and regional maps on the world sheet. Places are the
// fields above (placeId = field plan id); an icon marks a biome's gateway field, the others are road ends.
const ICON_OF = { jungle: "giant-tree", swamp: "mangrove", mushroom: "giant-mushroom", crystal: "crystal-spire", badlands: "dead-tree", savanna: "acacia",
  taiga: "spruce", tundra: "cave", blight: "blight-tree", skyisle: "sky-island", tropical: "palm" };
const REGION = {
  jungle: { biome: "jungle", name: "우림", forest: "jungle", woods: 0.46 },
  swamp: { biome: "swamp", name: "맹그로브 늪", forest: "swamp", woods: 0.6 },
  mushroom: { biome: "mushroom", name: "버섯 숲", forest: "mushroom-forest", woods: 0.48 },
  crystal: { biome: "crystal", name: "수정 평원", ground: "crystal-plain", forest: "crystal-hills", woods: 0.66 },
  badlands: { biome: "badlands", name: "붉은 황무지", ground: "red-earth", forest: "red-canyon", woods: 0.62 },
  savanna: { biome: "savanna", name: "사바나", ground: "savanna", forest: "forest", woods: 0.78 },
  taiga: { biome: "taiga", name: "타이가", ground: "snow", forest: "taiga", woods: 0.5 },
  tundra: { biome: "tundra", name: "툰드라", ground: "tundra", forest: "snowforest", woods: 0.74 },
  blight: { biome: "blight", name: "오염된 땅", forest: "blight-forest", woods: 0.48 },
  tropical: { biome: "tropical", name: "열대 해안", ground: "sand", forest: "jungle", woods: 0.7 },
  skyisle: { biome: "skyisle", name: "하늘섬 초원", forest: "forest", woods: 0.7 },
};
const DECOR = { jungle: "giant-tree", swamp: "mangrove", mushroom: "giant-mushroom", crystal: "crystal-spire", badlands: "dead-tree", savanna: "acacia",
  taiga: "spruce", tundra: "spruce", blight: "blight-tree", tropical: "palm", skyisle: "sky-island" };
const reg = (k, at, r, extra = {}) => ({ ...REGION[k], at, r, ...extra });
// n fields of a biome chain spread around (fx, fy): the first with the biome icon.
const fields = (k, n, [fx, fy], spread = 0.08, from = 0) => CHAINS[k].slice(from, from + n).map((f, j) => {
  const a = j * 2.4 + fx * 7;
  return { id: f.id, placeId: f.id, name: f.name, kind: "field", ...(j === 0 && ICON_OF[k] ? { icon: ICON_OF[k] } : {}),
    at: [Math.min(0.9, Math.max(0.1, fx + (j ? spread * Math.cos(a) : 0))), Math.min(0.88, Math.max(0.12, fy + (j ? spread * 0.8 * Math.sin(a) : 0)))],
    ...(f.layout === "coast" ? { coast: true } : {}) };
});
const decor = (k, count, near, within = 0.16, extra = {}) => ({ icon: DECOR[k], count, near, within, ...extra });
const Wd = (id, name, width, height, seed, purpose, note, o) => ({ id, world: true, category: "world", name, width, height, seed, purpose, note, gate: { maxSq: 7, screen: 0.66 }, ...o });

const WORLDS = [
  Wd("atlas-world-continent", "열한 바이옴 대륙 전도", 100, 72, 9101, "열한 바이옴이 한 대륙에 모인 월드맵",
    "바다에 둘러싸인 대륙 하나. 북서에 눈 덮인 타이가, 북동에 툰드라, 동쪽에 수정 평원, 가운데 동쪽에 버섯 숲, 서쪽에 오염된 땅, 남서에 늪, 남쪽 가운데에 우림, 남동에 사바나와 붉은 황무지, 남쪽 바닷가에 열대 해안, 북동 바다 위에 하늘섬이 떠 있다. 바이옴마다 대표 필드 두 곳을 흙길로 잇는다",
    { landAt: 0.5,
      regions: [reg("taiga", [0.24, 0.16], [0.2, 0.14]), reg("tundra", [0.66, 0.13], [0.24, 0.12]), reg("crystal", [0.84, 0.36], [0.12, 0.13]), reg("mushroom", [0.6, 0.38], [0.1, 0.1]),
        reg("blight", [0.13, 0.44], [0.1, 0.12]), reg("swamp", [0.2, 0.66], [0.11, 0.09]), reg("jungle", [0.4, 0.66], [0.13, 0.12]), reg("savanna", [0.62, 0.64], [0.12, 0.1]),
        reg("badlands", [0.83, 0.66], [0.11, 0.12]), reg("tropical", [0.5, 0.86], [0.24, 0.07])],
      ranges: [{ points: [[0.36, 0.26], [0.48, 0.3], [0.52, 0.22]], width: 1.8 }, { points: [[0.74, 0.5], [0.78, 0.58]], width: 1.5, kind: "red-canyon" }],
      places: [...fields("taiga", 2, [0.24, 0.18]), ...fields("tundra", 2, [0.66, 0.14]), ...fields("crystal", 2, [0.84, 0.36]), ...fields("mushroom", 2, [0.6, 0.4]),
        ...fields("blight", 2, [0.14, 0.44]), ...fields("swamp", 2, [0.2, 0.64]), ...fields("jungle", 2, [0.4, 0.64]), ...fields("savanna", 2, [0.62, 0.64]),
        ...fields("badlands", 2, [0.83, 0.66]), { ...fields("tropical", 1, [0.5, 0.84])[0], coast: true }],
      decor: [decor("savanna", 3, [0.62, 0.64]), decor("mushroom", 2, [0.6, 0.38], 0.1), decor("crystal", 2, [0.84, 0.36], 0.12), decor("tropical", 3, [0.5, 0.86], 0.2),
        decor("skyisle", 4, [0.9, 0.12], 0.14, { onSea: true }), decor("badlands", 2, [0.83, 0.66], 0.12), decor("taiga", 3, [0.24, 0.16], 0.16)] }),
  Wd("atlas-world-archipelago", "산호와 구름의 군도", 90, 60, 9111, "열대 섬과 하늘섬이 흩어진 군도 월드맵",
    "바다에 섬 다섯. 가운데 큰 섬은 우림, 남쪽 섬들은 흰 모래와 야자 해안, 서쪽 섬은 늪, 북동 섬은 수정 평원이다. 섬마다 항구가 있고 뱃길로 잇는다. 북쪽 바다 위로 하늘섬이 떠 있다",
    { islands: [[0.5, 0.48, 0.18, 0.2], [0.18, 0.4, 0.1, 0.14], [0.82, 0.3, 0.11, 0.12], [0.3, 0.8, 0.12, 0.1], [0.74, 0.78, 0.12, 0.11]],
      regions: [reg("jungle", [0.5, 0.46], [0.16, 0.18]), reg("swamp", [0.18, 0.4], [0.1, 0.14]), reg("crystal", [0.82, 0.3], [0.12, 0.12]),
        reg("tropical", [0.3, 0.8], [0.13, 0.11]), reg("tropical", [0.74, 0.78], [0.13, 0.12])],
      places: [{ ...fields("jungle", 1, [0.5, 0.44])[0], port: true }, ...fields("jungle", 2, [0.5, 0.5], 0.06, 3),
        { ...fields("swamp", 1, [0.18, 0.4])[0], port: true }, { ...fields("crystal", 1, [0.82, 0.3])[0], port: true },
        { ...fields("tropical", 1, [0.3, 0.8])[0], port: true }, { ...fields("tropical", 2, [0.74, 0.78], 0.05, 1)[0], port: true }, fields("tropical", 3, [0.74, 0.78], 0.05, 1)[2]],
      lanes: [["jungle-vine-ford", "swamp-mist-causeway"], ["jungle-vine-ford", "crystal-steps"], ["jungle-vine-ford", "tropical-palm-beach"], ["tropical-palm-beach", "tropical-coral-bay"]],
      decor: [decor("skyisle", 5, [0.5, 0.1], 0.2, { onSea: true }), decor("tropical", 4, [0.3, 0.8], 0.14), decor("tropical", 3, [0.74, 0.78], 0.14)] }),
];
const REGIONAL = [
  ["atlas-region-rainforest", "우림과 늪의 지역도", 9121, ["jungle", "swamp", "tropical"], "우림·늪·열대 해안이 이어지는 남쪽 지역도",
    "가운데 우림, 서쪽 늪, 남쪽 바닷가 열대 해안. 우림의 필드 일곱 곳과 늪·해안 필드를 흙길로 잇는다",
    { regions: [reg("jungle", [0.5, 0.42], [0.26, 0.26]), reg("swamp", [0.16, 0.5], [0.14, 0.2]), reg("tropical", [0.55, 0.86], [0.34, 0.1])],
      places: [...fields("jungle", 5, [0.5, 0.4], 0.16), ...fields("swamp", 2, [0.16, 0.5], 0.1), ...fields("tropical", 1, [0.55, 0.82])] }],
  ["atlas-region-frozen-north", "얼어붙은 북방 지역도", 9131, ["taiga", "tundra", "crystal"], "타이가·툰드라·수정 평원이 만나는 북방 지역도",
    "남쪽 가문비 타이가에서 북쪽 툰드라로 나무가 끝나고, 동쪽 끝에 수정 평원이 빛난다",
    { regions: [reg("taiga", [0.4, 0.66], [0.34, 0.24]), reg("tundra", [0.45, 0.24], [0.38, 0.2]), reg("crystal", [0.86, 0.45], [0.12, 0.2])],
      places: [...fields("taiga", 4, [0.4, 0.66], 0.18), ...fields("tundra", 4, [0.45, 0.24], 0.18), ...fields("crystal", 1, [0.86, 0.45])] }],
  ["atlas-region-red-plains", "금빛 초원과 붉은 땅 지역도", 9141, ["savanna", "badlands"], "사바나와 붉은 황무지가 맞닿은 지역도",
    "서쪽 금빛 사바나 초원에 아카시아가 드문드문 서고, 동쪽으로 갈수록 붉은 흙벌과 협곡 언덕이 된다",
    { regions: [reg("savanna", [0.32, 0.5], [0.3, 0.36]), reg("badlands", [0.76, 0.5], [0.24, 0.36])],
      places: [...fields("savanna", 5, [0.3, 0.5], 0.18), ...fields("badlands", 5, [0.76, 0.5], 0.16)],
      decor: [decor("savanna", 5, [0.3, 0.5], 0.25), decor("badlands", 4, [0.76, 0.5], 0.2)] }],
  ["atlas-region-glowing-vale", "빛나는 골짜기 지역도", 9151, ["mushroom", "crystal"], "버섯 숲과 수정 평원의 골짜기 지역도",
    "산맥에 둘러싸인 골짜기. 서쪽은 거대 버섯 숲, 동쪽은 수정 평원과 수정 언덕",
    { regions: [reg("mushroom", [0.3, 0.5], [0.26, 0.34]), reg("crystal", [0.72, 0.5], [0.26, 0.34])],
      ranges: [{ points: [[0.1, 0.12], [0.5, 0.08], [0.9, 0.12]], width: 1.6 }],
      places: [...fields("mushroom", 5, [0.3, 0.52], 0.17), ...fields("crystal", 5, [0.72, 0.52], 0.17)],
      decor: [decor("mushroom", 4, [0.3, 0.5], 0.22), decor("crystal", 4, [0.72, 0.5], 0.22)] }],
  ["atlas-region-blighted-march", "오염된 변경 지역도", 9161, ["blight", "swamp"], "오염이 번지는 변경 지역도",
    "동쪽의 오염된 땅과 어둠의 숲이 서쪽 푸른 숲과 남쪽 늪을 잠식해 간다",
    { regions: [reg("blight", [0.66, 0.44], [0.28, 0.32]), reg("swamp", [0.3, 0.8], [0.22, 0.12])],
      places: [...fields("blight", 6, [0.66, 0.44], 0.18), ...fields("swamp", 2, [0.3, 0.78], 0.1), { id: "border-blight-forest-glade", placeId: "border-blight-forest-glade", name: "오염이 번지는 숲 가장자리", kind: "field", at: [0.3, 0.4] }],
      decor: [decor("blight", 4, [0.66, 0.44], 0.22)] }],
  ["atlas-region-sky-reach", "구름 위 하늘섬 해역", 9171, ["skyisle"], "하늘섬이 떠 있는 바다 위 하늘 지역도",
    "바다 위 큰 섬의 초원에서 하늘섬 길이 시작되고, 바다 위 하늘에 떠 있는 섬들이 흩어져 있다",
    { landAt: 0.72, regions: [reg("skyisle", [0.5, 0.5], [0.4, 0.4])],
      places: [...fields("skyisle", 7, [0.5, 0.5], 0.2)], decor: [decor("skyisle", 10, [0.5, 0.5], 0.6, { onSea: true })] }],
  ["atlas-region-coral-isles", "산호섬 지역도", 9181, ["tropical"], "산호 바다에 흩어진 열대 섬 지역도",
    "야자 해안 섬 넷. 섬마다 항구, 뱃길로 잇는다",
    { islands: [[0.3, 0.35, 0.16, 0.2], [0.72, 0.3, 0.14, 0.18], [0.35, 0.78, 0.14, 0.14], [0.76, 0.76, 0.13, 0.14]],
      regions: [reg("tropical", [0.5, 0.5], [0.6, 0.6])],
      places: [{ ...fields("tropical", 1, [0.3, 0.35])[0], port: true }, { ...fields("tropical", 1, [0.26, 0.42], 0, 3)[0] }, { ...fields("tropical", 1, [0.72, 0.3], 0.1, 1)[0], port: true },
        { ...fields("tropical", 1, [0.35, 0.78], 0.1, 2)[0], port: true }, { ...fields("tropical", 1, [0.76, 0.76], 0.1, 5)[0], port: true }, { ...fields("tropical", 1, [0.8, 0.7], 0, 6)[0] }],
      lanes: [["tropical-palm-beach", "tropical-coral-bay"], ["tropical-palm-beach", "tropical-coral-isles"], ["tropical-coral-bay", "tropical-falls"]],
      decor: [decor("tropical", 6, [0.5, 0.5], 0.6)] }],
  ["atlas-region-crossroads", "네 바이옴 갈림길 지역도", 9191, ["jungle", "savanna", "mushroom", "taiga"], "네 바이옴이 한 점에서 만나는 지역도",
    "가운데 흙길 네거리를 두고 북서 타이가, 북동 버섯 숲, 남서 우림, 남동 사바나가 맞닿는다. 경계 필드가 그 사이에 있다",
    { regions: [reg("taiga", [0.25, 0.25], [0.24, 0.24]), reg("mushroom", [0.75, 0.25], [0.24, 0.24]), reg("jungle", [0.25, 0.75], [0.24, 0.24]), reg("savanna", [0.75, 0.75], [0.24, 0.24])],
      places: [...fields("taiga", 2, [0.24, 0.24], 0.1), ...fields("mushroom", 2, [0.76, 0.24], 0.1), ...fields("jungle", 2, [0.24, 0.76], 0.1), ...fields("savanna", 2, [0.76, 0.76], 0.1),
        { id: "border-jungle-swamp-ford", placeId: "border-jungle-swamp-ford", name: "우림과 늪의 경계 나루", kind: "field", at: [0.1, 0.55] },
        { id: "border-savanna-badlands-plain", placeId: "border-savanna-badlands-plain", name: "초원 끝 붉은 땅", kind: "field", at: [0.88, 0.55] }],
      decor: [decor("savanna", 3, [0.76, 0.76], 0.16), decor("mushroom", 2, [0.76, 0.24], 0.14)] }],
  ["atlas-region-west-coast", "서쪽 해안 지역도", 9201, ["tundra", "swamp", "tropical"], "북에서 남으로 기후가 바뀌는 긴 서쪽 해안 지역도",
    "서쪽이 바다인 긴 해안. 북쪽 툰드라 해안에서 가운데 맹그로브 늪 해안을 지나 남쪽 야자 해변까지 해안길이 이어진다",
    { landAt: 0.5, patches: [[0, 0.5, 13, 34, "lake"]], regions: [reg("tundra", [0.55, 0.14], [0.4, 0.14]), reg("swamp", [0.5, 0.5], [0.4, 0.16]), reg("tropical", [0.5, 0.86], [0.4, 0.12])],
      places: [{ ...fields("tundra", 1, [0.4, 0.16], 0.1, 4)[0], coast: true }, ...fields("tundra", 2, [0.6, 0.18], 0.1), { ...fields("swamp", 1, [0.4, 0.5], 0.1, 6)[0], coast: true }, ...fields("swamp", 2, [0.6, 0.5], 0.1),
        { ...fields("tropical", 1, [0.45, 0.84])[0], coast: true }, ...fields("tropical", 2, [0.62, 0.8], 0.1, 4)] }],
];
for (const [id, name, seed, biomes, purpose, note, o] of REGIONAL) WORLDS.push(Wd(id, name, 72, 52, seed, purpose, note, { landAt: 0.52, biomes, ...o }));

export const PLANS = [...PLANS_FIELDS, ...BORDERS, ...WORLDS];
