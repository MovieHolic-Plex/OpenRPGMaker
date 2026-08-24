import { describe, expect, it } from "vitest";
import {
  ASSISTANT_TEMPERATURES,
  DEFAULT_ASSISTANT_TEMPERATURE,
  EDITOR_LAYOUT_STORAGE_KEY,
  assistantTemperatureMenuLabel,
  parseAssistantTemperature,
  persistAssistantTemperature,
} from "@/editor/assistantTemperature";

describe("assistantTemperature", () => {
  it("defaults to Quiet Gold and rejects unknown storage", () => {
    expect(DEFAULT_ASSISTANT_TEMPERATURE).toBe("quiet-gold");
    expect(parseAssistantTemperature(undefined)).toBe("quiet-gold");
    expect(parseAssistantTemperature("glass")).toBe("quiet-gold");
    expect(parseAssistantTemperature("quiet-gold")).toBe("quiet-gold");
    expect(parseAssistantTemperature("ink-only")).toBe("ink-only");
    expect(parseAssistantTemperature("map-first")).toBe("map-first");
  });

  it("labels A/B/C for the picker", () => {
    expect(ASSISTANT_TEMPERATURES.map((row) => row.id)).toEqual(["quiet-gold", "ink-only", "map-first"]);
    expect(assistantTemperatureMenuLabel("quiet-gold")).toBe("A 조용한 골드");
    expect(assistantTemperatureMenuLabel("ink-only")).toBe("B 잉크만");
    expect(assistantTemperatureMenuLabel("map-first")).toBe("C 맵 우선");
  });

  it("merges the temperature into the layout JSON next to chatDock", () => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, String(value)),
        removeItem: (key: string) => void storage.delete(key),
      },
    });
    storage.set(EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify({ chatDock: "side", leftWidth: 240 }));

    persistAssistantTemperature("map-first");

    expect(JSON.parse(storage.get(EDITOR_LAYOUT_STORAGE_KEY) ?? "{}")).toMatchObject({
      chatDock: "side",
      leftWidth: 240,
      assistantTemperature: "map-first",
    });
    Reflect.deleteProperty(globalThis, "localStorage");
  });
});
