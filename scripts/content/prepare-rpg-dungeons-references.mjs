// Bundle-owned guidance for tiledata/rpg-dungeons → src/assets/sharedRpgDungeonReferences.json. No project/host writes.
// Three categories (natural caves · built dungeons · the large dungeon), all carried by the bundled dungeon sheet
// easyrpg_chipset_dungeon: every map is drawn on that sheet's numbering (the oprn_dungeon_* tilesets are the
// same sheet with grafts after 479 or repainted colours).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const dir = "tiledata/rpg-dungeons", target = "src/assets/sharedRpgDungeonReferences.json", preview = "public/assets/rpg-dungeon-references";
const c = JSON.parse(fs.readFileSync(dir + "/catalog.json")), validation = JSON.parse(fs.readFileSync(dir + "/validation.json"));
const block = (o) => "```json\n" + JSON.stringify(o, null, 2) + "\n```\n";
const rows = (a, w) => "```text\n" + Array.from({ length: a.length / w }, (_, y) => a.slice(y * w, (y + 1) * w).join(" ")).join("\n") + "\n```\n";
const NATURAL = new Set(["cave", "mine", "ice", "lava", "sea", "lair"]);
const categoryOf = (p) => (p.series === "grand" ? "grand" : p.series === "sunken" ? "sunken" : p.series === "frontier" ? "frontier" : NATURAL.has(p.series) ? "natural" : "built");
const CATEGORY = {
  natural: { id: "rpg-dungeons-natural-v2", name: "RPG 던전 · 자연 동굴·광산·얼음·용암·해저·용의 둥지 (개정2)", description: "자연 동굴 네 칸 연결(입구·갈림길·보물방·보스방), 레일 광산, 얼음 동굴, 용암 동굴, 해저 동굴, 용의 둥지. 불규칙한 방 몸통·바위 혀·물/용암 웅덩이·벽 모서리 잔해 규칙과 전체 배열" },
  // v2 (2026-09-25): the demon hall's south door became a rim gap that leads to the new 마왕성 정문 홀 (frontier).
  built: { id: "rpg-dungeons-built-v2", name: "RPG 던전 · 묘지·수로·신전·마법사 탑·마왕성·피라미드 (개정2)", description: "지하 묘지, 지하 수로, 고대 신전, 마법사 탑 1~3층과 옥상(계단 위치 맞춤), 마왕성 복도·함정방·보스방 앞, 피라미드 기둥 회랑과 왕의 묘실(석관). 지은 던전의 벽·계단·가구 묶음 규칙과 전체 배열" },
  grand: { id: "rpg-dungeons-grand-v1", name: "RPG 던전 · 큰 던전 「잊힌 수문 유적」 80×64 (개정1)", description: "입구 동굴·수문 수로·적암 전실과 보스방·무너진 대전 네 구역을 한 바퀴 도는 길과 지름길로 이은 큰 던전. 레버·열쇠 자리, 구역마다 다른 바닥과 전체 배열" },
  // Added 2026-09-25 as its own category, so existing projects receive it (ensureRpgDungeonReferences only adds missing ids).
  // Added 2026-09-25 as its own category (existing projects receive it through the ensure path).
  frontier: { id: "rpg-dungeons-frontier-v1", name: "RPG 던전 · 마왕성 정문·투기장·늪 신전·해적 소굴·우물 밑 굴", description: "마왕성 정문 홀(1층 복도와 외관 성문 사이), 투기장 경기장(모래판·관중석·우승자 관람석, 투사 대기실 계단), 독늪에 잠긴 폐신전(검붉은 진창 늪과 널판 길), 바다로 트인 물길의 해적 소굴(선착장·배·야영지·보물 굴·망루), 마을 우물 밑 첫 모험용 작은 굴. 출입구·계단·늪/물·채움 규칙과 전체 배열" },
  sunken: { id: "rpg-dungeons-sunken-temple-v2", name: "RPG 던전 · 해저 신전 세 방 (입구 회랑·산호 기둥 대전·바다 여신 제단, 개정2)", description: "해저 동굴 북쪽에서 이어지는 물에 잠긴 신전 세 방. 해저 재칠 시트(oprn_dungeon_sea)의 바다 바위 벽·석주, 신전 석판 바닥, 곧은 물길과 판자 다리, 바닥이 꺼진 불규칙한 물웅덩이, 석주 밑동의 산호 무리·해초, 제단 섬을 두른 둥근 물 해자, 벽 아치·테두리 문 틈 출입구. 방 잇기·채움 규칙과 전체 배열" },
};
const docs = Object.fromEntries(Object.keys(CATEGORY).map((k) => [k, []]));
const doc = (cat, id, name, markdown) => {
  fs.writeFileSync(`${dir}/${id}.md`, markdown.replaceAll(/\(image:([^)]+)\)/g, "(images/$1.png)").trimEnd() + "\n");
  docs[cat].push({ id, name, markdown });
};
const plansIn = (cat) => c.plans.filter((p) => categoryOf(p) === cat);
const check = "```bash\nnode scripts/content/author-rpg-dungeons.mjs   # 저작 + 통행 검사(닿지 않는 목표가 있으면 멈춤)\npython3 /tmp/oprn-qa/emptiness.py tiledata/rpg-dungeons/catalog.json --kind dungeon --plain 421,187,108,301,67,110,141\n```\n";
const reach = (cat) => block(validation.filter((r) => plansIn(cat).some((p) => p.id === r.id)).map(({ id, entry, targets, reachable, walkable, blocked, sealed }) => ({ id, entry, targets, reachable, walkable, blocked, ...(sealed ? { sealed } : {}) })));
const list = (cat) => plansIn(cat).map((p) => `- ${p.name} (${p.id}, ${c.maps[p.id].width}×${c.maps[p.id].height}, ${p.tilesetId}): ${p.note}.`).join("\n");
const grafts = c.tilesets.oprn_dungeon_stone.tileGrafts;

const COMMON = `## 공통 벽 문법 (손으로 벽을 쌓지 않는다)
모든 맵은 EasyRPG 던전 칩셋(30열·16px) 번호로 그린다. 좌표는 0기준 맵 좌표.
1. 맵 전체가 공허(테마의 테두리 오토타일 몸통)이고, 열린 칸(방·통로)을 먼저 정한다.
2. 열린 칸 중 바로 위가 공허면 벽면 윗줄, 그 아래 한 줄이 벽면 아랫줄, 나머지가 바닥이다. 그래서 **가로 통로는 네 줄 높이**(위 두 줄은 벽면, 아래 두 줄로 걷는다)로 판다. 세로 통로·옆벽은 벽면이 생기지 않는다.
3. 공허 칸을 테마 테두리 오토타일로 성형한다(돌 abyss-gray, 얼음 abyss-blue, 용암 pit-gold).
4. 물(동굴 시트의 낭떠러지 자리를 물로 다시 칠한 칸)·용암·얼음·구덩이는 **가장자리가 불규칙한 한 덩이**로 칠한 뒤 오토타일로 성형한다. 네모 수조·십자 수조·네모 용암 스티커는 쓰지 않는다. 판자 다리는 그 물·낭떠러지 칸 위에만 upper 141로 얹는다.
5. 통로로 이어지지 않은 작은 공허 상자(떠 있는 벽 토막)와 본체에서 떨어진 작은 바닥 섬은 저작 단계에서 지운다. 여러 통로가 한 바퀴 도는 큰 던전은 그 가운데 큰 암반을 남긴다.

## 이식 칸 (oprn_dungeon_* 타일셋의 480칸부터)
${block(grafts)}
480 보물상자(Tibo 837), 481·482 광차, 483~485 돌계단 왼·가운데·오른쪽(EasyRPG 마을 111~113), 486~488 흉벽(마을 108~110). 사막 시트(oprn_dungeon_desert)는 쓰지 않는 레일 칸 54·55·84·85·116·144에 파라오 석관(2×3)을 직접 그려 넣고 통행 불가로 바꿨다.

## 채움 규칙
- 잔해·뼈·돌은 무너진 벽 옆이나 방 모서리 **한~세 곳에 무더기**로. 바닥이 보여야 한다. 바닥 전체에 고르게 뿌리지 않는다.
- 던전 안에 잔디·이끼 타일 없음, 벽면에 바닥·이끼 타일 없음, 색이 다른 네모 바닥 조각 없음.
- 테마: 용암 동굴·마왕성에 푸른 수정 없음, 광산·하수도에 벤치·식탁 없음, 보스 자리는 그루터기가 아니라 제단·마법진, 석관은 구멍이 아니라 관 그림.
- 넓은 바닥은 소품이 아니라 지형으로 끊는다: 벽에서 튀어나온 바위 혀, 불규칙한 웅덩이·용암·구덩이, 기둥 줄. 소품은 쓰임이 있는 묶음(야영지, 광맥, 난파선 짐, 부장품)으로 놓는다.
- 빈칸 게이트: 가장 큰 빈 정사각형 4칸 이하, 17×13 한 화면의 빈 바닥 40% 이하.

## 계단
- 오르는 계단: 벽면 두 줄에 3칸 폭 돌계단(483~485 두 줄, lower). 벽면에 걸려 위로 올라가는 모습.
- 내려가는 계단: 바닥에 같은 돌계단 두 줄을 깔고 바로 위 줄에 쇠 난간 234·235·236(통행 불가)을 둔다.
- 층을 잇는 탑은 같은 x에 계단을 놓는다: 아래층의 오르는 계단 자리가 위층의 내려가는 계단 자리다. 팔각 탑의 잘린 모서리에는 계단을 두지 않는다.
`;

doc("natural", "rpg-dungeons-natural-guide", "자연 던전 규칙 · 불규칙한 몸통과 바위 혀", `# 자연 동굴·광산·얼음·용암·해저·용의 둥지

${COMMON}
## 자연 던전만의 규칙
- 방 몸통은 씨앗 있는 덩이(blob)로 파서 가장자리가 불규칙하다. 벽에서 뻗은 바위 혀로 넓은 굴을 나눈다(떠 있는 바위 섬은 두지 않는다).
- 동굴 물(oprn_dungeon_cave·oprn_dungeon_sea 시트): 낭떠러지 오토타일(129~131·159~161·189~191·219~221)의 속을 물로 칠한 칸이라 바위 턱이 남는다. 지하 샘·개울·석호가 모두 이 한 무리다.
- 광산 레일: 가로 116, 세로 144, 모서리 54·55·84·85. 갈림목은 2×2 회전대로 잇는다. 본선(입구→막장)에서 지선이 회전대로 갈라지고 물 찬 균열은 레일 다리로 건넌다. 광산에는 벤치·식탁이 없다.
- 얼음 동굴: 얼어붙은 호수(ice 오토타일) 위에는 아무것도 세우지 않는다. 수정은 샘굴 한 곳과 물가 한 곳에 무리로.
- 용암 동굴: 불의 강은 굽이치다가 다리 자리만 곧게 폭을 맞춰 판자 다리를 얹는다. 푸른 수정 없음.
- 용의 둥지: 불규칙한 용암 해자가 둥근 섬을 두르고, 남·북 바위 둑으로 건넌다. 섬 위에는 금 더미(이 시트에서 259·260·322·323·352·353·382·383을 금으로 다시 칠함)와 알(290) 셋만, 흩어진 돌·석순은 두지 않는다.
- 해저 동굴: 바다로 트인 석호, 뱃머리가 바다 쪽인 난파선 갑판(물 위 판자), 짐은 갑판 옆 모래밭에. 산호(이 시트의 갈색 바위 칸)는 두 무리.

## 검사
${check}
${reach("natural")}
## 실제 구분
${list("natural")}
`);

doc("built", "rpg-dungeons-built-guide", "지은 던전 규칙 · 통로·기둥·계단·가구 묶음", `# 지하 묘지·수로·신전·마법사 탑·마왕성·피라미드

${COMMON}
## 지은 던전만의 규칙
- 지하 묘지: 곧은 참배길(무늬 석판 109)과 가로 회랑 둘, 회랑 아래 매장실마다 비석 두세 개. 무너진 곳은 불규칙한 구덩이 하나.
- 지하 수로: 곧은 수로 양옆 좁은 둑(3칸 이하), 창살 수문, 판자 다리. 벤치 없음.
- 고대 신전: 문에서 제단까지 붉은 카펫, 무늬 석판 신랑 양옆 기둥 줄(하나는 쓰러져 돌무더기).
- 마법사 탑: 18×16 팔각 껍데기. 오르는 계단은 곧은 북쪽 벽면에만(1층 x5~7 → 2층 내려가는 계단 x5~7, 2층 x10~12 → 3층 x10~12, 3층 x5~7 → 옥상 x5~7). 카펫은 걷는 줄을 따라 테두리 있는 직사각형 러너로, 가구는 쓰임별 묶음(독서 탁자+의자 둘+러그, 둥근 탁자+걸상 둘, 침대+협탁, 책상+걸상). 옥상은 벽이 없고 가장자리를 흉벽(486~488)이 두르며 그 너머는 허공이다. 카펫·횃불 없음.
- 마왕성(마왕성 왕좌의 방과 같은 조립): 적암 바닥, 갈색 두 줄 벽면, 회색 공허 테두리, 붉은 러너. 용암은 가장자리가 불규칙한 못·틈으로, 모양·크기를 다르게. 보스방 앞 북쪽 출구는 판타지 장소 「마왕성 왕좌의 방」 입구(14,24)와 맞춘다.
- 피라미드: 사막 재칠 시트. 기둥 회랑은 폭 9칸 가운데 무늬 석판 신랑과 기둥 두 줄, 짧은 문으로 곁방 넷(여신상 방·가고일 방·보물 벽감·무너진 방). 왕의 묘실은 동심 석판 단 한가운데 파라오 석관(2×3)을 석상·가고일 넷과 화로 둘이 지킨다.

## 검사
${check}
${reach("built")}
## 실제 구분
${list("built")}
`);

doc("sunken", "rpg-dungeons-sunken-temple-guide", "해저 신전 규칙 · 물길·가라앉은 바닥·산호·제단 해자", `# 해저 신전 — 물에 잠긴 입구 회랑 · 산호 기둥 대전 · 바다 여신 제단

${COMMON}
## 해저 신전만의 규칙
- 시트: 해저 재칠 oprn_dungeon_sea. 벽면(21~23·51~53)·석주(446/476)·여신상·가고일은 청록 바다 바위, 신전 바닥 108·무늬 석판 109는 원래 석판색 그대로, 산호는 이 시트의 갈색 바위 칸(큰 산호 318·319/348·349, 작은 산호 288, 산호 더미 259·260, 산호 조각 412).
- 방 잇기: 해저 동굴(dungeon-sea-cave) 북쪽 출구(15,0) → 입구 회랑 남쪽 문 틈(17,22) → 북쪽 벽 아치 앞(17,5) → 대전 남쪽 문 틈(19,27) → 북쪽 벽 아치 앞(19,5) → 제단실 남쪽 문 틈(16,23). 이동 이벤트는 없다(좌표만).
- 출입구는 방에 낸다: 북쪽은 벽면 두 줄에 석조 아치(A, 438~440/468~470)를 얹고 그 앞 첫 바닥 줄이 출구, 남쪽은 방 바닥이 맵 아래 끝 테두리 한 줄을 뚫는 폭 4 문 틈. 허공 위로 바닥 띠를 맵 끝까지 끌어내지 않는다(벽 없는 복도로 보인다).
- 물길(~, 3): 신전이 지은 수로라 곧고 돌 테두리가 있다(지하 수로와 같은 문법). 회랑을 가로지르거나 옆 복도를 채우고, 건너는 곳에만 판자 다리(물 위 upper 141)를 강폭만큼 얹는다.
- 가라앉은 바닥(W, 이 시트의 낭떠러지 오토타일 = 바위 턱 있는 물웅덩이): 바닥이 꺼져 물이 찬 곳이라 **가장자리가 불규칙한 덩이**로 판다. 벽면 바로 아래 모서리에 붙이지 않는다(벽 모서리가 톱니로 깨진다). 넓은 석판 바닥은 이것과 넓은 무늬 석판 신랑으로 끊는다.
- 산호는 석주 밑동이 물(웅덩이·물길·해자)에 닿는 곳에만, 큰 산호 1 + 작은 산호 0~1 무리로 방마다 두세 곳. 바닥 한가운데 따로 떨어진 산호·잔돌은 두지 않는다(주인 없는 소품). 지은 방이라 바닥 꾸밈(groves·heaps)도 끈다. 벽면엔 해초(덩굴 177·178)를 두세 곳.
- 제단실: 바위 기슭 물웅덩이(W)로 판 **둥근** 해자가 신전 석판 섬(108)을 두르고 남쪽 판자 다리(%, 물 위 141) 하나로만 건넌다. 섬 가운데 제단은 무늬 석판 109. 곧은 돌 테두리 물길(~)로 네모 해자를 두르지 않고(수영장처럼 보인다), 섬 전체를 바위 단 405~467로 깔지 않는다(둥근 바위가 알 판처럼 반복된다). 섬 위 여신상 둘 사이 마법진, 뒤에 공물 상자. 보스 자리(keeper)는 다리 끝.
- 보상: 대전 서쪽 옆방(다리 건너)의 보물상자, 제단 뒤 공물 상자.

## 검사
${check}
${reach("sunken")}
## 실제 구분
${list("sunken")}
`);

doc("frontier", "rpg-dungeons-frontier-guide", "변경 던전 규칙 · 정문 홀·투기장·늪 신전·해적 소굴·우물 밑 굴", `# 마왕성 정문 홀 · 투기장 경기장 · 늪 신전 · 해적 소굴 · 우물 밑 굴

${COMMON}
## 이 분류만의 규칙
- 출입구는 방에 낸다: 북쪽은 벽면 두 줄(방 사각형의 첫 두 줄)에 석조 아치 A를 얹고 그 아래 첫 바닥 줄이 출구, 남·동·서쪽은 맵 끝 테두리 한 줄을 뚫은 문 틈. 허공 위로 바닥 띠를 맵 끝까지 끌어내지 않는다. 서쪽 문 틈은 벽면 두 줄이 생기므로 네 줄 높이로 판다.
- 방 잇기(좌표만, 이동 이벤트 없음): 마왕성 외관(outdoor-demon-castle) 성문 앞 (30,34) ↔ 정문 홀 남쪽 문 틈 (16,24), 정문 홀 북쪽 아치 앞 (16,5) ↔ 1층 복도(dungeon-demon-hall) 남쪽 문 틈 (17,16). 투기장 서쪽 투사 계단 (3,14) ↔ 투기장 대기실(interior-arena-waiting-room) 동벽 계단 앞 (16,6).
- 마왕성 정문 홀: 적암 바닥 위 무늬 석판 길과 붉은 카펫이 성문에서 아치까지 곧게 가고 석주 세 쌍이 줄을 선다. 양쪽 용암 못은 모양이 서로 다르게, 그 아래 갈색 단(D) 둘 — 소환 마법진+화로 둘, 가고일 둘+뼈 무더기. 성문 안쪽·아치 앞을 가고일이 지킨다.
- 투기장: 모래(82)는 일부러 비운 싸움터라 소품을 두지 않고 네 귀에만 석주. 관중석은 무늬 석판(109) 층 줄 위에 걸상(356)을 한 칸 걸러 놓고, 경기장 앞을 쇠 난간(234~236)이 막는다(우승자 관람석 앞과 남쪽 입장 통로만 트임). 우승자 관람석은 갈색 단 위 왕좌+화로 둘+가고일 둘. 투사 계단은 서쪽 관중석의 내려가는 돌계단(난간 뒤, 3칸 폭 그대로)이고 곁에 물통·나무통.
- 늪 신전: 동굴 재칠 시트(oprn_dungeon_cave). 독늪은 담색 테두리 구덩이 오토타일(pit-pale 246~308)을 바닥이 꺼진 검붉은 진창으로 쓰고(파란 물은 맑은 샘처럼 보여 쓰지 않는다) 가장자리가 불규칙한 덩이로 판다. 늪을 건너는 길은 진창 위에 upper 141 널판(! 칸)만 곧게 얹는다. 신전 석판 바닥 양 모서리까지 진창이 스며들고, 무너진 바깥 석주는 늪가 돌무더기. 늪 섬의 상자·쓰러진 석주, 널판 길 어귀의 경고 표지판과 모험가 뼈는 모두 이유 있는 자리.
- 해적 소굴: 해저 재칠 시트(oprn_dungeon_sea). 동쪽 맵 끝으로 바다 물길이 트이고(물 칸이 맵 밖으로 이어진다), 널판 선착장이 물길로 뻗는다. 배는 물 위 널판으로 선체를 그리고 뱃전 두 줄을 어두운 판자 252·253·254로 둘러 뗏목과 구별한다(가운데 갑판 줄이 이물·고물로 튀어나온다). 짐은 선착장 뿌리 양옆·배 위·굴길 어귀에만, 보물은 막다른 굴 끝에 묶음으로. 야영지·망루 바닥은 널마루(171).
- 우물 밑 굴: 20×16 첫 모험용. 북쪽 벽면에 사다리(297)를 두 줄로 걸고 그 아래 첫 바닥 칸이 입구(= 우물로 오르는 출구), 밑에 널판 디딤과 떨어진 두레박. 물웅덩이는 벽에 붙은 불규칙한 덩이 하나, 쥐 둥지는 막다른 구석에 뼈·잔돌·부서진 통과 잃어버린 상자를 한 무더기로. 색이 다른 바닥 조각(111 등)으로 젖은 바닥을 칠하지 않는다(네모 조각으로 보인다).
- 지은 방은 바닥 꾸밈(groves·heaps)을 끄고, 빈칸 게이트는 지형(카펫·무늬 석판 줄·단·용암·늪·물)으로 맞춘다.

## 검사
${check}
${reach("frontier")}
## 실제 구분
${list("frontier")}
`);

doc("grand", "rpg-dungeons-grand-guide", "큰 던전 규칙 · 네 구역·한 바퀴·지름길·열쇠 자리", `# 큰 던전 「잊힌 수문 유적」 80×64

${COMMON}
## 구역
- A 입구 동굴(흙바닥 421, 남쪽): 앞선 모험가 야영지, 한가운데가 꺼진 큰 구덩이 둘레를 도는 길. 모든 길이 돌아오는 허브.
- B 수문 수로(회록 석재 187, 서쪽): 좁은 둑 사이 곧은 수로, 판자 다리 둘, 북쪽 창살 수문, 서쪽 수문지기 방(레버·식탁·침대).
- C 전실과 보스방(적암 301, 북쪽): 문에서 제단 마법진까지 붉은 카펫, 좌우 용암 틈, 기둥·가고일. 동쪽 창살 문 너머 봉인 보물고.
- D 무너진 대전(마름돌 108, 동쪽): 바닥이 꺼져 섬을 두른 낭떠러지, 가장자리 좁은 둑, 판자 다리 너머 섬에 열쇠 상자.

## 길
- 한 바퀴: A → B → (레버로 여는 내려닫이 창살) → C → D → A.
- 지름길: A 북쪽에서 C 남쪽으로 곧장 가는 바위 길. 중간 창살 바위 문은 처음엔 닫혀 있다(C 쪽에서 여는 것은 이벤트 몫).
- 퍼즐 자리(지형만): B 수문지기 방의 벽 레버(6,32) → B→C 창살(30~33,19). D 섬의 열쇠 상자(66,35) → 보물고 창살 문(58~60,20).
- 구역마다 바닥 재료가 다르고, 재료는 문턱(통로)에서만 달라진다.

## 검사
처음 상태(창살·바위 문 닫힘)에서 입구 → 수로 → 입구 → 대전 → 전실 → 보스방까지 닿는다. 보물고는 열쇠로만 열려 검사 대상이 아니다.
${check}
${reach("grand")}
## 실제 구분
${list("grand")}
`);

for (const p of c.plans) {
  const m = c.maps[p.id], cat = categoryOf(p);
  doc(cat, p.id, p.name + " · 배치와 소품", `# ${p.name}

${p.note}. ${m.width}×${m.height}, tilesetId=${p.tilesetId}. 입구 (${p.entry.join(",")})${p.keeper ? `, 주인·보스 자리 (${p.keeper.join(",")})` : ""}. 통행 검사 목표 ${JSON.stringify(p.targets)}.${p.exits?.length ? `\n\n출구: ${p.exits.map((e) => `(${e.at.join(",")}) → ${e.to}${e.arrive ? ` (${e.arrive.join(",")})` : ""} ${e.note ?? ""}`).join(" · ")}` : ""}${p.sealed ? `\n\n닫힌 곳: ${p.sealed}` : ""}

![${p.name}](image:${p.id})

## 놓은 소품 (저작 순서)
(x,y)는 왼쪽 위, tiles는 행 단위 번호. 이식 칸(480~)은 공통 규칙 문서의 이식표.
${block(p.placements)}
전체 두 레이어는 다음 배열 문서가 정답이다.
`);
  for (let y = 0; y < m.height; y += 16) {
    doc(cat, `${p.id}-rows-${y}`, `${p.name} · ${y}행부터 전체 배열`, `# ${p.name} 전체 배열 y=${y}..${Math.min(y + 15, m.height - 1)}

폭 ${m.width}, x=0..${m.width - 1}, -1은 빈 칸. mapId=${m.id}, tilesetId=${p.tilesetId}, 16px.

## lowerTiles
${rows(m.lowerTiles.slice(y * m.width, Math.min(y + 16, m.height) * m.width), m.width)}
## upperTiles
${rows(m.upperTiles.slice(y * m.width, Math.min(y + 16, m.height) * m.width), m.width)}
`);
  }
}

// Used tiles with their meaning, per category — so a number is never guessed from a picture.
for (const cat of Object.keys(CATEGORY)) {
  const byTileset = {};
  for (const p of plansIn(cat)) for (const n of [...c.maps[p.id].lowerTiles, ...c.maps[p.id].upperTiles]) if (n >= 0) (byTileset[p.tilesetId] ??= new Set()).add(n);
  const entries = Object.entries(byTileset).flatMap(([ts, set]) => [...set].sort((a, b) => a - b).map((tile) => {
    const t = c.tilesets[ts];
    return { tileset: ts, tile, label: t.tileMeta?.[tile]?.label ?? "", passability: t.passability[tile], priority: t.priority[tile], ...(t.tileGrafts?.find((g) => g.targetTile === tile) ? { graft: t.tileGrafts.find((g) => g.targetTile === tile) } : {}) };
  }));
  for (let i = 0; i < entries.length; i += 150) doc(cat, `${CATEGORY[cat].id}-dictionary-${i / 150 + 1}`, `사용 타일 사전 ${i / 150 + 1}`, `# 사용 타일 사전\n\n이 분류의 맵이 쓰는 번호·라벨·통행(타일셋별). graft가 있으면 그 칸은 다른 시트에서 이식한 그림이다.\n` + block(entries.slice(i, i + 150)));
}

fs.mkdirSync(preview, { recursive: true });
const images = Object.fromEntries(Object.keys(CATEGORY).map((k) => [k, []]));
for (const p of c.plans) {
  const n = p.id + ".png", file = preview + "/" + n;
  execFileSync("convert", [dir + "/images/" + n, "-strip", "-filter", "point", "-resize", "820x820>", "-colors", "128", "-define", "png:compression-level=9", file]);
  images[categoryOf(p)].push({ id: p.id, name: n, caption: "실제 타일 완성 지도 · 열람용 축소본", dataUrl: "data:image/png;base64," + fs.readFileSync(file).toString("base64") });
}
const out = Object.keys(CATEGORY).map((k) => ({ ...CATEGORY[k], documents: docs[k], images: images[k] }));
for (const k of out) if (k.documents.length > 64 || k.documents.some((d) => d.markdown.length > 12e4)) throw Error("Reference page limit " + k.id);
fs.writeFileSync(target, JSON.stringify({ easyrpg_chipset_dungeon: out }) + "\n");
console.log(out.map((k) => ({ id: k.id, documents: k.documents.length, images: k.images.length })), fs.statSync(target).size);
