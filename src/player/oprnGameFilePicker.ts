import { PRODUCT_BRAND } from "@/brand";
import type { Project } from "@/project/types";
import { RPGZZU_EXTENSION } from "@/project/package";
import {
  isOprnGameFile,
  OPRN_GAME_FILE_ACCEPT,
  pickOprnGameFile,
  readOprnGameFile,
} from "./oprnGameFile";

export interface OprnGameFilePickerOptions {
  readonly reason?: string;
  readonly onOpen: (project: Project) => void;
}

export function renderOprnGameFilePicker(root: HTMLElement, options: OprnGameFilePickerOptions): void {
  root.textContent = "";
  const panel = document.createElement("section");
  panel.className = "oprn-game-file-picker";
  panel.dataset.playInputOwner = "game-file-open";
  panel.dataset.testid = "oprn-game-file-picker";

  const heading = document.createElement("h1");
  heading.className = "oprn-game-file-picker-title";
  heading.textContent = `${PRODUCT_BRAND} — 게임 파일 열기`;

  const help = document.createElement("p");
  help.className = "oprn-game-file-picker-help";
  help.textContent = `${RPGZZU_EXTENSION} 게임 파일 하나를 이 창에 끌어다 놓거나 아래에서 고르세요.`;

  const status = document.createElement("p");
  status.className = "oprn-game-file-picker-status";
  status.dataset.testid = "oprn-game-file-picker-status";
  status.textContent = options.reason ?? "";

  const input = document.createElement("input");
  input.type = "file";
  input.accept = OPRN_GAME_FILE_ACCEPT;
  input.className = "oprn-game-file-picker-input";
  input.dataset.testid = "oprn-game-file-picker-input";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "oprn-game-file-picker-button";
  button.dataset.testid = "oprn-game-file-picker-button";
  button.textContent = "게임 파일 고르기";
  button.addEventListener("click", () => input.click());

  panel.append(heading, help, button, input, status);
  root.append(panel);

  let busy = false;
  const open = async (file: File): Promise<void> => {
    if (busy) return;
    busy = true;
    button.disabled = true;
    status.textContent = `${file.name} 를 읽는 중...`;
    const read = await readOprnGameFile(file);
    busy = false;
    button.disabled = false;
    if (!read.ok) {
      status.textContent = read.message;
      return;
    }
    options.onOpen(read.project);
  };

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!isOprnGameFile(file)) {
      status.textContent = `${RPGZZU_EXTENSION} 게임 파일이 아닙니다: ${file.name}`;
      return;
    }
    void open(file);
  });

  panel.addEventListener("dragover", (event) => {
    event.preventDefault();
    panel.dataset.dropActive = "true";
  });
  panel.addEventListener("dragleave", () => {
    delete panel.dataset.dropActive;
  });
  panel.addEventListener("drop", (event) => {
    event.preventDefault();
    delete panel.dataset.dropActive;
    const dropped = Array.from(event.dataTransfer?.files ?? []);
    const file = pickOprnGameFile(dropped);
    if (!file) {
      status.textContent = `${RPGZZU_EXTENSION} 게임 파일을 찾지 못했습니다.`;
      return;
    }
    void open(file);
  });
}
