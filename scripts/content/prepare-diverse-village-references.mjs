// Bundle-owned guidance. No project/host writes; --dry lists targets only.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const dir = "tiledata/forest-villages/diverse", target = "src/assets/sharedDiverseVillageReferences.json", preview = "public/assets/diverse-village-references";
if (process.argv.includes("--dry")) {
  console.log({ source: dir, target, preview });
  process.exit(0);
}
fs.mkdirSync(preview, { recursive: true });
const c = JSON.parse(fs.readFileSync(dir + "/catalog.json")), validation = JSON.parse(fs.readFileSync(dir + "/validation.json")), t = c.tileset, docs = [];
const block = (o) => "```json\n" + JSON.stringify(o, null, 2) + "\n```\n";
const rows = (a, w) => "```text\n" + Array.from({ length: a.length / w }, (_, y) => a.slice(y * w, (y + 1) * w).join(" ")).join("\n") + "\n```\n";
function doc(id, name, markdown) {
  fs.writeFileSync(dir + "/" + id + ".md", markdown.replaceAll(/\(image:([^)]+)\)/g, "(images/$1.png)").trimEnd() + "\n");
  docs.push({ id, name, markdown });
}
const crop = (m, x, y, w, h) => ({ width: w, height: h, lowerTiles: Array.from({ length: h }, (_, dy) => m.lowerTiles.slice((y + dy) * m.width + x, (y + dy) * m.width + x + w)), upperTiles: Array.from({ length: h }, (_, dy) => m.upperTiles.slice((y + dy) * m.width + x, (y + dy) * m.width + x + w)) });
doc("guide", "세 마을을 다르게 만드는 기준", `# 산촌·절벽·포구 — 서로 다른 세 마을

이슬여울 맵을 변형하지 않고 빈 지면에서 새로 저작했다. 집 그림과 3행 숲 몸통 등 검수된 부품을 재사용하며 지형·길·집 원점은 별도로 설계했다. 모두 16px, forest_harmony 기반 30열. 이 자료의 정확한 이식 정의는 catalog.json의 tileset 및 부품 결합 사전에 있다. 기본 타일셋의 같은 숫자가 같은 그림이라고 추정하지 않는다.

## 다양성을 만드는 결정 순서
1. 지형과 생활권부터 고른다. 산촌은 떨어진 두 둔덕과 평지 집, 절벽마을은 중첩 대지와 높이별 생활권, 포구는 남·동쪽 물굽이와 선착장이다.
2. 같은 직선 길 양쪽에 집을 대칭 배치하지 않는다. 집마다 x,y를 지정하고 문앞을 길의 가지로 연결한다. 각 마을 문서에 좌표와 폭·높이를 고정 기록했다.
3. 절벽의 내부·외부와 계단 착지칸을 먼저 확정한다. 다음 물→건물 전체 조립→길→숲 전체 조립→생활 소품→독립 나무 순서. 소품이 문·계단·선착장 접근을 막으면 그 소품만 철회한다.
4. 꽃/빨래, 수확/씨앗, 장작/작업대, 약초/화분을 생활권별로 모은다. 1칸마다 무작위로 뿌리지 않는다. 큰 숲 내부는 검은 생략 수관, 열린 구역은 잔디·길·생활 소품이다.
5. 입력/정답: 각 마을의 cliffs, houses, stairs, ponds, spine이 입력 계획이다. full layout 문서와 지역 read_region_reference의 16행 이하 연속 페이지가 전체 하위/상위 정답이다. 이미지의 방향만 보고 번호를 추측하지 않는다.
6. 작업 복사본에 먼저 배치하고 모든 접근칸 검사 후 통째로 저장한다. 실패한 일부 배치를 원본 프로젝트에 남기지 않는다. 이 참고 맵은 외관/타일 통행 사례이며 실내·NPC·문 전이 이벤트는 포함하지 않는다.

## 실제 구분
${c.plans.map((p) => `- ${p.name}: ${p.width}×${p.height}, 집 ${p.houses.length}채. ${p.note}.`).join("\n")}

## 보존과 재현
catalog.json은 새 세 맵/부품/좌표의 정답. 이슬여울 정본 프로젝트는 변경하지 않았다. 원본 픽셀 그림은 images/ 및 공용 지역 PNG, 번들 열람용 그림은 긴 변 820px 이내/128색 축소본으로 구분한다. 축소 그림은 타일로 잘라 쓰지 않는다.
지역 카드는 각각 pine-hamlets-80x64, terrace-cliff-village-88x72, reed-bay-village-88x64. 다운로드에는 해당 맵, 모든 필요한 이식과 통행 메타데이터가 있다. 새 프로젝트/기존 프로젝트 모두 forest_harmony의 번들 참고문서 보충 경로로 이 자료를 얻는다. 원격 행 패치는 배포 방식이 아니다.
`);
for (const p of c.plans) {
  const m = c.maps[p.id];
  doc(p.id, p.name + " · 지형과 배치", `# ${p.name}

${p.note}. 시작점 (${p.start.x},${p.start.y}); 집 ${p.houses.length}채. 0기준 맵 좌표. 모든 집은 고정 조각이며 회전/잘라내기 금지. cliffs.points는 x가 증가하는 절벽 윗선 꼭짓점, height는 윗선→밑단의 y 차이다. stairs=[x,y,height]는 폭2, 윗선 행 y부터 y+height까지이고 양끝 착지칸은 y-1/y+height+1이다. 이전 plateaus 윤곽은 사용하지 않는다. 몸통·지붕·소품 전체 배열은 다음 부품 문서와 연결한다.

![${p.name} 완성](image:${p.id})

## 입력 계획과 예약할 접근칸
${block({ mapId: p.id, width: p.width, height: p.height, seed: p.seed, start: p.start, cliffs: p.cliffs, stairs: p.stairs, ponds: p.ponds, coast: p.coast ?? false, dock: p.dock ?? null, cave: p.cave ?? null, spine: p.spine, access: p.access })}

## 건물의 전체 하위·상위
${p.houses.map((h) => "### " + h.id + "\n" + block({ ...h, ...crop(m, h.x, h.y, h.w, h.h) })).join("\n")}
`);
  for (let i = 0; i < p.placements.length; i += 32) {
    doc(p.id + "-objects-" + (i / 32 + 1), p.name + " · 소품 " + (i / 32 + 1), "# 실제 소품의 완전한 두 레이어 배열\n\n각 항목 (x,y,w,h)는 맵 절대 좌표다. 하위는 정답 바닥 포함. upper=-1은 빈 칸이다. 다른 곳에 상위 소품만 복제할 때 하위 바닥은 유지한다.\n" + p.placements.slice(i, i + 32).map((o) => "## " + o.name + "\n" + block({ ...o, ...crop(m, o.x, o.y, o.w, o.h) })).join("\n"));
  }
  for (let y = 0; y < m.height; y += 16) {
    doc(p.id + "-rows-" + y, p.name + ` · ${y}행부터 전체 배열`, `# ${p.name} 전체 배열 y=${y}..${Math.min(y + 15, m.height - 1)}

각 행의 폭 ${m.width}. x=0..${m.width - 1}, 위→아래 y 증가, -1은 빈 칸. mapId=${m.id}, tilesetId=forest_harmony, 16px. 원본 결합 사전과 함께 읽는다.

## lowerTiles
${rows(m.lowerTiles.slice(y * m.width, Math.min(y + 16, m.height) * m.width), m.width)}
## upperTiles
${rows(m.upperTiles.slice(y * m.width, Math.min(y + 16, m.height) * m.width), m.width)}
`);
  }
}
const used = [...new Set(Object.values(c.maps).flatMap((m) => [...m.lowerTiles, ...m.upperTiles]).filter((n) => n >= 0))].sort((a, b) => a - b);
const dictionary = used.map((tile) => {
  const g = t.tileGrafts.find((g2) => g2.targetTile === tile), sourceTile = g?.sourceTile ?? tile, sourceChipset = g?.sourceChipset ?? t.image.id, cols = sourceChipset === "tex_shared_forest_village_objects" ? 6 : sourceChipset === "tex_forest_harmony_grass_joins" ? 9 : 30;
  return { tile, tilesetId: t.id, sourceChipset, sourceTile, sourceX: sourceTile % cols, sourceY: Math.floor(sourceTile / cols), pixelX: sourceTile % cols * 16, pixelY: Math.floor(sourceTile / cols) * 16, width: 16, height: 16, targetX: tile % 30, targetY: Math.floor(tile / 30), layers: ["lower", "upper"].filter((l) => Object.values(c.maps).some((m) => m[l + "Tiles"].includes(tile))), passability: t.passability[tile], priority: t.priority[tile], tileMeta: t.tileMeta[tile] };
});
fs.writeFileSync(dir + "/part-dictionary.json", JSON.stringify(dictionary, null, 2));
for (let i = 0; i < dictionary.length; i += 60) doc("dictionary-" + (i / 60 + 1), "원본·이식·레이어 사전 " + (i / 60 + 1), "# 사용 타일 부품 사전\n\nsource는 원본 시트, target은 이 마을용 합성 시트다. 0기준. 폭/높이는 픽셀이다. 레이어와 통행은 별개.\n" + block(dictionary.slice(i, i + 60)));
const sourceCliffs = JSON.parse(fs.readFileSync(dir + "/cliff-source.json"));
doc("cliff-assembly", "절벽 개정3 · 잔디색과 사선 경계", `# 큰 폭포 아래 마을의 절벽 문법

개정1의 ‘대지 둘레 얇은 띠·남면 2행’은 사용자가 지적한 잘못된 구성이다. 북·서·동쪽에 같은 띠를 둘러 성벽처럼 닫지 않는다. 굽은 남향 윗선에서 충분한 높이의 면을 내리고, 같은 윤곽을 아래로 평행 이동해 밑단을 닫는다. 좌우 사선 몸통은 서로 다른 그림이다.

![참고 · 큰 폭포 아래 마을](image:cliff-reference)
![수정 전 · 얇은 테두리](image:cliff-before)
![수정 후 · 연속 암벽 면과 계단](image:terrace-cliff-village)

## 번호와 레이어 정정
개정3은 바닥240의 색을 유지한다. 참고 마을의 밝은 잔디 원본을 그대로 가져오던 개정2를 폐기한다. 아래 cliffBindings의 키는 열 문법 식별용 옛 원본 번호이며, 현재 그림의 실제 출처는 tileGrafts다. 498/499/528/529/619의 잔디 픽셀만 바닥색으로 맞추고, 암벽 면은 forest_harmony 팔레트로 연결한다. 504/505는 별도 잔디 사선 마감이며 682/711 암벽 면을 대체하는 타일이 아니다. 개정1은 오른쪽 사선 몸통232도 빠뜨렸다.
${block(t.tileGrafts.filter(g=>g.targetTile>=2670))}
${block(c.cliffBindings)}

암벽은 **upper**, 아래 잔디/지면은 **lower에 보존**한다. stairs374는 lower이며 같은 칸 upper=-1이다. 이 표본의 암벽은 통행 불가, 계단은 통행 가능이다. 홈 레이어와 렌더 우선순위는 별개다. old ‘모두 lower’ 설명을 적용하지 않는다.

## 그대로 실행하는 열 조립
1. points의 두 꼭짓점 (x0,y0),(x1,y1) 사이를 y=round(y0+(y1-y0)*(x-x0)/(x1-x0))로 채운다. x는 정수, |y1-y0|≤x1-x0. 한 열만 튀어나와 좌우 캡이 동시에 필요한 꼭짓점은 금지한다.
2. 현재 y가 왼쪽 열보다 크면 왼쪽 사선, 오른쪽 열보다 크면 오른쪽 사선, 나머지는 정면이다. 첫/마지막 열의 바깥 이웃은 현재 y-1로 간주한다.
3. 왼쪽: 원본18 → 231을 h-1번 → 48. 정면: 139 → 172를 h-1번 → 202. 오른쪽: 19 → 232를 h-1번 → 49. 각 열 upper의 y..y+h에 쓴다. 타일 그림을 늘이거나 좌우 반전하지 않는다.
4. 계단 [x,y,h]: lower에 원본374를 폭2·높이h+1 반복하고 upper를 전부 비운다. 착지칸 y-1/y+h+1을 길로 잇는다. 사선 위에 걸치지 않고 두 열의 윗선 높이가 같은 곳에서만 연결한다.
5. 절벽 전체→계단·입구→집→길→숲→소품. 면이 차지할 모든 칸을 먼저 예약한다. 집·뿌리·문앞을 덮으면 그 배치를 중단한다. 새 표본 높이 h=5 또는6; 원본 표본은 h=7이다.

## 기준 맵에서 그대로 추출한 정상 열
원점과 전체 두 레이어 배열이다. 높이8=윗선1+몸통6+밑단1. upper의 번호는 참고 맵 원본 번호이며 역사적 구조 표본이다. 색은 이 개정3 출력과 다르므로 이 배열을 색 기준으로 재사용하지 않는다. 새 맵은 cliffBindings와 현재 tileGrafts를 함께 사용한다.
${block(sourceCliffs)}

## 실제 입력과 출력
${c.plans.map(p=>"### "+p.name+"\n"+block({cliffs:p.cliffs,stairs:p.stairs})).join("\n")}
전체 출력은 각 rows 문서의 두 레이어 배열을 사용한다. 구현은 scripts/content/lib/village-cliffs.mjs의 cliffColumns/paintVillageCliffs다.

동굴 입구는 층바위 (71,52), upper 원본413이며 받침은 원본172다. 접근칸 (71,54)은 비워 둔다. 실내 전이 이벤트는 없다.
선착장은 포구 (56,45), 폭21·높이2. lower 물/땅을 보존하고 upper199를 반복한다. 마지막 (76,45)까지 연결을 검사한다.
`);
const grassSource = JSON.parse(fs.readFileSync(dir + "/grass-joins-source.json"));
doc("grass-joins", "504·505 사선 · 현재 바닥색 유지", `# 사선 잔디 경계와 바닥색

사용자 확정: 기본 바닥240의 그림/색을 유지하고 504·505와 498·499·528·529의 경계를 맞춘다. 원본 시트의 밝은 589로 바닥 전체를 바꾸지 않는다. 공용 tex_forest_harmony_grass_joins는 16px·9열·9칸의 별도 파생 시트다. 기존 forest_harmony 시트 바이트와 이슬여울은 그대로다.

![수정 전 · 경계 잔디색 불일치](image:grass-before)
![수정 후 · 바닥색 유지](image:terrace-cliff-village)

## 정확한 부품 사전
![공용 색 맞춤 시트 · 왼쪽부터 0..8](image:grass-joins-atlas)
${block(grassSource)}
${block({tilesetId:'forest_harmony',grassBindings:c.grassBindings,grafts:t.tileGrafts.filter(g=>g.sourceChipset==='tex_forest_harmony_grass_joins')})}

새 공용 시트 0=504 북서 사선(잔디는 남동쪽), 1=505 북동 사선(잔디는 남서쪽), 2=기존 바닥240 픽셀 그대로. 3/4=498/499 윗 모서리, 5/6=528/529 밑 모서리, 7=619 정면 윗선. 사선 투명 알파는 원본과 동일하며 잔디 세 색 영역만 바닥240 텍스처와 원래 명암 위치로 교체했다. 8=712 오른쪽 암벽: 기존 시트에 남아 있던 어두운 원본 팔레트만 왼쪽711과 맞춘다. 픽셀 위치/형태를 반전하거나 늘이지 않는다. 암벽 모서리의 비잔디 픽셀은 현재 forest_harmony와 같다.

## 레이어 정정과 실행 순서
옛 tileMeta의 504/505 ‘녹색 삼각 지붕’ 설명을 이 용도에 사용하지 않는다. 여기서는 **잔디 경계**다. 새 시트 0/1은 lower, layerBacking=2. forest_harmony에 이식한 2692/2693은 lower, layerBacking=240. 상위 소품을 그대로 두고 바닥240 위에 사선만 합성한다. passage=passable, priority=lower. 암벽 3..8은 upper·solid이며 두 속성을 섞지 않는다.

1. 절벽 열·계단→집·길·숲·소품 배치를 끝낸다.
2. 절벽 첫 꼭짓점 (x0,y0)에서 북서 사선504를 (x0+k,y0-1-k), 마지막 꼭짓점 (x1,y1)에서 북동 사선505를 (x1-k,y1-1-k)에 놓는다. k=0..3.
3. lower가 정확히240이고 길이 아닌 칸만 교체한다. 길·건물 바닥·뿌리/줄기 칸은 건너뛴다. upper는 어떤 칸도 바꾸지 않는다. 바닥 받침은240을 지정한다.
4. 실제 적용 좌표는 아래 표를 정답으로 한다. 일부 칸이 길/건물이라 생략됐다고 빈칸에 임의 부품을 추가하지 않는다.
${c.plans.map(p=>'### '+p.name+'\n'+block(p.grassJoins)).join('\n')}

## 입력 → 완전한 두 레이어 출력
층바위 절벽의 북서 마감과 북동 마감. 좌표는 맵 기준, 배열은 행 단위다.
${block({x:18,y:13,...crop(c.maps['terrace-cliff-village'],18,13,8,8)})}
${block({x:68,y:13,...crop(c.maps['terrace-cliff-village'],68,13,8,10)})}

자동 검사 grass-edge-direction은 반대 사선, grass-color-mismatch는 밝은 원본504/505를 잘못 쓴 칸, grass-backing은 받침240 누락의 좌표를 반환한다. 정상/오류 그림은 검증 문서 참조. 위의 파생 시트는 모든 새/기존 프로젝트에서 번들 등록되며 문서는 forest_harmony를 공유한다.
`);
doc("forest-assembly", "숲·가구·울타리 · 전체 조각 규칙", `# 3행 숲과 생활 소품

상위 수관은 forest_harmony_grove_47, 원본 tex_forest_cliff_reference. lower 몸통 첫 행은 남쪽 수관 마지막 행과 같은 y. 왼쪽3열→2열 반복→오른쪽3열, 최소폭8, 높이3을 통째로 놓는다. 기존 6행 forest-repeat 조립법과 시작 행을 혼동하지 않는다.
${block({ left: [[1422, 1423, 1424], [1426, 1427, 1428], [1430, 1431, 1432]], body: [[1425, 1350], [1429, 1428], [1433, 1432]], right: [[1453, 1454, 1455], [1457, 1458, 1459], [1461, 1462, 1463]] })}
폭 w>4는 span=max(8,2*ceil(w/2)). 왼쪽 s, 몸통 s+3+2*k, 오른쪽 s+span-3. 영역에 안 맞으면 s+w-span을 원점으로 전체 조각을 다시 시도한다. 폭≤4는 LEFT+BODY첫열 또는 BODY둘째열+RIGHT의 4×3 마감만 사용한다. 3행 전부가 자유칸이고 첫행 전체에 수관이 있어야 한다. 안 맞으면 노출 수관 행을 줄여 맞춘다. 뿌리를 자르지 않는다. 이 예제의 대지 내부에는 큰 숲을 새로 깔지 않고 독립 나무를 사용해 절벽·집을 가리지 않았다.

이웃 bit 순서 N,E,S,W,NE,SE,SW,NW. 이웃 수관일 때 bit=1. 아래 variantMap으로 외곽/안쪽 모서리를 선택한다.
${block(t.autotileGroups.find((g) => g.id === "forest_harmony_grove_47").variantMap)}

입력 산촌 숲 영역 rect=(2,48,16,14). 아래 upper의 수관 번호가 마스크 true이고 lower는 뿌리/바닥 정답이다. 전체 산촌 그림의 왼쪽 아래와 대조한다.
${block(crop(c.maps["pine-hamlets"], 2, 48, 16, 14))}

가로 탁자: upper [234,235,236], 폭3·높이1 고정. 과일상자 upper[202,203], 별도 상위 조각. 하위 KEEP. 같은 상위 칸에 겹쳐 넣지 않는다.
울타리 소품: upper[2636,2637], 폭2·높이1의 완결 패널이다. 회전하거나 잘라 모서리로 쓰지 않는다. 닫힌 울타리가 필요하면 기존 공용 fence-gate의 NW378/NE380/SW438/SE410, 수평379, 수직408을 쓰고 출입구를 비운다. 이번 표본에는 닫힌 울타리 조립을 쓰지 않았다.
`);
let checks = "# 정상·오류와 자동 좌표 검사\n\n```bash\nnode scripts/content/validate-diverse-villages.mjs project.json terrace-cliff-village\n```\n\n3개 동결 표본과 같은 번호/배치를 비교하고, 잔디 사선의 방향·색 판본·바닥 받침을 검사하며 절벽 열 문법으로 사선 몸통·밑단·계단 끝을 별도 검사하는 읽기 전용 도구다. 임의 마을을 잘못된 마을이라고 판정하지 않는다. 성공 exit0, 오류 exit1. 최대128개와 전체 수를 반환한다. 엔진 타일 통행만 검사하며 NPC/실내/이벤트/미적 품질은 판정하지 않는다.\n" + block(validation.normal);
for (const e of validation.examples) checks += "\n## " + e.input.code + "\n" + block(e) + "\n![왼쪽 정상, 오른쪽 오류](image:" + e.input.code + ")\n";
doc("validation", "좌표 검증 · 정상/오류 10종", checks);
const images = fs.readdirSync(dir + "/images").filter((n) => n.endsWith(".png")).sort().map((n) => {
  const file = preview + "/" + n;
  execFileSync("convert", [dir + "/images/" + n, "-strip", "-filter", "point", "-resize", "820x820>", "-colors", "128", "-define", "png:compression-level=9", file]);
  return { id: n.slice(0, -4), name: n, caption: n.includes("village") || n === "pine-hamlets.png" ? "실제 타일 완성 지도 · 열람용 축소본" : "정상/오류 실제 타일 비교", dataUrl: "data:image/png;base64," + fs.readFileSync(file).toString("base64") };
});
const category = { id: "diverse-villages-grass-v3", name: "다양한 마을 · 산촌·절벽·포구 (잔디 경계 개정3)", description: "서로 다른 새 지역 3개, 지형·집·생활권 계획, 전체 배열과 원본/이식 사전, 문·계단·부두 접근 및 10종 오류 검사", documents: docs, images };
if (docs.length > 64 || docs.some((d) => d.markdown.length > 12e4)) throw Error("Reference page limit");
fs.writeFileSync(target, JSON.stringify([category]) + "\n");
console.log({ documents: docs.length, images: images.length, bytes: fs.statSync(target).size, tiles: dictionary.length });
