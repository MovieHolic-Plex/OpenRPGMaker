// Bundle-owned guidance for tiledata/rpg-places → src/assets/sharedRpgPlaceReferences.json. No project/host writes.
// Three categories, one per tileset the maps are drawn on (the AI reads guidance from the tileset in use).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const dir = "tiledata/rpg-places", target = "src/assets/sharedRpgPlaceReferences.json", preview = "public/assets/rpg-place-references";
const c = JSON.parse(fs.readFileSync(dir + "/catalog.json")), validation = JSON.parse(fs.readFileSync(dir + "/validation.json"));
const signs = JSON.parse(fs.readFileSync(dir + "/sign-labels.json"));
const block = (o) => "```json\n" + JSON.stringify(o, null, 2) + "\n```\n";
const rows = (a, w) => "```text\n" + Array.from({ length: a.length / w }, (_, y) => a.slice(y * w, (y + 1) * w).join(" ")).join("\n") + "\n```\n";
const CATEGORY = {
  tibo_interior_expanded: { id: "fantasy-interiors-v2", name: "판타지 실내 · 상점·대장간·왕좌의 방·복도·마법사 탑 (개정2)", description: "무기점·방어구점·도구점·대장간·왕좌의 방·성 복도·마법사 탑 한 층. 집 실내 벽 문법 위에 Tibo 소품을 놓는 배치 규칙, 전체 배열과 통행 검사" },
  easyrpg_chipset_dungeon: { id: "fantasy-dungeon-rooms-v1", name: "판타지 던전 방 · 성 지하 감옥·마왕성 왕좌의 방 (개정1)", description: "「무너진 납골당」과 같은 던전 벽 조립 위에 감방·쇠창살, 용암 못·카펫·왕좌를 놓은 방 두 개와 전체 배열" },
  forest_harmony: { id: "fantasy-exteriors-v2", name: "판타지 외관 · 상점가·폐성 (개정1)", description: "여울성 나루 집에 가게 간판(칼·방패·항아리)과 대장간 마당을 붙인 상점가, 성 조립을 그대로 둔 폐성. 간판 라벨과 폐성 규칙" },
};
const docs = Object.fromEntries(Object.keys(CATEGORY).map((k) => [k, []]));
const doc = (tilesetId, id, name, markdown) => {
  fs.writeFileSync(`${dir}/${id}.md`, markdown.replaceAll(/\(image:([^)]+)\)/g, "(images/$1.png)").trimEnd() + "\n");
  docs[tilesetId].push({ id, name, markdown });
};
const plansOn = (ts) => c.plans.filter((p) => p.tilesetId === ts);
const check = "```bash\nnode scripts/content/author-rpg-places.mjs   # 저작 + 통행 검사(실패하면 멈춤)\n```\n";
const reach = (ts) => block(validation.filter((r) => plansOn(ts).some((p) => p.id === r.id)));

doc("tibo_interior_expanded", "interior-guide", "실내 배치 규칙 · 벽은 문법, 소품은 벽을 따라", `# 판타지 실내 — 상점·대장간·왕좌의 방·복도·마법사 탑

모든 실내는 tibo_interior_expanded(30열·16px)에 그린다. 이 시트의 0~479칸은 EasyRPG 실내 칩셋과 **같은 그림**이고 480칸부터 Tibo 확장 소품이다. 그래서 집 실내의 벽·천장·문 번호를 그대로 쓰고 소품만 Tibo 조립(structureKits)에서 가져온다. 좌표는 0기준 맵 좌표다.

## 1. 벽·천장·문은 손으로 조립하지 않는다
interiorRoomPipeline의 plan→floor→walls 단계만 돌려 껍데기를 만든다(자동 가구 단계는 쓰지 않음). 결과 문법:
- 바깥은 천장 430, 테두리는 오토타일(371·400·460·429·431·399·401·459·461).
- 방 바닥 bbox 바로 위 두 행이 벽면: 윗줄 74·75…·76, 아랫줄 104·105…·106(크림). wallMaterial "stone-brick"은 134~136/164~166, "gold-brick"은 314~316/344~346으로 바뀐다.
- 문은 남쪽 벽의 바닥 한 칸 개구부(아래 천장 테두리가 ㅗ자로 트임). 바닥 72(나무), 석조 방은 42(회색 돌).

## 2. 소품 자리 규칙
1. 벽걸이(방패 벽 장식, 교차 연습검, 창 54, 벽 횃불 24, 휘장 318/348·319/349)는 벽면 **윗줄**(y=3)부터 건다.
2. 키 큰 가구(무기·갑옷 거치대 2×3, 물약 진열장 3×3, 책장 18~80, 커튼 3행, 벽난로 3×3)는 **맨 윗행을 벽면 아랫줄(y=4)** 에 걸쳐 세운다. 벽 앞에 붙어 서 있는 모습이 된다.
3. 가게는 카운터(325·326…·327, 긴 탁자 한 줄)로 상인 쪽(뒷벽)과 손님 쪽(문 쪽)을 가른다. 상인 자리는 카운터 바로 뒤 한 칸, 카운터 양 끝은 한 칸 이상 비워 뒤로 돌아 들어갈 수 있게 한다.
4. 문에서 카운터 앞까지 곧은 통로를 비운다. 통로 바닥에 붉은 러그(red-carpet 오토타일)를 깔면 동선이 읽힌다.
5. 파는 물건은 벽과 모서리에 모으고 방 가운데는 비운다. 한 칸 소품(주괴·상자·장바구니)은 앞쪽 모서리에 둔다.
6. 가게마다 파는 것이 한눈에 보여야 한다: 무기점=무기 거치대·교차검·검 진열대 263/293, 방어구점=갑옷 거치대·마네킹·방패, 도구점=물약 진열장·약재 서랍장·약초 건조대·식재료 자루, 대장간=화덕(벽난로)·풀무·모루 작업대·담금질 물통·숫돌·편자 걸이.

## 3. 성·탑
- 왕좌의 방: 금벽돌 벽. 뒷벽 가운데 카펫 단(3행) 위 왕좌 447~449/477~479, 단 앞 계단 465·466·467, 문까지 폭3 카펫. 단 좌우에 커튼 142/143·172/173·202/203, 왕좌 양옆 휘장. 통로 양옆으로 기둥 89/119와 기사 석상 87/117을 두 줄로 세운다.
- 성 복도: 폭3 긴 방, 가운데 한 줄 러너, 창 54와 벽 횃불 24를 번갈아, 기사 석상을 한쪽 벽을 따라.
- 마법사 탑 한 층: 문 대신 계단(올라감 = 동벽을 타고 오르는 3칸 폭 141|111|171 세 줄, 내려감 = 474|475 한 줄). 아래 두 모서리를 계단식으로 깎아 둥근 탑 느낌을 내고 천장 테두리를 다시 성형한다. 가운데 마법진 381~443(3×3), 벽에 책장, 연금술 작업대·가마솥·수정구·별자리 판·망원경.

## 4. 검사
입구(문 개구부 또는 계단)에서 런타임 이동 규칙(canMove)으로 카운터 앞·상인 자리·왕좌 앞·계단에 닿는지 확인한다. 하나라도 막히면 저작을 멈춘다.
${check}
${reach("tibo_interior_expanded")}
## 실제 구분
${plansOn("tibo_interior_expanded").map((p) => `- ${p.name} (${p.id}, ${c.maps[p.id].width}×${c.maps[p.id].height}): ${p.note}.`).join("\n")}
`);

doc("easyrpg_chipset_dungeon", "dungeon-guide", "던전 방 규칙 · 공허 테두리와 두 줄 벽면", `# 판타지 던전 방 — 성 지하 감옥·마왕성 왕좌의 방

easyrpg_chipset_dungeon(30열·16px). 벽 조립은 공용 장소 「침묵의 묘역 · 무너진 납골당」과 같다. 좌표는 0기준.

## 조립
1. 맵 전체를 공허 430으로 채우고, 열린 칸(방 사각형들의 합)을 정한다.
2. 열린 칸 중 바로 위가 공허면 벽면 윗줄 22, 그 아래(위의 위가 공허)면 벽면 아랫줄 52, 나머지는 바닥(회록 석재 187, 마왕성은 적암 오토타일 몸통).
3. 공허 칸을 abyss-gray 오토타일(369·371·399·400·401·429·431·459·460·461)로 성형한다. 방 가운데 공허 기둥을 세우면 칸막이 벽이 된다(감옥의 감방 구분).
4. 용암·카펫은 사각형을 몸통으로 칠한 뒤 해당 오토타일(lava, red-carpet)로 성형한다.

## 소품
- 감옥: 감방 앞 한 줄 쇠창살 234(왼끝)·235…·236(오른끝), 가운데 205가 감방 문. 복도에 화로 263/293(2행), 간수 탁자 324/354와 의자 327, 감방 안 해골 299.
- 마왕성: 왕좌 447~449/477~479(3×2), 붉은 마법진 441~443/471~473(칩셋에 반쪽만 있어 반원으로 보인다), 가고일 146/176, 기둥 446/476, 화로 263/293, 해골 299. 양옆 용암 못, 가운데 붉은 카펫이 문에서 왕좌 단까지.

## 검사
입구에서 감방 앞·왕좌 앞에 닿는지 canMove로 확인한다. 감방 안은 문이 잠긴 상태(205 통행 불가)이므로 검사 대상이 아니다.
${check}
${reach("easyrpg_chipset_dungeon")}
## 실제 구분
${plansOn("easyrpg_chipset_dungeon").map((p) => `- ${p.name} (${p.id}, ${c.maps[p.id].width}×${c.maps[p.id].height}): ${p.note}.`).join("\n")}
`);

const grafts = c.tilesets.forest_harmony.tileGrafts.filter((g) => g.sourceChipset === "tex_tibo_interior_expanded");
doc("forest_harmony", "exterior-guide", "상점가·폐성 규칙 · 간판과 무너뜨리지 않는 폐허", `# 판타지 외관 — 상점가와 폐성

forest_harmony. 두 맵 모두 컨셉 마을 「여울성 나루」(ford-castle-town)를 잘라 와서 만들었다. 집·성·절벽·길 조립은 원본 그대로이고 간판·마당·장식만 바꾼다.

## 가게 간판
숲마을 칩셋에 원래 있던 벽걸이 간판 셋은 색 이름으로 잘못 붙어 있어 쓰이지 않았다. 무엇을 파는지로 라벨을 고쳤다:
${block(signs)}
간판은 집 앞면 벽의 문 옆 칸(문 위 칸 329 줄과 같은 행)에 upper로 건다. 여관·주점은 기존 657(INN)·658(PUB). 앞마당에 파는 물건을 하나 더 내놓으면(무기·방어구점 앞 갑옷 거치대 687/717) 멀리서도 읽힌다.

## 대장간 마당
대장간은 돌집 옆 노천 작업장이다. 숲마을 칩셋에 화덕·모루가 없어서 Tibo 소품을 이 맵의 타일셋 뒤쪽 칸(${grafts[0]?.targetTile}~)에 이식했다. 통행·우선순위는 Tibo 원본 칸을 따른다:
${block(grafts)}

## 폐성 — 벽을 뚫지 않는다
성벽·흉벽·탑은 여러 칸이 맞물린 조립이라 칸을 지우면 테두리 없는 구멍이 된다(아래 오류 그림). 폐성은 조립을 그대로 두고:
1. 깃발 179/209, 화분·벤치·등을 치운다.
2. 안뜰(276~278·306~308·336~338)의 3분의 1을 이끼 낀 돌바닥 732로 바꾼다.
3. 안뜰에 돌무더기 537/888/948·해골 383, 마른 나무 261/291(2행)을 흩는다.
4. 벽면(51 위·81 아래)에 덩굴 265/295를 겹친다.
원본과 같이 성 윗면과 안뜰은 통행 불가, 앞 계단만 걸을 수 있다(외관 사례).

![오류 · 벽을 뚫어 무너뜨림](image:guide-ruin-holed)
![정상 · 조립은 그대로, 바닥·장식만 폐허](image:fantasy-ruined-castle)

## 검사
${check}
${reach("forest_harmony")}
## 실제 구분
${plansOn("forest_harmony").map((p) => `- ${p.name} (${p.id}, ${c.maps[p.id].width}×${c.maps[p.id].height}): ${p.note}.`).join("\n")}
`);

for (const p of c.plans) {
  const m = c.maps[p.id];
  doc(p.tilesetId, p.id, p.name + " · 배치와 소품", `# ${p.name}

${p.note}. ${m.width}×${m.height}, tilesetId=${p.tilesetId}. 입구 (${p.entry.join(",")})${p.keeper ? `, 상인·주인 자리 (${p.keeper.join(",")})` : ""}. 통행 검사 목표 ${JSON.stringify(p.targets)}.

![${p.name}](image:${p.id})

## 놓은 소품 (저작 순서)
tibo-kit은 tibo_interior_expanded의 structureKits id, tiles는 직접 놓은 번호 행렬이다. (x,y)는 왼쪽 위.${p.tilesetId === "forest_harmony" ? " 상점가의 tibo-kit은 이식 번호로 바뀌어 들어간다(외관 규칙 문서의 이식표)." : ""}
${block(p.placements)}
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
for (const [ts, t] of Object.entries(c.tilesets)) {
  const used = [...new Set(plansOn(ts).flatMap((p) => [...c.maps[p.id].lowerTiles, ...c.maps[p.id].upperTiles]).filter((n) => n >= 0))].sort((a, b) => a - b);
  const entries = used.map((tile) => ({ tile, label: t.tileMeta?.[tile]?.label ?? "", passability: t.passability[tile], priority: t.priority[tile], graft: t.tileGrafts?.find((g) => g.targetTile === tile) }));
  for (let i = 0; i < entries.length; i += 120) doc(ts, `${CATEGORY[ts].id}-dictionary-${i / 120 + 1}`, `사용 타일 사전 ${i / 120 + 1}`, `# 사용 타일 사전\n\n${ts}에서 이 분류의 맵이 쓰는 번호·라벨·통행. graft가 있으면 그 칸은 다른 시트에서 이식한 그림이다.\n` + block(entries.slice(i, i + 120)));
}

fs.mkdirSync(preview, { recursive: true });
const images = Object.fromEntries(Object.keys(CATEGORY).map((k) => [k, []]));
for (const n of fs.readdirSync(dir + "/images").filter((f) => f.endsWith(".png")).sort()) {
  const id = n.slice(0, -4), ts = id === "guide-ruin-holed" ? "forest_harmony" : c.plans.find((p) => p.id === id)?.tilesetId;
  const file = preview + "/" + n;
  execFileSync("convert", [dir + "/images/" + n, "-strip", "-filter", "point", "-resize", "820x820>", "-colors", "128", "-define", "png:compression-level=9", file]);
  images[ts].push({ id, name: n, caption: id.startsWith("guide-") ? "오류 예시 · 실제 타일" : "실제 타일 완성 지도 · 열람용 축소본", dataUrl: "data:image/png;base64," + fs.readFileSync(file).toString("base64") });
}
// Keyed by the tileset that carries the category.
const out = Object.fromEntries(Object.entries(CATEGORY).map(([ts, k]) => [ts, { ...k, documents: docs[ts], images: images[ts] }]));
for (const k of Object.values(out)) if (k.documents.length > 64 || k.documents.some((d) => d.markdown.length > 12e4)) throw Error("Reference page limit " + k.id);
fs.writeFileSync(target, JSON.stringify(out) + "\n");
console.log(Object.values(out).map((k) => ({ id: k.id, documents: k.documents.length, images: k.images.length })), fs.statSync(target).size);
