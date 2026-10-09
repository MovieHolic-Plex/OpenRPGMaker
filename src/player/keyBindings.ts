// player/keyBindings.ts
// 런타임 키 계약의 단일 정본(single source of truth).
//
// 적대적 리뷰(2026-08-03)에서 필드/대사/선택지/커서메뉴/상태메뉴/전투가 각각
// 다른 확인·취소 키 집합을 들고 있는 게 드러났다(7개 서피스 = 7개 계약).
// 여기서 시맨틱 레이어를 한 벌로 정의하고, 모든 서피스가 이 모듈만 import 한다.
// 새 키를 추가하려면 이 파일만 고친다 — 서피스 로컬 재구현 금지.
//
// 계약(RM2003 관례):
//   결정(confirm) : Z · Enter · Space  (+ 레거시 E)
//   취소(cancel)  : X · Esc
//   메뉴(menu)    : X · Esc  — 필드에서 메뉴 열기/닫기는 취소와 같은 키다
//   이동          : 방향키 · WASD
//   대시(dash)    : Shift
//   공격/스킬     : Space(액션 전투 한정) · Q
//   스킬 슬롯 순환: R  (액션 전투 한정)
//   가드(홀드)    : C  (액션 전투 한정)
//
// 예외로 두는 서피스: 이름 입력(nameEntry)은 문자 타이핑 화면이라 z/x 가 글자다.
// 여기의 confirm/cancel 계약을 적용하지 않는다.

export type Dir = "down" | "left" | "right" | "up";

// event.key 정규화. 브라우저/OS 편차(대소문자, "Spacebar", "Esc")를 한 곳에서 흡수한다.
// 대문자 Z 만 안 먹던 결함(상태 메뉴 CapsLock 먹통)의 단일 수정 지점.
export function normalizeKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower === "spacebar" || lower === "space") return " ";
  if (lower === "esc") return "escape";
  return lower;
}

// 정규화된 키 기준 집합. 외부에서 비교할 때는 반드시 predicate 를 쓴다.
export const CONFIRM_KEYS: ReadonlySet<string> = new Set(["z", "enter", " ", "e"]);
export const CANCEL_KEYS: ReadonlySet<string> = new Set(["x", "escape"]);

export function isConfirmKey(key: string): boolean {
  return CONFIRM_KEYS.has(normalizeKey(key));
}

/** Cinematic advance deliberately excludes the legacy field-interaction E alias. */
export function isCinematicAdvanceKey(key: string): boolean {
  return ["z", "enter", " "].includes(normalizeKey(key));
}

export function isCancelKey(key: string): boolean {
  return CANCEL_KEYS.has(normalizeKey(key));
}

// 필드에서 메뉴를 여는 키. 취소와 동일하다(플레이어가 배우는 규칙을 하나로).
export function isMenuKey(key: string): boolean {
  return isCancelKey(key);
}

export function isDashKey(key: string): boolean {
  return normalizeKey(key) === "shift";
}

export function isSkillKey(key: string): boolean {
  return normalizeKey(key) === "q";
}

// 액션 스킬 슬롯 순환. Q(캐스트) 옆이면서 이동(WASD)·확인(Z/Enter/Space/E)·취소(X/Esc)
// ·대시(Shift)·자동전투(F) 어디와도 겹치지 않는 키를 고른다.
export function isSkillCycleKey(key: string): boolean {
  return normalizeKey(key) === "r";
}

// 액션 전투 선두 교대(동료 켜진 맵). 이동·확인·취소·대시·스킬(Q/R)·가드(C)·자동(F)와 겹치지 않는다.
export function isLeaderSwitchKey(key: string): boolean {
  return normalizeKey(key) === "v";
}

// 홀드 가드(방어). 누르고 있는 동안 피해가 줄고 스태미나가 탄다.
export function isGuardKey(key: string): boolean {
  return normalizeKey(key) === "c";
}

// 액션 전투에서 스윙으로 라우팅되는 키. 확인 키 전체를 공격으로 받는다 —
// Space 만 공격이고 Z 는 조사로 남던 반쪽 라우팅이 결함이었다.
export function isAttackKey(key: string): boolean {
  return isConfirmKey(key);
}

// 전투 자동/배속 토글. 이동 키(WASD)와 겹치지 않는 키만 쓴다.
// 과거엔 A 였는데 WASD 로 걷던 플레이어가 전투에서 좌측 이동을 누르면
// 자동전투가 켜지는 충돌이 있었다(적대 리뷰 11).
export function isAutoBattleKey(key: string): boolean {
  return normalizeKey(key) === "f";
}

export function isSpeedKey(key: string): boolean {
  return isDashKey(key);
}

// ── 손 슬롯(hand slot) ──
// 숫자키 1-9 = 직접 선택, 0 = 빈 손. `[`/`]` = 이전/다음 순환.
// 숫자키는 다른 서피스가 쓰지 않으므로 isRuntimeMenuKey 에 넣지 않는다 —
// 넣으면 필드 밖(대사·모달)에서까지 전역 가로채기 대상이 된다.
export function handSlotDigit(key: string): number | undefined {
  const normalized = normalizeKey(key);
  if (normalized.length !== 1) return undefined;
  const code = normalized.charCodeAt(0);
  if (code < 48 || code > 57) return undefined;
  return code - 48;
}

export function handSlotCycleDelta(key: string): number | undefined {
  const normalized = normalizeKey(key);
  if (normalized === "[") return -1;
  if (normalized === "]") return 1;
  return undefined;
}

export function directionForKey(key: string): Dir | null {
  switch (normalizeKey(key)) {
    case "arrowdown":
    case "s":
      return "down";
    case "arrowleft":
    case "a":
      return "left";
    case "arrowright":
    case "d":
      return "right";
    case "arrowup":
    case "w":
      return "up";
    default:
      return null;
  }
}

/** Shop-only group traversal; do not capture Tab in unrelated runtime menus. */
export function isShopFocusGroupKey(key: string): boolean {
  return normalizeKey(key) === "tab";
}

export function isShopDetailScrollKey(key: string): boolean {
  return isNavKey(key) || ["pageup", "pagedown", "home", "end"].includes(normalizeKey(key));
}

export const SHOP_FOCUS_GROUP_KEY_LABEL = "Tab/Shift+Tab";
export const SHOP_CONFIRM_KEY_LABEL = "E/Z/Enter/Space";
export const SHOP_DETAIL_SCROLL_KEY_LABEL = "방향키/PageUp/PageDown/Home/End";

export function isNavKey(key: string): boolean {
  return directionForKey(key) !== null;
}

// 런타임이 전역에서 가로채는 키(방향 + 확인 + 취소).
export function isRuntimeMenuKey(key: string): boolean {
  return isNavKey(key) || isConfirmKey(key) || isCancelKey(key);
}

// 키 입력을 자기가 다 먹는 플레이 스테이지 내부 서피스. 전역 핸들러는 이게 떠 있으면 물러난다.
// runtime-name-entry 가 반드시 들어있어야 한다: 이름 입력은 숨긴 input 으로 숫자를 받으면서
// preventDefault 를 하지 않으므로, 가드가 없으면 이름에 숫자를 치는 순간 손 슬롯까지 같이 바뀜다.
const INPUT_CAPTURING_TEST_IDS = [
  "dialogue-box",
  "runtime-choices",
  "runtime-input-number",
  "runtime-name-entry",
  "tactics-battle",
] as const;

export const INPUT_CAPTURING_SELECTOR = INPUT_CAPTURING_TEST_IDS.map((id) => `[data-testid='${id}']`).join(", ");

export function isInputCapturingSurfaceActive(root: { querySelector(selector: string): unknown } | null | undefined): boolean {
  return Boolean(root?.querySelector(INPUT_CAPTURING_SELECTOR));
}

// ── 텍스트 입력 컨트롤 ──
// 글자를 받는 컨트롤(텍스트형 input·textarea·select·contentEditable)이 키 이벤트의 대상이면 그 키는
// 게임 입력이 아니다. 편집기 테스트 플레이 창의 런타임 디버그 패널에서 실측(2026-09-03): 숫자 입력창에
// 57 을 치면 손 슬롯 핸들러가 preventDefault 로 삼켜 값이 비었고, 방향키·w 는 캐릭터를 움직였고,
// Escape 는 게임 메뉴를 열었다. 체크박스·라디오·버튼은 글자를 받지 않으므로 게임 키로 둔다 — 여기까지
// 막으면 「타이틀 건너뛰기」 체크박스를 누른 뒤 Space/Enter 가 조용히 씹히는 새 함정이 생긴다.
// 편집기 쪽 같은 규칙: src/editor/hotkeys.ts §isTextEditingElement (출하 번들이 편집기 코드를 끌어오지
// 않도록 여기 따로 둔다).
const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

export function isTextEntryTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as { tagName?: unknown; isContentEditable?: unknown; getAttribute?: unknown; type?: unknown };
  if (typeof element.tagName !== "string") return false;
  const tag = element.tagName.toUpperCase();
  if (tag === "INPUT") {
    const attrType = typeof element.getAttribute === "function" ? (element.getAttribute as (name: string) => string | null)("type") : null;
    const rawType = attrType ?? (typeof element.type === "string" ? element.type : "");
    return !NON_TEXT_INPUT_TYPES.has(String(rawType).toLowerCase());
  }
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (element.isContentEditable === true) return true;
  const editable = typeof element.getAttribute === "function" ? (element.getAttribute as (name: string) => string | null)("contenteditable") : null;
  return editable !== null && editable !== "false";
}

/** 지금 포커스가 텍스트 입력 컨트롤에 있는가 — DOM 이 없는 환경(node 테스트)에서는 false. */
export function isTextEntryFocused(): boolean {
  if (typeof document === "undefined") return false;
  return isTextEntryTarget(document.activeElement);
}
  

// ── 화면 안내 문구 ──
// 타이틀·전투 커맨드·전투 디렉터가 각자 다른 문자열을 띄우던 걸 여기로 모은다.
export const CONFIRM_KEY_LABEL = "Z/Enter/Space";
export const CANCEL_KEY_LABEL = "X/Esc";
export const NAV_KEY_LABEL = "방향키";
export const AUTO_BATTLE_KEY_LABEL = "F";
export const SPEED_KEY_LABEL = "Shift";

export const TITLE_KEY_PROMPT = "방향키로 고르고 Enter로 시작";
export const BATTLE_KEY_PROMPT = `Z\u00a0확인 · X\u00a0취소`;
export const CONTINUE_KEY_PROMPT = `${CONFIRM_KEY_LABEL}로 계속`;

// Authoring and the HUD share this binding-derived copy; it is not NPC dialogue.
const ACTION_GUIDE_KEYS = [
  "arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d",
  "z", "enter", " ", "e", "shift", "c", "q", "r", "x", "escape",
] as const;

export const ACTION_CONTROL_BINDINGS = [
  { id: "move", keys: ACTION_GUIDE_KEYS.filter(isNavKey), label: "이동" },
  { id: "attack", keys: ACTION_GUIDE_KEYS.filter(isAttackKey), label: "대화·조사 / 공격" },
  { id: "dodge", keys: ACTION_GUIDE_KEYS.filter(isDashKey), label: "이동 중 회피" },
  { id: "guard", keys: ACTION_GUIDE_KEYS.filter(isGuardKey), label: "누르고 가드" },
  { id: "skill", keys: ACTION_GUIDE_KEYS.filter(isSkillKey), label: "스킬 사용" },
  { id: "cycle", keys: ACTION_GUIDE_KEYS.filter(isSkillCycleKey), label: "스킬 선택" },
  { id: "menu", keys: ACTION_GUIDE_KEYS.filter(isMenuKey), label: "메뉴·취소" },
] as const;

function actionGuideKeyLabel(key: string): string {
  switch (key) {
    case "arrowup": return "↑";
    case "arrowdown": return "↓";
    case "arrowleft": return "←";
    case "arrowright": return "→";
    case " ": return "Space";
    case "enter": return "Enter";
    case "escape": return "Esc";
    case "shift": return "Shift";
    default: return key.toUpperCase();
  }
}

export const ACTION_CONTROLS_GUIDE = ACTION_CONTROL_BINDINGS.map(
  (binding) => `${binding.keys.map(actionGuideKeyLabel).join("/")} ${binding.label}`,
).join("\n");
