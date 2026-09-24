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
  forest_harmony_snow: { id: "climate-snow-villages-v4", name: "설원 마을 · 눈 덮인 숲마을과 얼어붙은 못 (수관 잎 채움 개정4)", description: "숲마을을 눈으로 다시 칠한 시트의 규칙. 칸 번호는 숲마을과 같고, 물 칸의 얼음 사본(걸을 수 있음)으로 못을 얼린다. 설원 마을 세 곳의 전체 배열과 통행 검사" },
  forest_harmony_volcano: { id: "climate-volcano-villages-v4", name: "화산 마을 · 재와 용암의 숲마을 (수관 잎 채움 개정4)", description: "숲마을을 재·용암으로 다시 칠한 시트의 규칙. 칸 번호·통행은 숲마을과 같고 물 칸이 모두 용암, 나무다리는 현무암 다리다. 화산 봉우리 놓는 법과 화산 마을 세 곳의 전체 배열" },
  forest_harmony_desert: { id: "climate-desert-villages-v4", name: "사막 마을 · 모래와 사암의 숲마을 (수관 잎 채움 개정4)", description: "숲마을을 모래·사암·마른 덤불로 다시 칠한 시트의 규칙. 칸 번호·통행은 숲마을과 같고 물은 오아시스 물 그대로다. 나무 대신 야자·선인장 놓는 법과 사막 마을 두 곳의 전체 배열" },
  forest_harmony_autumn: { id: "climate-autumn-villages-v4", name: "가을 마을 · 단풍 든 숲마을 (수관 잎 채움 개정4)", description: "숲마을을 금빛 풀밭과 단풍으로 다시 칠한 시트의 규칙. 칸 번호·통행·물은 숲마을과 같다. 가을 마을 두 곳의 전체 배열" },
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
- 한 맵에서 숲마을 타일셋과 기후 타일셋을 섞을 수 없다(맵 하나 = 타일셋 하나). 기후가 바뀌는 경계는 맵을 나눠 만든다.
`;

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
- 나무·수풀: 잎이 그을린 검은 잎이 된다. 숲 벽은 검게 탄 숲.
- 물: **물 칸 ${sheets.volcano.lava.length}종이 모두 용암**으로 칠해져 있다(강·못·해자·바다·폭포 모두). 번호·통행은 물과 같아 지나갈 수 없다. 폭포 칸은 용암 폭포가 된다.
- 다리: 나무다리 ${sheets.volcano.stoneBridges.join("·")}는 현무암 돌다리로 칠해져 있다. 용암을 건너는 곳엔 이 다리를 쓴다. 통행은 원래 나무다리와 같다.
- 지붕·벽·성벽은 원래 색. 파란 지붕·청회색 성벽은 물이 아니므로 용암이 되지 않는다(물 판정은 색이 아니라 물 칸 번호로 했다).

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
- 숲: 수관과 숲 벽이 **마른 덤불숲**(밝은 잎 → 누런 잎, 그늘 → 짙은 흙빛)이 된다. 여전히 통행 불가인 경계다.
- 절벽: 절벽 칸 ${sheets.desert.sandstone.length}종의 흙벽이 황토색 **사암**으로 칠해져 있다(라벨 앞말 「사암」). 계단·조립은 숲마을 절벽과 같다.
- 지붕: 지붕 칸이 볕에 구운 흙빛으로 바랜다. 벽·창·문은 원래 색.
- 물: 호수·강·바다 칸은 **물 그대로**(조금 더 푸른 오아시스 물빛). 통행 불가.
- 선인장 769·야자 770·회백색 바위 537은 원래 시트에 있는 칸이라 초록 그대로 남아 있다(위층, 통행 불가).

## 나무 대신 야자·선인장
활엽수·덤불 덩이(960~1109의 나무 도장)는 모래밭에 어울리지 않는다. 사막 마을에서는 이렇게 바꿨다.
- 나무 도장 하나를 모래(아래층 240, 위층 비움)로 되돌리고 **그 발치 한가운데 한 칸**에 식물 하나를 놓는다: 물이 5칸 안에 있으면 야자 770, 아니면 선인장 769. 3×4 활엽수 자리에는 바위 537도 하나 놓는다.
- 물가(물에서 한 칸)에는 야자를 3칸 이상 띄워 늘어세운다.
- 빈 모래밭(물에서 6칸 넘게)에는 선인장을 6칸 이상 띄워 흩어 놓는다.
- 모든 식물은 둘레 한 칸이 빈 모래여야 하고, 길·문 앞·계단 끝·다리 끝에서 두 칸 넘게 떨어뜨린다. 놓은 뒤 통행 검사를 다시 한다.

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
