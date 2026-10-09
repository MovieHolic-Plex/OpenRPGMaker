import type Phaser from "phaser";
import type { DialogueUI } from "@/player/dialogue";
import type { PlayScene } from "@/player/PlayScene";

export function isPlayScene(scene: Phaser.Scene): scene is PlayScene {
  if (typeof scene !== "object" || scene === null) return false;
  return (
    typeof Reflect.get(scene, "applySession") === "function" &&
    typeof Reflect.get(scene, "getSession") === "function"
  );
}

export function isDialogue(value: unknown): value is DialogueUI {
  if (typeof value !== "object" || value === null) return false;
  return (
    typeof Reflect.get(value, "showText") === "function" &&
    typeof Reflect.get(value, "showChoices") === "function" &&
    typeof Reflect.get(value, "hide") === "function" &&
    typeof Reflect.get(value, "close") === "function"
  );
}
