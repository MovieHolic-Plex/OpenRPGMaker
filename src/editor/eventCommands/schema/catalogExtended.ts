// 이벤트 명령 스키마 카탈로그 — 잔여 23종.
//
// catalog.ts 와 함께 COMMAND_KINDS 75종 전부를 덮는다. 파일을 나눈 이유는 분량뿐이며
// 등록 순서는 의미가 없다 (kind 별 레지스트리).
//
// 여기 있는 명령 중 shop·addLight·spawnFieldEnemy 는 필드 어휘로 표현되지 않는 부분을
// f.custom() 으로 전용 위젯에 넘긴다 — 특히 shop 의 재고는 아이템 × 계절 2차원 표다.

import { AMOUNT_OPS, num, operandText, str } from "./catalog";
import { defineCommand } from "./defineCommand";
import { f } from "./fieldTypes";

// ── 대사 · 입력 ───────────────────────────────────────────────────

defineCommand({
  kind: "changeFace",
  family: "dialogue",
  label: "얼굴 그래픽",
  fields: {
    resourceId: f.record("페이스셋", "image"),
    faceIndex: f.number("칸 번호", { min: 0 }),
    position: f.enum("표시 위치", [
      { value: "left", label: "왼쪽", key: "left" },
      { value: "right", label: "오른쪽", key: "right" },
    ]),
    flipHorizontally: f.bool("좌우 반전", { optional: true }),
  },
  summary: (c, l) => `얼굴 ${l.recordName(str(c.resourceId))} #${num(c.faceIndex)}`,
});

defineCommand({
  kind: "displayTextSettings",
  family: "dialogue",
  label: "문장 표시 설정",
  fields: {
    format: f.enum("창 모양", [
      { value: "normal", label: "보통", key: "normal" },
      { value: "transparent", label: "투명", key: "transparent" },
    ]),
    position: f.enum("창 위치", [
      { value: "top", label: "위", key: "top" },
      { value: "center", label: "가운데", key: "center" },
      { value: "bottom", label: "아래", key: "bottom" },
    ]),
    preventObscuringPlayer: f.bool("플레이어 가리지 않기"),
    allowEventMovementDuringWait: f.bool("대기 중 이벤트 이동 허용"),
  },
  summary: (c) => {
    const pos: Record<string, string> = { top: "위", center: "가운데", bottom: "아래" };
    return `문장 창 ${pos[str(c.position)] ?? "아래"}${c.format === "transparent" ? " · 투명" : ""}`;
  },
});

// ── 흐름 · 시간 ───────────────────────────────────────────────────

defineCommand({
  kind: "inputWait",
  family: "controlFlow",
  label: "입력 대기",
  fields: { variableId: f.variable("누른 키를 저장할 변수", { optional: true }) },
  summary: (c, l) => (c.variableId ? `키 입력 → ${l.variableName(str(c.variableId))}` : "키 입력 대기"),
});

defineCommand({
  kind: "timer",
  family: "time",
  label: "타이머",
  fields: {
    action: f.enum("동작", [
      { value: "set", label: "설정", key: "set" },
      { value: "start", label: "시작", key: "start" },
      { value: "stop", label: "정지", key: "stop" },
    ]),
    // 초는 설정할 때만 의미가 있다.
    seconds: f.number("초", { min: 0, unit: "s", when: (c) => c.action === "set" }),
    timerId: f.enum("대상", [
      { value: "timer1", label: "타이머 1", key: "t1" },
      { value: "timer2", label: "타이머 2", key: "t2" },
    ]),
  },
  summary: (c) => {
    const act: Record<string, string> = { set: "설정", start: "시작", stop: "정지" };
    const which = c.timerId === "timer2" ? "타이머 2" : "타이머 1";
    return c.action === "set" ? `${which} ${num(c.seconds)}초로 설정` : `${which} ${act[str(c.action)] ?? "시작"}`;
  },
});

// ── 데이터 ────────────────────────────────────────────────────────

defineCommand({
  kind: "setFlag",
  family: "state",
  label: "플래그",
  fields: {
    flag: f.text("플래그 이름"),
    value: f.enum("값", [
      { value: "true", label: "ON", key: "on" },
      { value: "false", label: "OFF", key: "off" },
    ]),
  },
  summary: (c) => `플래그 ${str(c.flag) || "(미지정)"} → ${c.value === false ? "OFF" : "ON"}`,
});

defineCommand({
  kind: "setSelfSwitch",
  family: "state",
  label: "셀프 스위치",
  fields: {
    key: f.enum("키", [
      { value: "A", label: "A", key: "a" },
      { value: "B", label: "B", key: "b" },
      { value: "C", label: "C", key: "c" },
      { value: "D", label: "D", key: "d" },
    ]),
    value: f.enum("값", [
      { value: "true", label: "ON", key: "on" },
      { value: "false", label: "OFF", key: "off" },
    ]),
  },
  summary: (c) => `셀프 스위치 ${str(c.key) || "A"} → ${c.value === false ? "OFF" : "ON"}`,
});

defineCommand({
  kind: "runControl",
  family: "system",
  label: "로그라이크 런 제어",
  fields: {
    action: f.enum("동작", [
      { value: "start", label: "런 시작", key: "start" },
      { value: "advance", label: "다음 층", key: "advance" },
      { value: "end", label: "런 종료", key: "end" },
      { value: "setFlag", label: "런 플래그", key: "flag" },
      { value: "resetRoom", label: "방 초기화", key: "reset" },
    ]),
    seed: f.number("시드", { min: 0, max: 0xffff_ffff, optional: true, when: (c) => c.action === "start" }),
    runId: f.text("런 ID", { optional: true, when: (c) => c.action === "start" }),
    startFloor: f.number("시작 층", { min: 1, max: 9_999, optional: true, when: (c) => c.action === "start" }),
    amount: f.number("증가 층", { min: 1, optional: true, when: (c) => c.action === "advance" }),
    result: f.enum("결과", [
      { value: "completed", label: "완료", key: "completed" },
      { value: "failed", label: "실패", key: "failed" },
      { value: "abandoned", label: "포기", key: "abandoned" },
    ], { when: (c) => c.action === "end" }),
    flag: f.text("플래그", { when: (c) => c.action === "setFlag" }),
    value: f.bool("값", { when: (c) => c.action === "setFlag" }),
    roomId: f.text("방 ID", { optional: true, when: (c) => c.action === "resetRoom" }),
  },
  summary: (c) => `로그라이크 런 · ${str(c.action) || "start"}`,
});

defineCommand({
  kind: "changeLifeSkillExp",
  family: "actor",
  label: "생활 스킬 경험치",
  fields: {
    skillId: f.text("생활 스킬"),
    op: f.op("연산", AMOUNT_OPS),
    amount: f.operand("경험치", { min: 0 }),
  },
  summary: (c, l) => `${str(c.skillId) || "생활 스킬"} ${str(c.op) || "+="} ${operandText(c.amount, l)}`,
});

// ── 맵 ────────────────────────────────────────────────────────────

defineCommand({
  kind: "changeTile",
  family: "map",
  label: "타일 변경",
  fields: {
    mapId: f.record("대상 맵", "map"),
    at: f.mapPoint("좌표", "mapId"),
    layer: f.enum("레이어", [
      { value: "lower", label: "하단", key: "lower" },
      { value: "upper", label: "상단", key: "upper" },
    ]),
    tile: f.number("타일 번호", { min: 0 }),
  },
  summary: (c, l) => `${l.recordName(str(c.mapId))} (${num(c.x)}, ${num(c.y)}) → 타일 ${num(c.tile)}`,
});

// ── 경제 ──────────────────────────────────────────────────────────

defineCommand({
  kind: "craftRecipe",
  family: "economy",
  label: "제작",
  fields: { recipeId: f.text("레시피") },
  summary: (c) => `${str(c.recipeId) || "레시피"} 제작`,
});

defineCommand({
  kind: "applyItemUpgrade",
  family: "economy",
  label: "아이템 강화",
  fields: { upgradeId: f.text("강화 정의") },
  summary: (c) => `${str(c.upgradeId) || "강화"} 적용`,
});

defineCommand({
  kind: "equipTool",
  family: "economy",
  label: "도구 장착",
  fields: { itemId: f.record("도구", "item", { optional: true, allowEmpty: true }) },
  summary: (c, l) => (c.itemId ? `${l.recordName(str(c.itemId))} 장착` : "도구 해제"),
});

defineCommand({
  kind: "openChest",
  family: "economy",
  label: "보관 상자",
  fields: { chestId: f.text("상자 ID", { optional: true, placeholder: "비우면 공용 보관함" }) },
  summary: (c) => (c.chestId ? `보관 상자 ${str(c.chestId)}` : "공용 보관함 열기"),
});

// ── 동료 ──────────────────────────────────────────────────────────

defineCommand({
  kind: "addFollower",
  family: "follower",
  label: "동행자 추가",
  fields: {
    actorId: f.record("주인공", "actor", { optional: true, allowEmpty: true }),
    // 주인공을 고르지 않으면 이름으로 임시 동행자를 만든다.
    name: f.text("이름", { optional: true, when: (c) => !c.actorId }),
  },
  summary: (c, l) => `${c.actorId ? l.recordName(str(c.actorId)) : str(c.name) || "동행자"} 합류`,
});

defineCommand({
  kind: "removeFollower",
  family: "follower",
  label: "동행자 제거",
  fields: {
    all: f.bool("전원 제거"),
    name: f.text("이름", { optional: true, when: (c) => c.all !== true }),
  },
  summary: (c) => (c.all === true ? "동행자 전원 제거" : `${str(c.name) || "동행자"} 제거`),
});

// ── 연출 ──────────────────────────────────────────────────────────

defineCommand({
  kind: "addLight",
  family: "atmosphere",
  label: "광원 추가",
  // LightSource 는 좌표 앵커·반경·색·깜빡임을 한 덩어리로 다루므로 전용 위젯이 맡는다.
  fields: { source: f.custom("광원", "screenPoint") },
  summary: () => "광원 추가",
});

defineCommand({
  kind: "removeLight",
  family: "atmosphere",
  label: "광원 제거",
  fields: {
    all: f.bool("전부 제거"),
    id: f.text("광원 ID", { optional: true, when: (c) => c.all !== true }),
  },
  summary: (c) => (c.all === true ? "광원 전부 제거" : `광원 ${str(c.id) || "(미지정)"} 제거`),
});

// ── 상점 · 시설 ───────────────────────────────────────────────────

defineCommand({
  kind: "shop",
  family: "commerce",
  label: "상점",
  fields: {
    shopType: f.enum("상점 유형", [
      { value: "normal", label: "매매", key: "normal" },
      { value: "buyOnly", label: "구매만", key: "buy" },
      { value: "sellOnly", label: "판매만", key: "sell" },
    ]),
    // 재고는 아이템 × 계절 2차원 표(priceBySeason)라 필드 어휘로 표현되지 않는다.
    stock: f.custom("재고", "shopStock"),
    allowSell: f.bool("플레이어 물품 매입", { optional: true }),
    quantityMode: f.enum("수량 지정", [
      { value: "single", label: "1개씩", key: "single" },
      { value: "select", label: "수량 선택", key: "select" },
    ]),
    messageType: f.enum("인사말", [
      { value: "welcome", label: "환영", key: "welcome" },
      { value: "business", label: "사무적", key: "business" },
      { value: "direct", label: "간결", key: "direct" },
    ]),
    merchantGold: f.number("상인 소지금", { min: 0, optional: true }),
    branchOnTransaction: f.bool("거래 후 분기", { optional: true }),
  },
  branches: (c) =>
    c.branchOnTransaction ? [{ key: "transactionBranch", label: "거래 후", tone: "neutral" as const }] : [],
  summary: (c) => {
    const count = Array.isArray(c.stock) ? c.stock.length : Array.isArray(c.itemIds) ? c.itemIds.length : 0;
    return `상점 · ${count}종`;
  },
});

defineCommand({
  kind: "inn",
  family: "commerce",
  label: "여관",
  fields: {
    price: f.number("1박 요금", { min: 0 }),
    note: f.text("인사말", { optional: true }),
    question: f.text("숙박 질문", { optional: true }),
    recoverMp: f.bool("MP도 회복", { optional: true }),
    advanceToMorning: f.bool("아침으로 시간 이동", { optional: true }),
    restDurationMs: f.number("암전 시간", { min: 0, unit: "ms", optional: true }),
    branchOnNotEnoughGold: f.bool("골드 부족 시 분기", { optional: true }),
  },
  // battleProcessing 과 동일한 branches() 선언 — 명령이 달라도 분기 구조는 한 가지 방식이다.
  branches: (c) =>
    c.branchOnNotEnoughGold ? [{ key: "notEnoughBranch", label: "골드 부족", tone: "danger" as const }] : [],
  summary: (c) => `여관 · ${num(c.price)}G`,
});

// ── 전투 · 시스템 ─────────────────────────────────────────────────

defineCommand({
  kind: "spawnFieldEnemy",
  family: "battle",
  label: "필드 적 생성",
  // FieldSpawnDef 는 위치·종·수량을 함께 다루므로 전용 위젯이 맡는다.
  fields: { spawn: f.custom("스폰 정의", "screenPoint") },
  summary: () => "필드 적 생성",
});

defineCommand({
  kind: "despawnFieldEnemy",
  family: "battle",
  label: "필드 적 제거",
  fields: { spawnId: f.text("스폰 ID") },
  summary: (c) => `필드 적 ${str(c.spawnId) || "(미지정)"} 제거`,
});

defineCommand({
  kind: "openSaveMenu",
  family: "system",
  label: "저장 메뉴",
  fields: {},
  summary: () => "저장 메뉴 열기",
});

defineCommand({
  kind: "triggerEnding",
  family: "system",
  label: "엔딩 트리거",
  fields: { endingId: f.text("엔딩 ID", { optional: true, placeholder: "비우면 조건 만족 최우선 엔딩" }) },
  summary: (c) => (c.endingId ? `엔딩 ${str(c.endingId)} 실행` : "조건 최우선 엔딩 실행"),
});

defineCommand({
  kind: "ending",
  family: "system",
  label: "엔딩",
  fields: {
    title: f.text("제목"),
    message: f.multiline("본문"),
  },
  summary: (c) => `엔딩 「${str(c.title) || "제목 없음"}」`,
});
