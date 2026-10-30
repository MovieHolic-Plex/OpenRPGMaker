// img-room-test: one room mockup from the image model, given the chipset part sheet(s).
//   bun scripts/experiments/img-room/gen_mockup.mts <boss|inn> <refs dir> <out.png>
// Prints one JSON line {ms, model, provider, bytes}. QA_IMAGE_PROVIDER=codex for GPT Image when Google returns 429.
import { readFileSync, writeFileSync } from "node:fs";
import { headlessGenerateImage } from "../../qa-game/lib/headlessImage.mts";

const [task, refs, out] = process.argv.slice(2);
if (!task || !refs || !out) throw Error("gen_mockup.mts <boss|inn> <refs dir> <out.png>");
const png = (f: string) => ({ mimeType: "image/png" as const, data: readFileSync(`${refs}/${f}`).toString("base64") });
const COMMON = "Style: 16px-per-tile SNES-era JRPG map, 3/4 top-down view (you see the top face of furniture and the front face of walls), orthographic, crisp pixel art, no perspective, no isometric angle. " +
  "Show the WHOLE room as one map screenshot seen from above, with dark void outside the walls. No people, no characters, no monsters, no text, no labels, no UI, no grid lines. " +
  "The attached image is only a PALETTE of the chipset pieces (floors, walls, furniture) — build the room out of those pieces with the same colours, pixel style and 16px proportions, and do not invent other furniture. " +
  "Never reproduce the palette sheet itself, never put the loose pieces in rows beside the room, never write any words or labels anywhere in the picture. The output is the finished room only.";
const PROMPTS: Record<string, { prompt: string; refs: string[] }> = {
  boss: {
    refs: ["boss-palette.png"],
    prompt: "Design a mockup of a dungeon BOSS ROOM deep under a demon lord's castle. " + COMMON +
      " Layout: not a plain rectangle. An entrance corridor from the south opens into an antechamber with side alcoves (a few sarcophagi, an armor stand, candelabras), " +
      "then a portcullis gate leads to the main throne hall: a long royal red carpet runner up the middle, pillars on both sides, purple braziers, and at the far north end a raised dais with the demon lord's throne as the landmark. " +
      "One small side room off the hall holds treasure. Floors: dark demon-realm stone. Walls: demon wall front faces with carved bands. Roughly 30x24 tiles.",
  },
  inn: {
    refs: ["inn-palette.png"],
    prompt: "Design a mockup of the GROUND FLOOR OF A SMALL VILLAGE INN: a reception counter that greets guests and a dining area where people eat. " + COMMON +
      " Layout: not a plain rectangle — an L-shaped or two-part room. Entrance door on the south wall with a doormat. Near the entrance the inn reception counter with a room key board and an inn sign on the wall behind it. " +
      "The main dining hall has several dining tables with chairs around them and benches, a fireplace on the north wall as the landmark with a rug in front, a wooden staircase up to the guest rooms in one corner, " +
      "and a small kitchen alcove behind a counter (kitchen range, sink, barrels, crates). Plank floor, plaster or log walls with windows and pictures. Roughly 22x16 tiles.",
  },
};
const p = PROMPTS[task];
if (!p) throw Error(`unknown task ${task}`);
const t0 = Date.now();
const img = await headlessGenerateImage({ prompt: p.prompt, referenceImages: p.refs.map(png) });
const buf = Buffer.from(img.dataUrl.slice(img.dataUrl.indexOf(",") + 1), "base64");
writeFileSync(out, buf);
console.log(JSON.stringify({ ms: Date.now() - t0, model: img.model, provider: img.provider, bytes: buf.length, prompt: p.prompt }));
process.exit(0);
