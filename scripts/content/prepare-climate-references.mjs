// Bundle-owned guidance for tiledata/climate-villages → src/assets/sharedClimateVillageReferences.json. No project/host writes.
// One category per climate tileset (the AI reads guidance from the tileset in use); docs are also copied as tiledata/climate-villages/*.md.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const dir = "tiledata/climate-villages", target = "src/assets/sharedClimateVillageReferences.json", preview = "public/assets/climate-village-references";
const c = JSON.parse(fs.readFileSync(dir + "/catalog.json")), validation = JSON.parse(fs.readFileSync(dir + "/validation.json"));
const sheets = JSON.parse(fs.readFileSync(dir + "/sheets.json")), data = JSON.parse(fs.readFileSync("src/assets/climateVillageTilesets.json"));
const block = (o) => "```json\n" + JSON.stringify(o) + "\n```\n";
const rows = (a, w) => "```text\n" + Array.from({ length: a.length / w }, (_, y) => a.slice(y * w, (y + 1) * w).join(" ")).join("\n") + "\n```\n";
const CATEGORY = {
  forest_harmony_snow: { id: "climate-snow-villages-v6", name: "설원 마을 · 눈 덮인 숲마을과 얼어붙은 못 (잎 없는 나무 개정6)", description: "숲마을을 눈으로 다시 칠한 시트의 규칙. 칸 번호는 숲마을과 같고, 물 칸의 얼음 사본(걸을 수 있음)으로 못을 얼린다. 눈 얹힌 고목(2880~) 번호, 설원 마을 세 곳의 전체 배열과 통행 검사" },
  forest_harmony_volcano: { id: "climate-volcano-villages-v6", name: "화산 마을 · 재와 용암, 그을린 고목 (잎 없는 나무 개정6)", description: "숲마을을 재·용암으로 다시 칠한 시트의 규칙. 칸 번호·통행은 숲마을과 같고 물 칸이 모두 용암, 나무다리는 현무암 다리다. 잎 달린 숲 대신 그을린 고목 덩이(2880~) 짓는 법, 화산 봉우리 놓는 법과 화산 마을 세 곳의 전체 배열" },
  forest_harmony_desert: { id: "climate-desert-villages-v6", name: "사막 마을 · 모래와 사암, 바랜 고목 (잎 없는 나무 개정6)", description: "숲마을을 모래·사암으로 다시 칠한 시트의 규칙. 칸 번호·통행은 숲마을과 같고 물은 오아시스 물 그대로다. 잎 달린 숲 대신 바랜 고목 덩이(2880~) 짓는 법, 물가 야자 무리와 사막 마을 두 곳의 전체 배열" },
  forest_harmony_autumn: { id: "climate-autumn-villages-v5", name: "가을 마을 · 단풍 든 숲마을 (마을 채우기 개정5)", description: "숲마을을 금빛 풀밭과 단풍으로 다시 칠한 시트의 규칙. 칸 번호·통행·물은 숲마을과 같다. 가을 마을 두 곳의 전체 배열" },
};
const docs = Object.fromEntries(Object.keys(CATEGORY).map((k) => [k, []]));
const doc = (tilesetId, id, name, markdown) => {
  fs.writeFileSync(`${dir}/${id}.md`, markdown.replaceAll(/\(image:([^)]+)\)/g, "(images/$1.png)").trimEnd() + "\n");
  docs[tilesetId].push({ id, name, markdown });
};
const plansOn = (ts) => c.plans.filter((p) => p.tilesetId === ts);
const reach = (ts) => block(validation.filter((r) => plansOn(ts).some((p) => p.id === r.id)));
const list = (ts) => plansOn(ts).map((p) => `- ${p.name} (${p.id}, ${p.width}×${p.height}, 원본 숲마을 ${p.from}): ${p.note}.`).join("\n");
const check = "```bash\npython3 scripts/content/build-climate-chipsets.py     # 시트 두 장 + sheets.json\nnode scripts/content/prepare-climate-tilesets.mjs    # 타일셋 정의\nnode scripts/content/author-climate-villages.mjs     # 맵 + 통행 검사(실패하면 멈춤)\n```\n";
const common = `## 공통 — 숲마을과 같은 번호
- 시트는 「숲마을 · 거리별 잔디」(forest_harmony)와 그 이식 칸(2550~2729)을 **한 장으로 구운 뒤 화소만 다시 칠한 것**이다. 0~${sheets.baseCount - 1}번 칸의 뜻·통행·우선순위·오토타일은 숲마을과 같다.
- 그래서 집·절벽·계단·흙길·숲 수관 조립, 공용 숲마을 문서(다양한 마을·컨셉 마을)의 배치 규칙과 번호를 **그대로** 쓴다. 숲마을 맵을 기후판으로 바꿀 때는 맵의 tilesetId만 바꾸면 모양이 그대로 유지된다.
- 이식(tileGrafts)이 없다. 이식 그림은 이미 시트에 구워져 있으므로 이 타일셋에 새로 이식하지 말 것.
- 수관 속은 검은 판이 아니라 이 시트 자신의 잎 테두리로 채워져 있다(가장자리 칸의 속 부분 ×0.78). 8방향이 모두 수관인 속 칸은 2칸 안에 빈 땅이 있으면 얕은 속 [2568, 2597~2601](×0.60), 없으면 깊은 속 [2602~2607](×0.46) 중 하나를 칸 위치로 고른다(오토타일 그룹 interiorVariants). 숲마을 맵을 옮기면 속 변형도 번호 그대로 따라온다.
- 라벨은 기후에 맞게 앞말이 붙어 있다(예: 「눈 덮인 잔디」, 「용암 · 물 오토타일」). 번호 뜻은 숲마을 라벨과 같다.
- 빈 땅은 숲마을처럼 채운다(개정5, 2026-09-24 검수 반영): 한 변 5칸짜리 빈 정사각형이 없고 17×13 화면마다 빈 땅이 40% 이하가 될 때까지 **덩이 장면**(덤불숲·작은 덤불숲·바위와 덤불·덤불 한 쌍·키큰 풀 덩이, 가을은 나무 덩이와 꽃 핀 덤불도)을 놓는다. 낱개 꽃·낱개 덤불 점은 두지 않는다.
- 키큰 풀은 E/F/G 세 종류(PR #1421, lib/tall-grass.mjs arrangeTallGrass): 덩이마다 한 종류, 2×2 이상, 볼록 모서리 깎음. 수관 1칸 안 E(짙음), 집·길 3칸 안 G(짧음), 나머지 F(밝음). 이 시트에서 서리 내린 풀·재 덮인 풀·마른 풀·단풍 든 풀로 칠해져 있다. 설원·화산은 집·길 곁 G 를 걷고 새 덩이도 E·F 만 쓴다(G 없이는 빈칸 게이트를 못 넘는 마을만 G 를 남긴다 — 편집 기록 buried-grass.kept).
- 설원·화산·사막에는 들꽃(348)·꽃덤불(288)을 두지 않는다: 덤불에 붙은 꽃은 같은 덤불(289)로, 나머지 꽃은 걷는다. 설원의 활엽수 3×4 는 눈 덮인 둥근 덤불 3×3 으로 바꾸고, 설원·사막의 채우기는 나무 장면을 쓰지 않는다. 설원 종탑 언덕은 강과 폭포 아래 소가 얼었다(폭포만 흐른다). 집·소품·마당·문앞 칸은 건드리지 않는다.
- 한 맵에서 숲마을 타일셋과 기후 타일셋을 섞을 수 없다(맵 하나 = 타일셋 하나). 기후가 바뀌는 경계는 맵을 나눠 만든다.
`;

// Leafless trees (bare-trees.py → sheets.bareTrees): numbers, groups, how a grove is built, what not to do.
const bareNames = (ts) => Object.fromEntries((Object.values(data.climates).find((x) => x.id === ts).extraTileGroups ?? []).map((g) => [g.id, g.name]));
const stampRows = (st) => Array.from({ length: st.h }, (_, y) => st.tiles.slice(y * st.w, (y + 1) * st.w).map((t) => String(t).padStart(4)).join(" ")).join("\n");
const bareStamps = (ts) => sheets.bareTrees.stamps.map((st) => `- bare-trees:${st.id} 「${bareNames(ts)["bare-trees:" + st.id]}」 ${st.w}×${st.h}${st.kind === "shrub" ? " (위층 1칸, 통행 불가)" : " (윗줄들 = 수관·줄기 위층·통과, 맨 아랫줄 = 밑동 아래층·통행 불가)"}:\n\`\`\`text\n${stampRows(st)}\n\`\`\``).join("\n");
const bareSection = (ts, { cleared }) => `## 잎 없는 나무 — ${sheets.bareTrees.first}~${sheets[ts.replace("forest_harmony_", "")].count - 1}번 칸 (bare-trees:*)
시트 ${sheets.bareTrees.first / 30}행부터 다섯 줄에 잎 없는 고목이 있다. 번호는 설원·화산·사막 시트가 모두 같고 그림만 기후 색이다(가을·숲마을엔 없다).
- 종류: 큰 고목 4×5 ×3 (big-1~3), 중간 3×4 ×3 (mid-1~3), 작은 2×3 ×3 (small-1~3), 마른 덤불 1×1 ×5 (shrub-1~5). 타일셋 tileGroups 에 같은 id 로 들어 있다(previewMap·cellLayers 포함).
- 층: 도장의 윗줄들(수관·줄기)은 **위층**에 놓고 지나갈 수 있다(사람 위에 그려진다). **맨 아랫줄(밑동)** 은 **아래층**에 놓고 지나갈 수 없다(땅 240 받침이 자동으로 깔린다). 마른 덤불은 위층 1칸, 통행 불가.
- 도장의 -1 은 **그 칸을 건드리지 않는다**는 뜻이다(나무 그림이 없는 칸). 번호를 채워 넣지 말 것.
- 놓는 자리: 도장 상자 전체가 빈 땅(아래층 240·잔디류, 위층 비움)이어야 하고 밑동 칸은 240 위에만. 수관 칸은 키큰 풀 위도 된다.

${bareStamps(ts)}

### 덩이 짓는 법 (이대로 깐다)
1. 덩이 하나 = 이끄는 나무 한 그루(큰 또는 중간) + 그 옆에 바짝 붙인 곁나무 1~2그루(작은·중간, 안쪽 덩이는 0~1) + 이끄는 나무 **밑동 옆** 칸에 바위 537 1~2개·마른 덤불 1~2개${ts === "forest_harmony_desert" ? "(안쪽 덩이는 가끔 선인장 769 하나)" : ts === "forest_harmony_volcano" ? "(화산은 바위 없이 마른 덤불만 — 회백색 바위는 잿빛 땅에서 뼈처럼 보인다)" : ""}.
2. 곁나무는 이끄는 나무 상자의 왼쪽 또는 오른쪽에 붙이고, 밑동 줄이 이끄는 나무 밑동과 같은 줄에서 두 줄 안으로 맞춘다.
3. 덩이 간격: 맵 가장자리 4칸 띠 안은 덩이 중심끼리 **8칸**, 안쪽은 **13칸**. 가장자리를 촘촘히 두르고 마을 안쪽은 드물게.
4. 덩이 발치에 키큰 풀(2×2 이상 덩이, lib/tall-grass.mjs arrangeTallGrass 로 정리)을 깔면 나무와 한 덩이로 읽힌다${ts === "forest_harmony_desert" ? "" : "(설원·화산은 집·길 3칸 밖에서만 — G 가 되지 않게)"}.
5. 놓은 뒤 입구에서 모든 집 문 앞까지 통행 검사(canMove)를 다시 한다. 막히면 그 덩이를 통째로 뺀다.

### 금지
- **낱개로 흩뿌리지 않는다**: 나무 한 그루·바위 하나·덤불 하나를 빈 땅에 고르게 뿌리지 말 것. 바위·마른 덤불·선인장은 고목 밑동 옆에 붙은 덩이의 일부로만 둔다.
- **집·길·문 앞·계단 끝·다리 끝·울타리 2칸 안에는 두지 않는다**(나무 칸 어느 하나도). 물·절벽·다른 물건과는 1칸 띄운다.
- **나무끼리 칸을 겹치지 않는다**: 한 칸에 위층은 하나뿐이다. 도장 상자(빈 칸 포함)가 서로 겹치면 안 된다.
- 잎 달린 나무 도장(960~1123: 활엽수·큰 참나무·숲 벽·기둥·둥근/작은 덤불)과 섞지 말 것.
${cleared ? `
### 잎 달린 숲을 걷었다 (이 기후의 마을)
- 수관 숲(2550~2609)·숲 줄기/연속 숲(1200~1463)·잎 달린 나무 도장(960~1123)·덤불 289 를 모두 맨땅으로 되돌리고 그 자리에 위 방식의 고목 덩이를 세웠다. 걷힌 숲에 붙어 있던 바위 537 도 뺐다.
- 숲이 끝을 가려 주던 절벽은 **맵 끝까지 이어 붙였다**(그 줄의 몸통 칸으로, 가는 길에 집·길이 없을 때). 이어 붙일 수 없는 끝은 윗단 옆 가장자리 칸(동쪽 2678, 서쪽 2677)을 맵 끝까지 세워 막았다. 계단을 닫고 봤을 때 절벽 윗단과 아랫단이 숲마을 때보다 더 이어지지 않는지 검사한다.
- 남은 빈 땅은 키큰 풀 덩이로 채웠다(빈칸 게이트). 풀 덩이끼리 닿아도 되는 마른 풀밭(growMeadows)으로 마저 메웠다 — 나무를 더 늘려 채우지 않는다.
- 코드: \`scripts/content/lib/bare-trees.mjs\` — clearLeafyTrees(map) → arrangeBareGroves(map, { tileset, houses, keep, reserved, sites, seed, accept, undergrowth }) → growMeadows(...). 절벽: \`lib/climate-edits.mjs\` extendClearedCliffEnds·cliffEndLedge.
` : ""}`;

const iceTable = sheets.snow.ice.map(([w, i]) => `${w}→${i}`).join(" ");
doc("forest_harmony_snow", "snow-guide", "설원 규칙 · 번호는 숲마을, 못은 얼음 사본으로", `# 설원 마을 — 눈 덮인 숲마을

tilesetId=forest_harmony_snow, 시트 tex_forest_harmony_snow(30열·16px, ${sheets.snow.count}칸). 좌표는 0기준.

${common}
## 무엇이 하얘졌나
- 땅: 마을 맵이 아래층에 쓰는 잔디·풀 칸이 눈밭이 된다(밝은 풀 → 흰 눈, 그늘 → 푸른 그림자). 흙길·돌길·절벽 흙벽은 그대로 보인다(눈 속에 난 길).
- 나무·수풀: 수관 윗가장자리와 밝은 잎에 눈이 얹힌다. 숲 벽(960~1109)도 같다.
- 지붕: 집 지붕 칸(${sheets.roofTiles.length}종)에 눈이 덮인다. 벽·창·문은 원래 색.
- 물: **얼지 않는다.** 강·개울·폭포는 흐르는 물 그대로 둔다(통행 불가). 차가운 물빛이 눈밭과 대비된다.

## 얼어붙은 못 — 얼음 사본 ${sheets.snow.ice.length}칸
- 물 칸 w마다 얼음 사본 i = ${sheets.baseCount} + 순번이 시트 끝에 붙어 있다. 물가 모양(모서리·곡선)이 물 칸과 똑같으므로 **못 전체를 같은 대응표로 바꾸면 물가가 그대로 이어진 얼음판**이 된다.
- 얼음 칸은 걸을 수 있다(사방 통행). 단 원래 라벨에 「폭포」가 있는 칸의 사본은 얼어붙은 폭포라 통행 불가로 남는다.
- 일부만 얼리지 말 것: 한 못 안에서 물 칸과 얼음 칸을 섞으면 경계에 물가 테두리가 없어 끊겨 보인다. 못 하나(울타리·물가로 닫힌 한 덩어리)를 통째로 바꾸고, 강처럼 맵 끝으로 이어지는 물은 흐르는 물로 둔다.
- 오토타일 forest_harmony_ice_47 「얼어붙은 못 · 얼음판」은 호수 오토타일(forest_harmony_lake_47)의 번호를 얼음 사본으로 바꾼 것이다. 새 얼음판을 칠할 때 쓴다.
- 대응표(물→얼음):
\`\`\`text
${iceTable}
\`\`\`

${bareSection("forest_harmony_snow", { cleared: false })}
설원 마을 세 곳의 맵은 이번 개정에서 바뀌지 않았다(잎 없는 나무는 칸만 추가).

## 검사
마을 입구에서 런타임 이동 규칙(canMove)으로 모든 집 문 앞, 얼린 못은 울타리 문 쪽 얼음 칸과 가운데 얼음 칸까지 닿는지 확인했다.
${check}
${reach("forest_harmony_snow")}
## 실제 구분
${list("forest_harmony_snow")}
`);

doc("forest_harmony_volcano", "volcano-guide", "화산 규칙 · 물은 용암, 다리는 현무암, 봉우리는 빈 재밭에", `# 화산 마을 — 재와 용암의 숲마을

tilesetId=forest_harmony_volcano, 시트 tex_forest_harmony_volcano(30열·16px, ${sheets.volcano.count}칸). 좌표는 0기준.

${common}
## 무엇이 바뀌었나
- 땅: 잔디·풀 칸이 회색 재가 된다. 흙길은 그대로라 재밭 위 길이 또렷하다.
- 나무·수풀: 시트의 잎 달린 나무·숲 벽은 그을린 검은 잎으로 칠해져 있지만, **화산 마을에서는 쓰지 않는다** — 잎 없는 그을린 고목(2880~) 덩이로 바꿨다(아래).
- 물: **물 칸 ${sheets.volcano.lava.length}종이 모두 용암**으로 칠해져 있다(강·못·해자·바다·폭포 모두). 번호·통행은 물과 같아 지나갈 수 없다. 폭포 칸은 용암 폭포가 된다.
- 다리: 나무다리 ${sheets.volcano.stoneBridges.join("·")}는 현무암 돌다리로 칠해져 있다. 용암을 건너는 곳엔 이 다리를 쓴다. 통행은 원래 나무다리와 같다.
- 지붕·벽·성벽은 원래 색. 파란 지붕·청회색 성벽은 물이 아니므로 용암이 되지 않는다(물 판정은 색이 아니라 물 칸 번호로 했다).

${bareSection("forest_harmony_volcano", { cleared: true })}
## 화산 봉우리
시트의 원래 칸에 작은 화산 봉우리 두 개가 있다(위층, 통행 불가).
- 잠든 봉우리 2×2: 858 859 / 888 889
- 분화하는 봉우리 2×2: 918 919 / 948 949 (꼭대기에 용암)
- 둘을 나란히 4×2로 놓으면 봉우리 한 쌍이 된다: 윗줄 858 859 918 919, 아랫줄 888 889 948 949.
- 놓는 자리: 아래층이 맨 재(240)이고 위층이 빈 칸인 곳, **둘레 한 칸까지** 비어 있는 곳. 집 문 앞에서 6칸 이상 떨어뜨린다. 길·다리·울타리 위에 놓지 않는다. 놓은 뒤 통행 검사를 다시 한다.

## 검사
마을 입구에서 런타임 이동 규칙(canMove)으로 모든 집 문 앞에 닿는지 확인했다(봉우리를 놓은 뒤).
${check}
${reach("forest_harmony_volcano")}
## 실제 구분
${list("forest_harmony_volcano")}
`);

doc("forest_harmony_desert", "desert-guide", "사막 규칙 · 번호는 숲마을, 나무 자리엔 야자·선인장", `# 사막 마을 — 모래와 사암의 숲마을

tilesetId=forest_harmony_desert, 시트 tex_forest_harmony_desert(30열·16px, ${sheets.desert.count}칸). 좌표는 0기준.

${common}
## 무엇이 바뀌었나
- 땅: 잔디·풀 칸이 모래밭이 된다(밝은 풀 → 밝은 모래, 그늘 → 짙은 모래). 흙길은 그대로라 모래밭 위 자갈길로 보인다.
- 숲: 시트의 수관과 숲 벽은 **마른 덤불숲**(누런 잎)으로 칠해져 있지만, **사막 마을에서는 쓰지 않는다** — 잎 없는 바랜 고목(2880~) 덩이로 바꿨다(아래).
- 절벽: 절벽 칸 ${sheets.desert.sandstone.length}종의 흙벽이 황토색 **사암**으로 칠해져 있다(라벨 앞말 「사암」). 계단·조립은 숲마을 절벽과 같다.
- 지붕: 지붕 칸이 볕에 구운 흙빛으로 바랜다. 벽·창·문은 원래 색.
- 물: 호수·강·바다 칸은 **물 그대로**(조금 더 푸른 오아시스 물빛). 통행 불가.
- 선인장 769·야자 770·회백색 바위 537은 원래 시트에 있는 칸이라 초록 그대로 남아 있다(위층, 통행 불가).

## 나무 대신 — 바랜 고목 덩이, 물가 야자 무리
모래밭에는 잎 달린 나무가 어울리지 않는다. 사막 마을에서는 숲과 나무 도장을 모두 걷고 이렇게 했다.
- 뭍 쪽: 바랜 고목 덩이(아래 「덩이 짓는 법」). 선인장 769·바위 537 은 고목 밑동 옆에만 붙인다 — 빈 모래밭에 낱개로 흩지 않는다.
- 물가: 야자 770 을 **2~3그루씩 무리** 지어 둔다(물에서 한 칸, 무리 안에서 2칸 간격, 무리끼리 10칸 넘게). 물가를 따라 한 줄로 고르게 늘어세우지 않는다.
- 모든 식물은 길·문 앞·계단 끝·다리 끝에서 두 칸 넘게 떨어뜨린다. 놓은 뒤 통행 검사를 다시 한다.

${bareSection("forest_harmony_desert", { cleared: true })}
## 검사
마을 입구에서 런타임 이동 규칙(canMove)으로 모든 집 문 앞에 닿는지 확인했다(식물을 놓은 뒤).
${check}
${reach("forest_harmony_desert")}
## 실제 구분
${list("forest_harmony_desert")}
`);

doc("forest_harmony_autumn", "autumn-guide", "가을 규칙 · 번호는 숲마을, 시트만 가을빛", `# 가을 마을 — 단풍 든 숲마을

tilesetId=forest_harmony_autumn, 시트 tex_forest_harmony_autumn(30열·16px, ${sheets.autumn.count}칸). 좌표는 0기준.

${common}
## 무엇이 바뀌었나
- 땅: 잔디·풀 칸이 금빛 가을 풀밭이 된다. 흙길·돌길·절벽은 그대로.
- 숲: 숲 벽과 수관이 단풍(그늘 → 짙은 적갈색, 중간 → 주황, 밝은 잎 → 금빛)이 된다.
- 나무: 3×4 활엽수(978~980·1008~1010 수관)는 **노란 잎**, 둥근 덤불·작은 덤불은 **붉은 잎**이다. 숲마을 나무 도장을 그대로 쓰면 된다.
- 물·지붕·벽은 원래 색. 통행·오토타일은 숲마을과 같다.
- 편집은 없다: 숲마을 맵의 tilesetId만 forest_harmony_autumn으로 바꾸면 가을판이 된다.

## 검사
마을 입구에서 런타임 이동 규칙(canMove)으로 모든 집 문 앞에 닿는지 확인했다.
${check}
${reach("forest_harmony_autumn")}
## 실제 구분
${list("forest_harmony_autumn")}
`);

for (const p of c.plans) {
  const m = c.maps[p.id];
  doc(p.tilesetId, p.id, p.name + " · 배치와 기후 편집", `# ${p.name}

${p.note}. ${m.width}×${m.height}, tilesetId=${p.tilesetId}, 원본 숲마을 ${p.from}(tiledata/forest-villages/diverse). 입구 (${p.entry.join(",")}). 통행 검사 목표 ${JSON.stringify(p.targets)}.

![${p.name}](image:${p.id})

## 기후 편집 (원본 숲마을 위에 한 것)
${block(p.edits)}
## 집 (원본 그대로)
${block(p.houses)}
전체 두 레이어는 다음 배열 문서가 정답이다.
`);
  for (let y = 0; y < m.height; y += 16) {
    doc(p.tilesetId, `${p.id}-rows-${y}`, `${p.name} · ${y}행부터 전체 배열`, `# ${p.name} 전체 배열 y=${y}..${Math.min(y + 15, m.height - 1)}

폭 ${m.width}, x=0..${m.width - 1}, -1은 빈 칸. mapId=${m.id}, tilesetId=${p.tilesetId}, 16px.

## lowerTiles
${rows(m.lowerTiles.slice(y * m.width, Math.min(y + 16, m.height) * m.width), m.width)}
## upperTiles
${rows(m.upperTiles.slice(y * m.width, Math.min(y + 16, m.height) * m.width), m.width)}
`);
  }
}

// Used tiles with their meaning, per tileset — so a number is never guessed from a picture.
for (const [ts, k] of Object.entries(CATEGORY)) {
  const climate = Object.values(data.climates).find((x) => x.id === ts);
  const meta = (t) => climate.metaPatch[t] ?? data.base.tileMeta[t] ?? climate.append.tileMeta[t - data.base.tileMeta.length];
  const pass = (t) => data.base.passability[t] ?? climate.append.passability[t - data.base.passability.length];
  const used = [...new Set(plansOn(ts).flatMap((p) => [...c.maps[p.id].lowerTiles, ...c.maps[p.id].upperTiles]).filter((n) => n >= 0))].sort((a, b) => a - b);
  const entries = used.map((tile) => ({ tile, label: meta(tile)?.label ?? "", passability: pass(tile) }));
  for (let i = 0; i < entries.length; i += 150) doc(ts, `${k.id}-dictionary-${i / 150 + 1}`, `사용 타일 사전 ${i / 150 + 1}`, `# 사용 타일 사전\n\n${ts}에서 이 분류의 맵이 쓰는 번호·라벨·통행.\n` + block(entries.slice(i, i + 150)));
}

fs.mkdirSync(preview, { recursive: true });
const images = Object.fromEntries(Object.keys(CATEGORY).map((k) => [k, []]));
for (const p of c.plans) {
  const file = `${preview}/${p.id}.png`;
  execFileSync("convert", [`${dir}/images/${p.id}.png`, "-strip", "-filter", "point", "-resize", "820x820>", "-colors", "128", "-define", "png:compression-level=9", file]);
  images[p.tilesetId].push({ id: p.id, name: p.id + ".png", caption: "실제 타일 완성 지도 · 열람용 축소본", dataUrl: "data:image/png;base64," + fs.readFileSync(file).toString("base64") });
}
const out = Object.fromEntries(Object.entries(CATEGORY).map(([ts, k]) => [ts, { ...k, documents: docs[ts], images: images[ts] }]));
for (const k of Object.values(out)) if (k.documents.length > 64 || k.documents.some((d) => d.markdown.length > 12e4)) throw Error("Reference page limit " + k.id);
fs.writeFileSync(target, JSON.stringify(out) + "\n");
console.log(Object.values(out).map((k) => ({ id: k.id, documents: k.documents.length, images: k.images.length })), fs.statSync(target).size);
