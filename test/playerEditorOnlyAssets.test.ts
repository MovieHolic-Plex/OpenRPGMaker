import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PLAYER_EDITOR_ONLY_ASSETS, stripEditorOnlyJson } from "../scripts/lib/playerEditorOnlyAssets.mjs";

const root = resolve(__dirname, "..");

describe("player builds drop editor-only tileset reference documents", () => {
  it.each(Object.entries(PLAYER_EDITOR_ONLY_ASSETS))("%s strips to a same-shaped value (%s)", (file, mode) => {
    const text = readFileSync(resolve(root, file), "utf8");
    const original = JSON.parse(text) as unknown;
    const stripped = JSON.parse(stripEditorOnlyJson(mode, text)) as Record<string, unknown>;
    if (mode === "whole") {
      expect(stripped).toEqual(Array.isArray(original) ? [] : {});
    } else {
      const { referenceDocuments, ...rest } = original as Record<string, unknown>;
      expect(Array.isArray(referenceDocuments), "field mode needs a referenceDocuments array to drop").toBe(true);
      expect(stripped).toEqual({ ...rest, referenceDocuments: [] });
    }
  });
});
