/**
 * 용암던전 장식 타일셋 제안서 생성기 (분석 전용 — 원격 저장 없음).
 * 이미 준비된 시트/크롭 PNG + 현재 맵 존 플랜을 base64로 내장한 단일 HTML.
 * 실행: npx tsx scripts/gen-lava-tileset-proposal.mts
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const OUT = path.resolve("output/evidence/lava-tileset-proposal");
const ANALYSIS = path.resolve("output/evidence/lava-mine-analysis");

// 존 플랜: 현재 맵 렌더 위에 장식 존 사각형
const base = PNG.sync.read(fs.readFileSync(path.join(ANALYSIS, "current.png")));
const zone = PNG.sync.read(Buffer.from(PNG.sync.write(base)));
const SCALE = 3, T = 16;
function rect(x: number, y: number, w: number, h: number, rgb: [number, number, number]): void {
  const s = T * SCALE, px = x * s, py = y * s, ww = w * s, hh = h * s, t = 4;
  const put = (xx: number, yy: number) => { const di = (yy * zone.width + xx) * 4; if (di < 0 || di + 3 >= zone.data.length) return; zone.data[di] = rgb[0]; zone.data[di + 1] = rgb[1]; zone.data[di + 2] = rgb[2]; zone.data[di + 3] = 255; };
  for (let i = 0; i < ww; i += 1) for (let k = 0; k < t; k += 1) { put(px + i, py + k); put(px + i, py + hh - 1 - k); }
  for (let i = 0; i < hh; i += 1) for (let k = 0; k < t; k += 1) { put(px + k, py + i); put(px + ww - 1 - k, py + i); }
}
rect(1, 4, 53, 16, [80, 200, 255]);   // A 상단 광구·레일망
rect(1, 20, 53, 15, [160, 120, 255]); // B 중앙 챔버
rect(0, 36, 22, 19, [255, 120, 40]);  // C 용암 호수
rect(11, 45, 13, 10, [255, 230, 80]); // D 부두
rect(24, 44, 30, 10, [255, 60, 60]);  // E 보스방(하단)
fs.writeFileSync(path.join(OUT, "zone-plan.png"), PNG.sync.write(zone));

const b64 = (f: string) => fs.readFileSync(path.join(OUT, f)).toString("base64");
const img = (f: string, alt: string, w?: string) =>
  `<img src="data:image/png;base64,${b64(f)}" alt="${alt}" style="image-rendering:pixelated;${w ? `width:${w};` : "max-width:100%;"}border:1px solid #333;border-radius:6px;background:#1c1a22;">`;

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>용암던전 장식 타일셋 제안서</title>
<style>
 body{background:#141216;color:#e8e2da;font:15px/1.65 -apple-system,'Segoe UI','Malgun Gothic',sans-serif;max-width:1100px;margin:0 auto;padding:32px 20px 80px}
 h1{font-size:26px;border-bottom:2px solid #b8492b;padding-bottom:10px}
 h2{font-size:20px;margin-top:44px;color:#ffb27a;border-left:4px solid #b8492b;padding-left:10px}
 h3{font-size:16px;color:#ffd9a0;margin:18px 0 8px}
 .card{background:#1e1b22;border:1px solid #333;border-radius:10px;padding:16px 20px;margin:14px 0}
 .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
 .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
 table{border-collapse:collapse;width:100%;font-size:13.5px}
 th,td{border:1px solid #3a3540;padding:6px 10px;text-align:left;vertical-align:top}
 th{background:#2a2530}
 code{background:#2a2530;padding:1px 6px;border-radius:4px;font-size:13px}
 .ok{color:#7fd47f}.bad{color:#ff7a7a}.warn{color:#ffd27a}
 .cap{font-size:12.5px;color:#a99;margin:6px 0 0}
 .tag{display:inline-block;border-radius:20px;padding:2px 12px;font-size:12px;margin:2px 4px 2px 0}
 .tag-ok{background:#1e3a1e;color:#7fd47f}.tag-warn{background:#3a2e1e;color:#ffd27a}.tag-bad{background:#3a1e1e;color:#ff7a7a}
 ol li,ul li{margin:5px 0}
</style></head><body>

<h1>용암던전(<code>map_sc_dungeon_lava</code>) 추가 장식 타일셋 제안서</h1>
<p class="cap">작성: ${new Date().toISOString()} · 대상 프로젝트: LegacyDb <code>rpg-zzu-showcase</code> · 분석 전용, 원격 변경 없음</p>

<div class="card">
<h3>현재 상태와 부족한 점</h3>
<p>현재 맵은 <code>easyrpg_chipset_dungeon</code> 하나만 사용하며, 장식 어휘가 <b>레일·횃불·수정·광석·판자</b> 다섯 종뿐이다. 별도 분석(타일셋팅 리포트)에서 구조 문제(벽 문법·레일 단절)는 정리했고, 이 문서는 <b>"더 꾸미기"</b>에 쓸 자산을 다룬다.</p>
<ul>
<li>광산 구조물 부재 — 지지대·사다리·통·상자·작업대가 없어 '광산' 느낌이 약함</li>
<li>레일 어휘 빈약 — 현 칩셋엔 루프 타일이 없어 순환선 연출 불가</li>
<li>용암 호수·보스방이 평면적 — 불 기둥, 경고 표지, 의식 공간 등 포인트 부재</li>
<li>벽면 변화 없음 — 화산암·종유석 등 포인트 지형 없음</li>
</ul>
${img("zone-plan.png", "zone plan")}
<p class="cap">장식 존 플랜: <span style="color:#50c8ff">A 상단 광구·레일망</span> · <span style="color:#a078ff">B 중앙 챔버</span> · <span style="color:#ff7828">C 용암 호수</span> · <span style="color:#ffe650">D 부두</span> · <span style="color:#ff3c3c">E 보스방</span></p>
</div>

<h2>후보 ① retro_Dungeon — <span class="ok">최우선 추천</span> <span class="tag tag-ok">프로젝트에 이미 등록됨 (easyrpg_chipset_retro_dungeon)</span></h2>
<div class="card">
${img("sheet-retro_dungeon.png", "retro dungeon sheet")}
<div class="grid2">
<div>${img("crop-rd-volcanic.png", "volcanic")}<p class="cap"><b>화산암 오토타일</b> — 적갈 암반+불긋한 균열. 현재 단조로운 적암 바닥에 포인트 지형을 깔 수 있다.</p></div>
<div>${img("crop-rd-crystals.png", "crystals")}<p class="cap"><b>종유석·석주·수정·바위·횃불대</b> — 벽면·모서리 장식. 석조 아치도 있음.</p></div>
<div>${img("crop-rd-mineprops.png", "mine props")}<p class="cap"><b>레일 루프(타원 순환)·직선·사다리·석상·묘비</b> — 현재 칩셋에 없는 <b>루프 타일</b> 확보. 여신상·가고일 석상은 제단 연출에.</p></div>
<div>${img("crop-rd-props2.png", "props2")}<p class="cap"><b>목재·해골·통·돌묵</b> — 광산 작업 흔적 연출.</p></div>
</div>
<p>적합도: <span class="ok">용암·광산 테마에 거의 완벽</span>. 비용: 타일셋이 이미 프로젝트에 등록돼 있어 <b>타일 의미(tileMeta)와 통행성만 신규 정의</b>하면 된다. 투명 처리본(<code>easyrpg-chipset-retro-dungeon-transparent.png</code>)도 존재.</p>
</div>

<h2>후보 ② Interior — 포인트 장식 <span class="tag tag-ok">프로젝트에 이미 등록됨 (easyrpg_chipset_interior)</span></h2>
<div class="card">
<div class="grid3">
<div>${img("crop-in-fire.png", "fire")}<p class="cap"><b>애니메이션 불(3프레임)</b> — 용암 호수 가장자리 불 기둥, 화로, 지열 분출 연출.</p></div>
<div>${img("crop-in-chevrons.png", "chevrons")}<p class="cap"><b>해저드 셰브론</b> — 금속판 위 경고 스트라이프. 용암 호수·절벽 앞 경고 구역.</p></div>
<div>${img("crop-in-circle.png", "circle")}<p class="cap"><b>마법진</b> — 보스방(E존) 드래곤 소환 의식 공간.</p></div>
</div>
<div class="grid2">
<div>${img("crop-in-machine.png", "machine")}<p class="cap"><b>기계·파이프·밸브</b> — 광산 채굴 설비 연출.</p></div>
<div><p>적합도: <span class="warn">테마는 실내 가구 중심이라 일부만 발췌</span>. 불·셰브론·마법진·기계류만 포인트로 가져오는 용도. 이미 등록됐으므로 비용은 tileMeta 정의뿐.</p></div>
</div>
</div>

<h2>후보 ③ charset-object2 — 인터랙션 이벤트 스프라이트 <span class="tag tag-ok">번들됨 (이벤트 그래픽)</span></h2>
<div class="card">
${img("sheet-charset-object2.png", "object2")}
<p><b>다이너마이트(도화선 점화 프레임)·레버·철 게이트·바위·병 수정·목재 수레</b>. 타일이 아니라 <b>이벤트</b>로 배치하므로 애니메이션·상호작용이 된다:</p>
<ul>
<li>레버 → 레일 분기 전환 연출 (광차 스위치)</li>
<li>다이너마이트 → 막힌 벽 폭파 이벤트 (신규 구역 해금)</li>
<li>철 게이트 → 부두/보스방 차단</li>
</ul>
<p class="cap">charset-object1(문·볬상자)도 번들 — 보상 상자 배치에 사용.</p>
</div>

<h2>후보 ④ mabaci-medieval-items (CC0) — 보관·보상 소품 <span class="tag tag-warn">신규 임포트 필요</span></h2>
<div class="card">
${img("crop-mabaci.png", "mabaci")}
<p><b>나무통·상자·볬상자(개폐)·코인 더미</b> — 부두(D존)와 작업장에 깔 창고 소품. 개별 PNG라 <b>투명 처리 + charset 합성 또는 신규 타일 등록</b> 공정이 필요하다 (<code>scripts/assets/chromaKey.mjs</code>, <code>generateChipsetTransparency.mjs</code> 활용). CC0이라 라이선스 부담 없음.</p>
</div>

<h2>후보 ⑤ 현재 Dungeon 칩셋 미사용분 재활용 — 비용 0</h2>
<div class="card">
${img("crop-du-statues.png", "dungeon statues")}
<p>이미 등록·의미 정의까지 끝난 현재 칩셋에 <b>여신상·가고일·왕관 비석·아궁이 비석(145~147 계열)</b> 등 미사용 소품이 남아 있다. 신규 자산 없이 즉시 배치 가능. 다만 지금 맵이 이 칩셋만 쓰고도 형편없어진 전력이 있으므로, <b>테마 다양성 측면에서는 ①이 우선</b>.</p>
</div>

<h2>기각 후보</h2>
<div class="card">
<table>
<tr><th>자산</th><th>사유</th></tr>
<tr><td><code>Exterior.png</code> / <code>rm2k3-original-chipset.png</code></td><td>물·풀·마을 중심. 용암 관련성 없음 (천막·석상 정도, 광산 캠프를 만들 때나 검토)</td></tr>
<tr><td><code>Ship.png</code>, scarloxy 계열</td><td>선박·초원/실내 테마. 용암동굴과 무관</td></tr>
<tr><td>외부 신규 타일셋 (웹)</td><td>번들 자산만으로 테마가 충족됨. 외부 자산은 라이선스·스타일 통일 비용 대비 이득 없음</td></tr>
</table>
</div>

<h2>종합 비교</h2>
<div class="card">
<table>
<tr><th>후보</th><th>등록 상태</th><th>제공 요소</th><th>용암 적합도</th><th>통합 비용</th></tr>
<tr><td><b>① retro_Dungeon</b></td><td class="ok">등록됨</td><td>화산암·루프 레일·종유석·석상·광산 소품</td><td class="ok">★★★★★</td><td>tileMeta/통행성 정의</td></tr>
<tr><td><b>② Interior</b></td><td class="ok">등록됨</td><td>애니 불·셰브론·마법진·기계</td><td class="ok">★★★★</td><td>tileMeta 정의</td></tr>
<tr><td><b>③ charset-object2</b></td><td class="ok">번들</td><td>다이너마이트·레버·게이트·바위</td><td class="ok">★★★★</td><td>이벤트 배치만</td></tr>
<tr><td><b>④ mabaci CC0</b></td><td class="warn">미등록</td><td>통·상자·코인</td><td>★★★</td><td>임포트 공정 + 등록</td></tr>
<tr><td><b>⑤ 현 칩셋 미사용분</b></td><td class="ok">등록·정의됨</td><td>석상·비석·제단</td><td>★★★</td><td>0</td></tr>
</table>
</div>

<h2>존 별 장치 플랜 (추천 조합: ①+②+③, ④는 선택)</h2>
<div class="card">
<table>
<tr><th>존</th><th>배치 제안</th><th>자산</th></tr>
<tr><td><span style="color:#50c8ff">A 상단 광구·레일망</span></td><td>레일 루프 순환선 1개, 사다리로 상층 연결, 목재 지지대·통, 작업장 코너</td><td>① + ④</td></tr>
<tr><td><span style="color:#a078ff">B 중앙 챔버</span></td><td>화산암 포인트 지형, 종유석·석주 벽면 장식, 여신상 제단</td><td>① + ⑤</td></tr>
<tr><td><span style="color:#ff7828">C 용암 호수</span></td><td>호수 가장자리 셰브론 경고 띠, 불 기둥(애니) 2~3개, 균열 화산암</td><td>② + ①</td></tr>
<tr><td><span style="color:#ffe650">D 부두</span></td><td>통·상자·코인 창고, 철 게이트, 레버(레일 분기 연출)</td><td>④ + ③</td></tr>
<tr><td><span style="color:#ff3c3c">E 보스방</span></td><td>마법진 + 가고일 석상 2기 + 화로(애니 불) — 드래곤 의식 공간</td><td>② + ①</td></tr>
</table>
</div>

<h2>통합 절차 (실행 시)</h2>
<div class="card">
<ol>
<li>선택 타일의 tileMeta/통행성을 레포 정본(<code>src/project/defaults/tileSemantics*.ts</code>)에 추가 — <b>먼저 정의 후 배치</b> (이번 용암동굴 사태의 교훈: 의미 없이 배치하면 콘페티가 된다)</li>
<li>④ 채택 시: PNG 투명 처리 → charset/타일 등록 → 라이선스 표기(CC0)</li>
<li>존 플랜대로 배치 — 벽 문법·레일 개구 규칙(기존 리포트 v4) 준수</li>
<li>렌더 검증 → <code>saveProjectToLegacyDb</code> 저장 → project id 재로드 → 플레이 통행 테스트</li>
</ol>
</div>
<p class="cap">이미지 출처: <code>public/assets/easyrpg/chipset/*</code>, <code>public/assets/cc0/mabaci-medieval-items/*</code>, <code>public/assets/easyrpg-charset-object*.png</code> · 라이선스: <code>public/assets/ATTRIBUTION.md</code>, <code>public/assets/easyrpg/COPYING</code> 참조</p>
</body></html>`;
fs.writeFileSync(path.join(OUT, "proposal.html"), html);
console.log("proposal:", path.join(OUT, "proposal.html"));
