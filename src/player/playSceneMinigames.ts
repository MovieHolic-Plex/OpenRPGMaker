// 명작 공백 #1·#24(2026-09-27) — 제한시간 선택지·퀵타임 입력·순간이동 메뉴의 플레이어 표면.
//
// 제한시간 선택지는 기존 선택지 창을 그대로 쓰고 AbortSignal 로 시간이 다 되면 닫는다(결과 0).
// QTE 는 화면 가운데 작은 오버레이에 누를 키를 보이고, 키마다 windowMs 안에 맞는 키를 눌러야 한다.
// 순간이동 메뉴는 선택지 + transfer 다.
import { el } from "@/util/dom";
import { store } from "@/project/store";
import { dialogueHost, dialogueUi } from "@/player/playSceneDom";
import { judgeQuickTime, type QuickTimeStep, type TeleportMenuStep, type TimedChoiceStep } from "@/player/interpreter/minigameCommands";
import { DEFAULT_MESSAGE_WINDOW_SETTINGS } from "@/project/session";
import type { PlaySceneContext } from "@/player/playSceneTypes";

const QTE_KEY_LABELS: Record<string, string> = { up: "↑", down: "↓", left: "←", right: "→", z: "Z", x: "X" };

function keyName(event: KeyboardEvent): string | undefined {
  switch (event.key) {
    case "ArrowUp": case "w": case "W": return "up";
    case "ArrowDown": case "s": case "S": return "down";
    case "ArrowLeft": case "a": case "A": return "left";
    case "ArrowRight": case "d": case "D": return "right";
    case "z": case "Z": case "Enter": case " ": return "z";
    case "x": case "X": case "Escape": return "x";
    default: return undefined;
  }
}

/** 1부터 고른 번호, 시간 초과 0. */
export async function playTimedChoice(scene: PlaySceneContext, step: TimedChoiceStep): Promise<number> {
  const dialogue = dialogueUi(scene);
  const host = dialogueHost(scene);
  if (!dialogue || !host) return 0;
  const abort = new AbortController();
  const bar = el("div", { class: "timed-choice-bar", dataset: { testid: "runtime-timed-choice-bar" } });
  const fill = el("div", { class: "timed-choice-bar-fill" });
  bar.append(fill);
  host.append(bar);
  fill.animate?.([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: step.timeLimitMs, easing: "linear", fill: "forwards" });
  const timer = setTimeout(() => abort.abort(), step.timeLimitMs);
  try {
    const index = await dialogue.showChoices({
      prompt: step.prompt,
      options: step.options.map((text) => ({ text })),
      settings: DEFAULT_MESSAGE_WINDOW_SETTINGS,
      cancelBehavior: "disallow",
      textContext: { session: scene.session, project: store.getCurrent() },
      playerTileY: scene.tileY,
      mapHeight: scene.map.height,
      signal: abort.signal,
    });
    return index >= 0 ? index + 1 : 0;
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") return 0;
    throw error;
  } finally {
    clearTimeout(timer);
    bar.remove();
    dialogue.hide();
  }
}

/** sequence: 성공 1·실패 0. mash: 누른 횟수. */
export function playQuickTimeEvent(scene: PlaySceneContext, step: QuickTimeStep): Promise<number> {
  const host = dialogueHost(scene);
  if (!host) return Promise.resolve(0);
  return new Promise<number>((resolve) => {
    const overlay = el("div", { class: "qte-overlay", dataset: { testid: "runtime-qte", qteMode: step.mode } });
    const keysRow = el("div", { class: "qte-keys" });
    const meter = el("div", { class: "qte-meter" });
    const meterFill = el("div", { class: "qte-meter-fill" });
    meter.append(meterFill);
    const pressed: string[] = [];
    const cells = step.keys.map((key) => el("span", { class: "qte-key", text: QTE_KEY_LABELS[key] ?? key }));
    if (step.mode === "sequence") keysRow.append(...cells);
    else keysRow.append(el("span", { class: "qte-key qte-mash", text: `${QTE_KEY_LABELS[step.keys[0]!] ?? step.keys[0]} 연타!` }));
    const counter = el("div", { class: "qte-count", dataset: { testid: "runtime-qte-count" } });
    overlay.append(keysRow, meter, counter);
    host.append(overlay);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      resolve(judgeQuickTime(step, pressed));
    };
    const armWindow = (): void => {
      if (timer) clearTimeout(timer);
      meterFill.getAnimations?.().forEach((animation) => animation.cancel());
      meterFill.animate?.([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: step.windowMs, easing: "linear", fill: "forwards" });
      timer = setTimeout(finish, step.windowMs);
    };
    const onKey = (event: KeyboardEvent): void => {
      const key = keyName(event);
      if (!key || event.repeat) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      pressed.push(key);
      if (step.mode === "mash") {
        counter.textContent = String(pressed.length);
        return;
      }
      const index = pressed.length - 1;
      const ok = step.keys[index] === key;
      cells[index]?.classList.add(ok ? "qte-key-hit" : "qte-key-miss");
      if (!ok || pressed.length >= step.keys.length) {
        finish();
        return;
      }
      armWindow();
    };
    document.addEventListener("keydown", onKey, true);
    armWindow();
  });
}

/** 고른 번호(1부터), 취소·후보 없음 0. 실제 이동은 resume 가 transfer 명령으로 한다. */
export async function playTeleportMenu(scene: PlaySceneContext, step: TeleportMenuStep): Promise<number> {
  const dialogue = dialogueUi(scene);
  if (!dialogue || step.entries.length === 0) return 0;
  const index = await dialogue.showChoices({
    prompt: step.prompt,
    options: [...step.entries.map((entry) => ({ text: entry.label })), { text: "그만두기" }],
    settings: DEFAULT_MESSAGE_WINDOW_SETTINGS,
    cancelBehavior: "branch",
    textContext: { session: scene.session, project: store.getCurrent() },
    playerTileY: scene.tileY,
    mapHeight: scene.map.height,
  });
  dialogue.hide();
  return index >= 0 && step.entries[index] ? index + 1 : 0;
}
