// Bundle-owned guidance for tiledata/rpg-interiors → src/assets/sharedRpgInteriorReferences.json. No project/host writes.
// Categories: inn·homes / civic / castle / leisure / climate on tibo_interior_expanded and one on easyrpg_chipset_ship.
// Split by purpose so no category nears the 64-document limit and each guide stays about one kind of building.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const dir = "tiledata/rpg-interiors", target = "src/assets/sharedRpgInteriorReferences.json", preview = "public/assets/rpg-interior-references";
const c = JSON.parse(fs.readFileSync(dir + "/catalog.json")), validation = JSON.parse(fs.readFileSync(dir + "/validation.json"));
const block = (o) => "```json\n" + JSON.stringify(o, null, 2) + "\n```\n";
const rows = (a, w) => "```text\n" + Array.from({ length: a.length / w }, (_, y) => a.slice(y * w, (y + 1) * w).join(" ")).join("\n") + "\n```\n";
const GROUPS = {
  "inn-homes": { tilesetId: "tibo_interior_expanded", id: "rpg-interiors-inn-homes-v3", name: "RPG 실내 · 여관·민가 (개정3)", description: "여관 1층 주점·2층 객실, 한 칸 집, 2층 집 1·2층, 촌장집, 폐가. 집 실내 벽 문법 위에 용도대로 가구를 놓은 배치, 계단·칸막이 방, 전체 배열과 통행 검사" },
  civic: { tilesetId: "tibo_interior_expanded", id: "rpg-interiors-civic-v3", name: "RPG 실내 · 교회·길드·마법 상점·공방·도서관·교실 (개정3)", description: "교회 예배당, 모험가 길드, 마법 상점, 연금술 공방, 도서관, 마법 학원 교실. 누가 어디서 무엇을 하는지로 자리를 나눈 배치와 전체 배열" },
  castle: { tilesetId: "tibo_interior_expanded", id: "rpg-interiors-castle-v3", name: "RPG 실내 · 성 1층·식당·침실·병영·보물고 (개정3)", description: "성 1층 대형 맵(50×40: 알현실·대연회장·복도 고리·계단실·주방·경비 초소)과 식당·침실·병영·보물고. 계단·문 틈으로 이어지는 짝, 금벽돌/석벽 방, 식탁 의자 방향 규칙, 전체 배열과 통행 검사" },
  leisure: { tilesetId: "tibo_interior_expanded", id: "rpg-interiors-leisure-v3", name: "RPG 실내 · 투기장 대기실·카지노·경매장 (개정3)", description: "투기장 대기실, 카지노, 경매장. 카운터·무대·벤치 동선과 전체 배열" },
  climate: { tilesetId: "tibo_interior_expanded", id: "rpg-interiors-climate-v4", name: "RPG 실내 · 사막·설원·화산 집과 궁전·요새 (개정4)", description: "사막 흙벽돌 민가·오아시스 여관·궁전 왕좌의 방, 설원 사냥꾼 오두막·촌장집·요새 대전, 화산 대장장이 집·잿빛 마을 여관. 기후 벽면(사암·통나무·현무암)과 바닥·깔개, 3칸 폭 벽 계단, 숲마을 실내와 무엇이 다른지, 전체 배열과 통행 검사" },
  staples: { tilesetId: "tibo_interior_expanded", id: "rpg-interiors-staples-v4", name: "RPG 실내 · 등대·마구간 헛간·치료소·여관 지하·곡물 창고 (개정4)", description: "등대 1층 등대지기 방과 꼭대기 등불 방(3칸 폭 벽 계단 ↔ 같은 자리 내리막), 목장 마구간 헛간, 치료소(진료실·병실), 여관 지하 술창고(3칸 폭 벽 계단), 곡물 창고(다락 사다리·쥐구멍). 누가 어디서 무엇을 하는지, 전체 배열과 통행 검사" },
  sacred: { tilesetId: "tibo_interior_expanded", id: "rpg-interiors-sacred-v1", name: "RPG 실내 · 대성당·수도원 (개정1)", description: "대성당 신랑(제단·긴 의자 여러 줄·기둥 두 줄·옆 통로 예배소·파이프 오르간·성수반)과 수도원 회랑(독방·약초 창고·필사실·식당·기둥이 두른 안뜰과 돌우물). 굽은 새 타일(우물·분수·오르간·긴 스테인드글라스) 쓰는 법과 전체 배열" },
  sewer: { tilesetId: "easyrpg_chipset_dungeon", catalogTileset: "oprn_dungeon_stone", id: "rpg-interiors-sewer-prison-v1", name: "RPG 실내 · 지하 하수 감옥 (개정1)", description: "던전 시트로 조립한 지하 하수도 감옥: 가운데 물길과 둑길, 창살 친 감방 다섯, 간수실. 벽 조립·창살·물길·일부러 닫은 감방 규칙과 전체 배열" },
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
- 위층·지하는 남쪽 문을 천장으로 되메우고(문 없음) 계단으로만 오간다. 계단 조각은 모양 그대로 쓴다: 오르막은 가로 조각 141(왼끝)|111(가운데)|171(오른끝)을 세 줄 — 첫 바닥 줄 + 바로 위 북쪽 벽면 두 줄을 덮어 벽을 타고 오르는 3칸 폭 계단(아래층, 곧은 동벽 앞). 111/141/171을 한 열로 세로로 쌓지 않는다(난간이 한 칸씩 튄 부러진 기둥이 된다). 내리막은 474 **한 칸**(위층, 1×1). 474·475·444·445는 각각 완성된 1×1 계단이라 **나란히 두 칸 붙이지 않는다** — 474|475를 붙이면 계단 두 개로 보인다. 투명 배경이라 바닥 위 윗층에 얹는다. 계단 칸 위에는 아무것도 놓지 않고, 발치 줄도 비운다. 한 층에 오르막·내리막 각 하나, 위아래 층은 같은 벽·같은 자리.
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

const ROW68 = `## 새로 구운 타일 (Tibo 68행 2040~2069, 모든 프로젝트의 tibo_interior_expanded에 들어 있다)
bake-climate-interior-tiles.py가 물통(1824~1856)과 같은 3/4 시점(테두리 윗면·앞면·어두운 윤곽)으로 그렸다. 모두 위층.
- 돌우물 2×2: 2040 2041 / 2042 2043(막힘). 하늘이 트인 안뜰·정원 한가운데에.
- 돌 분수 3×2: 2044 2045 2046 / 2047 2048 2049(막힘). 궁전 홀 통로 양옆 한 쌍, 성당 문 곁 성수반.
- 쥐구멍 1×1: 2050. 벽면 아랫줄 칸 위에만 얹는다(벽걸이). 곁 바닥에 곡물 자루 471·고양이 385.
- 파이프 오르간 3×3: 2051~2053 / 2054~2056 / 2057~2059(막힘). 벽난로처럼 맨 윗줄을 벽면 윗줄에 맞춰 뒷벽에 붙이면 건반 줄이 첫 바닥 줄에 온다. 손풍금(tibo-library-176, 2×2)은 손으로 돌리는 작은 악기라 성당 오르간으로 쓰지 않는다.
- 긴 스테인드글라스 창 1×2: 2060(벽면 윗줄) / 2061(벽면 아랫줄). 벽걸이. 한 칸짜리 144보다 성당 뒷벽에 맞다.`;
const SACRED = `\n## 성당·수도원 배치
- 대성당: 북쪽 무늬 석판 163 제단부 위 제단·성녀상·커튼, 제단부 앞 붉은 카펫 계단 465|466|467(아래층, 통행)에서 문까지 폭3 카펫. 긴 의자 4×2는 두 줄씩 붙이고 한 줄 띄워 통로를 낸다. 기둥 89/119 두 줄로 옆 통로를 가르고, 옆 통로 북쪽 끝이 예배소(성유물 제단·무릎 꿇는 의자 / 파이프 오르간·악보 받침대). 성수반은 문 곁.
- 수도원: rooms + innerDoors로 북쪽 독방·약초 창고·필사실과 남쪽 식당·회랑을 나눈다. 안뜰은 잔디 240을 깔고 기둥 89/119를 안뜰 가장자리 칸에 밑동이 오게 두른다. 한가운데 돌우물, 화단은 꽃 자갈 133 한 줄씩, 관목 259/351. 잔디 위에 자갈 오토타일 길을 깔면 회색 웅덩이처럼 보여 쓰지 않았다.
- 독방마다 침대·협탁·촛대·독서 탁자와 걸상·궤짝, 벽에 십자 장식 59(벽걸이). 식당은 긴 식탁 양쪽 짧은 벤치, 한쪽 끝 낭독 독서대.

${ROW68}
`;
for (const [g, k] of Object.entries(GROUPS)) {
  if (g === "ship" || g === "climate" || g === "staples" || g === "sewer") continue;
  doc(g, `${k.id}-guide`, `${k.name.split(" (")[0]} · 배치 규칙`, `# ${k.name.split(" (")[0]}

모든 방은 tibo_interior_expanded(30열·16px)에 그린다. 0~479칸은 EasyRPG 실내 칩셋과 같은 그림이라 집 실내 벽·천장 번호를 그대로 쓰고, 소품은 Tibo 조립(structureKits)을 **id로** 찍는다. 좌표는 0기준. 지형·배치만 담았다(문 이동·NPC·상점 이벤트 없음).

${SHELL}
${g === "sacred" ? SACRED : ""}
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

const CLIMATE = `## 기후 벽면·바닥 (Tibo 1980~2009, 모든 프로젝트의 tibo_interior_expanded에 들어 있다)
기후 마을(사막·설원·화산) 집 안은 숲마을 실내(크림 회벽 74~76/104~106·나무 바닥 72)를 쓰지 않는다. 껍데기는 똑같이 interiorRoomPipeline plan→floor→walls로 만들고 크림 벽면(74~76/104~106)을 아래 표의 번호로 바꾼다(파이프라인 retintHouseWallFace 의 "log"·"sandstone"·"basalt"). 이 번호는 tibo_interior_expanded 에만 있다 — 480칸 easyrpg_chipset_interior 에 쓰지 말 것.

| 기후 | wallMaterial | 벽면 윗줄(왼끝·가운데·오른끝) | 아랫줄 | 바닥 | 깔개 |
|---|---|---|---|---|---|
| 설원 통나무 오두막 | log | 1980 1981 1982 | 1983 1984 1985 | 나무 72 | 흰 모피 3×3 2000~2008 |
| 사막 흙벽돌·사암 집 | sandstone | 1986 1987 1988 | 1989 1990 1991 | 사암 1999, 주방 흙 192 | 짚 돗자리 3×3 108~170 |
| 화산 현무암 집·대장간 | basalt | 1992 1993 1994 | 1995 1996 1997 | 현무암 1998, 주방 돌 42 | 붉은 카펫(벽난로 앞·문 앞) |

- 3×3 깔개(짚 돗자리·흰 모피)는 조각 배치가 같다: 왼쪽 위·위·오른쪽 위 / 왼쪽·가운데·오른쪽 / 왼쪽 아래·아래·오른쪽 아래. 넓히면 가운데 줄·칸을 되풀이한다(2줄이면 위·아래 줄만).
- 기후마다 소품 무리가 다르다. 사막: 저장 옹기·물 항아리·물통·베틀·실패 걸이·선인장 화분·실내 야자, 창 대신 직조 벽걸이. 설원: 장작 벽난로·장작 받침대·장작 바구니·사슴뿔 벽판·말린 침낭·가죽 배낭·밧줄·생선·고기 건조대·가죽 두루마리·여행 장화. 화산: 대장간 화덕·풀무·대장장이 작업대·모루 작업대·숫돌·담금질 물통·석탄 통·금속 주괴·고철 상자, 벽 횃불·화로. 숲마을 실내의 화분·꽃병은 사막 선인장·설원 장작·화산 화로로 바꾼다.

## 궁전·요새 (큰 방)
- 사막 궁전 왕좌의 방: 사암 벽·사암 바닥. 무늬 석판 단 위 대형 왕좌 447~479와 붉은 의자 446/476, 단 앞 계단 465|466|467, 통로 카펫과 두 분수 사이 가로 띠를 한 섬(redRugShape)으로 성형. 돌 분수(2044~2049) 한 쌍, 기둥 두 줄, 사절 찻상(방석 v3-3-1은 탁자 왼쪽, 의자 298은 오른쪽, 267은 위쪽), 단 곁 보물 구석, 문 곁 무기 거치대.
- 설원 요새 대전: 통나무 벽·나무 바닥. 흰 모피 단 위 영주의 자리, 뒷벽 양쪽 장작 벽난로와 모피 깔개·장작, 폭5 붉은 통로와 화로, 양옆 나무 상판 긴 식탁과 짧은 벤치. 3×3 석조 화로 402~464는 가마처럼 보여 방 한가운데 불자리로 쓰지 않는다.

${ROW68}

## 계단 — 3칸 폭 벽 계단
여관처럼 위층으로 오르는 계단은 3칸 폭 돌계단 141(왼끝)|111(가운데)|171(오른끝)을 세 줄 쌓는다(아래층, 통행). 맨 아랫줄은 첫 바닥 줄에 놓고 윗 두 줄은 바로 위 북쪽 벽면 두 줄을 덮는다 — 계단이 벽을 타고 올라가는 모양이다. 세 칸 모두 발치가 바닥이고 위가 곧은 벽면이어야 한다(모서리·칸막이 끝·문 틈 금지).

## 가구 자리 규칙
숲마을 실내 분류(여관·민가)의 규칙과 같다: 벽걸이는 벽면 두 줄 안, 키 큰 가구는 맨 윗행을 벽면 아랫줄에 걸침, 의자·걸상·벤치는 탁자 곁, 탁상 소품은 나무 상판 위, 카운터는 벽이나 선반을 등짐, 문에서 목적지까지 통로를 비우고 갇힌 바닥을 남기지 않음. 모든 소품은 주인(침대·화덕·카운터·작업대·식탁·거치대) 곁에 둔다.
빈칸 검사(/tmp/oprn-qa/emptiness.py --kind interior): 맨바닥만으로 된 정사각형 한 변 ≤3, 17×13 한 화면 맨바닥 ≤30%.`;
{
  const k = GROUPS.climate;
  const pairs = plansIn("climate").map((p) => `- ${p.name} (${p.id}): 숲마을 실내 \`${p.replaces}\` 대신 쓴다.`).join("\n");
  doc("climate", `${k.id}-guide`, "RPG 실내 · 사막·설원·화산 집 · 배치 규칙", `# RPG 실내 · 사막·설원·화산 집

모든 방은 tibo_interior_expanded(30열·16px)에 그린다. 0~479칸은 EasyRPG 실내 칩셋과 같은 그림이라 집 실내 벽·천장 번호를 그대로 쓰고, 소품은 Tibo 조립(structureKits)을 **id로** 찍는다. 좌표는 0기준. 지형·배치만 담았다(문 이동·NPC·상점 이벤트 없음).

${CLIMATE}

## 숲마을 실내와 짝
${pairs}

## 검사
입구(문 개구부)에서 런타임 이동 규칙(canMove)으로 주인 자리·목적지·계단에 닿는지 확인한다.
${check}
${reach("climate")}
## 이 분류의 방
${list("climate")}
`);
}

{
  const k = GROUPS.staples;
  doc("staples", `${k.id}-guide`, "RPG 실내 · 등대·마구간 헛간·치료소 · 배치 규칙", `# RPG 실내 · 등대·마구간 헛간·치료소

모든 방은 tibo_interior_expanded(30열·16px)에 그린다. 벽·천장·문은 interiorRoomPipeline plan→floor→walls 껍데기, 소품은 Tibo 조립(structureKits)을 **id로** 찍는다. 좌표는 0기준. 지형·배치만 담았다(문 이동·NPC 이벤트 없음).

${SHELL.split("\n## 가구 자리 규칙")[0].replace(/- 위층·지하는[^\n]*\n/, "")}
## 계단 — 3칸 폭 벽 계단과 같은 자리 내리막
- 아래층 오르막: 3칸 폭 돌계단 141(왼끝)|111(가운데)|171(오른끝)을 세 줄 쌓는다(아래층, 통행). 맨 아랫줄은 첫 바닥 줄, 윗 두 줄은 바로 위 북쪽 벽면 두 줄을 덮는다 — 계단이 벽을 타고 올라가는 모양(사용자가 맞다고 한 모양). 세 칸 모두 발치가 바닥, 위가 곧은 벽면이어야 한다.
- 위층: 남쪽 문을 천장으로 되메우고, 아래층 3칸 폭 계단의 가운데 x 자리 첫 바닥 줄에 1×1 내리막 474 한 칸(윗층, 옆에 475를 붙이지 않는다). 입구는 그 계단 앞이다.
- 등대: 1층 동쪽 x=13~15 오르막 ↔ 등불 방 x=14 내리막(한 칸).

## 이 분류의 방마다 쓰임
- 등대 1층: 침대·벽난로·식탁(등대지기 살림), 일지 책상·망원경(바다 감시), 등유 통·밧줄·지도통(등불 방으로 나를 짐). 벽걸이는 조타륜 장식·바다 지도.
- 등불 방: 창을 뒷벽에 여럿 — 밤바다를 비추는 방이다. 가운데 무늬 석판 163 단 위에 렌즈(수정구 받침)와 화로 둘. 불 끄는 물 양동이는 서쪽 등유 통·항아리 곁에 모은다 — 바닥 한가운데 따로 떨어진 빗자루·양동이를 두지 않는다.
- 마구간 헛간: 통나무 벽 1980~1985·흙바닥 192. 북벽 먹이통 3×2마다 마구간 칸 하나 — 칸 사이·양끝에 판자 칸막이(2016 북쪽 끝 → 2017 가운데 → 2018 남쪽 끝 기둥, 벽 앞 첫 바닥 줄부터 네 줄), 칸 바닥은 짚 깔린 흙바닥 2010~2012, 칸 밖으로 흘러나온 짚 2013~2015를 들쭉날쭉하게. 짚 돗자리 108~170 네모 판은 쓰지 않는다. 칸마다 가축 2×2 하나(말 2023~2026·왼쪽 보는 말 2027~2030·젖소 2031~2034)를 먹이통 바로 앞에 두고 뒤 한 줄은 비워 드나들게, 물 양동이 하나. 안장 받침대는 벽 앞 마구 걸이(바닥에 서는 1×2) 바로 아래 — 바닥 한가운데 두지 않는다. 건초 더미 2×2(2019~2022)는 칸 앞, 곡식 자루·손수레는 문 옆, 우유·달걀 자리는 구석.
- 여관 지하 술창고: 남쪽 문을 닫고 동벽 3칸 폭 계단(x=11~13)으로만 오간다. 뒷벽 포도주 선반·술통 꼭지, 가운데 술통 선반 3×2 두 줄, 서쪽 벽면 아랫줄 쥐구멍 2050과 그 앞 곡물 자루 471·흰 고양이 385(첫 의뢰 쥐 잡기).
- 곡물 창고: 뒷벽 곡식 자루·통·옹기, 동쪽 벽면에 다락 사다리 472 두 줄(벽걸이), 나무 상판 계량 탁자 위 저울·저울추와 걸상, 손수레·손맷돌, 서쪽 쥐구멍과 갉아 먹힌 자루.
- 치료소: 진료실(약초장·물약 진열장·약재 서랍장, 나무 상판 진료대 위 약병·환약, 치유사 걸상, 대야·붕대, 대기 의자, 진찰 침대와 가림막)과 병실(침대·협탁 위아래 두 줄, 가운데 러너, 린넨 장·세면대). 침대 사이 칸이 갇히지 않게 가림막은 벽 끝에만.

## 가구 자리 규칙
숲마을 실내 분류(여관·민가)와 같다: 벽걸이는 벽면 두 줄 안, 키 큰 가구는 맨 윗행을 벽면 아랫줄에, 의자·걸상은 탁자 곁, 탁상 소품은 나무 상판 위, 문에서 목적지·계단까지 통로를 비우고 갇힌 바닥을 남기지 않는다. 모든 소품은 주인 곁에.
빈칸 검사(/tmp/oprn-qa/emptiness.py --kind interior): 맨바닥 정사각형 한 변 ≤3, 17×13 한 화면 맨바닥 ≤30%.

## 검사
${check}
${reach("staples")}
## 이 분류의 방
${list("staples")}
`);
}
{
  const k = GROUPS.sewer;
  const dun = c.tilesets.oprn_dungeon_stone;
  doc("sewer", `${k.id}-guide`, "RPG 실내 · 지하 하수 감옥 · 조립 규칙", `# 지하 하수 감옥 — 던전 시트 조립

타일셋은 oprn_dungeon_stone = 번들 던전 시트(easyrpg_chipset_dungeon, 30열·16px) 번호 그대로 + 480~488 이식(보물상자 480·광차 481/482 Tibo, 돌계단 483~485·흉벽 486~488 EasyRPG 마을). 공용 「RPG 던전」 분류의 지하 수로·납골당과 같은 조립이다(scripts/content/rpg-dungeons/kit.mjs, theme "stone").

## 벽 조립 (손으로 쌓지 않는다)
- 바깥은 공허 430과 abyss-gray 오토타일 테두리. 열린 칸 중 위가 공허인 첫 두 줄이 벽면: 윗줄 21|22|23, 아랫줄 51|52|53(왼끝·가운데·오른끝). 바닥은 회녹색 돌 187.
- 감방 칸막이는 공허 기둥(1칸 폭, 벽면까지 세로로)이다. 기둥 밑 첫 두 줄은 저절로 벽면 토막이 된다.
- 감방 앞 창살은 바닥 한 줄 위층: 왼끝 234, 가운데 235, 오른끝 236, 감방 문 205(창살 문, 닫힘). 감방 안은 일부러 못 들어가는 곳(sealed) — 통행 검사에서 뺀다. 감방 바닥은 흙 오토타일(dirt).
- 물길: 물 3(4칸 폭)을 맵 남쪽 끝까지 이어 흘러 나가게 한다(물길 끝을 막힌 네모 수조로 만들지 않는다). 가로지르는 판자 다리는 물 위에 141(위층)을 얹어 물이 한 덩어리로 남게 한다. 북쪽 끝 수문 창살 234|235|235|236은 물길 바로 위 바닥 줄.
- 위층에서 내려오는 돌계단 483|484|485는 벽면 두 줄에 새긴다(아래층, "^" 조각). 입구는 그 바로 아래 바닥.
- 조각: 화로 263/293, 석주 446/476, 침상 384/414, 해골과 뼈 299, 물통 419, 나무통 417, 항아리 418, 긴 탁자 385~387, 의자 327(왼쪽 보기)/328(오른쪽 보기), 둥근 탁자 326, 걸상 356, 책장 329/359, 이끼 394, 자갈 382·잔돌 383/412·돌무더기 259/260, 벽 균열 267·268/269, 붉은 카펫 오토타일(간수실 탁자 밑).

## 배치 규칙
- 감방마다 침상·해골·물통 중 둘 정도 — 누가 갇혀 있는지 보이게. 복도는 감방 앞 한 줄(창살 앞)을 비워 간수가 오간다.
- 간수실은 감방 옆에: 탁자와 양쪽 의자, 침대, 압수품 상자, 나무통.
- 둑길 3칸 중 물가 쪽은 비우고, 벽 쪽에 석주·화로·나무통 무리. 잔해는 흩뿌리지 말고 모서리·벽 곁에 몰아 둔다.
- 빈칸 검사(/tmp/oprn-qa/emptiness.py --kind dungeon --plain 421,187,108,301,67,110,141): 맨바닥 정사각형 한 변 ≤4, 17×13 한 화면 ≤40%.

## 이식표
${block(dun.tileGrafts)}

## 검사
${check}
${reach("sewer")}
## 이 분류의 방
${list("sewer")}
`);
}

for (const p of c.plans) {
  const m = c.maps[p.id];
  doc(p.group, p.id, p.name + " · 용도와 배치", `# ${p.name}

${p.use}.

${p.note}. ${m.width}×${m.height}, tilesetId=${p.tilesetId}. 입구 (${p.entry.join(",")})${p.keeper ? `, 주인·담당 자리 (${p.keeper.join(",")})` : ""}. 통행 검사 목표 ${JSON.stringify(p.targets)}.

![${p.name}](image:${p.id})

## 놓은 소품 (저작 순서)
tibo-kit은 tibo_interior_expanded의 structureKits id, tiles는 직접 놓은 번호 행렬, rug는 카펫 오토타일 섬, floor는 바닥 재질 칠. (x,y)는 왼쪽 위.${p.tilesetId === "easyrpg_chipset_ship" ? " 배 맵의 tibo-kit은 이식 번호로 바뀌어 들어간다(배 규칙 문서의 이식표)." : ""}${p.tilesetId === "oprn_dungeon_stone" ? " 던전 맵은 prop(조각 이름)·tiles(번호 행렬, 왼쪽 위 기준)로 적었다." : ""}
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
  const t = c.tilesets[k.catalogTileset ?? k.tilesetId];
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
const out = Object.entries(GROUPS).map(([g, { tilesetId, catalogTileset: _ct, ...k }]) => ({ tilesetId, category: { ...k, documents: docs[g], images: images[g] } }));
for (const { category: k } of out) if (k.documents.length > 64 || k.documents.some((d) => d.markdown.length > 12e4)) throw Error("Reference page limit " + k.id);
fs.writeFileSync(target, JSON.stringify(out) + "\n");
console.log(out.map(({ category: k }) => ({ id: k.id, documents: k.documents.length, images: k.images.length })), fs.statSync(target).size);
