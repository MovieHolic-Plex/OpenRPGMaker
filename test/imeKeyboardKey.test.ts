import { describe, expect, it } from "vitest";

import { eventKeyCodeFromKeyboardEvent } from "@/player/eventInput";
import { keyboardEventKey, runtimeKeyFromEvent } from "@/player/keyBindings";

describe("IME physical keys", () => {
  it("keeps a normal key and recovers the physical key from an IME Process event", () => {
    expect(keyboardEventKey({ key: "B" })).toBe("B");
    expect(keyboardEventKey({ key: "ArrowLeft" })).toBe("ArrowLeft");
    expect(keyboardEventKey({ key: "Process", code: "KeyW", keyCode: 229 })).toBe("w");
    expect(keyboardEventKey({ key: "Process", code: "Digit1", keyCode: 229 })).toBe("1");
    expect(keyboardEventKey({ key: "Unidentified", code: "Space", keyCode: 229 })).toBe(" ");
    expect(keyboardEventKey({ key: "Process", code: "Enter", keyCode: 229 })).toBe("Enter");
    expect(keyboardEventKey({ key: "Process", keyCode: 229 })).toBe("Process");
  });

  it("does not turn typing or an unmapped composition into a gameplay key", () => {
    const input = { tagName: "INPUT", type: "text", getAttribute: () => "text" };
    expect(runtimeKeyFromEvent({ key: "w", target: input })).toBeNull();
    expect(runtimeKeyFromEvent({ key: "Process", code: "KeyW", keyCode: 229 })).toBe("w");
    expect(runtimeKeyFromEvent({ key: "Process", keyCode: 229 })).toBeNull();
    expect(runtimeKeyFromEvent({ key: "가", isComposing: true })).toBeNull();
    expect(runtimeKeyFromEvent({ key: "z" })).toBe("z");
  });

  it("does not end a key-input wait on a bare IME Process key", () => {
    expect(eventKeyCodeFromKeyboardEvent({ key: "Process", keyCode: 229 })).toBeNull();
    expect(eventKeyCodeFromKeyboardEvent({ key: "Process", code: "KeyZ", keyCode: 229 })).toBe(5);
    expect(eventKeyCodeFromKeyboardEvent({ key: "Process", code: "KeyW", keyCode: 229 })).toBe(4);
    expect(eventKeyCodeFromKeyboardEvent({ key: "z" })).toBe(5);
    expect(eventKeyCodeFromKeyboardEvent({ key: "q" })).toBe(0);
    expect(eventKeyCodeFromKeyboardEvent({ key: "z", repeat: true })).toBeNull();
    expect(eventKeyCodeFromKeyboardEvent({ key: "z", isComposing: true })).toBeNull();
    const input = { tagName: "INPUT", type: "text", getAttribute: () => "text" };
    expect(eventKeyCodeFromKeyboardEvent({ key: "Process", code: "KeyZ", keyCode: 229, target: input })).toBeNull();
  });
});
