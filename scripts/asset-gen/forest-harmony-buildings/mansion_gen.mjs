import { readFileSync, writeFileSync } from "node:fs";
const OUT = process.env.OUT_DIR || "../../../.omo/asset-gen-tmp/fh-bld";
const prompt = [
  "EDIT TASK on a pixel art game tileset image, enlarged exactly 2x (every art pixel is one clean 2x2 block).",
  "RIGHT: a small finished house from this 16x16-tile top-down JRPG village tileset. It is the STYLE GUIDE: copy exactly its pixel size,",
  "palette, dark outlines, flat 2-4 tone shading, clay-tile shingle pattern, white plaster with timber framing, gray plinth, window style,",
  "and its top-down 3/4 camera (roofs seen from above, front walls facing the viewer, vertical sides, no perspective).",
  "Entrances are plain BLACK empty doorway openings exactly like the reference (no door leaves).",
  "LEFT: an empty area outlined by a DOTTED rectangle. Draw ONE grand manor house (a noble's mansion) filling that dotted rectangle:",
  "the building's outer edges touch the dotted lines, nothing outside it. Make it rich and varied: several roof wings of different heights,",
  "front gables, a central entrance hall with a black doorway and short stone steps, a small tower or dormers, chimneys, many windows,",
  "balconies or a porch — built from the same parts and scale as the reference house (wall stories are the same height as the reference's,",
  "windows and the doorway are the same size as the reference's). Leave the reference house unchanged.",
  "No text, no people, no ground, no trees, no shadow outside the building. Everything outside the buildings stays flat pure magenta #FF00FF;",
  "remove the dotted lines. Crisp pixel art on the 2x grid, no anti-aliasing, no gradients, no painterly noise.",
].join(" ");
const ref = readFileSync(`${OUT}/mansion-ref.png`).toString("base64");
await Promise.all([1, 2, 3].map(async (i) => {
  const t0 = Date.now();
  const res = await fetch("http://mdc-server:8091/v1/generate/json", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, slug: `fh-mansion-${i}`, return_base64: true, fallback: false, priority: 10, reference_b64: ref }), signal: AbortSignal.timeout(900000) });
  const j = await res.json().catch(() => null);
  if (!j?.image_b64) return console.error(i, "실패", res.status);
  writeFileSync(`${OUT}/mansion-c${i}-raw.png`, Buffer.from(j.image_b64, "base64")); console.log(i, "ok", ((Date.now() - t0) / 1000) | 0, "s");
}));
