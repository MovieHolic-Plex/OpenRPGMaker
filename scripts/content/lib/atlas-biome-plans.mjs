// Plans of tiledata/atlas-biomes: per biome several fields with different layouts, border fields, world maps.
// A plan: { id, biome, layout (lib/atlas-biome-layouts.mjs), o (layout options, incl. meets), width, height, seed,
//           name, purpose, note, zone?(x, y, b) → true on the neighbour's side, fill? (fill overrides) }.
const T = (id, biome, layout, o, width, height, seed, name, note) => ({ id, biome, layout, o, width, height, seed, name, purpose: note.split(".")[0], note });
export const PLANS = [
  T("jungle-vine-ford", "jungle", "riverFord", { pool: true, north: true }, 64, 44, 7101, "덩굴 강 나루", "탁한 초록 강이 우림 한가운데를 남북으로 흐른다"),
  T("jungle-idol-cave", "jungle", "caveRoad", { stream: true }, 60, 44, 7111, "이끼 석상 동굴길", "북쪽 우림 절벽 면에 동굴 입구"),
  T("jungle-terrace-falls", "jungle", "waterfallValley", {}, 60, 48, 7121, "판뿌리 나무 폭포 계곡", "폭포와 소"),
  T("swamp-test", "swamp", "marsh", {}, 60, 44, 7201, "늪 시험", "늪"),
  T("mushroom-test", "mushroom", "crossroads", {}, 56, 44, 7301, "버섯 시험", "버섯"),
  T("crystal-test", "crystal", "twoTier", {}, 56, 52, 7401, "수정 시험", "수정"),
  T("badlands-test", "badlands", "cliffTerrace", { cave: true }, 60, 44, 7501, "황무지 시험", "황무지"),
  T("savanna-test", "savanna", "meadowRoad", {}, 64, 44, 7601, "사바나 시험", "사바나"),
  T("taiga-test", "taiga", "lakeShore", {}, 60, 46, 7701, "타이가 시험", "타이가"),
  T("tundra-test", "tundra", "riverFord", {}, 60, 44, 7801, "툰드라 시험", "툰드라"),
  T("blight-test", "blight", "caveRoad", {}, 56, 44, 7901, "오염 시험", "오염"),
  T("skyisle-test", "skyisle", "islands", { count: 4 }, 72, 40, 8001, "하늘섬 시험", "하늘섬"),
  T("tropical-test", "tropical", "coast", {}, 64, 44, 8101, "열대 시험", "열대"),
  { ...T("border-test", "jungle", "riverFord", {}, 64, 44, 8201, "경계 시험", "경계"), zone: (x, y, b) => x > b.W * 0.55 + 3 * Math.sin(y / 5) },
];
