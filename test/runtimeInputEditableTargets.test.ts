/** @vitest-environment happy-dom */
// 편집기 테스트 플레이 창의 런타임 디버그 패널(숫자 입력)에서 실측한 결함 두 가지의 회귀 증거.
//  - 입력창에 포커스를 두고 방향키·w 를 치면 캐릭터가 움직였다(키 누출).
//  - 숫자를 치면 손 슬롯 핸들러가 preventDefault 로 삼켜 값이 비었다(player.ts 쪽 — e2e 가 잠근다).
// 런타임 키 계약(keyBindings)에 「텍스트 입력 컨트롤이 대상이면 게임 키가 아니다」 규칙을 두고
// Input 이 그 규칙을 따르는지 본다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDialogueUI } from "@/player/dialogue";
import type Phaser from "phaser";
import { Input } from "@/player/input";
import { isTextEntryTarget } from "@/player/keyBindings";

const detachInputs: Array<() => void> = [];
afterEach(() => {
  for (const detach of detachInputs.splice(0)) detach();
  vi.useRealTimers();
  document.body.replaceChildren();
});

function keyboardStubScene(cursorState: { right: boolean } = { right: false }): Phaser.Scene {
  const key = (down = false): { isDown: boolean } => ({ isDown: down });
  return {
    input: {
      keyboard: {
        createCursorKeys: () => ({
          up: key(),
          down: key(),
          left: key(),
          get right() {
            return key(cursorState.right);
          },
          space: key(),
          shift: key(),
        }),
        addKeys: () => ({}),
        on: () => undefined,
      },
    },
    events: { once: (_event: string, detach: () => void) => { detachInputs.push(detach); } },
  } as unknown as Phaser.Scene;
}

describe("isTextEntryTarget", () => {
  it("글자를 받는 컨트롤만 텍스트 입력 대상이다", () => {
    const number = document.createElement("input");
    number.type = "number";
    const text = document.createElement("input");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const button = document.createElement("button");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    expect(isTextEntryTarget(number)).toBe(true);
    expect(isTextEntryTarget(text)).toBe(true);
    expect(isTextEntryTarget(textarea)).toBe(true);
    expect(isTextEntryTarget(select)).toBe(true);
    expect(isTextEntryTarget(checkbox)).toBe(false);
    expect(isTextEntryTarget(button)).toBe(false);
    expect(isTextEntryTarget(document.body)).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
    expect(isTextEntryTarget(document)).toBe(false);
    // happy-dom 은 isContentEditable 을 구현하지 않을 수 있다 — 속성으로도 판정한다.
    expect(isTextEntryTarget(editable)).toBe(true);
  });
});

describe("Input 은 텍스트 입력 컨트롤에 친 키를 게임 입력으로 받지 않는다", () => {
  it("숫자 입력창에서 친 방향키는 걸음도 탭도 만들지 않는다", () => {
    const field = document.createElement("input");
    field.type = "number";
    document.body.append(field);
    const input = new Input(keyboardStubScene());
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(input.update()).toMatchObject({ x: 0, y: 0, dir: null });
    field.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true }));
    expect(input.update()).toMatchObject({ x: 0, y: 0 });
    field.remove();
  });

  it("입력창에서 친 확인키는 조사 엣지를 만들지 않는다", () => {
    const field = document.createElement("input");
    document.body.append(field);
    const input = new Input(keyboardStubScene());
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(input.update()).toMatchObject({ actionPressed: false, confirmPressed: false });
    field.remove();
  });

  it("키를 누른 채 입력창으로 들어가 떼면 눌림이 풀린다(keyup 은 어디서 와도 처리한다)", () => {
    const field = document.createElement("input");
    document.body.append(field);
    const input = new Input(keyboardStubScene());
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    expect(input.update()).toMatchObject({ y: -1 });
    field.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowUp", bubbles: true }));
    expect(input.update()).toMatchObject({ y: 0 });
    expect(input.update()).toMatchObject({ y: 0 });
    field.remove();
  });

  it("텍스트 입력창에 포커스가 있으면 Phaser 커서 키 상태도 무시한다", () => {
    const cursorState = { right: true };
    const field = document.createElement("input");
    field.type = "number";
    document.body.append(field);
    const input = new Input(keyboardStubScene(cursorState));
    expect(input.update(), "포커스 없을 때는 Phaser 커서 상태로 걷는다").toMatchObject({ x: 1 });
    field.focus();
    expect(document.activeElement).toBe(field);
    expect(input.update(), "입력창 포커스 중에는 걷지 않는다").toMatchObject({ x: 0, dir: null });
    field.blur();
    expect(input.update()).toMatchObject({ x: 1 });
    field.remove();
  });
});

describe("대사창도 텍스트 입력 컨트롤에 친 키를 받지 않는다", () => {
  it("입력창에서 친 Enter 는 대사를 넘기지 않고, 문서에서 친 Enter 는 넘긴다", async () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const field = document.createElement("input");
    document.body.append(field);
    const dialogue = createDialogueUI(host);
    let resolved = false;
    const shown = dialogue.showText({ body: "A", playerTileY: 0, mapHeight: 10 }).then(() => {
      resolved = true;
    });
    // One page and a controlled clock keep this about event ownership, not typing speed.
    await vi.runAllTimersAsync();
    expect(host.querySelector(".dialogue-box .body")?.textContent).toBe("A");
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await Promise.resolve();
    expect(resolved).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;
    expect(resolved).toBe(true);
    dialogue.close();
    await vi.runAllTimersAsync();
  });
});
