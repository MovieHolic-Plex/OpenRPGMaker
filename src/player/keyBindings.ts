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

export function isNavKey(key: string): boolean {
  return directionForKey(key) !== null;
}

// 런타임이 전역에서 가로채는 키(방향 + 확인 + 취소).
export function isRuntimeMenuKey(key: string): boolean {
  return isNavKey(key) || isConfirmKey(key) || isCancelKey(key);
}

// ── 화면 안내 문구 ──
// 타이틀·전투 커맨드·전투 디렉터가 각자 다른 문자열을 띄우던 걸 여기로 모은다.
export const CONFIRM_KEY_LABEL = "Z/Enter/Space";
export const CANCEL_KEY_LABEL = "X/Esc";
export const NAV_KEY_LABEL = "방향키";
export const AUTO_BATTLE_KEY_LABEL = "F";
export const SPEED_KEY_LABEL = "Shift";

export const TITLE_KEY_PROMPT = `↑↓ 이동   ${CONFIRM_KEY_LABEL}·클릭 결정   ${CANCEL_KEY_LABEL} 취소`;
export const BATTLE_KEY_PROMPT = `${NAV_KEY_LABEL} 선택 · ${CONFIRM_KEY_LABEL} 확인 · ${CANCEL_KEY_LABEL} 취소 · ${AUTO_BATTLE_KEY_LABEL} 자동 · ${SPEED_KEY_LABEL} 배속`;
export const CONTINUE_KEY_PROMPT = `${CONFIRM_KEY_LABEL} 로 계속`;
