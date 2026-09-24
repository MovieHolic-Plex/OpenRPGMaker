import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/assets/bundledReferenceImageManifest.json";
import {
  externalizeBundledReferenceImages,
  isBundledReferenceImage,
  referenceImageDigest,
  resolveReferenceImageDataUrl,
} from "@/project/bundledReferenceImages";
import { validateTilesetReferences } from "@/project/tilesetReferences";
import type { Project } from "@/project/types";

const paths = Object.values(manifest as Record<string, string>);

function referenceImages(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) { for (const item of value) referenceImages(item, out); return out; }
  if (!value || typeof value !== "object") return out;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.images) && record.documents !== undefined) {
    for (const image of record.images as { dataUrl?: unknown }[]) if (typeof image.dataUrl === "string") out.push(image.dataUrl);
  }
  for (const child of Object.values(record)) if (child && typeof child === "object") referenceImages(child, out);
  return out;
}

describe("bundled reference images", () => {
  it("ships no inline reference image bytes in src/assets bundles", () => {
    const inline: string[] = [];
    for (const name of readdirSync("src/assets").filter(file => file.endsWith(".json"))) {
      const text = readFileSync(`src/assets/${name}`, "utf8");
      if (!text.includes('"dataUrl"')) continue;
      for (const src of referenceImages(JSON.parse(text))) {
        if (src.startsWith("data:")) inline.push(name);
        else expect(isBundledReferenceImage(src), `${name}: ${src}`).toBe(true);
      }
    }
    // Regenerating a bundle with prepare-*/author-* scripts reintroduces data URLs:
    // run scripts/content/externalize-reference-images.mjs afterwards.
    expect([...new Set(inline)]).toEqual([]);
  });

  it("every manifest path exists under public/", () => {
    for (const path of new Set(paths)) expect(() => readFileSync(`public${path}`), path).not.toThrow();
  });

  it("round-trips a shipped file to the exact data URL its manifest digest names", async () => {
    const path = paths[0]!;
    const dataUrl = await resolveReferenceImageDataUrl(path);
    expect(dataUrl.startsWith("data:image/")).toBe(true);
    expect((manifest as Record<string, string>)[referenceImageDigest(dataUrl)]).toBe(path);
  });

  it("externalizes inline copies of shipped images and leaves authored uploads", async () => {
    const shipped = await resolveReferenceImageDataUrl(paths[0]!);
    const authored = "data:image/png;base64,iVBORw0KGgo=";
    const category = {
      id: "study", name: "study", description: "", documents: [],
      images: [
        { id: "a", name: "a", caption: "", dataUrl: shipped },
        { id: "b", name: "b", caption: "", dataUrl: authored },
      ],
    };
    const project = { tilesets: { t: { id: "t", referenceDocuments: [category] } } } as unknown as Project;
    expect(externalizeBundledReferenceImages(project)).toBe(true);
    const images = project.tilesets.t!.referenceDocuments![0]!.images;
    expect(images.map(image => image.dataUrl)).toEqual([paths[0], authored]);
    expect(category.images[0]!.dataUrl).toBe(shipped);
    expect(() => validateTilesetReferences(project.tilesets.t!.referenceDocuments)).not.toThrow();
    expect(externalizeBundledReferenceImages(project)).toBe(false);
  });

  it("rejects paths that could escape the asset root", () => {
    expect(isBundledReferenceImage("/assets/../secret.png")).toBe(false);
    expect(isBundledReferenceImage("https://example.com/a.png")).toBe(false);
    expect(isBundledReferenceImage("/assets/reference-images/abc.png")).toBe(true);
  });
});
