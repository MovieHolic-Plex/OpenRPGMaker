// 이벤트 명령 스키마 카탈로그.
//
// 여기 선언된 명령은 폼·요약문·분기 구조가 전부 이 파일에서 파생된다.
// 미등록 명령은 기존 commandBody*.ts 경로로 그대로 떨어진다 (점진 이행).
//
// 등록 기준: 필드가 12종 어휘로 표현되는 명령. 표현되지 않는 부분은
// f.custom() 으로 전용 위젯에 위임한다 (moveRoute / choiceOptions / condition / shopStock).

import { defineCommand, type BranchSpec } from "./defineCommand";
import { f } from "./fieldTypes";

const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** VariableOperand 를 사람이 읽는 문자열로. */
function operandText(v: unknown, lookup: { variableName: (id: string) => string }): string {
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object" && (v as { kind?: string }).kind === "var") {
    return lookup.variableName(str((v as { id?: unknown }).id));
  }
  return "0";
}

/** SwitchValue 를 사람이 읽는 문자열로. */
function switchValueText(v: unknown, lookup: { variableName: (id: string) => string }): string {
  if (v === true) return "ON";
  if (v === false) return "OFF";
  if (v === "toggle") return "반전";
  if (v && typeof v === "object" && (v as { kind?: string }).kind === "var") {
    return `변수 ${lookup.variableName(str((v as { id?: unknown }).id))}`;
  }
  return "ON";
}

const AMOUNT_OPS = ["=", "+=", "-="] as const;
const VARIABLE_OPS = ["=", "+=", "-=", "*=", "/="] as const;

// ── 대사 · 입력 ───────────────────────────────────────────────────

defineCommand({
  kind: "text",
  family: "dialogue",
  label: "문장",
  fields: {
    speaker: f.text("화자", { optional: true, placeholder: "이름 없이 표시하려면 비워 두세요" }),
    body: f.multiline("본문", { preview: "messageWindow" }),
    autoAdvance: f.bool("키 입력 없이 진행", { optional: true }),
  },
  summary: (c) => str(c.body) || "(빈 문장)",
});

defineCommand({
  kind: "inputNumber",
  family: "dialogue",
  label: "숫자 입력",
  fields: {
    variableId: f.variable("저장할 변수"),
    digits: f.number("자릿수", { min: 1, max: 6 }),
    prompt: f.text("안내 문구", { optional: true, placeholder: "숫자 입력" }),
    showPad: f.bool("키패드 표시", { optional: true }),
  },
  summary: (c, l) => `${l.variableName(str(c.variableId))} ← 숫자 ${num(c.digits, 1)}자리 입력`,
});

defineCommand({
  kind: "enterHeroName",
  family: "actor",
  label: "이름 입력",
  fields: {
    actorId: f.record("대상 주인공", "actor"),
    maxLength: f.number("최대 글자 수", { min: 1, max: 12 }),
    showInitialName: f.bool("기존 이름 채워 두기"),
  },
  summary: (c, l) => `${l.recordName(str(c.actorId))} 이름 입력 (${num(c.maxLength, 6)}자)`,
});

// ── 흐름 · 조건 ───────────────────────────────────────────────────

defineCommand({
  kind: "choices",
  family: "dialogue",
  label: "선택지",
  fields: {
    prompt: f.text("질문", { optional: true }),
    // 선택지 목록은 각 항목이 Command[] 분기를 품는다 — 폼이 아니라 캔버스에서 편집한다.
    options: f.custom("선택지", "choiceOptions"),
    cancelBehavior: f.enum("취소(ESC) 동작", [
      { value: "disallow", label: "무시", key: "disallow" },
      { value: "choice1", label: "1번으로", key: "c1" },
      { value: "choice2", label: "2번으로", key: "c2" },
      { value: "branch", label: "전용 분기", key: "branch" },
    ]),
  },
  summary: (c) => {
    const count = Array.isArray(c.options) ? c.options.length : 0;
    const prompt = str(c.prompt);
    return prompt ? `“${prompt}” · ${count}개 분기` : `선택지 ${count}개`;
  },
});

defineCommand({
  kind: "fork",
  family: "controlFlow",
  label: "분기",
  fields: {
    condition: f.custom("조건", "condition"),
  },
  branches: (c) => {
    const specs: BranchSpec[] = [{ key: "then", label: "조건 만족", tone: "ok" }];
    if (Array.isArray(c.else)) specs.push({ key: "else", label: "그 외", tone: "neutral" });
    return specs;
  },
  summary: () => "조건 분기",
});

defineCommand({
  kind: "loop",
  family: "controlFlow",
  label: "반복",
  fields: {},
  branches: () => [{ key: "body", label: "반복 본문", tone: "neutral" }],
  summary: (c) => `반복 (${Array.isArray(c.body) ? c.body.length : 0}개 명령)`,
});

defineCommand({
  kind: "breakLoop",
  family: "controlFlow",
  label: "반복 중단",
  fields: {},
  summary: () => "반복 중단",
});

defineCommand({
  kind: "wait",
  family: "controlFlow",
  label: "대기",
  fields: {
    ms: f.number("시간", { min: 0, unit: "ms", when: (c) => !c.variableId }),
    variableId: f.variable("변수에서 읽기", { optional: true }),
  },
  summary: (c, l) =>
    c.variableId ? `${l.variableName(str(c.variableId))} ms 대기` : `${num(c.ms)}ms 대기`,
});

defineCommand({
  kind: "label",
  family: "controlFlow",
  label: "라벨",
  fields: { name: f.text("라벨 이름") },
  summary: (c) => `라벨 ${str(c.name)}`,
});

defineCommand({
  kind: "gotoLabel",
  family: "controlFlow",
  label: "라벨로 이동",
  fields: { name: f.text("대상 라벨") },
  summary: (c) => `${str(c.name)} 으로 이동`,
});

// ── 데이터 · 경제 ─────────────────────────────────────────────────

defineCommand({
  kind: "setSwitch",
  family: "state",
  label: "스위치",
  fields: {
    switchId: f.switch("대상 스위치"),
    value: f.enum("값", [
      { value: "true", label: "ON", key: "on" },
      { value: "false", label: "OFF", key: "off" },
      { value: "toggle", label: "반전", key: "toggle" },
    ]),
  },
  summary: (c, l) => `${l.switchName(str(c.switchId))} → ${switchValueText(c.value, l)}`,
});

defineCommand({
  kind: "setVariable",
  family: "state",
  label: "변수",
  fields: {
    variableId: f.variable("대상 변수"),
    op: f.op("연산", VARIABLE_OPS),
    value: f.operand("값"),
  },
  summary: (c, l) => `${l.variableName(str(c.variableId))} ${str(c.op) || "="} ${operandText(c.value, l)}`,
});

defineCommand({
  kind: "changeGold",
  family: "economy",
  label: "소지금",
  fields: {
    op: f.op("연산", AMOUNT_OPS),
    // f.operand 이므로 변수 참조가 보존된다. 기존 changeGoldBody 는 parseInt 로 이를 소실시켰다.
    amount: f.operand("금액", { min: 0 }),
  },
  summary: (c, l) => `소지금 ${str(c.op) || "+="} ${operandText(c.amount, l)}G`,
});

defineCommand({
  kind: "changeItem",
  family: "economy",
  label: "아이템",
  fields: {
    itemId: f.record("아이템", "item"),
    op: f.op("연산", AMOUNT_OPS),
    amount: f.operand("수량", { min: 0 }),
  },
  summary: (c, l) => `${l.recordName(str(c.itemId))} ${str(c.op) || "+="} ${operandText(c.amount, l)}`,
});

defineCommand({
  kind: "changeFriendship",
  family: "social",
  label: "호감도",
  fields: {
    npcKey: f.text("NPC 키", { optional: true, placeholder: "비우면 이 이벤트" }),
    delta: f.number("증감", { unit: "pt" }),
  },
  summary: (c) => `호감도 ${num(c.delta) >= 0 ? "+" : ""}${num(c.delta)}`,
});

defineCommand({
  kind: "getFriendship",
  family: "social",
  label: "호감도 읽기",
  fields: {
    npcKey: f.text("NPC 키", { optional: true }),
    variableId: f.variable("저장할 변수"),
  },
  summary: (c, l) => `호감도 → ${l.variableName(str(c.variableId))}`,
});

defineCommand({
  kind: "setTime",
  family: "time",
  label: "시각 설정",
  fields: {
    hour: f.number("시", { min: 0, max: 23 }),
    minute: f.number("분", { min: 0, max: 59, optional: true }),
  },
  summary: (c) => `${String(num(c.hour)).padStart(2, "0")}:${String(num(c.minute)).padStart(2, "0")} 로 설정`,
});

defineCommand({
  kind: "advanceTime",
  family: "time",
  label: "시간 경과",
  fields: {
    days: f.number("일", { min: 0, optional: true }),
    hours: f.number("시간", { min: 0, optional: true }),
    minutes: f.number("분", { min: 0, optional: true }),
  },
  summary: (c) => {
    const parts: string[] = [];
    if (num(c.days) > 0) parts.push(`${num(c.days)}일`);
    if (num(c.hours) > 0) parts.push(`${num(c.hours)}시간`);
    if (num(c.minutes) > 0) parts.push(`${num(c.minutes)}분`);
    return parts.length ? `${parts.join(" ")} 경과` : "시간 경과 없음";
  },
});

defineCommand({
  kind: "sleepUntilMorning",
  family: "time",
  label: "아침까지 취침",
  fields: {},
  summary: () => "아침까지 취침",
});

defineCommand({
  kind: "advanceCropGrowth",
  family: "time",
  label: "작물 성장",
  fields: { days: f.number("일수", { min: 0 }) },
  summary: (c) => `작물 ${num(c.days)}일 성장`,
});

// ── 맵 · 캐릭터 ───────────────────────────────────────────────────

defineCommand({
  kind: "transfer",
  family: "map",
  label: "장소 이동",
  fields: {
    mapId: f.record("대상 맵", "map"),
    // RM2003 은 x·y 를 별개 필드로 둘 수밖에 없었다. 좌표를 한 덩어리로 선언하면
    // 미니맵 위젯을 붙일 수 있다 — 종속을 끊었을 때 생기는 여지.
    at: f.mapPoint("도착 지점", "mapId"),
    direction: f.enum("도착 방향", [
      { value: "retain", label: "유지", key: "retain" },
      { value: "up", label: "↑", key: "up" },
      { value: "down", label: "↓", key: "down" },
      { value: "left", label: "←", key: "left" },
      { value: "right", label: "→", key: "right" },
    ]),
    fade: f.enum("페이드", [
      { value: "black", label: "검정", key: "black" },
      { value: "white", label: "흰색", key: "white" },
      { value: "none", label: "없음", key: "none" },
    ]),
    transition: f.enum("전환 연출", [
      { value: "fade", label: "페이드", key: "fade" },
      { value: "mosaic", label: "모자이크", key: "mosaic" },
      { value: "blinds", label: "블라인드", key: "blinds" },
    ]),
  },
  summary: (c, l) => `${l.recordName(str(c.mapId))} (${num(c.x)}, ${num(c.y)})`,
});

defineCommand({
  kind: "moveEvent",
  family: "map",
  label: "이동 경로",
  fields: {
    eventId: f.record("대상 이벤트", "event"),
    // 이동 경로는 커맨드 시퀀스다 — 폼으로 표현되지 않는 대표 케이스.
    route: f.custom("경로", "moveRoute"),
  },
  summary: (c, l) => {
    const route = c.route as { commands?: unknown[] } | undefined;
    const steps = Array.isArray(route?.commands) ? route.commands.length : 0;
    return `${l.recordName(str(c.eventId))} · ${steps}단계`;
  },
});

defineCommand({
  kind: "setEventGraphicPattern",
  family: "map",
  label: "이벤트 그래픽",
  fields: {
    eventId: f.record("대상 이벤트", "event"),
    pattern: f.number("패턴", { min: 0, max: 7 }),
  },
  summary: (c, l) => `${l.recordName(str(c.eventId))} 패턴 ${num(c.pattern)}`,
});

defineCommand({
  kind: "callCommonEvent",
  family: "map",
  label: "공통 이벤트 호출",
  fields: { commonEventId: f.record("공통 이벤트", "commonEvent") },
  summary: (c, l) => `${l.recordName(str(c.commonEventId))} 호출`,
});

defineCommand({
  kind: "callMapEvent",
  family: "map",
  label: "맵 이벤트 호출",
  fields: { eventId: f.record("대상 이벤트", "event") },
  summary: (c, l) => `${l.recordName(str(c.eventId))} 호출`,
});

defineCommand({
  kind: "changeParty",
  family: "actor",
  label: "파티 편성",
  fields: {
    actorId: f.record("대상 주인공", "actor"),
    action: f.enum("동작", [
      { value: "add", label: "합류", key: "add" },
      { value: "remove", label: "이탈", key: "remove" },
    ]),
  },
  summary: (c, l) => `${l.recordName(str(c.actorId))} ${c.action === "remove" ? "이탈" : "합류"}`,
});

defineCommand({
  kind: "changeExp",
  family: "actor",
  label: "경험치",
  fields: {
    actorId: f.record("대상 주인공", "actor"),
    op: f.op("연산", AMOUNT_OPS),
    amount: f.operand("경험치", { min: 0 }),
  },
  summary: (c, l) => `${l.recordName(str(c.actorId))} EXP ${str(c.op) || "+="} ${operandText(c.amount, l)}`,
});

defineCommand({
  kind: "changeLevel",
  family: "actor",
  label: "레벨",
  fields: {
    actorId: f.record("대상 주인공", "actor"),
    op: f.op("연산", AMOUNT_OPS),
    amount: f.number("레벨", { min: 0 }),
  },
  summary: (c, l) => `${l.recordName(str(c.actorId))} Lv ${str(c.op) || "+="} ${num(c.amount)}`,
});

defineCommand({
  kind: "changeActorHp",
  family: "actor",
  label: "HP",
  fields: {
    actorId: f.record("대상 주인공", "actor"),
    op: f.op("연산", AMOUNT_OPS),
    amount: f.number("값", { min: 0 }),
    amountMode: f.enum("단위", [
      { value: "flat", label: "고정", key: "flat" },
      { value: "percent", label: "%", key: "percent" },
    ]),
  },
  summary: (c, l) =>
    `${l.recordName(str(c.actorId))} HP ${str(c.op) || "+="} ${num(c.amount)}${c.amountMode === "percent" ? "%" : ""}`,
});

defineCommand({
  kind: "changeActorMp",
  family: "actor",
  label: "MP",
  fields: {
    actorId: f.record("대상 주인공", "actor"),
    op: f.op("연산", AMOUNT_OPS),
    amount: f.number("값", { min: 0 }),
    amountMode: f.enum("단위", [
      { value: "flat", label: "고정", key: "flat" },
      { value: "percent", label: "%", key: "percent" },
    ]),
  },
  summary: (c, l) =>
    `${l.recordName(str(c.actorId))} MP ${str(c.op) || "+="} ${num(c.amount)}${c.amountMode === "percent" ? "%" : ""}`,
});

defineCommand({
  kind: "recoverAll",
  family: "actor",
  label: "전체 회복",
  fields: { actorId: f.record("대상", "actor", { allowEmpty: true, optional: true }) },
  summary: (c, l) => (c.actorId ? `${l.recordName(str(c.actorId))} 전체 회복` : "파티 전체 회복"),
});

defineCommand({
  kind: "learnSkill",
  family: "actor",
  label: "스킬",
  fields: {
    actorId: f.record("대상 주인공", "actor"),
    skillId: f.record("스킬", "skill"),
    action: f.enum("동작", [
      { value: "learn", label: "습득", key: "learn" },
      { value: "forget", label: "망각", key: "forget" },
    ]),
  },
  summary: (c, l) =>
    `${l.recordName(str(c.actorId))} ${l.recordName(str(c.skillId))} ${c.action === "forget" ? "망각" : "습득"}`,
});

defineCommand({
  kind: "changeEquipment",
  family: "actor",
  label: "장비",
  fields: {
    actorId: f.record("대상 주인공", "actor"),
    slot: f.enum("부위", [
      { value: "weapon", label: "무기", key: "weapon" },
      { value: "shield", label: "방패", key: "shield" },
      { value: "armor", label: "갑옷", key: "armor" },
      { value: "helmet", label: "투구", key: "helmet" },
      { value: "accessory", label: "장신구", key: "accessory" },
    ]),
    equipmentId: f.record("장비", "equipment"),
  },
  summary: (c, l) => `${l.recordName(str(c.actorId))} ← ${l.recordName(str(c.equipmentId))}`,
});

defineCommand({
  kind: "giveMonster",
  family: "monster",
  label: "몬스터 지급",
  fields: {
    speciesId: f.record("종", "monsterSpecies"),
    level: f.number("레벨", { min: 1 }),
    nickname: f.text("별명", { optional: true }),
  },
  summary: (c, l) => `${l.recordName(str(c.speciesId))} Lv${num(c.level, 1)} 지급`,
});

defineCommand({
  kind: "moveMonster",
  family: "monster",
  label: "몬스터 이동",
  fields: {
    instanceId: f.text("개체 ID"),
    to: f.enum("이동처", [
      { value: "party", label: "파티", key: "party" },
      { value: "box", label: "보관함", key: "box" },
    ]),
  },
  summary: (c) => `몬스터 → ${c.to === "box" ? "보관함" : "파티"}`,
});

// ── 연출 · 미디어 ─────────────────────────────────────────────────

defineCommand({
  kind: "showPicture",
  family: "media",
  label: "그림 표시",
  fields: {
    pictureId: f.text("그림 번호"),
    resourceId: f.record("이미지", "image"),
    at: f.custom("위치", "screenPoint"),
    scale: f.range("배율", 10, 400, { unit: "%", optional: true }),
    opacity: f.range("불투명도", 0, 100, { unit: "%", optional: true }),
    durationMs: f.number("전환 시간", { min: 0, unit: "ms", optional: true }),
    waitForPicture: f.bool("완료까지 대기", { optional: true }),
  },
  summary: (c, l) => `${l.recordName(str(c.resourceId))} 표시`,
});

defineCommand({
  kind: "erasePicture",
  family: "media",
  label: "그림 삭제",
  fields: { pictureId: f.text("그림 번호") },
  summary: (c) => `그림 ${str(c.pictureId)} 삭제`,
});

defineCommand({
  kind: "playAudio",
  family: "media",
  label: "소리 재생",
  fields: {
    resourceId: f.record("리소스", "audio"),
    loop: f.bool("반복 재생"),
  },
  summary: (c, l) => `${l.recordName(str(c.resourceId))}${c.loop ? " (반복)" : ""}`,
});

defineCommand({
  kind: "stopAudio",
  family: "media",
  label: "소리 정지",
  fields: {},
  summary: () => "재생 중인 오디오 정지",
});

defineCommand({
  kind: "setWeather",
  family: "atmosphere",
  label: "날씨",
  fields: {
    weather: f.enum("종류", [
      { value: "none", label: "맑음", key: "none" },
      { value: "rain", label: "비", key: "rain" },
      { value: "storm", label: "폭풍", key: "storm" },
      { value: "snow", label: "눈", key: "snow" },
      { value: "fog", label: "안개", key: "fog" },
    ]),
    intensity: f.range("세기", 0, 100, { unit: "%", optional: true }),
    transitionMs: f.number("전환 시간", { min: 0, unit: "ms", optional: true }),
  },
  summary: (c) => {
    const names: Record<string, string> = { none: "맑음", rain: "비", storm: "폭풍", snow: "눈", fog: "안개" };
    return `날씨 → ${names[str(c.weather)] ?? "맑음"}`;
  },
});

defineCommand({
  kind: "setLighting",
  family: "atmosphere",
  label: "조명",
  fields: {
    ambient: f.range("환경광", 0, 100, { unit: "%" }),
    color: f.text("색상", { optional: true, placeholder: "#204060" }),
    transitionMs: f.number("전환 시간", { min: 0, unit: "ms", optional: true }),
  },
  summary: (c) => `환경광 ${num(c.ambient)}%`,
});

defineCommand({
  kind: "showAnimation",
  family: "atmosphere",
  label: "애니메이션",
  fields: {
    animationId: f.record("애니메이션", "animation"),
    wait: f.bool("완료까지 대기", { optional: true }),
  },
  summary: (c, l) => `${l.recordName(str(c.animationId))} 재생`,
});

defineCommand({
  kind: "cutsceneControl",
  family: "atmosphere",
  label: "컷신 제어",
  fields: {
    mode: f.enum("동작", [
      { value: "begin", label: "시작", key: "begin" },
      { value: "end", label: "종료", key: "end" },
    ]),
    skippable: f.bool("건너뛰기 허용", { optional: true, when: (c) => c.mode === "begin" }),
  },
  summary: (c) => `컷신 ${c.mode === "end" ? "종료" : "시작"}`,
});

// ── 전투 · 시스템 ─────────────────────────────────────────────────

defineCommand({
  kind: "battleProcessing",
  family: "battle",
  label: "전투 처리",
  fields: {
    troopSource: f.enum("적 지정 방식", [
      { value: "fixed", label: "고정", key: "fixed" },
      { value: "variable", label: "변수 참조", key: "variable" },
    ]),
    // when 이 필드를 조건부로 교체한다 — 두 필드가 동시에 보이는 일이 없다.
    troopId: f.record("적 그룹", "troop", { when: (c) => c.troopSource !== "variable" }),
    troopVariableId: f.variable("적 그룹 변수", { when: (c) => c.troopSource === "variable" }),
    canEscape: f.bool("도주 허용"),
    canLose: f.bool("패배 허용"),
    battleFlow: f.enum("전투 흐름", [
      { value: "gauge", label: "게이지", key: "gauge" },
      { value: "strict", label: "엄격", key: "strict" },
    ]),
    branchOnResult: f.bool("결과로 분기"),
  },
  // 분기도 선언이다 — 토글을 켜면 캔버스에 3분기가 즉시 생긴다.
  branches: (c) =>
    c.branchOnResult
      ? [
          { key: "victoryBranch", label: "승리", tone: "ok" as const },
          { key: "defeatBranch", label: "패배", tone: "danger" as const },
          { key: "escapeBranch", label: "도주", tone: "warn" as const },
        ]
      : [],
  summary: (c, l) => {
    const target =
      c.troopSource === "variable"
        ? `변수 ${l.variableName(str(c.troopVariableId))}`
        : l.recordName(str(c.troopId));
    return `${target} 전투${c.branchOnResult ? " · 3분기" : ""}`;
  },
});

defineCommand({
  kind: "promoteActor",
  family: "actor",
  label: "전직",
  fields: {
    actorId: f.record("대상 주인공", "actor"),
    toClassId: f.text("대상 직업", { optional: true }),
  },
  branches: (c) => {
    const specs: { key: string; label: string; tone: "ok" | "danger" }[] = [];
    if (Array.isArray(c.successBranch)) specs.push({ key: "successBranch", label: "성공", tone: "ok" });
    if (Array.isArray(c.failureBranch)) specs.push({ key: "failureBranch", label: "실패", tone: "danger" });
    return specs;
  },
  summary: (c, l) => `${l.recordName(str(c.actorId))} 전직`,
});

defineCommand({
  kind: "evolveMonster",
  family: "monster",
  label: "몬스터 진화",
  fields: {
    instanceId: f.text("개체 ID"),
    toSpeciesId: f.record("진화 대상", "monsterSpecies", { optional: true, allowEmpty: true }),
  },
  branches: (c) => {
    const specs: { key: string; label: string; tone: "ok" | "danger" }[] = [];
    if (Array.isArray(c.successBranch)) specs.push({ key: "successBranch", label: "성공", tone: "ok" });
    if (Array.isArray(c.failureBranch)) specs.push({ key: "failureBranch", label: "실패", tone: "danger" });
    return specs;
  },
  summary: () => "몬스터 진화",
});

defineCommand({
  kind: "checkpointSave",
  family: "system",
  label: "체크포인트",
  fields: {},
  summary: () => "체크포인트 저장",
});

defineCommand({
  kind: "gameOver",
  family: "system",
  label: "게임 오버",
  fields: {},
  summary: () => "게임 오버",
});

defineCommand({
  kind: "returnToTitle",
  family: "system",
  label: "타이틀로",
  fields: {},
  summary: () => "타이틀 화면으로",
});

defineCommand({
  kind: "killPlayer",
  family: "system",
  label: "즉사",
  fields: {},
  summary: () => "파티 전멸",
});
