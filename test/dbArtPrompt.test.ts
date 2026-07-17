import { describe, expect, it } from "vitest";
import {
  DB_ART_MAGENTA_HEX,
  DB_ART_PROMPT_NEGATIVES,
  buildDbArtPrompt,
} from "../scripts/lib/dbArtPrompt";
import { applyMagentaChromaKeyToRgba, MAGENTA_RGB } from "../scripts/lib/magentaChromaPostprocess";

const REQUIRED_NEGATIVES = [
  "no text",
  "no UI",
  "no logo",
  "no watermark",
  "no franchise",
  "no photorealism",
  "single subject",
  "16-bit JRPG",
  "pure magenta chroma key",
  "#FF00FF",
] as const;

describe("buildDbArtPrompt", () => {
  it("includes magenta chroma-key contract and required negatives for icon prompts", () => {
    const prompt = buildDbArtPrompt({
      kind: "icon",
      name: "iron sword",
      subject: "a simple iron short sword",
    });

    for (const phrase of REQUIRED_NEGATIVES) {
      expect(prompt.toLowerCase()).toContain(phrase.toLowerCase());
    }
    for (const phrase of DB_ART_PROMPT_NEGATIVES) {
      expect(prompt.toLowerCase()).toContain(phrase.toLowerCase());
    }
    expect(prompt).toContain(DB_ART_MAGENTA_HEX);
  });

  it("includes magenta chroma-key contract for monster prompts", () => {
    const prompt = buildDbArtPrompt({
      kind: "monster",
      name: "cave bat",
      subject: "a small angular cave bat",
    });

    for (const phrase of REQUIRED_NEGATIVES) {
      expect(prompt.toLowerCase()).toContain(phrase.toLowerCase());
    }
    expect(prompt).toContain(DB_ART_MAGENTA_HEX);
  });

  it("uses different kind-specific framing for icon vs monster", () => {
    const icon = buildDbArtPrompt({
      kind: "icon",
      name: "red potion",
      subject: "a corked red healing potion bottle",
    });
    const monster = buildDbArtPrompt({
      kind: "monster",
      name: "red potion",
      subject: "a corked red healing potion bottle",
    });

    expect(icon).not.toBe(monster);
    expect(icon.toLowerCase()).toMatch(/inventory item icon|item\/equipment icon/);
    expect(monster.toLowerCase()).toMatch(/monster battler|full-body single creature/);
    expect(icon.toLowerCase()).not.toMatch(/monster battler|full-body single creature/);
    expect(monster.toLowerCase()).not.toMatch(/inventory item icon|item\/equipment icon/);
  });

  it("embeds name, subject, and optional tags without network side effects", () => {
    const prompt = buildDbArtPrompt({
      kind: "icon",
      name: "oak shield",
      subject: "a round oak shield with brass rim",
      tags: ["equipment", "defense"],
    });

    expect(prompt).toContain("oak shield");
    expect(prompt).toContain("a round oak shield with brass rim");
    expect(prompt).toContain("equipment");
    expect(prompt).toContain("defense");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(40);
  });
});

describe("applyMagentaChromaKeyToRgba", () => {
  it("keys pure magenta and corner-connected white background to alpha 0", () => {
    const w = 4;
    const h = 4;
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i += 1) {
      const o = i * 4;
      data[o] = 255;
      data[o + 1] = 255;
      data[o + 2] = 255;
      data[o + 3] = 255;
    }
    for (const [x, y] of [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
    ] as const) {
      const o = (y * w + x) * 4;
      data[o] = 220;
      data[o + 1] = 30;
      data[o + 2] = 30;
      data[o + 3] = 255;
    }
    data[0] = MAGENTA_RGB.r;
    data[1] = MAGENTA_RGB.g;
    data[2] = MAGENTA_RGB.b;
    data[3] = 255;

    const keyed = applyMagentaChromaKeyToRgba(data, w, h);
    expect(keyed).toBeGreaterThan(0);
    const center = (1 * w + 1) * 4;
    expect(data[center + 3]).toBe(255);
    expect(data[3]).toBe(0);
  });
});
