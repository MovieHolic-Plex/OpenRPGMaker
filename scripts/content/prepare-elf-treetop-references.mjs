// Bundle-owned guidance for the elf treetop village (tiledata/elf-treetop) → src/assets/sharedElfTreetopReferences.json.
// One category on forest_harmony: build order and rules, the place, its full layout in rows, and the tile dictionary of
// the treetop parts (3131~). Docs are also copied as tiledata/elf-treetop/*.md. No project/host writes.
// Usage: node scripts/content/prepare-elf-treetop-references.mjs   (after elf-treetop.py and elf-treetop-map.py)
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const dir = "tiledata/elf-treetop", target = "src/assets/sharedElfTreetopReferences.json", preview = "public/assets/elf-treetop";
const c = JSON.parse(fs.readFileSync(dir + "/catalog.json"));
const parts = JSON.parse(fs.readFileSync("src/assets/forestHarmonyTreetopParts.json"));
const plan = c.plan, W = plan.width;
const S = parts.start;
const block = (o) => "```json\n" + JSON.stringify(o) + "\n```\n";
const rows = (a, y0, y1) => "```text\n" + Array.from({ length: y1 - y0 }, (_, k) => a.slice((y0 + k) * W, (y0 + k + 1) * W).join(" ")).join("\n") + "\n```\n";
const range = (a, b) => `${S + a}~${S + b}`;
const CATEGORY = {
  id: "elf-treetop-v1",
  name: "엘프 나무 위 마을 · 데크·밧줄 다리·줄기 집 (개정1)",
  description: "우듬지 위 판자 데크를 밧줄 다리로 잇는 엘프 마을. 깊은 숲 바닥·데크 오토타일·밧줄 다리·큰 나무 줄기 집·수관 덮기·사다리 출구의 조립 순서와 번호, 완성 장소 한 곳의 전체 배열, 사용 타일 사전",
};
const docs = [], images = [];
const doc = (id, name, markdown) => {
  fs.writeFileSync(`${dir}/${id}.md`, markdown.replaceAll(/\(image:([^)]+)\)/g, "(images/$1.png)").trimEnd() + "\n");
  docs.push({ id, name, markdown });
};

doc("treetop-guide", "나무 위 마을 조립 순서 · 번호", `# 엘프 나무 위 마을 — 조립 순서

tilesetId=forest_harmony. 좌표는 0기준, 16px. 나무 위 마을 칸 **${S}~${parts.count - 1}**는 집 부품(3060~3130) 바로 뒤에 붙는 공용 이식이다 — 새 프로젝트와 기존 프로젝트 모두 불러올 때 자동으로 생긴다. 그림 원본은 scripts/content/elf-treetop.py.

![엘프 나무 위 마을](image:elf-treetop-village)

## 순서
1. **깊은 숲 바닥** — 맵 전체 하위를 ${range(157, 160)} 네 가지로 섞어 깐다(통행 불가). 나무 위에서 내려다본 먼 숲 바닥이다.
2. **데크** — 오토타일 \`forest_harmony_treetop_deck_47\`(${range(0, 46)}, 8방향 연결)로 둥근 덩이를 칠한다. 타원(가로 반지름 5~9, 세로 3~6)이 좋다. **한 줄·한 칸짜리 돌출은 지운다**(계단처럼 튀어나온 턱이 된다). 데크 가장자리 바깥은 투명이라 받침(깊은 숲 ${S + 157})이 비친다. 남쪽 가장자리엔 데크 두께(보)가 그려진다.
3. **데크 그늘** — 데크 남쪽 끝 바로 아래 깊은 숲 칸은 그늘 ${S + 161}.
4. **밧줄 다리** — 가로는 2줄: 윗줄 ${S + 60}(왼 기둥)·${S + 61}/${S + 62}(발판, 번갈아)·${S + 63}(오른 기둥), 아랫줄 ${S + 64}·${S + 65}/${S + 66}·${S + 67}. 세로는 2칸 폭: 위 기둥 ${S + 68}·${S + 69}, 발판 ${S + 70}·${S + 71} / ${S + 72}·${S + 73}, 아래 기둥 ${S + 74}·${S + 75}. **다리 두 줄(두 칸) 모두 양쪽 데크에 닿아야 한다** — 짧은 줄은 데크를 채워 닿게 한다. 다리 연결 칸은 데크 오토타일에서 연결로 친다(가장자리 테두리가 다리 쪽으로 열린다).
5. **줄기 집** — 3칸 집 묶음 \`treetop-trunk-house-3\`(3×6, ${range(90, 107)}), 장로 나무 \`treetop-trunk-house-5\`(5×6, ${range(120, 139)}). 밑동 줄이 데크 위에 선다(밑동 뿌리 칸은 받침이 데크 몸통). 위 3줄은 **상위 굽이숲 수관**(\`forest_harmony_grove_47\`)으로 좌우 2칸씩 넓게 덮어, 줄기가 제 수관 속으로 들어가게 한다. 문은 가운데 칸, 문 앞 아래 두 칸은 비운다(문 이동 이벤트는 문 칸).
6. **수관** — 데크·다리·줄기가 없는 곳 상위에 굽이숲 수관을 반지름 3~5의 둥근 덩이로 겹쳐 올린다. **데크·다리 둘레 한 칸은 수관 없이 비워** 깊은 숲이 보이게 한다 — 이 틈이 높이를 만든다. 8방향이 모두 수관인 칸은 속 변형(얕음 2568·2597~2601, 깊음 2602~2607)을 섞는다.
7. **출구** — 입구 데크 남쪽 끝 바로 아래부터 맵 가장자리까지 밧줄 사다리: 위 ${S + 150}, 가운데 ${S + 151}(반복), 아래 끝 ${S + 152}. 맨 아래 칸이 숲 바닥으로 가는 이동 칸. 다른 출구는 가로 밧줄 다리를 맵 가장자리까지 늘린다.
8. **소품**(데크 위에만, 주인 곁에만) — 요정 등불 기둥 ${S + 153}(상위 등)/${S + 154}(하위 기둥)을 줄기 집 문 양옆과 입구 데크 양옆에. 이끼 화분 ${S + 156}, 가로 다리 윗줄 위 잎 줄 ${S + 155}. 숲마을 소품: 새집 2622, 약초 화분 2623·2624(정원), 과일 바구니 2628·2629(여관 앞), 꽃 화단 2616·2617(광장 길가), 게시판 2630·2631(장로 문 곁), 나무통 2638.

## 통행
- 데크·다리 발판·사다리: 통행 가능. 깊은 숲·줄기·수관: 통행 불가. 요정 등불·화분·게시판: 통행 불가.
- 수관이 데크 위를 덮는 칸(줄기 뒤)은 수관 때문에 막힌다 — 줄기 뒤 데크는 걸을 수 없는 배경으로 둔다.

## 금지
- 데크를 네모 판으로 깔지 않는다(나무 위가 아니라 마루가 된다). 수관을 한 덩어리 산울타리로 잇지 않는다.
- 데크 사이 깊은 숲 틈을 수관으로 다 메우지 않는다. 데크 위에 소품을 흩뿌리지 않는다(주인 없는 소품 금지).
- 줄기 집 밑동을 깊은 숲 위에 두지 않는다 — 반드시 데크 위.
`);

doc("elf-treetop-village", plan.name, `# ${plan.name}

${plan.note}. ${W}×${plan.height}, tilesetId=forest_harmony. 통행 검사 시작 (${plan.entry.join(",")}).

![${plan.name}](image:elf-treetop-village)

## 출구
${block(plan.exits)}
## 데크(타원 중심·반지름)
${block(plan.decks)}
## 줄기 집과 문(문 칸 · 문 앞 칸)
${block(plan.doors)}
## 칸 수
${block(plan.counts)}
전체 배열은 「${plan.name} 전체 배열 y=…」 문서들에 있다.
`);

for (let y0 = 0; y0 < plan.height; y0 += 16) {
  const y1 = Math.min(plan.height, y0 + 16);
  doc(`elf-treetop-village-rows-${y0}`, `${plan.name} 전체 배열 y=${y0}..${y1 - 1}`,
    `# ${plan.name} 전체 배열 y=${y0}..${y1 - 1}\n\n폭 ${W}, x=0..${W - 1}, -1은 빈 칸. mapId=${plan.id}, tilesetId=forest_harmony, 16px.\n\n## lowerTiles\n${rows(c.map.lowerTiles, y0, y1)}\n## upperTiles\n${rows(c.map.upperTiles, y0, y1)}`);
}

const used = [...new Set([...c.map.lowerTiles, ...c.map.upperTiles].filter((t) => t >= 0))].sort((a, b) => a - b);
const dictionary = used.map((t) => {
  if (t >= S) {
    const slot = parts.slots[t - S];
    return { tile: t, label: slot.tileMeta.label, layer: slot.priority, passage: slot.tileMeta.passage, backing: slot.tileMeta.layerBacking };
  }
  return { tile: t, label: t >= 2550 && t <= 2607 ? "굽이숲 수관" : { 2616: "꽃 화단 왼", 2617: "꽃 화단 오른", 2622: "새집", 2623: "약초 화분", 2624: "약초 화분 2", 2628: "과일 바구니 왼", 2629: "과일 바구니 오른", 2630: "게시판 왼", 2631: "게시판 오른", 2638: "나무통", 2646: "낚시 바구니" }[t] ?? "숲마을 칸" };
});
doc("treetop-dictionary", "나무 위 마을 사용 타일 사전", `# 사용 타일 사전\n\nforest_harmony 에서 이 장소가 쓰는 번호·라벨·층·통행·받침.\n${block(dictionary)}`);

fs.mkdirSync(preview, { recursive: true });
execFileSync("convert", [`${dir}/images/elf-treetop-village.png`, "-strip", "-define", "png:compression-level=9", `${preview}/elf-treetop-village.png`]);
images.push({ id: "elf-treetop-village", name: "elf-treetop-village.png", caption: "실제 타일 완성 지도(1배)", dataUrl: `/assets/elf-treetop/elf-treetop-village.png` });
execFileSync("convert", ["public/assets/forest-harmony/treetop-parts.png", "-background", "#182a1c", "-flatten", "-filter", "point", "-resize", "200%", `${preview}/treetop-parts.png`]);
images.push({ id: "treetop-parts", name: "treetop-parts.png", caption: `나무 위 마을 칸 시트(2배) — 칸 번호 = ${S} + 줄×30 + 열`, dataUrl: `/assets/elf-treetop/treetop-parts.png` });

fs.writeFileSync(target, JSON.stringify({ forest_harmony: { ...CATEGORY, documents: docs, images } }) + "\n");
console.log(target, { documents: docs.length, images: images.length, bytes: fs.statSync(target).size });
