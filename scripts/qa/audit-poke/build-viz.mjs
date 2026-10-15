// 감사 시각화 생성기(읽기 전용 감사의 부산물): qa-runs/audit-poke/rows-all.json + /tmp/ap-img/*.png → ~/claude-viz/audit-poke.html
// 사용: node scripts/qa/audit-poke/build-viz.mjs   (src/ 를 건드리지 않는다)
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const rows = JSON.parse(readFileSync("qa-runs/audit-poke/rows-all.json", "utf8"));
const img = (k) => "data:image/png;base64," + readFileSync(`/tmp/ap-img/${k}.png`).toString("base64");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const GROUPS = { E: "조우", B: "전투", W: "월드", P: "연출", I: "규모·인프라" };
const kind = (p) => (/^측정/.test(p || "") ? "측정" : "추론");
const counts = { WORKS: 0, PARTIAL: 0, MISSING: 0, UNVERIFIED: 0 };
rows.forEach((r) => (counts[r.status] = (counts[r.status] || 0) + 1));
const measured = rows.filter((r) => kind(r.probe) === "측정").length;

// 짧은 한 줄(표에 보이는 것) — 각 행의 gap 첫 문장 + 사람이 쓴 요약 덮어쓰기
const short = {
  E1: "조우가 풀 '타일'이 아니라 '사각형 구역'에 묶임. 출하 캠페인 도로는 길까지 포함한 직사각형 전체에서 조우. 조수 set_encounter_table 은 locationId 를 조용히 버림",
  E2: "종·가중치는 됨. 레벨 범위 필드 없음 — Lv3-5 는 (종×레벨)마다 enemy+troop 을 따로 만들어야 함",
  E3: "시간대/계절/스위치/변수는 됨. 날씨 조건 없음(모르는 키는 에러 없이 무시돼 '조건부'가 '무조건'이 됨)",
  E4: "행위별 조우표 없음. 낚시는 아이템 획득 전용(전투 시작 불가). 서핑 조우 미검증",
  E5: "걸음수 누적 조우율은 됨(평균 10걸음). 스프레이 없음. 몬스터 게임에서 partyEncounterLevel 이 몬스터 레벨을 못 봄(Lv40 선두 → 1)",
  E6: "이로치 개념 없음(개체 플래그·확률·팔레트 스왑). 조건 키를 넣어도 조용히 버려짐",
  E7: "고정 조우·도망 불가·포획 가능은 이벤트로 됨. 잠든 포켓몬 프리셋·맵 간 로밍 없음",
  E8: "사파리 도구·전투 규칙 없음",
  E9: "도망 불가·트레이너 포획 불가·야생 포획 됨. 도망 공식은 3세대식 아님",
  B1: "1세대 15타입(악·강철·페어리 없음). 상성·STAB·이중타입·무효는 측정으로 정확",
  B2: "급소는 1세대식(측정 일치). ±6 능력 단계 없음 — 공격↑ 는 이진 토글(x2), 특수·민첩·명중/회피는 gen1 에서 무반응",
  B3: "독·화상·마비·수면·얼음 5종은 정확. 맹독·혼란·풀죽음 등 휘발성 상태 전무",
  B4: "특성 없음 — 데이터 모델·전투 훅·UI·도구 전부 부재(rg 0건)",
  B5: "지닌 물건 없음 — 슬롯·효과 훅·UI 전부 부재",
  B6: "IV 는 4개(HP·공·방·속, 0~15). 특수 IV·성격·EV·특공/특방 분리 없음",
  B7: "PP·우선도·고정 연타·흡수는 됨. 충전·2턴·반동·강제 교체 기술은 gen1 에서 불가",
  B8: "gen1 에서 적은 항상 1마리(runtime.ts:350) — 2v2 불가. RM식으로 바꾸면 돌지만 gen1 공식 소실",
  B9: "날씨·필드 효과 없음(setWeather 는 unsupported 목록). 맵 날씨는 연출뿐",
  B10: "상성 인지 최선 기술 선택은 됨(12/12). 교체·상처약 사용·확률적 변주 없음",
  B11: "포획은 1세대 공식(측정: 200k MC 일치). 3세대 공식·특수 볼 조건·흔들림 횟수 연동 없음",
  B12: "레벨업·기술 습득은 됨. EXP Share 없음, 경험치 공식은 저작 고정값",
  B13: "레벨/친밀도 진화는 측정으로 동작(감사자 직접). 교환·시간대·돌 사용(가방)·기술조건 없음",
  B14: "몬스터에게 TM/HM 못 가르침(측정: 아이템이 주인공에게 적용됨). 레벨업 습득·잊기 선택(메뉴)은 있음",
  B15: "수동 교체·강제 교체·상처약(기절 대상 거부)은 실제 런타임에서 측정으로 동작",
  B16: "센터 귀환은 됨. 패배 시 소지금 반감 없음, 상금은 저작 고정값",
  W1: "센터 전체 회복(감사자 직접: HP·상태·PP 복구)·상점은 됨. 연출은 텍스트 위주",
  W2: "생성 체육관 = 퍼즐 장치 1~2개 → 관장 직행. 졸개 트레이너 0명 (측정)",
  W3: "시야선 엔진은 있음(출하 플레이어에서 ! → 걸어옴 → 전투 PASS). 그러나 캠페인 생성기·조수 도구가 안 씀: 생성 트레이너 전원 '말 걸어야 대전'",
  W4: "한 방향 턱 점프는 출하 플레이어에서 측정 동작(2칸 착지·되돌아올 수 없음)",
  W5: "몬스터 기술 목록이 읽기 전용, '파티 몬스터가 기술 X 를 안다' 조건 없음, 장애물 도구 없음 — 3개 슬라이스 런 모두 확인",
  W6: "자전거·비행·탈출 로프·텔레포트 템플릿 없음. 부품(transfer·item 조건)은 있음",
  W7: "박스는 몬스터 id 평면 배열 하나(상한 없음, 394마리 단일 목록). 박스 이름·배경·칸 없음",
  W8: "seen/caught 구분 있음(실화면 확인). 완성 보상·키/몸무게·서식지·울음 없음, 설명은 한 줄",
  W9: "NPC 교환만. 알·부화·키우미집·유전 전부 없음",
  W10: "농사(작물) 시스템은 따로 있으나 몬스터 빌더가 쓰지 않음, 열매 효과 훅 없음 (추론)",
  W11: "리그·챔피언·엔딩은 됨(구조 측정). 후일담은 희귀 6종+재대결 선택지뿐",
  W12: "라이벌 3회 구조는 있음. 스타터 상성 대응 없음, 전설 퍼즐/이름 짓기 없음, 대사 템플릿 반복",
  W13: "이름 입력 명령은 있으나 빌더 오프닝이 호출하지 않음. 성별 선택·몬스터 별명 입력 없음",
  W14: "NPC 배회는 됨(측정). 생성 캠페인은 전원 fixed. 맵 이름은 상시 HUD(진입 팝업 아님)",
  P1: "HP 바·앞/뒷모습·기술 메뉴(PP)·상태 아이콘은 높은 재현도(실화면). 경험치 바·기술 타입/PP 패널 없음",
  P2: "기술별 이펙트는 animationId 저작 필요(기본 기술은 몸통 모션뿐). 종별 울음 없음. 소리는 측정 불가",
  P3: "포획 구슬 투척·문장은 있음. 흔들림 횟수 결과 연동·'아깝다!' 단계 문장 없음. 트레이너 슬라이드는 원작 시트 NPC 에서만",
  P4: "상시 HUD 위젯. 진입 시 잠깐 뜨는 원작식 팝업 아님",
  P5: "ESC 메뉴 8항목(도감·동료·가방·수첩·지도·배지·저장·설정) 실화면 확인",
  P6: "'!' 이모트·걷기 모션은 출하 플레이어에서 동작. 생성 캠페인은 안 씀(showEmote 0)",
  I1: "도구 속도는 문제 없음(156종 15초/호출). 병목은 그림: 신규 종은 일반 적 그림 재활용(뒷모습 0), 타입 15종 한계로 8계통 실패",
  I2: "조우 일괄 배치(spawn)는 됨. 레벨 범위 없음, 트레이너 파티 일괄 도구 없음",
  I3: "자동 플레이는 상성·교체·상처약·포획을 씀. 상태이상 걸기·볼 선택·TM·진화 능동 진행은 모름",
  I4: "플레이어·전투 문장이 한국어 고정. 레코드에 로케일 값 없음",
  I5: "두 번째 지역·후일담 지역 도구 없음(9번째 배지 등록은 맵·스위치 선행 요구로 거부)",
};

const statusKo = { WORKS: "동작", PARTIAL: "부분", MISSING: "없음", UNVERIFIED: "미검증" };

const matrixRows = rows
  .map((r) => {
    const g = GROUPS[r.id[0]];
    const ev = (r.evidence || []).map((e) => `<li>${esc(e)}</li>`).join("");
    return `<tr class="row ${r.status}" data-s="${r.status}" data-g="${r.id[0]}">
<td class="id">${r.id}</td><td class="grp">${g}</td><td class="req">${esc(r.req)}</td>
<td><span class="badge ${r.status}">${statusKo[r.status]}</span><br><span class="kind ${kind(r.probe)}">${kind(r.probe)}</span></td>
<td class="short">${esc(short[r.id] || r.gap)}</td><td class="eff e${r.effort || "-"}">${r.status === "WORKS" ? "—" : esc(r.effort || "-")}</td>
<td class="more"><details><summary>근거</summary><div class="d"><b>실행/측정</b><p>${esc(r.probe)}</p><b>부족한 점</b><p>${esc(r.gap)}</p>${ev ? `<b>증거 (file:line)</b><ul>${ev}</ul>` : ""}<b>고칠 곳</b><p>${esc(r.where || "—")}</p></div></details></td></tr>`;
  })
  .join("\n");

// ── 블로커 순위 ─────────────────────────────────────────────
const blockers = [
  ["1", "몬스터 필드 기술(비전머신) 게이트 전체가 없다", "M", "W5·B14", "포켓몬다움의 척추다. 몬스터 기술 목록은 읽기 전용(playerMonsterPartyDetail.ts:9-22 onActivate=readOnly), 이벤트 조건에 '파티 몬스터가 기술 X 를 안다'가 없고(commandKindRegistry.ts:113-136), 몬스터에게 TM/HM 을 가르치는 경로가 없고(아이템이 주인공에게 적용됨, 측정), 장애물(나무·바위·물) 도구가 없다. 슬라이스 3런 모두 이 벽에 막혔다 — 가장 가까운 대용품은 '종 보유' 조건이거나 스위치 직접 켜기.", "playerMonsterPartyDetail.ts:9-22 → PlayScene.useFieldAbility 연결 / conditionActorQueries 에 partyKnowsSkill / playerItemUse.ts:52-100 몬스터 대상 분기 / monsterGameTools 에 place_field_obstacle"],
  ["2", "3세대의 전투 심도(특성·지닌 물건·성격·EV)가 모델에 없다", "L", "B4·B5·B6", "에디터의 전투는 1세대(Red/Blue) 공식이다 — 능력 구분 하나(mind), IV 4개(0~15), 특성·지닌 물건·성격·EV 필드는 소스 0건(rg). 이것이 '에메랄드급'이라는 요구와 가장 크게 어긋난다. 특성 L, 지닌 물건 M, 성격·EV·특수 분리 M.", "session.ts:115 MonsterInstance / database.ts:653 MonsterSpeciesRecord / runtime.ts 훅 최소 5곳 / monsterCollection.ts:692-711 능력치 공식"],
  ["3", "능력 단계(±6)와 휘발성 상태(혼란·맹독·풀죽음)가 없다", "M", "B2·B3", "공격↑ 3번 시전해도 상태 하나(x2 이진). 특수·민첩·명중/회피 변화는 gen1 경로에서 무반응(측정). 휘발성 상태는 자료집에서 만들어도 gen1 에서 실행되지 않는다(측정). 포켓몬의 전략 깊이 대부분이 여기에 있다.", "runtime.ts:782-798 gen1ModifiedStat 단계표 / status.ts volatile 모델 / runtime.ts:737-780 prepareGen1CombatAction"],
  ["4", "더블 배틀·날씨 불가", "L / M", "B8·B9", "gen1 에서 적은 항상 1마리(runtime.ts:350 singleFileEnemies, 측정: 2v1). 날씨·필드 상태는 모델 자체가 없다(setWeather 는 unsupported 목록).", "runtime.ts:350·3996-4040 N슬롯화 / battleEvents.ts:953 / 전장 field 상태 신설"],
  ["5", "조우 데이터 모델이 포켓몬식이 아니다", "S", "E1·E2·E5·I2", "조우표 항목은 troopId 가중치뿐 — 레벨 범위 없음(측정: 1번길은 단일 종·단일 레벨 4개). 풀 '타일'이 아닌 사각 구역 기준. 조수용 set_encounter_table 스키마가 locationId 를 선언하지 않아 넣어도 조용히 버려지고 맵 전체 조우가 된다(측정). 몬스터 게임에서 partyEncounterLevel 은 몬스터 레벨을 못 봄.", "EncounterTableEntry(project.ts:384)에 level 범위 / encounters.ts:15 partyEncounterLevel / 조수 스키마 schemaShapes / terrainStep.ts"],
  ["6", "시야선 트레이너·체육관 졸개를 캠페인과 조수가 쓰지 않는다", "S", "W2·W3·P6", "엔진은 완비(출하 플레이어에서 ! → 걸어옴 → 전투 PASS, 감사자 측정). 그런데 world.ts 의 트레이너는 전부 action 트리거, 체육관은 관장 1명+퍼즐 직행(졸개 0). 조수 도구·프롬프트에 detectionEncounter 어휘가 없어 슬라이스 3런 중 시야 트레이너를 만든 쪽은 place_field_enemy(chase) 로 우회했다.", "world.ts:498 detectionEncounter / world.ts:664-720 체육관 졸개 / schemaShapes.ts:383 + place_trainer 도구"],
  ["7", "타입 15개 — 악·강철(·페어리) 없음", "S", "B1·I1", "기본 차트가 1세대 15타입(ghost→psychic=0 같은 1세대 버그값 포함)이고 상태이상 면역 표가 15타입으로 하드코딩. define_monster_families 는 dark/steel/fairy 를 알 수 없는 타입으로 거부(40계통 중 8계통 실패, 측정).", "defaultDatabase.ts 차트 / typeChart.ts:12-30 / status.ts:55-67 / monsterBatchTools.ts"],
  ["8", "신규 종 그림 공급 경로가 없다", "L", "I1", "새 종은 일반 적 그림을 재활용하고 뒷모습은 0장(자동 배정). 전용 앞·뒤·아이콘 도트는 오프라인 사람-선택 하네스뿐이라 '150종 도감'은 이름만 150개가 된다.", "src/harnesses/monster-collect-species → 편집기 도구화"],
  ["9", "검증기가 게이트 우회를 못 잡고, 필드 기술 게이트를 만들면 거꾸로 막힌다", "M", "슬라이스", "R1: 바위 게이트를 한 칸짜리 이벤트로 놓고 복도가 3칸이라 우회되는데도 check 막힘 0·엔딩 도달. R3: 바위로 길을 진짜 막으면 autoplay-failed(검사기가 필드 기술로 바위를 못 부숨). run_scene_test 에 필드 스킬/메뉴 스텝이 없고, 절벽 점프도 R1 씬 테스트는 1칸(5,4)에서 멈추고 출하 플레이어는 2칸(5,5) 착지(측정) — 두 경로가 다르다.", "qa/gameCheck/autoPlay.ts / testing/sceneTestRunner.ts / 씬 스텝 kind 추가"],
  ["10", "포획·경험치·블랙아웃의 3세대 규칙", "S", "B11·B12·B16·P3", "포획 공식 1세대(흔들림 횟수 UI 미연동, '아깝다!' 없음), EXP Share 없음·경험치는 저작 고정값, 패배 시 소지금 반감 없음·상금 고정값.", "gen1/capture.ts / battleRewardsToSession.ts:99-111 / defeatRecovery.ts:9-28"],
  ["11", "PC 박스·알·키우미집·열매", "M", "W7·W9·W10", "박스는 평면 배열(상한 없음, 이름·배경·칸 없음). 알·부화·열매는 부재.", "session.ts:279 monsterBox→boxes[] / monsterCare.ts 걸음 틱 재사용"],
  ["12", "생성기 규모가 고정이고 두 번째 지역 도구가 없다", "M–L", "I5·슬라이스", "build_monster_game gymCount:1 을 줘도 19맵·60종·리그·전설·도감 정원·조련사 학교가 나온다(R1). firstRouteTrainers 는 최대 3명이라 2를 줘도 3명(R1). 두 번째 지역·후일담 지역을 짓는 도구가 없다.", "monsterGameTools.ts / worldPlan.ts / 새 build_monster_region"],
  ["13", "자유 경로 마찰(조수가 쓰는 낱개 도구 조합)", "S–M", "슬라이스 R2", "R2(캠페인 빌더 금지)는 35분·약 80호출·실패 약 11회에 맵 4장, 바위가 길을 막지 않고 엔딩·포획 도구도 없는 상태. define_monster_families 가 속성 레코드 부재로 65건 거부 → 우회 8회 시도. 도구 오류 문구가 우회로를 안내하지 않는다.", "monsterBatchTools.ts / upsert_database_utility 오류문"],
  ["14", "다국어", "L", "I4", "플레이어·전투 문장이 한국어 고정, 레코드에 로케일 값 없음.", "src/i18n → src/player / 레코드 name 로케일 맵"],
];
const blockerRows = blockers
  .map(([n, t, e, ids, d, where]) => `<tr><td class="n">${n}</td><td><b>${esc(t)}</b><div class="d">${esc(d)}</div><div class="where">고칠 곳: ${esc(where)}</div></td><td class="ids">${esc(ids)}</td><td class="eff e${e[0]}">${esc(e)}</td></tr>`)
  .join("\n");

// ── 슬라이스 ─────────────────────────────────────────────────
const runs = [
  { n: "R1", t: "「포켓몬 같은 게임」 원문(캠페인 빌더 허용)", calls: "27호출 / 도구 오류 0", time: "약 19분", chk: "막힘 0 · 경고 0 · 엔딩 도달 (바위 게이트는 우회되는데도)", scores: [5, 6, 5, 7], adj: "플레이 가능성 7 → 감사자 조정 5 (게이트 우회·시야 전투 없음)" },
  { n: "R2", t: "자유 경로(일괄 빌더 3종 금지)", calls: "약 80호출 / 실패 약 11", time: "약 35분", chk: "막힘 1(엔딩 없음) · 경고 3 (포획 도구 습득 불가)", scores: [4, 5, 3, 3], adj: "" },
  { n: "R3", t: "R1 캠페인 위 후속 편집(바위 HM·시야선·절벽)", calls: "62줄 / ok=false 12", time: "약 37분", chk: "막힘 1 (autoplay-failed: 바위를 못 부숨) · 경고 3", scores: [4, 7, 3, 4], adj: "" },
];
const avg = (i) => (runs.reduce((s, r) => s + r.scores[i], 0) / runs.length).toFixed(1);

const sliceItems = [
  ["시작 마을", "충족", "충족", "—"],
  ["풀숲 야생 조우", "충족(사각 서식지)", "부분(증명 못 함)", "—"],
  ["길목 트레이너 2명", "충족(firstRouteTrainers=2 요청)", "부분(시야 1·조사형 1)", "부분(3명 모두 chase)"],
  ["트레이너 시야 접근", "미충족", "부분(1명 확인)", "부분(1명 확인·재전투 없음)"],
  ["절벽 한 방향 점프", "충족(기존 칸)", "부분(점프 미증명)", "충족"],
  ["동굴", "부분(별도 맵, 그림체 섞임)", "부분(65×48, 호수 있음)", "—"],
  ["바위깨기로 길 열림", "미충족(우회 가능)", "미충족(길을 막지 못함)", "부분(스위치 직접 켤 때만)"],
  ["파티 몬스터 기술 조건", "미충족", "미충족(종 보유로 대용)", "미충족(도구 없음)"],
  ["비전머신으로 몬스터가 습득/잊기 불가", "—", "—", "미충족/미충족"],
  ["체육관 퍼즐", "충족(장치 2개)", "부분(문 미검증, 신전 맵)", "—"],
  ["관장 + 배지", "충족", "부분(전투 미실행)", "—"],
  ["배지 없이 다음 길 불가", "충족(씬 테스트)", "부분(다음 길 맵 없음)", "—"],
];
const cls = (s) => (s.startsWith("충족") ? "ok" : s.startsWith("부분") ? "mid" : s.startsWith("미충족") ? "bad" : "na");

const gallery = (items) =>
  items.map(([k, cap]) => `<figure><img src="${img(k)}" alt="${esc(cap)}"><figcaption>${esc(cap)}</figcaption></figure>`).join("");

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>포켓몬 라이크 적대적 감사</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#0f1318;--panel:#171d25;--line:#2a3340;--tx:#dfe6ee;--mu:#93a1b3;--ok:#2e9d5b;--mid:#d39b1e;--bad:#d1453b;--na:#6c7889}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.55 -apple-system,"Noto Sans KR",sans-serif}
.wrap{max-width:1280px;margin:0 auto;padding:28px 22px 80px}h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:42px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
.sub{color:var(--mu);font-size:12.5px}.verdict{background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--bad);padding:14px 18px;margin:18px 0;border-radius:6px}
.verdict b.big{font-size:17px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:14px 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 12px}.card .n{font-size:26px;font-weight:700}.card .l{color:var(--mu);font-size:12px}
.bar{display:flex;height:22px;border-radius:4px;overflow:hidden;margin:8px 0 2px}.bar i{display:block}
.badge{white-space:nowrap;display:inline-block;padding:1px 8px;border-radius:10px;font-size:11.5px;font-weight:700;color:#0c1014}.badge.WORKS{background:var(--ok)}.badge.PARTIAL{background:var(--mid)}.badge.MISSING{background:var(--bad)}.badge.UNVERIFIED{background:var(--na)}
.kind{font-size:10.5px;color:var(--mu)}.kind.추론{color:#e4a05a}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid var(--line);padding:7px 8px;vertical-align:top;text-align:left}th{position:sticky;top:0;background:#1d2631;z-index:2;font-size:12px}
tr.WORKS td.id{box-shadow:inset 4px 0 var(--ok)}tr.PARTIAL td.id{box-shadow:inset 4px 0 var(--mid)}tr.MISSING td.id{box-shadow:inset 4px 0 var(--bad)}
td.id{font-weight:700;white-space:nowrap}td.grp{color:var(--mu);white-space:nowrap}td.req{min-width:190px}td.short{min-width:330px}.eff{font-weight:700;text-align:center}.eS{color:#6fd39b}.eM{color:#e9b84a}.eL{color:#ee7b70}
details summary{cursor:pointer;color:#7fb4ff;font-size:12px}.d{margin-top:6px;font-size:12px;color:#c4cfdb;max-width:560px}.d b{color:#fff}.d p{margin:2px 0 8px}.d ul{margin:2px 0 8px 16px;padding:0}
.filters{margin:10px 0;display:flex;gap:6px;flex-wrap:wrap}.filters button{background:var(--panel);color:var(--tx);border:1px solid var(--line);border-radius:14px;padding:3px 12px;cursor:pointer;font-size:12.5px}.filters button.on{background:#2b4a7a;border-color:#4b78b8}
.gal{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}figure{margin:0;background:var(--panel);border:1px solid var(--line);padding:8px;border-radius:6px}figure img{display:block;image-rendering:pixelated;max-width:100%;height:auto}figcaption{font-size:11.5px;color:var(--mu);margin-top:5px;max-width:520px}
.slice td.ok{background:#16301f}.slice td.mid{background:#33290f}.slice td.bad{background:#391a18}.slice td.na{color:var(--mu)}
.n{font-weight:700;font-size:16px;text-align:center;width:34px}.ids{white-space:nowrap;color:var(--mu);font-size:12px}.where{margin-top:4px;color:#7fb4ff;font-size:11.5px}
.note{background:#1a2230;border:1px solid var(--line);padding:10px 14px;border-radius:6px;margin:10px 0;font-size:13px}.note li{margin:3px 0}
.score{display:grid;grid-template-columns:150px 1fr 40px;gap:8px;align-items:center;margin:5px 0}.score .t{height:14px;background:#222c39;border-radius:7px;overflow:hidden}.score .t i{display:block;height:100%}
code{background:#222c39;padding:1px 5px;border-radius:3px;font-size:12px}
</style></head><body><div class="wrap">
<h1>포켓몬 라이크(3세대 에메랄드/파이어레드급) 적대적 감사</h1>
<div class="sub">2026-10-15 · origin/main 92dcb3d02(#2570 자유경로 라우팅 · #2573 규모 인자 · #2581 체육관 공백 수정 포함) · 코드 수정·PR 없음 · vitest/gates/typecheck 실행 안 함 · 조수 대용: Claude Sonnet 5.5 high 역할극(Argon 사용 불가, 실제 입력창·Pi 경로 아님)</div>

<div class="verdict"><b class="big">판정: 1세대(Red/Blue) 규칙의 60종·20맵 안팎 고정 캠페인 “데모”는 만들어진다. 3세대급 포켓몬 라이크는 지금 에디터로 못 만든다.</b><br>
요건 50개 중 <b>동작 ${counts.WORKS}</b> · <b>부분 ${counts.PARTIAL}</b> · <b>없음 ${counts.MISSING}</b> (근거 종류: 직접 실행·측정 ${measured}건, 코드 읽기 추론 ${rows.length - measured}건). 동작 6건(타입 상성·전투 중 교체·센터/상점·절벽 점프·ESC 메뉴·!이모트)은 전부 1세대 수준의 기초이고, 에메랄드를 에메랄드답게 하는 것(특성·지닌 물건·성격/EV·더블·날씨·능력 단계·휘발성 상태·비전머신 필드 기술·시야선 트레이너·체육관 졸개)은 <b>없거나 쓰이지 않는다</b>. 슬라이스 3런의 요청 충족도 평균은 ${avg(0)}/10.</div>

<div class="cards">
<div class="card"><div class="n" style="color:var(--ok)">${counts.WORKS}</div><div class="l">동작 (출하 플레이어/실제 런타임에서 확인)</div></div>
<div class="card"><div class="n" style="color:var(--mid)">${counts.PARTIAL}</div><div class="l">부분 (스키마만·일부만·캠페인이 안 씀)</div></div>
<div class="card"><div class="n" style="color:var(--bad)">${counts.MISSING}</div><div class="l">없음 (코드 부재 증명 + 시도 거부/무시)</div></div>
<div class="card"><div class="n">${measured}/${rows.length}</div><div class="l">직접 실행으로 측정한 행(나머지는 코드 읽기 추론)</div></div>
</div>
<div class="bar"><i style="width:${(counts.WORKS / rows.length) * 100}%;background:var(--ok)"></i><i style="width:${(counts.PARTIAL / rows.length) * 100}%;background:var(--mid)"></i><i style="width:${(counts.MISSING / rows.length) * 100}%;background:var(--bad)"></i></div>

<h2>0. 정직한 점수 (0–10, 3세대급 포켓몬 라이크 기준)</h2>
${[
  ["조우", 3.5, "표 기반 가중·시간/계절 조건은 됨. 레벨 범위·풀 타일·이로치·낚시·사파리·날씨 조건이 없음"],
  ["전투 규칙", 4, "1세대 규칙은 충실(상성·STAB·급소·상태 5종·PP·우선도·포획·교체 측정 일치). 3세대 심도(특성·물건·성격·EV·단계·휘발성·더블·날씨)는 없음"],
  ["월드·진행", 4.5, "센터·상점·절벽 점프·배지 게이트·리그 엔딩은 됨. HM 필드 기술·체육관 졸개·시야선·박스·알이 비어 있음"],
  ["연출", 6, "전투 화면(HP 박스·앞뒤 도트·기술 메뉴)·도감 화면은 포켓몬 문법. 경험치 바·울음·흔들림 연동 없음"],
  ["규모·인프라", 4.5, "종·조우 일괄 도구와 한 번에 20맵 캠페인은 빠름(12초). 신규 종 그림·18타입·두 번째 지역·다국어가 막힘"],
  ["슬라이스(조수 대용)", Number(((avg(0) * 1 + avg(1) * 1 + avg(2) * 1 + 5) / 4).toFixed(1)), "R1~R3 네 항목 평균(충족도 " + avg(0) + " · 시각 " + avg(1) + " · 메카닉 " + avg(2) + " · 플레이 " + avg(3) + ", R1 플레이 7→5 조정 반영)"],
]
  .map(([k, v, why]) => `<div class="score"><div><b>${k}</b></div><div class="t"><i style="width:${v * 10}%;background:${v >= 6 ? "var(--ok)" : v >= 4 ? "var(--mid)" : "var(--bad)"}"></i></div><div><b>${v}</b></div></div><div class="sub" style="margin:-2px 0 8px 158px">${esc(why)}</div>`)
  .join("")}
<div class="note"><b>요약 점수:</b> 같은 캠페인을 <u>1세대 포켓몬 데모</u>로 보면 5~7/10(R1: check 막힘 0·엔딩 도달·저장 재로드 일치, 단 바위 게이트 우회 가능·시야 전투 없음), <u>에메랄드급</u>으로 보면 <b>3.5–4/10</b>. 이 둘을 섞어 한 숫자로 말하지 않는다.</div>

<h2>1. 요건 매트릭스 (50항)</h2>
<div class="sub">상태 색은 줄 왼쪽 띠와 배지. “측정”=헤드리스 프로브·출하 플레이어·씬 테스트로 직접 돌려 얻은 값, “추론”=코드를 읽고 부재를 증명한 값(시도 거부는 근거 칸에). 노력: S=하루 이내 · M=며칠~1주 · L=2주+ (감사자 추정, 측정 아님). <b>근거</b>를 펼치면 file:line·프로브·고칠 곳이 나온다.</div>
<div class="filters" id="f">
<button data-k="all" class="on">전체 50</button><button data-k="s:WORKS">동작 ${counts.WORKS}</button><button data-k="s:PARTIAL">부분 ${counts.PARTIAL}</button><button data-k="s:MISSING">없음 ${counts.MISSING}</button>
${Object.entries(GROUPS).map(([k, v]) => `<button data-k="g:${k}">${v}</button>`).join("")}</div>
<table id="m"><thead><tr><th>ID</th><th>분류</th><th>요건</th><th>상태</th><th>한 줄 판정</th><th>노력</th><th></th></tr></thead><tbody>
${matrixRows}
</tbody></table>

<h2>2. 슬라이스: 시작 마을 → 1번 도로(풀숲·트레이너 2·절벽) → 동굴(바위깨기) → 체육관 1(퍼즐·관장·배지 게이트)</h2>
<div class="note"><b>조수 대용: Claude Sonnet 5.5 high 역할극</b> — 서브에이전트가 <code>scripts/oprn-tools.mjs</code>(405개 도구, 실제 실행기·SQLite 정본 재로드 경로)로 도구만 호출했다. 실제 입력창·Pi 경로·Argon 이 아니다. 3런이 한 머신에서 동시에 돌았고(부하 20~30) 15분 한도를 모두 넘겼다(실측 19·35·37분). 점수는 각 런의 자기평가이며 감사자가 맵을 직접 열어 대조했다.</div>
<table class="slice"><thead><tr><th>런</th><th>요청</th><th>호출</th><th>시간</th><th>qa:game check</th><th>충족/시각/메카닉/플레이</th></tr></thead><tbody>
${runs.map((r) => `<tr><td><b>${r.n}</b></td><td>${esc(r.t)}</td><td>${esc(r.calls)}</td><td>${esc(r.time)}</td><td>${esc(r.chk)}</td><td><b>${r.scores.join(" / ")}</b>${r.adj ? `<div class="sub">${esc(r.adj)}</div>` : ""}</td></tr>`).join("")}
<tr><td colspan="5"><b>평균</b></td><td><b>${avg(0)} / ${avg(1)} / ${avg(2)} / ${avg(3)}</b></td></tr></tbody></table>
<div class="sub">저장·재로드: 세 런 모두 <code>oprn-store init → import-json → export-json</code> 로 SQLite 폴더에 저장해 다시 읽었고 맵 수·맵별 이벤트 수·database 레코드 수가 같았다(R1 20=20, R2 5=5/레코드 2953=2953, R3 19=19). 프로젝트 id·revision 은 이 CLI 의 export 에 필드가 없어 비교하지 못했다(감사자 초기 시험 s1db 의 project.sqlite sha256 은 07beb792…, 재로드 동치는 맵·이벤트·레코드 수 비교).</div>

<h3 style="margin-top:22px">요청 항목별 판정</h3>
<table class="slice"><thead><tr><th>항목</th><th>R1 (빌더 허용)</th><th>R2 (자유 경로)</th><th>R3 (후속 편집)</th></tr></thead><tbody>
${sliceItems.map(([a, b, c, d]) => `<tr><td>${esc(a)}</td><td class="${cls(b)}">${esc(b)}</td><td class="${cls(c)}">${esc(c)}</td><td class="${cls(d)}">${esc(d)}</td></tr>`).join("")}
</tbody></table>

<h3 style="margin-top:22px">만들어진 맵 — 원해상도(확대 없음)</h3>
<div class="sub">감사자가 렌더 PNG 를 원 크기로 열어 확인한 소견: R1 1번 도로는 에메랄드 문법(풀숲·턱 줄·계단/바위 구역)이 좋다. R1 동굴은 버들항 칩셋이라 monster_* 맵과 그림체가 갈리고 장식이 흩어져 있다. R1 체육관은 작고(17×20) 퍼즐이 장치 클릭 한 번이며 관장 말고 사람이 없다. R1 관측탑은 “동굴”이 아니라 사막 유적풍이고 성기다. R2 도로는 양옆을 나무 벽으로 채운 단조로운 길에 풀숲이 사각 판처럼 보이고 트레이너 그림이 보이지 않는다. R2 동굴은 호수·광물이 좋지만 “짧게”에 비해 너무 크다. R2 체육관은 53×55 폐허 신전이라 체육관 같지 않고 퍼즐 석판이 문양과 맞지 않는다. R3 도로는 바위 2개가 길을 막는 것이 잘 보인다.</div>
<div class="gal">${gallery([
  ["r1_meadow", "R1 · 1번 도로 384×512 — 풀숲 서식지, 턱 줄(갈색), 계단"],
  ["r1_cave", "R1 · 추가한 동굴 576×640 (beodeul_city) — 불규칙 방 3개, 그림체가 기존 맵과 다름"],
  ["r1_gym", "R1 · 체육관 272×320 — 퍼즐은 장치 상호작용, 관장 외 트레이너 0"],
  ["r1_obs", "R1 · 관측탑 352×256 — ‘동굴’ 요청에 사막 유적풍"],
  ["r3_meadow", "R3 · 1번 도로 — 위쪽 바위 2개(분홍 상자=이벤트) + 새로 칠한 턱 줄로 길을 막음"],
  ["r2_village", "R2 · 시작 마을 640×480 (author_beodeul_town)"],
  ["r2_route", "R2 · 1번 도로 384×640 — 풀숲이 사각 판, 양옆 나무 벽"],
  ["r2_cave", "R2 · 동굴 1040×768 — 바위 ‘이벤트’ 3개(분홍 상자)는 그림이 없어 길을 막지 못함"],
  ["r2_gym", "R2 · 체육관 848×880 — 십자형 폐허 신전, 너무 큼"],
])}</div>

<h2>3. 막힌 곳 순위 (영향 × 비용)</h2>
<div class="sub">순위는 감사자 판단. 노력은 추정(측정 아님). “고칠 곳”은 읽은 코드 위치다.</div>
<table><thead><tr><th>#</th><th>블로커</th><th>요건</th><th>노력</th></tr></thead><tbody>${blockerRows}</tbody></table>

<h2>4. 그럴듯한 포켓몬급 데모까지의 최소 경로</h2>
<div class="note"><ol>
<li><b>1주차 (S 위주, 합계 추정 약 1주)</b> — 캠페인·도구 기본값을 포켓몬 문법으로: ① 트레이너에 시야선(detectionEncounter)·체육관 졸개 3~4명 ② 조우표 레벨 범위 + 풀 타일 기반 조우 + 조수 스키마 locationId 선언 ③ 타입 18개(악·강철) ④ 포획 흔들림 연동·경험치 바·EXP Share ⑤ 블랙아웃 소지금 반감·상금 공식.</li>
<li><b>2~3주차 (M)</b> — <b>HM 필드 기술 세트</b>: 몬스터 기술 필드 사용, 'partyKnowsSkill' 조건, 장애물 도구(나무·바위·물·어둠), 몬스터용 TM/HM(잊기 불가 포함), 검사기·씬 테스트가 이 게이트를 이해하게. 이어서 능력 단계 ±6, 혼란·맹독·풀죽음, 지닌 물건 1차(열매 회복·능력 배율).</li>
<li><b>여기까지가 “그럴듯한 3세대풍 단일 지방 데모”</b>(감사자 추정 2~3주, 측정 아님). 특성(L)·성격/EV·특수 분리(M)·날씨(M)·더블 배틀(L)·PC 박스(M)·알/키우미(M)·종 그림 도구(L)·다국어(L)는 “에메랄드 동등”에 필요하고 추가로 수 주~수 개월.</li>
</ol></div>

<h2>5. 부수려고 했으나 부서지지 않은 것 (측정)</h2>
<div class="note"><ul>
<li><b>타입 상성·STAB·이중타입·무효</b> — 레벨 50 동일 스탯 전기 기술: 일반 5 → STAB 7 → 약점 10 → 이중 약점 20 → 반감 2 → 땅 무효 0. 카트리지식 floor 가 정확. 단 기본 차트가 15타입(위 7번).</li>
<li><b>급소·마비·수면</b> — 급소 1500회 몬테카를로가 1세대 공식과 일치(속도50 normal 9.7%/high 78.1%), 마비 행동 불가 24.5%(카트리지 24.6%), 수면 1~7턴 정확, 독·화상 최대 HP 1/16.</li>
<li><b>PP·우선도·교체</b> — PP 소진 → Struggle(반동 1/2), movePriority 선후공 정렬, 수동 교체가 턴을 소모, 쓰러지면 강제 교체, 상처약은 기절 대상 거부.</li>
<li><b>포획 확률</b> — 이산 확률표가 200k 몬테카를로와 해석값 일치(cr45 몬스터볼 풀HP 6.0%·반피 12.5%·1HP 18.0%, 마스터볼 100%, 트레이너전 0%). 공식 자체가 1세대일 뿐 틀리지 않았다.</li>
<li><b>절벽 점프</b> — 출하 플레이어에서 아래 한 번 입력 → 턱을 넘어 2칸 착지, 위 입력은 되돌아올 수 없음, 옆에서 진입하면 이동 안 함.</li>
<li><b>레벨업 진화·센터 회복</b> (감사자 직접) — 스프리글렛 Lv14 → Lv15 → Lv16 에서 프론드헤어로 진화, 센터 recoverAll 이 HP 1→50/50·독 해제·PP 만충.</li>
<li><b>시야선 트레이너 엔진</b> — 출하 플레이어에서 시야 밖은 무발동, 시야 안 → 입력 잠금 → ‘!’ → 걸어옴 → 인접 정지 → 전투 → 승리까지 PASS(엔진은 있다, 캠페인이 안 씀).</li>
<li><b>조우율 분포</b> — 20,000회 시뮬: rate14 평균 10.2걸음/조우(p10=4, p90=17). 흙길 1,000걸음 조우 0회 vs 풀숲 1,200걸음 139회(author_wild_route 경로).</li>
<li><b>고정 캠페인(canned)</b> — <code>build_monster_game gymCount:1</code> 12초에 19맵·60종, check 막힘 0·엔딩 도달, SQLite 재로드 sha 일치(감사자 직접).</li>
<li><b>전투·도감·메뉴 화면</b> — 아래 실화면 3장: 에메랄드 전투 문법(상대 HP 박스·내 HP/PP·앞뒤 도트·4분할 메뉴), PP 표기, 발견 2/60·포획 2 도감.</li>
</ul></div>
<div class="gal">${gallery([
  ["b_wild", "출하 플레이어 · 야생 전투 명령 화면 (960×720) — 뒷모습, HP 박스, 싸운다/가방/몬스터/도망"],
  ["b_moves", "출하 플레이어 · 기술 메뉴 — 횟수(PP) 30/30. 경험치 바는 없음"],
  ["b_dex", "출하 플레이어 · 도감 — 발견 2/60 · 포획 2, ??? 미발견 항목, 설명문"],
])}</div>

<h2>6. 한계·정직한 단서</h2>
<div class="note"><ul>
<li><b>감사 방식</b>: 요건 50항을 5명의 서브에이전트(Sonnet)가 나눠 조사·측정했고 감사자가 핵심 주장을 직접 대조했다 — W5(몬스터 기술 목록 읽기 전용: playerMonsterPartyDetail.ts:14-18 읽어 확인), 레벨업 진화·센터 회복(직접 프로브), R1 도구 호출 결과·맵 렌더(직접 열어 확인). B2·B3 수치 등 나머지 서브에이전트 측정은 재측정하지 않았다.</li>
<li><b>실행하지 않은 것</b>: vitest · npm run gates · typecheck(규칙). <code>qa:runtime</code> 정식 시나리오 스위트는 돌리지 않음(출하 플레이어 확인은 A4·A5 가 만든 개별 Playwright 프로브). I3 는 코드 읽기+부분 측정(R1~R3 의 qa:game check 자동 플레이 결과는 2절).</li>
<li><b>미검증으로 남은 것</b>: 서핑 조우(E4), 소리·울음(P2), 트레이너 슬라이드 그림(P3), 몬스터 기술의 필드 능력 실행(R3 — 씬 테스트에 스텝이 없어 도구 경로로 못 돌림, 코드 상 읽기 전용이라 MISSING 판정), W3 하네스의 마지막 단언(전투 후 필드 복귀)은 두 케이스 모두 30초 타임아웃으로 실패(엔진 단계까지만 PASS).</li>
<li><b>측정 간 불일치</b>: 절벽 점프는 출하 플레이어(A4)에서 2칸 착지, R1 씬 테스트에서는 1칸 이동 후 멈춤. 헤드리스 경로와 플레이어 경로가 다르다는 신호이며 원인은 조사하지 않았다.</li>
<li><b>역할극 조건</b>: 모델 폴백·Argon 수치와 비교하지 않았다. 조수 실경로(도구 게이팅·시간 제한·프롬프트)는 시험하지 않았다. 3런이 병렬이라 시간은 부하의 영향을 받았다.</li>
<li><b>보조 스크립트</b>: <code>scripts/qa/audit-poke/</code> (프로브 *.mts/*.mjs 등 약 39개 + <code>build-viz.mjs</code>). src/ 수정 없음, 미커밋. 산출물은 gitignored <code>qa-runs/audit-poke/</code>(요건표 reqs.md, 행 JSON rows-*.json, 슬라이스 slice-1~3, 감사 시험 프로젝트).</li>
</ul></div>
</div>
<script>
const btns=[...document.querySelectorAll('#f button')];
btns.forEach(b=>b.onclick=()=>{btns.forEach(x=>x.classList.remove('on'));b.classList.add('on');const [t,v]=b.dataset.k.split(':');
document.querySelectorAll('#m tbody tr').forEach(r=>{r.style.display=(b.dataset.k==='all'||(t==='s'&&r.dataset.s===v)||(t==='g'&&r.dataset.g===v))?'':'none'})});
</script></body></html>`;

const out = join(homedir(), "claude-viz", "audit-poke.html");
writeFileSync(out, html);
console.log("written", out, (html.length / 1024).toFixed(0) + "KB");
