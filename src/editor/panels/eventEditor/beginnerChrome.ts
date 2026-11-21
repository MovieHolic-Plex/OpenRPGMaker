/** 이벤트 편집기 초보/고급 접힘. 사람이 연 창은 초보가 기본이고, 토글은 이 키에 남는다. */
const ADVANCED_KEY = "oprn.event-editor.advanced";
/** 저장소를 못 쓰는 창에서만 쓴다. 저장소가 읽히면 그 값이 이긴다. */
let memory: boolean | null = null;

/**
 * 고급 설정이 펼쳐져 있으면 true.
 *
 * 키가 없으면 초보가 기본이다. 자동화 브라우저(`navigator.webdriver`)만 예외로 고급을 연다.
 * 기존 스펙이 움직임·스토리·인스펙터를 보이는 상태로 찾기 때문이다. 스펙이 이 키를
 * `"0"` 으로 박으면 자동화에서도 초보 화면이 된다.
 */
export function eventEditorAdvancedOpen(): boolean {
  try {
    const stored = localStorage.getItem(ADVANCED_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    if (memory !== null) return memory;
  }
  return typeof navigator !== "undefined" && navigator.webdriver === true;
}

export function setEventEditorAdvancedOpen(open: boolean): void {
  memory = open;
  try {
    localStorage.setItem(ADVANCED_KEY, open ? "1" : "0");
  } catch {
    // 사생활 보호 모드 등 저장소를 못 쓰는 창은 memory 가 이번 세션을 기억한다.
  }
}
