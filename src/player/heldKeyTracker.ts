// 명작 공백 #1(2026-09-27) — Key Poll(m2-219)이 읽는 「지금 눌린 키」.
//
// 씬의 이동 입력은 이벤트가 돌 때 멈추지만, 미니게임(병렬 이벤트)은 바로 그때 키를 읽어야 한다.
// 그래서 문서 keydown/keyup 을 따로 듣는 가벼운 추적기를 둔다. 텍스트 입력칸에 친 키는 세지 않는다.
import { isTextEntryTarget } from "@/player/keyBindings";

const held = new Set<string>();
let installed = false;

function normalize(event: KeyboardEvent): string | undefined {
  switch (event.key) {
    case "ArrowUp": case "w": case "W": return "up";
    case "ArrowDown": case "s": case "S": return "down";
    case "ArrowLeft": case "a": case "A": return "left";
    case "ArrowRight": case "d": case "D": return "right";
    case "z": case "Z": case "Enter": case " ": return "confirm";
    case "x": case "X": case "Escape": return "cancel";
    case "Shift": return "dash";
    default: return undefined;
  }
}

export function installHeldKeyTracker(target: Document = document): void {
  if (installed) return;
  installed = true;
  target.addEventListener("keydown", (event) => {
    if (isTextEntryTarget(event.target)) return;
    const key = normalize(event);
    if (key) held.add(key);
  }, true);
  target.addEventListener("keyup", (event) => {
    const key = normalize(event);
    if (key) held.delete(key);
  }, true);
  window.addEventListener("blur", () => held.clear());
}

/** 방향은 마지막이 아니라 고정 우선순위(위·아래·왼·오)로 하나만 — RM 넘버패드 코드. */
export function heldInputSnapshot(): { dir: number; confirm: boolean; cancel: boolean; dash: boolean } {
  const dir = held.has("up") ? 8 : held.has("down") ? 2 : held.has("left") ? 4 : held.has("right") ? 6 : 0;
  return { dir, confirm: held.has("confirm"), cancel: held.has("cancel"), dash: held.has("dash") };
}

/** 테스트용. */
export function setHeldKeysForTest(keys: readonly string[]): void {
  held.clear();
  for (const key of keys) held.add(key);
}
