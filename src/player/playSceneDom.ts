import type Phaser from "phaser";
import type { DialogueUI } from "@/player/dialogue";

export function dialogueHost(scene: Phaser.Scene): HTMLElement | undefined {
  const host: unknown = scene.game.registry.get("dialogueHost");
  return host instanceof HTMLElement ? host : undefined;
}

export function dialogueUi(scene: Phaser.Scene): DialogueUI | undefined {
  const value: unknown = scene.game.registry.get("dialogue");
  return isDialogueUi(value) ? value : undefined;
}

function isDialogueUi(value: unknown): value is DialogueUI {
  if (typeof value !== "object" || value === null) return false;
  return (
    typeof Reflect.get(value, "showText") === "function" &&
    typeof Reflect.get(value, "showChoices") === "function" &&
    typeof Reflect.get(value, "showNumberInput") === "function" &&
    typeof Reflect.get(value, "hide") === "function" &&
    // close 는 세션 종료용 퇴장 연출 통로다. 빠진 객체를 통과시키면 이벤트 큐가
    // 끝나는 finally 에서 TypeError 가 난다.
    typeof Reflect.get(value, "close") === "function"
  );
}
