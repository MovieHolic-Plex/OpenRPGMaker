// Bundle-owned guidance for tiledata/rpg-interiors → src/assets/sharedRpgInteriorReferences.json. No project/host writes.
// Five categories: four on tibo_interior_expanded (inn·homes / civic / castle / leisure) and one on easyrpg_chipset_ship.
// Split by purpose so no category nears the 64-document limit and each guide stays about one kind of building.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const dir = "tiledata/rpg-interiors", target = "src/assets/sharedRpgInteriorReferences.json", preview = "public/assets/rpg-interior-references";
const c = JSON.parse(fs.readFileSync(dir + "/catalog.json")), validation = JSON.parse(fs.readFileSync(dir + "/validation.json"));
const block = (o) => "```json\n" + JSON.stringify(o, null, 2) + "\n```\n";
const rows = (a, w) => "```text\n" + Array.from({ length: a.length / w }, (_, y) => a.slice(y * w, (y + 1) * w).join(" ")).join("\n") + "\n```\n";
const GROUPS = {
  "inn-homes": { tilesetId: "tibo_interior_expanded", id: "rpg-interiors-inn-homes-v1", name: "RPG 실내 · 여관·민가 (개정1)", description: "여관 1층 주점·2층 객실, 한 칸 집, 2층 집 1·2층, 촌장집, 폐가. 집 실내 벽 문법 위에 용도대로 가구를 놓은 배치, 계단·칸막이 방, 전체 배열과 통행 검사" },
  civic: { tilesetId: "tibo_interior_expanded", id: "rpg-interiors-civic-v1", name: "RPG 실내 · 교회·길드·마법 상점·공방·도서관·교실 (개정1)", description: "교회 예배당, 모험가 길드, 마법 상점, 연금술 공방, 도서관, 마법 학원 교실. 누가 어디서 무엇을 하는지로 자리를 나눈 배치와 전체 배열" },
  castle: { tilesetId: "tibo_interior_expanded", id: "rpg-interiors-castle-v1", name: "RPG 실내 · 성 1층·식당·침실·병영·보물고 (개정1)", description: "성 1층 대형 맵(50×40: 알현실·대연회장·복도 고리·계단실·주방·경비 초소)과 식당·침실·병영·보물고. 계단·문 틈으로 이어지는 짝, 금벽돌/석벽 방, 식탁 의자 방향 규칙, 전체 배열과 통행 검사" },
  leisure: { tilesetId: "tibo_interior_expanded", id: "rpg-interiors-leisure-v1", name: "RPG 실내 · 투기장 대기실·카지노·경매장 (개정1)", description: "투기장 대기실, 카지노, 경매장. 카운터·무대·벤치 동선과 전체 배열" },
  ship: { tilesetId: "easyrpg_chipset_ship", id: "rpg-interiors-ship-v1", name: "배 실내 · 선실·화물칸 (개정1)", description: "푸른물결호 갑판과 같은 배 칩셋으로 그린 갑판 아래 선실과 화물칸. 집 실내 껍데기를 배 시트로 바꾸는 법, Tibo 짐 이식표, 전체 배열" },
};
const docs = Object.fromEntries(Object.keys(GROUPS).map((k) => [k, []]));
const doc = (group, id, name, markdown) => {
  fs.writeFileSync(`${dir}/${id}.md`, markdown.replaceAll(/\(image:([^)]+)\)/g, "(images/$1.png)").trimEnd() + "\n");
  docs[group].push({ id, name, markdown });
};
const plansIn = (g) => c.plans.filter((p) => p.group === g);
const check = "```bash\nnode scripts/content/author-rpg-interiors.mjs   # 저작 + 통행 검사(막힌 목표·갇힌 바닥이 있으면 멈춤)\n```\n";
const reach = (g) => block(validation.filter((r) => plansIn(g).some((p) => p.id === r.id)).map(({ pockets: _p, ...r }) => r));
const list = (g) => plansIn(g).map((p) => `- ${p.name} (${p.id}, ${c.maps[p.id].width}×${c.maps[p.id].height}): ${p.use}.`).join("\n");

const SHELL = `## 벽·천장·문은 손으로 조립하지 않는다
interiorRoomPipeline의 plan→floor→walls 단계만 돌려 껍데기를 만든다(자동 가구 단계는 쓰지 않음).
- 방 바닥 bbox 바로 위 두 행이 벽면(윗줄 74~76, 아랫줄 104~106 크림). wallMaterial "stone-brick" 134~136/164~166, "gold-brick" 314~316/344~346.
- 바깥은 천장 430과 오토타일 테두리(371·399~401·429·431·459~461). 문은 남쪽 벽의 바닥 한 칸 개구부.
- 방을 나누려면 rooms + innerDoors: 좌우 방은 1열 칸막이(천장 띠), 위아래 방은 3행 칸막이(트림+벽면 두 줄). innerDoors 좌표에서 칸막이를 뚫는다(위아래 칸막이는 트림 행 y를 준다). 방 rect가 맞닿는 큰 맵(복도 고리)은 openPlan: true — 맞닿은 방은 바닥을 나누고 틈만 칸막이가 된다.
- 파이프라인은 세로 칸막이의 천장을 첫 바닥 행에서 멈춘다. 그대로 두면 이어진 뒷벽 앞에 기둥 토막이 선 것처럼 보이므로, 칸막이 천장을 방 벽면 두 줄을 지나 북쪽 천장까지 이어 붙이고 벽면 끝 조각(74/76·104/106, 한 칸이면 77/107)을 다시 고른다. 문 없는 가짜 방·한 칸짜리 벽 토막은 두지 않는다.
- 위층·지하는 남쪽 문을 천장으로 되메우고(문 없음) 계단으로만 오간다. 계단은 바닥 위, 곧은 벽에 붙이고 벽면 줄을 파고들지 않는다: 오르막 111/141/171(아래층, 세로 3칸, 난간이 왼쪽이라 동벽에 붙임), 내리막 474|475 두 줄(위층, 2×2). 한 층에 오르막·내리막 각 하나, 위아래 층은 같은 벽·같은 자리.
- 바닥 재질: 나무 72 그대로, 돌 42, 널 102, 문양 석판 163(교회 제단부). 러그는 붉은·청록 카펫 오토타일을 섬마다 따로 성형한다. 불 피운 솥·화덕은 돌바닥(42) 주방에만.

## 가구 자리 규칙
1. 벽걸이(창 54·커튼 창 56·스테인드글라스 144·그림 84/85·횃불 24·방패 벽 장식·게시판·지도 액자·벽판)는 벽면 두 줄 안에만 건다. 테두리(천장)나 바닥으로 넘어가면 안 된다. 다리 달린 판(별자리 판 164·메뉴 칠판 034)은 벽걸이가 아니다.
1-1. 탁상 소품(절구·약병·책 더미·펼친 책·수정 쟁반·수정구·깃펜과 잉크·동전 쟁반·돈 서랍·금고함·주사위 쟁반·모래시계·접시·주전자·피처·치즈·빵 도마)은 탁자 위에만. 탁자 상판은 시트의 나무 상판 오토타일(terrain-deck 126~218, 아래층) 또는 흰 천 탁자(159~221)로 깔고 그 위층에 소품을 놓는다. 바닥 위 탁상 소품은 저작 스크립트가 거부한다.
2. 키 큰 가구(책장·찬장·옷장·거치대·벽난로 3×3)는 맨 윗행을 벽면 아랫줄에 걸쳐 세운다.
3. 의자는 탁자를 본다: 탁자 위쪽 267(앞모습), 아래쪽 268(뒷모습), 왼쪽 297·Tibo 방석 의자(오른쪽을 봄), 오른쪽 298. Tibo 의자 580/584/588/487은 모두 오른쪽을 보므로 탁자 왼쪽에만 쓴다. 의자·걸상·벤치는 탁자·책상·카운터와 한 칸 붙어 짝을 이룬다(혼자 선 의자·벤치 금지 — 스크립트가 거부).
4. 카운터는 벽이나 선반을 등진다: 뒷벽과 카운터 사이 한 줄이 주인 자리. 방 한가운데 떠 있는 카운터 금지. 카운터 끝 한쪽은 비워 뒤로 돌아 들어갈 수 있게 한다.
4-1. 테마에 맞는 물건만: 모루는 대장간, 욕조·물통은 세탁실·목욕간, 마네킹은 재봉 방, 수정·광석 더미는 마법 가게·광산. 벽을 따라 소품을 한 줄로 늘어놓는 채우기 줄은 두지 않는다. 폐가의 무너진 곳(구멍·부서진 널·새싹)은 한 모서리에 모은다.
5. 문에서 방의 목적지(카운터·제단·계단·식탁)까지 곧은 통로를 비우고, 가구 사이 칸이 막힌 주머니가 되지 않게 한다(저작 스크립트가 입구에서 닿지 않는 맨바닥을 찾으면 경고한다).
6. 방마다 누가 무엇을 하는지 한눈에: 주인 자리·손님 자리·작업 자리를 나누고 큰 맨바닥을 남기지 않는다. 방은 쯔꾸르 한두 화면(17×13 안팎)으로 작게. 방이 비면 소품을 흩지 말고 방을 줄이거나 쓰임(주방·침실·카운터·작업대)을 나눈다.
7. 빈칸 검사(/tmp/oprn-qa/emptiness.py --kind interior): 맨바닥만으로 된 정사각형 한 변 ≤3, 17×13 한 화면 맨바닥 ≤30%.`;

for (const [g, k] of Object.entries(GROUPS)) {
  if (g === "ship") continue;
  doc(g, `${k.id}-guide`, `${k.name.split(" (")[0]} · 배치 규칙`, `# ${k.name.split(" (")[0]}

모든 방은 tibo_interior_expanded(30열·16px)에 그린다. 0~479칸은 EasyRPG 실내 칩셋과 같은 그림이라 집 실내 벽·천장 번호를 그대로 쓰고, 소품은 Tibo 조립(structureKits)을 **id로** 찍는다. 좌표는 0기준. 지형·배치만 담았다(문 이동·NPC·상점 이벤트 없음).

${SHELL}

## 검사
입구(문 개구부 또는 계단)에서 런타임 이동 규칙(canMove)으로 주인 자리·목적지에 닿는지 확인한다.
${check}
${reach(g)}
## 이 분류의 방
${list(g)}
`);
}
const grafts = c.tilesets.easyrpg_chipset_ship.tileGrafts ?? [];
doc("ship", "rpg-interiors-ship-v1-guide", "배 실내 · 껍데기를 배 시트로", `# 배 실내 — 선실과 화물칸

easyrpg_chipset_ship(30열·16px). 공용 장소 「푸른물결호 · 가로 갑판」과 같은 시트다. 이 시트는 EasyRPG 실내 칩셋과 **천장 배치가 같다**: 공허 430, 테두리 371·399~401·429·431·459~461이 같은 번호에 나무 테두리로 그려져 있다. 그래서 벽을 손으로 쌓지 않고 집 실내 껍데기를 그대로 쓴 뒤 벽면과 바닥만 바꾼다.

## 조립
1. interiorRoomPipeline plan→floor→walls로 껍데기(칸막이 방은 rooms + innerDoors).
2. 벽면 다시 가리키기: 윗줄 74·75·76 → 둥근 창 벽 104·105·106, 아랫줄 104·105·106 → 선체 판벽 134·135·136. 바닥 72 → 목재 갑판 279.
3. 남쪽 문은 천장으로 되메우고, 갑판에서 내려오는 사다리 22|23(두 칸 폭·두 줄)을 북벽 바로 앞 바닥에 세운다(아래층, 통행). 벽면 줄은 파지 않는다. 칸막이의 한 칸 벽 끝 조각(77/107)은 판벽 135로 바꾼다(둥근 창 조각이면 해치처럼 보인다).
4. 배 시트의 소품은 위층: 침대 416/446(세로), 책장 384·책 선반 414, 해도 그림 388/389, 엇갈린 검 295, 그림 358/359, 둥근 탁자 387·걸상 417, 오크통 385, 항아리 386, 밧줄 263, 닻 259, 대포 324/325, 랜턴 119, 물약 선반 148, 환기 격자창 202, 급수 펌프 72/73/102/103(아래층).
5. 시트에 없는 상자·자루·궤짝은 Tibo 조립을 이 시트 480번 뒤로 이식해 찍는다. 통행·우선순위는 Tibo 원본 칸을 따른다.
6. transparentColor "#ff678b" 필수 — 번들 그림의 일부 소품 칸에 분홍 색키가 남아 있다(갑판 저장본과 같다).

## 이식표
${block(grafts)}

## 검사
${check}
${reach("ship")}
## 이 분류의 방
${list("ship")}
`);

for (const p of c.plans) {
  const m = c.maps[p.id];
  doc(p.group, p.id, p.name + " · 용도와 배치", `# ${p.name}

${p.use}.

${p.note}. ${m.width}×${m.height}, tilesetId=${p.tilesetId}. 입구 (${p.entry.join(",")})${p.keeper ? `, 주인·담당 자리 (${p.keeper.join(",")})` : ""}. 통행 검사 목표 ${JSON.stringify(p.targets)}.

![${p.name}](image:${p.id})

## 놓은 소품 (저작 순서)
tibo-kit은 tibo_interior_expanded의 structureKits id, tiles는 직접 놓은 번호 행렬, rug는 카펫 오토타일 섬, floor는 바닥 재질 칠. (x,y)는 왼쪽 위.${p.tilesetId === "easyrpg_chipset_ship" ? " 배 맵의 tibo-kit은 이식 번호로 바뀌어 들어간다(배 규칙 문서의 이식표)." : ""}
${block(p.placements)}
전체 두 레이어는 다음 배열 문서가 정답이다.
`);
  for (let y = 0; y < m.height; y += 16) {
    doc(p.group, `${p.id}-rows-${y}`, `${p.name} · ${y}행부터 전체 배열`, `# ${p.name} 전체 배열 y=${y}..${Math.min(y + 15, m.height - 1)}

폭 ${m.width}, x=0..${m.width - 1}, -1은 빈 칸. mapId=${m.id}, tilesetId=${p.tilesetId}, 16px.

## lowerTiles
${rows(m.lowerTiles.slice(y * m.width, Math.min(y + 16, m.height) * m.width), m.width)}
## upperTiles
${rows(m.upperTiles.slice(y * m.width, Math.min(y + 16, m.height) * m.width), m.width)}
`);
  }
}

// Used tiles with their meaning, per category — so a number is never guessed from a picture.
for (const [g, k] of Object.entries(GROUPS)) {
  const t = c.tilesets[k.tilesetId];
  const used = [...new Set(plansIn(g).flatMap((p) => [...c.maps[p.id].lowerTiles, ...c.maps[p.id].upperTiles]).filter((n) => n >= 0))].sort((a, b) => a - b);
  const entries = used.map((tile) => ({ tile, label: t.tileMeta?.[tile]?.label ?? "", passability: t.passability[tile], priority: t.priority[tile], graft: t.tileGrafts?.find((x) => x.targetTile === tile) }));
  for (let i = 0; i < entries.length; i += 120) doc(g, `${k.id}-dictionary-${i / 120 + 1}`, `사용 타일 사전 ${i / 120 + 1}`, `# 사용 타일 사전\n\n${k.tilesetId}에서 이 분류의 맵이 쓰는 번호·라벨·통행. graft가 있으면 그 칸은 다른 시트에서 이식한 그림이다.\n` + block(entries.slice(i, i + 120)));
}

fs.mkdirSync(preview, { recursive: true });
const images = Object.fromEntries(Object.keys(GROUPS).map((k) => [k, []]));
for (const p of c.plans) {
  const n = p.id + ".png", file = preview + "/" + n;
  execFileSync("convert", [dir + "/images/" + n, "-strip", "-filter", "point", "-resize", "820x820>", "-colors", "128", "-define", "png:compression-level=9", file]);
  images[p.group].push({ id: p.id, name: n, caption: "실제 타일 완성 지도 · 열람용 축소본", dataUrl: "data:image/png;base64," + fs.readFileSync(file).toString("base64") });
}
const out = Object.entries(GROUPS).map(([g, { tilesetId, ...k }]) => ({ tilesetId, category: { ...k, documents: docs[g], images: images[g] } }));
for (const { category: k } of out) if (k.documents.length > 64 || k.documents.some((d) => d.markdown.length > 12e4)) throw Error("Reference page limit " + k.id);
fs.writeFileSync(target, JSON.stringify(out) + "\n");
console.log(out.map(({ category: k }) => ({ id: k.id, documents: k.documents.length, images: k.images.length })), fs.statSync(target).size);
