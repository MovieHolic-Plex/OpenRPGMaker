import { readFileSync, statSync, writeFileSync } from "node:fs";

const IMAGE_EVIDENCE_PATH = "evidence/adversarial-ui-ux-images.json";
const PROBE_EVIDENCE_PATH = "output/evidence/adversarial-ui-ux/probes.json";
const AUTHORING_EVIDENCE_PATH = "output/evidence/adversarial-ui-ux/authoring-cost.json";
const PROBE_SPEC_PATH = "test/e2e/_adversarial-ui-ux-ceiling.spec.ts";
const AUTHORING_SPEC_PATH = "test/e2e/_adversarial-authoring-cost.spec.ts";
const images = JSON.parse(readFileSync(IMAGE_EVIDENCE_PATH, "utf8"));
const probes = JSON.parse(readFileSync(PROBE_EVIDENCE_PATH, "utf8"));
const authoring = JSON.parse(readFileSync(AUTHORING_EVIDENCE_PATH, "utf8"));

const REQUIRED_IMAGE_IDS = [
  "ev_flash-after", "ev_flash-before", "ev_hide-after", "ev_hide-before",
  "ev_shake-after", "ev_shake-before", "ev_tint-after", "ev_tint-before",
  "ev_weather-after", "ev_weather-before", "flow-01-first-open", "flow-02-basic-mode",
  "flow-03-expert-mode", "flow-04-after-canvas-dblclick", "flow-04-event-layer",
  "flow-05-after-canvas-click",
];
const SCREEN_EFFECTS = [
  { title: "Tint Screen", state: { tint: "#ff0000", tintDurationMs: 0 } },
  { title: "Flash Screen", state: { flash: "flash" } },
  { title: "Shake Screen", state: { shake: 10 } },
  { title: "Set Weather Effects", state: { weather: "rain,0.9" } },
  { title: "Hide Screen", state: { hidden: true } },
];
const SCREEN_STATE_KEYS = ["tint", "tintDurationMs", "flash", "shake", "weather", "hidden"];

const fail = (message) => { throw new Error(`보고서 증거가 유효하지 않다: ${message}`); };
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const requireBoolean = (value, path) => {
  if (typeof value !== "boolean") fail(`${path} 는 boolean 이어야 한다`);
  return value;
};
const requireString = (value, path) => {
  if (typeof value !== "string") fail(`${path} 는 string 이어야 한다`);
  return value;
};
const requireNonNegativeInteger = (value, path) => {
  if (!Number.isInteger(value) || value < 0) fail(`${path} 는 0 이상의 정수여야 한다`);
  return value;
};

if (!isRecord(images)) fail("이미지 JSON 은 객체여야 한다");
const actualImageIds = Object.keys(images).sort();
const expectedImageIds = [...REQUIRED_IMAGE_IDS].sort();
if (JSON.stringify(actualImageIds) !== JSON.stringify(expectedImageIds)) {
  fail(`이미지 ID 16개가 정확히 일치해야 한다 (expected=${expectedImageIds.join(",")}; actual=${actualImageIds.join(",")})`);
}
for (const id of REQUIRED_IMAGE_IDS) {
  const dataUrl = requireString(images[id], `images.${id}`);
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || Buffer.from(match[2], "base64").length === 0) fail(`images.${id} 는 비어 있지 않은 image data URL 이어야 한다`);
}
const probeEvidenceMtime = statSync(PROBE_EVIDENCE_PATH).mtimeMs;
const authoringEvidenceMtime = statSync(AUTHORING_EVIDENCE_PATH).mtimeMs;
if (probeEvidenceMtime < statSync(PROBE_SPEC_PATH).mtimeMs) fail(`${PROBE_EVIDENCE_PATH} 가 probe 스펙보다 오래됐다; 화면효과 증거를 다시 수집해야 한다`);
if (authoringEvidenceMtime < statSync(AUTHORING_SPEC_PATH).mtimeMs) fail(`${AUTHORING_EVIDENCE_PATH} 가 authoring 스펙보다 오래됐다; 저작비용 증거를 다시 수집해야 한다`);
const imageEvidenceMtime = statSync(IMAGE_EVIDENCE_PATH).mtimeMs;
if (imageEvidenceMtime < Math.max(probeEvidenceMtime, authoringEvidenceMtime)) {
  fail(`${IMAGE_EVIDENCE_PATH} 가 원본 probe/authoring 증거보다 오래됐다; 이미지를 다시 묶어야 한다`);
}

if (!isRecord(authoring)) fail("authoring-cost.json 은 객체여야 한다");
const validateSurface = (value, path) => {
  if (!isRecord(value)) fail(`${path} 는 객체여야 한다`);
  return {
    visibleButtons: requireNonNegativeInteger(value.visibleButtons, `${path}.visibleButtons`),
    testIdCount: requireNonNegativeInteger(value.testIdCount, `${path}.testIdCount`),
    hasModePlay: requireBoolean(value.hasModePlay, `${path}.hasModePlay`),
    buttonsWithoutName: requireNonNegativeInteger(value.buttonsWithoutName, `${path}.buttonsWithoutName`),
  };
};
const authoringEvidence = {
  onboardingDialogOnFirstOpen: requireNonNegativeInteger(authoring.onboardingDialogOnFirstOpen, "authoring.onboardingDialogOnFirstOpen"),
  onboardingText: requireString(authoring.onboardingText, "authoring.onboardingText"),
  basicMode: validateSurface(authoring.basicMode, "authoring.basicMode"),
  expertMode: validateSurface(authoring.expertMode, "authoring.expertMode"),
  modePlayHiddenInBasicMode: requireBoolean(authoring.modePlayHiddenInBasicMode, "authoring.modePlayHiddenInBasicMode"),
  rowsAfterSingleClick: requireNonNegativeInteger(authoring.rowsAfterSingleClick, "authoring.rowsAfterSingleClick"),
  newEventModalPresent: requireBoolean(authoring.newEventModalPresent, "authoring.newEventModalPresent"),
  eventRowsAfterCanvasClick: requireNonNegativeInteger(authoring.eventRowsAfterCanvasClick, "authoring.eventRowsAfterCanvasClick"),
  clicksToFirstCommandPicker: requireNonNegativeInteger(authoring.clicksToFirstCommandPicker, "authoring.clicksToFirstCommandPicker"),
  focusTrail: Array.isArray(authoring.focusTrail) && authoring.focusTrail.every((entry) => typeof entry === "string")
    ? authoring.focusTrail
    : fail("authoring.focusTrail 은 string 배열이어야 한다"),
  focusStuckOnBody: requireNonNegativeInteger(authoring.focusStuckOnBody, "authoring.focusStuckOnBody"),
  uniqueFocusStops: requireNonNegativeInteger(authoring.uniqueFocusStops, "authoring.uniqueFocusStops"),
};
if (authoringEvidence.modePlayHiddenInBasicMode !== (!authoringEvidence.basicMode.hasModePlay && authoringEvidence.expertMode.hasModePlay)) {
  fail("authoring.modePlayHiddenInBasicMode 가 모드별 hasModePlay 측정과 모순된다");
}
if (authoringEvidence.focusStuckOnBody > authoringEvidence.focusTrail.length || authoringEvidence.uniqueFocusStops > authoringEvidence.focusTrail.length) {
  fail("authoring focus 집계가 focusTrail 길이보다 클 수 없다");
}

if (!Array.isArray(probes) || probes.length !== SCREEN_EFFECTS.length) {
  fail(`화면효과 probe 는 정확히 ${SCREEN_EFFECTS.length}개여야 한다`);
}
const probesByTitle = new Map();
for (const entry of probes) {
  if (!isRecord(entry)) fail("화면효과 probe 엔트리는 객체여야 한다");
  const title = requireString(entry.title, "probe.title");
  if (probesByTitle.has(title)) fail(`중복 화면효과 probe: ${title}`);
  requireString(entry.label, `${title}.label`);
  requireString(entry.declaredSupport, `${title}.declaredSupport`);
  requireBoolean(entry.hasKind, `${title}.hasKind`);
  if (entry.pixelsChanged !== true) fail(`${title} probe 가 픽셀 변화를 증명하지 못했다`);
  if (!Number.isFinite(entry.changedRatio) || entry.changedRatio <= 0 || entry.changedRatio > 1) fail(`${title}.changedRatio 범위가 유효하지 않다`);
  if (!Array.isArray(entry.consoleWarnings) || !entry.consoleWarnings.every((warning) => typeof warning === "string")) fail(`${title}.consoleWarnings 스키마가 유효하지 않다`);
  if (!isRecord(entry.domEvidence)) fail(`${title}.domEvidence 스키마가 유효하지 않다`);
  requireNonNegativeInteger(entry.domEvidence.retiredWeatherOverlayPresent, `${title}.domEvidence.retiredWeatherOverlayPresent`);
  requireNonNegativeInteger(entry.domEvidence.tintLayers, `${title}.domEvidence.tintLayers`);
  if (!isRecord(entry.sessionRecorded)) fail(`${title}.sessionRecorded 스키마가 유효하지 않다`);
  probesByTitle.set(title, entry);
}
for (const effect of SCREEN_EFFECTS) {
  const entry = probesByTitle.get(effect.title);
  if (!entry) fail(`누락된 화면효과 probe: ${effect.title}`);
  for (const [key, expected] of Object.entries(effect.state)) {
    if (entry.sessionRecorded[key] !== expected) fail(`${effect.title}.sessionRecorded.${key} 가 기대값 ${JSON.stringify(expected)} 과 다르다`);
  }
  for (const key of SCREEN_STATE_KEYS) {
    if (!(key in effect.state) && key in entry.sessionRecorded) fail(`${effect.title} probe 가 이전 효과 상태 ${key} 에 오염됐다`);
  }
  if (entry.domEvidence.retiredWeatherOverlayPresent !== 0) fail(`${effect.title} 에서 은퇴한 weather DOM overlay 가 감지됐다`);
}

const weatherProbe = probesByTitle.get("Set Weather Effects");
const probe = (title) => {
  const entry = probesByTitle.get(title);
  if (!entry) fail(`보고서가 알 수 없는 화면효과 probe 를 요청했다: ${title}`);
  return entry;
};
const pct = (n) => `${(n * 100).toFixed(n < 0.01 ? 2 : 1)}%`;
const image = (id, alt, caption, cls = "") => {
  if (!REQUIRED_IMAGE_IDS.includes(id)) fail(`보고서가 검증되지 않은 이미지 ID 를 요청했다: ${id}`);
  return `<figure class="${cls}"><img src="${images[id]}" alt="${alt}" loading="lazy"><figcaption>${caption}</figcaption></figure>`;
};
const pair = (a, b) => `<div class="pair">${a}${b}</div>`;
const yesNo = (value) => value ? "노출" : "미노출";
const buttonComparison = `${authoringEvidence.expertMode.visibleButtons} vs ${authoringEvidence.basicMode.visibleButtons}`;
const testIdComparison = `${authoringEvidence.expertMode.testIdCount} vs ${authoringEvidence.basicMode.testIdCount}`;
const unnamedButtons = authoringEvidence.basicMode.buttonsWithoutName + authoringEvidence.expertMode.buttonsWithoutName;

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RPG ZZU 에디터 적대적 UI/UX 한계 분석</title>
<style>
:root{--bg:#080b12;--panel:#111726;--line:#28334b;--text:#eef3ff;--muted:#a3afc4;--red:#ff5964;--orange:#ffac4d;--green:#4ddd9a;--blue:#6e8cff;--purple:#bd8cff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.68 Inter,Pretendard,"Segoe UI",sans-serif}header{padding:72px 24px 54px;background:radial-gradient(circle at 75% 0,#311e4f 0,transparent 34%),linear-gradient(145deg,#101b34,#090c15 60%);border-bottom:1px solid var(--line)}.wrap{max-width:1180px;margin:auto}.kicker{color:var(--red);font-weight:800;letter-spacing:.14em;text-transform:uppercase}h1{font-size:clamp(38px,7vw,76px);line-height:1.02;margin:16px 0 24px;max-width:980px}h2{font-size:34px;line-height:1.2;margin:64px 0 18px}h3{font-size:22px;margin:30px 0 10px}p{color:#d5dceb}strong{color:#fff}.lede{font-size:20px;max-width:900px;color:#c7d0e3}.verdict{border-left:5px solid var(--red);background:#1a121b;padding:22px 26px;margin-top:32px;font-size:19px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:28px 0}.metric,.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px}.metric b{display:block;font-size:30px}.metric span,.muted,figcaption{color:var(--muted)}main{padding:0 24px 80px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.card.bad{border-color:#71323b}.card.good{border-color:#276448}.tag{display:inline-block;border-radius:999px;padding:3px 9px;font-size:12px;font-weight:800;background:#202a41;margin-right:6px}.tag.red{background:#4c222a;color:#ff9aa1}.tag.green{background:#173e31;color:#83efbd}.tag.orange{background:#4c331d;color:#ffc47e}figure{margin:20px 0;background:#0b101b;border:1px solid var(--line);border-radius:14px;overflow:hidden}figure img{display:block;width:100%;height:auto}figcaption{padding:12px 15px;font-size:14px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}.pair figure{margin:8px 0}table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}th,td{padding:12px 14px;text-align:left;border-bottom:1px solid var(--line)}th{color:#a9b9da;background:#151d2f}.bar{height:10px;background:#202a3d;border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;background:var(--blue)}code{color:#bcd0ff;background:#131b2a;padding:2px 5px;border-radius:5px}.callout{padding:20px 24px;border:1px solid #69482d;background:#1e1812;border-radius:12px}.rank{font-size:52px;font-weight:900;color:var(--red);float:left;margin-right:16px;line-height:1}.clear{clear:both}.sources{font-size:14px;color:var(--muted)}@media(max-width:760px){.metrics,.grid,.pair{grid-template-columns:1fr}header{padding-top:44px}h2{font-size:28px}}
</style></head><body>
<header><div class="wrap"><div class="kicker">Adversarial product review · 2026-07-31</div><h1>“만들 수 있다”와<br>“끝까지 만들 수 있다”는 다르다</h1><p class="lede">RPG ZZU 에디터를 초보 저작자·파워 유저·런타임 소비자 관점에서 공격적으로 검증했다. 정적 코드 감사만 하지 않고 Playwright로 실제 UI를 열고, 모드별 노출량·키보드 접근성·화면효과 픽셀 변화·데이터베이스 필드 도달성을 측정했다.</p><div class="verdict"><strong>최종 판정:</strong> 대화/선택지/전투/상점/맵 전이/날씨/화면효과를 갖춘 짧은 2D JRPG 범위는 현실적이다. 하지만 대형 게임의 반복 저작, 초보자의 첫 이벤트 생성, 장비 고급 규칙의 신뢰성에서 UX 부채가 커진다. <strong>런타임 천장보다 저작 UX 천장이 먼저 온다.</strong></div><div class="metrics"><div class="metric"><b>${buttonComparison}</b><span>전문가/기본 모드 보이는 버튼</span></div><div class="metric"><b>${testIdComparison}</b><span>전문가/기본 모드 고유 testId</span></div><div class="metric"><b>${authoringEvidence.clicksToFirstCommandPicker}</b><span>첫 커맨드 피커까지 관측 클릭</span></div><div class="metric"><b>${unnamedButtons}</b><span>모드 합산 이름 없는 버튼</span></div></div></div></header>
<main><div class="wrap">
<h2>1. 결론부터: 어디까지 만들 수 있나</h2>
<div class="grid"><div class="card good"><span class="tag green">현실적으로 가능</span><h3>완성 가능한 범위</h3><ul><li>타일맵 기반 JRPG/어드벤처</li><li>대화, 선택지, 스위치·변수, 조건분기</li><li>맵 전이, NPC 이동, 컷신, 상점·여관</li><li>턴제/액션 전투와 상태·스킬·아이템</li><li>색조, 플래시, 흔들기, 날씨, 화면 숨김</li><li>적은 수의 맵과 이벤트로 구성한 짧은 데모</li></ul></div><div class="card bad"><span class="tag red">위험 구간</span><h3>깨지기 시작하는 범위</h3><ul><li>많은 이벤트를 반복 생산하는 장편 RPG</li><li>양손무기·장비 상태부여 등 고급 장비 규칙</li><li>기본 모드만으로 처음부터 끝까지 저작</li><li>UI에서 만든 모든 DB 옵션이 런타임에 반영된다는 기대</li><li>캔버스 직접 조작을 자동 회귀검증하는 파이프라인</li></ul></div></div>

<h2>2. 첫 5분 UX: 친절한 척하면서 핵심을 감춘다</h2>
${pair(image("flow-01-first-open","최초 실행 온보딩","최초 진입 즉시 3단계 온보딩 모달이 상단·캔버스 흐름을 가린다."),image("flow-02-basic-mode","기본 모드","기본 모드의 간결한 레일과 상단 테스트 버튼."))}
${image("flow-03-expert-mode","전문가 모드","전문가 모드는 전체 도구와 고밀도 저작 표면을 노출한다.")}
<div class="callout"><strong>개선 반영:</strong> 기본 모드에도 키보드로 실행 가능한 테스트 플레이 버튼이 유지된다. 간결한 저작 표면에서도 <code>만들기 → 실행 → 확인</code> 루프가 끊기지 않는다.</div>
<table><thead><tr><th>측정</th><th>기본 모드</th><th>전문가 모드</th><th>관측 비교</th></tr></thead><tbody><tr><td>보이는 버튼</td><td>${authoringEvidence.basicMode.visibleButtons}</td><td>${authoringEvidence.expertMode.visibleButtons}</td><td>${buttonComparison}</td></tr><tr><td>고유 testId 표면</td><td>${authoringEvidence.basicMode.testIdCount}</td><td>${authoringEvidence.expertMode.testIdCount}</td><td>${testIdComparison}</td></tr><tr><td>mode-play testId</td><td>${yesNo(authoringEvidence.basicMode.hasModePlay)}</td><td>${yesNo(authoringEvidence.expertMode.hasModePlay)}</td><td>${authoringEvidence.modePlayHiddenInBasicMode ? "기본 모드에서 미노출" : "모드 간 숨김 차이 없음"}</td></tr><tr><td>이름 없는 버튼</td><td>${authoringEvidence.basicMode.buttonsWithoutName}</td><td>${authoringEvidence.expertMode.buttonsWithoutName}</td><td>합계 ${unnamedButtons}</td></tr></tbody></table>
<div class="callout"><strong>저작 흐름 실측:</strong> 첫 커맨드 피커까지 ${authoringEvidence.clicksToFirstCommandPicker}회 클릭, 단일 클릭 후 이벤트 행 ${authoringEvidence.rowsAfterSingleClick}개, 캔버스 조작 후 이벤트 행 ${authoringEvidence.eventRowsAfterCanvasClick}개. Tab ${authoringEvidence.focusTrail.length}회에서 고유 정지점 ${authoringEvidence.uniqueFocusStops}개, body 고립 ${authoringEvidence.focusStuckOnBody}회를 기록했다.</div>

<h2>3. 이벤트 저작: 엔진보다 발견성이 문제다</h2>
${pair(image("flow-04-event-layer","이벤트 레이어 빈 상태","이벤트 레이어의 빈 상태."),image("flow-05-after-canvas-click","캔버스 클릭 후","단일 클릭이 좌표를 선택하고 명시적 생성 CTA를 노출한다."))}
<p>이벤트 레이어 단일 클릭은 좌표 선택, 명시적 CTA는 이벤트 생성, 더블클릭은 기존 이벤트 즉시 편집으로 역할을 분리했다. 숨겨진 더블클릭 관습에만 의존하지 않는다.</p>
<div class="grid"><div class="card good"><h3>캔버스 저작 E2E</h3><p>빈 프로젝트에서 첫 이벤트 선택·생성·대사 저작·로컬 저장·재로드·실제 선택 이벤트 플레이까지 자동 증명한다.</p></div><div class="card good"><h3>키보드 접근성</h3><p>기본 모드 테스트 버튼은 Enter로 실행되며, 정보용 partial 명령도 포커스와 설명을 유지한다.</p></div></div>

<h2>4. 런타임 화면효과: 의심했지만 실제로는 전부 동작했다</h2>
<p>처음엔 세션 상태만 기록되고 화면엔 반영되지 않는다고 의심했다. 계측을 고쳐 효과 지속 중 여러 프레임을 캡처하자 가설이 틀렸음이 드러났다. 색조·플래시·흔들기·날씨·화면 숨김 모두 실제 픽셀을 바꾼다. 이 에디터의 런타임은 UI보다 강하다.</p>
${pair(image("ev_tint-before","색조 전","Tint Screen 실행 전"),image("ev_tint-after","색조 후","빨강 색조 실행 후 — 변화 픽셀 " + pct(probe("Tint Screen").changedRatio)))}
${pair(image("ev_flash-before","플래시 전","Flash Screen 실행 전"),image("ev_flash-after","플래시 중","흰색 플래시 진행 중 — 변화 픽셀 " + pct(probe("Flash Screen").changedRatio)))}
${pair(image("ev_shake-before","흔들기 전","Shake Screen 실행 전"),image("ev_shake-after","흔들기 중","강도 10 흔들기 진행 중 — 변화 픽셀 " + pct(probe("Shake Screen").changedRatio)))}
${pair(image("ev_weather-before","날씨 전","날씨 전"),image("ev_weather-after","비 날씨","비 날씨 렌더링 — 변화 픽셀 " + pct(weatherProbe.changedRatio) + ". 은퇴한 DOM 날씨 오버레이 " + weatherProbe.domEvidence.retiredWeatherOverlayPresent + "개, 화면 오버레이 레이어 " + weatherProbe.domEvidence.tintLayers + "개."))}
${pair(image("ev_hide-before","숨김 전","Hide Screen 실행 전"),image("ev_hide-after","숨김 후","완전 검정으로 숨김 — 변화 픽셀 " + pct(probe("Hide Screen").changedRatio)))}

<h2>5. 커맨드 범위: 정적 총계보다 실행 근거를 우선한다</h2>
<p>커맨드 피커의 규모와 지원 분류는 카탈로그 소스에서 별도 산출한 검증 증거가 이 보고서 입력에 없으므로 고정 총계를 제시하지 않는다. 이 보고서가 직접 검증하는 커맨드 근거는 격리 런타임에서 상태와 픽셀 변화를 함께 기록한 화면효과 5종이다.</p>
<div class="card"><span class="tag green">실측 범위</span><p><strong>${SCREEN_EFFECTS.length}개 화면효과</strong> 모두 fresh runtime에서 대상 이벤트를 실행해 효과별 세션 상태, 변화 픽셀, 은퇴한 날씨 DOM overlay 부재를 증명했다.</p></div>

<h2>6. 데이터베이스: 필드 지원 경계를 숨기지 않는다</h2>
<p>Item/Equipment 레코드 폼은 <code>databaseFieldSupport.ts</code>에서 파생한 지원 배지를 표시한다. 런타임 필드는 공통 권위로 연결하고, 이미지·사용 문구·legacy 프로필처럼 저작 전용인 필드는 실행 규칙으로 오인되지 않게 구분한다.</p>
<table><thead><tr><th>레코드</th><th>런타임 배선</th><th>명시적 저작 전용</th></tr></thead><tbody><tr><td>ItemRecord</td><td>consumptionLimit, usableClassIds, seedParameterBonuses</td><td>imageResourceId, iconResourceId, usageMessage, equipmentProfile</td></tr><tr><td>EquipmentRecord</td><td>twoHanded, usableAsItemSkillId, stateInflictIds, stateInflictionChance</td><td>imageResourceId, iconResourceId</td></tr></tbody></table>
<div class="verdict"><strong>개선 원칙:</strong> 값이 저장되는 것과 런타임 규칙으로 실행되는 것을 같은 의미로 표시하지 않는다. 배지·피커 메타데이터·공통 transition 권위가 같은 계약을 사용한다.</div>

<h2>7. 개선 후 제품 천장</h2>
<div class="grid"><div class="card"><span class="tag green">강점</span><h3>런타임 표현력</h3><p>대화·분기·전투·상점·맵·화면효과·날씨를 제공하며, 이 보고서에서는 화면효과 5종의 상태와 렌더링을 직접 검증했다.</p></div><div class="card"><span class="tag green">명시적 경계</span><h3>데이터 신뢰성</h3><p>실행 필드와 저작 전용 필드를 구분해 저장 여부를 런타임 지원으로 오인하지 않게 한다.</p></div><div class="card"><span class="tag orange">관측 기반</span><h3>저작 발견성</h3><p>모드별 버튼·testId 노출과 첫 커맨드 피커까지의 클릭 수를 authoring-cost 실측에서 표시한다.</p></div><div class="card"><span class="tag green">재현 가능</span><h3>검증 가능성</h3><p>화면효과는 각각 새 브라우저 context와 PlaySession에서 실행되어 누적 상태가 결과를 위조하지 못한다.</p></div></div>

<h2>8. 이번 개선에서 닫은 천장</h2>
<ol><li><strong>필드 신뢰성:</strong> item charge, usable class, seed bonus, two-handed, 장비 스킬·상태 효과를 런타임 권위에 연결하고 저작 전용 필드는 배지로 공개했다.</li><li><strong>기본 실행 루프:</strong> 기본 모드 테스트 플레이를 유지하고 키보드 실행을 회귀검증한다.</li><li><strong>첫 이벤트 발견성:</strong> 단일 클릭 좌표 선택 + 생성 CTA + 실제 캔버스 저작 E2E를 추가했다.</li><li><strong>partial 명령 발견성:</strong> 메인 피커에서 검색 가능하고 포커스 가능한 정보 행과 대체 경로를 제공한다.</li><li><strong>날씨 정본:</strong> 죽은 DOM 경로를 제거하고 Phaser 경로만 유지한다.</li><li><strong>원격 증명:</strong> 전용 격리 인증서가 있을 때만 생성·저장·재로드·플레이·소유 행 삭제를 수행하는 fail-closed 라이프사이클을 둔다.</li></ol>

<h2>9. 방법과 한계</h2>
<p class="sources"><strong>초기 실측:</strong> Playwright Chromium 1440×900/1280×800, 기본/전문가 DOM inventory, 키보드 포커스, 화면효과 픽셀 비교(Jimp), 런타임 상태 확인. <strong>개선 검증:</strong> 실제 캔버스 이벤트 생성, 로컬 flush/reload, 전체 및 선택 이벤트 플레이, item/equipment transition 단위·통합 테스트, 프로덕션 번들 브리지 부재 검사. <strong>남은 외부 조건:</strong> 라이브 Supabase 인증은 전용 격리 인증서와 사람이 제공하는 대상 자격증명이 있을 때만 실행된다.</p>
<p class="sources">생성 데이터: <code>output/evidence/adversarial-ui-ux/probes.json</code>, <code>authoring-cost.json</code>. 진단 스펙: <code>test/e2e/_adversarial-ui-ux-ceiling.spec.ts</code>, <code>_adversarial-authoring-cost.spec.ts</code>. 보고서는 이미지 16장을 base64로 포함한 단일 HTML이다.</p>
</div></main></body></html>`;

writeFileSync("docs/2026-07-31-editor-game-ceiling-adversarial-report.html", html);
console.log(`wrote report: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB, images=${Object.keys(images).length}`);
