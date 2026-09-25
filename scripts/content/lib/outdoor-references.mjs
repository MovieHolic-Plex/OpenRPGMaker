// AI-assistant guidance for the outdoor places of tiledata/rpg-outdoors (towns, sacred places, scenes, fields, the
// 80×64 great valley and the world map), added to the field-route categories by prepare-field-routes-references.mjs.
// Per map: 「출구와 지형·배치 규칙」 (what to lay, with tile numbers, group ids and the bans) and 「N행부터 전체 배열」.
import fs from "node:fs";

const OUT = "tiledata/rpg-outdoors";
const SIDE = { west: "서", east: "동", north: "북", south: "남" };
const CLIMATE_NAME = { forest_harmony: "숲(초록)", forest_harmony_snow: "설원", forest_harmony_volcano: "화산(재)", forest_harmony_desert: "사막", forest_harmony_autumn: "가을", easyrpg_chipset_world: "월드맵" };
const GREEN = new Set(["forest_harmony"]);
const SNOW_WALLS = JSON.parse(fs.readFileSync("tiledata/climate-villages/sheets.json")).terrain.snowWalls;
const snowWallText = () => {
  const by = new Map();
  for (const [src, dst] of SNOW_WALLS) by.set(src, [...(by.get(src) ?? []), dst]);
  return [...by].map(([src, d]) => `${src}→${d.join("/")}`).join(" ");
};

export function loadOutdoors() {
  const c = JSON.parse(fs.readFileSync(`${OUT}/catalog.json`));
  const validation = JSON.parse(fs.readFileSync(`${OUT}/validation.json`));
  return { c, validation };
}

/** The category key a plan's guidance goes to (the keyed world copy is documented under the bundled world tileset). */
export const categoryKey = (plan) => (plan.world ? "easyrpg_chipset_world" : plan.tilesetId);

function fillRules(ts) {
  const green = GREEN.has(ts), barren = ts === "forest_harmony_desert" || ts === "forest_harmony_volcano";
  return `## 채우기 규칙 (빈칸 게이트: 마을·장면 한 화면 17×13 에 맨땅 40% 이하·가장 큰 빈 네모 4칸 이하, 필드 50%·5칸)
맨땅(plain)으로 세는 칸: 잔디 240·잔디 질감 1140~1147, 포장 몸통 포석 190·석판 307·자갈 310·흙 421·모래 424·눈 67. 빈칸은 **자연 덩이로 먼저** 줄이고, 생활 소품은 주인이 있을 때만 둔다.
${barren
    ? `- **나무를 거의 두지 않는다**(사용자 2026-09-25: 사막·화산은 나무 비중이 적어야 한다). 잎 달린 나무 도장(960~1123)·나무 키트·수관 덩이(굽이숲 2550~2596·수관 1564~1594)·덤불 289 를 쓰지 않는다. 나무 대신 낱개 바위·덤불을 흩뿌리지도 않는다.
- 나무는 잎 없는 나무(2880~3029, 타일 그룹 bare-trees:big-1…3·mid-1…3·small-1…3·shrub-1…5)를 **덩이로만** 세운다: 큰/중간 한 그루 + 곁나무 0~2 + 밑동 옆 마른 덤불(shrub), 바위 537 은 덩이 열에 셋 정도만(선인장은 덩이에 붙이지 않는다). 덩이 사이는 맵 가장자리 띠 8칸·안쪽 13칸, 집·길·문·계단·다리 2칸 밖, 물·절벽·다른 물건 1칸 밖. 같은 밑동 줄에 세 그루 넘게 늘어세우지 않는다(울타리처럼 보인다). 도우미: scripts/content/lib/bare-trees.mjs arrangeBareGroves(사막 물가 야자 770 은 plantPalmGroves). 이 맵들은 채우기가 남긴 1×2 자리를 덩이 후보로 주었다.
- **빈칸은 땅으로 메운다**(개정6, 사용자 2026-09-25: 「돌·선인장·풀이 너무 많다」, 「화산은 균열·용암, 모래는 사구」). 낱개 바위 537·29 무리·선인장 769 무리·키큰 풀로 메우지 않는다. 기후 지형(3030~, 같은 타일셋의 「${CLIMATE_NAME[ts]} 마을」 분류 문서 「기후 지형」 절)을 깐다: ${ts === "forest_harmony_volcano" ? "식은 용암 판(오토타일 volcano_lava_plate_47, 2×2 덩이로 3×3 이상)·용암 균열(volcano_lava_crack, 1칸 폭 가지)·작은 용암 웅덩이 1~2(volcano_lava_pool_47, 4×4 이상, 곁에 분기공 3054/3084·유황)·현무암 기둥 한 무리(가장자리 띠), 흑요석·재 더미는 균열 곁에만. 화산 봉우리는 맵에 서너 쌍까지. 마른 가지 740 은 쓰지 않는다." : "사구(climate-terrain:dune-*, 3×2·4×3·6×3; 필드는 사구 3~6개를 한두 칸 띄운 사구 벌판, 바닥은 모래 물결)·모래 물결 3300~3303 덩이·갈라진 땅(desert_cracked_earth_47, 물 6칸 밖)·사암 메사 1~2(가장자리 띠)·외딴 곳 뼈·묻힌 기둥 한 곳·선인장 무리(큰 선인장 1 + 작은 선인장 1~2) 두세 곳. 들꽃은 물가 7칸 안에만 묶음으로."} 길·포장·문 앞·집 한 칸 둘레에는 깔지 않고, 통행 불가 조각은 물·절벽·길에서 한 칸 띄우며 문·출구로 가는 길을 끊으면 되돌린다. 도우미: scripts/content/lib/outdoor-kit.mjs \`OutdoorMap.climateGround\`(lib/climate-terrain.mjs ${ts === "forest_harmony_volcano" ? "dressVolcanoGround" : "dressDesertGround"})`
    : `- 나무 덩이: 나무 키트(활엽수 978~980/1008~1010·1038~1040/1068~1070 3×4, 둥근 덤불 983~985/1013~1015/1043~1045 3×3, 작은 덤불 1073/1074/1103/1104 2×2)를 어깨를 붙여 3~7그루씩. 줄·바둑판으로 세우지 않는다.${ts === "forest_harmony_snow" ? " 설원은 침엽수 도장도 2~4그루 덩이로 쓴다." : ""}`}
${ts === "forest_harmony_snow" ? `- **눈 쌓인 성벽**(개정6): 설원 시트의 성벽·성탑·문루 윗면은 눈 얹힌 사본으로 바꿔 깐다 — 흉벽 톱니 위 눈 3줄, 윗면 석판은 반쯤 눈 더미, 성벽 위 길(412·21)은 튀어나온 돌만 하얗게, 안쪽 벽면 51 은 **맨 윗줄에만** 눈 처마(두 줄 벽면의 아랫줄은 51 그대로), 성탑 머리 24·25 는 눈 모자. 원본→사본(여러 개면 칸 위치로 번갈아): ${snowWallText()}. 통행·레이어·밑칠은 원본과 같다. 도우미 scripts/content/lib/climate-terrain.mjs snowCastleTops(map, snowWalls).\n` : ""}- 꽃: 들꽃 348 을 **3~5칸 묶음**(2×2 속 + 한두 칸)이나 화단 키트(꽃 화단·화분)로만. 한 칸씩 흩은 「색종이 밭」 금지.
- 덤불 289 묶음·작은 덤불 2×2, 바위 537·29 는 3~6칸 무리로 절벽 발치·물가·숲 가장자리에만. 한 줄(가로·세로 3칸 이상 일렬) 금지.
${green ? `- 키큰 풀: E builtin_tall_grass(243~335, 숲 수관 1칸 안)·F builtin_tall_grass_light(1124~1126/1154~1156/1184~1186, 외톨이 1127, 속 1157, 트인 곳)·G builtin_tall_grass_short(1128~1130/1158~1160/1188~1190, 외톨이 1131, 속 1161, 집·길 3칸 안). 덩이마다 한 종류, 2×2 이상, variantMap 으로 이웃에 맞춰 고른다(scripts/content/lib/tall-grass.mjs arrangeTallGrass).` : `- 키큰 풀 E/F/G 금지: 모래·눈·재·가을 시트에 깐 풀(재칠본 포함)은 초록 띠나 진흙 얼룩으로 읽힌다. 이 시트에는 풀 덩이를 깔지 않는다.`}
- 금지 재료: 짙은 수풀 builtin_undergrowth(9·11·39~41·69~71·99~101, 검은 초록 구불이), 어두운 덤불 986~988·1016~1018·1046~1048(구덩이로 보임), 마른 가지 740·바위·뼈 383·부서진 울타리 410 을 고르게 흩뿌리기(절벽·폐허 벽·물가 곁 1~3곳에 몰아 둔다).
- 주인 없는 소품 금지: 벤치·통나무·상자·항아리·허수아비·표지판은 2칸 안에 이유(집 문·가게·밭·우물·부두·작업장·길)가 있어야 한다. 없으면 두지 말고 뺀다.
`;
}

const block = (o) => "```json\n" + JSON.stringify(o) + "\n```\n";
const rows = (a, w) => "```text\n" + Array.from({ length: a.length / w }, (_, y) => a.slice(y * w, (y + 1) * w).join(" ")).join("\n") + "\n```\n";

/** Add the outdoor guides and per-map documents through `doc(key, id, name, markdown)`; returns the plans used. */
export function outdoorDocs(doc) {
  const { c, validation } = loadOutdoors();
  const byKey = {};
  for (const p of c.plans) (byKey[categoryKey(p)] ??= []).push(p);
  for (const [key, plans] of Object.entries(byKey)) {
    const world = key === "easyrpg_chipset_world";
    doc(key, `outdoor-guide-${key.replace("forest_harmony_", "").replace("forest_harmony", "forest").replace("easyrpg_chipset_", "")}`,
      `야외 장소 규칙 · ${CLIMATE_NAME[key]} (마을·성소·장면·필드${world ? "·월드맵" : ""})`,
      world ? worldGuide(plans[0]) : `# 야외 장소 ${plans.length}곳 — ${CLIMATE_NAME[key]} 시트

tilesetId=${key}. 좌표는 0기준, 16px. 지형과 배치만 있고 이벤트(문 이동·NPC)는 없다. 출구마다 어느 맵과 맞닿는지(meets)만 적었다.
${key === "forest_harmony" ? "숲마을 「다양한 마을」 타일셋(이식 포함 2730칸)으로 그렸다. 수관·절벽·폭포·다리·항구 조각(나룻배·계류 말뚝·밧줄·닻·통·상자 = harbor-kit 그룹, 이식 2657~2669·2695~2699·2703~2729)은 이식 번호다.\n" : "숲마을 칸 번호를 그대로 쓰는 기후 재칠 시트다.\n"}
## 부품
- 길: 흙길 오토타일 forest_harmony_road_47(두 칸 폭). 광장 포석 builtin_cobble, 성 안뜰 builtin_stone_court.
- 집: 숲마을 「다양한 마을」 집 도장(템플릿 번호)을 그대로 찍고 문 앞 한 칸(front)을 길에 잇는다. 마당 키트(약초·빨래·목공·창고·농사·고기잡이·대장일·주막·꽃·가게·경비·광석·유목)는 집 옆 한 면에 붙인다.
- 절벽: 숲마을 절벽 열 문법(윗선→반복 면→밑단), 돌계단은 폭 2: 111(왼 난간)|113(오른 난간)을 줄마다(난간 없는 2689 금지). 절벽 끝은 숲에 묻는다. 강은 세로 위주, 다리는 곧은 두 줄에.
- 항구: 부두(판자) 끝 옆 물에 나룻배(8×4, 위층), 판자 가장자리 물 칸에 계류 말뚝, 부두 뿌리 땅에 밧줄·닻·통·상자를 붙여서 한 덩이. 들판 한가운데 금지.
${fillRules(key)}
## 이 시트의 장소
${plans.map((p) => `- ${p.name} (${p.id}, ${p.width}×${p.height}, ${p.gate === "field" ? "필드" : "마을·장면"} 게이트)`).join("\n")}
`);
    for (const p of plans) {
      const m = c.maps[p.id], v = validation.find((r) => r.id === p.id) ?? {};
      if (world) { worldDocs(doc, key, p, m, v); continue; }
      const props = (p.placements ?? []).filter((o) => o.kind === "prop").map(({ name, x, y, w, h, owner, purpose }) => ({ name, x, y, w, h, owner, purpose }));
      const groves = (p.placements ?? []).filter((o) => o.kind === "grove").map(({ x, y, trees, props }) => ({ foot: [x, y], trees: trees.map((t) => ["bare-trees:" + t.id, t.x, t.y]), props }));
      const other = (p.placements ?? []).filter((o) => o.kind !== "prop" && o.kind !== "grove").map(({ name, kind, x, y, w, h, group, cells }) => ({ name, kind, x, y, w, h, group, cells }));
      doc(key, p.id, `${p.name} · 출구와 지형·배치 규칙`, `# ${p.name}

${p.purpose}. ${p.note}. ${m.width}×${m.height}, tilesetId=${p.tilesetId}. 통행 검사 시작 (${(p.entry ?? []).join(",")}).

![${p.name}](image:${p.id})

## 출구 — 어디와 맞닿나
${p.exits.map((e, n) => `- 출구${n} ${SIDE[e.side]}쪽 (${e.x},${e.y}) → ${e.meets}`).join("\n")}

## 지형
${block({ cliffs: p.cliffs, stairs: p.stairs, falls: p.falls?.length ? p.falls : undefined, landmarks: p.landmarks })}
## 집 (템플릿·역할·문)
${block((p.houses ?? []).map(({ template, role, x, y, w, h, door, front, yard, yardSide }) => ({ template, role, x, y, w, h, door, front, yard, yardSide })))}
## 소품 (주인·이유가 있는 것만 남겼다)
${block(props)}
## 포장·다리·부두·덩이
${block(other)}
${p.bareTreeSpots?.length ? `## 잎 없는 나무 자리 (비워 둠)\n1×2 칸, 좌표는 윗칸. 잎 없는 나무 그림이 시트에 들어오면 이 자리에 찍는다(지금은 맨땅).\n${block(p.bareTreeSpots)}` : ""}
${groves.length ? `## 잎 없는 나무 덩이 (lib/bare-trees.mjs arrangeBareGroves)\n덩이마다 밑동 중심 foot, 나무 [그룹 id, 왼쪽 위 x, y], 밑동 옆 props [{tile, x, y}](바위 537·마른 덤불·선인장 769).\n${block(groves)}` : ""}
${fillRules(p.tilesetId)}
## 검사
${block({ reachable: v.reachable, emptiness: v.emptiness, leaks: v.leaks })}
전체 두 레이어는 「${p.name} · 0행부터 전체 배열」 문서가 정답이다.
`);
      arrays(doc, key, p, m);
    }
  }
  return c.plans;
}

function arrays(doc, key, p, m) {
  // As few row documents as the 120k markdown limit allows (one for most maps).
  const perRow = m.width * 5 * 2 + 20, step = Math.max(8, Math.min(m.height, Math.floor(110_000 / perRow)));
  for (let y = 0; y < m.height; y += step) {
    const end = Math.min(y + step, m.height);
    doc(key, `${p.id}-rows-${y}`, `${p.name} · ${y}행부터 전체 배열`, `# ${p.name} 전체 배열 y=${y}..${end - 1}

폭 ${m.width}, x=0..${m.width - 1}, -1은 빈 칸. mapId=${m.id}, tilesetId=${m.tilesetId}, 16px.

## lowerTiles
${rows(m.lowerTiles.slice(y * m.width, end * m.width), m.width)}
## upperTiles
${rows(m.upperTiles.slice(y * m.width, end * m.width), m.width)}
`);
  }
}

function worldGuide(p) {
  return `# 월드맵 — EasyRPG 월드 칩셋

tilesetId=easyrpg_chipset_world(시트 tex_easyrpg_chipset_world, 30열·16px). 좌표는 0기준.

**분홍 키 주의**: 이 시트의 물건 칸(성·집·동굴·탑)은 #ff678b 바탕에 그려져 있고 번들 타일셋에는 투명색이 없다. 아이콘을 위층에 올리면 분홍 네모가 보이므로, 월드맵은 같은 그림·같은 오토타일의 사본 타일셋 **oprn_world_keyed**(transparentColor "#ff678b")로 그렸다. 직접 그릴 때도 타일셋의 투명색을 #ff678b 로 둔다.

## 바닥 (아래층, 8방향 마스크로 variantMap 칸을 고른다)
- 바다: harness-world-coast-v1-sea (몸통 120, 볼록 0·세로 30·가로 60·오목 90). 맵 가장자리 밖은 바다로 친다. 통행 불가.
- 평야 240(통행). 흙길 harness-world-v2-terrain-dirt(몸통 67). 모래 -sand(70). 설원 -snow(190, 눈 숲·설산·바다와 이어짐). 짙은 풀 -tall-grass(304).
- 숲 -forest(421)·산맥 -mountain(424)·눈 숲 -snow-forest(307)·설산 -snow-mountain(310)·독늪 -marsh(187): 통행 불가.
## 아이콘 (위층, 평야 위)
성 322 323/352 353, 성채 320 321/350 351, 요새 440 441/470 471, 화산 438 439/468 469, 큰 나무 318 319/348 349, 원형 탑 380/410, 유적 381/411, 집 262, 눈 집 263, 오두막 292, 신전 382, 동굴 413(통행), 묘비 88, 해골 118, 마법 샘 125(아래층).
## 배치 규칙
- 장소 아이콘은 둘레 한 칸을 비우고, 아이콘 바로 아래 칸(접근 칸)에 흙길이 닿는다. 모든 접근 칸이 걸어서 이어진다.
- 흙길은 산맥·늪·바다를 지나지 않는다(숲은 베어 지난다). 장소 사이 최소 신장 트리 + 고리 몇 개.
- 눈은 북쪽 띠, 사막은 남동, 늪은 서쪽. 산맥은 줄기(폭 1.5~2)로 두고 사이에 관문 틈을 남긴다.
- 빈칸 게이트(월드): 평야 240만 맨땅으로 세고 한 화면 17×13 에 70% 이하·가장 큰 빈 네모 7칸 이하. 숲·짙은 풀 덩이로 채운다.
`;
}

function worldDocs(doc, key, p, m, v) {
  doc(key, p.id, `${p.name} · 장소와 지형·배치 규칙`, `# ${p.name}

${p.purpose}. ${p.note}. ${m.width}×${m.height}, tilesetId=${p.tilesetId}(easyrpg_chipset_world + transparentColor #ff678b).

![${p.name}](image:${p.id})

## 장소 (아이콘 좌상단, 접근 칸 = 흙길이 닿는 칸, placeId = 야외 장소 맵 id)
${block(p.places)}
## 지형 비율 (칸 수)
${block(p.terrain)}
## 검사
${block(v)}
전체 두 레이어는 「${p.name} · 0행부터 전체 배열」 문서가 정답이다.
`);
  arrays(doc, key, p, m);
}
