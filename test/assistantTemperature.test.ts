import { describe, expect, it } from "vitest";
import {
  ASSISTANT_TEMPERATURES,
  DEFAULT_ASSISTANT_TEMPERATURE,
  assistantTemperatureMenuLabel,
  parseAssistantTemperature,
  persistAssistantTemperature,
} from "@/editor/assistantTemperature";

describe("assistant temperature copy", () => {
  it("uses concrete idle-screen names instead of internal art-direction names", () => {
    // Break: the menu exposed "조용한 골드 / 잉크만 / 맵 우선" and A/B/C codes.
    expect(DEFAULT_ASSISTANT_TEMPERATURE).toBe("quiet-gold");
    expect(ASSISTANT_TEMPERATURES.map((item) => item.label)).toEqual([
      "추천 함께 보기",
      "조수만 보기",
      "입력창만 보기",
    ]);
    expect(ASSISTANT_TEMPERATURES.map((item) => item.icon)).toEqual(["✦", "◫", "⌨"]);
    expect(ASSISTANT_TEMPERATURES.map((item) => assistantTemperatureMenuLabel(item.id))).not.toEqual(
      expect.arrayContaining([expect.stringContaining("골드"), expect.stringContaining("잉크"), expect.stringContaining("맵 우선")]),
    );
  });

  it("keeps stored ids compatible and merges the choice into the editor layout", () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => void values.set(key, String(value)),
      },
    });
    // 같이 저장된 다른 키를 지우지 않는다는 것이 요점이다(구 `chatDock` 자리).
    values.set("oprn:editor-layout:v4", JSON.stringify({ mapTreeHeight: 220, leftWidth: 320 }));

    expect(parseAssistantTemperature("ink-only")).toBe("ink-only");
    expect(parseAssistantTemperature("unknown")).toBe("quiet-gold");
    persistAssistantTemperature("map-first");

    expect(JSON.parse(values.get("oprn:editor-layout:v4") ?? "{}")).toEqual({
      mapTreeHeight: 220,
      leftWidth: 320,
      assistantTemperature: "map-first",
    });
    Reflect.deleteProperty(globalThis, "localStorage");
  });
});
